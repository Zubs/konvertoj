import { Buffer } from "node:buffer";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import sharp, { type Sharp } from "sharp";

export const sharpFormats: Record<string, string> = {
  jpg: "jpeg",
  png: "png",
  webp: "webp",
  avif: "heif",
  gif: "gif",
  tiff: "tiff",
};

function encoded(image: Sharp, format: string): Sharp {
  return image.toFormat(format === "jpg" ? "jpeg" : (format as "png"));
}

export async function writeImage(
  folder: string,
  name: string,
  format: string,
  {
    width = 30,
    height = 20,
    colour = { r: 0, g: 128, b: 255, alpha: 1 },
  }: {
    width?: number;
    height?: number;
    colour?: { r: number; g: number; b: number; alpha: number };
  } = {},
): Promise<string> {
  const file = path.join(folder, name);
  await encoded(
    sharp({ create: { width, height, channels: 4, background: colour } }),
    format,
  ).toFile(file);
  return file;
}

function noise(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 7;
  for (let index = 0; index < pixels.length; index++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    pixels[index] = seed % 256;
  }
  return pixels;
}

export async function writeNoise(
  folder: string,
  name: string,
  format: string,
  width = 96,
  height = 64,
): Promise<string> {
  const file = path.join(folder, name);
  await encoded(
    sharp(noise(width, height), { raw: { width, height, channels: 3 } }),
    format,
  ).toFile(file);
  return file;
}

function frames(count: number, width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * count * 4);
  for (let index = 0; index < width * height * count; index++) {
    const frame = Math.floor(index / (width * height));
    pixels[index * 4 + (frame % 3)] = 255;
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

export async function writeAnimatedGif(
  folder: string,
  name: string,
  count = 3,
): Promise<string> {
  const file = path.join(folder, name);
  await sharp(frames(count, 12, 10), {
    raw: { width: 12, height: 10 * count, channels: 4, pageHeight: 10 },
  })
    .gif({ loop: 0, delay: Array(count).fill(100) })
    .toFile(file);
  return file;
}

export async function writeMultiPageTiff(
  folder: string,
  name: string,
): Promise<string> {
  const file = path.join(folder, name);
  await sharp(frames(3, 12, 10), {
    raw: { width: 12, height: 30, channels: 4, pageHeight: 10 },
  })
    .tiff()
    .toFile(file);
  return file;
}

export async function writeSidewaysJpg(
  folder: string,
  name: string,
): Promise<string> {
  const file = path.join(folder, name);
  await sharp({
    create: { width: 60, height: 40, channels: 3, background: "white" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toFile(file);
  return file;
}

export const p3Colour = { r: 0, g: 255, b: 0 };

export async function writeDisplayP3Png(
  folder: string,
  name: string,
): Promise<string> {
  const file = path.join(folder, name);
  await sharp({
    create: { width: 4, height: 4, channels: 3, background: p3Colour },
  })
    .withIccProfile("p3", { attach: true })
    .png()
    .toFile(file);
  return file;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

export function writeHugePng(folder: string, name: string): string {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(20000, 0);
  header.writeUInt32BE(20000, 4);
  header[8] = 8;
  header[9] = 2;
  const file = path.join(folder, name);
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(Buffer.alloc(16))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
  return file;
}

export function truncate(file: string): string {
  const contents = readFileSync(file);
  writeFileSync(file, contents.subarray(0, Math.floor(contents.length / 2)));
  return file;
}

export async function pixels(file: string) {
  const { data, info } = await sharp(file)
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}
