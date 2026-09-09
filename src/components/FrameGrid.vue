<script setup>
// FrameGrid.vue — 候选帧网格 + 批量操作（Naive UI 工具栏）

import { computed } from 'vue';
import { NCard, NButton, NSpace, NText, NTag, NEmpty, NH2, NDivider, NIcon } from 'naive-ui';
import { TrashOutline } from '@vicons/ionicons5';
import { i18n } from '../i18n.js';
import { formatBytes } from '../lib/format.js';
import FrameCard from './FrameCard.vue';

const props = defineProps({
  frames: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  packing: { type: Object, default: () => ({ active: false, done: 0, total: 0 }) },
});

const emit = defineEmits([
  'toggle',
  'select-all',
  'invert',
  'deselect-all',
  'download-zip',
  'download-selected',
  'clear',
  'save',
  'remove',
  'seek',
]);

const t = (key, params) => i18n.t(key, params);

const selected = computed(() => props.frames.filter((frame) => frame.selected));
const totalSize = computed(() => props.frames.reduce((sum, frame) => sum + (frame.size || 0), 0));
const selectedSize = computed(() => selected.value.reduce((sum, frame) => sum + (frame.size || 0), 0));
</script>

<template>
  <n-card size="small" class="results">
    <template #header>
      <n-h2 class="card-title">
        {{ t('resultsTitle') }}
        <n-tag size="small" round :bordered="false">{{ frames.length }}</n-tag>
      </n-h2>
    </template>
    <template #header-extra>
      <n-text depth="3" class="results-size">{{ t('totalSize', { n: frames.length, size: formatBytes(totalSize) }) }}</n-text>
    </template>

    <n-space justify="space-between" :size="12" :wrap="true" class="results-toolbar">
      <n-space align="center" :size="8" :wrap="true">
        <n-button size="small" :disabled="busy || !frames.length" @click="emit('select-all')">
          {{ t('selectAllBtn') }}
        </n-button>
        <n-button size="small" :disabled="busy || !frames.length" @click="emit('invert')">
          {{ t('invertBtn') }}
        </n-button>
        <n-button size="small" :disabled="busy || !frames.length" @click="emit('deselect-all')">
          {{ t('deselectAllBtn') }}
        </n-button>
        <n-text depth="3" class="selected-note">{{ t('selectedCount', { n: selected.length, total: frames.length }) }}</n-text>
        <n-text v-if="selected.length" depth="3" class="selected-note">{{ formatBytes(selectedSize) }}</n-text>
      </n-space>
      <n-space :size="8" :wrap="true">
        <n-button
          size="small"
          type="primary"
          :loading="packing.active"
          :disabled="busy || !selected.length"
          @click="emit('download-zip')"
        >
          {{ packing.active ? t('zipBuilding', { done: packing.done, total: packing.total }) : t('downloadZipBtn', { n: selected.length }) }}
        </n-button>
        <n-button size="small" :disabled="busy || !selected.length" @click="emit('download-selected')">
          {{ t('downloadSelectedBtn') }}
        </n-button>
        <n-button size="small" type="error" secondary :disabled="busy" @click="emit('clear')">
          <template #icon>
            <n-icon :size="14"><TrashOutline /></n-icon>
          </template>
          {{ t('clearResultsBtn') }}
        </n-button>
      </n-space>
    </n-space>

    <n-divider dashed style="margin: 14px 0 16px" />

    <div v-if="frames.length" class="frame-grid">
      <FrameCard
        v-for="frame in frames"
        :key="frame.id"
        :frame="frame"
        :busy="busy"
        @toggle="emit('toggle', $event)"
        @save="emit('save', $event)"
        @remove="emit('remove', $event)"
        @seek="emit('seek', $event)"
      />
    </div>
    <n-empty v-else :description="t('resultsEmpty')" class="results-empty" />
  </n-card>
</template>
