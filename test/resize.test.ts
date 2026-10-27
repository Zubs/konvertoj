import { Buffer } from "node:buffer";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import decodeIco from "decode-ico";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { planSize, type Fit } from "../src/convert/resize.js";
import { makeFolder } from "./support/folders.js";
import { writeAnimatedGif, writeImage } from "./support/images.js";
import { runIn as run } from "./support/run-main.js";

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function size(file: string) {
  const { width, height } = await sharp(file).metadata();
  return [width, height];
}

async function picture(
  folder: string,
  name: string,
  width: number,
  height: number,
) {
  return writeImage(folder, name, name.split(".").pop() ?? "png", {
    width,
    height,
  });
}

describe("planSize", () => {
  const wide = { width: 1600, height: 1200 };
  const tall = { width: 1200, height: 1600 };

  it.each<[Fit, number[], number[]]>([
    ["inside", [800, 600], [600, 800]],
    ["outside", [1067, 800], [800, 1067]],
    ["cover", [800, 800], [800, 800]],
    ["contain", [800, 800], [800, 800]],
    ["fill", [800, 800], [800, 800]],
  ])("plans %s for wide and tall images", (fit, forWide, forTall) => {
    const request = { width: 800, height: 800, fit };
    const widePlan = planSize(wide, request);
    const tallPlan = planSize(tall, request);
    expect([widePlan?.width, widePlan?.height]).toEqual(forWide);
    expect([tallPlan?.width, tallPlan?.height]).toEqual(forTall);
  });

  it("keeps the shape with one side, and rounds", () => {
    const plan = planSize(
      { width: 667, height: 1001 },
      { width: 333, fit: "inside" },
    );
    expect([plan?.width, plan?.height]).toEqual([333, 500]);
    const byHeight = planSize(wide, { height: 300, fit: "inside" });
    expect([byHeight?.width, byHeight?.height]).toEqual([400, 300]);
  });

  it("scales both sides and never goes below 1 pixel", () => {
    const half = planSize(
      { width: 400, height: 300 },
      { scale: 0.5, fit: "inside" },
    );
    expect([half?.width, half?.height]).toEqual([200, 150]);
    const tiny = planSize(
      { width: 3, height: 1 },
      { scale: 0.1, fit: "inside" },
    );
    expect([tiny?.width, tiny?.height]).toEqual([1, 1]);
  });

  it("plans nothing without a size", () => {
    expect(planSize(wide, { fit: "inside" })).toBeUndefined();
  });
});

describe("resize", () => {
  it("needs a size", async () => {
    const result = await run(makeFolder(), "-m", "resize", "photo.jpg");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Give --width, --height or --scale");
  });

  it("rejects --scale with --width before touching files", async () => {
    const folder = makeFolder();
    const result = await run(
      folder,
      "-m",
      "resize",
      "photo.jpg",
      "--scale",
      "50%",
      "--width",
      "800",
      "-o",
      "out/",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "--scale can't be used with --width or --height",
    );
    expect(existsSync(path.join(folder, "out"))).toBe(false);
  });

  it.each(["0%", "50", "abc"])("rejects --scale %s", async (value) => {
    const result = await run(
      makeFolder(),
      "-m",
      "resize",
      "photo.jpg",
      "--scale",
      value,
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "--scale must be a percentage such as 50% or 200%",
    );
  });

  it("resizes by width, keeping the shape and format", async () => {
    const folder = makeFolder();
    await picture(folder, "photo.jpg", 1600, 1200);
    await run(folder, "-m", "resize", "photo.jpg", "--width", "800");
    const output = path.join(folder, "photo-resized.jpg");
    expect(await size(output)).toEqual([800, 600]);
    expect((await sharp(output).metadata()).format).toBe("jpeg");
  });

  it.each<[string, number[], number[]]>([
    ["inside", [800, 600], [600, 800]],
    ["outside", [1067, 800], [800, 1067]],
    ["cover", [800, 800], [800, 800]],
    ["contain", [800, 800], [800, 800]],
    ["fill", [800, 800], [800, 800]],
  ])("gives the expected size with --fit %s", async (fit, forWide, forTall) => {
    const folder = makeFolder();
    await picture(folder, "wide.png", 1600, 1200);
    await picture(folder, "tall.png", 1200, 1600);
    await run(
      folder,
      "-m",
      "resize",
      "wide.png",
      "tall.png",
      "--width",
      "800",
      "--height",
      "800",
      "--fit",
      fit,
      "-o",
      "out",
    );
    expect(await size(path.join(folder, "out", "wide-resized.png"))).toEqual(
      forWide,
    );
    expect(await size(path.join(folder, "out", "tall-resized.png"))).toEqual(
      forTall,
    );
  });

  it("crops from the centre with --fit cover", async () => {
    const folder = makeFolder();
    const pixels = Buffer.alloc(1600 * 1200 * 3);
    for (let index = 0; index < 1600 * 1200; index++) {
      const x = index % 1600;
      const middle = x >= 150 && x < 1450;
      pixels[index * 3] = middle ? 0 : 255;
      pixels[index * 3 + 2] = middle ? 255 : 0;
    }
    await sharp(pixels, { raw: { width: 1600, height: 1200, channels: 3 } })
      .png()
      .toFile(path.join(folder, "stripes.png"));
    await run(
      folder,
      "-m",
      "resize",
      "stripes.png",
      "--width",
      "800",
      "--height",
      "800",
      "--fit",
      "cover",
    );
    const output = path.join(folder, "stripes-resized.png");
    expect(await size(output)).toEqual([800, 800]);
    const { data } = await sharp(output)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = data.length / (800 * 800);
    expect(data[0]).toBeLessThan(20);
    expect(data[2]).toBeGreaterThan(230);
    expect(data[799 * channels]).toBeLessThan(20);
  });

  it("scales by a percentage", async () => {
    const folder = makeFolder();
    await picture(folder, "photo.png", 400, 300);
    await run(
      folder,
      "-m",
      "resize",
      "photo.png",
      "--scale",
      "50%",
      "-o",
      "half",
    );
    await run(
      folder,
      "-m",
      "resize",
      "photo.png",
      "--scale",
      "200%",
      "-o",
      "double",
    );
    expect(await size(path.join(folder, "half.png"))).toEqual([200, 150]);
    expect(await size(path.join(folder, "double.png"))).toEqual([800, 600]);
  });

  it("accepts a width of 1 and rejects 0, -5 and abc", async () => {
    const folder = makeFolder();
    await picture(folder, "photo.png", 40, 30);
    await run(folder, "-m", "resize", "photo.png", "--width", "1");
    expect((await size(path.join(folder, "photo-resized.png")))[0]).toBe(1);
    for (const value of ["0", "-5", "abc"]) {
      const result = await run(
        folder,
        "-m",
        "resize",
        "photo.png",
        "--width",
        value,
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "--width must be a whole number of 1 or more",
      );
    }
  });

  it("keeps a small image's size with --no-enlarge", async () => {
    const folder = makeFolder();
    await picture(folder, "small.png", 400, 300);
    const result = await run(
      folder,
      "-m",
      "resize",
      "small.png",
      "--width",
      "800",
      "--no-enlarge",
    );
    expect(await size(path.join(folder, "small-resized.png"))).toEqual([
      400, 300,
    ]);
    expect(result.stdout).toContain(
      "Note: kept at 400 × 300, because --no-enlarge stops images getting bigger",
    );
  });

  it("rounds an odd result", async () => {
    const folder = makeFolder();
    await picture(folder, "odd.png", 667, 1001);
    const result = await run(
      folder,
      "-m",
      "resize",
      "odd.png",
      "--width",
      "333",
    );
    expect(result.exitCode).toBe(0);
    expect(await size(path.join(folder, "odd-resized.png"))).toEqual([
      333, 500,
    ]);
  });

  it("resizes while converting", async () => {
    const folder = makeFolder();
    copyFileSync(
      path.join("test", "fixtures", "iphone.heic"),
      path.join(folder, "iphone.heic"),
    );
    await run(folder, "-m", "heictojpg", "iphone.heic", "--width", "24");
    expect(await size(path.join(folder, "iphone.jpg"))).toEqual([24, 32]);
  });

  it("makes icons from the resized image", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png", {
      width: 100,
      height: 100,
      colour: { r: 255, g: 0, b: 0, alpha: 1 },
    });
    await run(
      folder,
      "-m",
      "pngtoico",
      "logo.png",
      "--width",
      "64",
      "--height",
      "32",
      "--fit",
      "cover",
      "--sizes",
      "32",
    );
    const [icon] = decodeIco(readFileSync(path.join(folder, "logo.ico")));
    const { data } = await sharp(Buffer.from(icon?.data ?? []))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (y: number) => data[(y * 32 + 16) * 4 + 3];
    expect(alphaAt(2)).toBe(0);
    expect(alphaAt(16)).toBe(255);
  });

  it("keeps an animated GIF animated", async () => {
    const folder = makeFolder();
    await writeAnimatedGif(folder, "moving.gif");
    await run(folder, "-m", "resize", "moving.gif", "--width", "6");
    const metadata = await sharp(path.join(folder, "moving-resized.gif"), {
      animated: true,
    }).metadata();
    expect(metadata.pages).toBe(3);
    expect(metadata.width).toBe(6);
  });

  it("refuses a result over 16384 pixels", async () => {
    const folder = makeFolder();
    await picture(folder, "big.png", 5000, 4000);
    const result = await run(
      folder,
      "-m",
      "enlarge",
      "big.png",
      "--scale",
      "4x",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("would be 20000 × 16000 pixels");
    expect(result.stderr).toContain("16384-pixel limit");
  });
});

describe("enlarge", () => {
  it("doubles by default and quadruples with --scale 4x", async () => {
    const folder = makeFolder();
    await picture(folder, "photo.png", 400, 300);
    await run(folder, "-m", "enlarge", "photo.png");
    await run(
      folder,
      "-m",
      "enlarge",
      "photo.png",
      "--scale",
      "4x",
      "-o",
      "four",
    );
    await run(
      folder,
      "-m",
      "enlarge",
      "photo.png",
      "--scale",
      "2X",
      "-o",
      "upper",
    );
    expect(await size(path.join(folder, "photo-enlarged.png"))).toEqual([
      800, 600,
    ]);
    expect(await size(path.join(folder, "four.png"))).toEqual([1600, 1200]);
    expect(await size(path.join(folder, "upper.png"))).toEqual([800, 600]);
  });

  it("turns 1 × 1 into 2 × 2", async () => {
    const folder = makeFolder();
    await picture(folder, "dot.png", 1, 1);
    await run(folder, "-m", "enlarge", "dot.png");
    expect(await size(path.join(folder, "dot-enlarged.png"))).toEqual([2, 2]);
  });

  it.each(["3x", "1x", "abc"])("rejects --scale %s", async (value) => {
    const result = await run(
      makeFolder(),
      "-m",
      "enlarge",
      "photo.png",
      "--scale",
      value,
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("one of 2x, 4x");
  });

  it("enlarges a folder of icons", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "icons"));
    for (const name of ["home", "search", "menu"]) {
      await picture(path.join(folder, "icons"), `${name}.png`, 16, 16);
    }
    await run(folder, "-m", "enlarge", "icons", "-o", "big");
    for (const name of readdirSync(path.join(folder, "big"))) {
      expect(await size(path.join(folder, "big", name))).toEqual([32, 32]);
    }
  });

  it("enlarges an ICO to one bigger icon, and refuses icons over 256", async () => {
    const folder = makeFolder();
    await picture(folder, "logo.png", 48, 48);
    await run(folder, "-m", "pngtoico", "logo.png", "--sizes", "48");
    await run(folder, "-m", "enlarge", "logo.ico");
    const icons = decodeIco(
      readFileSync(path.join(folder, "logo-enlarged.ico")),
    );
    expect(icons.map((icon) => icon.width)).toEqual([96]);
    const refused = await run(
      folder,
      "-m",
      "resize",
      "logo.ico",
      "--width",
      "300",
    );
    expect(refused.stderr).toContain("icons can be at most 256 pixels wide");
  });

  it("keeps transparency", async () => {
    const folder = makeFolder();
    await writeImage(folder, "clear.png", "png", { colour: transparent });
    await run(folder, "-m", "enlarge", "clear.png");
    await run(folder, "-m", "resize", "clear.png", "--width", "10");
    for (const name of ["clear-enlarged.png", "clear-resized.png"]) {
      const { data } = await sharp(path.join(folder, name))
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data[3]).toBe(0);
    }
  });

  it("strips details with both tools", async () => {
    const folder = makeFolder();
    await sharp({
      create: { width: 20, height: 20, channels: 3, background: "teal" },
    })
      .withExif({ IFD0: { Make: "Canon" } })
      .jpeg()
      .toFile(path.join(folder, "photo.jpg"));
    await run(
      folder,
      "-m",
      "resize",
      "photo.jpg",
      "--width",
      "10",
      "--strip-metadata",
    );
    await run(folder, "-m", "enlarge", "photo.jpg", "--strip-metadata");
    for (const name of ["photo-resized.jpg", "photo-enlarged.jpg"]) {
      expect(
        (await sharp(path.join(folder, name)).metadata()).exif,
      ).toBeUndefined();
    }
  });
});

describe("real-world resizing", () => {
  it("resizes screenshots for a blog and enlarges a photo for printing", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "screenshots"));
    await picture(path.join(folder, "screenshots"), "one.png", 2400, 1500);
    await picture(path.join(folder, "screenshots"), "two.png", 1920, 1080);
    await picture(folder, "old.jpg", 300, 200);
    expect(
      (
        await run(
          folder,
          "-m",
          "resize",
          "./screenshots",
          "--width",
          "1200",
          "-o",
          "./blog",
        )
      ).exitCode,
    ).toBe(0);
    for (const name of readdirSync(path.join(folder, "blog"))) {
      expect((await size(path.join(folder, "blog", name)))[0]).toBe(1200);
    }
    expect(
      (await run(folder, "-m", "enlarge", "old.jpg", "--scale", "4x")).exitCode,
    ).toBe(0);
    expect(await size(path.join(folder, "old-enlarged.jpg"))).toEqual([
      1200, 800,
    ]);
  });
});
