// src/lib/keyframes.js — 关键帧检测
//
// 两条路线：
// A. MP4 / MOV：直接解析容器得到编码器真正的 I 帧时间，准确且几乎不耗时。
//      · 经典 MP4：moov/trak/mdia/minf/stbl 里的 stss（同步样本表）+ stts（时长表），必要时叠加 ctts。
//      · 分片 MP4（手机录屏、ffmpeg -movflags frag_keyframe 常见）：样本在 moof/traf/trun 里，
//        关键帧由 trun 的 sample_flags（或 tfhd/trex 默认值）中的 sample_is_non_sync 位判断。
// B. 其他封装（WebM/MKV/未知）或没有关键帧信息：用「画面变化检测」扫描候选时间点，
//    取直方图差异超过阈值的帧作为场景切换候选（对运动有一定鲁棒性）。

import { seekTo, waitForFrame } from './extract.js';

/** sample_flags 中的 sample_is_non_sync_sample 位 */
const SAMPLE_IS_NON_SYNC = 0x00010000;

/* ------------------------------------------------------------------ */
/* 通用二进制读取                                                      */
/* ------------------------------------------------------------------ */

function ascii(bytes, offset, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

function u32(bytes, offset) {
  return (
    (bytes[offset] * 16777216 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0
  );
}

function u64(bytes, offset) {
  return u32(bytes, offset) * 4294967296 + u32(bytes, offset + 4);
}

function boxFlags(bytes, offset) {
  return (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

/** 按需读取 File/Blob 的片段，避免把整个文件读进内存 */
class SliceReader {
  constructor(file) {
    this.file = file;
    this.cache = new Map();
  }

  async bytes(start, length) {
    const from = Math.max(0, Math.floor(start));
    const to = Math.min(this.file.size, from + Math.max(0, Math.floor(length)));
    if (to <= from) return new Uint8Array(0);
    const key = `${from}:${to}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const buffer = await this.file.slice(from, to).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (this.cache.size > 32) this.cache.clear();
    this.cache.set(key, bytes);
    return bytes;
  }
}

/** 列出 [start, end) 区间内的所有 box */
async function listBoxes(reader, start, end) {
  const boxes = [];
  let pos = start;
  let guard = 0;
  while (pos + 8 <= end && guard < 200000) {
    guard += 1;
    const header = await reader.bytes(pos, 16);
    if (header.byteLength < 8) break;
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    let size = view.getUint32(0);
    const type = ascii(header, 4, 4);
    let headerSize = 8;
    if (size === 1) {
      if (header.byteLength < 16) break;
      size = view.getUint32(8) * 4294967296 + view.getUint32(12);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) size = end - pos; // 容错
    boxes.push({ type, size, headerSize, dataStart: pos + headerSize, end: pos + size });
    pos += size;
  }
  return boxes;
}

/** 在已读入内存的字节里遍历子 box */
function* walkBoxes(bytes, start = 0, end = bytes.byteLength) {
  let pos = start;
  while (pos + 8 <= end) {
    let size = u32(bytes, pos);
    const type = ascii(bytes, pos + 4, 4);
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > end) return;
      size = u64(bytes, pos + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) size = end - pos;
    yield { type, size, headerSize, bodyStart: pos + headerSize, end: pos + size };
    pos += size;
  }
}

function findBox(boxes, type) {
  return boxes.find((box) => box.type === type);
}

function dedupeTimes(times, epsilon = 0.0005) {
  const out = [];
  for (const time of times) {
    if (!out.length || time - out[out.length - 1] > epsilon) out.push(time);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* moov 解析（经典 + 分片共用）                                        */
/* ------------------------------------------------------------------ */

/** mdhd → timescale */
function readTimescale(bytes) {
  if (bytes.byteLength < 16) return 0;
  const version = bytes[0];
  const offset = version === 1 ? 20 : 12;
  if (bytes.byteLength < offset + 4) return 0;
  return u32(bytes, offset);
}

/** tkhd → track_ID */
function readTrackId(bytes) {
  if (bytes.byteLength < 16) return 0;
  const version = bytes[0];
  const offset = version === 1 ? 20 : 12;
  if (bytes.byteLength < offset + 4) return 0;
  return u32(bytes, offset);
}

/** stss → 关键帧序号（0 基） */
function readSyncSamples(bytes) {
  if (bytes.byteLength < 8) return new Uint32Array(0);
  const declared = u32(bytes, 4);
  const count = Math.min(declared, Math.floor((bytes.byteLength - 8) / 4));
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) out[i] = u32(bytes, 8 + i * 4) - 1;
  return out;
}

/** stts / ctts → 游程编码表 [{count, delta}] */
function readRunLengthEntries(bytes, { signed = false } = {}) {
  if (bytes.byteLength < 8) return [];
  const version = bytes[0];
  const declared = u32(bytes, 4);
  const count = Math.min(declared, Math.floor((bytes.byteLength - 8) / 8));
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const offset = 8 + i * 8;
    entries.push({
      count: u32(bytes, offset),
      delta: signed && version === 1 ? new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getInt32(0) : u32(bytes, offset + 4),
    });
  }
  return entries;
}

/**
 * 从游程编码表里取出指定样本序号对应的累计值
 * @param {Array<{count:number,delta:number}>} entries
 * @param {number[]|Uint32Array} indices 升序的 0 基样本序号
 * @param {number} divisor 累加步长除数（timescale 时直接得到秒）
 */
function pickRunLength(entries, indices, divisor) {
  const out = new Float64Array(indices.length).fill(NaN);
  let pointer = 0;
  let sample = 0;
  let value = 0;
  for (const entry of entries) {
    const entryEnd = sample + entry.count;
    while (pointer < indices.length && indices[pointer] < entryEnd) {
      out[pointer] = value + (indices[pointer] - sample) * (entry.delta / divisor);
      pointer += 1;
    }
    if (pointer >= indices.length) break;
    value += entry.count * (entry.delta / divisor);
    sample = entryEnd;
  }
  return out;
}

/** 解析 moov，挑出视频轨，返回经典模式所需的样本表与分片模式所需的 trex */
async function parseMoov(reader, moov) {
  const moovChildren = await listBoxes(reader, moov.dataStart, moov.end);
  const result = {
    timescale: 0,
    trackId: 0,
    stss: null,
    sttsEntries: [],
    ctts: null,
    fragmented: Boolean(findBox(moovChildren, 'mvex')),
    trex: null,
  };

  for (const trak of moovChildren.filter((box) => box.type === 'trak')) {
    const trakChildren = await listBoxes(reader, trak.dataStart, trak.end);
    const mdia = findBox(trakChildren, 'mdia');
    if (!mdia) continue;
    const mdiaChildren = await listBoxes(reader, mdia.dataStart, mdia.end);

    const hdlr = findBox(mdiaChildren, 'hdlr');
    if (hdlr) {
      const head = await reader.bytes(hdlr.dataStart, Math.min(12, hdlr.size - hdlr.headerSize));
      if (head.byteLength >= 12 && ascii(head, 8, 4) !== 'vide') continue; // 只要视频轨
    }

    const mdhd = findBox(mdiaChildren, 'mdhd');
    const minf = findBox(mdiaChildren, 'minf');
    if (!mdhd || !minf) continue;
    const timescale = readTimescale(await reader.bytes(mdhd.dataStart, Math.min(32, mdhd.size - mdhd.headerSize)));
    if (!timescale) continue;

    const tkhd = findBox(trakChildren, 'tkhd');
    const trackId = tkhd ? readTrackId(await reader.bytes(tkhd.dataStart, Math.min(32, tkhd.size - tkhd.headerSize))) : 0;

    result.timescale = timescale;
    result.trackId = trackId;

    const stbl = findBox(await listBoxes(reader, minf.dataStart, minf.end), 'stbl');
    if (stbl) {
      const stblChildren = await listBoxes(reader, stbl.dataStart, stbl.end);
      const stss = findBox(stblChildren, 'stss');
      const stts = findBox(stblChildren, 'stts');
      const ctts = findBox(stblChildren, 'ctts');
      if (stss) result.stss = readSyncSamples(await reader.bytes(stss.dataStart, stss.size - stss.headerSize));
      if (stts) result.sttsEntries = readRunLengthEntries(await reader.bytes(stts.dataStart, stts.size - stts.headerSize));
      if (ctts) result.ctts = readRunLengthEntries(await reader.bytes(ctts.dataStart, ctts.size - ctts.headerSize), { signed: true });
    }
    break; // 只处理第一条视频轨
  }

  const mvex = findBox(moovChildren, 'mvex');
  if (mvex) {
    for (const trex of (await listBoxes(reader, mvex.dataStart, mvex.end)).filter((box) => box.type === 'trex')) {
      const body = await reader.bytes(trex.dataStart, Math.min(24, trex.size - trex.headerSize));
      if (body.byteLength < 24) continue;
      if (result.trackId && u32(body, 4) !== result.trackId) continue;
      result.trex = {
        defaultSampleDuration: u32(body, 12),
        defaultSampleSize: u32(body, 16),
        defaultSampleFlags: u32(body, 20),
      };
      break;
    }
  }
  return result.timescale ? result : null;
}

/* ------------------------------------------------------------------ */
/* 分片 MP4（moof/traf/trun）                                          */
/* ------------------------------------------------------------------ */

function collectTrafSyncSamples(trafBytes, context, out) {
  let trackId = context.trackId;
  let defaultDuration = context.trex?.defaultSampleDuration || 0;
  let defaultFlags = context.trex?.defaultSampleFlags || 0;
  let flagSource = context.trex ? 'trex' : null;
  let baseDecodeTime = 0;
  const runs = [];

  for (const box of walkBoxes(trafBytes)) {
    const body = trafBytes.subarray(box.bodyStart, box.end);
    if (box.type === 'tfhd') {
      const flags = boxFlags(body, 0);
      let p = 4;
      trackId = u32(body, p);
      p += 4;
      if (flags & 0x000001) p += 8; // base_data_offset
      if (flags & 0x000002) p += 4; // sample_description_index
      if (flags & 0x000008) {
        defaultDuration = u32(body, p);
        p += 4;
      }
      if (flags & 0x000010) p += 4; // default_sample_size
      if (flags & 0x000020) {
        defaultFlags = u32(body, p);
        flagSource = 'tfhd';
        p += 4;
      }
    } else if (box.type === 'tfdt') {
      baseDecodeTime = body[0] === 1 ? u64(body, 4) : u32(body, 4);
    } else if (box.type === 'trun') {
      runs.push(body);
    }
  }

  if (context.trackId && trackId && trackId !== context.trackId) return; // 非视频轨

  for (const body of runs) {
    const flags = boxFlags(body, 0);
    let p = 4;
    const sampleCount = u32(body, p);
    p += 4;
    if (flags & 0x000001) p += 4; // data_offset
    let firstSampleFlags = null;
    if (flags & 0x000004) {
      firstSampleFlags = u32(body, p);
      p += 4;
      flagSource = flagSource || 'trun';
    }

    let decodeTime = baseDecodeTime;
    for (let i = 0; i < sampleCount; i += 1) {
      let duration = defaultDuration;
      let sampleFlags = defaultFlags;
      if (flags & 0x000100) {
        duration = u32(body, p);
        p += 4;
      }
      if (flags & 0x000200) p += 4; // sample_size
      if (flags & 0x000400) {
        sampleFlags = u32(body, p);
        p += 4;
        flagSource = flagSource || 'trun';
      }
      if (flags & 0x000800) p += 4; // sample_composition_time_offset

      const effectiveFlags = i === 0 && firstSampleFlags !== null ? firstSampleFlags : sampleFlags;
      if (!(effectiveFlags & SAMPLE_IS_NON_SYNC)) out.push(decodeTime);
      decodeTime += duration;
    }
    baseDecodeTime = decodeTime;
  }
  return flagSource;
}

/** 分片 MP4：遍历所有 moof，收集同步样本的（解码）时间 */
async function readFragmentedKeyframes(reader, topBoxes, moovInfo) {
  const moofs = topBoxes.filter((box) => box.type === 'moof');
  if (!moofs.length) return null;

  const ticks = [];
  let samples = 0;
  let flagSource = null;
  const context = { trackId: moovInfo.trackId, trex: moovInfo.trex };

  for (const moof of moofs.slice(0, 50000)) {
    const bytes = await reader.bytes(moof.dataStart, moof.size - moof.headerSize);
    if (!bytes.byteLength) continue;
    for (const box of walkBoxes(bytes)) {
      if (box.type !== 'traf') continue;
      const trafBytes = bytes.subarray(box.bodyStart, box.end);
      const source = collectTrafSyncSamples(trafBytes, context, ticks);
      flagSource = flagSource || source;
      // 统计样本总数（仅用于展示与健全性检查）
      for (const sub of walkBoxes(trafBytes)) {
        if (sub.type === 'trun') samples += u32(trafBytes, sub.bodyStart + 4);
      }
    }
  }

  if (!ticks.length) return null;
  // 没有任何 flags 信息时，收集到的只是「每个分片的第一帧」，属于启发式结果
  if (!flagSource) return null;
  // 所有样本都被判定为同步样本 → 说明 flags 不可信，交给画面检测更有意义
  if (samples && ticks.length >= samples) return null;

  ticks.sort((a, b) => a - b);
  const timescale = moovInfo.timescale;
  return {
    times: dedupeTimes(ticks.map((tick) => Math.max(0, tick / timescale))),
    samples,
    fragmented: true,
  };
}

/* ------------------------------------------------------------------ */
/* 经典 MP4                                                            */
/* ------------------------------------------------------------------ */

function readClassicKeyframes(moovInfo) {
  const { stss, sttsEntries, ctts, timescale } = moovInfo;
  if (!stss?.length || !sttsEntries?.length || !timescale) return null;

  const indices = Array.from(stss).sort((a, b) => a - b);
  const dtsTicks = pickRunLength(sttsEntries, indices, 1);
  let ctsTicks = dtsTicks;
  if (ctts?.length) {
    const offsets = pickRunLength(ctts, indices, 1);
    ctsTicks = dtsTicks.map((value, i) => (Number.isNaN(value) ? value : value + (Number.isNaN(offsets[i]) ? 0 : offsets[i])));
  }

  const times = [];
  for (const ticks of ctsTicks) {
    if (Number.isFinite(ticks)) times.push(Math.max(0, ticks / timescale));
  }
  if (!times.length) return null;
  times.sort((a, b) => a - b);
  return {
    times: dedupeTimes(times),
    samples: sttsEntries.reduce((sum, entry) => sum + entry.count, 0),
    fragmented: false,
  };
}

/**
 * 解析 MP4/MOV 的关键帧时间
 * @param {Blob|File} file
 * @returns {Promise<{times:number[], samples:number, fragmented:boolean, timescale:number}|null>}
 */
export async function readMp4Keyframes(file, { maxMoovBytes = 96 * 1024 * 1024 } = {}) {
  if (!file || !file.size) return null;
  const reader = new SliceReader(file);
  const top = await listBoxes(reader, 0, file.size);
  const moov = findBox(top, 'moov');
  if (!moov) return null;
  if (moov.size > maxMoovBytes) return null; // 极端长片，放弃容器解析

  const moovInfo = await parseMoov(reader, moov);
  if (!moovInfo) return null;

  const classic = readClassicKeyframes(moovInfo);
  if (classic) return { ...classic, timescale: moovInfo.timescale };

  const fragmented = await readFragmentedKeyframes(reader, top, moovInfo);
  if (fragmented) return { ...fragmented, timescale: moovInfo.timescale };

  return null;
}

/* ------------------------------------------------------------------ */
/* 画面变化检测（关键帧兜底方案）                                      */
/* ------------------------------------------------------------------ */

export const SENSITIVITY_THRESHOLDS = { low: 0.2, medium: 0.12, high: 0.06 };
export const DENSITY_SAMPLES = { low: 120, medium: 240, high: 480 };

/** 灰度直方图（32 桶，归一化） */
function grayscaleHistogram(pixels, bins = 32) {
  const hist = new Float32Array(bins);
  const total = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
    hist[Math.min(bins - 1, Math.floor((luma / 256) * bins))] += 1;
  }
  for (let i = 0; i < bins; i += 1) hist[i] /= total || 1;
  return hist;
}

/** 直方图距离（0 = 完全相同，1 = 完全不同） */
function histogramDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / 2;
}

/**
 * 扫描视频，找出画面发生明显变化的时间点
 * @param {HTMLVideoElement} video 已就绪的视频元素（会被定位）
 */
export async function detectScenes(video, options = {}) {
  const { duration = 0, sensitivity = 'medium', density = 'medium', signal, onProgress } = options;

  const dur = Number.isFinite(duration) && duration > 0 ? duration : video.duration;
  if (!Number.isFinite(dur) || dur <= 0) return { times: [], samples: 0, threshold: 0 };

  const threshold = SENSITIVITY_THRESHOLDS[sensitivity] ?? SENSITIVITY_THRESHOLDS.medium;
  const maxSamples = DENSITY_SAMPLES[density] ?? DENSITY_SAMPLES.medium;

  const srcWidth = video.videoWidth || 64;
  const srcHeight = video.videoHeight || 36;
  const width = 64;
  const height = Math.max(2, Math.round(((srcHeight / srcWidth) * width) / 2) * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { times: [], samples: 0, threshold };

  const step = Math.max(dur / maxSamples, 1 / 60);
  const total = Math.ceil(dur / step);
  const times = [];
  let previous = null;
  let scanned = 0;
  const wasPaused = video.paused;
  try {
    video.pause();
  } catch {
    /* 忽略 */
  }

  try {
    for (let t = 0; t <= dur - 1e-4; t += step) {
      if (signal?.aborted) break;
      await seekTo(video, Math.min(t, dur - 1e-3));
      await waitForFrame(video);
      ctx.drawImage(video, 0, 0, width, height);
      const histogram = grayscaleHistogram(ctx.getImageData(0, 0, width, height).data);
      if (!previous || histogramDistance(previous, histogram) >= threshold) times.push(t);
      previous = histogram;
      scanned += 1;
      onProgress?.({ phase: 'scene', done: scanned, total });
    }
  } finally {
    if (!wasPaused) video.play().catch(() => {});
  }

  return { times: dedupeTimes(times, step * 0.5), samples: scanned, threshold };
}

/**
 * 统一入口：优先容器关键帧，失败则画面变化检测
 * @returns {Promise<{times:number[], source:'container'|'scene', detail:object}>}
 */
export async function findKeyframes(options) {
  const { file, video, duration, sensitivity = 'medium', density = 'medium', signal, onProgress } = options;

  onProgress?.({ phase: 'container', done: 0, total: 1 });
  let container = null;
  try {
    container = await readMp4Keyframes(file);
  } catch {
    container = null; // 容器损坏/非 MP4：静默回落到画面检测
  }
  if (container?.times?.length) {
    return { times: container.times, source: 'container', detail: container };
  }

  onProgress?.({ phase: 'scene', done: 0, total: 1 });
  const scenes = await detectScenes(video, { duration, sensitivity, density, signal, onProgress });
  return { times: scenes.times, source: 'scene', detail: scenes };
}
