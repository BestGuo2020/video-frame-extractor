# 视频抽帧工具 · Video Frame Extractor

浏览器内运行的本地视频抽帧工具。加载本地视频 → 按 **帧数 / 间隔 / 关键帧 / 时间点 / 时间段** 提取画面 → 导出 PNG / JPG 或打包成 ZIP。
**视频不上传**：解码、抽帧、打包全部在设备上完成。

参考同类站点（frameextractor.net）的功能后重做，并额外增加了**按时间段抽帧**：拖时间轴选区或直接输入起止时间码，所有模式都只在该区间内取帧。

---

## 快速开始

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5174
pnpm build        # vite build → 预渲染四种语言的静态页 → 断言校验；产物在 dist/，可直接发布
pnpm preview      # 本地预览生产构建（含预渲染出的 /en /ja /ko）
pnpm selftest     # 核心库自检（可选传入一个真实 MP4 路径校验关键帧解析）
```

`pnpm build` 是一条链：`vite build && node scripts/prerender.mjs && node scripts/verify-prerender.mjs`。
预渲染或断言失败都会让构建以非 0 退出码结束。

自检示例：

```bash
pnpm selftest "C:\Users\me\Videos\demo.mp4"
```

---

## 功能

| 能力 | 说明 |
| --- | --- |
| 按帧数 | 在范围内均匀取 N 帧（取每段中点，避开首尾黑场） |
| 按间隔 | 每隔 N 秒取一帧，终点恰好落在网格上时也包含 |
| 关键帧 | MP4/MOV 直接解析容器关键帧表；其他封装用画面变化检测 |
| 时间点 | 粘贴时间码列表（`12`、`12.5`、`1:20`、`01:02:03.5`、`90s` 都支持） |
| **时间段** | **在选定区间内均匀取 N 帧（本工具新增）** |
| 时间段约束 | 拖动时间轴手柄选区后，**所有模式**都只在该区间内取帧；支持循环播放区间复核 |
| 输出格式 | PNG（无损）/ JPG（质量 50–100% 可调） |
| 最大分辨率 | 原始 / 4K / 2K / 1080p / 720p / 480p（按外接矩形等比缩放，永不放大） |
| 结果管理 | 逐帧勾选、单张保存、批量下载、一键打包 ZIP、定位回看 |
| 隐私 | 全程本地处理、不上传视频；统计不写 Cookie。数据边界（含「若展示第三方广告」的说明）见页面 FAQ 第 8 条 |
| 多语言 | 中文 / English / 日本語 / 한국어（`localStorage` 记忆；URL 带 `/en` `/ja` `/ko` 时自动切换，四份语言页在构建期预渲染成静态 HTML） |

---

## 实现要点

### 1. 精确定位（`src/lib/extract.js`）

抽帧最容易踩的坑是 `drawImage` 画到上一帧。这里的做法是：

```
seek → 等 seeked → 等 requestVideoFrameCallback → drawImage
```

- 抽帧使用**独立的隐藏 `<video>`**，不干扰用户正在预览的播放器；
- `requestVideoFrameCallback` 能拿到该帧真实的 `mediaTime`，因此结果里显示的时间是**实际抓到的帧时间**，而不是请求时间；
- 画布复用，只有输出尺寸变化时才重建；每帧之间 `setTimeout(0)` 让出主线程，进度条不卡；
- 取消（AbortSignal）会保留已完成的帧，不丢弃已做的工作。

### 2. 关键帧的两条路径（`src/lib/keyframes.js`）

- **经典 MP4/MOV**：解析 `moov/trak/mdia/minf/stbl` 的 `stss`（同步样本表）+ `stts`（时长表），有 `ctts` 时叠加 B 帧偏移 → 得到编码器真正的 I 帧时间。
- **分片 MP4（fMP4）**：手机录屏、`ffmpeg -movflags frag_keyframe` 的产物没有 `stss`，样本在 `moof/traf/trun` 里。这里按 `trun` 的 `sample_flags`（或 `tfhd`/`trex` 的默认值）中的 `sample_is_non_sync` 位判断关键帧，并用 `tfdt` + 样本时长累计出时间戳。
- **兜底**：WebM/MKV 或没有关键帧信息时，用画面变化检测——把帧缩到 64px 宽做 32 桶灰度直方图，相邻采样差异超过阈值即为场景切换候选。灵敏度（低/中/高）与采样密度（稀疏/标准/密集）可调。

### 3. 时间段（`src/components/VideoStage.vue` + `src/lib/plan.js`）

- 时间轴上有两个琥珀色手柄 + 可整体拖动的选区；`pointerdown` 用 `closest('[data-role]')` 判断拖的是手柄、选区还是空白处（空白处 = 跳转 + 拖动 scrub）；
- 手柄支持键盘 `←/→`（±0.1s）与 `Shift+←/→`（±1s），符合无障碍习惯；
- 面板上的起止输入框接受任意时间码写法，非法输入自动回滚；
- 区间只是「约束」：`buildPlan()` 在生成时间点前统一裁剪，因此五种模式自动都支持区间。

### 4. ZIP 打包（`src/lib/zip.js`）

不引第三方依赖，自己写 ZIP（仅 STORE 存储，PNG/JPG 本身已压缩，再 deflate 收益极小）：

- 逐文件算 CRC32 → 写本地头 → 复用原 Blob（不复制字节，峰值内存只多一份当前文件）；
- 文件名按 UTF-8 编码并置位通用标志位 bit 11，中文名在各系统都能正确解压；
- 超过 ZIP32 的 4GB 上限时明确报错，提示分批下载。

### 5. 多语言与 SEO：构建期预渲染（`scripts/prerender.mjs`）

以前多语言靠 Cloudflare Pages 的 `public/_worker.js` 在边缘用 `HTMLRewriter` 改 meta，问题有三个：`/en` 的首屏正文还是中文；爬虫拿不到正文（`#app` 是空的，全靠 Vue 挂载后渲染）；线上到底有没有生效只能靠猜。现在改成构建期一次做完：

- `vite build` 之后，`scripts/prerender.mjs` 拿 `dist/index.html` 当模板（它带着打包后的资源引用），按 `src/seo-pages.js` 的配置生成 `dist/en/index.html`、`dist/ja/index.html`、`dist/ko/index.html`——目录 + `index.html` 正是 Cloudflare Pages 为 `/en` 直接返回的落点；根路径 `dist/index.html` 保持中文；
- 每份文件都改写 `<html lang>`、`title`、`description`、`keywords`、`robots`、`canonical`（指向自身）、五条 `hreflang`（四份完全一致，根路径带结尾斜杠，`x-default` 指英文版）、`og:*`、`twitter:*`、`og:image`（1280×720），并按语言重写 `#ld-app` 与 `#ld-faq` 两段 JSON-LD；
- 最关键的是 `#app` 不再为空：`src/static-body.js` 用 `src/i18n.js` 的同一份文案拼出该语言的静态正文（H1 + 副标题、使用步骤、五种模式、画质/隐私说明、`<details>` 版 FAQ、页脚），不执行 JS 的爬虫（GPTBot / PerplexityBot / ClaudeBot / CCBot…）直接读到内容。文案只在 `src/i18n.js`，结构才写在 `static-body.js`，不存在第二份翻译；
- Vue 挂载时会整体替换这段正文（runtime-dom 挂载前会清空容器内容），不依赖 hydration、不需要 SSR 运行时；代价只是「JS 执行前的一瞬间」看到的是静态正文；
- `scripts/verify-prerender.mjs` 把这些结论变成断言（跟随 `pnpm build` 一起跑），任何一条挂掉都会让构建失败——包括「语言页里混进中文」这种肉眼很难发现的问题。

---

## 目录结构

```
video-frame-extractor/
├── index.html                 # 中文版 + 预渲染模板：SEO 标签（含被 prerender 改写的 og:image / hreflang 五条）
├── public/                    # 原样拷贝到 dist：robots.txt、sitemap.xml、_redirects（只列语言页规则，无 catch-all）、og.png（人工提供）
├── src/
│   ├── App.vue                # 顶层状态机：文件 → 元数据 → 计划 → 抽帧 → 下载
│   ├── i18n.js                # 中英日韩四语文案（唯一文案源，构建期预渲染也读它）
│   ├── seo-pages.js           # 多语言 SEO 配置的单一来源：域名、hreflang、og:image、每语言 title/description/JSON-LD 文案
│   ├── static-body.js         # 构建期生成 #app 的静态回退正文（结构与类名，不存译文；不进浏览器 bundle）
│   ├── style.css              # 全部样式（含响应式）
│   ├── components/
│   │   ├── DropZone.vue       # 拖放 / 选择文件
│   │   ├── VideoStage.vue     # 播放器 + 时间轴 + 时间段选区
│   │   ├── SettingsPanel.vue  # 模式、格式、分辨率、文件名前缀
│   │   ├── FrameGrid.vue      # 结果网格 + 批量操作
│   │   ├── FrameCard.vue      # 单张候选帧
│   │   └── GuideSection.vue   # 使用步骤 / 模式说明 / FAQ（SEO 正文）
│   └── lib/
│       ├── format.js          # 时间码解析与格式化
│       ├── plan.js            # 提取计划（含时间段约束、超量抽稀）
│       ├── extract.js         # 解码 / 定位 / 抓帧 / 导出
│       ├── keyframes.js       # MP4 关键帧表 + fMP4 + 画面变化检测
│       └── zip.js             # 无依赖 ZIP 打包
├── scripts/
│   ├── prerender.mjs          # 构建后生成四种语言的静态 HTML（读 dist/index.html 当模板）
│   ├── verify-prerender.mjs   # 预渲染产物断言（lang/canonical/hreflang/#app 正文/语言纯净度…）
│   ├── selftest.mjs           # 核心库自检（52 项断言）
│   └── inspect-mp4.mjs        # 打印 MP4 box 结构，排查关键帧用
└── test/
    └── driver.html            # 浏览器端到端驱动页（不参与构建）
```

---

## 验证

### 核心库自检

```bash
pnpm selftest "C:\path\to\video.mp4"
```

覆盖：时间码解析/格式化、五种模式的计划生成（含区间裁剪、去重、超量抽稀、非法区间回退）、分辨率缩放、ZIP 结构与内容（用系统 `tar` 独立解包比对）、真实 MP4 的关键帧解析。

### 预渲染产物断言

```bash
pnpm verify:prerender     # 单独重跑断言（需要先有 dist/）
```

`pnpm build` 的最后一步会自动跑它。覆盖：四份文件存在、`<html lang>` / `title` / `description` / `keywords` / `robots`、canonical 指向自身、五条 hreflang 四份一致、`og:*` 与 `twitter:*`（含 1280×720 的 `og:image`）、两段 JSON-LD 与本语言文案逐条一致、`#app` 静态正文长度 > 800 字符且含 H1 与八个 `<details>`、语言纯净度（`en`/`ko` 的 `#app` 里不允许出现 CJK 汉字；`ja` 必须含假名且不允许出现「只存在于中文文案里的字符」）、Vue 挂载入口仍在、`dist/_worker.js` 不存在、域名四处一致。

### 浏览器端到端

```bash
copy <任意 mp4> test\sample.mp4
pnpm dev
# 打开 http://127.0.0.1:5174/test/driver.html
```

驱动页把样例视频注入到真实页面，用合成指针事件测试时间轴拖拽/平移，并校验 JPG+720p 输出与 ZIP 内容（拦截 `<a download>` 后解析中央目录）。`test/` 已被排除在文件监听与构建之外。

---

## 部署（Cloudflare Pages）

- 构建命令：`pnpm build`，输出目录：`dist`
- 构建产物是纯静态文件，**没有运行时 Worker**：`dist/index.html`（中文）、`dist/en/index.html`、`dist/ja/index.html`、`dist/ko/index.html` 在构建时就带着各自的 meta、JSON-LD 与正文，`/en` `/ja` `/ko` 由 Pages 直接返回对应目录下的 `index.html`
- **`public/_redirects` 只列 `/en` `/ja` `/ko` 的显式规则，没有 `/*` catch-all**：Pages 自带单页回退（`public/` 下没有顶层 `404.html` 时，未知路径都匹配到根 `/`），catch-all 属于多余；而它一旦生效，可能把 `/assets/index-xxx.js`、`/robots.txt`、`/og.png` 也改写成 `index.html`（`_worker.js` 删除后不再有 Function 挡在前面）。语言页规则必须显式，才能保证这些 URL 一定返回对应语言的预渲染静态页、与 `sitemap.xml` 和四份 HTML 的 hreflang 对齐。`verify-prerender` 会断言六条语言规则存在且**没有** `/*` 规则
- `robots.txt` / `sitemap.xml` 会被原样拷贝
- **`public/og.png` 已就位**（1280×720，由 `tools/og-card.html` 渲染截图生成，重新生成的方法写在那个文件顶部）。它的真实尺寸必须与 `src/seo-pages.js` 的 `OG_IMAGE`、以及 `index.html` 里的 `og:image:width/height` 三处完全一致：缺文件或尺寸不符时构建只打印 warning，不让构建失败（页面与爬虫不受影响，只是社交卡片无图或变形），换图后请核对这三处
- 旧的 `public/_worker.js` 已删除：多语言与 SEO 全部在构建期完成，边缘改写不再需要；如果线上还残留旧部署的 Worker 路由/版本，需要在 Cloudflare 侧一并清理

### 部署后必须验证（本地无法验证，但它决定预渲染是否真的生效）

```powershell
# 1) 确认 Pages 返回的是该语言的预渲染文件，而不是中文壳
curl.exe -s https://frame-extractor.guoguo-labs.online/en | Select-String '<html lang=','<h1'
#    必须看到 lang="en" 且 h1 是英文。只验证 <title> 不够 —— 旧方案（边缘改写 meta）
#    正是只改了 head，正文一直是中文，爬虫看到的也就一直是中文。
# 2) canonical 必须自指，否则该语言页永远无法独立收录
curl.exe -s https://frame-extractor.guoguo-labs.online/en | Select-String 'rel="canonical"'
# 3) robots / sitemap 指向当前域名
curl.exe -s https://frame-extractor.guoguo-labs.online/robots.txt
curl.exe -s https://frame-extractor.guoguo-labs.online/sitemap.xml | Select-String '<loc>'
# 4) 用 AI 爬虫的 UA 抓一次：它们不执行 JS，只能读静态 HTML
curl.exe -s -A "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" https://frame-extractor.guoguo-labs.online/en | Select-String '<h1'
```

若第 1 条返回的仍是中文壳，说明 Pages 没命中 `dist/en/index.html`：检查 `public/_redirects` 里的六条语言规则是否存在（`verify-prerender.mjs` 会断言）。
另：**不要**在 Cloudflare 后台开启托管的 robots.txt / AI 爬虫管控 —— 它默认会 Disallow GPTBot / ClaudeBot / CCBot 等，等于把 AI 搜索引用这条渠道关掉（头号竞品 frameextractor.net 就关着）。

**域名已是 `https://frame-extractor.guoguo-labs.online`**；改域名时要同步改下面四处（`src/seo-pages.js` 是构建期预渲染的配置源，漏掉它的话四份 HTML 的 canonical / og:url / hreflang / JSON-LD 都会指向旧域名）：

- `index.html`（模板：`canonical`、`og:url`、`og:image`、`twitter:image`、五条 hreflang、两处 JSON-LD 的 `url`）
- `public/robots.txt`（Sitemap 地址）
- `public/sitemap.xml`（四处 `loc` 与 hreflang）
- `src/seo-pages.js`（`SITE_ORIGIN`、`OG_IMAGE`）

```powershell
# 一次性替换（把 NEW-DOMAIN 换成真实域名）
Get-ChildItem index.html, public\robots.txt, public\sitemap.xml, src\seo-pages.js |
  ForEach-Object { (Get-Content $_ -Raw) -replace 'frame-extractor\.guoguo-labs\.online', 'NEW-DOMAIN' | Set-Content -NoNewline $_ }
```

改完跑一次 `pnpm build`，`verify-prerender` 会断言四处域名一致、四份 HTML 的 canonical / hreflang 都是新域名。

---

## 限制与合理预期

- **能不能解码取决于浏览器**：H.264 MP4、WebM 通常没问题，H.265/HEVC 要看系统解码器；文件扩展名不能保证内部编码被支持。
- **抽帧不能凭空造细节**：压缩痕迹、低照度噪点、数字变焦和运动模糊都会原样保留；相邻几帧都发虚时，应挑动作停顿的瞬间，而不是放大导出尺寸。
- **内存**：每帧都会以 Blob + object URL 形式留在内存里。单次建议不超过 500 帧（超出会自动等间隔抽稀），长视频建议缩小分辨率或按时间段分批。
- **关键帧 ≠ 好构图**：编码关键帧服务于压缩结构，不一定是画面最清晰的那一帧。
- **画布受 CORS 限制**：本工具只读本地文件（blob URL），不涉及跨域取图，因此不会出现画布污染问题。

## 隐私

视频通过浏览器的本地 API 读取，解码与抽帧都在你的设备上完成；页面没有任何上传接口。只有你主动点击下载的图片或 ZIP 会离开浏览器。

### 变现与隐私承诺的边界（改文案前必读）

页脚和 FAQ 里的隐私文案有一条硬规则：**只写永远可验证为真的内容**。

- 页脚（`footerNote`，四种语言）只保留两件事：本地处理、不上传视频。这两件事无论站点怎么变现都成立。
- 数据边界写在 FAQ 第 8 条（`faq8q` / `faq8a`）：明确说明托管与统计会收到标准请求信息、统计不写 Cookie，并交代「若展示第三方广告，广告方可能设置自己的 Cookie」。用"如果/可能"表述，是为了让这句话在接广告前后都成立。
- **曾经页脚写的是"无广告追踪"** —— 只要接入任何第三方广告它立刻变成假话。这条历史在 git log 里能查到（`add ads code` → `remove ads`）：当时测试的 popunder 广告会劫持页面上任意点击、跳转到 YouTube 内容套利页，既毁体验又让这句承诺不成立，所以广告被移除、文案改成现在这样。
- 若将来要接广告：优先 AdSense/AdX 这类有品牌安全与品类屏蔽的正规需求方；低档自助联盟（PropellerAds / Monetag / Adsterra 这一档）没有语言匹配、没有自助黑名单，只能逐个 campaign 发工单屏蔽且 CPM 会降。**任何第三方脚本一旦引入，`footerNote` 与 FAQ 第 8 条必须同时复核。**
