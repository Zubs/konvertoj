import { stat } from "node:fs/promises";
import path from "node:path";
import { formatLabels } from "../modes/formats.js";
import type { RunContext } from "../modes/registry.js";
import { formatSize } from "../report.js";
import { openImage, type OpenedImage } from "./decode.js";
import { cameraDetails, type CameraDetails } from "./metadata.js";

const colourSpaces: Record<string, string> = {
  srgb: "sRGB",
  cmyk: "CMYK",
  "b-w": "Grayscale",
  rgb16: "RGB (16-bit)",
  grey16: "Grayscale (16-bit)",
  lab: "Lab",
};

function shortLabel(format: string): string {
  return (formatLabels[format] ?? format).replace(/ \(.*\)$/, "");
}

async function hasTransparency(opened: OpenedImage): Promise<boolean> {
  if (opened.metadata && !opened.metadata.hasAlpha) {
    return false;
  }
  try {
    return !(await opened.image.clone().stats()).isOpaque;
  } catch {
    return opened.metadata?.hasAlpha ?? false;
  }
}

function readableDate(date: string): string {
  return date.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
}

function locationOf(details: CameraDetails | undefined, verbose: boolean) {
  const found =
    details?.latitude !== undefined && details.longitude !== undefined;
  if (!found || !verbose) {
    return found;
  }
  return { latitude: details.latitude, longitude: details.longitude };
}

function detailLines(
  details: CameraDetails | undefined,
  location: ReturnType<typeof locationOf>,
): string[] {
  if (!details) {
    return ["No camera details"];
  }
  const camera = [details.make, details.model].filter(Boolean).join(" ");
  const lines = [];
  if (camera) {
    lines.push(`Camera: ${camera}`);
  }
  if (details.dateTaken) {
    lines.push(`Date taken: ${readableDate(details.dateTaken)}`);
  }
  if (typeof location === "object") {
    lines.push(
      `Location: ${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}`,
    );
  } else {
    lines.push(`Location: ${location ? "yes" : "no"}`);
  }
  return lines;
}

export async function showInfo(context: RunContext): Promise<void> {
  const [input] = context.inputs;
  if (!input) {
    return;
  }
  const format = input.format ?? "";
  const opened = await openImage(input, {}, false, { fit: "inside" });
  const fileSize = (await stat(input.path)).size;
  const space = opened.metadata?.space ?? "srgb";
  const colourSpace = colourSpaces[space] ?? space;
  const transparency = await hasTransparency(opened);
  const details = await cameraDetails(input, opened);
  const location = locationOf(details, context.options.verbose === true);
  const file = path.relative(process.cwd(), input.path);
  const lines = [
    `Format: ${shortLabel(format)}`,
    `File size: ${formatSize(fileSize)}`,
    `Dimensions: ${opened.width} × ${opened.height}`,
    `Colour space: ${colourSpace}`,
    `Transparency: ${transparency ? "yes" : "no"}`,
    ...(opened.pages > 1 ? [`Frames: ${opened.pages}`] : []),
    ...detailLines(details, location),
  ];
  context.show({
    text: [file, ...lines.map((line) => `  ${line}`)].join("\n"),
    data: {
      file,
      format: shortLabel(format),
      fileSize,
      width: opened.width,
      height: opened.height,
      colourSpace,
      transparency,
      frames: opened.pages,
      camera:
        details?.make || details?.model
          ? { make: details.make ?? null, model: details.model ?? null }
          : null,
      dateTaken: details?.dateTaken ? readableDate(details.dateTaken) : null,
      location,
    },
  });
}
