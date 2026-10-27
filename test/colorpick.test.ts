import { Buffer } from "node:buffer";
import { copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { mainColours } from "../src/convert/colours.js";
import { makeFolder } from "./support/folders.js";
import { writeImage } from "./support/images.js";
import { runIn as run } from "./support/run-main.js";

async function writeStripes(folder: string, name: string) {
  const width = 100;
  const height = 20;
  const data = Buffer.alloc(width * height * 3);
  for (let index = 0; index < width * height; index++) {
    const x = index % width;
    data.set(
      x < 40 ? [255, 0, 0] : x < 70 ? [0, 255, 0] : [0, 0, 255],
      index * 3,
    );
  }
  await sharp(data, { raw: { width, height, channels: 3 } })
    .png()
    .toFile(path.join(folder, name));
}

const red = { r: 255, g: 0, b: 0, alpha: 1 };
const fixture = path.resolve("test", "fixtures", "iphone.heic");

describe("colorpick", () => {
  it("needs --at or --palette", async () => {
    const result = await run(makeFolder(), "-m", "colorpick", "logo.png");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Give --at, e.g. --at 10,10, or --palette, e.g. --palette 5.",
    );
  });

  it("reports a red pixel in HEX, RGB and HSL", async () => {
    const folder = makeFolder();
    await writeImage(folder, "red.png", "png", { colour: red });
    const result = await run(
      folder,
      "-m",
      "colorpick",
      "red.png",
      "--at",
      "0,0",
    );
    expect(result.stdout).toBe(
      "red.png\n  Pixel 0,0: #FF0000  rgb(255, 0, 0)  hsl(0, 100%, 50%)\n",
    );
  });

  it("prints one section per file", async () => {
    const folder = makeFolder();
    await writeImage(folder, "a.png", "png", { colour: red });
    await writeImage(folder, "b.png", "png");
    const result = await run(
      folder,
      "-m",
      "colorpick",
      "a.png",
      "b.png",
      "--at",
      "1,1",
    );
    expect(result.stdout.split("\n\n")).toHaveLength(2);
  });

  it("finds the main colours, most common first", async () => {
    const folder = makeFolder();
    await writeStripes(folder, "stripes.png");
    const result = await run(
      folder,
      "-m",
      "colorpick",
      "stripes.png",
      "--palette",
      "3",
      "--json",
    );
    const [entry] = JSON.parse(result.stdout);
    expect(entry.palette.map((colour: { hex: string }) => colour.hex)).toEqual([
      "#FF0000",
      expect.stringMatching(/^#(00FF00|0000FF)$/),
      expect.stringMatching(/^#(00FF00|0000FF)$/),
    ]);
    expect(entry.palette[0].share).toBeCloseTo(0.4, 2);
  });

  it("keeps identical values together when splitting", () => {
    const pixels: [number, number, number, number][] = [
      ...Array(4).fill([255, 0, 0, 255]),
      ...Array(3).fill([0, 255, 0, 255]),
      ...Array(3).fill([0, 0, 255, 255]),
    ];
    const colours = mainColours(pixels, 3).map(({ pixel }) =>
      pixel.slice(0, 3),
    );
    expect(colours).toContainEqual([255, 0, 0]);
    expect(colours).toContainEqual([0, 255, 0]);
    expect(colours).toContainEqual([0, 0, 255]);
  });

  it("works on the last pixel and refuses one past it", async () => {
    const folder = makeFolder();
    await writeImage(folder, "card.png", "png", { width: 100, height: 50 });
    const last = await run(
      folder,
      "-m",
      "colorpick",
      "card.png",
      "--at",
      "99,49",
    );
    expect(last.exitCode).toBe(0);
    const past = await run(
      folder,
      "-m",
      "colorpick",
      "card.png",
      "--at",
      "100,49",
    );
    expect(past.exitCode).toBe(1);
    expect(past.stderr).toContain(
      "is outside the image, which is 100 × 50 pixels",
    );
  });

  it("accepts --palette from 1 to 16 only", async () => {
    const folder = makeFolder();
    await writeStripes(folder, "stripes.png");
    for (const count of ["1", "16"]) {
      expect(
        (
          await run(
            folder,
            "-m",
            "colorpick",
            "stripes.png",
            "--palette",
            count,
          )
        ).exitCode,
      ).toBe(0);
    }
    for (const count of ["0", "17", "abc"]) {
      const result = await run(
        folder,
        "-m",
        "colorpick",
        "stripes.png",
        "--palette",
        count,
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "--palette must be a whole number from 1 to 16",
      );
    }
  });

  it("reports a half-transparent pixel's alpha", async () => {
    const folder = makeFolder();
    await sharp(Buffer.from([255, 0, 0, 128]), {
      raw: { width: 1, height: 1, channels: 4 },
    })
      .png()
      .toFile(path.join(folder, "glass.png"));
    const result = await run(
      folder,
      "-m",
      "colorpick",
      "glass.png",
      "--at",
      "0,0",
    );
    expect(result.stdout).toContain(
      "#FF000080  rgba(255, 0, 0, 0.5)  hsla(0, 100%, 50%, 0.5)",
    );
  });

  it("prints valid JSON with every field", async () => {
    const folder = makeFolder();
    await writeStripes(folder, "stripes.png");
    const result = await run(
      folder,
      "-m",
      "colorpick",
      "stripes.png",
      "--at",
      "0,0",
      "--palette",
      "3",
      "--json",
    );
    const [entry] = JSON.parse(result.stdout);
    expect(entry.file).toBe("stripes.png");
    expect(entry.at).toEqual({
      x: 0,
      y: 0,
      hex: "#FF0000",
      rgb: [255, 0, 0],
      hsl: [0, 100, 50],
      alpha: 1,
    });
    expect(entry.palette).toHaveLength(3);
    for (const colour of entry.palette) {
      expect(Object.keys(colour).sort()).toEqual([
        "alpha",
        "hex",
        "hsl",
        "rgb",
        "share",
      ]);
    }
  });

  it("works with every supported image format", async () => {
    const folder = makeFolder();
    for (const format of ["jpg", "png", "webp", "avif", "gif", "tiff"]) {
      await writeImage(folder, `image.${format}`, format);
    }
    await run(folder, "-m", "pngtobmp", "image.png");
    await run(folder, "-m", "pngtoico", "image.png", "--sizes", "32");
    copyFileSync(fixture, path.join(folder, "photo.heic"));
    writeFileSync(
      path.join(folder, "logo.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="red"/></svg>',
    );
    const result = await run(
      folder,
      "-m",
      "colorpick",
      ".",
      "--at",
      "0,0",
      "--json",
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveLength(10);
  });

  it("rejects -o and bad points", async () => {
    const withOutput = await run(
      makeFolder(),
      "-m",
      "colorpick",
      "logo.png",
      "--at",
      "0,0",
      "-o",
      "colours",
    );
    expect(withOutput.stderr).toContain(
      "colorpick doesn't create files, so -o can't be used",
    );
    for (const point of ["10", "-1,5", "a,b"]) {
      const result = await run(
        makeFolder(),
        "-m",
        "colorpick",
        "logo.png",
        "--at",
        point,
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "--at must be two whole numbers such as 10,20",
      );
    }
  });

  it("pulls a brand photo's five main colours, even from a JPG", async () => {
    const folder = makeFolder();
    const brand = [
      [0xe6, 0x39, 0x46],
      [0xf1, 0xfa, 0xee],
      [0xa8, 0xda, 0xdc],
      [0x45, 0x7b, 0x9d],
      [0x1d, 0x35, 0x57],
    ];
    const width = 250;
    const height = 50;
    const data = Buffer.alloc(width * height * 3);
    for (let index = 0; index < width * height; index++) {
      data.set(brand[Math.floor((index % width) / 50)] ?? [0, 0, 0], index * 3);
    }
    await sharp(data, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 90 })
      .toFile(path.join(folder, "brand.jpg"));
    const result = await run(
      folder,
      "-m",
      "colorpick",
      "brand.jpg",
      "--palette",
      "5",
      "--json",
    );
    const [entry] = JSON.parse(result.stdout);
    expect(entry.palette).toHaveLength(5);
    for (const colour of brand) {
      const nearest = Math.min(
        ...entry.palette.map((found: { rgb: number[] }) =>
          Math.max(
            ...found.rgb.map((value, channel) =>
              Math.abs(value - (colour[channel] ?? 0)),
            ),
          ),
        ),
      );
      expect(nearest).toBeLessThan(12);
    }
  });
});
