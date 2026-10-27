import { Buffer } from "node:buffer";
import { stat, writeFile } from "node:fs/promises";
import { formatSize } from "../report.js";
import type { RunContext } from "../modes/registry.js";
import { renderImage } from "./image.js";

const levelQualities: Record<string, number> = {
  low: 85,
  medium: 70,
  high: 50,
};
const mostAttempts = 8;

function bytesIn(size: string): number {
  const lower = size.toLowerCase();
  const kilobytes =
    Number(lower.slice(0, -2)) * (lower.endsWith("mb") ? 1024 : 1);
  return Math.floor(kilobytes * 1024);
}

function silenced(context: RunContext): RunContext {
  return { ...context, note: () => {}, detail: () => {} };
}

async function searchForSize(
  context: RunContext,
  format: string,
  target: number,
): Promise<{ encoded: Buffer; unreached?: string }> {
  let low = 1;
  let high = 100;
  let fitting: Buffer | undefined;
  let fittingQuality = 0;
  let smallest: { encoded: Buffer; quality: number } | undefined;
  for (let attempt = 0; attempt < mostAttempts && low <= high; attempt++) {
    const quality = Math.floor((low + high) / 2);
    const encoded = await renderImage(
      attempt === 0 ? context : silenced(context),
      format,
      { keepFormat: true, quality },
    );
    if (!smallest || encoded.length < smallest.encoded.length) {
      smallest = { encoded, quality };
    }
    if (encoded.length <= target) {
      fitting = encoded;
      fittingQuality = quality;
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }
  if (fitting) {
    context.detail(`chosen quality ${fittingQuality}`);
    return { encoded: fitting };
  }
  const best = smallest ?? { encoded: Buffer.alloc(0), quality: 1 };
  context.detail(`chosen quality ${best.quality}`);
  return {
    encoded: best.encoded,
    unreached: `couldn't get below ${formatSize(target)}, so the smallest result (${formatSize(best.encoded.length)}, quality ${best.quality}) was kept`,
  };
}

export async function compressImage(
  context: RunContext,
): Promise<{ skipped: string } | void> {
  const [input] = context.inputs;
  if (!input) {
    return;
  }
  const format = input.format ?? "";
  const { options } = context;
  const before = (await stat(input.path)).size;
  let encoded: Buffer;
  let unreached: string | undefined;
  if (typeof options["target-size"] === "string") {
    ({ encoded, unreached } = await searchForSize(
      context,
      format,
      bytesIn(options["target-size"]),
    ));
  } else {
    const quality =
      typeof options.quality === "string"
        ? Number(options.quality)
        : levelQualities[
            typeof options.level === "string"
              ? options.level.toLowerCase()
              : "medium"
          ];
    encoded = await renderImage(context, format, { keepFormat: true, quality });
  }
  if (encoded.length >= before) {
    return {
      skipped: unreached
        ? `already optimised (${unreached})`
        : "already optimised",
    };
  }
  if (unreached) {
    context.note(unreached);
  }
  await context.save((temporaryPath) => writeFile(temporaryPath, encoded));
}
