import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import path from "node:path";

function bytes(...parts: (string | number[] | Buffer)[]): Buffer {
  return Buffer.concat(
    parts.map((part) =>
      typeof part === "string"
        ? Buffer.from(part, "latin1")
        : Buffer.from(part),
    ),
  );
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

function fileTypeBox(brand: string): Buffer {
  return bytes(uint32(24), "ftyp", brand, uint32(0), brand, "mif1");
}

function ebml(docType: string): Buffer {
  return bytes(
    [0x1a, 0x45, 0xdf, 0xa3, 0x9b + docType.length],
    [0x42, 0x86, 0x81, 1, 0x42, 0xf7, 0x81, 1, 0x42, 0xf2, 0x81, 4],
    [0x42, 0xf3, 0x81, 8, 0x42, 0x82, 0x80 + docType.length],
    docType,
    [0x42, 0x87, 0x81, 4, 0x42, 0x85, 0x81, 2],
  );
}

const png = bytes(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  uint32(13),
  "IHDR",
  uint32(1),
  uint32(1),
  [8, 6, 0, 0, 0],
  uint32(0),
);

export const sampleHeaders: Record<string, Buffer> = {
  jpg: bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16], "JFIF\0", [1, 1, 0, 0, 1, 0, 1]),
  png,
  apng: bytes(png, uint32(8), "acTL", uint32(1), uint32(0), uint32(0)),
  webp: bytes("RIFF", [30, 0, 0, 0], "WEBPVP8 ", [0, 0, 0, 0]),
  avif: fileTypeBox("avif"),
  gif: bytes("GIF89a", [1, 0, 1, 0, 0, 0, 0]),
  tiff: bytes("II*\0", [8, 0, 0, 0], Buffer.alloc(8)),
  bmp: bytes("BM", Buffer.alloc(52)),
  ico: bytes([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 22, 0]),
  heic: fileTypeBox("heic"),
  pdf: bytes("%PDF-1.7\n"),
  mov: bytes(uint32(20), "ftypqt  ", uint32(0), "qt  "),
  mkv: ebml("matroska"),
  avi: bytes("RIFF", [0, 0, 0, 0], "AVI LIST", Buffer.alloc(8)),
  webm: ebml("webm"),
  m4v: bytes(uint32(20), "ftypM4V ", uint32(0), "M4V "),
  mp4: bytes(uint32(20), "ftypisom", uint32(0), "isom"),
  svg: bytes(
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
  ),
};

export function writeSample(folder: string, name: string, format: string) {
  const file = path.join(folder, name);
  writeFileSync(file, sampleHeaders[format] ?? "");
  return file;
}
