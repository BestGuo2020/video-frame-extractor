// scripts/verify-prerender.mjs — 预渲染产物的验收断言（pnpm build 的最后一步）
//
//   node scripts/verify-prerender.mjs
//
// 为什么单独有这么一个脚本：预渲染是「构建期生成一堆 HTML」，最容易出的错是
// 「文件生成了，但改错了地方」（canonical 指到别的语言、/en 里混进中文、hreflang 四份不一致、
// #app 还是空的）。这些错误在浏览器里看不出来，只有断言能拦住，所以让它跟着构建一起跑。
//
// 刻意不复用 scripts/prerender.mjs 的解析器：验证脚本要能独立发现问题，
// 而不是「生成器说自己对就是对」。这里只读文件、只用正则抽查。

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages } from '../src/i18n.js';
import { HREFLANG, OG_IMAGE, SEO_PAGES, SHARED_META, SITE_ORIGIN, outputFileFor, pageUrl } from '../src/seo-pages.js';
import { FAQ_KEYS } from '../src/static-body.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');

// 与 scripts/selftest.mjs 保持同一套输出风格：ok / FAIL + 末尾汇总 + 失败即退出码 1
let passed = 0;
let failed = 0;
let warned = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

function eq(name, actual, expected) {
  check(name, Object.is(actual, expected), `→ got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

function warn(message) {
  warned += 1;
  console.log(`  warn ${message}`);
}

/* ---------------- 只读解析 ---------------- */

// 生成端会把 & < > " 转义成实体（这是正确做法），所以断言要比「渲染后的值」而不是源码文本：
// 例如英文 og:title 里的 & 在文件里是 &amp;，不还原就会被误判成不一致。
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decodeEntities = (text) => String(text ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return match ? decodeEntities(match[1]) : null;
}

// 注释里可能出现标签字面量（模板顶部的说明就写了 <div id="app">、hreflang 等），
// 一律只在「非注释」区域里找标签：把注释换成等长空格，长度不变、偏移仍准。
const maskComments = (html) => html.replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length));

function metaContent(html, key) {
  for (const match of maskComments(html).matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (attr(tag, 'name') === key || attr(tag, 'property') === key) return attr(tag, 'content');
  }
  return null;
}

function canonicalHref(html) {
  for (const match of maskComments(html).matchAll(/<link\b[^>]*>/gi)) {
    if (attr(match[0], 'rel') === 'canonical') return attr(match[0], 'href');
  }
  return null;
}

function hreflangPairs(html) {
  const pairs = [];
  for (const match of maskComments(html).matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (attr(tag, 'rel') === 'alternate' && attr(tag, 'hreflang')) {
      pairs.push({ hreflang: attr(tag, 'hreflang'), href: attr(tag, 'href') });
    }
  }
  return pairs;
}

function titleOf(html) {
  const match = maskComments(html).match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]) : null;
}

function htmlLangOf(html) {
  const match = maskComments(html).match(/<html\b[^>]*>/i);
  return match ? attr(match[0], 'lang') : null;
}

// 逐层数 <div> 配对取出 #app 的内容（正文里嵌套了很多 <div>，不能用第一个 </div> 收尾）
function appInner(html) {
  const openTag = '<div id="app">';
  const masked = maskComments(html);
  const start = masked.indexOf(openTag);
  if (start < 0) return null;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start + openTag.length;
  let depth = 1;
  let match = re.exec(masked);
  while (match) {
    depth += match[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start + openTag.length, match.index);
    match = re.exec(masked);
  }
  return null;
}

function jsonLdOf(html, id) {
  const match = html.match(new RegExp(`<script type="application/ld\\+json" id="${id}">([\\s\\S]*?)</script>`, 'i'));
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined; // 存在但不是合法 JSON
  }
}

const stripTags = (html) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/* ---------------- 语言纯净度：用 i18n 本身推导「不该出现的字符」 ---------------- */

const charSetOf = (messageSet) => new Set(Object.values(messageSet).join('\n'));

// 「只出现在中文文案里的字符」——日文页里出现这些字符，说明混进了中文文案。
// 这样推导（而不是写死几个汉字）的好处：中文文案一改，断言跟着变，不会失效。
const zhCharSet = charSetOf(messages.zh);
const jaCharSet = charSetOf(messages.ja);
const zhOnlyChars = new Set([...zhCharSet].filter((ch) => !jaCharSet.has(ch)));
const CJK = /[\u4e00-\u9fff]/;
const KANA = /[\u3040-\u30ff]/;

/* ---------------- 断言 ---------------- */

console.log('\n[产物文件]');
const pages = Object.entries(SEO_PAGES).map(([pathname, page]) => ({
  pathname,
  page,
  rel: outputFileFor(pathname).replace(/\\/g, '/'),
  abs: path.join(DIST, outputFileFor(pathname)),
}));

for (const item of pages) {
  check(`${item.rel} 存在`, existsSync(item.abs));
  item.html = existsSync(item.abs) ? readFileSync(item.abs, 'utf8') : '';
  item.app = appInner(item.html) || '';
}

const readable = pages.filter((item) => item.html);

console.log('\n[head：lang / title / meta]');
for (const item of readable) {
  const { page, pathname, rel, html } = item;
  eq(`${rel} <html lang>`, htmlLangOf(html), page.htmlLang);
  eq(`${rel} <title>`, titleOf(html), page.title);
  eq(`${rel} description`, metaContent(html, 'description'), page.description);
  eq(`${rel} keywords`, metaContent(html, 'keywords'), page.keywords);
  eq(`${rel} robots`, metaContent(html, 'robots'), SHARED_META.robots);
  eq(`${rel} canonical 指向自身`, canonicalHref(html), pageUrl(pathname));
  eq(`${rel} og:locale`, metaContent(html, 'og:locale'), page.locale);
  eq(`${rel} og:url 指向自身`, metaContent(html, 'og:url'), pageUrl(pathname));
  eq(`${rel} og:site_name`, metaContent(html, 'og:site_name'), page.schema.appName);
  eq(`${rel} og:title`, metaContent(html, 'og:title'), page.ogTitle);
  eq(`${rel} og:description`, metaContent(html, 'og:description'), page.ogDesc);
  eq(`${rel} og:image`, metaContent(html, 'og:image'), OG_IMAGE.url);
  eq(`${rel} og:image:width`, metaContent(html, 'og:image:width'), String(OG_IMAGE.width));
  eq(`${rel} og:image:height`, metaContent(html, 'og:image:height'), String(OG_IMAGE.height));
  eq(`${rel} twitter:title`, metaContent(html, 'twitter:title'), page.twitterTitle || page.ogTitle);
  eq(`${rel} twitter:description`, metaContent(html, 'twitter:description'), page.twitterDesc || page.ogDesc);
  eq(`${rel} twitter:image`, metaContent(html, 'twitter:image'), OG_IMAGE.url);
}

// 语言页的 head 必须和中文模板不一样，否则说明预渲染根本没生效
for (const item of readable.filter((entry) => entry.pathname !== '/')) {
  check(`${item.rel} title 已按语言改写`, titleOf(item.html) !== SEO_PAGES['/'].title);
  check(`${item.rel} canonical 没有跟着根路径`, canonicalHref(item.html) !== pageUrl('/'));
}

console.log('\n[hreflang 五条]');
const expectedHreflang = HREFLANG.map((entry) => ({ hreflang: entry.hreflang, href: pageUrl(entry.path) }));
for (const item of readable) {
  const pairs = hreflangPairs(item.html);
  eq(`${item.rel} hreflang 条数`, pairs.length, HREFLANG.length);
  check(
    `${item.rel} hreflang 内容与配置一致（且四份文件相同）`,
    JSON.stringify(pairs) === JSON.stringify(expectedHreflang),
    `→ got ${JSON.stringify(pairs)}`,
  );
}
check(
  'x-default 指向英文版 /en',
  expectedHreflang.find((entry) => entry.hreflang === 'x-default')?.href === `${SITE_ORIGIN}/en`,
);
check(
  '根路径写法统一带结尾斜杠',
  expectedHreflang.find((entry) => entry.hreflang === 'zh-CN')?.href === `${SITE_ORIGIN}/`,
);

console.log('\n[JSON-LD]');
for (const item of readable) {
  const { page, pathname, rel, html } = item;
  const app = jsonLdOf(html, 'ld-app');
  check(`${rel} ld-app 是合法 JSON`, Boolean(app) && typeof app === 'object');
  if (app) {
    eq(`${rel} ld-app.name`, app.name, page.schema.appName);
    eq(`${rel} ld-app.url 指向自身`, app.url, pageUrl(pathname));
    eq(`${rel} ld-app.description`, app.description, page.schema.appDesc);
    eq(`${rel} ld-app offers.priceCurrency`, app.offers?.priceCurrency, 'USD');
    eq(`${rel} ld-app featureList 条数`, app.featureList?.length, page.schema.featureList.length);
  }

  const faq = jsonLdOf(html, 'ld-faq');
  check(`${rel} ld-faq 是合法 JSON`, Boolean(faq) && typeof faq === 'object');
  if (faq) {
    eq(`${rel} ld-faq 问题数`, faq.mainEntity?.length, FAQ_KEYS.length);
    const mismatched = FAQ_KEYS.filter(([qKey, aKey], index) => {
      const entry = faq.mainEntity?.[index];
      return entry?.name !== messages[page.lang][qKey] || entry?.acceptedAnswer?.text !== messages[page.lang][aKey];
    });
    check(`${rel} ld-faq 问答与本语言 i18n 文案逐条一致`, mismatched.length === 0, `→ 不一致：${mismatched.map(([q]) => q).join(', ')}`);
  }
}

console.log('\n[#app 静态回退正文]');
for (const item of readable) {
  const { page, rel, html, app } = item;
  const messageSet = messages[page.lang];
  const text = stripTags(app);
  check(`${rel} #app 里有静态正文`, app.includes('static-body:start'), '→ 缺少生成锚点');
  check(`${rel} #app 正文长度 > 800 字符`, text.length > 800, `→ 实际 ${text.length} 字符`);
  check(`${rel} #app 含 H1 且只有一个`, (app.match(/<h1\b/gi) || []).length === 1, `→ ${(app.match(/<h1\b/gi) || []).length} 个`);
  check(`${rel} #app 正文含本语言 heroTitle`, text.includes(messageSet.heroTitle));
  check(`${rel} #app 里七个 FAQ 都是 <details><summary>`, (app.match(/<details>/g) || []).length === FAQ_KEYS.length);
  check(`${rel} #app 正文含本语言 footerNote`, text.includes(messageSet.footerNote));
}

// 中英日韩都必须保留 Vue 的挂载入口。
// 这里**不能**断言「脚本出现在 #app 之后」：Vite 7 会把入口 <script type="module"> 提升到
// <head>，而 module 脚本天生 deferred —— 它在 HTML 解析完成后才执行，所以文档位置无关紧要。
// 真正会出事的是「入口丢失」或「退化成同步脚本」（同步脚本会在静态正文插入 DOM 前就执行、
// 导致 mount 目标缺失），所以断言的是「入口存在」+「是 type=module（延迟执行）」。
for (const item of readable) {
  // 位置一律在「屏蔽注释后」的文本上算：模板顶部的说明里也写着 <div id="app"> 这个字面量
  const masked = maskComments(item.html);
  const appOpen = masked.indexOf('<div id="app">');
  const bodyOpen = masked.search(/<body\b/i);
  const entry = masked.match(/<script\b[^>]*src="\/assets\/[^"]+"[^>]*>/);

  check(`${item.rel} 保留 Vue 挂载入口`, !!entry);
  check(
    `${item.rel} 挂载入口是 type="module"（deferred：先解析完静态正文再执行）`,
    !!entry && /\btype="module"/.test(entry[0]),
    entry ? `→ ${entry[0]}` : '→ 未找到入口脚本',
  );
  check(
    `${item.rel} #app 在 <body> 内`,
    bodyOpen >= 0 && appOpen > bodyOpen,
    `→ body=${bodyOpen} app=${appOpen}`,
  );
}

console.log('\n[语言纯净度]');
const zhRoot = readable.find((item) => item.pathname === '/');
if (zhRoot) {
  check('dist/index.html（中文版）#app 含中文正文', CJK.test(stripTags(zhRoot.app)));
}
for (const item of readable.filter((entry) => entry.pathname !== '/')) {
  const { page, rel, app } = item;
  const text = stripTags(app);
  const faqRaw = item.html.match(/<script type="application\/ld\+json" id="ld-faq">([\s\S]*?)<\/script>/i)?.[1] || '';
  if (page.lang === 'ja') {
    // 日文页必然有汉字，所以不查 CJK，改查「假名存在」+「没有只在中文文案里出现的字符」
    check(`${rel} #app 正文含日文假名`, KANA.test(text));
    const leaked = [...new Set([...text].filter((ch) => zhOnlyChars.has(ch)))];
    check(`${rel} #app 没有混进中文文案（无中文专有字符）`, leaked.length === 0, `→ 混入：${leaked.join('')}`);
    const faqLeaked = [...new Set([...faqRaw].filter((ch) => zhOnlyChars.has(ch)))];
    check(`${rel} FAQ 结构化数据没有混进中文`, faqLeaked.length === 0, `→ 混入：${faqLeaked.join('')}`);
  } else {
    const leaked = [...new Set([...text].filter((ch) => CJK.test(ch)))];
    check(`${rel} #app 正文不含 CJK 汉字`, leaked.length === 0, `→ 混入：${leaked.join('')}`);
    const faqLeaked = [...new Set([...faqRaw].filter((ch) => CJK.test(ch)))];
    check(`${rel} FAQ 结构化数据不含 CJK 汉字`, faqLeaked.length === 0, `→ 混入：${faqLeaked.join('')}`);
  }
}

console.log('\n[生成标记与退役检查]');
for (const item of readable) {
  check(`${item.rel} 带「请勿手改」生成标记`, item.html.includes('本文件由 scripts/prerender.mjs 生成，请勿手改'));
}
check('dist/_worker.js 已不存在', !existsSync(path.join(DIST, '_worker.js')));
check('public/_worker.js 已删除', !existsSync(path.join(ROOT, 'public', '_worker.js')));
for (const file of ['vite.config.js', 'package.json', 'src/main.js']) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  check(`${file} 不再引用 _worker.js`, !source.includes('_worker'));
}

// _redirects 是语言页能不能被返回的唯一保证，而且失效时首页照常打开、极难发现，所以逐条断言：
//   1) /en /ja /ko 的「精确 + 子路径」规则必须存在，并指向该语言的 index.html；
//   2) 不允许出现 /*  /index.html 的 catch-all —— Pages 自带 SPA 回退（没有顶层 404.html 时
//      未知路径都匹配到根 /），catch-all 不但多余，还可能把 /assets/*.js、/robots.txt、/og.png
//      一并改写成 index.html（_worker.js 删除后已没有 Function 挡在前面）。
console.log('\n[Cloudflare Pages _redirects：语言页必须显式声明，且不许有 catch-all]');
const redirectsFile = path.join(DIST, '_redirects');
check('dist/_redirects 存在', existsSync(redirectsFile));
if (existsSync(redirectsFile)) {
  const rules = readFileSync(redirectsFile, 'utf8')
    .split(/\r?\n/)
    .map((text, index) => ({ index, tokens: text.replace(/#.*$/, '').trim().split(/\s+/).filter(Boolean) }))
    .filter((rule) => rule.tokens.length >= 2);
  const findRule = (source) => rules.find((rule) => rule.tokens[0] === source);

  for (const [langPath, file] of [['/en', '/en/index.html'], ['/ja', '/ja/index.html'], ['/ko', '/ko/index.html']]) {
    const exact = findRule(langPath);
    const subtree = findRule(`${langPath}/*`);
    check(`dist/_redirects 有 ${langPath} → ${file}`, Boolean(exact) && exact.tokens[1] === file && exact.tokens[2] === '200');
    // /en/* 不匹配 /en 本身，所以精确路径与子路径两条都要有
    check(`dist/_redirects 有 ${langPath}/* → ${file}`, Boolean(subtree) && subtree.tokens[1] === file && subtree.tokens[2] === '200');
  }

  const catchAll = rules.filter((rule) => rule.tokens[0] === '/*');
  check(
    'dist/_redirects 没有 /* catch-all（Pages 自带 SPA 回退，catch-all 可能吞掉静态资源）',
    catchAll.length === 0,
    `→ 第 ${catchAll.map((rule) => rule.index + 1).join(', ')} 行出现了 /* 规则`,
  );
}

console.log('\n[域名一致性（改域名时四处一起改）]');
for (const file of ['index.html', 'public/robots.txt', 'public/sitemap.xml', 'src/seo-pages.js']) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  check(`${file} 使用 ${SITE_ORIGIN}`, source.includes(SITE_ORIGIN));
}

// og.png 是人工提供的（tools/og-card.html 导出）：缺失或尺寸不符只警告、不让构建失败——
// 页面与爬虫都不受影响，只是社交卡片会无图或变形，属于上线前该人工确认的事
const ogFile = path.join(DIST, 'og.png');
if (!existsSync(ogFile)) {
  warn('dist/og.png 不存在（源文件放 public/og.png）：og:image / twitter:image 会指向 404，社交卡片无图');
} else {
  // 只读 PNG 头（IHDR）拿尺寸，不引图片库
  const header = readFileSync(ogFile).subarray(0, 24);
  const size =
    header.toString('latin1', 1, 4) === 'PNG' && header.toString('latin1', 12, 16) === 'IHDR'
      ? { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
      : null;
  if (!size) {
    warn('dist/og.png 不是有效的 PNG，社交平台可能抓不到图');
  } else if (size.width !== OG_IMAGE.width || size.height !== OG_IMAGE.height) {
    warn(
      `dist/og.png 实际是 ${size.width}×${size.height}，但 og:image:width/height 声明为 ${OG_IMAGE.width}×${OG_IMAGE.height}：请导出成同尺寸（或同步改 src/seo-pages.js 的 OG_IMAGE）`,
    );
  }
}

console.log(`\n结果：${passed} 通过，${failed} 失败${warned ? `，${warned} 警告` : ''}`);
process.exit(failed ? 1 : 0);
