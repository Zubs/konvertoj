import { Buffer } from "node:buffer";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { encode as encodeBmp } from "bmp-ts";
import sharp, { type Sharp } from "sharp";
import {
  damagedFile,
  isFileSystemError,
  isUserError,
  UserError,
} from "../errors.js";
import { defaultQualities, formatLabels } from "../modes/formats.js";
import { background, sizes } from "../modes/options.js";
import type { RunContext } from "../modes/registry.js";
import { openImage, type OpenedImage } from "./decode.js";
import { writeIco } from "./ico.js";
import { readDetails, type Details } from "./metadata.js";
import {
  applyResize,
  largestSide,
  planSize,
  sizeRequest,
  type SizePlan,
} from "./resize.js";

export interface ConvertSettings {
  keepFormat?: boolean;
  enlarge?: boolean;
  quality?: number;
  resize?: false;
  edit?: (image: Sharp, source: OpenedImage, target: string) => Promise<Sharp>;
}

const animatableFormats = ["gif", "webp"];
const formatsWithoutDetails = ["bmp", "gif", "ico"];
const repackedFormats = ["bmp", "ico"];
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const largestIcon = 256;
const screenDensity = 72;

function quality(
  options: RunContext["options"],
  target: string,
  compressQuality: number | undefined,
) {
  if (compressQuality !== undefined) {
    return compressQuality;
  }
  return typeof options.quality === "string"
    ? Number(options.quality)
    : defaultQualities[target];
}

function frameSharing(compressQuality: number): number {
  return Math.round((100 - compressQuality) * 0.32);
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

function iconSizesFor(
  options: RunContext["options"],
  keepFormat: boolean,
): number[] | undefined {
  if (keepFormat) {
    return undefined;
  }
  const wanted =
    typeof options.sizes === "string" ? options.sizes : sizes.defaultValue;
  return [...new Set((wanted ?? "").split(",").map(Number))].sort(
    (a, b) => a - b,
  );
}

async function icoFile(
  image: Sharp,
  iconSizes: number[] | undefined,
): Promise<Buffer> {
  const { data, info } = await image
    .png()
    .toBuffer({ resolveWithObject: true });
  const side = Math.max(info.width, info.height);
  if (!iconSizes && side > largestIcon) {
    throw new UserError(
      `would be ${side} pixels, but icons can be at most ${largestIcon} pixels wide. Choose a smaller size.`,
    );
  }
  const base = sharp(data);
  const images = await Promise.all(
    (iconSizes ?? [side]).map(async (size) => ({
      size,
      png: await base
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
  iconSizes: number[] | undefined,
  compressQuality: number | undefined,
  animation: { delay?: number[]; loop?: number },
): Promise<Buffer> {
  const lossless = options.lossless === true;
  const chosen = quality(options, target, compressQuality);
  switch (target) {
    case "jpg":
      return image
        .jpeg({
          quality: chosen,
          progressive: options.progressive === true,
        })
        .toBuffer();
    case "png":
      return (
        compressQuality === undefined
          ? image.png()
          : image.png({ palette: true, quality: compressQuality, effort: 10 })
      ).toBuffer();
    case "webp":
      return image.webp({ quality: chosen, lossless, ...animation }).toBuffer();
    case "avif":
      return image.avif({ quality: chosen, lossless }).toBuffer();
    case "gif":
      return (
        compressQuality === undefined
          ? image.gif(animation)
          : image.gif({
              ...animation,
              effort: 10,
              reuse: false,
              interFrameMaxError: frameSharing(compressQuality),
              interPaletteMaxError: frameSharing(compressQuality),
            })
      ).toBuffer();
    case "bmp":
      return bmpFile(image);
    case "ico":
      return icoFile(image, iconSizes);
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

function withDetails(
  image: Sharp,
  target: string,
  details: Details | undefined,
): Sharp {
  if (repackedFormats.includes(target)) {
    return image;
  }
  const profiled = image.withIccProfile("srgb");
  if (!details?.present) {
    return profiled;
  }
  if (details.heicExif) {
    return profiled.withExif(details.heicExif).withDensity(screenDensity);
  }
  return details.damaged ? profiled.keepXmp() : profiled.keepExif().keepXmp();
}

function reportDetails(
  context: RunContext,
  target: string,
  details: Details | undefined,
): void {
  const name = path.basename(context.inputs[0]?.path ?? "");
  const label = formatLabels[target];
  if (details?.damaged) {
    context.note("the photo's details looked damaged, so they were left out");
  }
  if (details?.present && formatsWithoutDetails.includes(target)) {
    context.detail(
      `${name}'s camera, date and location details were dropped, because ${label} can't hold them`,
    );
  }
  if (details?.hasExif && !details.damaged && target === "tiff") {
    context.detail(
      `${name}'s camera, date and location details were dropped, because konvertoj can't write them into TIFF files`,
    );
  }
}

export function losesTransparency(
  target: string,
  options: RunContext["options"],
) {
  return (
    target === "jpg" ||
    target === "bmp" ||
    (target === "tiff" && typeof options.quality === "string")
  );
}

export function backgroundColour(options: RunContext["options"]): string {
  return typeof options.background === "string"
    ? options.background
    : (background.defaultValue ?? "white");
}

function finalPlan(
  context: RunContext,
  source: { width: number; height: number; plan?: SizePlan },
  enlarge: boolean,
): SizePlan | undefined {
  const plan =
    source.plan ?? planSize(source, sizeRequest(context.options, enlarge));
  if (!plan) {
    return undefined;
  }
  if (
    context.options["no-enlarge"] === true &&
    (plan.width > source.width || plan.height > source.height)
  ) {
    context.note(
      `kept at ${source.width} × ${source.height}, because --no-enlarge stops images getting bigger`,
    );
    return undefined;
  }
  if (Math.max(plan.width, plan.height) > largestSide) {
    throw new UserError(
      `would be ${plan.width} × ${plan.height} pixels, larger than the ${largestSide}-pixel limit on a side. Choose a smaller size.`,
    );
  }
  return plan;
}

function firstInput(context: RunContext) {
  const [input] = context.inputs;
  if (!input) {
    throw new UserError("has nothing to convert.");
  }
  return input;
}

function isAnimated(format: string, target: string): boolean {
  return (
    animatableFormats.includes(target) && animatableFormats.includes(format)
  );
}

export async function renderImage(
  context: RunContext,
  target: string,
  settings: ConvertSettings = {},
): Promise<Buffer> {
  const input = firstInput(context);
  const opened = await openImage(
    input,
    context.options,
    isAnimated(input.format ?? "", target),
    settings.resize === false
      ? { fit: "inside" }
      : sizeRequest(context.options, settings.enlarge === true),
  );
  return renderOpened(context, opened, target, settings);
}

export async function renderOpened(
  context: RunContext,
  opened: OpenedImage,
  target: string,
  {
    keepFormat = false,
    enlarge = false,
    quality,
    resize,
    edit,
  }: ConvertSettings = {},
): Promise<Buffer> {
  const input = firstInput(context);
  const format = input.format ?? "";
  const { options } = context;
  const animated = isAnimated(format, target);
  const plan =
    resize === false ? undefined : finalPlan(context, opened, enlarge);
  const iconSizes = iconSizesFor(options, keepFormat);
  const animation =
    animated && opened.pages > 1
      ? { delay: opened.metadata?.delay, loop: opened.metadata?.loop }
      : {};
  const details =
    options["strip-metadata"] === true
      ? undefined
      : await readDetails(input, opened);
  reportDetails(context, target, details);
  try {
    let { image } = opened;
    if (plan) {
      image = applyResize(image, plan, {
        background: losesTransparency(target, options)
          ? backgroundColour(options)
          : transparent,
        sharpen: enlarge,
      });
    }
    if (edit) {
      image = await edit(image, opened, target);
    }
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
      image = image.flatten({ background: backgroundColour(options) });
    }
    return await encode(
      withDetails(image, target, details),
      target,
      options,
      iconSizes,
      quality,
      animation,
    );
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
}

export async function convertImage(
  context: RunContext,
  target: string,
  settings: ConvertSettings = {},
): Promise<void> {
  const encoded = await renderImage(context, target, settings);
  await context.save((temporaryPath) => writeFile(temporaryPath, encoded));
}
