# 海外落地页执行清单 —— video-frame-extractor & imgcrop

> 本文自包含：原调研文档（`docs/overseas-seo-plan.md`）会被删除，正文里不出现"见第 N 节"这类引用。
> 用法：按工具分两大节，每页一块，块内字段可直接照抄进代码 / 文案。

## 怎么用这份清单

- 两个站都是 **Vite 静态站 + Cloudflare Pages + 四语言（zh / en / ja / ko）构建期预渲染**。
- **一页 = 一个 URL + 一种语言的正文。** 中文页在 `/{slug}`，英文在 `/en/{slug}`，日文 `/ja/{slug}`，韩文 `/ko/{slug}`。
- 新增一个落地页，要动的地方只有 **`src/seo-pages.js`**：把现在"四个首页"的写法（按语言 key 的对象）**重构成页面数组**（每项含 `slug` + 各语言文案），然后由 **`scripts/prerender.mjs` 循环为每种语言生成一份静态 HTML**（正文也要替换，不是只换 meta）。
- 每个新页面必须同时具备四件事：① **自指的 canonical**（`/en/mp4-to-jpg` 的 canonical 就是它自己，不是 `/en`）；② **五条一致的 hreflang**（`zh-CN` / `en` / `ja` / `ko` / `x-default`，四页互指、`x-default → /en`，四份 HTML 里逐字相同）；③ **该语言的正文**（不是中文正文配英文 meta）；④ `<title>` / meta description / JSON-LD。
- `scripts/verify-prerender.mjs` 的断言要一起扩到每个新页（canonical 自指、hreflang 一致），只覆盖首页等于没覆盖。
- 验收看**正文**，不是看 title：`curl -A "GPTBot" https://{domain}/en/{slug}` 返回的 `<h1>` 必须是英文——GPTBot 不执行 JS，它看到什么，AI 搜索就认为你是什么。
- 字符口径：title ≤60、meta description ≤155。**本清单里 20 页的英文 title / meta 全部实测过（最长 58 / 155），可直接粘贴，禁止改写措辞。**
- **主关键词**取自关键词矩阵中该页所属簇的头词；两篇博客页不在矩阵内，用其标题 / H1 的措辞（标 `*`）。
- **优先级 = 本清单的序号**（越小越先上线）；源方案额外点名的页面写在"优先级"字段里。
- 语言节奏：**第 1–8 周只做英文**；第 8–12 周做 3–4 个日文页（人工翻译 + 本地化改写）；第 12 周之后再考虑韩文。
- 每页固定结构：H1 唯一 + 首段 60–90 词 + 首屏内工具入口 + 4–6 个 H2 + Related 内链 3–5 条（描述性锚文本）+ FAQ（配 FAQPage JSON-LD）+ CTA。**低于 600 词的落地页不要发。**

---

## 一、video-frame-extractor 页面清单

站点：`https://frame-extractor.guoguo-labs.online`（已上线），主打「视频不上传」。

```
/en                                              #1  工具页（已存在，补元数据）
/en/extract-keyframes-from-video                 #2  落地页（技术护城河）
/en/extract-frames-by-time-range                 #3  落地页
/en/mp4-to-jpg                                   #4  格式落地页
/en/mp4-to-png                                   #5  格式落地页
/en/webm-to-png                                  #6  格式落地页
/en/extract-frames-from-fragmented-mp4           #7  落地页（技术独占）
/en/video-frame-extractor-without-upload         #8  对比页（隐私主张）
/en/blog/how-to-extract-frames-from-a-video      #9  指南
/en/blog/ffmpeg-vs-browser-frame-extraction      #10 对比页
```

### #1 ｜ `https://frame-extractor.guoguo-labs.online/en` — 工具页

- **主关键词**：`video frame extractor`
- **Title**（54 字符）：`Video Frame Extractor – Extract Frames in Your Browser`
- **Meta description**（153 字符）：`Extract frames from any video by count, interval, keyframes or timestamp. PNG or JPG up to 4K, ZIP download. Runs 100% in your browser, nothing uploaded.`
- **H1**：`Video Frame Extractor`
- **H2 提纲**：1. `Extract frames the way you actually think about them`（四模式说明） / 2. `Real keyframe extraction, not a guess` / 3. `Constrain everything to one time range` / 4. `Your video never leaves your device` / 5. `Works with MP4, MOV, WebM — and fragmented MP4` / 6. `Frequently asked questions`
- **FAQ**：6 条
- **JSON-LD**：`WebApplication` + 补 `FAQPage`（`BreadcrumbList` 单层可省）；`priceCurrency` 改成 `USD`
- **内链**：→ `/en/extract-keyframes-from-video`、`/en/extract-frames-by-time-range`、`/en/mp4-to-jpg`、`/en/video-frame-extractor-without-upload`
- **优先级**：#1（工具页**已存在**，只缺元数据补齐）

### #2 ｜ `/en/extract-keyframes-from-video` — 落地页（技术护城河页）

- **主关键词**：`extract keyframes from video`
- **Title**（56 字符）：`Extract Keyframes From Video Online – MP4 Keyframe Table`
- **Meta description**（152 字符）：`Extract the true keyframes from an MP4 or MOV by reading its stss/stts tables, not guessing. Free, browser-based, no upload. Also handles WebM and fMP4.`
- **H1**：`Extract Keyframes From a Video`
- **H2 提纲**：1. `What a keyframe actually is (and why it matters)` / 2. `How we find keyframes: reading the MP4 stss and stts tables` / 3. `What happens when a file has no keyframe table` / 4. `Keyframes vs. scene-change detection: which one you want` / 5. `Step-by-step: extract keyframes in your browser` / 6. `Frequently asked questions`
- **FAQ**：5 条
- **内链**：→ `/en`（锚文本 `video frame extractor`）、`/en/blog/ffmpeg-vs-browser-frame-extraction`、`/en/extract-frames-from-fragmented-mp4`
- **优先级**：#2（该簇是**最快拿到排名的一簇**，竞争度最低）

### #3 ｜ `/en/extract-frames-by-time-range` — 落地页

- **主关键词**：`extract frames at specific timestamps`
- **Title**（52 字符）：`Extract Frames From a Video Time Range – Free Online`
- **Meta description**（149 字符）：`Set a start and end time once, then extract frames inside that range by count, interval, keyframes or timestamp. Free, private, runs in your browser.`
- **H1**：`Extract Frames From a Specific Time Range`
- **H2 提纲**：1. `Why a time range beats scrubbing a whole timeline` / 2. `Set the range once, then choose how to sample it` / 3. `Recipes: 1 frame per second, every 5 seconds, or N evenly spaced frames` / 4. `Working with long recordings (lectures, matches, dashcam, surveillance)` / 5. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/extract-keyframes-from-video`、`/en/blog/how-to-extract-frames-from-a-video`
- **优先级**：#3

### #4 ｜ `/en/mp4-to-jpg` — 格式落地页

- **主关键词**：`mp4 to jpg`
- **Title**（50 字符）：`MP4 to JPG – Extract Frames as JPG in Your Browser`
- **Meta description**（148 字符）：`Convert MP4 video to JPG images without uploading. Choose frame count, interval or exact timestamps, set JPG quality, download every frame as a ZIP.`
- **H1**：`MP4 to JPG`
- **H2 提纲**：1. `Turn an MP4 into a set of JPG stills` / 2. `Choosing JPG quality and resolution` / 3. `JPG or PNG? How to decide` / 4. `Step-by-step` / 5. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/mp4-to-png`、`/en/webm-to-png`（用 `convert WebM to PNG` 这类**描述性锚文本**）
- **优先级**：#4（格式词一个格式一个 URL，**不要合并成一页**）

### #5 ｜ `/en/mp4-to-png` — 格式落地页

- **主关键词**：`mp4 to png`
- **Title**（49 字符）：`MP4 to PNG – Lossless Frame Extraction, No Upload`
- **Meta description**（150 字符）：`Extract lossless PNG frames from an MP4 in your browser. Native resolution, no re-compression, no upload. Pick frames by count, interval or timestamp.`
- **H1**：`MP4 to PNG`
- **H2 提纲**：1. `When you need PNG instead of JPG` / 2. `Lossless frames at the source resolution` / 3. `Handling transparency and alpha channels` / 4. `Step-by-step` / 5. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/mp4-to-jpg`、`/en/extract-keyframes-from-video`
- **优先级**：#5

### #6 ｜ `/en/webm-to-png` — 格式落地页（含录屏场景）

- **主关键词**：`webm to png`
- **Title**（51 字符）：`WebM to PNG – Extract Frames From Screen Recordings`
- **Meta description**（142 字符）：`Extract PNG frames from WebM screen recordings and MediaRecorder output. Everything runs locally in your browser, so nothing is ever uploaded.`
- **H1**：`WebM to PNG`
- **H2 提纲**：1. `Why WebM files are hard to extract frames from` / 2. `MediaRecorder and screen-capture WebM` / 3. `Step-by-step` / 4. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/mp4-to-png`、`/en/extract-frames-from-fragmented-mp4`
- **优先级**：#6（MediaRecorder 这条入选"基本无人认领"的长尾）

### #7 ｜ `/en/extract-frames-from-fragmented-mp4` — 落地页（技术独占页）

- **主关键词**：`fragmented mp4 frame extraction`
- **Title**（53 字符）：`Extract Frames From Fragmented MP4 (fMP4) – Free Tool`
- **Meta description**（150 字符）：`Most browser tools fail on fragmented MP4 from OBS, MediaRecorder or streaming captures. This one parses fMP4 properly. Free, local, nothing uploaded.`
- **H1**：`Extract Frames From a Fragmented MP4 (fMP4)`
- **H2 提纲**：1. `What makes fragmented MP4 different` / 2. `Where fMP4 files come from: OBS, MediaRecorder, DASH, CMAF` / 3. `Why many online extractors return zero frames` / 4. `Step-by-step` / 5. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/webm-to-png`、`/en/blog/ffmpeg-vs-browser-frame-extraction`
- **优先级**：#7（源方案原话：**"这一页是全网几乎没有对手的页，优先做"**）

### #8 ｜ `/en/video-frame-extractor-without-upload` — 对比页（隐私主张页）

- **主关键词**：`video frame extractor without upload`
- **Title**（54 字符）：`Video Frame Extractor With No Upload – 100% In-Browser`
- **Meta description**（146 字符）：`Compare a browser-based frame extractor with upload-based tools like 123apps. What leaves your device, what doesn't, and how to check it yourself.`
- **H1**：`A Video Frame Extractor That Never Uploads Your Video`
- **H2 提纲**：1. `What 'local processing' actually means` / 2. `What upload-based tools do with your file` / 3. `How to verify we're telling the truth (turn off your Wi-Fi)` / 4. `What our servers still see — stated plainly`（**这一节必须写**，措辞见"风险红线"） / 5. `Frequently asked questions`
- **FAQ**：5 条
- **内链**：→ `/en`、`/privacy`（如果有）、`/en/blog/ffmpeg-vs-browser-frame-extraction`
- **优先级**：#8

### #9 ｜ `/en/blog/how-to-extract-frames-from-a-video` — 指南

- **主关键词**：`how to extract frames from a video`
- **Title**（54 字符）：`How to Extract Frames From a Video (2026 Guide + Tool)`
- **Meta description**（145 字符）：`A practical walkthrough of every extraction mode — count, interval, keyframes and timestamps — plus how to avoid blurry frames and pick a format.`
- **H1**：`How to Extract Frames From a Video`
- **H2 提纲**：1. `Step 1 — Check the source before you extract` / 2. `Step 2 — Pick the mode that matches what you know` / 3. `Step 3 — Compare adjacent frames, don't take the first one` / 4. `Step 4 — Choose PNG or JPG for the next task` / 5. `Step 5 — Export a shortlist, not everything` / 6. `Common mistakes` / 7. `Frequently asked questions`
- **FAQ**：4 条
- **JSON-LD**：`Article`（**不要用 `HowTo`**，Google 已于 2023 年 9 月移除 HowTo 富媒体结果）+ `FAQPage`
- **内链**：→ `/en`、`/en/extract-frames-by-time-range`、`/en/mp4-to-jpg`、`/en/extract-keyframes-from-video`
- **优先级**：#9

### #10 ｜ `/en/blog/ffmpeg-vs-browser-frame-extraction` — 对比页

- **主关键词**：`extract frames without ffmpeg`
- **Title**（50 字符）：`ffmpeg vs. a Browser Frame Extractor: Which to Use`
- **Meta description**（137 字符）：`When ffmpeg is the right tool, when a browser extractor is faster, and the exact ffmpeg command if you'd rather stay on the command line.`
- **H1**：`ffmpeg vs. Extracting Frames in Your Browser`
- **H2 提纲**：1. `The ffmpeg commands people actually search for`（给出 `-vf fps=1`、`-vf select='eq(pict_type,I)'` 等真实命令） / 2. `Where ffmpeg wins` / 3. `Where a browser tool wins` / 4. `Privacy and file-handling differences` / 5. `Verdict` / 6. `Frequently asked questions`
- **FAQ**：3 条
- **内链**：→ `/en`、`/en/extract-keyframes-from-video`、`/en/video-frame-extractor-without-upload`
- **优先级**：#10（**先证明你懂 ffmpeg，再讲浏览器工具的优势**，不要写成拉踩）

---

## 二、imgcrop 页面清单

站点：`https://imgcrop.guoguo-labs.online`（已上线），主打「图片不上传」。
**定位纪律：只打"游戏素材 / 精灵图 / 拼图拆分"，绝不碰通用抠图。**

```
/en                                                   #1  工具页
/en/split-sprite-sheet-into-individual-images         #2  落地页（核心长尾）
/en/texture-atlas-splitter                            #3  落地页
/en/godot-sprite-sheet-splitter                       #4  落地页（引擎生态）
/en/unity-sprite-sheet-splitter                       #5  落地页（引擎生态）
/en/pixel-art-sprite-splitter                         #6  落地页（像素画社区）
/en/split-image-into-multiple-images                  #7  落地页（通用场景，只打长尾）
/en/remove-white-background-from-sprite               #8  落地页（定位受限，措辞谨慎）
/en/blog/how-to-split-a-sprite-sheet                  #9  指南
/en/blog/sprite-sheet-splitter-vs-photoshop-slice     #10 对比页
```

### #1 ｜ `https://imgcrop.guoguo-labs.online/en` — 工具页

- **主关键词**：`sprite sheet splitter`
- **Title**（54 字符）：`Sprite Sheet Splitter – Split Images Into PNGs Locally`
- **Meta description**（147 字符）：`Automatically split a sprite sheet or sticker sheet into separate transparent PNGs. No grid needed, nothing uploaded. Runs offline in your browser.`
- **H1**：`Sprite Sheet Splitter`
- **H2 提纲**：1. `You don't need to know the grid` / 2. `How automatic detection works` / 3. `One-click flat-background removal` / 4. `Batch download every piece as a ZIP` / 5. `Everything runs on your device` / 6. `Frequently asked questions`
- **FAQ**：6 条
- **JSON-LD**：`WebApplication` + `FAQPage` + `ImageObject`（附一张真实截图）。**站上现在的 `Tool` 不是 schema.org 标准类型，必须换掉**
- **内链**：→ `/en/remove-white-background-from-sprite`、`/en/godot-sprite-sheet-splitter`、`/en/blog/how-to-split-a-sprite-sheet`
- **优先级**：#1（工具页，已有页面）

### #2 ｜ `/en/split-sprite-sheet-into-individual-images` — 落地页（核心长尾）

- **主关键词**：`split sprite sheet into individual images`
- **Title**（58 字符）：`Split a Sprite Sheet Into Individual Images (Free, Online)`
- **Meta description**（155 字符）：`Turn one sprite sheet into dozens of separate PNG files automatically — no grid math, no Photoshop, no upload. Detects each disconnected sprite on its own.`
- **H1**：`Split a Sprite Sheet Into Individual Images`
- **H2 提纲**：1. `The problem with grid-based cutters` / 2. `Automatic detection: how we find each sprite` / 3. `Transparent vs. flat backgrounds` / 4. `Naming and exporting your frames` / 5. `Troubleshooting: merged or missing sprites` / 6. `Frequently asked questions`
- **FAQ**：5 条
- **内链**：→ `/en`（锚文本 `sprite sheet splitter`）、`/en/blog/how-to-split-a-sprite-sheet`、`/en/texture-atlas-splitter`
- **优先级**：#2（核心长尾，锚文本用精确匹配）

### #3 ｜ `/en/texture-atlas-splitter` — 落地页

- **主关键词**：`texture atlas splitter`
- **Title**（50 字符）：`Texture Atlas Splitter – Unpack an Atlas Into PNGs`
- **Meta description**（148 字符）：`Unpack a texture atlas into individual sprite PNGs without writing code. Free, browser-based, no upload. Works with packed sheets and loose atlases.`
- **H1**：`Texture Atlas Splitter`
- **H2 提纲**：1. `What a texture atlas is` / 2. `Unpacking a packed atlas when you don't have the .json` / 3. `Atlas → individual PNGs in three steps` / 4. `Common atlas formats and what we handle` / 5. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/godot-sprite-sheet-splitter`、`/en/unity-sprite-sheet-splitter`
- **优先级**：#3（该簇是**最该先抢的一簇**：全是开源仓库和边缘小工具，没有做得好的在线工具）

### #4 ｜ `/en/godot-sprite-sheet-splitter` — 落地页（引擎生态）

- **主关键词**：`godot split sprite sheet`
- **Title**（52 字符）：`Godot Sprite Sheet Splitter – Split Frames for Godot`
- **Meta description**（131 字符）：`Split a sprite sheet into individual PNG frames ready to import into Godot 4. No upload, no grid math, works right in your browser.`
- **H1**：`Split a Sprite Sheet for Godot`
- **H2 提纲**：1. `Two ways to animate a sprite sheet in Godot`（`AnimatedSprite2D` + `SpriteFrames` vs `AtlasTexture`） / 2. `Splitting into individual PNGs for AnimatedSprite2D` / 3. `When to keep the sheet and use AtlasTexture instead` / 4. `Import settings to check after splitting` / 5. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/texture-atlas-splitter`、`/en/blog/how-to-split-a-sprite-sheet`
- **优先级**：#4（每个引擎一个独立 URL，引擎用户搜的是引擎名）

### #5 ｜ `/en/unity-sprite-sheet-splitter` — 落地页（引擎生态）

- **主关键词**：`unity sprite sheet splitter`
- **Title**（58 字符）：`Unity Sprite Sheet Splitter – Cut Frames Without Photoshop`
- **Meta description**（138 字符）：`Split a sprite sheet into individual PNGs before importing to Unity, or use it alongside the Sprite Editor. Free, local, nothing uploaded.`
- **H1**：`Split a Sprite Sheet for Unity`
- **H2 提纲**：1. `Unity's built-in Sprite Editor vs. pre-split PNGs` / 2. `Why pre-splitting helps with irregular sheets` / 3. `Sprite Mode and Pixels Per Unit after import` / 4. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/texture-atlas-splitter`、`/en/pixel-art-sprite-splitter`
- **优先级**：#5

### #6 ｜ `/en/pixel-art-sprite-splitter` — 落地页（像素画社区）

- **主关键词**：`pixel art sprite splitter`
- **Title**（56 字符）：`Pixel Art Sprite Splitter – Cut Pixel Sheets Into Frames`
- **Meta description**（151 字符）：`Split pixel art sheets into individual frames with crisp edges and no anti-aliasing. Free, local, nothing uploaded. Works great before Aseprite import.`
- **H1**：`Pixel Art Sprite Splitter`
- **H2 提纲**：1. `Pixel art needs exact edges, not smoothing` / 2. `How we avoid resampling your pixels` / 3. `Preparing frames for Aseprite` / 4. `Frequently asked questions`
- **FAQ**：4 条
- **内链**：→ `/en`、`/en/split-sprite-sheet-into-individual-images`、`/en/blog/how-to-split-a-sprite-sheet`
- **优先级**：#6（像素画社区内容量小、转化率高）

### #7 ｜ `/en/split-image-into-multiple-images` — 落地页（通用场景，只打长尾）

- **主关键词**：`split image into multiple images`
- **Title**（49 字符）：`Split an Image Into Multiple Images Automatically`
- **Meta description**（146 字符）：`Split a collage, sticker sheet or scanned page into separate images automatically — no grid setup, no upload. Each element is detected on its own.`
- **H1**：`Split an Image Into Multiple Images`
- **H2 提纲**：1. `Grid splitting vs. automatic detection` / 2. `Splitting a collage into separate photos` / 3. `Splitting a sticker sheet` / 4. `Splitting a scanned page of multiple items` / 5. `Frequently asked questions`
- **FAQ**：5 条
- **内链**：→ `/en`、`/en/split-sprite-sheet-into-individual-images`、`/en/remove-white-background-from-sprite`
- **优先级**：#7（头部词被 Cloudinary / mate.tools 占着，**只打 "split collage"、"sticker sheet splitter"、"split scanned photo" 这类场景长尾**）

### #8 ｜ `/en/remove-white-background-from-sprite` — 落地页（定位受限，措辞谨慎）

- **主关键词**：`remove background from sprite`
- **Title**（49 字符）：`Remove a White Background From Sprites and Assets`
- **Meta description**（149 字符）：`Remove flat white or solid-colour backgrounds from sprites, stickers and product shots, right in your browser. Best on flat backgrounds — not photos.`
- **H1**：`Remove a White Background From a Sprite or Asset`
- **H2 提纲**：1. `What this tool is good at — and what it isn't` / 2. `How edge sampling and flood fill work` / 3. `Why flat backgrounds come out cleaner than photos` / 4. `Doing it in one pass: remove background, then split` / 5. `Frequently asked questions`
- **FAQ**：5 条（含 `Will this work on a real photo?` —— **诚实回答：不要**）
- **内链**：→ `/en`、`/en/split-sprite-sheet-into-individual-images`、`/en/blog/how-to-split-a-sprite-sheet`
- **优先级**：#8（**不抢 "remove background"**，只抢带限定语版本：from sprite / from game asset / from pixel art / solid color）

### #9 ｜ `/en/blog/how-to-split-a-sprite-sheet` — 指南

- **主关键词**：`how to split a sprite sheet` `*`
- **Title**（52 字符）：`How to Split a Sprite Sheet Into Frames (2026 Guide)`
- **Meta description**（155 字符）：`A step-by-step guide to splitting sprite sheets — grid-based cutters, automatic detection, tool choices for Godot, Unity and Aseprite, and common pitfalls.`
- **H1**：`How to Split a Sprite Sheet Into Individual Frames`
- **H2 提纲**：1. `First, figure out which kind of sheet you have`（规则网格 / 不规则排列 / 带透明间隔） / 2. `Option 1 — Grid-based cutting` / 3. `Option 2 — Automatic detection` / 4. `Option 3 — Engine-side slicing (Godot, Unity, Phaser)` / 5. `Preserving transparency and pixel edges` / 6. `Naming and organising the output` / 7. `Frequently asked questions`
- **FAQ**：4 条
- **JSON-LD**：`Article` + `FAQPage`
- **内链**：→ `/en`、`/en/split-sprite-sheet-into-individual-images`、`/en/texture-atlas-splitter`、`/en/godot-sprite-sheet-splitter`、`/en/unity-sprite-sheet-splitter`
- **优先级**：#9

### #10 ｜ `/en/blog/sprite-sheet-splitter-vs-photoshop-slice` — 对比页

- **主关键词**：`sprite sheet splitter vs photoshop` `*`
- **Title**（57 字符）：`Sprite Sheet Splitter vs. Photoshop Slice: Honest Compare`
- **Meta description**（144 字符）：`Photoshop's slice tool, grid-based online cutters, and automatic detection compared — with the cases where Photoshop is still the better answer.`
- **H1**：`Sprite Sheet Splitter vs. Photoshop's Slice Tool`
- **H2 提纲**：1. `What each tool actually does` / 2. `Photoshop slice: precise, but manual` / 3. `Grid-based online cutters: fast, but you must know the grid` / 4. `Automatic detection: fast and grid-free` / 5. `When Photoshop is still the right answer` / 6. `Verdict`
- **FAQ**：3 条
- **内链**：→ `/en`、`/en/split-sprite-sheet-into-individual-images`、`/en/blog/how-to-split-a-sprite-sheet`
- **优先级**：#10（含"规则网格用 ffmpeg `-vf tile` / ImageMagick `-crop` 更快"这类**对你不利的结论**——承认劣势的对比页转化率反而更高）

---

## 三、发布节奏（第 1–12 周）

- **第 1–2 周｜部署 + 索引**：两个站把仓库里的 prerender 改造部署上线，每站先发 3–4 页（工具页 + 2 个落地页 + 1 篇指南），**不要一次发 20 页**（新站突增页面会被当 spam）。检查：GSC 两站已验证、sitemap 状态"成功"（不是"无法读取"）、`site:` 查询各站至少 1 条结果、"已发现-尚未编入索引"堆积不超过 5 个 URL、以及 `curl -A "GPTBot" https://{domain}/en` **返回的 H1 是英文**。第 2 周仍未被索引 → 先查 canonical 和 hreflang（八成是 `/en` 的 canonical 指向了根路径）。
- **第 3–4 周｜首批曝光**：看索引与相关性判断是否成立。检查：两站合计**曝光 > 100**、GSC Queries 里出现**至少 3 个没有刻意优化的长尾查询**、平均排名 30–60、**有曝光的页面数 ≥ 8**、Cloudflare Web Analytics 里能看到自然搜索来源会话。曝光 < 20 → 页面太薄（< 600 词）或词太难，把落地页补到内容量基准。
- **第 5–8 周｜出现胜出页**：把资源压到胜出页上。检查：**> 50% 曝光集中在 2–3 个页面**、至少 1 页进前 20、点击 > 30；并每周手动在 ChatGPT / Perplexity 问一次 `best free tool to split a sprite sheet without uploading`，记录域名是否被引用（AI 引用的第一个信号）。**不要在没曝光的长尾页上继续投入**；日文页（3–4 页，人工翻译 + 本地化改写）在这一阶段上线。
- **第 9–12 周｜平台期与取舍**：检查：曝光 **1,000–3,000**、点击 **30–120**、平均排名 **15–25**、CTR **3%–6%**（< 3% 说明 title / meta 没写好，逐页改；> 8% 说明抢到了精准长尾）、至少 1 页稳定前 10、3–5 个自然外链。**决策：20 个页面里只有 3 个有曝光，就不要写第 21 页**——复用那 3 页的模式，或换一批词重新验证。第 12 周之后再做韩文。
- **埋点（Cloudflare Web Analytics 自定义事件，不要引入 GA4）**：`file_selected` / `extract_started` / `extract_completed` / `download_single` / `download_zip` / `bg_remove_used`（仅 imgcrop） / `language_switched` / `error_shown`。**看趋势和比例，不看绝对值**：采集脚本会被广告拦截器拦掉（受众拦截率高，数字必然低估），且未采样数据只保留 7 天——每周导出一次。不要埋滚动深度、停留时长、鼠标轨迹。

---

## 四、分发渠道（一行一条）

- **r/SideProject（~790K）**：侧边栏主动邀请自我推广、无反推广条款；唯一要求标题格式 `[Project name] - [Short description]`。**主战场**，直接发工具链接，明确求反馈。
- **r/software（~329K）**：**只在周三**发，用 `Self-Promotion Wednesdays` flair，且要 "provide something of value"；其他时间推广 = Permanent ban。
- **r/webdev（~3.3M）**：自我推广**只在周六（Showoff Saturday）**，其他日子发会被删；正文里绝不能出现商业话术或邮箱收集。
- **r/VideoEditing（~527K）**：教学帖**只在周二**，标题必须 `[Tutorial] NAME OF SOFTWARE`；用 `Open Source tool promo 🆓` flair；业余爱好者口吻，永远不要让人以为你在接活。
- **r/editors（~196K）**：同样走 `Open Source tool promo 🆓` flair；讲工作流而不是产品。
- **r/godot（~370K）**：**不用挑日子，加 `selfpromo (software)` flair 即可**（另一个可用 flair 是 `free plugin/tool`）；必须与 Godot 相关，不要用 discussion flair。游戏类里推广最宽松的版块。
- **r/opensource（~254K）**：前提是**真开源**（公开仓库 + OSI 许可）+ 一篇技术长文，配 `Promotional` flair。
- **r/coolgithubprojects（~58K）**：硬规则 **Github only**，标题 `[Desc] - [Suggested title]` → 发**仓库链接**，不是站点链接。
- **r/IMadeThis（~35K）**：`I made this` 框架，链接必需；imgcrop 的价值一眼看得懂，适合这里。
- **r/gamedev（~2.1M）**：**目前对工具推广是关闭状态，别去**（规则刚收紧、没有可用的推广机制）。要在游戏圈曝光，走 **r/godot**。
- **r/PixelArt（~2.69M）**：写明 "No Self-Promotion" —— **连评论里自我推广都禁止**，免费也不例外；另有 100 karma 发帖门槛。
- **r/InternetIsBeautiful（17M）**：只接受**单个独立域名的工具页 / 顶级域名**，明确**禁聚合站、禁需登录或留邮箱、禁扩展下载**。永远不要发"工具箱首页"——两个站各自独立域名正好符合。
- **其余关闭或极低频的版块**：r/indiegames（必须带游戏画面 GIF/截图，对开发工具没有入口）、r/IndieGaming（2 周只允许 1 帖）、r/Frugal（写死 "No exceptions"）、r/privacy（实质关闭，只在"浏览器本地处理"真正回答某个具体问题时带披露评论）。
- **Reddit 纪律**：**先贡献 3–4 周再发自建链接**（新号会被 Contributor Quality Score / reputation filter / Crowd Control **静默降权**，这是唯一现实路径）；**9:1 原则自 2017-05 起已不是全站强制执法**，降级为一般性建议，但 **Rule 2（Participate authentically）和 Spam 规则一直在执行**；一次只发一个版，必须披露作者身份，发帖前自己打开侧边栏读当天规则。
- **HN Show HN**：**是给"能上手玩的东西"的**（官方原文 "something you've made that other people can play with"），**博客文章属于明确 off-topic**，要走**普通提交**、不挂 Show HN 前缀；官方要求**免注册、免邮箱**；标题用原始标题不加修饰；**不要拉票**；**一个月最多一次**；新账号 / 新站点会被机制性降权，第一次别期待首页。
- **HN 技术长文 3 个选题**：`Parsing MP4 stss/stts tables to find real keyframes in the browser` / `Why fragmented MP4 breaks every browser-based video tool` / `Implementing flood-fill background removal that doesn't eat sprite edges`。
- **Product Hunt**：**2026 年上榜率约 4%（96% 不上榜）→ 按"没上榜"规划 = 100–500 访客**；它是**外链资产，不是增长引擎**。**自己 hunt，不要付钱找人代发**；上线时间 12:01am PST，可提前 1 个月预约；**不要叫任何人投票**（只能邀请访问和评论）；新账号要等 1 周；积分含评论等 meaningful engagement → **评论区运营比拉票重要**。imgcrop 打头阵（价值一眼看得懂），第一张图必须是 before/after，Pricing 选 free，页面别放 AdSense。
- **YouTube / TikTok**：视频标题就是关键词，描述第一行放工具 URL、第二行放 `Nothing is uploaded — it runs entirely in your browser.`；视频里必须**现场演示"断网也能用"**——竞品无法复制。
- **对比型内容（必做 1–2 篇）**：video-frame-extractor 的 `/en/blog/why-not-upload-video-to-online-converters`（讲上传式工具服务端到底发生了什么 + DevTools Network 自证法）；imgcrop 的选题已落在清单 #10。

---

## 五、风险红线

1. **隐私措辞不能被 DevTools 打脸。** ❌ 不能写 `We collect no data at all.`、`100% private, zero tracking.`、`Nothing leaves your device.` —— 页面上只要有任何第三方广告或统计脚本，前两句就不成立（HTTP 请求必然带 IP / UA / referer）。✅ 可以硬承诺的只有 `Your video is never uploaded.`、`All decoding and frame extraction happen in your browser.`、`You can verify it: load the page, then turn off your Wi-Fi. Extraction still works.`、`No account, no signup, no email.`。**hero 里不要写 "100% Private"**，写 `Your file never leaves your device`；隐私声明里要主动交代"基础设施仍会收到常规请求信息、广告伙伴可能设自己的 cookie"。另：**CMP cookie 同意横幅 + 两站各自的 `/privacy` 页（单独列出广告与第三方脚本）必须做**。
2. **不要在 Cloudflare 后台开启托管 robots.txt。** 默认会插入 `Disallow: /` 段，封掉 GPTBot / ClaudeBot / CCBot / Google-Extended / Applebot-Extended / Bytespider / Amazonbot / meta-externalagent，**等于关掉 AI 搜索引用**——头号竞品 frameextractor.net 已经中招（它的 robots.txt 里有完整的 `# BEGIN Cloudflare Managed content`）。也不要勾 `Display Content Signals Policy`；在仓库里维护显式 `Allow` 的 robots.txt，并加一个每天抓 `robots.txt`、出现 `Disallow: /` 就告警的监控。
3. **日韩页不要机翻。** encode64.com 那种批量机翻站是反面教材（程序化生成上千页 → "有 1000 个页面、0 个有排名"）。**宁可只有 4 个高质量日文页，也不要 20 个机器翻译页**；术语要本地化不要音译（日文 `フレーム抽出` / `スプライトシート分割`，韩文 `프레임 추출` / `스프라이트 시트 분할`），日文用户搜的是 `動画 フレーム 抽出 無料` 而不是英文词的字面翻译。
4. **Product Hunt 不要付钱找人代发**（官方：鼓励 maker 自己 hunt，用第三方 hunter 没有优势 → 会被下架、账号可能永久封禁）；也不要叫任何人投票，只能请人"访问并评论"。
5. **黑名单：不要打的词和不要做的事。** 不要打 `youtube frame extractor` / `download youtube video`（YouTube ToS 禁止下载，会污染整个域名的信任信号；要接这个流量就写成"用你自己导出的原片抽帧做封面"）；不要打 `remove background` / `background remover`（被 remove.bg / Canva / Adobe 垄断，且算法在真实照片上确实打不过 AI）；不要打 `video to gif` / `sprite sheet maker`（方向相反或不做）；**不要买外链、不要交低质目录站（"submit to 500 directories"）、不要用 AI 批量生成 100 个落地页、不要做 "free online tools" 聚合首页**（首页排到 40 名开外，单个工具页才是排名单位）。
6. **"Nothing is uploaded" 不是差异化，是入场券**（三个主要竞品都在喊同一句话），它是**信任凭证**：固定在 hero 下方一行 + FAQ 一条 + 隐私页，但别当主角。真正的差异化只有技术深度——video-frame-extractor 的 `stss` / `stts` 真解析 + fMP4 支持 + 全局时间区间约束，imgcrop 的不需要网格的自动识别 + 纯色背景去底。另外：**"关键帧表解析""fMP4 支持"上线前必须在 Chrome / Firefox / Safari 三端逐条实测并截图存档**，写在页面上却做不到是最快烧掉信任的方式。

---

## 六、来源链接

**竞品（SERP 现状与弱点）**
- [frameextractor.net](https://frameextractor.net/en)｜[robots.txt（已封 GPTBot / ClaudeBot / CCBot / Google-Extended，反面教材）](https://frameextractor.net/robots.txt)｜[sitemap](https://frameextractor.net/sitemap.xml)
- [frame-extractor.top](https://frame-extractor.top/)（无多语言，日韩市场空档）｜[sitemap](https://frame-extractor.top/sitemap.xml)
- [videoframe-extractor.com](https://videoframe-extractor.com/)（2GB 限制，WordPress 站）
- [123apps](https://123apps.com/)（上传式，隐私话题的最佳对比靶子）
- [Voidless Sprite Sheet Slicer](https://voidless.dev/tools/sprite-sheet-slicer/)｜[Cloudinary Image Splitter](https://cloudinary.com/tools/image-splitter)（都是网格切割）
- [encode64.com /ko sprite splitter](https://encode64.com/ko/design/sprite-sheet-splitter)（批量机翻反面教材）｜[BibiGPT /ja frame extractor](https://bibigpt.co/ja/features/free-online-video-frame-extractor)

**平台与搜索引擎官方文档**
- [Cloudflare：托管 robots.txt 默认封禁清单](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)（**风险红线 2 的出处**）
- [Cloudflare Pages：advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)｜[Pages redirects（重定向优先于静态资源）](https://developers.cloudflare.com/pages/configuration/redirects/)｜[Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Google：hreflang / 本地化版本（每页一个集群、必须互指）](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Cloudflare Web Analytics 数据指标（cookie-free）](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)｜[FAQ（采集脚本会被拦截器封掉）](https://developers.cloudflare.com/web-analytics/faq/)
- [Google 常用爬虫与 Google-Extended](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)｜[OpenAI bots（robots.txt 规则对用户触发的抓取可能不适用）](https://developers.openai.com/api/docs/bots)｜[Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)｜[CCBot](https://commoncrawl.org/ccbot)
- [Google Search Console 验证方式](https://support.google.com/webmasters/answer/9008080)｜[Bing：从 GSC 导入站点](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools)
- [Google 已移除 HowTo 富媒体结果（Search Engine Journal）](https://www.searchenginejournal.com/google-completely-removes-how-to-rich-results/496479/)

**社区规则**
- [HN：Show HN 规则（"能上手玩的东西"，博客走普通提交）](https://news.ycombinator.com/showhn.html)｜[HN Guidelines（不要修饰标题、不要拉票）](https://news.ycombinator.com/newsguidelines.html)｜[HN FAQ（新站点会被机制性降权）](https://news.ycombinator.com/newsfaq.html)
- [Reddit 官方帮助：Spam](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam)｜[Reddit Rules（Rule 2 - Participate authentically）](https://redditinc.com/policies/reddit-rules)｜[Reddiquette（9:1 的现行表述）](https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette)
- [Reddit 2017 年停止 9:1 全站执法（r/modnews 官方公告）](https://www.reddit.com/r/modnews/comments/6bj5de/state_of_spam/)
- [Contributor Quality Score](https://support.reddithelp.com/hc/en-us/articles/19023371170196-What-is-the-Contributor-Quality-Score)｜[Reputation filter](https://support.reddithelp.com/hc/en-us/articles/27441485903124-Reputation-filter)｜[Crowd Control](https://support.reddithelp.com/hc/en-us/articles/15484545006996-Crowd-Control)
- [Product Hunt Launch Guide（自己 hunt、不要叫人投票）](https://www.producthunt.com/launch)｜[Hunted.space Pulse（2026 上榜率 4%）](https://hunted.space/product-hunt-pulse)

**校准数据（节奏与量级依据）**
- [Toolkiya：97 个前端工具站上线 30 天真实 GSC 数据（本清单发布节奏的基准）](https://dev.to/vomayank/one-month-after-launching-toolkiya-97-free-browser-tools-real-gsc-numbers-what-worked-what-4205)
- [Playwire：广告拦截率 15–45%，科技与游戏垂类最高](https://www.playwire.com/blog/what-you-need-to-know-about-ad-blocking-rate)｜[Backlinko：全球广告拦截统计（日韩低于 20%）](https://backlinko.com/ad-blockers-users)
- [Publift：Google 不公布 AdSense 平均收入（工具站无公开 RPM 基准，只能当数量级）](https://www.publift.com/blog/best-adsense-niches)｜[Raptive 准入要求（多数流量须来自 US/CA/UK/AU/NZ）](https://raptive.com/rpm-guarantee/)

---

## 附录 A｜隐私文案素材（可直接粘贴）

**✅ 可以硬承诺的（原句照抄）**

- `Your video is never uploaded.`
- `All decoding and frame extraction happen in your browser.`
- `You can verify it: load the page, then turn off your Wi-Fi. Extraction still works.`
- `No account, no signup, no email.`
- `We don't upload your files to any server, and we don't store them.`

**❌ 不能写（页面上只要有任何第三方广告或统计脚本，前两条就不成立）**

- `We collect no data at all.` —— HTTP 请求必然带 IP、UA、referer。
- `100% private, zero tracking.`
- `Nothing leaves your device.` —— 视频没离开，但页面请求离开了。

**隐私声明模板（整段逐字粘贴）**
imgcrop 用时把 `video` / `extracted frames` 换成 `image` / `extracted sprites`，其余照抄。

> The video you select is read by browser APIs on your device. The application does not upload your video or your extracted frames to any server. Like any website, our infrastructure may still receive standard request information such as your IP address, browser user agent and the page you visited, and we use privacy-friendly analytics that do not set tracking cookies. This site is supported by advertising; our advertising partner may set its own cookies, which you can control in your browser or through the consent banner.

**"断网自证"入口（整段逐字粘贴，放隐私页和 FAQ）**
这条的价值远大于任何口号：它是可复现、可证伪的，而竞品的 "100% private" 不是。

> How to verify yourself: Open your browser's Developer Tools, switch to the Network tab, and drop in a video. You will see the page's own assets load — but no request containing your video file. You can also disconnect from the internet after the page loads; extraction will keep working.

- hero 统一写 `Your file never leaves your device`，**不要写 "100% Private"**——竞品 frame-extractor.top 就是那么写的，但页面顶上挂着 cookie 横幅，看起来很割裂。
- 合规硬要求（CMP cookie 同意横幅、两站各自的 `/privacy` 页）见上文「五、风险红线」第 1 条。

---

## 附录 B｜内容量基准与写作避坑

**内容量基准（每页写多少）**

| 页面类型 | 正文字数（英文词） | H2 数量 | 图片 | FAQ |
|---|---|---|---|---|
| 工具页 `/en` | 500–800 | 5–6 | 2–3 张真截图 | 5–6 条 |
| 落地页（关键词页） | 700–1,100 | 4–6 | 1–2 张 | 4–5 条 |
| 指南 `/en/blog/*` | 1,200–1,800 | 6–8 | 3–5 张 | 4 条 |
| 对比页 | 900–1,400 | 5–7 | 1 张对比表 | 3–4 条 |

**低于 600 词的落地页不要发**——低于这个量级你根本讲不清"为什么用你而不是竞品"，页面会退化成关键词堆。

**写作避坑 5 条（这类工具站最常翻车的地方）**

- **坑 1｜关键词堆砌**：❌ `Video frame extractor - extract frames from video online free, video to jpg, video to png, extract frames without ffmpeg...`；✅ 主关键词在 `<title>`、`<h1>`、首段、一个 H2 里各出现一次就够，全文自然密度 0.5%–1.5%。检测法：通读一遍，凡是读起来"像在念搜索框"的句子全删。
- **坑 2｜落地页与工具页重复内容（自我蚕食）**：硬规则是**每个落地页的首段必须完全不同**，且每页至少有一段只有这页才有（`mp4-to-jpg` 讲 JPG 质量参数，`extract-frames-by-time-range` 讲长视频内存问题）。自检：把两个落地页的首段并排贴出来，互换之后读者察觉不到，就是重复了。
- **坑 3｜机器翻译痕迹**：日韩页不能拿英文页机翻。典型破绽：日文混入英文语序、敬体（です・ます）和简体混用、韩文用错助词。硬规则：只翻工具页 + 3 个最高价值的落地页。术语要本地化、不要音译：日文 `フレーム抽出` / `動画から画像を抽出` / `スプライトシート分割`；韩文 `프레임 추출` / `스프라이트 시트 분할` / `이미지 자르기`。
- **坑 4｜"为什么不用 ffmpeg" 写成拉踩**：指南页必须**先给出真实命令** `ffmpeg -i in.mp4 -vf fps=1 out_%04d.png`，再讲浏览器工具的适用边界——先证明你懂，再讲你的优势。
- **坑 5｜把计划中的功能写成已经上线**：`stss`/`stts` 关键帧表解析、fMP4 支持这两个卖点，上线前必须逐条在 Chrome / Firefox / Safari 三端实测并截图存档。写在页面上却做不到，是最快烧掉信任的方式。

---

## 附录 C｜广告位与收入规则

**广告位（三条硬规则）**

- **首屏不放广告。** 工具站的用户是"带着任务来的"，首屏广告会显著提高跳出率，而跳出率对排名的影响远大于那点 CTR。
- **全站只放两处**：① 工具区**下方**（用户完成操作之后）；② 长文页面的正文中段。
- **上线前 30 天不挂广告**：先让 Google 把页面收录、确认 Core Web Vitals 正常，再上广告脚本（广告脚本对 LCP 的影响是实实在在的）。
- imgcrop 的 `ads.txt` 已删除：它是「授权卖方」声明，接 AdSense / AdX 时再加回来，Adsterra 这类网络不要求它。另外 **Product Hunt 落地页上不要放广告**（会让访问者觉得你是来套流量变现的）。

**度量口径（决定你该盯哪个数字）**

- 官方公式：`RPM = (Estimated earnings / Number of page views) * 1000`。
- Google 正在退役 session 相关指标 —— 原话 "We'll be retiring session-related metrics in AdSense from September 2025." → **一律用「页面 RPM」（page RPM），不要追 Ad session RPM**，否则第 6 个月会发现历史数据没法比。
- 收入公式：`月收入 ≈ 月页面浏览量 ÷ 1000 × 页面 RPM`。

**收入预期（原文限定语必须一起保留）**

> 先说清楚定位：**下面是行业经验区间，不是承诺，也不是预测。** 你的实际收入取决于流量结构、广告位、季节性和 AdSense 的不可预测性——2025 年就发生过出版商集体报告收入突然下滑的事件。

| 场景 | 月 PV | 假设页面 RPM | 月收入区间（USD） |
|---|---|---|---|
| 第 90 天（现实） | 1,000 – 5,000 | $1 – $4 | **$1 – $20** |
| 第 6 个月（顺利） | 15,000 – 50,000 | $1.5 – $5 | **$20 – $250** |
| 第 12 个月（很顺利） | 80,000 – 250,000 | $2 – $6 | **$150 – $1,500** |

- **表里的 RPM 是推算，不是引用**：主要出版商的公开资料里 "tools / utilities" **不是一个被公开统计的广告垂类**，没有任何一家给出过它的 RPM 区间。唯一可引用的锚点是 Publift 原话："Google does not provide any information on estimated AdSense earning per 1,000 views. Several publishers have anecdotally reported AdSense paying between $8 and $20 for 1,000 views." —— 这是**跨行业的"道听途说区间"**，不区分垂类、不区分地域，**它的下限比你实际能拿到的要高**。
- 还有一个会继续压低数字的结构性事实：你的受众（隐私敏感 + 科技 / 游戏垂类）**广告拦截率 15–45%**，按中位估算**约 30% 的页面浏览不会产生任何广告收入**，而且同一批人也不会被 Cloudflare Web Analytics 统计到。这是定位的必然代价，不是可以优化掉的问题。
- **结论：这两个站短期内不会成为收入来源，它们的价值是"零运维成本的自有流量资产 + 技术信誉"。** 想靠它赚钱，唯一的路是用那 20 个页面把免费流量的规模做起来，而不是在 5 个页面上抠 RPM。

---

## 附录 D｜完整关键词词表（写页面的原材料）

> 每簇 10–15 个词，全部已在 SERP 上核实过：不是被 Adobe / Cloudinary / remove.bg 这类大厂工具页整片垄断的词。每页的**主关键词已在页面清单里指定**，这里是扩展词、内链锚文本、FAQ 措辞的备选池。

**video-frame-extractor**

- **簇 A｜核心工具意图（工具型）→ 目标页 `/en`**（14 词）：`video frame extractor` · `extract frames from video` · `extract frames from video online` · `video frame extractor online free` · `frame grabber online` · `video to frames` · `extract still images from video` · `grab frame from video online` · `video screenshot tool online` · `pull frames from video` · `free frame extractor no signup` · `online frame extractor no watermark` · `convert video to images online` · `browser based frame extractor`
- **簇 B｜关键帧 / 容器技术（格式型 + 工具型）→ 目标页 `/en/extract-keyframes-from-video`**（12 词）：`extract keyframes from video` · `video keyframe extractor` · `extract i-frames from mp4` · `mp4 keyframe extraction online` · `extract keyframes without ffmpeg` · `scene change detection video online` · `extract only keyframes from video` · `keyframe table stss` · `mp4 stss atom keyframe list` · `extract keyframes from mov` · `video keyframe extraction tool free` · `difference between keyframes and all frames`
- **簇 C｜格式长尾（格式型）→ 目标页 `/en/mp4-to-jpg`、`/en/mp4-to-png`、`/en/webm-to-png`、`/en/extract-frames-from-fragmented-mp4`**（15 词）：`mp4 to jpg` · `mp4 to png` · `mp4 to images` · `convert mp4 to jpg frames` · `mov to jpg` · `webm to png` · `webm to images` · `mkv to jpg frames` · `extract frames from obs recording` · `extract frames from mediarecorder webm` · `fragmented mp4 frame extraction` · `fmp4 extract frames` · `extract frames from av1 video` · `h265 mp4 to jpg browser` · `extract frames from screen recording`
- **簇 D｜时间维度工作流（工具型 + 教程型）→ 目标页 `/en/extract-frames-by-time-range`**（12 词）：`extract frames at specific timestamps` · `extract frame at exact time from video` · `extract frames from a time range` · `extract frames every second` · `extract frames every 5 seconds` · `extract 1 frame per second from video` · `extract frames at interval online` · `how to extract frames from a video` · `how to get a still frame from a video without blur` · `extract frames from a long video` · `batch extract frames from video` · `extract frames from a specific scene`
- **簇 E｜隐私 / 对比（对比型）→ 目标页 `/en/video-frame-extractor-without-upload`**（10 词）：`video frame extractor without upload` · `video frame extractor no upload` · `extract frames without uploading video` · `extract frames without ffmpeg` · `ffmpeg alternative for extracting frames` · `online ffmpeg frame extractor` · `is it safe to upload videos to online converters` · `extract frames from a private video safely` · `offline video frame extractor` · `video frame extractor that works offline`

**imgcrop**

- **簇 A｜精灵图核心（工具型）→ 目标页 `/en`**（14 词）：`sprite sheet splitter` · `sprite sheet cutter` · `split sprite sheet` · `split sprite sheet into individual images` · `sprite slicer online` · `slice sprite sheet online` · `sprite sheet separator` · `cut sprite sheet into frames` · `sprite sheet to individual png` · `online sprite cutter` · `split sprite sheet without photoshop` · `break a sprite sheet into frames` · `sprite sheet splitter free` · `split sprite sheet no upload`
- **簇 B｜贴图集 / 引擎生态（工具型 + 格式型）→ 目标页 `/en/texture-atlas-splitter`、`/en/godot-sprite-sheet-splitter`、`/en/unity-sprite-sheet-splitter`**（13 词）：`texture atlas splitter` · `unpack texture atlas` · `split texture atlas png` · `atlas to individual images` · `godot split sprite sheet` · `godot sprite sheet to individual frames` · `unity sprite sheet splitter` · `phaser texture atlas split` · `tileset splitter` · `game asset splitter` · `extract sprites from sprite sheet` · `sprite sheet to png frames` · `unpack sprite atlas from apk assets`
- **簇 C｜像素画 / 动画帧（工具型 + 教程型）→ 目标页 `/en/pixel-art-sprite-splitter`**（10 词）：`pixel art sprite splitter` · `pixel art sprite sheet cutter` · `sprite sheet to gif` · `sprite sheet to animation frames` · `extract animation frames from sprite sheet` · `aseprite import sprite sheet` · `sprite sheet frame extractor` · `pixel art asset extractor` · `split pixel art sheet into frames` · `convert sprite sheet to individual frames`
- **簇 D｜通用图片拆分 / 拼图（工具型）→ 目标页 `/en/split-image-into-multiple-images`**（11 词）：`split image into multiple images` · `split a collage into separate images` · `extract multiple images from one image` · `separate images from a collage online` · `image splitter online free` · `cut image into parts online` · `sticker sheet splitter` · `split sticker sheet into individual png` · `batch crop multiple objects from image` · `split scanned photo into multiple images` · `split image into tiles automatically`
- **簇 E｜纯色背景去底（工具型 + 对比型）→ 目标页 `/en/remove-white-background-from-sprite`**（10 词）：`remove white background from image online` · `remove solid color background from png` · `remove background from sprite` · `remove background from game asset` · `make sprite background transparent` · `remove background from pixel art` · `transparent background for stickers` · `remove background without uploading` · `remove background from logo flat color` · `remove background from product photo white background`

> 簇 E 的纪律：**不抢 `remove background`**（抢不到，且体验会输给 AI 抠图），只抢带限定语的版本——`from sprite` / `from game asset` / `from pixel art` / `solid color`。带限定语的词搜索量小一个量级，但意图精准十倍。

---

## 附录 E｜短视频选题（5 个，一行一条）

- `Extract the PERFECT thumbnail frame from any video (no upload)`｜YouTube + Shorts｜3–5 min｜用 timestamps 模式精确抓到一个表情帧，对比"暂停 + 截图"的模糊结果。
- `I split a sprite sheet into 40 PNGs in 10 seconds (no Photoshop)`｜YouTube Shorts + TikTok｜30–60 s｜拖入 → 自动识别 → ZIP 下载，**全程不剪辑，一镜到底**。
- `Turn off your WiFi, then extract frames from this video`｜Shorts + TikTok｜20–30 s｜**最强的差异化演示**：加载页面 → 断网 → 继续正常抽帧。这一条竞品无法复制。
- `Godot: sprite sheet → AnimatedSprite2D in 2 minutes`｜YouTube｜2–4 min｜从拆分到 Godot 导入设置的完整工作流。
- `How to split a sprite sheet when there's no grid`｜YouTube｜4–6 min｜先演示网格切割工具在不规则图上的失败，再演示自动识别。

**执行细则**：视频标题就是关键词；描述**第一行**放工具 URL，**第二行**放 `Nothing is uploaded — it runs entirely in your browser.`；缩略图用大字标题 + 前后对比，把 `NO UPLOAD` / `NO PHOTOSHOP` 做成角标；录屏时鼠标动慢一点，不要在视频里读菜单项。

---

## 附录 F｜规模化以后再做的技术项（第 12 周之后，别提前优化）

**P1 —— 有排名之后再动**

- **`_headers`（Cloudflare Pages）**：给 `/assets/*` 加 `Cache-Control: public, max-age=31536000, immutable`，HTML 用短缓存 —— 对 Core Web Vitals 有帮助，但**等有排名再做**，提前做只会多一个变量。
- **OG 图按 slug 批量生成**：落地页超过 20 个之后手工做图不划算，用 satori / resvg 在构建期生成（现在一张共用的 `public/og.png` 就够，见各自 README 的 og 卡片说明）。
- **图片优化**：抓帧类页面必然堆很多截图 —— 全转 WebP/AVIF，`width`/`height` 属性写死避免布局抖动，首屏图不要 `loading="lazy"`。
- **Related 内链自动化**：落地页之间的 Related 区块从手写改成按 tag 生成，避免漏链。
- **`llms.txt`**：成本极低、做了不亏，但**目前没有证据表明主流 AI 爬虫真的读它**——别指望它带来引用（Cloudflare 自己也有一份 `llms.txt` 可参考）。

**P2 —— 观察项，不要提前优化**

- **性能**：静态站 + Cloudflare CDN 的 LCP 天然就好；除非 GSC 的 Core Web Vitals 报告亮红，否则不要动。
- **外链**：不要买外链。工具站靠社群与内容自然获得链接就够了（见「四、分发渠道」）。

---

> **部署后必须验证**（该语言是否真的返回预渲染正文、canonical 是否自指、robots / sitemap 域名、AI 爬虫视角）不在本文重复——命令见 `video-frame-extractor/README.md` 与 `imgcrop/README.md` 的「部署后必须验证」一节。
