<script setup>
// VideoStage.vue — 视频预览 + 时间轴 + 时间段选区
//
// 选区交互：
//   · 拖动左右手柄 → 调整起点/终点（自动启用区间）
//   · 拖动选区主体 → 整体平移，长度不变
//   · 点击轨道空白 → 跳转播放位置
//   · 手柄支持键盘 ←/→（±0.1s）、Shift+←/→（±1s）

import { computed, ref, watch } from 'vue';
import { NCard, NButton, NSwitch, NInput, NText, NSpace, NForm, NFormItem, NH2, NTag, NDivider, NBadge, NIcon } from 'naive-ui';
import {
  PlayOutline,
  PauseOutline,
  PlayBackOutline,
  PlayForwardOutline,
  VolumeHighOutline,
  VolumeMuteOutline,
} from '@vicons/ionicons5';
import { formatTime, parseTime } from '../lib/format.js';
import { i18n } from '../i18n.js';

const props = defineProps({
  url: { type: String, default: '' },
  duration: { type: Number, default: 0 },
  markers: { type: Array, default: () => [] },
  range: { type: Object, required: true },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['update:range', 'loaded', 'failed']);

const t = (key, params) => i18n.t(key, params);

const videoEl = ref(null);
const trackEl = ref(null);
const currentTime = ref(0);
const playing = ref(false);
const muted = ref(false);
const loopRange = ref(false);
const drag = ref(null);

const MIN_SPAN = 0.05; // 选区最小长度（秒）

const activeStart = computed(() => (props.range.enabled ? props.range.start : 0));
const activeEnd = computed(() => (props.range.enabled ? props.range.end : props.duration));
const span = computed(() => Math.max(0, activeEnd.value - activeStart.value));
const currentLabel = computed(() => formatTime(currentTime.value));
const durationLabel = computed(() => formatTime(props.duration, { ms: false }));

// 面板起终点输入框用受控文本：解析失败时回退显示当前值
const startText = ref('');
const endText = ref('');
watch(activeStart, (value) => {
  startText.value = formatTime(value);
}, { immediate: true });
watch(activeEnd, (value) => {
  endText.value = formatTime(value);
}, { immediate: true });

function pct(value) {
  if (!props.duration) return 0;
  return Math.min(100, Math.max(0, (value / props.duration) * 100));
}

const rangeStyle = computed(() => ({
  left: `${pct(activeStart.value)}%`,
  width: `${Math.max(0, pct(activeEnd.value) - pct(activeStart.value))}%`,
}));

// 关键帧标记太多时不渲染，避免 DOM 压力
const visibleMarkers = computed(() => {
  if (!props.duration || !props.markers.length) return [];
  if (props.markers.length > 800) {
    const step = Math.ceil(props.markers.length / 800);
    return props.markers.filter((_, i) => i % step === 0);
  }
  return props.markers;
});

defineExpose({
  get video() {
    return videoEl.value;
  },
});

/* ---------------- 播放控制 ---------------- */

function togglePlay() {
  const video = videoEl.value;
  if (!video) return;
  if (video.paused) video.play().catch(() => {});
  else video.pause();
}

function step(direction) {
  const video = videoEl.value;
  if (!video || !props.duration) return;
  const delta = 1 / 30; // 浏览器拿不到 fps 时，按 30fps 近似
  video.currentTime = Math.min(props.duration, Math.max(0, video.currentTime + direction * delta));
}

function toggleMute() {
  const video = videoEl.value;
  if (!video) return;
  video.muted = !video.muted;
  muted.value = video.muted;
}

function onTimeUpdate() {
  const video = videoEl.value;
  if (!video) return;
  currentTime.value = video.currentTime;
  if (loopRange.value && props.range.enabled && video.currentTime >= props.range.end - 0.02) {
    video.currentTime = props.range.start;
  }
}

function onLoadedMetadata() {
  const video = videoEl.value;
  if (!video) return;
  let duration = video.duration;
  if (!Number.isFinite(duration) && video.seekable?.length) duration = video.seekable.end(0);
  emit('loaded', {
    duration: Number.isFinite(duration) ? duration : 0,
    width: video.videoWidth,
    height: video.videoHeight,
  });
}

/* ---------------- 选区交互 ---------------- */

function timeFromClientX(clientX) {
  const track = trackEl.value;
  if (!track || !props.duration) return 0;
  const rect = track.getBoundingClientRect();
  const ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
  return Math.min(props.duration, Math.max(0, ratio * props.duration));
}

function emitRange(start, end) {
  const clampedStart = Math.max(0, Math.min(start, props.duration - MIN_SPAN));
  const clampedEnd = Math.min(props.duration, Math.max(end, clampedStart + MIN_SPAN));
  emit('update:range', { enabled: true, start: clampedStart, end: clampedEnd });
}

function beginDrag(type, event) {
  if (props.busy || !props.duration) return;
  // 用 closest 找带 data-role 的祖先：选区里的文字标签也要能整体拖动
  const roleEl = event.target?.closest?.('[data-role]');
  const role = type || roleEl?.dataset?.role;
  const time = timeFromClientX(event.clientX);

  if (!role) {
    // 点击轨道空白处：跳转并允许继续拖动 scrub
    seekTo(time);
    drag.value = { type: 'seek', grab: time, start: activeStart.value, end: activeEnd.value };
    capturePointer(event.pointerId);
    event.preventDefault();
    return;
  }

  drag.value = { type: role, grab: time, start: activeStart.value, end: activeEnd.value };
  capturePointer(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function capturePointer(pointerId) {
  try {
    trackEl.value?.setPointerCapture?.(pointerId);
  } catch {
    // 合成事件或指针已释放时 setPointerCapture 会抛错，忽略即可
  }
}

function onPointerMove(event) {
  const state = drag.value;
  if (!state) return;
  const time = timeFromClientX(event.clientX);

  if (state.type === 'seek') {
    seekTo(time);
    return;
  }
  if (state.type === 'handle-start') {
    emitRange(Math.min(time, state.end - MIN_SPAN), state.end);
    return;
  }
  if (state.type === 'handle-end') {
    emitRange(state.start, Math.max(time, state.start + MIN_SPAN));
    return;
  }
  if (state.type === 'range-body') {
    const length = state.end - state.start;
    let start = state.start + (time - state.grab);
    start = Math.max(0, Math.min(start, props.duration - length));
    emitRange(start, start + length);
  }
}

function onPointerUp(event) {
  if (!drag.value) return;
  drag.value = null;
  try {
    trackEl.value?.releasePointerCapture?.(event.pointerId);
  } catch {
    /* 指针已释放 */
  }
}

function seekTo(time) {
  const video = videoEl.value;
  if (!video || !props.duration) return;
  video.currentTime = Math.min(props.duration, Math.max(0, time));
  currentTime.value = video.currentTime;
}

function onHandleKey(event, which) {
  const stepSize = event.shiftKey ? 1 : 0.1;
  let delta = 0;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -stepSize;
  else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = stepSize;
  else return;
  event.preventDefault();
  if (which === 'start') emitRange(activeStart.value + delta, activeEnd.value);
  else emitRange(activeStart.value, activeEnd.value + delta);
}

/* ---------------- 面板上的按钮与输入框 ---------------- */

/**
 * 「当前帧设为起点」：起点 = 当前帧，终点保持不变。
 * 只有当前帧已经越过终点时，才把终点往后让出最小间隔，保证区间始终有效。
 */
function setStartHere() {
  const time = videoEl.value?.currentTime ?? 0;
  const end = Math.max(activeEnd.value, Math.min(props.duration, time + MIN_SPAN));
  emitRange(time, end);
}

/**
 * 「当前帧设为终点」：终点 = 当前帧，起点保持不变。
 * 之前这里写的是 Math.min(time, activeEnd.value)，取的是旧的终点，
 * 导致点「设为终点」时起点被拉到旧终点上，区间凭空少了一截。
 * 只有当前帧落在起点之前时，才把起点往回让出最小间隔。
 */
function setEndHere() {
  const time = videoEl.value?.currentTime ?? props.duration;
  const start = Math.min(activeStart.value, Math.max(0, time - MIN_SPAN));
  emitRange(start, time);
}

function clearRange() {
  emit('update:range', { enabled: false, start: 0, end: props.duration });
}

function commitStart(value) {
  const parsed = parseTime(value);
  if (parsed === null) {
    startText.value = formatTime(activeStart.value);
    return;
  }
  emitRange(parsed, activeEnd.value);
}

function commitEnd(value) {
  const parsed = parseTime(value);
  if (parsed === null) {
    endText.value = formatTime(activeEnd.value);
    return;
  }
  emitRange(activeStart.value, parsed);
}

watch(
  () => props.url,
  () => {
    currentTime.value = 0;
    playing.value = false;
    drag.value = null;
  },
);
</script>

<template>
  <n-card size="small" class="stage">
    <template #header>
      <n-h2 class="card-title">{{ t('stageTitle') }}</n-h2>
    </template>
    <template #header-extra>
      <n-text depth="3" class="clock">
        <n-text strong depth="1">{{ currentLabel }}</n-text>
        <n-text depth="3" class="clock-sep">/</n-text>
        <n-text depth="3">{{ durationLabel }}</n-text>
      </n-text>
    </template>

    <div class="video-wrap">
      <video
        ref="videoEl"
        :src="url"
        playsinline
        preload="metadata"
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @seeked="onTimeUpdate"
        @play="playing = true"
        @pause="playing = false"
        @ended="playing = false"
        @error="emit('failed')"
      ></video>
    </div>

    <n-space class="transport" align="center" :size="8" :wrap="true">
      <n-button secondary circle size="small" :title="playing ? t('pauseLabel') : t('playLabel')" @click="togglePlay">
        <n-icon :size="18">
          <PauseOutline v-if="playing" />
          <PlayOutline v-else />
        </n-icon>
      </n-button>
      <n-button secondary circle size="small" :title="t('stepBackLabel')" @click="step(-1)">
        <n-icon :size="18"><PlayBackOutline /></n-icon>
      </n-button>
      <n-button secondary circle size="small" :title="t('stepForwardLabel')" @click="step(1)">
        <n-icon :size="18"><PlayForwardOutline /></n-icon>
      </n-button>
      <n-button secondary circle size="small" :title="muted ? t('unmuteLabel') : t('muteLabel')" @click="toggleMute">
        <n-icon :size="18">
          <VolumeMuteOutline v-if="muted" />
          <VolumeHighOutline v-else />
        </n-icon>
      </n-button>
      <n-space align="center" :size="6" class="loop-toggle">
        <n-switch v-model:value="loopRange" size="small" />
        <n-text depth="2">{{ t('loopRangeLabel') }}</n-text>
      </n-space>
      <n-tag v-if="markers.length" size="small" round type="info" :bordered="false" class="marker-note">
        {{ t('keyframeCount', { n: markers.length }) }}
      </n-tag>
    </n-space>

    <div
      ref="trackEl"
      class="timeline"
      :class="{ 'is-busy': busy }"
      @pointerdown="beginDrag('', $event)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="tl-track">
        <div class="tl-progress" :style="{ width: `${pct(currentTime)}%` }"></div>
        <div class="tl-markers">
          <i v-for="(marker, index) in visibleMarkers" :key="index" :style="{ left: `${pct(marker)}%` }"></i>
        </div>
        <div class="tl-range" :class="{ 'is-off': !range.enabled }" data-role="range-body" :style="rangeStyle">
          <n-tag size="small" :bordered="false" class="tl-range-label">{{ formatTime(span) }}</n-tag>
        </div>
        <div
          class="tl-handle tl-handle-start"
          data-role="handle-start"
          :style="{ left: `${pct(activeStart)}%` }"
          tabindex="0"
          role="slider"
          :aria-label="t('rangeStartLabel')"
          :aria-valuenow="activeStart"
          :aria-valuemin="0"
          :aria-valuemax="duration"
          @keydown="onHandleKey($event, 'start')"
        ></div>
        <div
          class="tl-handle tl-handle-end"
          data-role="handle-end"
          :style="{ left: `${pct(activeEnd)}%` }"
          tabindex="0"
          role="slider"
          :aria-label="t('rangeEndLabel')"
          :aria-valuenow="activeEnd"
          :aria-valuemin="0"
          :aria-valuemax="duration"
          @keydown="onHandleKey($event, 'end')"
        ></div>
      </div>
    </div>

    <n-divider dashed style="margin: 14px 0" />

    <n-space vertical :size="10" class="range-panel">
      <n-space align="center" :size="8" class="range-title">
        <n-badge dot :type="range.enabled ? 'warning' : 'default'" />
        <n-text strong>{{ t('rangeTitle') }}</n-text>
      </n-space>

      <n-form label-placement="top" size="small" :show-feedback="false" class="range-fields">
        <n-form-item :label="t('rangeStartLabel')">
          <n-input v-model:value="startText" size="small" :input-props="{ spellcheck: false }" @change="commitStart" />
        </n-form-item>
        <n-form-item :label="t('rangeEndLabel')">
          <n-input v-model:value="endText" size="small" :input-props="{ spellcheck: false }" @change="commitEnd" />
        </n-form-item>
        <n-form-item :label="t('rangeSpanLabel')">
          <n-text strong class="mono range-span-value">{{ formatTime(span) }}</n-text>
        </n-form-item>
      </n-form>

      <n-space class="range-actions" :size="8" :wrap="true">
        <n-button size="small" :disabled="busy" @click="setStartHere">
          {{ t('setStartBtn') }}
        </n-button>
        <n-button size="small" :disabled="busy" @click="setEndHere">
          {{ t('setEndBtn') }}
        </n-button>
        <n-button size="small" secondary :disabled="busy || !range.enabled" @click="clearRange">
          {{ t('clearRangeBtn') }}
        </n-button>
      </n-space>

      <n-text depth="3" class="range-hint">{{ t('rangeHint') }}</n-text>
      <n-text depth="3" class="range-state">
        {{ range.enabled ? t('rangeOn', { start: formatTime(activeStart), end: formatTime(activeEnd), span: formatTime(span) }) : t('rangeFull') }}
      </n-text>
    </n-space>
  </n-card>
</template>
