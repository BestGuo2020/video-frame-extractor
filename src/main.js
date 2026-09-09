import { createApp } from 'vue';
import App from './App.vue';
import { i18n, pathToLang } from './i18n.js';
import './style.css';

// 与 URL 上的 /zh /en /ja /ko 路径保持一致（Cloudflare Pages 用 _redirects 回落，
// _worker.js 按路径重写 <html lang> 与 SEO meta，路径本身可读）
const segment = '/' + (window.location.pathname.split('/')[1] || '');
const fromPath = pathToLang[segment];
if (fromPath) {
  i18n.lang = fromPath;
}
document.documentElement.lang = { zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko' }[i18n.lang];

createApp(App).mount('#app');
