<script setup>
// GuideSection.vue — 使用步骤 / 模式选择 / 时间段说明 / 常见问题（Naive UI 排版）
// 这部分同时是页面的 SEO 正文，内容与 index.html 里的 FAQ 结构化数据对应。

import { NCard, NUl, NLi, NText, NCollapse, NCollapseItem, NH2, NH3, NP, NAvatar, NAlert } from 'naive-ui';
import { i18n } from '../i18n.js';

const t = (key, params) => i18n.t(key, params);

// Naive UI 默认主色（步骤序号头像）
const NAIVE_PRIMARY = '#18a058';

const STEPS = [
  { title: 'step1Title', desc: 'step1Desc' },
  { title: 'step2Title', desc: 'step2Desc' },
  { title: 'step3Title', desc: 'step3Desc' },
];

const TIPS = ['tipCount', 'tipInterval', 'tipKeyframe', 'tipTimestamp'];

const FAQ = [
  { q: 'faq1q', a: 'faq1a' },
  { q: 'faq2q', a: 'faq2a' },
  { q: 'faq3q', a: 'faq3a' },
  { q: 'faq4q', a: 'faq4a' },
  { q: 'faq5q', a: 'faq5a' },
  { q: 'faq6q', a: 'faq6a' },
  { q: 'faq7q', a: 'faq7a' },
  // 第 8 条是隐私说明（数据收集边界、统计是否用 Cookie、广告可能带来的 Cookie）。
  // 它与 src/static-body.js 的 FAQ_KEYS 必须保持一一对应 —— 静态正文、JSON-LD 的 FAQPage
  // 和这个组件共用同一份问答，少一条就会出现「结构化数据与页面不符」。
  { q: 'faq8q', a: 'faq8a' },
];
</script>

<template>
  <section class="guide">
    <n-h2>{{ t('guideTitle') }}</n-h2>
    <div class="guide-grid">
      <n-card v-for="(step, index) in STEPS" :key="step.title" size="small" class="guide-card">
        <n-avatar :size="24" round :color="NAIVE_PRIMARY" class="guide-step">{{ index + 1 }}</n-avatar>
        <n-h3>{{ t(step.title) }}</n-h3>
        <n-text depth="2" tag="p">{{ t(step.desc) }}</n-text>
      </n-card>
    </div>

    <n-h2 class="section-gap">{{ t('modesTitle') }}</n-h2>
    <n-p class="section-lead">{{ t('modesIntro') }}</n-p>
    <n-card size="small" class="tip-card">
      <n-ul class="tip-list">
        <n-li v-for="tip in TIPS" :key="tip">{{ t(tip) }}</n-li>
      </n-ul>
    </n-card>

    <div class="info">
      <n-alert type="warning" :title="t('rangeTipTitle')">
        <n-text depth="2">{{ t('rangeTipDesc') }}</n-text>
      </n-alert>
      <n-alert type="info" :title="t('qualityTipTitle')">
        <n-text depth="2">{{ t('qualityTipDesc') }}</n-text>
      </n-alert>
    </div>

    <n-h2 class="section-gap">{{ t('faqTitle') }}</n-h2>
    <n-collapse class="faq" arrow-placement="right">
      <n-collapse-item v-for="item in FAQ" :key="item.q" :name="item.q" :title="t(item.q)">
        <n-text depth="2">{{ t(item.a) }}</n-text>
      </n-collapse-item>
    </n-collapse>
  </section>
</template>
