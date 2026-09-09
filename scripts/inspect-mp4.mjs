// scripts/inspect-mp4.mjs — 打印 MP4 的 box 结构（排查关键帧表用）
//   node scripts/inspect-mp4.mjs <video>

import { openAsBlob } from 'node:fs';
import { existsSync } from 'node:fs';

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'moof', 'traf', 'mvex', 'udta']);

function ascii(bytes, offset, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

async function listBoxes(blob, start, end) {
  const boxes = [];
  let pos = start;
  while (pos + 8 <= end) {
    const head = new Uint8Array(await blob.slice(pos, Math.min(pos + 16, end)).arrayBuffer());
    if (head.byteLength < 8) break;
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let size = view.getUint32(0);
    const type = ascii(head, 4, 4);
    let headerSize = 8;
    if (size === 1) {
      size = view.getUint32(8) * 4294967296 + view.getUint32(12);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) size = end - pos;
    boxes.push({ type, size, dataStart: pos + headerSize, end: pos + size });
    pos += size;
  }
  return boxes;
}

async function walk(blob, start, end, depth = 0) {
  const boxes = await listBoxes(blob, start, end);
  for (const box of boxes) {
    console.log(`${'  '.repeat(depth)}${box.type} size=${box.size}`);
    if (CONTAINERS.has(box.type) && depth < 6) {
      await walk(blob, box.dataStart, box.end, depth + 1);
    }
  }
  return boxes;
}

const target = process.argv[2];
if (!target || !existsSync(target)) {
  console.error('用法：node scripts/inspect-mp4.mjs <video 路径>');
  process.exit(1);
}

const blob = await openAsBlob(target);
console.log(`文件：${target}（${blob.size} 字节）\n`);
await walk(blob, 0, blob.size);
