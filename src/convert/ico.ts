import { Buffer } from "node:buffer";

export interface IconImage {
  size: number;
  png: Buffer;
}

const headerSize = 6;
const entrySize = 16;

export function writeIco(images: IconImage[]): Buffer {
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize + entrySize * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size % 256, 0);
    entry.writeUInt8(size % 256, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}
