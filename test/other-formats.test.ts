import { Buffer } from "node:buffer";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { encode as encodeBmp } from "bmp-ts";
import decodeIco from "decode-ico";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { writeIco } from "../src/convert/ico.js";
import { makeFolder } from "./support/folders.js";
import { pixels, sharpFormats, writeImage } from "./support/images.js";
import { runIn as run } from "./support/run-main.js";

const fixtures = path.resolve("test", "fixtures");
const imageOutputs = [
  "jpg",
  "png",
  "webp",
  "avif",
  "gif",
  "tiff",
  "bmp",
  "ico",
];
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function copyFixture(folder: string, name: string, as = name): string {
  const file = path.join(folder, as);
  copyFileSync(path.join(fixtures, name), file);
  return file;
}

async function size(file: string) {
  const { width, height } = await sharp(file).metadata();
  return [width, height];
}

function writeSvg(folder: string, name: string, markup: string): string {
  const file = path.join(folder, name);
  writeFileSync(file, markup);
  return file;
}

function svg(attributes: string, body = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;
}

function iconEntries(file: string) {
  const contents = readFileSync(file);
  const count = contents.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const length = contents.readUInt32LE(entry + 8);
    const offset = contents.readUInt32LE(entry + 12);
    return {
      width: contents.readUInt8(entry),
      height: contents.readUInt8(entry + 1),
      png: contents.subarray(offset, offset + length),
    };
  });
}

async function iconSizes(file: string) {
  return decodeIco(readFileSync(file)).map((image) => image.width);
}

function writeBmp(
  folder: string,
  name: string,
  rgb: [number, number, number],
): string {
  const file = path.join(folder, name);
  writeFileSync(
    file,
    encodeBmp({
      width: 1,
      height: 1,
      data: Buffer.from([255, rgb[2], rgb[1], rgb[0]]),
      bitPP: 24,
    }).data,
  );
  return file;
}

function writePaletteBmp(folder: string, name: string): string {
  const palette = Buffer.from([0, 128, 255, 0]);
  const pixelsRow = Buffer.from([0, 0, 0, 0]);
  const header = Buffer.alloc(54);
  header.write("BM", 0, "latin1");
  header.writeUInt32LE(54 + palette.length + pixelsRow.length, 2);
  header.writeUInt32LE(54 + palette.length, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(2, 18);
  header.writeInt32LE(1, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(8, 28);
  header.writeUInt32LE(1, 46);
  const file = path.join(folder, name);
  writeFileSync(file, Buffer.concat([header, palette, pixelsRow]));
  return file;
}

function bmpEntryIco(folder: string, name: string): string {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(2, 4);
  header.writeInt32LE(4, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const colours = Buffer.from(Array(4).fill([0, 0, 255, 255]).flat());
  const mask = Buffer.alloc(8);
  const image = Buffer.concat([header, colours, mask]);
  const directory = Buffer.alloc(22);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(1, 4);
  directory.writeUInt8(2, 6);
  directory.writeUInt8(2, 7);
  directory.writeUInt16LE(1, 10);
  directory.writeUInt16LE(32, 12);
  directory.writeUInt32LE(image.length, 14);
  directory.writeUInt32LE(22, 18);
  const file = path.join(folder, name);
  writeFileSync(file, Buffer.concat([directory, image]));
  return file;
}

describe("HEIC", () => {
  it("fails an empty file", async () => {
    const folder = makeFolder();
    writeFileSync(path.join(folder, "photo.heic"), "");
    const result = await run(folder, "-m", "heictojpg", "photo.heic");
    expect(result.stderr).toContain("is empty");
  });

  it("converts an iPhone photo upright, at its displayed size", async () => {
    const folder = makeFolder();
    copyFixture(folder, "iphone.heic");
    const result = await run(folder, "-m", "heictojpg", "iphone.heic");
    expect(result.exitCode).toBe(0);
    const output = path.join(folder, "iphone.jpg");
    expect(await size(output)).toEqual([48, 64]);
    const { data, info } = await pixels(output);
    const at = (x: number, y: number) => [
      ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
    ];
    const [topLeftRed = 255, , topLeftBlue = 0] = at(4, 4);
    const [topRightRed = 0, , topRightBlue = 255] = at(info.width - 5, 4);
    expect(topLeftBlue).toBeGreaterThan(200);
    expect(topLeftRed).toBeLessThan(60);
    expect(topRightRed).toBeGreaterThan(200);
    expect(topRightBlue).toBeLessThan(60);
  });

  it.each(imageOutputs)("converts to %s", async (target) => {
    const folder = makeFolder();
    copyFixture(folder, "iphone.heic");
    const result = await run(folder, "-m", `heicto${target}`, "iphone.heic");
    expect(result.stderr).toBe("");
    expect(readdirSync(folder)).toContain(`iphone.${target}`);
  });

  it("uses only the main image of a file with several", async () => {
    const folder = makeFolder();
    copyFixture(folder, "burst.heic");
    await run(folder, "-m", "heictopng", "burst.heic");
    expect(readdirSync(folder).sort()).toEqual(["burst.heic", "burst.png"]);
    expect(await size(path.join(folder, "burst.png"))).toEqual([80, 40]);
  });

  it("converts a folder of twenty photos", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "iphone"));
    for (let number = 1; number <= 20; number++) {
      copyFixture(
        folder,
        "iphone.heic",
        path.join("iphone", `IMG_${number}.heic`),
      );
    }
    const result = await run(folder, "-m", "heictojpg", "iphone", "-o", "jpgs");
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "jpgs"))).toHaveLength(20);
  });

  it("converts a mixed HEIC, PNG and WebP folder with tojpg", async () => {
    const folder = makeFolder();
    copyFixture(folder, "iphone.heic");
    await writeImage(folder, "chart.png", "png");
    await writeImage(folder, "sticker.webp", "webp");
    const result = await run(folder, "-m", "tojpg", ".", "-o", "jpgs");
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "jpgs")).sort()).toEqual([
      "chart.jpg",
      "iphone.jpg",
      "sticker.jpg",
    ]);
  });
});

describe("BMP", () => {
  it("converts a 1 × 1 BMP to PNG and back", async () => {
    const folder = makeFolder();
    writeBmp(folder, "dot.bmp", [200, 50, 10]);
    await run(folder, "-m", "bmptopng", "dot.bmp", "-o", "dot-copy");
    await run(folder, "-m", "pngtobmp", "dot-copy.png", "-o", "again");
    const png = await pixels(path.join(folder, "dot-copy.png"));
    expect([png.info.width, png.info.height]).toEqual([1, 1]);
    expect([...png.data.subarray(0, 3)]).toEqual([200, 50, 10]);
    const back = await run(
      folder,
      "-m",
      "bmptopng",
      "again.bmp",
      "-o",
      "check",
    );
    expect(back.exitCode).toBe(0);
    const check = await pixels(path.join(folder, "check.png"));
    expect([...check.data.subarray(0, 3)]).toEqual([200, 50, 10]);
  });

  it("reads the colours of a palette BMP", async () => {
    const folder = makeFolder();
    writePaletteBmp(folder, "orange.bmp");
    await run(folder, "-m", "bmptopng", "orange.bmp");
    const { data, info } = await pixels(path.join(folder, "orange.png"));
    expect([info.width, info.height]).toEqual([2, 1]);
    expect([...data.subarray(0, 3)]).toEqual([255, 128, 0]);
  });

  it("makes a BMP of the same size from any image", async () => {
    const folder = makeFolder();
    await writeImage(folder, "photo.webp", "webp");
    await run(folder, "-m", "tobmp", "photo.webp");
    await run(folder, "-m", "bmptopng", "photo.bmp");
    expect(await size(path.join(folder, "photo.png"))).toEqual([30, 20]);
  });

  it("fills transparency with white", async () => {
    const folder = makeFolder();
    await writeImage(folder, "clear.png", "png", { colour: transparent });
    await run(folder, "-m", "pngtobmp", "clear.png");
    await run(folder, "-m", "bmptopng", "clear.bmp", "-o", "check");
    const { data } = await pixels(path.join(folder, "check.png"));
    expect([...data.subarray(0, 3)]).toEqual([255, 255, 255]);
  });
});

describe("ICO", () => {
  it("holds 16, 32 and 48 pixel images by default", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png", { width: 64, height: 64 });
    await run(folder, "-m", "pngtoico", "logo.png");
    expect(await iconSizes(path.join(folder, "logo.ico"))).toEqual([
      16, 32, 48,
    ]);
  });

  it("holds the chosen sizes", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png", { width: 64, height: 64 });
    await run(
      folder,
      "-m",
      "pngtoico",
      "logo.png",
      "--sizes",
      "16,32,64,128,256",
    );
    expect(await iconSizes(path.join(folder, "logo.ico"))).toEqual([
      16, 32, 64, 128, 256,
    ]);
  });

  it("writes a standard container with PNG entries", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png", { width: 64, height: 64 });
    await run(folder, "-m", "pngtoico", "logo.png", "--sizes", "256");
    const file = path.join(folder, "logo.ico");
    const contents = readFileSync(file);
    expect([contents.readUInt16LE(0), contents.readUInt16LE(2)]).toEqual([
      0, 1,
    ]);
    const [entry] = iconEntries(file);
    expect([entry?.width, entry?.height]).toEqual([0, 0]);
    const png = await sharp(entry?.png).metadata();
    expect([png.format, png.width, png.height]).toEqual(["png", 256, 256]);
  });

  it("pads a wide image to a square without stretching", async () => {
    const folder = makeFolder();
    await writeImage(folder, "banner.png", "png", {
      width: 60,
      height: 30,
      colour: { r: 255, g: 0, b: 0, alpha: 1 },
    });
    await run(folder, "-m", "pngtoico", "banner.png", "--sizes", "32");
    const [entry] = iconEntries(path.join(folder, "banner.ico"));
    const { data } = await sharp(entry?.png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (y: number) => data[(y * 32 + 16) * 4 + 3];
    expect(alphaAt(2)).toBe(0);
    expect(alphaAt(16)).toBe(255);
    expect(alphaAt(29)).toBe(0);
  });

  it("converts from the largest image", async () => {
    const folder = makeFolder();
    const pngs = await Promise.all(
      [16, 32, 48].map(async (iconSize) => ({
        size: iconSize,
        png: await sharp({
          create: {
            width: iconSize,
            height: iconSize,
            channels: 4,
            background: "red",
          },
        })
          .png()
          .toBuffer(),
      })),
    );
    writeFileSync(path.join(folder, "favicon.ico"), writeIco(pngs));
    await run(folder, "-m", "icotopng", "favicon.ico");
    expect(await size(path.join(folder, "favicon.png"))).toEqual([48, 48]);
  });

  it("reads icons stored as bitmaps", async () => {
    const folder = makeFolder();
    bmpEntryIco(folder, "old.ico");
    const result = await run(folder, "-m", "icotopng", "old.ico");
    expect(result.exitCode).toBe(0);
    const { data, info } = await pixels(path.join(folder, "old.png"));
    expect([info.width, info.height]).toEqual([2, 2]);
    expect([...data.subarray(0, 3)]).toEqual([255, 0, 0]);
  });
});

describe("SVG", () => {
  it("uses its own size", async () => {
    const folder = makeFolder();
    writeSvg(folder, "logo.svg", svg('width="120" height="80"'));
    await run(folder, "-m", "svgtopng", "logo.svg");
    expect(await size(path.join(folder, "logo.png"))).toEqual([120, 80]);
  });

  it("uses its own size when it is given in other units", async () => {
    const folder = makeFolder();
    writeSvg(folder, "print.svg", svg('width="200pt" height="100pt"'));
    await run(folder, "-m", "svgtopng", "print.svg");
    const [width = 0, height = 0] = await size(path.join(folder, "print.png"));
    expect(width / height).toBe(2);
  });

  it("is 512 pixels wide with only a viewBox", async () => {
    const folder = makeFolder();
    writeSvg(folder, "logo.svg", svg('viewBox="0 0 100 50"'));
    await run(folder, "-m", "svgtopng", "logo.svg");
    expect(await size(path.join(folder, "logo.png"))).toEqual([512, 256]);
  });

  it("is 512 pixels wide with only one dimension", async () => {
    const folder = makeFolder();
    writeSvg(folder, "logo.svg", svg('width="100"'));
    await run(folder, "-m", "svgtopng", "logo.svg");
    expect((await size(path.join(folder, "logo.png")))[0]).toBe(512);
  });

  it("makes a blank image from an empty SVG", async () => {
    const folder = makeFolder();
    writeSvg(folder, "empty.svg", svg(""));
    await run(folder, "-m", "svgtopng", "empty.svg");
    const output = path.join(folder, "empty.png");
    expect((await size(output))[0]).toBe(512);
    const { data } = await sharp(output)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data.every((value, index) => index % 4 !== 3 || value === 0)).toBe(
      true,
    );
  });

  it("draws sharply at a large --width", async () => {
    const folder = makeFolder();
    const markup = svg(
      'width="100" height="100"',
      '<line x1="0" y1="0" x2="100" y2="100" stroke="black" stroke-width="1"/>',
    );
    writeSvg(folder, "line.svg", markup);
    await run(folder, "-m", "svgtopng", "line.svg", "--width", "2000");
    const output = path.join(folder, "line.png");
    expect(await size(output)).toEqual([2000, 2000]);
    const direct = await sharp(Buffer.from(markup), { density: 1440 })
      .raw()
      .toBuffer();
    const made = await sharp(output).raw().toBuffer();
    expect(made.equals(direct)).toBe(true);
  });

  it("uses --dpi", async () => {
    const folder = makeFolder();
    writeSvg(folder, "logo.svg", svg('width="100" height="50"'));
    await run(folder, "-m", "svgtopng", "logo.svg", "--dpi", "144");
    expect(await size(path.join(folder, "logo.png"))).toEqual([200, 100]);
  });

  it("fits inside --width and --height", async () => {
    const folder = makeFolder();
    writeSvg(folder, "logo.svg", svg('width="120" height="80"'));
    await run(
      folder,
      "-m",
      "svgtopng",
      "logo.svg",
      "--width",
      "300",
      "--height",
      "300",
    );
    expect(await size(path.join(folder, "logo.png"))).toEqual([300, 200]);
  });

  it("refuses a size too large to draw", async () => {
    const folder = makeFolder();
    writeSvg(folder, "dot.svg", svg('width="1" height="1"'));
    const result = await run(
      folder,
      "-m",
      "svgtopng",
      "dot.svg",
      "--width",
      "200000",
    );
    expect(result.stderr).toContain("would be too large to draw");
  });

  it.each(imageOutputs)("converts to %s", async (target) => {
    const folder = makeFolder();
    writeSvg(
      folder,
      "logo.svg",
      svg(
        'width="40" height="40"',
        '<circle cx="20" cy="20" r="10" fill="red"/>',
      ),
    );
    const result = await run(folder, "-m", `svgto${target}`, "logo.svg");
    expect(result.stderr).toBe("");
    expect(readdirSync(folder)).toContain(`logo.${target}`);
  });

  it("keeps transparency for PNG and fills it for JPG", async () => {
    const folder = makeFolder();
    writeSvg(folder, "logo.svg", svg('width="10" height="10"'));
    await run(folder, "-m", "svgtopng", "logo.svg");
    await run(folder, "-m", "svgtojpg", "logo.svg");
    const png = await sharp(path.join(folder, "logo.png"))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(png.data[3]).toBe(0);
    const jpg = await pixels(path.join(folder, "logo.jpg"));
    expect([...jpg.data.subarray(0, 3)]).toEqual([255, 255, 255]);
  });

  it("doesn't load an image the SVG links to", async () => {
    const folder = makeFolder();
    await writeImage(folder, "red.png", "png", {
      width: 8,
      height: 8,
      colour: { r: 255, g: 0, b: 0, alpha: 1 },
    });
    writeSvg(
      folder,
      "linked.svg",
      svg(
        'width="8" height="8"',
        '<image href="red.png" width="8" height="8"/>',
      ),
    );
    await run(folder, "-m", "svgtopng", "linked.svg", "-o", "out");
    const { data } = await sharp(path.join(folder, "out.png"))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it("converts an SVG with no extension", async () => {
    const folder = makeFolder();
    writeSvg(folder, "logo", svg('width="20" height="10"'));
    const result = await run(folder, "-m", "topng", "logo");
    expect(result.exitCode).toBe(0);
    expect(await size(path.join(folder, "logo.png"))).toEqual([20, 10]);
  });
});

describe("any image to BMP and ICO", () => {
  it.each(["tobmp", "toico"])(
    "%s takes a JPG, a HEIC and an SVG",
    async (mode) => {
      const folder = makeFolder();
      await writeImage(folder, "photo.jpg", "jpg");
      copyFixture(folder, "iphone.heic");
      writeSvg(folder, "logo.svg", svg('width="20" height="20"'));
      const result = await run(folder, "-m", mode, ".", "-o", "out");
      expect(result.exitCode).toBe(0);
      expect(readdirSync(path.join(folder, "out"))).toHaveLength(3);
    },
  );

  it("lists BMP and ICO modes", async () => {
    const result = await run(makeFolder(), "--list-modes");
    expect(result.stdout).toMatch(/^ {2}tobmp /m);
    expect(result.stdout).toMatch(/^ {2}toico /m);
  });

  it.each(["pngtoheic", "toheic", "pngtosvg", "tosvg"])(
    "explains %s isn't possible",
    async (mode) => {
      const result = await run(makeFolder(), "-m", mode, "a.png");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(
        /can read (HEIC|SVG) files but can't create them/,
      );
    },
  );
});

describe("damaged files", () => {
  async function damagedReason(folder: string, mode: string, file: string) {
    const result = await run(folder, "-m", mode, file);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).not.toContain("Could not parse");
    return result.stderr;
  }

  it("says a truncated HEIC looks damaged", async () => {
    const folder = makeFolder();
    const file = copyFixture(folder, "iphone.heic");
    const contents = readFileSync(file);
    writeFileSync(file, contents.subarray(0, contents.length / 2));
    expect(await damagedReason(folder, "heictopng", "iphone.heic")).toContain(
      "looks damaged",
    );
  });

  it("says a broken BMP looks damaged", async () => {
    const folder = makeFolder();
    const header = Buffer.alloc(54);
    header.write("BM", 0, "latin1");
    header.writeUInt32LE(54, 10);
    header.writeUInt32LE(40, 14);
    header.writeInt32LE(100000, 18);
    header.writeInt32LE(100000, 22);
    header.writeUInt16LE(1, 26);
    header.writeUInt16LE(24, 28);
    writeFileSync(path.join(folder, "broken.bmp"), header);
    expect(await damagedReason(folder, "bmptopng", "broken.bmp")).toContain(
      "looks damaged",
    );
  });

  it("says a broken ICO looks damaged", async () => {
    const folder = makeFolder();
    const directory = Buffer.alloc(22);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(1, 4);
    directory.writeUInt8(16, 6);
    directory.writeUInt8(16, 7);
    directory.writeUInt32LE(4000, 14);
    directory.writeUInt32LE(9000, 18);
    writeFileSync(path.join(folder, "broken.ico"), directory);
    expect(await damagedReason(folder, "icotopng", "broken.ico")).toContain(
      "looks damaged",
    );
  });

  it("says broken SVG markup looks damaged", async () => {
    const folder = makeFolder();
    writeSvg(
      folder,
      "broken.svg",
      '<svg xmlns="http://www.w3.org/2000/svg"><rect',
    );
    expect(await damagedReason(folder, "svgtopng", "broken.svg")).toContain(
      "looks damaged",
    );
  });
});

describe("real-world use", () => {
  it("converts an iPhone export, and turns a logo into a PNG and a favicon", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "iphone"));
    copyFixture(folder, "iphone.heic", path.join("iphone", "IMG_0001.heic"));
    copyFixture(folder, "burst.heic", path.join("iphone", "IMG_0002.heic"));
    writeSvg(
      folder,
      "logo.svg",
      svg('viewBox="0 0 64 64"', '<rect width="64" height="64" fill="teal"/>'),
    );
    expect(
      (await run(folder, "-m", "heictojpg", "./iphone", "-o", "./jpgs"))
        .exitCode,
    ).toBe(0);
    expect(readdirSync(path.join(folder, "jpgs")).sort()).toEqual([
      "IMG_0001.jpg",
      "IMG_0002.jpg",
    ]);
    expect((await run(folder, "-m", "svgtopng", "logo.svg")).exitCode).toBe(0);
    expect(
      (await run(folder, "-m", "svgtoico", "logo.svg", "-o", "favicon"))
        .exitCode,
    ).toBe(0);
    expect((await sharp(path.join(folder, "logo.png")).metadata()).format).toBe(
      sharpFormats.png,
    );
    expect(await iconSizes(path.join(folder, "favicon.ico"))).toEqual([
      16, 32, 48,
    ]);
  });
});
