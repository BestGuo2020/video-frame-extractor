// scripts/prerender.mjs — 构建后为每种语言生成真正的静态 HTML
//
//   node scripts/prerender.mjs      （pnpm build 会在 vite build 之后自动跑它）
//
// 为什么放在构建期：以前靠 public/_worker.js 在 Cloudflare 边缘用 HTMLRewriter 改 meta，
// 结果 /en /ja /ko 的首屏正文还是中文，而且「线上到底有没有生效」只能靠猜。现在每份 HTML
// 在构建时就带上了该语言的 meta、结构化数据与正文：静态资源直出、可本地验证、没有运行时黑盒。
//
// 做法：拿 vite build 产出的 dist/index.html 当模板（它带着打包后的资源引用），按语言改写
// head、填满 <div id="app"> 的静态回退正文，再把语言页写成 dist/<lang>/index.html——
// 目录 + index.html 是 Cloudflare Pages 为 /en 直接返回的落点。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages } from '../src/i18n.js';
import { HREFLANG, OG_IMAGE, SEO_PAGES, SHARED_META, SITE_ORIGIN, outputFileFor, pageUrl } from '../src/seo-pages.js';
import { FAQ_KEYS, renderStaticBody } from '../src/static-body.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const TEMPLATE = path.join(DIST, 'index.html');

const GENERATED_NOTE = `    <!--
      本文件由 scripts/prerender.mjs 生成，请勿手改。
      改 SEO 文案 → src/seo-pages.js；改页面正文 → src/i18n.js；改页面结构 → index.html。
    -->`;

/* ---------------- HTML 小工具（只处理构建期已知的标签，够用就好） ---------------- */

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeAttr = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ESCAPE_MAP[ch]);

// 注释里也可能出现 <div id="app"> 这种字面量（模板顶部的说明就写了），定位前先把注释内容
// 换成等长空格：长度不变，所以偏移量仍能映射回原文，但注释不会再被当成真实标签。
const maskComments = (html) => html.replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length));

function attrOf(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

// 只在「非注释」区域里找标签，但返回的 tag 仍是原文（替换时要写回原样）
function findAll(html, pattern) {
  const masked = maskComments(html);
  const found = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  let match = re.exec(masked);
  while (match) {
    found.push({
      tag: html.slice(match.index, match.index + match[0].length),
      start: match.index,
      end: match.index + match[0].length,
    });
    match = re.exec(masked);
  }
  return found;
}

function replaceRange(html, start, end, replacement) {
  return html.slice(0, start) + replacement + html.slice(end);
}

// 定位 <meta>：key 可以是 name 或 property
function findMeta(html, key) {
  const matches = findAll(html, /<meta\b[^>]*>/gi).filter((item) => {
    const name = attrOf(item.tag, 'name');
    const property = attrOf(item.tag, 'property');
    return name === key || property === key;
  });
  if (matches.length !== 1) {
    throw new Error(`index.html 里应有且仅有一个 <meta name/property="${key}">，实际找到 ${matches.length} 个`);
  }
  const found = matches[0];
  return { ...found, attr: attrOf(found.tag, 'name') === key ? 'name' : 'property' };
}

function setMetaContent(html, key, content) {
  const found = findMeta(html, key);
  return replaceRange(html, found.start, found.end, `<meta ${found.attr}="${key}" content="${escapeAttr(content)}" />`);
}

function setLinkHref(html, { rel, hreflang = null }, href) {
  const matches = findAll(html, /<link\b[^>]*>/gi).filter((item) => {
    if (attrOf(item.tag, 'rel') !== rel) return false;
    return hreflang === null || attrOf(item.tag, 'hreflang') === hreflang;
  });
  if (matches.length !== 1) {
    throw new Error(`index.html 里应有且仅有一个 <link rel="${rel}"${hreflang ? ` hreflang="${hreflang}"` : ''}>，实际找到 ${matches.length} 个`);
  }
  const found = matches[0];
  const attrs = hreflang ? ` rel="${rel}" hreflang="${hreflang}"` : ` rel="${rel}"`;
  return replaceRange(html, found.start, found.end, `<link${attrs} href="${escapeAttr(href)}" />`);
}

// hreflang 五条在四份文件里必须逐字一致：整块删掉重建，比逐条替换更难写错
function setHreflangBlock(html) {
  const matches = findAll(html, /<link\b[^>]*hreflang="[^"]*"[^>]*>/gi);
  if (matches.length < 2) throw new Error('index.html 里找不到 hreflang 区块');
  // 逐对检查相邻两条之间的空隙只有空白：中间夹了别的标签时，整块替换会连带删掉它
  for (let index = 1; index < matches.length; index += 1) {
    const gap = html.slice(matches[index - 1].end, matches[index].start);
    if (gap.trim() !== '') {
      throw new Error(`index.html 的第 ${index} 条 hreflang 前面混进了其他内容，请先整理 <link rel="alternate"> 区块`);
    }
  }
  const first = matches[0];
  const last = matches[matches.length - 1];
  // 从行首开始替换：否则第一行会保留原来那行的缩进，生成的文件里会出现 8 个空格的怪行
  let blockStart = first.start;
  while (blockStart > 0 && (html[blockStart - 1] === ' ' || html[blockStart - 1] === '\t')) blockStart -= 1;
  const block = HREFLANG.map(
    (item) => `    <link rel="alternate" hreflang="${item.hreflang}" href="${escapeAttr(pageUrl(item.path))}" />`,
  ).join('\n');
  return replaceRange(html, blockStart, last.end, block);
}

function setTitle(html, title) {
  const matches = findAll(html, /<title>[\s\S]*?<\/title>/i);
  if (matches.length !== 1) throw new Error(`index.html 里应有一个 <title>，实际找到 ${matches.length} 个`);
  return replaceRange(html, matches[0].start, matches[0].end, `<title>${escapeAttr(title)}</title>`);
}

function setJsonLd(html, id, data) {
  const matches = findAll(html, new RegExp(`<script type="application/ld\\+json" id="${id}">[\\s\\S]*?</script>`, 'i'));
  if (matches.length !== 1) throw new Error(`index.html 里应有一个 <script id="${id}">，实际找到 ${matches.length} 个`);
  // JSON 里只要出现 '<'，就先转成 \u003c：避免正文里的 </script> 提前结束脚本块
  const body = JSON.stringify(data, null, 2).replaceAll('<', '\\u003c');
  const indented = body
    .split('\n')
    .map((line, index) => (index === 0 ? line : '      ' + line))
    .join('\n');
  return replaceRange(
    html,
    matches[0].start,
    matches[0].end,
    `<script type="application/ld+json" id="${id}">\n      ${indented}\n    </script>`,
  );
}

function setHtmlLang(html, htmlLang) {
  const matches = findAll(html, /<html\b[^>]*>/i);
  if (matches.length !== 1) throw new Error(`index.html 里应有一个 <html>，实际找到 ${matches.length} 个`);
  const original = matches[0].tag;
  const tag = attrOf(original, 'lang')
    ? original.replace(/(\blang\s*=\s*")[^"]*(")/i, `$1${htmlLang}$2`)
    : original.replace('<html', `<html lang="${htmlLang}"`);
  return replaceRange(html, matches[0].start, matches[0].end, tag);
}

// 填满 #app：逐层数 <div> 配对，避免正文里嵌套的 </div> 提前收尾
function setAppBody(html, inner) {
  const openTag = '<div id="app">';
  const masked = maskComments(html);
  const start = masked.indexOf(openTag);
  if (start < 0) throw new Error('模板里找不到 <div id="app">');
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start + openTag.length;
  let depth = 1;
  let match = re.exec(masked);
  while (match) {
    depth += match[0] === '</div>' ? -1 : 1;
    if (depth === 0) return replaceRange(html, start, match.index + match[0].length, `${openTag}\n${inner}\n    </div>`);
    match = re.exec(masked);
  }
  throw new Error('#app 的 </div> 没有找到，index.html 结构可能被改坏了');
}

// 语言页把 <noscript> 里的中文提示去掉：那里是硬编码中文，会给 /en 页面留下中文正文，
// 而语言页现在已经有真正的静态正文可读，不再需要这句提示（中文版保留原样）
function dropNoscript(html) {
  const match = html.match(/\s*<noscript>[\s\S]*?<\/noscript>/i);
  return match ? replaceRange(html, match.index, match.index + match[0].length, '') : html;
}

function insertGeneratedNote(html) {
  const match = html.match(/<!doctype html>\s*/i);
  if (!match) throw new Error('模板缺少 <!doctype html>');
  return replaceRange(html, match.index, match.index + match[0].length, `${match[0]}${GENERATED_NOTE}\n`);
}

/* ---------------- 结构化数据 ---------------- */

function buildAppSchema(pathname, page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: page.schema.appName,
    url: pageUrl(pathname),
    description: page.schema.appDesc,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'All',
    browserRequirements: SHARED_META.browserRequirements,
    offers: { '@type': 'Offer', price: '0', priceCurrency: SHARED_META.priceCurrency },
    featureList: page.schema.featureList,
  };
}

// 每种语言在 src/i18n.js 里都有完整的 FAQ 文案，所以四份文件都生成对应的 FAQPage；
// 万一以后某种语言缺文案，用 null 表示该语言页应移除这段结构化数据（不能混语言）
function buildFaqSchema(lang, messageSet) {
  const items = FAQ_KEYS.map(([qKey, aKey]) => [messageSet[qKey], messageSet[aKey]]);
  if (items.some(([question, answer]) => !question || !answer)) {
    console.warn(`  warn ${lang} 缺少 FAQ 文案，该语言页将移除 FAQPage 结构化数据`);
    return null;
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

/* ---------------- 主流程 ---------------- */

if (!existsSync(TEMPLATE)) {
  console.error(`找不到 ${path.relative(ROOT, TEMPLATE)}，请先执行 vite build（pnpm build 会自动串起来）。`);
  process.exit(1);
}

const template = readFileSync(TEMPLATE, 'utf8');
const written = [];

for (const [pathname, page] of Object.entries(SEO_PAGES)) {
  const messageSet = messages[page.lang];
  if (!messageSet) throw new Error(`src/i18n.js 里没有 ${page.lang} 的文案`);

  let html = template;
  html = setHtmlLang(html, page.htmlLang);
  html = setTitle(html, page.title);
  html = setMetaContent(html, 'description', page.description);
  html = setMetaContent(html, 'keywords', page.keywords);
  html = setMetaContent(html, 'robots', SHARED_META.robots);
  html = setLinkHref(html, { rel: 'canonical' }, pageUrl(pathname));
  html = setHreflangBlock(html);

  html = setMetaContent(html, 'og:type', SHARED_META.ogType);
  html = setMetaContent(html, 'og:locale', page.locale);
  html = setMetaContent(html, 'og:site_name', page.schema.appName);
  html = setMetaContent(html, 'og:url', pageUrl(pathname));
  html = setMetaContent(html, 'og:title', page.ogTitle);
  html = setMetaContent(html, 'og:description', page.ogDesc);
  html = setMetaContent(html, 'og:image', OG_IMAGE.url);
  html = setMetaContent(html, 'og:image:width', String(OG_IMAGE.width));
  html = setMetaContent(html, 'og:image:height', String(OG_IMAGE.height));
  html = setMetaContent(html, 'twitter:card', SHARED_META.twitterCard);
  html = setMetaContent(html, 'twitter:title', page.twitterTitle || page.ogTitle);
  html = setMetaContent(html, 'twitter:description', page.twitterDesc || page.ogDesc);
  html = setMetaContent(html, 'twitter:image', OG_IMAGE.url);

  html = setJsonLd(html, 'ld-app', buildAppSchema(pathname, page));

  const faqSchema = buildFaqSchema(page.lang, messageSet);
  if (faqSchema) {
    html = setJsonLd(html, 'ld-faq', faqSchema);
  } else {
    html = html.replace(/\s*<script type="application\/ld\+json" id="ld-faq">[\s\S]*?<\/script>/i, '');
  }

  const body = renderStaticBody(page.lang, messageSet);
  html = setAppBody(html, body);
  if (pathname !== '/') html = dropNoscript(html);
  html = insertGeneratedNote(html);

  const file = path.join(DIST, outputFileFor(pathname));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html, 'utf8');
  written.push({ file, pathname, page, size: Buffer.byteLength(body, 'utf8') });
}

console.log(`预渲染完成（${SITE_ORIGIN}）：`);
for (const item of written) {
  console.log(
    `  ${path.relative(ROOT, item.file).replace(/\\/g, '/').padEnd(24)} ${item.page.htmlLang.padEnd(6)} canonical=${pageUrl(item.pathname).padEnd(48)} 正文 ${(item.size / 1024).toFixed(1)} KB`,
  );
}
// og.png 的检查（存在性 + 尺寸）放在 verify-prerender.mjs：那里出 warning 不会让构建失败，
// 也避免同一件事在两个脚本里各警告一次
