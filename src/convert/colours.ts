import { damagedFile, isUserError, UserError } from "../errors.js";
import type { RunContext } from "../modes/registry.js";
import { openImage } from "./decode.js";
import { displayPath } from "../paths.js";

type Pixel = [number, number, number, number];

interface Colour {
  hex: string;
  rgb: number[];
  hsl: number[];
  alpha: number;
}

const sampleSide = 256;

function hsl([red, green, blue]: number[]): number[] {
  const [r, g, b] = [red ?? 0, green ?? 0, blue ?? 0].map(
    (value) => value / 255,
  ) as [number, number, number];
  const highest = Math.max(r, g, b);
  const lowest = Math.min(r, g, b);
  const lightness = (highest + lowest) / 2;
  const range = highest - lowest;
  if (range === 0) {
    return [0, 0, Math.round(lightness * 100)];
  }
  const saturation = range / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (highest === r) {
    hue = ((g - b) / range) % 6;
  } else if (highest === g) {
    hue = (b - r) / range + 2;
  } else {
    hue = (r - g) / range + 4;
  }
  return [
    (Math.round(hue * 60) + 360) % 360,
    Math.round(saturation * 100),
    Math.round(lightness * 100),
  ];
}

function describe(pixel: Pixel): Colour {
  const rgb = pixel.slice(0, 3).map(Math.round);
  const alpha = Math.round(pixel[3]);
  const hex = (alpha === 255 ? rgb : [...rgb, alpha])
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return {
    hex: `#${hex}`,
    rgb,
    hsl: hsl(rgb),
    alpha: Number((alpha / 255).toFixed(2)),
  };
}

function colourText(colour: Colour, blocks: boolean): string {
  const [r, g, b] = colour.rgb;
  const [h, s, l] = colour.hsl;
  const block = blocks ? `\x1b[48;2;${r};${g};${b}m  \x1b[0m ` : "";
  const forms =
    colour.alpha === 1
      ? [`rgb(${r}, ${g}, ${b})`, `hsl(${h}, ${s}%, ${l}%)`]
      : [
          `rgba(${r}, ${g}, ${b}, ${colour.alpha})`,
          `hsla(${h}, ${s}%, ${l}%, ${colour.alpha})`,
        ];
  return `${block}${colour.hex}  ${forms.join("  ")}`;
}

function spreadOf(pixels: Pixel[]): {
  channel: number;
  spread: number;
  mean: number;
} {
  let best = { channel: 0, variance: -1, mean: 0 };
  let spread = 0;
  for (let channel = 0; channel < 4; channel++) {
    let sum = 0;
    let squares = 0;
    for (const pixel of pixels) {
      const value = pixel[channel] ?? 0;
      sum += value;
      squares += value * value;
    }
    const mean = sum / pixels.length;
    const variance = squares / pixels.length - mean * mean;
    spread += variance * pixels.length;
    if (variance > best.variance) {
      best = { channel, variance, mean };
    }
  }
  return { channel: best.channel, spread, mean: best.mean };
}

function bestSplit(box: Pixel[]) {
  const { channel, spread, mean } = spreadOf(box);
  const below = box.filter((pixel) => (pixel[channel] ?? 0) <= mean);
  const above = box.filter((pixel) => (pixel[channel] ?? 0) > mean);
  if (below.length === 0 || above.length === 0) {
    return undefined;
  }
  const gain = spread - spreadOf(below).spread - spreadOf(above).spread;
  return { box, parts: [below, above], gain };
}

function average(pixels: Pixel[]): Pixel {
  const sums = [0, 0, 0, 0];
  for (const pixel of pixels) {
    pixel.forEach(
      (value, channel) => (sums[channel] = (sums[channel] ?? 0) + value),
    );
  }
  return sums.map((sum) => sum / pixels.length) as Pixel;
}

export function mainColours(
  pixels: Pixel[],
  count: number,
): { pixel: Pixel; share: number }[] {
  const boxes: Pixel[][] = pixels.length > 0 ? [pixels] : [];
  while (boxes.length < count) {
    const chosen = boxes
      .map(bestSplit)
      .filter((split) => split !== undefined)
      .sort((a, b) => b.gain - a.gain)[0];
    if (!chosen) {
      break;
    }
    boxes.splice(boxes.indexOf(chosen.box), 1, ...chosen.parts);
  }
  return boxes
    .sort((a, b) => b.length - a.length)
    .map((box) => ({ pixel: average(box), share: box.length / pixels.length }));
}

function toPixels(data: Buffer): Pixel[] {
  const pixels: Pixel[] = [];
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) > 0) {
      pixels.push([
        data[index] ?? 0,
        data[index + 1] ?? 0,
        data[index + 2] ?? 0,
        data[index + 3] ?? 0,
      ]);
    }
  }
  return pixels;
}

function tooLarge(error: unknown): never {
  if (isUserError(error)) {
    throw error;
  }
  if (/pixel limit/i.test(String((error as Error).message))) {
    throw new UserError(
      "is too large to read (konvertoj can read images of up to 268 million pixels).",
      { cause: error },
    );
  }
  throw damagedFile(error);
}

export async function pickColours(context: RunContext): Promise<void> {
  const [input] = context.inputs;
  if (!input) {
    return;
  }
  const { options } = context;
  const opened = await openImage(input, {}, false, { fit: "inside" });
  const blocks = context.colours && options.json !== true;
  const file = displayPath(process.cwd(), input.path);
  const lines = [file];
  const data: Record<string, unknown> = { file };

  if (typeof options.at === "string") {
    const [x = 0, y = 0] = options.at.split(",").map(Number);
    if (x >= opened.width || y >= opened.height) {
      throw new UserError(
        `--at ${x},${y} is outside the image, which is ${opened.width} × ${opened.height} pixels. Use x from 0 to ${opened.width - 1} and y from 0 to ${opened.height - 1}.`,
      );
    }
    const pixel = await opened.image
      .clone()
      .extract({ left: x, top: y, width: 1, height: 1 })
      .ensureAlpha()
      .raw()
      .toBuffer()
      .catch(tooLarge);
    const colour = describe([...pixel.subarray(0, 4)] as Pixel);
    lines.push(`  Pixel ${x},${y}: ${colourText(colour, blocks)}`);
    data.at = { x, y, ...colour };
  }

  if (typeof options.palette === "string") {
    const sample = await opened.image
      .clone()
      .resize(sampleSide, sampleSide, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: "nearest",
      })
      .ensureAlpha()
      .raw()
      .toBuffer()
      .catch(tooLarge);
    const found = mainColours(toPixels(sample), Number(options.palette));
    lines.push("  Main colours:");
    const palette = found.map(({ pixel, share }, index) => {
      const colour = describe(pixel);
      lines.push(
        `    ${index + 1}. ${colourText(colour, blocks)}  ${Math.round(share * 100)}%`,
      );
      return { ...colour, share: Number(share.toFixed(4)) };
    });
    data.palette = palette;
  }

  context.show({ text: lines.join("\n"), data });
}
