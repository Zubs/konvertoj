import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { coreImageFormats } from "../src/modes/formats.js";
import { makeFolder } from "./support/folders.js";
import {
  p3Colour,
  pixels,
  sharpFormats,
  truncate,
  writeAnimatedGif,
  writeDisplayP3Png,
  writeHugePng,
  writeImage,
  writeMultiPageTiff,
  writeNoise,
  writeSidewaysJpg,
} from "./support/images.js";
import { runIn as run } from "./support/run-main.js";
import { writeSample } from "./support/samples.js";

const projectFolder = process.cwd();
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function expectImage(
  file: string,
  format: string,
  width: number,
  height: number,
) {
  const metadata = await sharp(file).metadata();
  expect(metadata.format).toBe(sharpFormats[format]);
  if (format === "avif") {
    expect(metadata.compression).toBe("av1");
  }
  expect([metadata.width, metadata.height]).toEqual([width, height]);
}

const pairs = coreImageFormats.flatMap((from) =>
  coreImageFormats.filter((to) => to !== from).map((to) => [from, to]),
);

describe("core image conversion", () => {
  it.each(pairs)("converts a 1 × 1 %s to %s", async (from, to) => {
    const folder = makeFolder();
    await writeImage(folder, `dot.${from}`, from, { width: 1, height: 1 });
    const result = await run(folder, "-m", `${from}to${to}`, `dot.${from}`);
    expect(result.exitCode).toBe(0);
    await expectImage(path.join(folder, `dot.${to}`), to, 1, 1);
  });

  it.each(pairs)("converts %s to %s at the same size", async (from, to) => {
    const folder = makeFolder();
    await writeImage(folder, `picture.${from}`, from);
    const result = await run(folder, "-m", `${from}to${to}`, `picture.${from}`);
    expect(result.stderr).toBe("");
    await expectImage(path.join(folder, `picture.${to}`), to, 30, 20);
  });

  it("accepts the quality limits and rejects values outside them", async () => {
    const folder = makeFolder();
    await writeNoise(folder, "detail.png", "png");
    for (const quality of ["1", "100"]) {
      const result = await run(
        folder,
        "-m",
        "pngtojpg",
        "detail.png",
        "--quality",
        quality,
        "-o",
        `q${quality}`,
      );
      expect(result.exitCode).toBe(0);
    }
    for (const quality of ["0", "101", "abc"]) {
      const result = await run(
        folder,
        "-m",
        "pngtojpg",
        "detail.png",
        "--quality",
        quality,
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "--quality must be a whole number from 1 to 100",
      );
    }
  });

  it("makes smaller files at lower quality", async () => {
    const folder = makeFolder();
    await writeNoise(folder, "detail.png", "png");
    await run(
      folder,
      "-m",
      "pngtojpg",
      "detail.png",
      "--quality",
      "20",
      "-o",
      "low",
    );
    await run(
      folder,
      "-m",
      "pngtojpg",
      "detail.png",
      "--quality",
      "90",
      "-o",
      "high",
    );
    expect(statSync(path.join(folder, "low.jpg")).size).toBeLessThan(
      statSync(path.join(folder, "high.jpg")).size,
    );
  });

  it("keeps TIFF lossless unless a quality is given", async () => {
    const folder = makeFolder();
    await writeNoise(folder, "detail.png", "png");
    await run(folder, "-m", "pngtotiff", "detail.png", "-o", "exact");
    await run(
      folder,
      "-m",
      "pngtotiff",
      "detail.png",
      "--quality",
      "50",
      "-o",
      "small",
    );
    const source = await pixels(path.join(folder, "detail.png"));
    const exact = await pixels(path.join(folder, "exact.tiff"));
    expect(exact.data.equals(source.data)).toBe(true);
    expect(statSync(path.join(folder, "small.tiff")).size).toBeLessThan(
      statSync(path.join(folder, "exact.tiff")).size,
    );
  });

  it("fills lost transparency with white, or the chosen colour", async () => {
    const folder = makeFolder();
    await writeImage(folder, "clear.png", "png", { colour: transparent });
    await run(folder, "-m", "pngtojpg", "clear.png", "-o", "white");
    await run(
      folder,
      "-m",
      "pngtojpg",
      "clear.png",
      "--background",
      "red",
      "-o",
      "red",
    );
    const white = await pixels(path.join(folder, "white.jpg"));
    const red = await pixels(path.join(folder, "red.jpg"));
    expect([...white.data.subarray(0, 3)]).toEqual([255, 255, 255]);
    const [r = 0, g = 255, b = 255] = red.data;
    expect(r).toBeGreaterThan(250);
    expect(g).toBeLessThan(5);
    expect(b).toBeLessThan(5);
  });

  it("gives the same colour for hex and rgb() backgrounds", async () => {
    const folder = makeFolder();
    await writeImage(folder, "clear.png", "png", { colour: transparent });
    await run(
      folder,
      "-m",
      "pngtojpg",
      "clear.png",
      "--background",
      "#ff8800",
      "-o",
      "hex",
    );
    await run(
      folder,
      "-m",
      "pngtojpg",
      "clear.png",
      "--background",
      "rgb(255,136,0)",
      "-o",
      "rgb",
    );
    const hex = await pixels(path.join(folder, "hex.jpg"));
    const rgb = await pixels(path.join(folder, "rgb.jpg"));
    expect(hex.data.equals(rgb.data)).toBe(true);
    const rejected = await run(
      folder,
      "-m",
      "pngtojpg",
      "clear.png",
      "--background",
      "notacolour",
    );
    expect(rejected.exitCode).toBe(1);
  });

  it("keeps transparency in WebP", async () => {
    const folder = makeFolder();
    await writeImage(folder, "clear.png", "png", { colour: transparent });
    await run(folder, "-m", "pngtowebp", "clear.png");
    const metadata = await sharp(path.join(folder, "clear.webp")).metadata();
    expect(metadata.hasAlpha).toBe(true);
    const { data } = await sharp(path.join(folder, "clear.webp"))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it("keeps every pixel with --lossless", async () => {
    const folder = makeFolder();
    await writeNoise(folder, "detail.png", "png");
    await run(folder, "-m", "pngtowebp", "detail.png", "--lossless");
    const source = await pixels(path.join(folder, "detail.png"));
    const webp = await pixels(path.join(folder, "detail.webp"));
    expect(webp.data.equals(source.data)).toBe(true);
  });

  it("saves a progressive JPG", async () => {
    const folder = makeFolder();
    await writeNoise(folder, "detail.png", "png");
    await run(folder, "-m", "pngtojpg", "detail.png", "--progressive");
    const metadata = await sharp(path.join(folder, "detail.jpg")).metadata();
    expect(metadata.isProgressive).toBe(true);
  });

  it("makes a black and white image with --grayscale", async () => {
    const folder = makeFolder();
    await writeImage(folder, "red.png", "png", {
      colour: { r: 255, g: 0, b: 0, alpha: 1 },
    });
    await run(folder, "-m", "pngtojpg", "red.png", "--grayscale");
    const { data } = await pixels(path.join(folder, "red.jpg"));
    for (let index = 0; index < data.length; index += 3) {
      expect(data[index]).toBe(data[index + 1]);
      expect(data[index]).toBe(data[index + 2]);
    }
  });

  it("rejects --lossless for JPG", async () => {
    const folder = makeFolder();
    const result = await run(folder, "-m", "pngtojpg", "a.png", "--lossless");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--lossless can't be used with pngtojpg");
  });

  it("keeps animation for GIF to WebP", async () => {
    const folder = makeFolder();
    await writeAnimatedGif(folder, "moving.gif");
    await run(folder, "-m", "giftowebp", "moving.gif");
    const metadata = await sharp(path.join(folder, "moving.webp"), {
      animated: true,
    }).metadata();
    expect(metadata.pages).toBe(3);
  });

  it("uses the first frame for JPG, with a note", async () => {
    const folder = makeFolder();
    await writeAnimatedGif(folder, "moving.gif");
    const result = await run(folder, "-m", "giftojpg", "moving.gif");
    await expectImage(path.join(folder, "moving.jpg"), "jpg", 12, 10);
    expect(result.stdout).toContain(
      "  Note: only the first frame was kept, because JPG can't be animated\n",
    );
  });

  it("uses the first page of a multi-page TIFF, with a note", async () => {
    const folder = makeFolder();
    await writeMultiPageTiff(folder, "scans.tiff");
    const result = await run(folder, "-m", "tifftopng", "scans.tiff");
    await expectImage(path.join(folder, "scans.png"), "png", 12, 10);
    expect(result.stdout).toContain("  Note: only the first page was kept\n");
  });

  it("turns a sideways photo upright", async () => {
    const folder = makeFolder();
    await writeSidewaysJpg(folder, "phone.jpg");
    await run(folder, "-m", "jpgtopng", "phone.jpg");
    await expectImage(path.join(folder, "phone.png"), "png", 40, 60);
  });

  it("converts wide-gamut colours to sRGB", async () => {
    const folder = makeFolder();
    const source = await writeDisplayP3Png(folder, "wide.png");
    await run(folder, "-m", "pngtojpg", "wide.png", "--quality", "100");
    const output = path.join(folder, "wide.jpg");
    expect((await sharp(output).metadata()).icc).toBeUndefined();
    const expected = await sharp(source).toColourspace("srgb").raw().toBuffer();
    const { data } = await pixels(output);
    for (let channel = 0; channel < 3; channel++) {
      expect(
        Math.abs((data[channel] ?? 0) - (expected[channel] ?? 0)),
      ).toBeLessThan(6);
    }
    expect([...data.subarray(0, 3)]).not.toEqual([
      p3Colour.r,
      p3Colour.g,
      p3Colour.b,
    ]);
  });

  it("refuses an image that is too large", async () => {
    const folder = makeFolder();
    writeHugePng(folder, "huge.png");
    const result = await run(folder, "-m", "pngtojpg", "huge.png");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("is too large");
    expect(result.stderr).toContain("20000 × 20000");
    expect(result.stderr).not.toMatch(/^\s+at /m);
  });

  it.each([
    ["png", "pngtojpg"],
    ["jpg", "jpgtopng"],
  ])("says a truncated %s looks damaged", async (format, mode) => {
    const folder = makeFolder();
    truncate(await writeNoise(folder, `cut.${format}`, format));
    const result = await run(folder, "-m", mode, `cut.${format}`);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("looks damaged");
    expect(readdirSync(folder)).toEqual([`cut.${format}`]);
  });

  it("shows the decoder's own error with --verbose", async () => {
    const folder = makeFolder();
    truncate(await writeNoise(folder, "cut.png", "png"));
    const result = await run(folder, "-m", "pngtojpg", "cut.png", "--verbose");
    expect(result.stderr).toContain("looks damaged");
    expect(result.stderr).toMatch(/Caused by: Error: .*png/i);
  });

  it("converts a renamed PNG with tojpg", async () => {
    const folder = makeFolder();
    await writeImage(folder, "holiday.heic", "png");
    const result = await run(folder, "-m", "tojpg", "holiday.heic");
    expect(result.exitCode).toBe(0);
    await expectImage(path.join(folder, "holiday.jpg"), "jpg", 30, 20);
  });

  it("converts a mixed folder with tojpg", async () => {
    const folder = makeFolder();
    await writeImage(folder, "a.png", "png");
    await writeImage(folder, "b.webp", "webp");
    const result = await run(folder, "-m", "tojpg", ".", "-o", "jpgs");
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "jpgs")).sort()).toEqual([
      "a.jpg",
      "b.jpg",
    ]);
  });

  it("sorts out a messy folder with tojpg", async () => {
    const folder = makeFolder();
    await writeImage(folder, "chart.png", "png");
    await writeImage(folder, "photo.jpg", "jpg");
    writeSample(folder, "clip.mp4", "mp4");
    copyFileSync(
      path.join(projectFolder, "package.json"),
      path.join(folder, "notes.txt"),
    );
    const result = await run(folder, "-m", "tojpg", ".", "-o", "out");
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("1 converted, 2 failed, 1 skipped");
    expect(result.stdout).toContain("photo.jpg skipped: already a JPG");
    expect(existsSync(path.join(folder, "out", "chart.jpg"))).toBe(true);
  });

  it("shows the space saved for a folder of screenshots", async () => {
    const folder = makeFolder();
    for (const name of ["one", "two", "three"]) {
      await writeImage(folder, `${name}.png`, "png", {
        width: 400,
        height: 300,
      });
    }
    const result = await run(
      folder,
      "-m",
      "pngtowebp",
      ".",
      "--quality",
      "80",
      "-o",
      "webp",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.match(/^✓ .+ → webp.+ KB → .+$/gm)).toHaveLength(3);
    expect(result.stdout).toMatch(
      /3 converted, 0 failed, 0 skipped\. .+ KB → .+ \(−\d+%\)\./,
    );
  });
});
