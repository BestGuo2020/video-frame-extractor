// src/seo-pages.js — 多语言 SEO 配置的单一来源
//
// 以前这些文案散在 public/_worker.js 里，由 Cloudflare 边缘运行时改写 meta；现在改成
// 构建期预渲染（scripts/prerender.mjs），配置必须放在构建脚本能直接 import 的地方。
// 放在 src/ 下是因为这里的语言/路径映射与 src/i18n.js 是同一套概念；它只被 scripts/ 引用，
// src/main.js 不 import 它，所以不会进入浏览器 bundle。
//
// 文案来源分工：页面正文来自 src/i18n.js（messages），只有 head 里的 SEO 文案在这里，
// 因为它们是给搜索引擎/社交平台看的，与页面上显示的措辞并不逐字相同。

export const SITE_ORIGIN = 'https://frame-extractor.guoguo-labs.online';

// 根路径统一带结尾斜杠：canonical / og:url / hreflang / sitemap 四处写法必须完全一致，
// 否则 https://x 与 https://x/ 会被当成两个网址，白白分散权重。
export function pageUrl(pathname) {
  return pathname === '/' ? `${SITE_ORIGIN}/` : SITE_ORIGIN + pathname;
}

// 五条 hreflang：四份 HTML 里必须逐字一致，由 prerender 统一生成。
// x-default 指向英文版——这个工具出海，默认给非中文用户看英文。
export const HREFLANG = [
  { hreflang: 'zh-CN', path: '/' },
  { hreflang: 'en', path: '/en' },
  { hreflang: 'ja', path: '/ja' },
  { hreflang: 'ko', path: '/ko' },
  { hreflang: 'x-default', path: '/en' },
];

// og:image 由 tools/og-card.html 渲染截图得到（见 imgcrop/tools/og-card.html 顶部对尺寸的说明）：
// 无头浏览器视口固定 1280×720，仓库不引入裁图依赖，所以卡片就取这个尺寸。
// 16:9 在按 1.91:1 展示时上下各裁约 25px，而正文距边缘 84px，裁不到内容；
// 声明值必须与文件真实尺寸一致，否则平台会不渲染这张卡片。
export const OG_IMAGE = {
  url: `${SITE_ORIGIN}/og.png`,
  width: 1280,
  height: 720,
  alt: 'Video Frame Extractor',
};

// 与语言无关的 head 常量
export const SHARED_META = {
  robots: 'index,follow',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  // 免费工具，price 恒为 0；币种统一 USD（沿用退役前 _worker.js 的写法）
  priceCurrency: 'USD',
  browserRequirements:
    'Requires a modern browser with HTML5 video decoding (Chrome / Edge / Firefox / Safari)',
};

export const SEO_PAGES = {
  '/': {
    lang: 'zh',
    htmlLang: 'zh-CN',
    locale: 'zh_CN',
    title: '视频抽帧工具 - 在线按时间段/间隔提取视频画面 PNG JPG',
    description:
      '免费在线视频抽帧工具：加载本地视频，按帧数、间隔、关键帧、时间点或指定时间段提取画面，支持 PNG/JPG、4K/2K/1080p 分辨率与 ZIP 打包下载。全程浏览器本地处理，视频不上传。',
    keywords:
      '视频抽帧,视频帧提取,在线抽帧工具,按时间段抽帧,视频截图,关键帧提取,MP4抽帧,PNG导出,JPG导出,浏览器本地处理',
    ogTitle: '视频抽帧工具 - 在线按时间段/间隔提取视频画面',
    ogDesc:
      '加载本地视频，按帧数、间隔、关键帧、时间点或自定义时间段提取画面，导出 PNG/JPG 并打包 ZIP。浏览器本地处理，不上传视频。',
    twitterTitle: '视频抽帧工具 - 在线按时间段/间隔提取视频画面',
    twitterDesc: '本地视频抽帧：按帧数、间隔、关键帧、时间点或时间段提取，PNG/JPG 输出，支持 ZIP 打包下载。',
    schema: {
      appName: '视频抽帧工具',
      appDesc:
        '在浏览器中加载本地视频并按帧数、时间间隔、关键帧、时间点或自定义时间段提取画面，支持 PNG/JPG 输出与 ZIP 打包下载，视频无需上传。',
      featureList: [
        '按帧数均匀抽帧',
        '按时间间隔抽帧',
        '关键帧提取（MP4 容器关键帧表 / 画面变化检测）',
        '按时间点抽帧',
        '按自定义时间段抽帧',
        'PNG / JPG 输出与质量调节',
        '4K / 2K / 1080p / 720p / 480p 缩放',
        '候选帧多选与 ZIP 打包下载',
        '全程浏览器本地处理',
      ],
    },
  },

  '/en': {
    lang: 'en',
    htmlLang: 'en',
    locale: 'en_US',
    title: 'Video Frame Extractor - Extract Frames by Time Range, Interval or Keyframe',
    description:
      'Free online video frame extractor: load a local video and pull frames by count, interval, keyframes, timestamps or a custom time range. PNG/JPG output up to 4K, ZIP download. 100% in-browser, nothing uploaded.',
    keywords:
      'video frame extractor, extract frames from video, video to frames, keyframe extraction, online frame grabber, mp4 frame extract, video screenshot tool, time range frame extraction',
    ogTitle: 'Video Frame Extractor - Frames by Time Range & Keyframe',
    ogDesc:
      'Extract frames from a local video by count, interval, keyframes or timestamps — or just one time range. PNG/JPG + ZIP. Runs entirely in your browser.',
    schema: {
      appName: 'Video Frame Extractor',
      appDesc:
        'Load a local video in the browser and extract frames by count, interval, keyframes, timestamps or a custom time range. PNG/JPG output with ZIP download; the video is never uploaded.',
      featureList: [
        'Evenly spaced extraction by frame count',
        'Extraction at fixed time intervals',
        'Keyframe extraction (MP4 keyframe table / scene-change detection)',
        'Extraction by timestamp list',
        'Extraction within a custom time range',
        'PNG / JPG output with quality control',
        '4K / 2K / 1080p / 720p / 480p downscaling',
        'Multi-select frames and ZIP download',
        'Everything runs locally in the browser',
      ],
    },
  },

  '/ja': {
    lang: 'ja',
    htmlLang: 'ja',
    locale: 'ja_JP',
    title: '動画フレーム抽出ツール - 時間範囲/間隔/キーフレームで画像を抽出',
    description:
      '無料オンライン動画フレーム抽出ツール：ローカル動画を読み込み、フレーム数・間隔・キーフレーム・タイムコード・時間範囲で画像を抽出。PNG/JPG、最大4K、ZIP一括ダウンロード。すべてブラウザ内で処理し、動画はアップロードしません。',
    keywords:
      '動画 フレーム抽出, ビデオ フレーム 抜き出し, 動画 コマ送り キャプチャ, キーフレーム抽出, 動画 連写 切り出し, MP4 フレーム抽出, オンラインツール',
    ogTitle: '動画フレーム抽出ツール - 時間範囲・キーフレームで抽出',
    ogDesc:
      'ローカル動画からフレーム数・間隔・キーフレーム・タイムコード、または指定の時間範囲でフレームを抽出。PNG/JPG + ZIP。すべてブラウザ内で完結。',
    schema: {
      appName: '動画フレーム抽出ツール',
      appDesc:
        'ブラウザでローカル動画を読み込み、フレーム数・間隔・キーフレーム・タイムコード・カスタム時間範囲で画像を抽出。PNG/JPG 出力と ZIP 一括ダウンロードに対応し、動画はアップロードされません。',
      featureList: [
        'フレーム数指定の均等抽出',
        '一定間隔ごとの抽出',
        'キーフレーム抽出（MP4 キーフレームテーブル / 画面変化検出）',
        'タイムコード指定の抽出',
        'カスタム時間範囲内の抽出',
        'PNG / JPG 出力と品質調整',
        '4K / 2K / 1080p / 720p / 480p への縮小',
        'フレームの複数選択と ZIP 一括ダウンロード',
        'すべての処理はブラウザ内でローカルに完了',
      ],
    },
  },

  '/ko': {
    lang: 'ko',
    htmlLang: 'ko',
    locale: 'ko_KR',
    title: '동영상 프레임 추출 도구 - 시간 구간/간격/키프레임으로 이미지 추출',
    description:
      '무료 온라인 동영상 프레임 추출 도구: 로컬 동영상을 불러와 프레임 수·간격·키프레임·타임코드·시간 구간으로 이미지를 추출하세요. PNG/JPG, 최대 4K, ZIP 일괄 다운로드. 모든 처리는 브라우저에서 완료되며 동영상은 업로드되지 않습니다.',
    keywords:
      '동영상 프레임 추출, 비디오 프레임 뽑기, 동영상 이미지 추출, 키프레임 추출, MP4 프레임 추출, 동영상 캡처 도구, 온라인 도구',
    ogTitle: '동영상 프레임 추출 도구 - 시간 구간·키프레임 추출',
    ogDesc:
      '로컬 동영상에서 프레임 수·간격·키프레임·타임코드 또는 지정한 시간 구간으로 프레임을 추출하세요. PNG/JPG + ZIP. 모두 브라우저에서 처리됩니다.',
    schema: {
      appName: '동영상 프레임 추출 도구',
      appDesc:
        '브라우저에서 로컬 동영상을 불러와 프레임 수·간격·키프레임·타임코드·사용자 지정 시간 구간으로 이미지를 추출하세요. PNG/JPG 출력과 ZIP 일괄 다운로드를 지원하며 동영상은 업로드되지 않습니다.',
      featureList: [
        '프레임 수 지정 균등 추출',
        '일정 간격별 추출',
        '키프레임 추출(MP4 키프레임 테이블 / 화면 변화 감지)',
        '타임코드 지정 추출',
        '사용자 지정 시간 구간 내 추출',
        'PNG / JPG 출력 및 품질 조절',
        '4K / 2K / 1080p / 720p / 480p 축소',
        '프레임 다중 선택 및 ZIP 일괄 다운로드',
        '모든 처리는 브라우저에서 로컬로 완료',
      ],
    },
  },
};

// 页面在 dist/ 里的落点：Cloudflare Pages 对 /en 会直接返回 en/index.html，因此语言页写成目录 + index.html。
// 根路径复用 Vite 产出的 dist/index.html 本身（保持中文）。
export function outputFileFor(pathname) {
  return pathname === '/' ? 'index.html' : `${pathname.replace(/^\//, '')}/index.html`;
}
