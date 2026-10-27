import { copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkItem, detectFormat } from "../src/detect.js";
import { findMode, type Mode } from "../src/modes/registry.js";
import { makeFolder } from "./support/folders.js";
import { sampleHeaders, writeSample } from "./support/samples.js";

const iphonePhoto = path.join("test", "fixtures", "iphone.heic");

function mode(name: string): Mode {
  const found = findMode(name);
  if (!found) {
    throw new Error(`No mode ${name}`);
  }
  return found;
}

async function check(
  modeName: string,
  files: string[],
  options: Record<string, string | boolean | undefined> = {},
) {
  const cwd = path.dirname(files[0] ?? "");
  return checkItem(
    mode(modeName),
    { inputs: files.map((file) => ({ path: file })), output: "out" },
    options,
    cwd,
  );
}

async function reasonFor(
  modeName: string,
  files: string[],
  options: Record<string, string | boolean | undefined> = {},
) {
  try {
    await check(modeName, files, options);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("The check passed");
}

describe("detectFormat", () => {
  it("fails an empty file", async () => {
    const folder = makeFolder();
    const file = path.join(folder, "photo.heic");
    writeFileSync(file, "");
    await expect(detectFormat(file)).rejects.toThrow("is empty");
  });

  it("detects a real HEIC photo", async () => {
    expect(await detectFormat(iphonePhoto)).toBe("heic");
  });

  it("goes by contents, not the name", async () => {
    const folder = makeFolder();
    expect(await detectFormat(writeSample(folder, "holiday.heic", "png"))).toBe(
      "png",
    );
  });

  it("treats an animated PNG as PNG", async () => {
    const folder = makeFolder();
    expect(await detectFormat(writeSample(folder, "moving.png", "apng"))).toBe(
      "png",
    );
  });

  it.each(Object.keys(sampleHeaders).filter((format) => format !== "apng"))(
    "detects %s saved as .bin",
    async (format) => {
      const folder = makeFolder();
      expect(
        await detectFormat(writeSample(folder, "sample.bin", format)),
      ).toBe(format);
    },
  );

  it("finds an SVG with no extension", async () => {
    const folder = makeFolder();
    expect(await detectFormat(writeSample(folder, "logo", "svg"))).toBe("svg");
  });

  it("finds an SVG after a byte-order mark, comments and a doctype", async () => {
    const folder = makeFolder();
    const file = path.join(folder, "drawing");
    writeFileSync(
      file,
      '\uFEFF<?xml version="1.0"?>\n<!-- made by hand -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    expect(await detectFormat(file)).toBe("svg");
  });

  it("falls back to the .svg extension", async () => {
    const folder = makeFolder();
    const file = path.join(folder, "logo.svg");
    writeFileSync(file, "this isn't markup");
    expect(await detectFormat(file)).toBe("svg");
  });

  it("doesn't recognise plain text", async () => {
    const folder = makeFolder();
    const file = path.join(folder, "notes.jpg");
    writeFileSync(file, "just some notes");
    expect(await detectFormat(file)).toBeUndefined();
  });
});

describe("checkItem", () => {
  it("suggests the mode for a renamed PNG", async () => {
    const folder = makeFolder();
    const file = writeSample(folder, "holiday.heic", "png");
    expect(await reasonFor("heictojpg", [file])).toBe(
      "looks like a PNG. Try: -m pngtojpg",
    );
    expect(await check("tojpg", [file])).toEqual({
      inputs: [{ path: file, format: "png" }],
      notes: [],
    });
  });

  it("says when a file is already the output format", async () => {
    const folder = makeFolder();
    const file = writeSample(folder, "holiday.heic", "jpg");
    expect(await reasonFor("heictojpg", [file])).toBe(
      "is already a JPG, so there's nothing to convert.",
    );
  });

  it("accepts every JPG spelling", async () => {
    const folder = makeFolder();
    const files = ["a.jpeg", "b.jfif", "c.JPG"].map((name) =>
      writeSample(folder, name, "jpg"),
    );
    for (const file of files) {
      expect(await check("jpgtopng", [file])).toEqual({
        inputs: [{ path: file, format: "jpg" }],
        notes: [],
      });
    }
  });

  it("skips a file already in the target format", async () => {
    const folder = makeFolder();
    const file = writeSample(folder, "photo.jpg", "jpg");
    expect(await check("tojpg", [file])).toEqual({ skipped: "already a JPG" });
    expect(await check("tojpg", [file], { overwrite: true })).toEqual({
      skipped: "already a JPG",
    });
    expect(await check("tojpg", [file], { quality: "60" })).toHaveProperty(
      "inputs",
    );
    expect(
      await check("tojpg", [file], { "strip-metadata": true }),
    ).toHaveProperty("inputs");
  });

  it("names short formats with the right article", async () => {
    const folder = makeFolder();
    expect(
      await reasonFor("pngtojpg", [writeSample(folder, "a.png", "heic")]),
    ).toBe("looks like a HEIC. Try: -m heictojpg");
    expect(
      await reasonFor("pngtojpg", [writeSample(folder, "b.png", "ico")]),
    ).toBe("looks like an ICO. Try: -m icotojpg");
  });

  it("rejects a file konvertoj can't convert", async () => {
    const folder = makeFolder();
    const file = path.join(folder, "notes.jpg");
    writeFileSync(file, "just some notes");
    expect(await reasonFor("tojpg", [file])).toContain(
      "isn't a file konvertoj can convert",
    );
  });

  it("names the modes that accept the wrong kind of file", async () => {
    const folder = makeFolder();
    const reason = await reasonFor("topdf", [
      writeSample(folder, "clip.mp4", "mp4"),
    ]);
    expect(reason).toContain("is an MP4, which topdf can't use");
    expect(reason).toContain("topdf works with any image");
    expect(reason).toContain("mp4tomp3");
  });

  it("lists the formats a tool works with", async () => {
    const folder = makeFolder();
    const reason = await reasonFor("compress", [
      writeSample(folder, "old.bmp", "bmp"),
    ]);
    expect(reason).toContain("compress works with JPG, PNG, WebP, AVIF, GIF");
  });

  it("suggests the PDF export for a PDF", async () => {
    const folder = makeFolder();
    expect(
      await reasonFor("tojpg", [writeSample(folder, "report.pdf", "pdf")]),
    ).toBe("looks like a PDF. Try: -m pdftojpg");
  });

  it("suggests topdf for mixed images", async () => {
    const folder = makeFolder();
    const files = [
      writeSample(folder, "a.jpg", "jpg"),
      writeSample(folder, "b.png", "png"),
    ];
    expect(await reasonFor("jpgtopdf", files)).toBe(
      "b.png is a PNG, but jpgtopdf only takes JPG. Try: -m topdf",
    );
  });

  it("doesn't suggest topdf for a video among images", async () => {
    const folder = makeFolder();
    const files = [
      writeSample(folder, "a.jpg", "jpg"),
      writeSample(folder, "clip.mp4", "mp4"),
    ];
    const reason = await reasonFor("jpgtopdf", files);
    expect(reason).toMatch(/^clip\.mp4 is an MP4, which jpgtopdf can't use/);
    expect(reason).not.toContain("Try: -m topdf");
  });

  it("names the empty file in a PDF", async () => {
    const folder = makeFolder();
    const files = [
      writeSample(folder, "a.jpg", "jpg"),
      writeSample(folder, "b.jpg", "jpg"),
      path.join(folder, "c.jpg"),
    ];
    writeFileSync(files[2] ?? "", "");
    expect(await reasonFor("jpgtopdf", files)).toMatch(/^c\.jpg is empty/);
  });

  it("checks a copied real HEIC with heictojpg", async () => {
    const folder = makeFolder();
    const file = path.join(folder, "photo.heif");
    copyFileSync(iphonePhoto, file);
    expect(await check("heictojpg", [file])).toEqual({
      inputs: [{ path: file, format: "heic" }],
      notes: [],
    });
  });
});
