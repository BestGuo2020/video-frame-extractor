<script setup>
// SettingsPanel.vue — 提取模式与输出参数（全部使用 Naive UI 表单组件）
// 各参数用 defineModel 双向绑定，父组件只负责执行提取。

import { computed } from 'vue';
import {
  NCard,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadio,
  NRadioButton,
  NInputNumber,
  NInput,
  NSelect,
  NSlider,
  NButton,
  NButtonGroup,
  NDivider,
  NTag,
  NText,
  NSpace,
  NH2,
  NDescriptions,
  NDescriptionsItem,
} from 'naive-ui';
import { i18n } from '../i18n.js';
import { formatTime } from '../lib/format.js';
import { DEFAULT_MAX_FRAMES } from '../lib/plan.js';

const t = (key, params) => i18n.t(key, params);

const mode = defineModel('mode', { type: String, default: 'count' });
const count = defineModel('count', { type: Number, default: 10 });
const interval = defineModel('interval', { type: Number, default: 1 });
const timestampsText = defineModel('timestampsText', { type: String, default: '' });
const format = defineModel('format', { type: String, default: 'png' });
const quality = defineModel('quality', { type: Number, default: 0.92 });
const resolution = defineModel('resolution', { type: String, default: 'original' });
const sensitivity = defineModel('sensitivity', { type: String, default: 'medium' });
const density = defineModel('density', { type: String, default: 'medium' });
const namePrefix = defineModel('namePrefix', { type: String, default: '' });

const props = defineProps({
  scope: { type: Object, required: true },
  estimate: { type: Number, default: 0 },
  keyframeState: { type: Object, default: () => ({ status: 'idle', source: '', count: 0 }) },
  busy: { type: Boolean, default: false },
  canExtract: { type: Boolean, default: false },
});

const emit = defineEmits(['extract', 'cancel', 'detect-keyframes']);

const MODES = [
  { value: 'count', label: 'modeCount', desc: 'modeCountDesc' },
  { value: 'interval', label: 'modeInterval', desc: 'modeIntervalDesc' },
  { value: 'keyframe', label: 'modeKeyframe', desc: 'modeKeyframeDesc' },
  { value: 'timestamps', label: 'modeTimestamps', desc: 'modeTimestampsDesc' },
  { value: 'range', label: 'modeRange', desc: 'modeRangeDesc' },
];

const RESOLUTION_OPTIONS = computed(() => [
  { label: t('resOriginal'), value: 'original' },
  { label: '4K', value: '4k' },
  { label: '2K', value: '2k' },
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
  { label: '480p', value: '480p' },
]);

const SENSITIVITY_OPTIONS = computed(() => [
  { label: t('sensLow'), value: 'low' },
  { label: t('sensMedium'), value: 'medium' },
  { label: t('sensHigh'), value: 'high' },
]);

const DENSITY_OPTIONS = computed(() => [
  { label: t('densityLow'), value: 'low' },
  { label: t('densityMedium'), value: 'medium' },
  { label: t('densityHigh'), value: 'high' },
]);

const COUNT_PRESETS = [5, 10, 20, 50];

const needsCount = computed(() => mode.value === 'count' || mode.value === 'range');
const isKeyframeMode = computed(() => mode.value === 'keyframe');
const detecting = computed(() => props.keyframeState.status === 'detecting');
const qualityPercent = computed({
  get: () => Math.round(quality.value * 100),
  set: (value) => {
    quality.value = value / 100;
  },
});

const scopeText = computed(() => {
  if (!props.scope.enabled) return t('rangeFull');
  return t('rangeOn', {
    start: formatTime(props.scope.start),
    end: formatTime(props.scope.end),
    span: formatTime(props.scope.end - props.scope.start),
  });
});

function pickCount(value) {
  count.value = value;
}
</script>

<template>
  <n-card size="small" class="settings">
    <template #header>
      <n-h2 class="card-title">{{ t('settingsTitle') }}</n-h2>
    </template>
    <template #header-extra>
      <n-tag :type="scope.enabled ? 'warning' : 'default'" size="small" round :bordered="false">
        {{ scope.enabled ? `${formatTime(scope.start)} → ${formatTime(scope.end)}` : t('scopeFullShort') }}
      </n-tag>
    </template>

    <n-form label-placement="top" size="small" :show-feedback="false" class="settings-form">
      <n-form-item :label="t('modeLabel')">
        <n-radio-group v-model:value="mode" class="mode-grid" name="extract-mode">
          <n-radio v-for="item in MODES" :key="item.value" :value="item.value">
            <n-text strong class="mode-name">
              {{ t(item.label) }}
              <n-tag v-if="item.value === 'range'" size="small" type="warning" round :bordered="false">NEW</n-tag>
            </n-text>
            <n-text depth="3" class="mode-desc">{{ t(item.desc) }}</n-text>
          </n-radio>
        </n-radio-group>
      </n-form-item>

      <!-- 帧数 -->
      <n-form-item v-if="needsCount" :label="t('countLabel')">
        <n-space align="center" :size="8" :wrap="true">
          <n-button-group size="small">
            <n-button
              v-for="preset in COUNT_PRESETS"
              :key="preset"
              :type="Number(count) === preset ? 'primary' : 'default'"
              :ghost="Number(count) !== preset"
              @click="pickCount(preset)"
            >
              {{ preset }}
            </n-button>
          </n-button-group>
          <n-input-number v-model:value="count" size="small" :min="1" :max="2000" :step="1" class="num-control" />
        </n-space>
      </n-form-item>

      <!-- 间隔 -->
      <n-form-item v-if="mode === 'interval'" :label="t('intervalLabel')">
        <n-input-number v-model:value="interval" size="small" :min="0.02" :max="3600" :step="0.1" class="num-control wide" />
      </n-form-item>

      <!-- 时间点 -->
      <n-form-item v-if="mode === 'timestamps'" :label="t('timestampsLabel')">
        <n-space vertical :size="6" class="stack">
          <n-input
            v-model:value="timestampsText"
            type="textarea"
            :rows="4"
            :placeholder="t('timestampsPlaceholder')"
            :input-props="{ spellcheck: false }"
          />
          <n-text depth="3" class="field-hint">{{ t('timestampsHint') }}</n-text>
        </n-space>
      </n-form-item>

      <!-- 关键帧 -->
      <n-form-item v-if="isKeyframeMode">
        <n-space vertical :size="8" class="stack">
          <n-space justify="space-between" :wrap="true" class="full">
            <n-button size="small" secondary :loading="detecting" :disabled="busy" @click="emit('detect-keyframes')">
              {{ detecting ? t('keyframeDetecting') : t('keyframeBtn') }}
            </n-button>
            <n-tag v-if="keyframeState.status === 'ready'" type="success" size="small" round :bordered="false">
              {{ t('keyframeReady') }} · {{ keyframeState.count }}
            </n-tag>
          </n-space>
          <n-space :size="10" :wrap="true">
            <n-space :size="6" align="center" :wrap="false">
              <n-text depth="3">{{ t('sensitivityLabel') }}</n-text>
              <n-select v-model:value="sensitivity" size="small" :options="SENSITIVITY_OPTIONS" :consistent-menu-width="false" />
            </n-space>
            <n-space :size="6" align="center" :wrap="false">
              <n-text depth="3">{{ t('densityLabel') }}</n-text>
              <n-select v-model:value="density" size="small" :options="DENSITY_OPTIONS" :consistent-menu-width="false" />
            </n-space>
          </n-space>
        </n-space>
      </n-form-item>

      <n-divider />

      <!-- 输出格式 -->
      <n-form-item :label="t('formatLabel')">
        <n-radio-group v-model:value="format" size="small">
          <n-radio-button value="png">{{ t('formatPng') }}</n-radio-button>
          <n-radio-button value="jpg">{{ t('formatJpg') }}</n-radio-button>
        </n-radio-group>
      </n-form-item>

      <!-- JPG 质量 -->
      <n-form-item v-if="format === 'jpg'">
        <template #label>
          <n-space :size="6" align="center" :wrap="false">
            <n-text>{{ t('qualityLabel') }}</n-text>
            <n-text class="mono">{{ qualityPercent }}%</n-text>
          </n-space>
        </template>
        <n-slider v-model:value="qualityPercent" :min="50" :max="100" :step="1" :format-tooltip="(value) => `${value}%`" />
      </n-form-item>

      <!-- 分辨率 -->
      <n-form-item :label="t('resolutionLabel')">
        <n-space vertical :size="6" class="stack">
          <n-select v-model:value="resolution" size="small" :options="RESOLUTION_OPTIONS" />
          <n-text depth="3" class="field-hint">{{ t('resolutionHint') }}</n-text>
        </n-space>
      </n-form-item>

      <!-- 文件名前缀 -->
      <n-form-item :label="t('namePrefixLabel')">
        <n-input v-model:value="namePrefix" size="small" :placeholder="t('namePrefixPlaceholder')" :input-props="{ spellcheck: false }" />
      </n-form-item>
    </n-form>

    <n-descriptions label-placement="left" :column="1" size="small" bordered class="scope-box">
      <n-descriptions-item :label="t('scopeLabel')">
        <n-text class="mono">{{ scopeText }}</n-text>
      </n-descriptions-item>
      <n-descriptions-item :label="t('estimateLabel', { n: estimate })">
        <n-text depth="3">{{ t('maxFramesHint', { n: DEFAULT_MAX_FRAMES }) }}</n-text>
      </n-descriptions-item>
    </n-descriptions>

    <n-space :size="10" :wrap="false" class="panel-actions full">
      <n-button v-if="!busy" type="primary" block :disabled="!canExtract" @click="emit('extract')">
        {{ t('extractBtn') }}
      </n-button>
      <n-button v-else type="error" block @click="emit('cancel')">{{ t('cancelBtn') }}</n-button>
    </n-space>
  </n-card>
</template>
