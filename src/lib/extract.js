// src/lib/extract.js — 视频解码 / 精确定位 / 抓帧 / 导出
//
// 关键点：
// 1. 抽帧使用独立的隐藏 <video>，不打扰用户正在看的播放器；
// 2. 定位后等 requestVideoFrameCallback，确保画布拿到的是新解码出来的那一帧，
//    否则 drawImage 可能画到上一帧（这是浏览器抽帧最常见的坑）；
// 3. 画布复用，只有输出尺寸变化时才重建。

export const OUTPUT_MIME = { png: 'image/png', jpg: 'image/jpeg' };

/** 分辨率档位：按「外接矩形」等比缩放，永远不放大 */
export const RESOLUTION_BOXES = {
  original: null,
  '4k': { width: 3840, height: 2160 },
  '2k': { width: 2560, height: 1440 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
};

export function outputSize(srcWidth, srcHeight, resolution = 'original') {
  const width = Math.max(1, Math.round(srcWidth || 0));
  const height = Math.max(1, Math.round(srcHeight || 0));
  const box = RESOLUTION_BOXES[resolution];
  if (!box) return { width, height };
  const scale = Math.min(box.width / width, box.height / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

/** 创建用于抽帧的隐藏 video 元素 */
export function createHiddenVideo(src) {
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
  return video;
}

/** 等待元数据就绪（有 videoWidth 才能建画布） */
export function loadVideoMetadata(video, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && video.videoWidth > 0) {
      resolve();
      return;
    }
    let settled = false;
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onOk);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
    };
    const onOk = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('DECODE_FAILED'));
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('METADATA_TIMEOUT'));
    }, timeoutMs);
    video.addEventListener('loadedmetadata', onOk);
    video.addEventListener('error', onError);
    try {
      video.load();
    } catch {
      onError();
    }
  });
}

/** 定位到指定时间；返回实际定位到的时间 */
export function seekTo(video, time, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const target = Math.max(0, Number(time) || 0);
    if (Math.abs(video.currentTime - target) < 1e-4 && video.readyState >= 2) {
      resolve(video.currentTime);
      return;
    }
    let settled = false;
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onSeeked = () => finish(video.currentTime);
    const onError = () => fail(new Error('SEEK_FAILED'));
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    // 个别损坏文件不触发 seeked，超时兜底，避免整个流程卡死
    const timer = setTimeout(() => finish(video.currentTime), timeoutMs);
    try {
      video.currentTime = target;
    } catch (error) {
      fail(error);
    }
  });
}

/**
 * 等一帧真正被呈现出来（requestVideoFrameCallback），
 * 返回该帧的元数据（含 mediaTime），不支持时退化为双 rAF。
 */
export function waitForFrame(video, timeoutMs = 1500) {
  if (typeof video.requestVideoFrameCallback !== 'function') {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)));
    });
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);
    try {
      video.requestVideoFrameCallback((_now, metadata) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(metadata || null);
      });
    } catch {
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('TO_BLOB_FAILED'))),
      type,
      quality,
    );
  });
}

/** 定位 → 等帧 → 画布取像，返回实际抓到的媒体时间 */
export async function grabFrame(video, canvas, ctx, time, outWidth, outHeight) {
  await seekTo(video, time);
  const metadata = await waitForFrame(video);
  ctx.drawImage(video, 0, 0, outWidth, outHeight);
  const mediaTime = metadata && Number.isFinite(metadata.mediaTime) ? metadata.mediaTime : video.currentTime;
  return { mediaTime, presented: Boolean(metadata) };
}

/**
 * 批量抽帧
 * @param {object} options
 * @param {File|Blob} options.file
 * @param {number[]} options.times 目标时间点（秒，已排序）
 * @param {'png'|'jpg'} [options.format]
 * @param {number} [options.quality] JPG 质量 0~1
 * @param {string} [options.resolution] 分辨率档位
 * @param {AbortSignal} [options.signal]
 * @param {(info:{done:number,total:number,time:number,frame:object})=>void} [options.onProgress]
 * @returns {Promise<{frames:object[], aborted:boolean, source:object, output:object}>}
 */
export async function extractFrames(options) {
  const {
    file,
    times,
    format = 'png',
    quality = 0.92,
    resolution = 'original',
    signal,
    onProgress,
  } = options;

  const url = URL.createObjectURL(file);
  const video = createHiddenVideo(url);
  document.body.appendChild(video);

  const frames = [];
  try {
    await loadVideoMetadata(video);
    throwIfAborted(signal);

    const srcWidth = video.videoWidth;
    const srcHeight = video.videoHeight;
    if (!srcWidth || !srcHeight) throw new Error('DECODE_FAILED');

    const size = outputSize(srcWidth, srcHeight, resolution);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const mime = OUTPUT_MIME[format] || OUTPUT_MIME.png;
    const jpegQuality = Math.min(1, Math.max(0.1, Number(quality) || 0.92));
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity;

    for (let i = 0; i < times.length; i += 1) {
      if (signal?.aborted) {
        return { frames, aborted: true, source: { width: srcWidth, height: srcHeight }, output: size };
      }
      const target = Math.min(Math.max(0, times[i]), Number.isFinite(duration) ? Math.max(0, duration - 1e-3) : times[i]);
      const grabbed = await grabFrame(video, canvas, ctx, target, size.width, size.height);
      const blob = await canvasToBlob(canvas, mime, mime === OUTPUT_MIME.jpg ? jpegQuality : undefined);
      const frame = {
        id: `${i}-${Math.round(grabbed.mediaTime * 1000)}`,
        index: i,
        requestedTime: times[i],
        time: grabbed.mediaTime,
        blob,
        url: URL.createObjectURL(blob),
        width: size.width,
        height: size.height,
        size: blob.size,
        format,
        selected: true,
      };
      frames.push(frame);
      onProgress?.({ done: i + 1, total: times.length, time: grabbed.mediaTime, frame });
      // 让出主线程：刷新进度条、保持界面可交互
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return { frames, aborted: false, source: { width: srcWidth, height: srcHeight }, output: size };
  } finally {
    try {
      video.removeAttribute('src');
      video.load();
    } catch {
      /* 忽略卸载异常 */
    }
    video.remove();
    URL.revokeObjectURL(url);
  }
}

/** 释放一批帧占用的 object URL */
export function revokeFrames(frames) {
  for (const frame of frames || []) {
    if (frame?.url) URL.revokeObjectURL(frame.url);
  }
}
