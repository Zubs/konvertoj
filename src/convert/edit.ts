import { Buffer } from "node:buffer";
import type { Sharp } from "sharp";
import sharp from "./sharp.js";
import { damagedFile, UserError } from "../errors.js";
import type { RunContext } from "../modes/registry.js";
import type { OpenedImage } from "./decode.js";
import { backgroundColour, convertImage, losesTransparency } from "./image.js";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function isAnimated(source: OpenedImage, target: string): boolean {
  return source.pages > 1 && ["gif", "webp"].includes(target);
}

function given(
  options: RunContext["options"],
  name: string,
): number | undefined {
  return typeof options[name] === "string" ? Number(options[name]) : undefined;
}

function placed(
  source: { width: number; height: number },
  width: number,
  height: number,
  position: string,
): Box {
  const centredLeft = Math.floor((source.width - width) / 2);
  const centredTop = Math.floor((source.height - height) / 2);
  const left = position.includes("left")
    ? 0
    : position.includes("right")
      ? source.width - width
      : centredLeft;
  const top = position.includes("top")
    ? 0
    : position.includes("bottom")
      ? source.height - height
      : centredTop;
  return { left, top, width, height };
}

async function trimBox(
  image: Sharp,
  source: OpenedImage,
  path: string,
): Promise<Box> {
  const still =
    source.pages > 1 ? sharp(path, { autoOrient: true }) : image.clone();
  const { info } = await still.trim().toBuffer({ resolveWithObject: true });
  return {
    left: -(info.trimOffsetLeft ?? 0),
    top: -(info.trimOffsetTop ?? 0),
    width: info.width,
    height: info.height,
  };
}

function cropBox(
  options: RunContext["options"],
  source: { width: number; height: number },
): Box {
  const position =
    typeof options.position === "string"
      ? options.position.toLowerCase()
      : "center";
  if (typeof options.aspect === "string") {
    const [across = 1, down = 1] = options.aspect.split(":").map(Number);
    const ratio = across / down;
    const wide = source.width / source.height > ratio;
    return placed(
      source,
      wide ? Math.max(1, Math.round(source.height * ratio)) : source.width,
      wide ? source.height : Math.max(1, Math.round(source.width / ratio)),
      position,
    );
  }
  const width = given(options, "width") ?? source.width;
  const height = given(options, "height") ?? source.height;
  const left = given(options, "left");
  const top = given(options, "top");
  return left !== undefined && top !== undefined
    ? { left, top, width, height }
    : placed(source, width, height, position);
}

export function cropEdit(context: RunContext) {
  return async (image: Sharp, source: OpenedImage): Promise<Sharp> => {
    const { options } = context;
    if (options.trim === true) {
      const box = await trimBox(image, source, context.inputs[0]?.path ?? "");
      if (box.width === source.width && box.height === source.height) {
        context.note("no plain border was found, so it wasn't trimmed");
        return image;
      }
      return image.extract(box);
    }
    const box = cropBox(options, source);
    if (
      box.width > source.width ||
      box.height > source.height ||
      box.left + box.width > source.width ||
      box.top + box.height > source.height
    ) {
      throw new UserError(
        `goes past the edge of the image, which is ${source.width} × ${source.height} pixels. Choose a smaller crop.`,
      );
    }
    return image.extract(box);
  };
}

async function eachFrame(
  image: Sharp,
  source: OpenedImage,
  change: (frame: Sharp) => Sharp,
): Promise<Sharp> {
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frameHeight = info.height / source.pages;
  const frameBytes = info.width * frameHeight * 4;
  const frames = await Promise.all(
    Array.from({ length: source.pages }, (_, index) =>
      change(
        sharp(data.subarray(index * frameBytes, (index + 1) * frameBytes), {
          raw: { width: info.width, height: frameHeight, channels: 4 },
        }),
      )
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  const [first] = frames;
  const width = first?.info.width ?? info.width;
  const height = first?.info.height ?? frameHeight;
  return sharp(Buffer.concat(frames.map((frame) => frame.data)), {
    raw: {
      width,
      height: height * source.pages,
      channels: 4,
      pageHeight: height,
    },
  });
}

export function rotateEdit(context: RunContext) {
  return async (
    image: Sharp,
    source: OpenedImage,
    target: string,
  ): Promise<Sharp> => {
    const { options } = context;
    const given = typeof options.angle === "string" ? Number(options.angle) : 0;
    const angle = ((given % 360) + 360) % 360;
    if (angle === 0) {
      return image;
    }
    const background =
      typeof options.background === "string"
        ? options.background
        : losesTransparency(target, options)
          ? backgroundColour(options)
          : transparent;
    return isAnimated(source, target)
      ? eachFrame(image, source, (frame) => frame.rotate(angle, { background }))
      : image.rotate(angle, { background });
  };
}

export function flipEdit(context: RunContext) {
  return async (
    image: Sharp,
    source: OpenedImage,
    target: string,
  ): Promise<Sharp> => {
    if (String(context.options.direction).toLowerCase() !== "vertical") {
      return image.flop();
    }
    return isAnimated(source, target)
      ? eachFrame(image, source, (frame) => frame.flip())
      : image.flip();
  };
}

async function orientationOf(path: string): Promise<number | undefined> {
  try {
    return (await sharp(path).metadata()).orientation;
  } catch (error) {
    throw damagedFile(error);
  }
}

export async function cropImage(context: RunContext) {
  await convertImage(context, context.inputs[0]?.format ?? "", {
    keepFormat: true,
    resize: false,
    edit: cropEdit(context),
  });
}

export async function rotateImage(
  context: RunContext,
): Promise<{ skipped: string } | void> {
  const [input] = context.inputs;
  if (context.options.auto === true && context.options.angle === undefined) {
    const orientation =
      input?.format === "bmp" || input?.format === "ico"
        ? undefined
        : await orientationOf(input?.path ?? "");
    if (orientation === undefined || orientation === 1) {
      return { skipped: "already upright" };
    }
  }
  await convertImage(context, input?.format ?? "", {
    keepFormat: true,
    resize: false,
    edit: rotateEdit(context),
  });
}

export async function flipImage(context: RunContext) {
  await convertImage(context, context.inputs[0]?.format ?? "", {
    keepFormat: true,
    resize: false,
    edit: flipEdit(context),
  });
}
