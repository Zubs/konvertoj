import { writeFile } from "node:fs/promises";
import sharp, { type Sharp } from "sharp";
import { damagedFile, isUserError, UserError } from "../errors.js";
import {
  coreImageFormats,
  defaultQualities,
  formatLabels,
} from "../modes/formats.js";
import { background } from "../modes/options.js";
import type { RunContext } from "../modes/registry.js";

const animatableFormats = ["gif", "webp"];

function quality(options: RunContext["options"], target: string) {
  return typeof options.quality === "string"
    ? Number(options.quality)
    : defaultQualities[target];
}

function encode(
  image: Sharp,
  target: string,
  options: RunContext["options"],
): Sharp {
  const lossless = options.lossless === true;
  switch (target) {
    case "jpg":
      return image.jpeg({
        quality: quality(options, target),
        progressive: options.progressive === true,
      });
    case "png":
      return image.png();
    case "webp":
      return image.webp({ quality: quality(options, target), lossless });
    case "avif":
      return image.avif({ quality: quality(options, target), lossless });
    case "gif":
      return image.gif();
    default:
      return typeof options.quality === "string"
        ? image.tiff({ compression: "jpeg", quality: Number(options.quality) })
        : image.tiff({ compression: "lzw" });
  }
}

function losesTransparency(target: string, options: RunContext["options"]) {
  return (
    target === "jpg" ||
    (target === "tiff" && typeof options.quality === "string")
  );
}

function hasCode(error: unknown): boolean {
  return typeof (error as NodeJS.ErrnoException).code === "string";
}

export async function convertImage(
  context: RunContext,
  target: string,
): Promise<void> {
  const [input] = context.inputs;
  const format = input?.format ?? "";
  if (!input || !coreImageFormats.includes(format)) {
    throw new UserError("can't be converted yet.");
  }
  const { options } = context;
  const animated =
    animatableFormats.includes(target) && animatableFormats.includes(format);
  let encoded: Buffer;
  try {
    let image = sharp(input.path, { animated, autoOrient: true });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) > 1 && !animated) {
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
    encoded = await encode(image, target, options).toBuffer();
  } catch (error) {
    if (isUserError(error) || hasCode(error)) {
      throw error;
    }
    if (/pixel limit/i.test(String((error as Error).message))) {
      const { width, height } = await sharp(input.path, {
        limitInputPixels: false,
      }).metadata();
      throw new UserError(
        `is too large to convert (${width} × ${height} pixels). konvertoj can convert images of up to 268 million pixels.`,
        { cause: error },
      );
    }
    throw damagedFile(error);
  }
  await context.save((temporaryPath) => writeFile(temporaryPath, encoded));
}
