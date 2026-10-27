import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { formatSize } from "../src/report.js";
import { makeFolder } from "./support/folders.js";
import { runIn as run } from "./support/run-main.js";
import { writeSample } from "./support/samples.js";

function photoPixels(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 11;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const index = (y * width + x) * 3;
      pixels[index] = (x * 255) / width + (seed % 40);
      pixels[index + 1] = (y * 255) / height + ((seed >> 8) % 40);
      pixels[index + 2] = 128 + ((seed >> 16) % 60);
    }
  }
  return pixels;
}

async function writePhoto(
  folder: string,
  name: string,
  format: "jpeg" | "png" | "webp" = "jpeg",
  width = 900,
  height = 600,
): Promise<string> {
  const file = path.join(folder, name);
  await sharp(photoPixels(width, height), {
    raw: { width, height, channels: 3 },
  })
    .toFormat(format, { quality: 95 })
    .toFile(file);
  return file;
}

async function writeScreenshot(folder: string, name: string): Promise<string> {
  const width = 400;
  const height = 300;
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    const x = index % width;
    const y = Math.floor(index / width);
    pixels[index * 4] = Math.floor(x / 20) * 12;
    pixels[index * 4 + 1] = Math.floor(y / 20) * 16;
    pixels[index * 4 + 2] = (x + y) % 256;
    pixels[index * 4 + 3] = 255;
  }
  const file = path.join(folder, name);
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(file);
  return file;
}

async function writeMovingGif(folder: string, name: string): Promise<string> {
  const width = 80;
  const frameHeight = 60;
  const frames = 6;
  const pixels = Buffer.alloc(width * frameHeight * frames * 4);
  let seed = 3;
  for (let index = 0; index < width * frameHeight * frames; index++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const x = index % width;
    const y = Math.floor(index / width) % frameHeight;
    const jitter = seed % 10;
    pixels[index * 4] = (x * 3 + jitter) % 256;
    pixels[index * 4 + 1] = (y * 4 + jitter) % 256;
    pixels[index * 4 + 2] = ((x + y) * 2 + jitter) % 256;
    pixels[index * 4 + 3] = 255;
  }
  const file = path.join(folder, name);
  await sharp(pixels, {
    raw: {
      width,
      height: frameHeight * frames,
      channels: 4,
      pageHeight: frameHeight,
    },
  })
    .gif({ loop: 0, delay: Array(frames).fill(100) })
    .toFile(file);
  return file;
}

const sizeOf = (file: string) => statSync(file).size;

describe("compress", () => {
  it("uses the medium level when no option is given", async () => {
    const folder = makeFolder();
    await writePhoto(folder, "hero.jpg");
    await run(folder, "-m", "compress", "hero.jpg", "-o", "default");
    await run(
      folder,
      "-m",
      "compress",
      "hero.jpg",
      "--level",
      "medium",
      "-o",
      "medium",
    );
    expect(sizeOf(path.join(folder, "default.jpg"))).toBe(
      sizeOf(path.join(folder, "medium.jpg")),
    );
  });

  it("makes a large JPG smaller at the same dimensions", async () => {
    const folder = makeFolder();
    const source = await writePhoto(folder, "hero.jpg");
    const result = await run(folder, "-m", "compress", "hero.jpg");
    const output = path.join(folder, "hero-compressed.jpg");
    expect(sizeOf(output)).toBeLessThan(sizeOf(source));
    const { width, height } = await sharp(output).metadata();
    expect([width, height]).toEqual([900, 600]);
    expect(result.stdout).toMatch(
      /✓ hero\.jpg → hero-compressed\.jpg {2}.+ → .+ \(−\d+%\)/,
    );
  });

  it("compresses a mixed folder, and the totals match the lines", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "images"));
    const images = path.join(folder, "images");
    await writePhoto(images, "photo.jpg");
    await writeScreenshot(images, "screen.png");
    await writePhoto(images, "banner.webp", "webp");
    const result = await run(folder, "-m", "compress", "images", "-o", "small");
    expect(result.exitCode).toBe(0);
    const outputs = readdirSync(path.join(folder, "small"));
    expect(outputs).toHaveLength(3);
    const before = ["photo.jpg", "screen.png", "banner.webp"]
      .map((name) => sizeOf(path.join(images, name)))
      .reduce((sum, size) => sum + size, 0);
    const after = outputs
      .map((name) => sizeOf(path.join(folder, "small", name)))
      .reduce((sum, size) => sum + size, 0);
    expect(result.stdout).toContain(
      `3 converted, 0 failed, 0 skipped. ${formatSize(before)} → ${formatSize(after)}`,
    );
  });

  it("makes smaller files at a higher level", async () => {
    const folder = makeFolder();
    await writePhoto(folder, "hero.jpg");
    await run(
      folder,
      "-m",
      "compress",
      "hero.jpg",
      "--level",
      "high",
      "-o",
      "high",
    );
    await run(
      folder,
      "-m",
      "compress",
      "hero.jpg",
      "--level",
      "low",
      "-o",
      "low",
    );
    expect(sizeOf(path.join(folder, "high.jpg"))).toBeLessThan(
      sizeOf(path.join(folder, "low.jpg")),
    );
  });

  it("reaches a target size at the highest quality that fits", async () => {
    const folder = makeFolder();
    await writePhoto(folder, "big.jpg", "jpeg", 1600, 1200);
    const result = await run(
      folder,
      "-m",
      "compress",
      "big.jpg",
      "--target-size",
      "200kb",
      "--verbose",
    );
    const output = path.join(folder, "big-compressed.jpg");
    expect(sizeOf(output)).toBeLessThanOrEqual(200 * 1024);
    const chosen = Number(/chosen quality (\d+)/.exec(result.stdout)?.[1]);
    expect(chosen).toBeGreaterThan(1);
    await run(
      folder,
      "-m",
      "compress",
      "big.jpg",
      "--quality",
      String(chosen + 1),
      "-o",
      "higher",
    );
    expect(sizeOf(path.join(folder, "higher.jpg"))).toBeGreaterThan(200 * 1024);
  });

  it.each(["200kb", "200KB", "1mb", "1.5Mb"])(
    "accepts --target-size %s",
    async (size) => {
      const folder = makeFolder();
      await writePhoto(folder, "hero.jpg", "jpeg", 300, 200);
      const result = await run(
        folder,
        "-m",
        "compress",
        "hero.jpg",
        "--target-size",
        size,
      );
      expect(result.stderr).not.toContain("must be");
    },
  );

  it.each(["0kb", "-5kb", "200"])("rejects --target-size %s", async (size) => {
    const result = await run(
      makeFolder(),
      "-m",
      "compress",
      "hero.jpg",
      "--target-size",
      size,
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "--target-size must be a size such as 200kb or 1.5mb",
    );
  });

  it("keeps the smallest result when the target can't be reached", async () => {
    const folder = makeFolder();
    await writePhoto(folder, "hero.jpg");
    const result = await run(
      folder,
      "-m",
      "compress",
      "hero.jpg",
      "--target-size",
      "1kb",
    );
    expect(existsSync(path.join(folder, "hero-compressed.jpg"))).toBe(true);
    expect(result.stdout).toContain("Note: couldn't get below 1.0 KB");
  });

  it("skips an image that can't get smaller", async () => {
    const folder = makeFolder();
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: "teal" },
    })
      .jpeg({ quality: 30 })
      .toFile(path.join(folder, "tiny.jpg"));
    const result = await run(folder, "-m", "compress", "tiny.jpg");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("- tiny.jpg skipped: already optimised");
    expect(result.stdout).toContain("0 converted, 0 failed, 1 skipped");
    expect(readdirSync(folder)).toEqual(["tiny.jpg"]);
  });

  it("keeps a PNG transparent", async () => {
    const folder = makeFolder();
    const file = await writeScreenshot(folder, "screen.png");
    await sharp(file)
      .composite([
        {
          input: {
            create: {
              width: 50,
              height: 50,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          },
          blend: "dest-out",
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toFile(path.join(folder, "clear.png"));
    await run(folder, "-m", "compress", "clear.png");
    const output = path.join(folder, "clear-compressed.png");
    const { data } = await sharp(output)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    expect(data[(299 * 400 + 399) * 4 + 3]).toBe(255);
  });

  it.each([
    ["--level", "high"],
    ["--target-size", "200kb"],
  ])("rejects --quality with %s", async (option, value) => {
    const result = await run(
      makeFolder(),
      "-m",
      "compress",
      "hero.jpg",
      "--quality",
      "60",
      option,
      value,
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Use only one of --quality, --level and --target-size.",
    );
  });

  it.each(["bmp", "ico"])(
    "explains which formats it works with for %s",
    async (format) => {
      const folder = makeFolder();
      writeSample(folder, `old.${format}`, format);
      const result = await run(folder, "-m", "compress", `old.${format}`);
      expect(result.stderr).toContain(
        "compress works with JPG, PNG, WebP, AVIF, GIF",
      );
    },
  );

  it("keeps an animated GIF animated, and smaller at a higher level", async () => {
    const folder = makeFolder();
    await writeMovingGif(folder, "moving.gif");
    await run(
      folder,
      "-m",
      "compress",
      "moving.gif",
      "--level",
      "high",
      "-o",
      "high",
    );
    await run(
      folder,
      "-m",
      "compress",
      "moving.gif",
      "--level",
      "low",
      "-o",
      "low",
    );
    const high = path.join(folder, "high.gif");
    expect((await sharp(high, { animated: true }).metadata()).pages).toBe(6);
    expect(sizeOf(high)).toBeLessThan(sizeOf(path.join(folder, "low.gif")));
  });

  it("names the output after the file's real format", async () => {
    const folder = makeFolder();
    await writeScreenshot(folder, "screen.jpg");
    const result = await run(folder, "-m", "compress", "screen.jpg");
    expect(result.exitCode).toBe(0);
    const output = path.join(folder, "screen-compressed.png");
    expect((await sharp(output).metadata()).format).toBe("png");
    expect(result.stdout).toContain(
      "Note: saved as .png, because screen.jpg is really a PNG file",
    );
  });

  it("removes details with --strip-metadata", async () => {
    const folder = makeFolder();
    await sharp(photoPixels(300, 200), {
      raw: { width: 300, height: 200, channels: 3 },
    })
      .withExif({ IFD0: { Make: "Canon" } })
      .jpeg({ quality: 95 })
      .toFile(path.join(folder, "photo.jpg"));
    await run(folder, "-m", "compress", "photo.jpg", "--strip-metadata");
    expect(
      (await sharp(path.join(folder, "photo-compressed.jpg")).metadata()).exif,
    ).toBeUndefined();
  });

  it("compresses a website's images folder and shows the total saved", async () => {
    const folder = makeFolder();
    const images = path.join(folder, "images");
    mkdirSync(images);
    await writePhoto(images, "hero.jpg");
    await writePhoto(images, "team.jpg", "jpeg", 600, 400);
    await writeScreenshot(images, "dashboard.png");
    const result = await run(
      folder,
      "-m",
      "compress",
      "./images",
      "-o",
      "./images-small",
    );
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "images-small"))).toHaveLength(3);
    expect(result.stdout).toMatch(
      /3 converted, 0 failed, 0 skipped\. .+ → .+ \(−\d+%\)\./,
    );
  });
});
