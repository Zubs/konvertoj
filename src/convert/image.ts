import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import { encode as encodeBmp } from "bmp-ts";
import type { Sharp } from "sharp";
import {
  damagedFile,
  isFileSystemError,
  isUserError,
  UserError,
} from "../errors.js";
import { defaultQualities, formatLabels } from "../modes/formats.js";
import { background, sizes } from "../modes/options.js";
import type { RunContext } from "../modes/registry.js";
import { openImage } from "./decode.js";
import { writeIco } from "./ico.js";

const animatableFormats = ["gif", "webp"];
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function quality(options: RunContext["options"], target: string) {
  return typeof options.quality === "string"
    ? Number(options.quality)
    : defaultQualities[target];
}

async function bmpFile(image: Sharp): Promise<Buffer> {
  const { data, info } = await image
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const abgr = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    abgr[pixel * 4] = 255;
    abgr[pixel * 4 + 1] = data[pixel * 3 + 2] ?? 0;
    abgr[pixel * 4 + 2] = data[pixel * 3 + 1] ?? 0;
    abgr[pixel * 4 + 3] = data[pixel * 3] ?? 0;
  }
  return encodeBmp({
    width: info.width,
    height: info.height,
    data: abgr,
    bitPP: 24,
  }).data;
}

async function icoFile(
  image: Sharp,
  options: RunContext["options"],
): Promise<Buffer> {
  const wanted =
    typeof options.sizes === "string" ? options.sizes : sizes.defaultValue;
  const iconSizes = [...new Set((wanted ?? "").split(",").map(Number))].sort(
    (a, b) => a - b,
  );
  const images = await Promise.all(
    iconSizes.map(async (size) => ({
      size,
      png: await image
        .clone()
        .resize(size, size, { fit: "contain", background: transparent })
        .png()
        .toBuffer(),
    })),
  );
  return writeIco(images);
}

function encode(
  image: Sharp,
  target: string,
  options: RunContext["options"],
): Promise<Buffer> {
  const lossless = options.lossless === true;
  switch (target) {
    case "jpg":
      return image
        .jpeg({
          quality: quality(options, target),
          progressive: options.progressive === true,
        })
        .toBuffer();
    case "png":
      return image.png().toBuffer();
    case "webp":
      return image
        .webp({ quality: quality(options, target), lossless })
        .toBuffer();
    case "avif":
      return image
        .avif({ quality: quality(options, target), lossless })
        .toBuffer();
    case "gif":
      return image.gif().toBuffer();
    case "bmp":
      return bmpFile(image);
    case "ico":
      return icoFile(image, options);
    default:
      return (
        typeof options.quality === "string"
          ? image.tiff({
              compression: "jpeg",
              quality: Number(options.quality),
            })
          : image.tiff({ compression: "lzw" })
      ).toBuffer();
  }
}

function losesTransparency(target: string, options: RunContext["options"]) {
  return (
    target === "jpg" ||
    target === "bmp" ||
    (target === "tiff" && typeof options.quality === "string")
  );
}

export async function convertImage(
  context: RunContext,
  target: string,
): Promise<void> {
  const [input] = context.inputs;
  if (!input) {
    return;
  }
  const format = input.format ?? "";
  const { options } = context;
  const animated =
    animatableFormats.includes(target) && animatableFormats.includes(format);
  const opened = await openImage(input, options, animated);
  let encoded: Buffer;
  try {
    let { image } = opened;
    if (opened.pages > 1 && !animated) {
      context.note(
        animatableFormats.includes(format)
          ? `only the first frame was kept, because ${formatLabels[target]} can't be animated`
          : "only the first page was kept",
      );
    }
    if (options.grayscale === true) {
      image = image.grayscale();
    }
    if (losesTransparency(target, options)) {
      image = image.flatten({
        background:
          typeof options.background === "string"
            ? options.background
            : background.defaultValue,
      });
    }
    encoded = await encode(image, target, options);
  } catch (error) {
    if (isUserError(error) || isFileSystemError(error)) {
      throw error;
    }
    if (/pixel limit/i.test(String((error as Error).message))) {
      throw new UserError(
        `is too large to convert (${opened.width} × ${opened.height} pixels). konvertoj can convert images of up to 268 million pixels.`,
        { cause: error },
      );
    }
    throw damagedFile(error);
  }
  await context.save((temporaryPath) => writeFile(temporaryPath, encoded));
}
