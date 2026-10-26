import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { decode as decodeBmp } from "bmp-ts";
import decodeIco from "decode-ico";
import sharp, { type Metadata, type Sharp } from "sharp";
import {
  damagedFile,
  isFileSystemError,
  isUserError,
  UserError,
} from "../errors.js";
import type { InputFile } from "../inputs.js";
import type { RunContext } from "../modes/registry.js";

export interface OpenedImage {
  image: Sharp;
  width: number;
  height: number;
  pages: number;
  metadata?: Metadata;
}

const largestDensity = 100000;
const screenDensity = 72;
const defaultSvgWidth = 512;
const svgStartTag = /<svg\b[^>]*>/i;
const viewBoxSize =
  /\sviewBox\s*=\s*["']\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i;
const realConsoleLog = console.log;
let quietDecodes = 0;

function fromPixels(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): OpenedImage {
  const data = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  return {
    image: sharp(data, { raw: { width, height, channels: 4 } }).withDensity(
      screenDensity,
    ),
    width,
    height,
    pages: 1,
  };
}

async function withoutConsoleLog<T>(work: () => Promise<T>): Promise<T> {
  quietDecodes++;
  console.log = () => {};
  try {
    return await work();
  } finally {
    quietDecodes--;
    if (quietDecodes === 0) {
      console.log = realConsoleLog;
    }
  }
}

async function openHeic(path: string): Promise<OpenedImage> {
  const { default: decode } = await import("heic-decode");
  const buffer = await readFile(path);
  const { width, height, data } = await withoutConsoleLog(() =>
    decode({ buffer }),
  );
  return fromPixels(data, width, height);
}

async function openBmp(path: string): Promise<OpenedImage> {
  const { width, height, data: abgr } = decodeBmp(await readFile(path));
  const rgba = Buffer.alloc(abgr.length);
  let alphaUsed = false;
  for (let index = 0; index < abgr.length; index += 4) {
    rgba[index] = abgr[index + 3] ?? 0;
    rgba[index + 1] = abgr[index + 2] ?? 0;
    rgba[index + 2] = abgr[index + 1] ?? 0;
    rgba[index + 3] = abgr[index] ?? 0;
    alphaUsed ||= abgr[index] !== 0;
  }
  if (!alphaUsed) {
    for (let index = 3; index < rgba.length; index += 4) {
      rgba[index] = 255;
    }
  }
  return fromPixels(rgba, width, height);
}

async function openIco(path: string): Promise<OpenedImage> {
  const [largest] = decodeIco(await readFile(path)).sort(
    (a, b) => b.width * b.height - a.width * a.height || b.bpp - a.bpp,
  );
  if (!largest) {
    throw damagedFile();
  }
  if (largest.type === "png") {
    return {
      image: sharp(Buffer.from(largest.data)),
      width: largest.width,
      height: largest.height,
      pages: 1,
    };
  }
  return fromPixels(largest.data, largest.width, largest.height);
}

function hasSvgLength(tag: string, name: string): boolean {
  return new RegExp(
    `\\s${name}\\s*=\\s*["']\\s*\\d*\\.?\\d+\\s*(px|pt|pc|mm|cm|in|em|ex)?\\s*["']`,
    "i",
  ).test(tag);
}

function wholeNumber(value: string | boolean | undefined): number | undefined {
  return typeof value === "string" ? Number(value) : undefined;
}

function withDefaultSize(markup: string, tag: string): string {
  const [, viewBoxWidth, viewBoxHeight] = viewBoxSize.exec(tag) ?? [];
  const height =
    viewBoxWidth && viewBoxHeight
      ? (defaultSvgWidth * Number(viewBoxHeight)) / Number(viewBoxWidth)
      : defaultSvgWidth;
  const sized = tag
    .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/^<svg/i, `<svg width="${defaultSvgWidth}" height="${height}"`);
  return markup.replace(tag, sized);
}

async function openSvg(
  path: string,
  options: RunContext["options"],
): Promise<OpenedImage> {
  const markup = await readFile(path, "utf8");
  const tag = svgStartTag.exec(markup)?.[0] ?? "";
  const hasOwnSize = hasSvgLength(tag, "width") && hasSvgLength(tag, "height");
  const buffer = Buffer.from(
    hasOwnSize || !tag ? markup : withDefaultSize(markup, tag),
  );
  const { width: naturalWidth = 1, height: naturalHeight = 1 } =
    await sharp(buffer).metadata();
  const wantedWidth = wholeNumber(options.width);
  const wantedHeight = wholeNumber(options.height);
  const scales = [
    wantedWidth === undefined ? undefined : wantedWidth / naturalWidth,
    wantedHeight === undefined ? undefined : wantedHeight / naturalHeight,
  ].filter((scale) => scale !== undefined);
  let scale = 1;
  if (scales.length > 0) {
    scale = Math.min(...scales);
  } else if (typeof options.dpi === "string") {
    scale = Number(options.dpi) / 72;
  }
  const density = 72 * scale;
  if (density > largestDensity) {
    throw new UserError(
      "would be too large to draw at that size. Choose a smaller --width, --height or --dpi.",
    );
  }
  let image = sharp(buffer, { density: Math.max(1, density) });
  if (wantedWidth !== undefined || wantedHeight !== undefined) {
    image = image.resize(wantedWidth, wantedHeight, { fit: "inside" });
  }
  return {
    image,
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
    pages: 1,
  };
}

async function openCore(path: string, animated: boolean): Promise<OpenedImage> {
  const metadata = await sharp(path, { limitInputPixels: false }).metadata();
  return {
    image: sharp(path, { animated, autoOrient: true }),
    width: metadata.width,
    height: metadata.height,
    pages: metadata.pages ?? 1,
    metadata,
  };
}

export async function openImage(
  input: InputFile,
  options: RunContext["options"],
  animated: boolean,
): Promise<OpenedImage> {
  try {
    switch (input.format) {
      case "heic":
        return await openHeic(input.path);
      case "bmp":
        return await openBmp(input.path);
      case "ico":
        return await openIco(input.path);
      case "svg":
        return await openSvg(input.path, options);
      default:
        return await openCore(input.path, animated);
    }
  } catch (error) {
    if (isUserError(error) || isFileSystemError(error)) {
      throw error;
    }
    throw damagedFile(error);
  }
}
