# 视频抽帧工具 · Video Frame Extractor

浏览器内运行的本地视频抽帧工具。加载本地视频 → 按 **帧数 / 间隔 / 关键帧 / 时间点 / 时间段** 提取画面 → 导出 PNG / JPG 或打包成 ZIP。
**视频不上传**：解码、抽帧、打包全部在设备上完成。

参考同类站点（frameextractor.net）的功能后重做，并额外增加了**按时间段抽帧**：拖时间轴选区或直接输入起止时间码，所有模式都只在该区间内取帧。

---

## 快速开始

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5174
pnpm build        # 产物在 dist/，可直接发布
pnpm preview      # 本地预览生产构建
pnpm selftest     # 核心库自检（可选传入一个真实 MP4 路径校验关键帧解析）
```

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
| 隐私 | 全程本地处理，无接口调用、无上传、无广告追踪 |
| 多语言 | 中文 / English 切换（`localStorage` 记忆，URL 带 `/en` 时自动切英文） |

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

---

## 目录结构

```
video-frame-extractor/
├── index.html                 # SEO：标题/描述/OG/JSON-LD（WebApplication + FAQPage）
├── public/                    # 原样拷贝到 dist：robots.txt、sitemap.xml、_redirects
├── src/
│   ├── App.vue                # 顶层状态机：文件 → 元数据 → 计划 → 抽帧 → 下载
│   ├── i18n.js                # 中英双语文案
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
- `public/_redirects` 已配置单页回落；`robots.txt` / `sitemap.xml` 会被原样拷贝

**部署前把占位域名替换成真实域名**（当前占位：`https://frame-extractor.guoguo-labs.online`）：

- `index.html`（`canonical`、`og:url`、两处 JSON-LD 的 `url`）
- `public/robots.txt`（Sitemap 地址）
- `public/sitemap.xml`（两处 `loc` 与 hreflang）

```powershell
# 一次性替换（把 NEW-DOMAIN 换成真实域名）
Get-ChildItem index.html, public\robots.txt, public\sitemap.xml |
  ForEach-Object { (Get-Content $_ -Raw) -replace 'frame-extractor\.guoguo-labs\.online', 'NEW-DOMAIN' | Set-Content -NoNewline $_ }
```

---

## 限制与合理预期

- **能不能解码取决于浏览器**：H.264 MP4、WebM 通常没问题，H.265/HEVC 要看系统解码器；文件扩展名不能保证内部编码被支持。
- **抽帧不能凭空造细节**：压缩痕迹、低照度噪点、数字变焦和运动模糊都会原样保留；相邻几帧都发虚时，应挑动作停顿的瞬间，而不是放大导出尺寸。
- **内存**：每帧都会以 Blob + object URL 形式留在内存里。单次建议不超过 500 帧（超出会自动等间隔抽稀），长视频建议缩小分辨率或按时间段分批。
- **关键帧 ≠ 好构图**：编码关键帧服务于压缩结构，不一定是画面最清晰的那一帧。
- **画布受 CORS 限制**：本工具只读本地文件（blob URL），不涉及跨域取图，因此不会出现画布污染问题。

## 隐私

视频通过浏览器的本地 API 读取，解码与抽帧都在你的设备上完成；页面没有任何上传接口。只有你主动点击下载的图片或 ZIP 会离开浏览器。
