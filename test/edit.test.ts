import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import decodeIco from "decode-ico";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { makeFolder } from "./support/folders.js";
import { pixels, writeImage } from "./support/images.js";
import { runIn as run } from "./support/run-main.js";

type Colour = [number, number, number];

const red: Colour = [255, 0, 0];
const blue: Colour = [0, 0, 255];
const white: Colour = [255, 255, 255];
const grid: Colour[] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [0, 255, 255],
  [255, 0, 255],
  [128, 0, 0],
  [0, 128, 0],
  [0, 0, 128],
];

async function paint(
  file: string,
  width: number,
  height: number,
  colourAt: (x: number, y: number) => Colour,
) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(colourAt(x, y), (y * width + x) * 3);
    }
  }
  await sharp(data, { raw: { width, height, channels: 3 } }).toFile(file);
  return file;
}

async function colourAt(file: string, x: number, y: number): Promise<number[]> {
  const { data, info } = await pixels(file);
  const index = (y * info.width + x) * 3;
  return [...data.subarray(index, index + 3)];
}

function near(actual: number[], expected: Colour) {
  actual.forEach((value, channel) =>
    expect(Math.abs(value - (expected[channel] ?? 0))).toBeLessThan(40),
  );
}

async function size(file: string) {
  const { width, height } = await sharp(file).metadata();
  return [width, height];
}

async function writeMarked(folder: string, name: string) {
  return paint(path.join(folder, name), 800, 600, (x, y) =>
    x < 100 && y < 100 ? red : white,
  );
}

async function writeGridImage(folder: string, name: string) {
  return paint(
    path.join(folder, name),
    300,
    300,
    (x, y) => grid[Math.floor(y / 100) * 3 + Math.floor(x / 100)] ?? white,
  );
}

async function writeAnimation(folder: string, name: string) {
  const width = 12;
  const frameHeight = 10;
  const data = Buffer.alloc(width * frameHeight * 3 * 4);
  for (let index = 0; index < width * frameHeight * 3; index++) {
    const frame = Math.floor(index / (width * frameHeight));
    const x = index % width;
    const inBorder = x < 2;
    data[index * 4] = inBorder ? 255 : frame * 100;
    data[index * 4 + 1] = inBorder ? 255 : 50;
    data[index * 4 + 2] = inBorder ? 255 : 200 - frame * 50;
    data[index * 4 + 3] = 255;
  }
  const file = path.join(folder, name);
  await sharp(data, {
    raw: {
      width,
      height: frameHeight * 3,
      channels: 4,
      pageHeight: frameHeight,
    },
  })
    .gif({ loop: 0, delay: [100, 200, 300] })
    .toFile(file);
  return file;
}

describe("crop", () => {
  it("lists the ways to crop when given no options", async () => {
    const result = await run(makeFolder(), "-m", "crop", "photo.jpg");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Choose how to crop: --width and --height");
    expect(result.stderr).toContain("--aspect");
    expect(result.stderr).toContain("--trim");
  });

  it("takes a centred crop", async () => {
    const folder = makeFolder();
    await paint(path.join(folder, "photo.png"), 1600, 1200, (x, y) =>
      x >= 400 && x < 1200 && y >= 200 && y < 1000 ? blue : red,
    );
    await run(
      folder,
      "-m",
      "crop",
      "photo.png",
      "--width",
      "800",
      "--height",
      "800",
    );
    const output = path.join(folder, "photo-cropped.png");
    expect(await size(output)).toEqual([800, 800]);
    near(await colourAt(output, 0, 0), blue);
    near(await colourAt(output, 799, 799), blue);
  });

  it.each([
    ["top-left", 0],
    ["top", 1],
    ["top-right", 2],
    ["left", 3],
    ["center", 4],
    ["right", 5],
    ["bottom-left", 6],
    ["bottom", 7],
    ["bottom-right", 8],
  ])("takes the crop from the %s", async (position, cell) => {
    const folder = makeFolder();
    await writeGridImage(folder, "grid.png");
    await run(
      folder,
      "-m",
      "crop",
      "grid.png",
      "--width",
      "100",
      "--height",
      "100",
      "--position",
      position,
    );
    const output = path.join(folder, "grid-cropped.png");
    near(await colourAt(output, 50, 50), grid[cell] ?? white);
  });

  it("takes an exact area", async () => {
    const folder = makeFolder();
    await writeGridImage(folder, "grid.png");
    await run(
      folder,
      "-m",
      "crop",
      "grid.png",
      "--width",
      "10",
      "--height",
      "10",
      "--left",
      "205",
      "--top",
      "120",
    );
    const output = path.join(folder, "grid-cropped.png");
    expect(await size(output)).toEqual([10, 10]);
    near(await colourAt(output, 5, 5), grid[5] ?? white);
  });

  it("crops to an aspect ratio", async () => {
    const folder = makeFolder();
    await writeImage(folder, "wide.png", "png", { width: 1600, height: 1200 });
    await run(
      folder,
      "-m",
      "crop",
      "wide.png",
      "--aspect",
      "1:1",
      "-o",
      "square",
    );
    await run(
      folder,
      "-m",
      "crop",
      "wide.png",
      "--aspect",
      "16:9",
      "-o",
      "cinema",
    );
    expect(await size(path.join(folder, "square.png"))).toEqual([1200, 1200]);
    expect(await size(path.join(folder, "cinema.png"))).toEqual([1600, 900]);
  });

  it("keeps every pixel when the crop is the whole image", async () => {
    const folder = makeFolder();
    const source = await writeGridImage(folder, "grid.png");
    await run(
      folder,
      "-m",
      "crop",
      "grid.png",
      "--width",
      "300",
      "--height",
      "300",
    );
    const output = path.join(folder, "grid-cropped.png");
    expect(
      (await pixels(output)).data.equals((await pixels(source)).data),
    ).toBe(true);
  });

  it.each([
    [["--width", "2000", "--height", "800"]],
    [["--width", "2000", "--height", "800", "--position", "right"]],
    [["--width", "800", "--height", "800", "--left", "1000", "--top", "0"]],
  ])("refuses a crop past the edge (%j)", async (options) => {
    const folder = makeFolder();
    await writeImage(folder, "wide.png", "png", { width: 1600, height: 1200 });
    const result = await run(folder, "-m", "crop", "wide.png", ...options);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "goes past the edge of the image, which is 1600 × 1200 pixels",
    );
  });

  it("trims a plain border", async () => {
    const folder = makeFolder();
    await paint(path.join(folder, "screenshot.png"), 100, 80, (x, y) =>
      x >= 20 && x < 80 && y >= 20 && y < 60 ? red : white,
    );
    await run(folder, "-m", "crop", "screenshot.png", "--trim");
    expect(await size(path.join(folder, "screenshot-cropped.png"))).toEqual([
      60, 40,
    ]);
  });

  it("leaves an image without a border alone, with a note", async () => {
    const folder = makeFolder();
    await writeGridImage(folder, "grid.png");
    const result = await run(folder, "-m", "crop", "grid.png", "--trim");
    expect(await size(path.join(folder, "grid-cropped.png"))).toEqual([
      300, 300,
    ]);
    expect(result.stdout).toContain(
      "Note: no plain border was found, so it wasn't trimmed",
    );
  });

  it.each(["0:9", "16", "abc"])("rejects --aspect %s", async (ratio) => {
    const result = await run(
      makeFolder(),
      "-m",
      "crop",
      "photo.jpg",
      "--aspect",
      ratio,
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "--aspect must be a ratio such as 16:9 or 1:1",
    );
  });

  it("keeps an extreme aspect ratio at least 1 pixel", async () => {
    const folder = makeFolder();
    await writeImage(folder, "wide.png", "png", { width: 400, height: 300 });
    const result = await run(
      folder,
      "-m",
      "crop",
      "wide.png",
      "--aspect",
      "10000:1",
    );
    expect(result.exitCode).toBe(0);
    expect(await size(path.join(folder, "wide-cropped.png"))).toEqual([400, 1]);
  });

  it("rejects --left without --top, and --aspect with --trim", async () => {
    const incomplete = await run(
      makeFolder(),
      "-m",
      "crop",
      "photo.jpg",
      "--width",
      "10",
      "--height",
      "10",
      "--left",
      "5",
    );
    expect(incomplete.stderr).toContain("--left and --top go together");
    const conflicting = await run(
      makeFolder(),
      "-m",
      "crop",
      "photo.jpg",
      "--aspect",
      "1:1",
      "--trim",
    );
    expect(conflicting.stderr).toContain(
      "--aspect and --trim can't be used together",
    );
  });

  it("keeps a cropped icon's new size", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png", { width: 48, height: 48 });
    await run(folder, "-m", "pngtoico", "logo.png", "--sizes", "48");
    await run(
      folder,
      "-m",
      "crop",
      "logo.ico",
      "--width",
      "20",
      "--height",
      "20",
    );
    const icons = decodeIco(
      readFileSync(path.join(folder, "logo-cropped.ico")),
    );
    expect(icons.map((icon) => icon.width)).toEqual([20]);
  });
});

describe("rotate", () => {
  it("needs --angle or --auto", async () => {
    const result = await run(makeFolder(), "-m", "rotate", "photo.jpg");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Give --angle, e.g. --angle 90, or --auto");
  });

  it.each<[string, number[], [number, number]]>([
    ["90", [600, 800], [550, 50]],
    ["180", [800, 600], [750, 550]],
    ["270", [600, 800], [50, 750]],
    ["-90", [600, 800], [50, 750]],
  ])("turns by %s degrees", async (angle, expectedSize, [x, y]) => {
    const folder = makeFolder();
    await writeMarked(folder, "page.png");
    await run(folder, "-m", "rotate", "page.png", "--angle", angle);
    const output = path.join(folder, "page-rotated.png");
    expect(await size(output)).toEqual(expectedSize);
    near(await colourAt(output, x, y), red);
  });

  it.each(["0", "360"])(
    "leaves the image as it is at %s degrees",
    async (angle) => {
      const folder = makeFolder();
      const source = await writeMarked(folder, "page.png");
      await run(folder, "-m", "rotate", "page.png", "--angle", angle);
      const output = path.join(folder, "page-rotated.png");
      expect(
        (await pixels(output)).data.equals((await pixels(source)).data),
      ).toBe(true);
    },
  );

  it("enlarges the canvas at 45 degrees", async () => {
    const folder = makeFolder();
    await writeImage(folder, "card.png", "png", {
      width: 80,
      height: 60,
      colour: { r: 255, g: 0, b: 0, alpha: 1 },
    });
    await writeImage(folder, "card.jpg", "jpg", {
      width: 80,
      height: 60,
      colour: { r: 255, g: 0, b: 0, alpha: 1 },
    });
    await run(
      folder,
      "-m",
      "rotate",
      "card.png",
      "card.jpg",
      "--angle",
      "45",
      "-o",
      "out",
    );
    const png = path.join(folder, "out", "card-rotated.png");
    const jpg = path.join(folder, "out", "card-rotated.jpg");
    const [width = 0] = await size(png);
    expect(width).toBeGreaterThan(80);
    const { data } = await sharp(png)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    near(await colourAt(jpg, 0, 0), white);
  });

  it("turns a sideways photo upright with --auto", async () => {
    const folder = makeFolder();
    await sharp({
      create: { width: 60, height: 40, channels: 3, background: "white" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(path.join(folder, "phone.jpg"));
    await run(folder, "-m", "rotate", "phone.jpg", "--auto");
    const metadata = await sharp(
      path.join(folder, "phone-rotated.jpg"),
    ).metadata();
    expect([metadata.width, metadata.height]).toEqual([40, 60]);
    expect(metadata.orientation ?? 1).toBe(1);
    await run(
      folder,
      "-m",
      "rotate",
      "phone.jpg",
      "--auto",
      "--angle",
      "90",
      "-o",
      "both",
    );
    expect(await size(path.join(folder, "both.jpg"))).toEqual([60, 40]);
  });

  it("skips a photo that is already upright", async () => {
    const folder = makeFolder();
    await writeImage(folder, "photo.jpg", "jpg");
    const result = await run(folder, "-m", "rotate", "photo.jpg", "--auto");
    expect(result.stdout).toContain("photo.jpg skipped: already upright");
    expect(readdirSync(folder)).toEqual(["photo.jpg"]);
  });

  it("rejects a non-numeric angle", async () => {
    const result = await run(
      makeFolder(),
      "-m",
      "rotate",
      "photo.jpg",
      "--angle",
      "abc",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--angle must be a number");
  });
});

describe("flip", () => {
  it("mirrors left to right and top to bottom", async () => {
    const folder = makeFolder();
    await paint(path.join(folder, "sides.png"), 40, 20, (x) =>
      x < 20 ? red : blue,
    );
    await paint(path.join(folder, "levels.png"), 20, 40, (_, y) =>
      y < 20 ? red : blue,
    );
    await run(folder, "-m", "flip", "sides.png", "--direction", "horizontal");
    await run(folder, "-m", "flip", "levels.png", "--direction", "vertical");
    near(await colourAt(path.join(folder, "sides-flipped.png"), 0, 10), blue);
    near(await colourAt(path.join(folder, "levels-flipped.png"), 10, 0), blue);
  });

  it.each([[[]], [["--direction", "sideways"]]])(
    "lists both directions (%j)",
    async (options) => {
      const result = await run(
        makeFolder(),
        "-m",
        "flip",
        "photo.jpg",
        ...options,
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("horizontal");
      expect(result.stderr).toContain("vertical");
    },
  );
});

describe("animated images", () => {
  it.each([
    ["rotate", ["--angle", "90"], "rotated"],
    ["flip", ["--direction", "horizontal"], "flipped"],
    ["flip", ["--direction", "vertical"], "flipped"],
    ["crop", ["--width", "6", "--height", "6"], "cropped"],
    ["crop", ["--trim"], "cropped"],
  ])(
    "%s %j keeps the animation and its delays",
    async (mode, options, suffix) => {
      const folder = makeFolder();
      await writeAnimation(folder, "moving.gif");
      const result = await run(folder, "-m", mode, "moving.gif", ...options);
      expect(result.exitCode).toBe(0);
      const metadata = await sharp(path.join(folder, `moving-${suffix}.gif`), {
        animated: true,
      }).metadata();
      expect(metadata.pages).toBe(3);
      expect(metadata.delay).toEqual([100, 200, 300]);
    },
  );
});

describe("frame order", () => {
  it("keeps frames in order when flipping an animation vertically", async () => {
    const folder = makeFolder();
    await writeAnimation(folder, "moving.gif");
    await run(folder, "-m", "flip", "moving.gif", "--direction", "vertical");
    const output = path.join(folder, "moving-flipped.gif");
    const firstFrame = await sharp(output, { pages: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const lastFrame = await sharp(output, { page: 2, pages: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const redAt = (frame: typeof firstFrame) =>
      frame.data[(5 * frame.info.width + 6) * frame.info.channels] ?? 0;
    expect(redAt(firstFrame)).toBeLessThan(40);
    expect(redAt(lastFrame)).toBeGreaterThan(160);
  });
});

describe("real-world editing", () => {
  it("squares photos for a post and fixes upside-down scans", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "photos"));
    mkdirSync(path.join(folder, "scans"));
    await writeImage(path.join(folder, "photos"), "a.jpg", "jpg", {
      width: 400,
      height: 300,
    });
    await writeImage(path.join(folder, "photos"), "b.jpg", "jpg", {
      width: 300,
      height: 500,
    });
    await writeMarked(path.join(folder, "scans"), "page1.png");
    expect(
      (
        await run(
          folder,
          "-m",
          "crop",
          "./photos",
          "--aspect",
          "1:1",
          "-o",
          "./square",
        )
      ).exitCode,
    ).toBe(0);
    for (const name of readdirSync(path.join(folder, "square"))) {
      const [width, height] = await size(path.join(folder, "square", name));
      expect(width).toBe(height);
    }
    expect(
      (
        await run(
          folder,
          "-m",
          "rotate",
          "./scans",
          "--angle",
          "180",
          "-o",
          "./fixed",
        )
      ).exitCode,
    ).toBe(0);
    const fixed = path.join(folder, "fixed", "page1-rotated.png");
    expect(existsSync(fixed)).toBe(true);
    near(await colourAt(fixed, 750, 550), red);
  });
});
