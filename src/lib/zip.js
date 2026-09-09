// src/lib/zip.js — 无依赖 ZIP 打包（仅 STORE，不压缩）
//
// PNG/JPG 本身已压缩，再套一层 deflate 收益极小，因此直接用「存储」方式：
// 实现简单、速度最快、也不需要引入 JSZip 之类的依赖。
// 文件名用 UTF-8 编码并置位通用标志位 bit 11，中文名在各系统都能正确解压。

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP32 单文件/总量上限 */
export const ZIP_LIMIT_BYTES = 4 * 1024 * 1024 * 1024 - 1;
const MAX_ENTRIES = 65535;

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * 打包为 ZIP Blob
 * @param {Array<{name:string, blob:Blob}>} files
 * @param {{ onProgress?: (done:number,total:number,name:string)=>void, signal?:AbortSignal }} [opts]
 * @returns {Promise<Blob>}
 */
export async function createZip(files, opts = {}) {
  const { onProgress, signal } = opts;
  const encoder = new TextEncoder();
  const parts = [];
  const entries = [];
  const { time: dosTime, day: dosDate } = dosDateTime();
  let offset = 0;
  let index = 0;

  if (files.length > MAX_ENTRIES) throw new Error('ZIP_TOO_MANY_ENTRIES');

  for (const file of files) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const nameBytes = encoder.encode(file.name);
    // 需要 CRC 与长度，所以这里必须读一次字节；读完后立刻释放，峰值内存只多一份当前文件
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(bytes);
    const size = bytes.length;

    if (size > ZIP_LIMIT_BYTES || offset + 30 + nameBytes.length + size > ZIP_LIMIT_BYTES) {
      throw new Error('ZIP_TOO_LARGE');
    }

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // 本地文件头签名
    local.setUint16(4, 20, true); // 解压所需版本
    local.setUint16(6, 0x0800, true); // bit 11：文件名为 UTF-8
    local.setUint16(8, 0, true); // 压缩方法：0 = 存储
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true); // 压缩后大小
    local.setUint32(22, size, true); // 原始大小
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // 扩展字段长度

    parts.push(new Uint8Array(local.buffer), nameBytes, file.blob);
    entries.push({ nameBytes, crc, size, offset });
    offset += 30 + nameBytes.length + size;

    index += 1;
    onProgress?.(index, files.length, file.name);
    // 让出主线程，避免大文件时界面卡死
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const centralStart = offset;
  for (const entry of entries) {
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true); // 中央目录项签名
    head.setUint16(4, 20, true); // 创建版本
    head.setUint16(6, 20, true); // 解压所需版本
    head.setUint16(8, 0x0800, true); // UTF-8 标志
    head.setUint16(10, 0, true); // 存储
    head.setUint16(12, dosTime, true);
    head.setUint16(14, dosDate, true);
    head.setUint32(16, entry.crc, true);
    head.setUint32(20, entry.size, true);
    head.setUint32(24, entry.size, true);
    head.setUint16(28, entry.nameBytes.length, true);
    head.setUint16(30, 0, true); // 扩展字段
    head.setUint16(32, 0, true); // 注释
    head.setUint16(34, 0, true); // 起始磁盘号
    head.setUint16(36, 0, true); // 内部属性
    head.setUint32(38, 0, true); // 外部属性
    head.setUint32(42, entry.offset, true); // 本地头偏移
    parts.push(new Uint8Array(head.buffer), entry.nameBytes);
    offset += 46 + entry.nameBytes.length;
  }

  const centralSize = offset - centralStart;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); // 中央目录结束记录
  eocd.setUint16(4, 0, true); // 当前磁盘号
  eocd.setUint16(6, 0, true); // 中央目录起始磁盘号
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralStart, true);
  eocd.setUint16(20, 0, true); // 注释长度
  parts.push(new Uint8Array(eocd.buffer));

  return new Blob(parts, { type: 'application/zip' });
}
