<script setup>
// App.vue — 抽帧工具的顶层状态机
//
// 数据流：文件 → 元数据 → （时间段约束）→ 提取计划 → 抽帧 → 候选帧 → 单张/ZIP 下载

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { NConfigProvider, NSelect, NAlert, NProgress, NSpace, NH1, NP, NText, NCard, NIcon, NImage } from 'naive-ui';
import { zhCN, enUS, jaJP, koKR, dateZhCN, dateEnUS, dateJaJP, dateKoKR } from 'naive-ui';
import { i18n, setLang, langToPath } from './i18n.js';
import { DEFAULT_MAX_FRAMES, buildPlan, normalizeRange } from './lib/plan.js';
import { extractFrames, revokeFrames } from './lib/extract.js';
import { findKeyframes } from './lib/keyframes.js';
import { createZip } from './lib/zip.js';
import { formatTime, sanitizeName, timeStampForFile } from './lib/format.js';
import DropZone from './components/DropZone.vue';
import VideoStage from './components/VideoStage.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import FrameGrid from './components/FrameGrid.vue';
import GuideSection from './components/GuideSection.vue';

const t = (key, params) => i18n.t(key, params);

/* ---------------- Naive UI 主题与语言 ---------------- */

// 组件库内置 locale 与自研 i18n 联动切换
const NAIVE_LOCALES = { zh: zhCN, en: enUS, ja: jaJP, ko: koKR };
const NAIVE_DATE_LOCALES = { zh: dateZhCN, en: dateEnUS, ja: dateJaJP, ko: dateKoKR };
const naiveLocale = computed(() => NAIVE_LOCALES[i18n.lang] || zhCN);
const naiveDateLocale = computed(() => NAIVE_DATE_LOCALES[i18n.lang] || dateZhCN);

const LANG_OPTIONS = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
];

const NOTICE_TYPES = { ok: 'success', warn: 'warning', error: 'error' };

/* ---------------- 状态 ---------------- */

const file = ref(null);
const videoUrl = ref('');
const meta = ref(null); // { name, size, duration, width, height }

const mode = ref('count');
const count = ref(10);
const interval = ref(1);
const timestampsText = ref('');
const format = ref('png');
const quality = ref(0.92);
const resolution = ref('original');
const sensitivity = ref('medium');
const density = ref('medium');
const namePrefix = ref('');
const range = ref({ enabled: false, start: 0, end: 0 });

const frames = ref([]);
const busy = ref(false);
const progress = reactive({ done: 0, total: 0, time: 0, thumb: '' });
const packing = reactive({ active: false, done: 0, total: 0 });
const keyframeState = reactive({ status: 'idle', source: '', count: 0, times: [], done: 0, total: 0 });
const notices = ref([]);

const stageRef = ref(null);
let extractController = null;
let detectController = null;
let noticeId = 0;

/* ---------------- 派生数据 ---------------- */

const duration = computed(() => meta.value?.duration || 0);

const scope = computed(() => {
  const normalized = normalizeRange(range.value, duration.value);
  return { start: normalized.start, end: normalized.end, enabled: normalized.enabled };
});

const plan = computed(() =>
  buildPlan({
    mode: mode.value,
    duration: duration.value,
    range: range.value,
    count: count.value,
    interval: interval.value,
    timestampsText: timestampsText.value,
    keyframeTimes: keyframeState.times,
    maxFrames: DEFAULT_MAX_FRAMES,
  }),
);

const estimate = computed(() => plan.value.times.length);
const progressPercent = computed(() =>
  progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0,
);
const scanPercent = computed(() =>
  keyframeState.total ? Math.min(100, Math.round((keyframeState.done / keyframeState.total) * 100)) : 0,
);
const detecting = computed(() => keyframeState.status === 'detecting');
// 关键帧模式即使还没检测也允许点「开始提取」：onExtract 会先自动检测
const canExtract = computed(
  () => Boolean(file.value) && duration.value > 0 && (estimate.value > 0 || mode.value === 'keyframe'),
);

/* ---------------- 提示 ---------------- */

function pushNotice(type, text) {
  if (!text) return;
  noticeId += 1;
  const notice = { id: noticeId, type, text };
  notices.value = [...notices.value, notice].slice(-4);
  if (type === 'ok') {
    setTimeout(() => dismissNotice(notice.id), 8000);
  }
}

function dismissNotice(id) {
  notices.value = notices.value.filter((notice) => notice.id !== id);
}

function describeWarnings(warnings) {
  for (const warning of warnings || []) {
    switch (warning.code) {
      case 'TRUNCATED':
        pushNotice('warn', t('warnTruncated', { n: warning.n, from: warning.from }));
        break;
      case 'OUT_OF_RANGE':
        pushNotice('warn', t('warnOutOfRange', { n: warning.n }));
        break;
      case 'INVALID_TIMESTAMPS':
        pushNotice('warn', t('warnInvalidTimestamps', { n: warning.n }));
        break;
      case 'RANGE_INVALID':
        pushNotice('warn', t('warnRangeInvalid'));
        break;
      case 'KEYFRAME_EMPTY':
        pushNotice('warn', t('errKeyframeEmpty'));
        break;
      default:
        break;
    }
  }
}

/* ---------------- 文件载入 ---------------- */

function releaseVideoUrl() {
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value);
    videoUrl.value = '';
  }
}

function onFile(selected) {
  if (!selected) return;
  if (!selected.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv|ogv|ogg)$/i.test(selected.name)) {
    pushNotice('warn', t('dropHint'));
  }
  clearFrames();
  releaseVideoUrl();
  file.value = selected;
  videoUrl.value = URL.createObjectURL(selected);
  meta.value = { name: selected.name, size: selected.size, duration: 0, width: 0, height: 0 };
  range.value = { enabled: false, start: 0, end: 0 };
  keyframeState.status = 'idle';
  keyframeState.times = [];
  keyframeState.count = 0;
  keyframeState.source = '';
  namePrefix.value = sanitizeName(selected.name);
  notices.value = [];
  progress.done = 0;
  progress.total = 0;
  progress.thumb = '';
}

function onLoaded(info) {
  if (!meta.value) return;
  meta.value = { ...meta.value, duration: info.duration, width: info.width, height: info.height };
  range.value = { enabled: false, start: 0, end: info.duration };
}

function onVideoFailed() {
  pushNotice('error', t('errDecode'));
}

function clearFrames() {
  revokeFrames(frames.value);
  frames.value = [];
}

/* ---------------- 关键帧检测 ---------------- */

async function detectKeyframes() {
  const video = stageRef.value?.video;
  if (!file.value || !duration.value || !video) return;
  if (detecting.value) return;

  detectController?.abort();
  detectController = new AbortController();
  keyframeState.status = 'detecting';
  keyframeState.done = 0;
  keyframeState.total = 0;

  try {
    const result = await findKeyframes({
      file: file.value,
      video,
      duration: duration.value,
      sensitivity: sensitivity.value,
      density: density.value,
      signal: detectController.signal,
      onProgress: (info) => {
        if (info.phase === 'scene') {
          keyframeState.done = info.done || 0;
          keyframeState.total = info.total || 0;
        }
      },
    });
    keyframeState.times = result.times;
    keyframeState.count = result.times.length;
    keyframeState.source = result.source;
    keyframeState.status = 'ready';
    if (!result.times.length) {
      pushNotice('warn', t('errKeyframeEmpty'));
    } else if (result.source === 'container') {
      pushNotice('ok', t('keyframeFromContainer', { n: result.times.length }));
    } else {
      pushNotice('ok', t('keyframeFromScene', { n: result.times.length }));
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      keyframeState.status = 'idle';
    } else {
      keyframeState.status = 'error';
      pushNotice('error', t('errGeneric', { detail: error?.message || error }));
    }
  } finally {
    detectController = null;
  }
}

// 换文件或改检测参数后，之前的关键帧结果不再可靠
watch([file, sensitivity, density], () => {
  if (keyframeState.status === 'ready') {
    keyframeState.status = 'idle';
    keyframeState.times = [];
    keyframeState.count = 0;
    keyframeState.source = '';
  }
});

/* ---------------- 抽帧 ---------------- */

async function onExtract() {
  if (!file.value) {
    pushNotice('error', t('errNoFile'));
    return;
  }

  if (mode.value === 'keyframe' && !keyframeState.times.length) {
    await detectKeyframes();
  }

  const times = plan.value.times;
  if (!times.length) {
    pushNotice('error', t('errNoTimes'));
    describeWarnings(plan.value.warnings);
    return;
  }
  describeWarnings(plan.value.warnings);

  busy.value = true;
  progress.done = 0;
  progress.total = times.length;
  progress.time = times[0];
  progress.thumb = '';
  extractController = new AbortController();

  try {
    const result = await extractFrames({
      file: file.value,
      times,
      format: format.value,
      quality: quality.value,
      resolution: resolution.value,
      signal: extractController.signal,
      onProgress: (info) => {
        progress.done = info.done;
        progress.time = info.time;
        progress.thumb = info.frame?.url || '';
      },
    });

    if (result.frames.length) {
      frames.value = [...frames.value, ...result.frames].sort((a, b) => a.time - b.time);
    }
    if (result.aborted) {
      pushNotice('warn', t('abortedNote', { n: result.frames.length }));
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      pushNotice('warn', t('abortedNote', { n: 0 }));
    } else if (error?.message === 'DECODE_FAILED' || error?.message === 'METADATA_TIMEOUT') {
      pushNotice('error', t('errDecode'));
    } else if (error?.message === 'SEEK_FAILED') {
      pushNotice('error', t('errSeek'));
    } else {
      pushNotice('error', t('errGeneric', { detail: error?.message || error }));
    }
  } finally {
    busy.value = false;
    extractController = null;
    progress.thumb = '';
  }
}

function onCancel() {
  extractController?.abort();
}

/* ---------------- 下载 ---------------- */

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

function frameFileName(frame) {
  const prefix = (namePrefix.value || '').trim() || sanitizeName(meta.value?.name || 'frame');
  return `${prefix}_${timeStampForFile(frame.time)}.${frame.format}`;
}

function onToggleFrame(frame) {
  frame.selected = !frame.selected;
}

function selectAll() {
  for (const frame of frames.value) frame.selected = true;
}

function deselectAll() {
  for (const frame of frames.value) frame.selected = false;
}

function invertSelection() {
  for (const frame of frames.value) frame.selected = !frame.selected;
}

function onSaveFrame(frame) {
  triggerDownload(frame.blob, frameFileName(frame));
}

function onRemoveFrame(frame) {
  URL.revokeObjectURL(frame.url);
  frames.value = frames.value.filter((item) => item !== frame);
}

async function onDownloadSelected() {
  const selected = frames.value.filter((frame) => frame.selected);
  for (const [index, frame] of selected.entries()) {
    triggerDownload(frame.blob, frameFileName(frame));
    // 连续触发多个下载时浏览器需要喘息时间
    if (index < selected.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }
}

async function onDownloadZip() {
  const selected = frames.value.filter((frame) => frame.selected);
  if (!selected.length) return;
  const prefix = (namePrefix.value || '').trim() || sanitizeName(meta.value?.name || 'frames');
  packing.active = true;
  packing.done = 0;
  packing.total = selected.length;
  try {
    const zip = await createZip(
      selected.map((frame) => ({ name: frameFileName(frame), blob: frame.blob })),
      { onProgress: (done, total) => { packing.done = done; packing.total = total; } },
    );
    triggerDownload(zip, `${prefix}_frames_${selected.length}.zip`);
  } catch (error) {
    if (error?.message === 'ZIP_TOO_LARGE') pushNotice('error', t('errZipTooLarge'));
    else if (error?.name !== 'AbortError') pushNotice('error', t('errGeneric', { detail: error?.message || error }));
  } finally {
    packing.active = false;
  }
}

function onSeekFrame(time) {
  const video = stageRef.value?.video;
  if (!video) return;
  video.pause();
  video.currentTime = Math.min(duration.value, Math.max(0, time));
  document.querySelector('.stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------- 生命周期 ---------------- */

// 切语言时同步 URL 路径（与 imgcrop 一致：/ = 中文，/en /ja /ko）
function syncLangUrl(push = true) {
  const path = langToPath[i18n.lang] || '/';
  const url = window.location.origin + path + window.location.search + window.location.hash;
  if (url !== window.location.href) {
    history[push ? 'pushState' : 'replaceState']({ lang: i18n.lang }, '', url);
  }
}

function onLangChange(value) {
  setLang(value);
  syncLangUrl();
}

onMounted(() => {
  // 首屏按当前语言（localStorage / 浏览器语言）对齐一次 URL，不产生历史记录
  syncLangUrl(false);
});

onBeforeUnmount(() => {
  extractController?.abort();
  detectController?.abort();
  clearFrames();
  releaseVideoUrl();
});
</script>

<template>
  <n-config-provider :locale="naiveLocale" :date-locale="naiveDateLocale">
    <div class="page">
      <header class="topbar">
        <n-space align="center" :size="12">
          <n-icon :size="32" class="logo" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="#18a058" />
              <rect x="12" y="17" width="40" height="30" rx="5" fill="none" stroke="#fff" stroke-width="3" />
              <path d="M12 27h40M12 37h40M24 17v30M40 17v30" stroke="#fff" stroke-width="3" />
            </svg>
          </n-icon>
          <n-space vertical :size="2">
            <n-text strong class="brand-name">{{ t('appName') }}</n-text>
            <n-text depth="3" class="brand-tag">{{ t('appTagline') }}</n-text>
          </n-space>
        </n-space>
        <n-select
          class="lang-select"
          :value="i18n.lang"
          :options="LANG_OPTIONS"
          :consistent-menu-width="false"
          size="small"
          aria-label="Language"
          @update:value="onLangChange"
        />
      </header>

      <main>
        <section class="hero">
          <n-h1>{{ t('heroTitle') }}</n-h1>
          <n-p>{{ t('heroSub') }}</n-p>
        </section>

        <DropZone :meta="meta" :busy="busy" @file="onFile" />

        <n-space v-if="notices.length" vertical :size="8" class="notices">
          <n-alert
            v-for="notice in notices"
            :key="notice.id"
            :type="NOTICE_TYPES[notice.type] || 'info'"
            closable
            @close="dismissNotice(notice.id)"
          >
            {{ notice.text }}
          </n-alert>
        </n-space>

        <!-- 选中文件后立刻渲染工作区：时长/分辨率由里面的 <video> 加载后回传，
             所以这里不能用 duration > 0 做条件（否则会永远等不到元数据）。 -->
        <div v-if="meta" class="workspace">
          <div class="col-left">
            <VideoStage
              ref="stageRef"
              v-model:range="range"
              :url="videoUrl"
              :duration="duration"
              :markers="keyframeState.times"
              :busy="busy || detecting"
              @loaded="onLoaded"
              @failed="onVideoFailed"
            />

            <n-card v-if="busy || detecting" size="small" class="progress-card">
              <template v-if="detecting">
                <n-space justify="space-between" :wrap="false" class="progress-head">
                  <n-text>{{ t('keyframeProgress', { done: keyframeState.done, total: keyframeState.total || '…' }) }}</n-text>
                  <n-text class="mono">{{ scanPercent }}%</n-text>
                </n-space>
                <n-progress
                  type="line"
                  :percentage="scanPercent"
                  :show-indicator="false"
                  :height="8"
                  :border-radius="4"
                />
              </template>
              <template v-else>
                <n-space justify="space-between" :wrap="false" class="progress-head">
                  <n-text>
                    {{ t('progressLabel', { done: progress.done, total: progress.total, time: formatTime(progress.time) }) }}
                  </n-text>
                  <n-text class="mono">{{ progressPercent }}%</n-text>
                </n-space>
                <n-progress
                  type="line"
                  :percentage="progressPercent"
                  :show-indicator="false"
                  :height="8"
                  :border-radius="4"
                />
                <n-image v-if="progress.thumb" class="progress-thumb" :src="progress.thumb" alt="" object-fit="contain" />
              </template>
            </n-card>
          </div>

          <div class="col-right">
            <SettingsPanel
              v-model:mode="mode"
              v-model:count="count"
              v-model:interval="interval"
              v-model:timestampsText="timestampsText"
              v-model:format="format"
              v-model:quality="quality"
              v-model:resolution="resolution"
              v-model:sensitivity="sensitivity"
              v-model:density="density"
              v-model:namePrefix="namePrefix"
              :scope="scope"
              :estimate="estimate"
              :keyframe-state="keyframeState"
              :busy="busy || detecting"
              :can-extract="canExtract"
              @extract="onExtract"
              @cancel="onCancel"
              @detect-keyframes="detectKeyframes"
            />
          </div>

          <div class="col-full">
            <FrameGrid
              :frames="frames"
              :busy="busy"
              :packing="packing"
              @toggle="onToggleFrame"
              @select-all="selectAll"
              @invert="invertSelection"
              @deselect-all="deselectAll"
              @download-zip="onDownloadZip"
              @download-selected="onDownloadSelected"
              @clear="clearFrames"
              @save="onSaveFrame"
              @remove="onRemoveFrame"
              @seek="onSeekFrame"
            />
          </div>
        </div>

        <GuideSection />
      </main>

      <footer class="footer">
        <n-p>{{ t('footerNote') }}</n-p>
      </footer>
    </div>
  </n-config-provider>
</template>
