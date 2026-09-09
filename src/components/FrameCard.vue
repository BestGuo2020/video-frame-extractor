<script setup>
// FrameCard.vue — 单张候选帧（n-card cover/action 插槽 + Naive 控件）

import { computed } from 'vue';
import { NCheckbox, NButton, NText, NTag, NSpace, NCard, NImage, NIcon } from 'naive-ui';
import { TimeOutline, SaveOutline, TrashOutline } from '@vicons/ionicons5';
import { i18n } from '../i18n.js';
import { formatBytes, formatTime } from '../lib/format.js';

const props = defineProps({
  frame: { type: Object, required: true },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['toggle', 'save', 'remove', 'seek']);

const t = (key, params) => i18n.t(key, params);
const meta = computed(() =>
  t('resultMeta', { w: props.frame.width, h: props.frame.height, format: props.frame.format.toUpperCase() }),
);
</script>

<template>
  <n-card size="small" class="frame-card" :class="{ 'is-off': !frame.selected }">
    <template #cover>
      <div class="frame-thumb" @click="emit('seek', frame.time)">
        <n-image
          :src="frame.url"
          :alt="formatTime(frame.time)"
          lazy
          object-fit="contain"
          :preview-disabled="true"
        />
        <n-checkbox
          class="frame-check"
          :checked="frame.selected"
          @click.stop
          @update:checked="emit('toggle', frame)"
        />
        <n-tag class="frame-time" size="small">{{ formatTime(frame.time) }}</n-tag>
        <n-button
          class="frame-play"
          secondary
          circle
          size="small"
          :title="t('gotoBtn')"
          @click.stop="emit('seek', frame.time)"
        >
          <n-icon :size="14"><TimeOutline /></n-icon>
        </n-button>
      </div>
    </template>

    <n-space justify="space-between" :size="8" :wrap="false">
      <n-text depth="3" class="frame-sub">{{ meta }}</n-text>
      <n-text depth="3" class="frame-sub">{{ formatBytes(frame.size) }}</n-text>
    </n-space>

    <template #action>
      <n-space :size="6" :wrap="false">
        <n-button size="tiny" type="primary" secondary :disabled="busy" @click="emit('save', frame)">
          <template #icon>
            <n-icon :size="12"><SaveOutline /></n-icon>
          </template>
          {{ t('saveBtn') }}
        </n-button>
        <n-button size="tiny" type="error" secondary :disabled="busy" @click="emit('remove', frame)">
          <template #icon>
            <n-icon :size="12"><TrashOutline /></n-icon>
          </template>
          {{ t('removeBtn') }}
        </n-button>
      </n-space>
    </template>
  </n-card>
</template>
