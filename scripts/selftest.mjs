// scripts/selftest.mjs — 核心库自检（Node 直跑，不依赖浏览器）
//
//   node scripts/selftest.mjs [可选：一个真实 MP4/MOV 路径，用于校验容器关键帧解析]
//
// 覆盖：时间码解析/格式化、提取计划（含时间段约束）、ZIP 打包、MP4 关键帧解析。

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { openAsBlob } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { formatBytes, formatTime, parseTime, parseTimeList, sanitizeName, timeStampForFile } from '../src/lib/format.js';
import { buildPlan, evenlySpaced, normalizeRange } from '../src/lib/plan.js';
import { createZip, crc32 } from '../src/lib/zip.js';
import { outputSize } from '../src/lib/extract.js';
import { readMp4Keyframes } from '../src/lib/keyframes.js';

let passed = 0;
let failed = 0;

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

function near(name, actual, expected, tolerance = 1e-6) {
  check(name, Math.abs(actual - expected) <= tolerance, `→ got ${actual}, want ≈ ${expected}`);
}

/* ---------------- format ---------------- */

console.log('\n[format]');
eq('formatTime 12.345', formatTime(12.345), '00:12.345');
eq('formatTime 3725.5', formatTime(3725.5), '01:02:05.500');
eq('formatTime 无毫秒', formatTime(65, { ms: false }), '01:05');
eq('formatTime 非法值', formatTime(NaN), '--:--');
eq('parseTime 纯秒', parseTime('12.5'), 12.5);
eq('parseTime mm:ss', parseTime('1:20'), 80);
eq('parseTime hh:mm:ss', parseTime('01:02:03.5'), 3723.5);
eq('parseTime 带单位', parseTime('1h2m3.5s'), 3723.5);
eq('parseTime 只有秒单位', parseTime('90s'), 90);
eq('parseTime 非法文本', parseTime('abc'), null);
eq('parseTime 残留字符', parseTime('12abc'), null);
eq('parseTime 负数', parseTime('-5'), null);
const list = parseTimeList('00:05, 12.5\n1:20  95');
check('parseTimeList 混合分隔符', JSON.stringify(list.times) === JSON.stringify([5, 12.5, 80, 95]), JSON.stringify(list.times));
eq('parseTimeList 记录非法项', parseTimeList('5, x, 10').invalid.length, 1);
eq('timeStampForFile', timeStampForFile(3725.5), '01-02-05-500');
eq('sanitizeName 去扩展名与非法字符', sanitizeName('我的 视频/v1?.mp4'), '我的_视频_v1');
eq('formatBytes', formatBytes(1536), '1.50 KB');

/* ---------------- plan ---------------- */

console.log('\n[plan]');
const base = { duration: 100, count: 4 };
let plan = buildPlan({ ...base, mode: 'count' });
eq('count 帧数', plan.times.length, 4);
near('count 首帧取段中点', plan.times[0], 12.5, 1e-9);
near('count 末帧取段中点', plan.times[3], 87.5, 1e-9);

plan = buildPlan({ ...base, mode: 'range', count: 5, range: { enabled: true, start: 20, end: 40 } });
eq('range 帧数', plan.times.length, 5);
near('range 区间内首帧', plan.times[0], 22, 1e-9);
near('range 区间内末帧', plan.times[4], 38, 1e-9);
check('range 全部落在区间内', plan.times.every((t) => t >= 20 && t <= 40), JSON.stringify(plan.times));

plan = buildPlan({ ...base, mode: 'count', count: 5, range: { enabled: true, start: 20, end: 40 } });
check('count 模式同样受区间约束', plan.times.every((t) => t >= 20 && t <= 40), JSON.stringify(plan.times));

plan = buildPlan({ duration: 100, mode: 'interval', interval: 25 });
check(
  'interval 时间点（含终点，终点钳到 duration-1ms）',
  JSON.stringify(plan.times.slice(0, 4)) === JSON.stringify([0, 25, 50, 75]) && Math.abs(plan.times[4] - 100) < 0.002,
  JSON.stringify(plan.times),
);

plan = buildPlan({ duration: 100, mode: 'interval', interval: 25, range: { enabled: true, start: 10, end: 60 } });
check('interval 受区间约束', JSON.stringify(plan.times) === JSON.stringify([10, 35, 60]), JSON.stringify(plan.times));

plan = buildPlan({ duration: 100, mode: 'keyframe', keyframeTimes: [5, 15, 25, 35], range: { enabled: true, start: 12, end: 30 } });
check('keyframe 过滤到区间', JSON.stringify(plan.times) === JSON.stringify([15, 25]), JSON.stringify(plan.times));

plan = buildPlan({ duration: 100, mode: 'timestamps', timestampsText: '00:05, 12.5, 1:20, 999, abc' });
check('timestamps 去重排序并丢弃越界', JSON.stringify(plan.times) === JSON.stringify([5, 12.5, 80]), JSON.stringify(plan.times));
check('timestamps 产生越界/非法警告', plan.warnings.some((w) => w.code === 'OUT_OF_RANGE') && plan.warnings.some((w) => w.code === 'INVALID_TIMESTAMPS'));

plan = buildPlan({ duration: 1000, mode: 'count', count: 1200 });
check('超量抽稀', plan.times.length <= 500 && plan.warnings.some((w) => w.code === 'TRUNCATED'), `${plan.times.length} 帧`);

plan = buildPlan({ duration: 100, mode: 'count', count: 4, range: { enabled: true, start: 80, end: 20 } });
check('区间非法时回退整段并告警', plan.warnings.some((w) => w.code === 'RANGE_INVALID') && plan.times[0] > 0, JSON.stringify(plan.times));

plan = buildPlan({ duration: 0, mode: 'count' });
eq('无时长时返回空计划', plan.times.length, 0);

plan = buildPlan({ duration: 10, mode: 'interval', interval: 0.02 });
check('interval 步长下限与上限截断生效', plan.times.length <= 500, `${plan.times.length} 帧`);

check('evenlySpaced 单帧取中点', Math.abs(evenlySpaced(0, 10, 1)[0] - 5) < 1e-9);
const norm = normalizeRange({ enabled: false, start: 1, end: 2 }, 100);
check('未启用区间 → 整段', norm.start === 0 && norm.end === 100 && norm.enabled === false);

/* ---------------- outputSize ---------------- */

console.log('\n[outputSize]');
check('原始尺寸不缩放', JSON.stringify(outputSize(1280, 720, 'original')) === JSON.stringify({ width: 1280, height: 720 }));
check('1080p 不放大', JSON.stringify(outputSize(1280, 720, '1080p')) === JSON.stringify({ width: 1280, height: 720 }));
check('4K 横屏缩放到 1920×1080', JSON.stringify(outputSize(3840, 2160, '1080p')) === JSON.stringify({ width: 1920, height: 1080 }));
check('竖屏按外接矩形缩放', JSON.stringify(outputSize(1080, 1920, '1080p')) === JSON.stringify({ width: 608, height: 1080 }));

/* ---------------- zip ---------------- */

console.log('\n[zip]');
eq('crc32 已知值', crc32(new TextEncoder().encode('123456789')), 0xcbf43926);

const dir = mkdtempSync(path.join(tmpdir(), 'fe-zip-'));
const fileA = Buffer.from('hello frame extractor\n'.repeat(20));
const fileB = Buffer.from([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);
const zipBlob = await createZip([
  { name: 'frame_00-00-01-000.png', blob: new Blob([fileA]) },
  { name: '中文名_00-00-02-500.jpg', blob: new Blob([fileB]) },
]);
const zipPath = path.join(dir, 'out.zip');
writeFileSync(zipPath, Buffer.from(await zipBlob.arrayBuffer()));
check('zip 非空', zipBlob.size > fileA.length + fileB.length);
console.log(`  info zip 输出：${zipPath} (${formatBytes(zipBlob.size)})`);

// 用系统自带的 tar（libarchive）独立校验 ZIP：列出条目并解包比对内容
try {
  const listing = execFileSync('tar', ['-tf', zipPath], { encoding: 'utf8' });
  // 注意：tar.exe 的列表输出走控制台代码页，中文名会乱码，这是终端编码问题而非 ZIP 问题；
  // 中文文件名由下面的实际解包路径校验（能读到文件即证明 UTF-8 名有效）。
  const entries = listing.split(/\r?\n/).filter(Boolean);
  check('zip 条目名（ASCII）', entries.includes('frame_00-00-01-000.png'), JSON.stringify(entries));
  const extractDir = path.join(dir, 'extracted');
  mkdirSync(extractDir, { recursive: true });
  execFileSync('tar', ['-xf', zipPath, '-C', extractDir]);
  check('zip 解包内容与源文件一致', readFileSync(path.join(extractDir, 'frame_00-00-01-000.png')).equals(fileA));
  check('zip 中文条目名（UTF-8 标志位 + 解包可读）', readFileSync(path.join(extractDir, '中文名_00-00-02-500.jpg')).equals(fileB));
} catch (error) {
  console.log(`  skip 系统 tar 不可用，跳过外部解包校验（${error.message.split('\n')[0]}）`);
}

// 直接校验 ZIP 结构：通用标志位 bit 11（UTF-8 文件名）与本地头字段
const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
const localFlags = zipBytes[6] | (zipBytes[7] << 8);
check('zip 本地头 UTF-8 标志位已置位', (localFlags & 0x0800) !== 0, `flags=0x${localFlags.toString(16)}`);
check('zip 本地头压缩方法为存储(0)', (zipBytes[8] | (zipBytes[9] << 8)) === 0);
check('zip 结束记录存在', String.fromCharCode(...zipBytes.slice(-22, -18)) === 'PK\x05\x06');

/* ---------------- MP4 关键帧（可选） ---------------- */

const videoPath = process.argv[2];
if (videoPath) {
  console.log('\n[mp4 keyframes]');
  if (!existsSync(videoPath)) {
    console.log(`  skip 找不到文件：${videoPath}`);
  } else {
    const blob = await openAsBlob(videoPath);
    const started = Date.now();
    const result = await readMp4Keyframes(blob);
    const elapsed = Date.now() - started;
    if (!result) {
      check('解析出关键帧表', false, '返回 null');
    } else {
      check('解析出关键帧表', true);
      console.log(`  info 关键帧 ${result.times.length} 个 / 总样本 ${result.samples} / timescale ${result.timescale} / 耗时 ${elapsed}ms`);
      check('时间点递增', result.times.every((t, i) => i === 0 || t > result.times[i - 1]));
      check('时间点非负且有限', result.times.every((t) => Number.isFinite(t) && t >= 0));
      check('关键帧数量少于总样本', result.times.length < result.samples);
      console.log(`  info 前 5 个关键帧：${result.times.slice(0, 5).map((t) => formatTime(t)).join(', ')}`);
      console.log(`  info 文件 md5：${createHash('md5').update(readFileSync(videoPath)).digest('hex').slice(0, 12)}`);
    }
  }
}

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed ? 1 : 0);
