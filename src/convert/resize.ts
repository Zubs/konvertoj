import type { Sharp } from "sharp";
import { enlargeScale } from "../modes/options.js";
import type { RunContext } from "../modes/registry.js";

export type Fit = "contain" | "cover" | "fill" | "inside" | "outside";

export interface SizeRequest {
  width?: number;
  height?: number;
  scale?: number;
  fit: Fit;
}

export interface SizePlan {
  width: number;
  height: number;
  fit: Fit;
}

export const largestSide = 16384;

function scaleFactor(value: string): number {
  const lower = value.toLowerCase();
  return lower.endsWith("%")
    ? Number(lower.slice(0, -1)) / 100
    : Number(lower.replace(/x$/, ""));
}

export function sizeRequest(
  options: RunContext["options"],
  enlarge: boolean,
): SizeRequest {
  const given = (name: string) =>
    typeof options[name] === "string" ? options[name] : undefined;
  const scale =
    given("scale") ?? (enlarge ? enlargeScale.defaultValue : undefined);
  const width = given("width");
  const height = given("height");
  return {
    width: width === undefined ? undefined : Number(width),
    height: height === undefined ? undefined : Number(height),
    scale: scale === undefined ? undefined : scaleFactor(scale),
    fit: (given("fit")?.toLowerCase() ?? "inside") as Fit,
  };
}

function wholePixels(value: number): number {
  return Math.max(1, Math.round(value));
}

export function planSize(
  source: { width: number; height: number },
  request: SizeRequest,
): SizePlan | undefined {
  const { width, height } = source;
  if (request.scale !== undefined) {
    return {
      width: wholePixels(width * request.scale),
      height: wholePixels(height * request.scale),
      fit: "fill",
    };
  }
  const wanted = { width: request.width, height: request.height };
  if (wanted.width !== undefined && wanted.height !== undefined) {
    if (request.fit === "inside" || request.fit === "outside") {
      const pick = request.fit === "inside" ? Math.min : Math.max;
      const scale = pick(wanted.width / width, wanted.height / height);
      return {
        width: wholePixels(width * scale),
        height: wholePixels(height * scale),
        fit: "fill",
      };
    }
    return { width: wanted.width, height: wanted.height, fit: request.fit };
  }
  if (wanted.width !== undefined) {
    return {
      width: wanted.width,
      height: wholePixels((height * wanted.width) / width),
      fit: "fill",
    };
  }
  if (wanted.height !== undefined) {
    return {
      width: wholePixels((width * wanted.height) / height),
      height: wanted.height,
      fit: "fill",
    };
  }
  return undefined;
}

export function applyResize(
  image: Sharp,
  plan: SizePlan,
  { background, sharpen }: { background: string | object; sharpen: boolean },
): Sharp {
  const resized = image.resize(plan.width, plan.height, {
    fit: plan.fit,
    position: "centre",
    kernel: "lanczos3",
    background,
  });
  return sharpen ? resized.sharpen({ sigma: 0.5 }) : resized;
}
