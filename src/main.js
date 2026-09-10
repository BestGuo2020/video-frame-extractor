import { createApp } from 'vue';
import App from './App.vue';
import { i18n, pathToLang } from './i18n.js';
import './style.css';

// 与 URL 上的 /zh /en /ja /ko 路径保持一致：/en /ja /ko 是构建期预渲染出来的静态页
// （scripts/prerender.mjs），每份 HTML 自带的静态正文与 head 已经是该语言，
// 这里只负责把 Vue 的语言状态跟路径对齐（例如用户直接把链接发给别人）。
const segment = '/' + (window.location.pathname.split('/')[1] || '');
const fromPath = pathToLang[segment];
if (fromPath) {
  i18n.lang = fromPath;
}
document.documentElement.lang = { zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko' }[i18n.lang];

createApp(App).mount('#app');
