// src/lib/format.js — 时间码 / 文件大小 / 文件名的格式化与解析

/** 补零 */
export function pad(value, length = 2) {
  return String(Math.abs(Math.trunc(value))).padStart(length, '0');
}

/**
 * 秒 → 时间码
 * @param {number} seconds
 * @param {{ ms?: boolean, forceHours?: boolean }} [opts]
 */
export function formatTime(seconds, opts = {}) {
  const { ms = true, forceHours = false } = opts;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '--:--';

  const totalMs = Math.round(value * 1000);
  const msPart = totalMs % 1000;
  const totalSec = (totalMs - msPart) / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const head = h > 0 || forceHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return ms ? `${head}.${pad(msPart, 3)}` : head;
}

/** 秒 → 简短时长（00:12 / 01:02:03） */
export function formatDuration(seconds) {
  return formatTime(seconds, { ms: false });
}

/**
 * 解析用户输入的时间码，支持：
 *   12 / 12.5            纯秒
 *   1:20 / 01:02:03.5    冒号分隔
 *   1h2m3.5s / 90s / 1m30s  带单位
 * @returns {number|null} 秒，无法解析时返回 null
 */
export function parseTime(input) {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? input : null;
  }
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  if (!raw.includes(':') && /[hms]/i.test(raw)) {
    const re = /(\d+(?:\.\d+)?)\s*(h|m|s)/gi;
    let total = 0;
    let matched = false;
    let m;
    while ((m = re.exec(raw))) {
      matched = true;
      const unit = m[2].toLowerCase();
      const factor = unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
      total += Number(m[1]) * factor;
    }
    if (!matched) return null;
    // 去掉已匹配部分后必须没有残留字符，避免 "12abc" 被当成 12
    if (raw.replace(re, '').trim() !== '') return null;
    return total;
  }

  const parts = raw.split(':');
  if (parts.length > 3) return null;
  let total = 0;
  for (const part of parts) {
    const piece = part.trim();
    if (!/^\d+(\.\d+)?$/.test(piece)) return null;
    total = total * 60 + Number(piece);
  }
  return Number.isFinite(total) ? total : null;
}

/** 解析多行/逗号分隔的时间点列表 */
export function parseTimeList(text) {
  const tokens = String(text ?? '')
    .split(/[\s,，;；、]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const times = [];
  const invalid = [];
  for (const token of tokens) {
    const value = parseTime(token);
    if (value === null) invalid.push(token);
    else times.push(value);
  }
  return { times, invalid };
}

/** 字节 → 人类可读 */
export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[i]}`;
}

/** 秒 → 可安全用于文件名的片段：00-12-345 */
export function timeStampForFile(seconds) {
  const totalMs = Math.round(Math.max(0, Number(seconds) || 0) * 1000);
  const msPart = totalMs % 1000;
  const totalSec = (totalMs - msPart) / 1000;
  return `${pad(Math.floor(totalSec / 3600))}-${pad(Math.floor((totalSec % 3600) / 60))}-${pad(
    totalSec % 60,
  )}-${pad(msPart, 3)}`;
}

/** 去掉文件名里不适合作为导出名的字符 */
export function sanitizeName(name, fallback = 'video') {
  const base = String(name ?? '')
    .replace(/\.[^./\\]+$/, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return base || fallback;
}
