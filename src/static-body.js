// src/static-body.js — 构建期为 <div id="app"> 生成静态回退正文
//
// 为什么需要它：index.html 的 #app 是空的，正文全部由 Vue 挂载后渲染，不执行 JS 的爬虫
// （GPTBot / PerplexityBot / ClaudeBot / CCBot…）抓到的页面只有 meta。这里用与真实页面
// 相同的结构 + 同一份 i18n 文案（src/i18n.js 的 messages）拼出静态正文，让爬虫直接读到内容。
//
// 两点约定：
//   1. 文案只从传入的 messages 取，本文件不存任何翻译；结构（标签怎么套）才写死在这里。
//   2. 类名沿用 App.vue / GuideSection.vue 里的那一套（.page / .hero / .guide-grid …，
//      以及 Naive UI 的 .n-h1 / .n-h2 / .n-p），这样「挂载前的首屏」与「挂载后的页面」
//      长得一样，不必为回退内容再写一套 CSS；但绝不能借用 .dropzone / .stage 这类
//      交互区的类名——端到端驱动页（test/driver.html）会按这些类名找真实控件。
//   3. 生成的标记里只允许出现 ASCII：语言页要能通过「#app 里不含中文字符」的验收断言，
//      所以这里连注释都用 <!-- static-body:start --> 这种无语种写法的锚点。
//
// 这个文件只被 scripts/prerender.mjs import，src/main.js 不引用它，因此不会进浏览器 bundle。

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// GuideSection.vue 的 STEPS / FAQ 列表在这里以数据形式复刻：改结构时两处一起看
const STEP_KEYS = [
  ['step1Title', 'step1Desc'],
  ['step2Title', 'step2Desc'],
  ['step3Title', 'step3Desc'],
];

const MODE_KEYS = [
  ['modeCount', 'modeCountDesc'],
  ['modeInterval', 'modeIntervalDesc'],
  ['modeKeyframe', 'modeKeyframeDesc'],
  ['modeTimestamps', 'modeTimestampsDesc'],
  ['modeRange', 'modeRangeDesc'],
];

const TIP_KEYS = ['tipCount', 'tipInterval', 'tipKeyframe', 'tipTimestamp'];

// 同时被 scripts/prerender.mjs 用来生成 FAQPage 结构化数据：
// 页面上的 FAQ 与 JSON-LD 里的问答必须一一对应，否则结构化数据会被判为与页面不符
export const FAQ_KEYS = [
  ['faq1q', 'faq1a'],
  ['faq2q', 'faq2a'],
  ['faq3q', 'faq3a'],
  ['faq4q', 'faq4a'],
  ['faq5q', 'faq5a'],
  ['faq6q', 'faq6a'],
  ['faq7q', 'faq7a'],
];

/**
 * 生成 #app 的静态回退正文。
 *
 * @param {string} lang     语言代码（zh/en/ja/ko）——写进 data-lang，方便抽查时一眼看出
 *                          这份回退正文是按哪种语言生成的
 * @param {object} messages 该语言的文案（src/i18n.js 的 messages[lang]）
 * @returns {string} HTML 片段（不含最外层 <div id="app">，由 prerender 填进去）
 */
export function renderStaticBody(lang, messages) {
  const t = (key) => esc(messages[key] ?? key);
  const lines = [];
  const pad = '      '; // 与 index.html 里 #app 的缩进对齐

  lines.push(`${pad}<!-- static-body:start -->`);
  lines.push(`${pad}<div class="page" data-lang="${esc(lang)}">`);
  lines.push(`${pad}  <header class="topbar">`);
  lines.push(`${pad}    <div>`);
  lines.push(`${pad}      <strong class="brand-name">${t('appName')}</strong>`);
  lines.push(`${pad}      <span class="brand-tag">${t('appTagline')}</span>`);
  lines.push(`${pad}    </div>`);
  lines.push(`${pad}  </header>`);
  lines.push(`${pad}  <main>`);

  // Hero：H1 + 副标题，页面最强的语义信号
  lines.push(`${pad}    <section class="hero">`);
  lines.push(`${pad}      <h1 class="n-h1">${t('heroTitle')}</h1>`);
  lines.push(`${pad}      <p class="n-p">${t('heroSub')}</p>`);
  lines.push(`${pad}    </section>`);

  // 使用步骤 + 载入说明 + 隐私说明（对应 DropZone 与 GuideSection 的正文）
  lines.push(`${pad}    <section class="guide">`);
  lines.push(`${pad}      <h2 class="n-h2">${t('guideTitle')}</h2>`);
  lines.push(`${pad}      <p class="section-lead">${t('dropTitle')}</p>`);
  lines.push(`${pad}      <p class="section-lead">${t('dropHint')}</p>`);
  lines.push(`${pad}      <div class="guide-grid">`);
  for (const [titleKey, descKey] of STEP_KEYS) {
    lines.push(`${pad}        <div class="guide-card">`);
    lines.push(`${pad}          <h3 class="n-h3">${t(titleKey)}</h3>`);
    lines.push(`${pad}          <p class="n-p">${t(descKey)}</p>`);
    lines.push(`${pad}        </div>`);
  }
  lines.push(`${pad}      </div>`);

  // 五种抽帧模式
  lines.push(`${pad}      <h2 class="n-h2 section-gap">${t('modesTitle')}</h2>`);
  lines.push(`${pad}      <p class="section-lead">${t('modesIntro')}</p>`);
  lines.push(`${pad}      <div class="tip-card">`);
  lines.push(`${pad}        <ul class="tip-list">`);
  for (const [nameKey, descKey] of MODE_KEYS) {
    lines.push(`${pad}          <li><strong>${t(nameKey)}</strong> — ${t(descKey)}</li>`);
  }
  lines.push(`${pad}        </ul>`);
  lines.push(`${pad}      </div>`);

  // 模式选择建议 + 两条提示（对应 GuideSection 的 tip-card 与两个 n-alert）
  lines.push(`${pad}      <div class="tip-card">`);
  lines.push(`${pad}        <ul class="tip-list">`);
  for (const tipKey of TIP_KEYS) {
    lines.push(`${pad}          <li>${t(tipKey)}</li>`);
  }
  lines.push(`${pad}        </ul>`);
  lines.push(`${pad}      </div>`);
  lines.push(`${pad}      <div class="info">`);
  lines.push(`${pad}        <div>`);
  lines.push(`${pad}          <h3 class="n-h3">${t('rangeTipTitle')}</h3>`);
  lines.push(`${pad}          <p class="n-p">${t('rangeTipDesc')}</p>`);
  lines.push(`${pad}        </div>`);
  lines.push(`${pad}        <div>`);
  lines.push(`${pad}          <h3 class="n-h3">${t('qualityTipTitle')}</h3>`);
  lines.push(`${pad}          <p class="n-p">${t('qualityTipDesc')}</p>`);
  lines.push(`${pad}        </div>`);
  lines.push(`${pad}      </div>`);
  lines.push(`${pad}      <p class="section-lead">${t('dropPrivacy')}</p>`);

  // FAQ：用原生 <details> 折叠，爬虫能读到答案文本（只读 summary 会丢掉正文）
  lines.push(`${pad}      <h2 class="n-h2 section-gap">${t('faqTitle')}</h2>`);
  lines.push(`${pad}      <div class="faq">`);
  for (const [qKey, aKey] of FAQ_KEYS) {
    lines.push(`${pad}        <details>`);
    lines.push(`${pad}          <summary>${t(qKey)}</summary>`);
    lines.push(`${pad}          <p class="n-p">${t(aKey)}</p>`);
    lines.push(`${pad}        </details>`);
  }
  lines.push(`${pad}      </div>`);
  lines.push(`${pad}    </section>`);
  lines.push(`${pad}  </main>`);
  lines.push(`${pad}  <footer class="footer">`);
  lines.push(`${pad}    <p class="n-p">${t('footerNote')}</p>`);
  lines.push(`${pad}  </footer>`);
  lines.push(`${pad}</div>`);

  return lines.join('\n');
}
