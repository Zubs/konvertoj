import { copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { makeFolder } from "./support/folders.js";
import {
  writeAnimatedGif,
  writeHugePng,
  writeImage,
} from "./support/images.js";
import { runIn as run } from "./support/run-main.js";

const fixture = path.resolve("test", "fixtures", "iphone.heic");

async function writeCameraPhoto(folder: string, name: string) {
  await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "teal" },
  })
    .withExif({
      IFD0: { Make: "Canon", Model: "EOS R5" },
      IFD2: { DateTimeOriginal: "2025:05:01 12:00:00" },
    })
    .jpeg()
    .toFile(path.join(folder, name));
}

describe("info", () => {
  it("needs a file", async () => {
    const result = await run(makeFolder(), "-m", "info");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No input files given");
  });

  it("shows a JPG's format, size, dimensions and camera", async () => {
    const folder = makeFolder();
    await writeCameraPhoto(folder, "photo.jpg");
    const result = await run(folder, "-m", "info", "photo.jpg");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^photo\.jpg\n/);
    expect(result.stdout).toContain("  Format: JPG\n");
    expect(result.stdout).toMatch(/ {2}File size: [\d.]+ KB\n/);
    expect(result.stdout).toContain("  Dimensions: 1600 × 1200\n");
    expect(result.stdout).toContain("  Camera: Canon EOS R5\n");
    expect(result.stdout).toContain("  Date taken: 2025-05-01 12:00:00\n");
    expect(result.stdout).not.toContain("Done in");
  });

  it("prints one section per file, in order", async () => {
    const folder = makeFolder();
    for (const name of ["c.png", "a.png", "b.png"]) {
      await writeImage(folder, name, "png");
    }
    const result = await run(folder, "-m", "info", "c.png", "a.png", "b.png");
    const headings = result.stdout
      .split("\n")
      .filter((line) => /^\S/.test(line));
    expect(headings).toEqual(["c.png", "a.png", "b.png"]);
  });

  it("shows the dimensions of tiny and huge images", async () => {
    const folder = makeFolder();
    await writeImage(folder, "dot.png", "png", { width: 1, height: 1 });
    writeHugePng(folder, "huge.png");
    const result = await run(folder, "-m", "info", "dot.png", "huge.png");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Dimensions: 1 × 1");
    expect(result.stdout).toContain("Dimensions: 20000 × 20000");
  });

  it("shows an animation's frames", async () => {
    const folder = makeFolder();
    await writeAnimatedGif(folder, "moving.gif");
    const result = await run(folder, "-m", "info", "moving.gif");
    expect(result.stdout).toContain("  Frames: 3\n");
  });

  it("only shows coordinates with --verbose", async () => {
    const folder = makeFolder();
    copyFileSync(fixture, path.join(folder, "iphone.heic"));
    const plain = await run(folder, "-m", "info", "iphone.heic");
    expect(plain.stdout).toContain("  Location: yes\n");
    expect(plain.stdout).not.toContain("51.5");
    const verbose = await run(folder, "-m", "info", "iphone.heic", "--verbose");
    expect(verbose.stdout).toContain("  Location: 51.50070, -0.12460\n");
    expect(verbose.stdout).not.toContain("Working on");
  });

  it("says when there are no camera details", async () => {
    const folder = makeFolder();
    await writeImage(folder, "plain.png", "png");
    const result = await run(folder, "-m", "info", "plain.png");
    expect(result.stdout).toContain("  No camera details\n");
    expect(result.stdout).not.toContain("Camera:");
  });

  it("shows transparency", async () => {
    const folder = makeFolder();
    await writeImage(folder, "clear.png", "png", {
      colour: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    await writeImage(folder, "solid.jpg", "jpg");
    const result = await run(folder, "-m", "info", "clear.png", "solid.jpg");
    const [png, jpg] = result.stdout.split("\n\n");
    expect(png).toContain("Transparency: yes");
    expect(jpg).toContain("Transparency: no");
  });

  it("prints valid JSON with every field, also with --verbose", async () => {
    const folder = makeFolder();
    copyFileSync(fixture, path.join(folder, "iphone.heic"));
    const plain = JSON.parse(
      (await run(folder, "-m", "info", "iphone.heic", "--json")).stdout,
    );
    expect(plain).toEqual([
      {
        file: "iphone.heic",
        format: "HEIC",
        fileSize: expect.any(Number),
        width: 48,
        height: 64,
        colourSpace: "sRGB",
        transparency: false,
        frames: 1,
        camera: { make: "Apple", model: "iPhone 15 Pro" },
        dateTaken: "2026-07-14 10:30:00",
        location: true,
      },
    ]);
    const verbose = JSON.parse(
      (await run(folder, "-m", "info", "iphone.heic", "--json", "--verbose"))
        .stdout,
    );
    expect(verbose[0].location).toEqual({
      latitude: 51.5007,
      longitude: -0.1246,
    });
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
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"></svg>',
    );
    const result = await run(folder, "-m", "info", ".", "--json");
    expect(result.exitCode).toBe(0);
    const formats = JSON.parse(result.stdout).map(
      (entry: { format: string }) => entry.format,
    );
    expect(formats.sort()).toEqual(
      [
        "AVIF",
        "BMP",
        "GIF",
        "HEIC",
        "ICO",
        "JPG",
        "PNG",
        "SVG",
        "TIFF",
        "WebP",
      ].sort(),
    );
  });

  it("doesn't offer options for creating files", async () => {
    const help = await run(makeFolder(), "-m", "info", "--help");
    expect(help.stdout).toContain("konvertoj -m info <input> [options]");
    expect(help.stdout).not.toContain("--overwrite");
    expect(help.stdout).not.toContain("--strip-metadata");
    const strip = await run(
      makeFolder(),
      "-m",
      "info",
      "photo.jpg",
      "--strip-metadata",
    );
    expect(strip.exitCode).toBe(1);
    expect(strip.stderr).toContain("--strip-metadata can't be used with info");
  });

  it("rejects -o", async () => {
    const result = await run(
      makeFolder(),
      "-m",
      "info",
      "photo.jpg",
      "-o",
      "details",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "info doesn't create files, so -o can't be used",
    );
  });

  it("reports a bad file on standard error and still shows the rest", async () => {
    const folder = makeFolder();
    await writeImage(folder, "good.png", "png");
    writeFileSync(path.join(folder, "notes.txt"), "shopping list");
    const result = await run(folder, "-m", "info", "good.png", "notes.txt");
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toMatch(/^good\.png\n/);
    expect(result.stderr).toContain(
      "notes.txt: isn't a file konvertoj can convert",
    );
  });

  it("shows that strip removed a photo's location", async () => {
    const folder = makeFolder();
    copyFileSync(fixture, path.join(folder, "iphone.heic"));
    await run(folder, "-m", "heictojpg", "iphone.heic");
    const before = await run(folder, "-m", "info", "iphone.jpg");
    expect(before.stdout).toContain("Location: yes");
    await run(folder, "-m", "strip", "iphone.jpg");
    const after = await run(folder, "-m", "info", "iphone-stripped.jpg");
    expect(after.stdout).toContain("No camera details");
  });
});
