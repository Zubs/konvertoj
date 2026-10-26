import { Buffer } from "node:buffer";
import type { Exif } from "sharp";
import { damagedFile } from "../errors.js";
import type { InputFile } from "../inputs.js";
import type { OpenedImage } from "./decode.js";

export interface Details {
  present: boolean;
  hasExif: boolean;
  damaged: boolean;
  heicExif?: Exif;
}

const exifPrefix = Buffer.from("Exif\0\0", "latin1");
const iccProfileName = Buffer.from("ICC_PROFILE\0", "latin1");
const detailMarkers = [0xe1, 0xed, 0xfe];
const appTwoMarker = 0xe2;
const scanMarker = 0xda;
const endMarker = 0xd9;

type ExifrResult = Record<string, unknown> | undefined;

async function parseWithExifr(
  data: string | Buffer,
  options: Record<string, boolean>,
): Promise<{ result: ExifrResult; damaged: boolean }> {
  const { default: exifr } = await import("exifr");
  try {
    const result = (await exifr.parse(data, options)) as ExifrResult;
    const keys = Object.keys(result ?? {});
    const damaged =
      result !== undefined &&
      (keys.includes("errors") || keys.every((key) => key === "errors"));
    return { result, damaged };
  } catch {
    return { result: undefined, damaged: true };
  }
}

function rationals(values: unknown): string | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }
  return values
    .map((value) => `${Math.round(Number(value) * 10000)}/10000`)
    .join(" ");
}

function onlyText(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

async function heicDetails(path: string): Promise<Details> {
  const { result, damaged } = await parseWithExifr(path, {
    tiff: true,
    exif: true,
    gps: true,
    reviveValues: false,
    translateValues: false,
  });
  if (!result || damaged) {
    return { present: damaged, hasExif: damaged, damaged };
  }
  return {
    present: true,
    hasExif: true,
    damaged: false,
    heicExif: {
      IFD0: onlyText({
        Make: result.Make,
        Model: result.Model,
        Orientation: "1",
      }),
      IFD2: onlyText({
        DateTimeOriginal: result.DateTimeOriginal,
        LensModel: result.LensModel,
      }),
      IFD3: onlyText({
        GPSLatitudeRef: result.GPSLatitudeRef,
        GPSLatitude: rationals(result.GPSLatitude),
        GPSLongitudeRef: result.GPSLongitudeRef,
        GPSLongitude: rationals(result.GPSLongitude),
      }),
    },
  };
}

export async function readDetails(
  input: InputFile,
  opened: OpenedImage,
): Promise<Details> {
  if (input.format === "heic") {
    return heicDetails(input.path);
  }
  const { exif, xmp, iptc } = opened.metadata ?? {};
  const present = Boolean(exif || xmp || iptc);
  if (!exif) {
    return { present, hasExif: false, damaged: false };
  }
  const tiffData = exif.subarray(0, 6).equals(exifPrefix)
    ? exif.subarray(6)
    : exif;
  const { result, damaged } = await parseWithExifr(tiffData, {});
  return { present, hasExif: true, damaged: damaged || result === undefined };
}

function isDetailSegment(marker: number, segment: Buffer): boolean {
  if (detailMarkers.includes(marker)) {
    return true;
  }
  return (
    marker === appTwoMarker &&
    !segment.subarray(4, 4 + iccProfileName.length).equals(iccProfileName)
  );
}

function endOfScan(jpeg: Buffer, start: number): number {
  for (let position = start; position < jpeg.length - 1; position++) {
    const next = jpeg[position + 1] ?? 0;
    if (
      jpeg[position] === 0xff &&
      next !== 0x00 &&
      !(next >= 0xd0 && next <= 0xd7)
    ) {
      return position;
    }
  }
  throw damagedFile();
}

export function removeJpegDetails(jpeg: Buffer): Buffer {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw damagedFile();
  }
  const kept: Buffer[] = [jpeg.subarray(0, 2)];
  let position = 2;
  for (;;) {
    if (jpeg[position] !== 0xff) {
      throw damagedFile();
    }
    while (jpeg[position + 1] === 0xff) {
      position++;
    }
    const marker = jpeg[position + 1];
    if (marker === undefined) {
      throw damagedFile();
    }
    if (marker === endMarker) {
      kept.push(jpeg.subarray(position, position + 2));
      return Buffer.concat(kept);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(jpeg.subarray(position, position + 2));
      position += 2;
      continue;
    }
    if (position + 4 > jpeg.length) {
      throw damagedFile();
    }
    const length = jpeg.readUInt16BE(position + 2);
    const end = position + 2 + length;
    if (length < 2 || end > jpeg.length) {
      throw damagedFile();
    }
    const segment = jpeg.subarray(position, end);
    if (!isDetailSegment(marker, segment)) {
      kept.push(segment);
    }
    position = end;
    if (marker === scanMarker) {
      const scanEnd = endOfScan(jpeg, position);
      kept.push(jpeg.subarray(position, scanEnd));
      position = scanEnd;
    }
  }
}

function containsLosslessChunk(
  webp: Buffer,
  start: number,
  end: number,
): boolean {
  for (let position = start; position + 8 <= end;) {
    const name = webp.toString("latin1", position, position + 4);
    const length = webp.readUInt32LE(position + 4);
    const dataStart = position + 8;
    if (name === "VP8L") {
      return true;
    }
    if (
      name === "ANMF" &&
      containsLosslessChunk(
        webp,
        dataStart + 16,
        Math.min(end, dataStart + length),
      )
    ) {
      return true;
    }
    position = dataStart + length + (length % 2);
  }
  return false;
}

export function isLosslessWebp(webp: Buffer): boolean {
  return containsLosslessChunk(webp, 12, webp.length);
}
