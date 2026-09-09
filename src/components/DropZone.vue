<script setup>
// DropZone.vue — 视频文件选择 / 拖放（Naive UI n-upload 拖拽区）

import { ref } from 'vue';
import { NUpload, NUploadDragger, NButton, NText, NP, NEllipsis, NCard, NSpace, NIcon } from 'naive-ui';
import { FilmOutline } from '@vicons/ionicons5';
import { i18n } from '../i18n.js';
import { formatBytes, formatDuration } from '../lib/format.js';

const props = defineProps({
  meta: { type: Object, default: null },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['file']);

const t = (key, params) => i18n.t(key, params);
const uploadRef = ref(null);

function openPicker() {
  if (props.busy) return;
  uploadRef.value?.openOpenFileDialog();
}

function onChange({ fileList }) {
  const picked = fileList[fileList.length - 1]?.file;
  if (picked) emit('file', picked);
  // 清空内部列表，允许重复选择同一个文件
  uploadRef.value?.clear();
}
</script>

<template>
  <n-upload
    ref="uploadRef"
    class="dropzone-upload"
    :show-file-list="false"
    :default-upload="false"
    :max="1"
    accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.ogv"
    @change="onChange"
  >
    <n-upload-dragger v-if="!meta" class="dropzone-dragger">
      <n-icon :size="46" class="drop-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <rect x="8" y="14" width="48" height="36" rx="6" fill="none" stroke="currentColor" stroke-width="3" />
          <path d="M8 26h48M8 38h48M22 14v36M42 14v36" stroke="currentColor" stroke-width="3" />
        </svg>
      </n-icon>
      <n-p class="drop-title">{{ t('dropTitle') }}</n-p>
      <n-p class="drop-hint">{{ t('dropHint') }}</n-p>
      <n-space justify="center" class="drop-btn-row" @click.stop>
        <n-button type="primary" size="small" :disabled="busy" @click="openPicker">
          {{ t('chooseBtn') }}
        </n-button>
      </n-space>
      <n-p class="drop-privacy">{{ t('dropPrivacy') }}</n-p>
    </n-upload-dragger>

    <n-card v-else size="small" @click.stop>
      <n-space align="center" justify="space-between" :size="14" :wrap="true">
        <n-space align="center" :size="14" :wrap="true">
          <n-icon :size="26" class="file-icon" aria-hidden="true"><FilmOutline /></n-icon>
          <n-space vertical :size="2" class="file-info">
            <n-ellipsis class="file-name" :tooltip="true">{{ meta.name }}</n-ellipsis>
            <n-text depth="3" class="file-meta">
              {{ t('fileMeta', {
                duration: meta.duration > 0 ? formatDuration(meta.duration) : '--:--',
                size: formatBytes(meta.size),
                w: meta.width || '—',
                h: meta.height || '—',
              }) }}
            </n-text>
          </n-space>
        </n-space>
        <n-button size="small" :disabled="busy" @click="openPicker">{{ t('changeBtn') }}</n-button>
      </n-space>
    </n-card>
  </n-upload>
</template>
