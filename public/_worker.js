// Cloudflare Pages 多语言 Worker（机制与 imgcrop 项目一致）：
// 根路径 = 中文原版直接放行；/en /ja /ko 取根目录 index.html 作模板，
// 用 HTMLRewriter 按路径重写 <html lang>、SEO meta、canonical 与 JSON-LD。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. 各语言 SEO 配置包
    const translations = {
      '/en': {
        lang: 'en',
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

    const cleanPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    const config = translations[cleanPath];

    // 2. 静态资源（js/css/png…）或非语言路径（含根目录中文版、/zh）直接放行
    if (!config || path.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // 3. 取根目录 index.html 作模板
    const originalResponse = await env.ASSETS.fetch(new URL('/', request.url));
    const pageUrl = url.origin + cleanPath;

    // 4. HTMLRewriter 动态替换语言与 SEO 信息
    return new HTMLRewriter()
      .on('html', { element(e) { e.setAttribute('lang', config.lang); } })
      .on('title', { element(e) { e.setInnerContent(config.title); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute('content', config.description); } })
      .on('meta[name="keywords"]', { element(e) { e.setAttribute('content', config.keywords); } })
      .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', pageUrl); } })
      .on('meta[property="og:locale"]', { element(e) { e.setAttribute('content', config.locale); } })
      .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', pageUrl); } })
      .on('meta[property="og:site_name"]', { element(e) { e.setAttribute('content', config.schema.appName); } })
      .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', config.ogTitle); } })
      .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', config.ogDesc); } })
      .on('meta[name="twitter:title"]', { element(e) { e.setAttribute('content', config.ogTitle); } })
      .on('meta[name="twitter:description"]', { element(e) { e.setAttribute('content', config.ogDesc); } })

      // 5. JSON-LD：重写 WebApplication Schema
      .on('script#ld-app', {
        element(e) {
          const newJson = {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: config.schema.appName,
            url: pageUrl,
            description: config.schema.appDesc,
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'All',
            browserRequirements:
              'Requires a modern browser with HTML5 video decoding (Chrome / Edge / Firefox / Safari)',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: config.schema.featureList,
          };
          e.setInnerContent(JSON.stringify(newJson, null, 2), { html: true });
        },
      })
      // FAQPage 结构化数据只有中文版，语言路径下移除，避免出现与页面语言不一致的内容
      .on('script#ld-faq', { element(e) { e.remove(); } })

      .transform(originalResponse);
  },
};
