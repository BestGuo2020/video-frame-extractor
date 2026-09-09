// src/lib/plan.js — 把「提取模式 + 参数」翻译成具体要抓取的时间点列表
//
// 所有模式都受「时间段」约束：设置了区间后，只在该区间内取帧。
// 时间点均为视频播放时间（秒），已排序去重。

import { parseTimeList } from './format.js';

export const MODES = ['count', 'interval', 'keyframe', 'timestamps', 'range'];

/** 单次提取的默认建议上限（超出会等间隔抽稀） */
export const DEFAULT_MAX_FRAMES = 500;
/** 硬上限：再大浏览器内存会很吃力 */
export const HARD_MAX_FRAMES = 2000;

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * 归一化区间：无效（起止颠倒/超出时长）时回退为整段视频
 * @returns {{ start: number, end: number, enabled: boolean, valid: boolean }}
 */
export function normalizeRange(range, duration) {
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const wanted = Boolean(range?.enabled);
  const start = clamp(Number(range?.start ?? 0), 0, dur);
  const end = clamp(Number(range?.end ?? dur), 0, dur);
  if (!wanted || !(end - start > 1e-3)) {
    return { start: 0, end: dur, enabled: false, valid: wanted ? false : true };
  }
  return { start, end, enabled: true, valid: true };
}

/** 在区间内等分取 n 帧（取每段中点，避开首尾黑场） */
export function evenlySpaced(start, end, n) {
  const count = Math.max(1, Math.round(n));
  const span = end - start;
  if (!(span > 0)) return [start];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(start + (span * (i + 0.5)) / count);
  }
  return out;
}

/** 排序 + 去重（1ms 内视为同一帧） */
function dedupe(times) {
  const sorted = [...times].filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);
  const out = [];
  for (const t of sorted) {
    if (!out.length || t - out[out.length - 1] > 0.001) out.push(t);
  }
  return out;
}

/** 超量时等间隔抽稀，保持覆盖均匀 */
function thin(times, maxFrames) {
  if (times.length <= maxFrames) return { times, thinned: false };
  const step = Math.ceil(times.length / maxFrames);
  const kept = times.filter((_, i) => i % step === 0);
  return { times: kept, thinned: true };
}

/**
 * 生成提取计划
 * @param {object} options
 * @param {'count'|'interval'|'keyframe'|'timestamps'|'range'} options.mode
 * @param {number} options.duration 视频时长（秒）
 * @param {{enabled:boolean,start:number,end:number}} [options.range] 时间段约束
 * @param {number} [options.count] 帧数（count / range 模式）
 * @param {number} [options.interval] 间隔秒数（interval 模式）
 * @param {string} [options.timestampsText] 时间点文本（timestamps 模式）
 * @param {number[]} [options.keyframeTimes] 已检测到的关键帧时间（keyframe 模式）
 * @param {number} [options.maxFrames]
 * @returns {{ times:number[], scope:{start:number,end:number}, warnings:Array<{code:string,[k:string]:any}>, invalid:number }}
 */
export function buildPlan(options) {
  const {
    mode = 'count',
    duration = 0,
    range = null,
    count = 10,
    interval = 1,
    timestampsText = '',
    keyframeTimes = [],
    maxFrames = DEFAULT_MAX_FRAMES,
  } = options || {};

  const warnings = [];
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (!dur) {
    return { times: [], scope: { start: 0, end: 0 }, warnings: [{ code: 'NO_DURATION' }], invalid: 0 };
  }

  const normalized = normalizeRange(range, dur);
  if (range?.enabled && !normalized.valid) {
    warnings.push({ code: 'RANGE_INVALID' });
  }
  const scope = { start: normalized.start, end: normalized.end };
  const limit = clamp(Math.round(maxFrames) || DEFAULT_MAX_FRAMES, 1, HARD_MAX_FRAMES);

  let times = [];
  let invalid = 0;

  switch (mode) {
    case 'interval': {
      const step = clamp(Number(interval) || 1, 0.02, 3600);
      // 从区间起点开始，每隔 step 秒取一帧；终点恰好落在网格上时也包含
      for (let t = scope.start; t <= scope.end + 1e-6; t += step) {
        times.push(Math.min(t, scope.end));
      }
      break;
    }

    case 'keyframe': {
      const inScope = (keyframeTimes || []).filter(
        (t) => Number.isFinite(t) && t >= scope.start - 1e-6 && t <= scope.end + 1e-6,
      );
      times = inScope;
      if (!times.length) warnings.push({ code: 'KEYFRAME_EMPTY' });
      break;
    }

    case 'timestamps': {
      const parsed = parseTimeList(timestampsText);
      invalid = parsed.invalid.length;
      if (invalid) warnings.push({ code: 'INVALID_TIMESTAMPS', n: invalid });
      const kept = [];
      let outOfScope = 0;
      for (const t of parsed.times) {
        if (t > dur + 1e-3) {
          outOfScope += 1;
          continue;
        }
        if (normalized.enabled && (t < scope.start - 1e-3 || t > scope.end + 1e-3)) {
          outOfScope += 1;
          continue;
        }
        kept.push(t);
      }
      if (outOfScope) warnings.push({ code: 'OUT_OF_RANGE', n: outOfScope });
      times = kept;
      if (!times.length && !invalid) warnings.push({ code: 'NO_TIMES' });
      break;
    }

    case 'range':
    case 'count':
    default: {
      times = evenlySpaced(scope.start, scope.end, count);
      break;
    }
  }

  times = dedupe(times.map((t) => clamp(t, 0, Math.max(0, dur - 1e-3))));

  const { times: finalTimes, thinned } = thin(times, limit);
  if (thinned) {
    warnings.push({ code: 'TRUNCATED', n: finalTimes.length, from: times.length });
  }
  if (!finalTimes.length && !warnings.length) warnings.push({ code: 'NO_TIMES' });

  return { times: finalTimes, scope, warnings, invalid };
}
