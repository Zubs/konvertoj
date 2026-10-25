import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { InputError, resolveInputs } from "../src/inputs.js";
import { findMode } from "../src/modes/registry.js";
import { planOutputs } from "../src/outputs.js";
import { makeFolder } from "./support/folders.js";

async function plan(
  cwd: string,
  modeName: string,
  args: string[],
  options: { output?: string; overwrite?: boolean; recursive?: boolean } = {},
) {
  const mode = findMode(modeName);
  if (!mode) {
    throw new Error(`${modeName} isn't in the registry`);
  }
  const { inputs } = await resolveInputs(args, {
    recursive: options.recursive ?? false,
    cwd,
  });
  const result = planOutputs(mode, inputs, {
    output: options.output,
    overwrite: options.overwrite ?? false,
    cwd,
  });
  return {
    outputs: result.items.map((item) =>
      item.output ? path.relative(cwd, item.output) : undefined,
    ),
    items: result.items,
    warnings: result.warnings,
  };
}

describe("planOutputs", () => {
  it("adds the mode's extension to -o", async () => {
    const cwd = makeFolder(["holiday.heic"]);
    expect(
      (await plan(cwd, "heictojpg", ["holiday.heic"], { output: "newimage" }))
        .outputs,
    ).toEqual(["newimage.jpg"]);
  });

  it.each(["newimage.jpg", "newimage.JPEG"])(
    "keeps -o %s as given",
    async (output) => {
      const cwd = makeFolder(["holiday.heic"]);
      const result = await plan(cwd, "heictojpg", ["holiday.heic"], { output });
      expect(result.outputs).toEqual([output]);
      expect(result.warnings).toEqual([]);
    },
  );

  it("keeps an unknown extension as part of the name", async () => {
    const cwd = makeFolder(["holiday.heic"]);
    expect(
      (
        await plan(cwd, "heictojpg", ["holiday.heic"], {
          output: "holiday.2024",
        })
      ).outputs,
    ).toEqual(["holiday.2024.jpg"]);
  });

  it("warns and uses the mode's extension when -o has another format's", async () => {
    const cwd = makeFolder(["holiday.heic"]);
    const result = await plan(cwd, "heictojpg", ["holiday.heic"], {
      output: "newimage.png",
    });
    expect(result.outputs).toEqual(["newimage.jpg"]);
    expect(result.warnings).toEqual([
      "-o newimage.png ends in .png, but heictojpg makes JPG files. Saving as newimage.jpg.",
    ]);
  });

  it("keeps the input's name and folder for a conversion", async () => {
    const cwd = makeFolder(["photos/holiday.heic"]);
    expect(
      (await plan(cwd, "heictojpg", ["photos/holiday.heic"])).outputs,
    ).toEqual([path.join("photos", "holiday.jpg")]);
  });

  it("adds the tool's suffix and keeps the input's extension", async () => {
    const cwd = makeFolder(["hero.jpg", "logo.JPEG"]);
    expect(
      (await plan(cwd, "compress", ["hero.jpg", "logo.JPEG"])).outputs,
    ).toEqual(["hero-compressed.jpg", "logo-compressed.JPEG"]);
  });

  it("plans no output for modes that print details", async () => {
    const cwd = makeFolder(["photo.jpg"]);
    expect((await plan(cwd, "info", ["photo.jpg"])).outputs).toEqual([
      undefined,
    ]);
  });

  it("puts several outputs in the -o folder", async () => {
    const cwd = makeFolder(["a.heic", "b.heic", "c.heic"]);
    expect(
      (
        await plan(cwd, "heictojpg", ["a.heic", "b.heic", "c.heic"], {
          output: "converted",
        })
      ).outputs,
    ).toEqual([
      path.join("converted", "a.jpg"),
      path.join("converted", "b.jpg"),
      path.join("converted", "c.jpg"),
    ]);
  });

  it("keeps the subfolder structure of a recursive folder", async () => {
    const cwd = makeFolder(["shots/a.png", "shots/2024/b.png"]);
    expect(
      (
        await plan(cwd, "pngtojpg", ["shots"], {
          output: "out",
          recursive: true,
        })
      ).outputs,
    ).toEqual([path.join("out", "2024", "b.jpg"), path.join("out", "a.jpg")]);
  });

  it("keeps the structure below a pattern's fixed part", async () => {
    const cwd = makeFolder(["photos/2024/june/a.png"]);
    expect(
      (await plan(cwd, "pngtojpg", ["photos/2024/**/*.png"], { output: "out" }))
        .outputs,
    ).toEqual([path.join("out", "june", "a.jpg")]);
  });

  it("treats -o as a folder for one file when it's an existing folder or ends with a slash", async () => {
    const cwd = makeFolder(["holiday.heic", "jpgs/.keep"]);
    expect(
      (await plan(cwd, "heictojpg", ["holiday.heic"], { output: "jpgs" }))
        .outputs,
    ).toEqual([path.join("jpgs", "holiday.jpg")]);
    expect(
      (await plan(cwd, "heictojpg", ["holiday.heic"], { output: "new/" }))
        .outputs,
    ).toEqual([path.join("new", "holiday.jpg")]);
  });

  it("fails when a folder is needed but -o is a file", async () => {
    const cwd = makeFolder(["a.heic", "b.heic", "notes.txt"]);
    const error = await plan(cwd, "heictojpg", ["a.heic", "b.heic"], {
      output: "notes.txt",
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(InputError);
    expect((error as InputError).message).toContain(
      "-o must be a folder when there are several inputs",
    );
  });

  it("combines images into one PDF named by -o, in natural order", async () => {
    const cwd = makeFolder([
      "scans/scan10.jpg",
      "scans/scan2.jpg",
      "scans/scan1.jpg",
    ]);
    const result = await plan(cwd, "jpgtopdf", ["scans"], {
      output: "receipts",
    });
    expect(result.outputs).toEqual(["receipts.pdf"]);
    expect(
      result.items[0]?.inputs.map((input) => path.basename(input.path)),
    ).toEqual(["scan1.jpg", "scan2.jpg", "scan10.jpg"]);
  });

  it("names a combined output after the first input without -o", async () => {
    const cwd = makeFolder(["page1.png", "page2.png"]);
    expect(
      (await plan(cwd, "topdf", ["page1.png", "page2.png"])).outputs,
    ).toEqual(["page1.pdf"]);
  });

  it("numbers outputs that already exist", async () => {
    const cwd = makeFolder(["photo.heic", "photo.jpg"]);
    expect((await plan(cwd, "heictojpg", ["photo.heic"])).outputs).toEqual([
      "photo (1).jpg",
    ]);
    writeFileSync(path.join(cwd, "photo (1).jpg"), "");
    expect((await plan(cwd, "heictojpg", ["photo.heic"])).outputs).toEqual([
      "photo (2).jpg",
    ]);
  });

  it("replaces existing outputs with --overwrite", async () => {
    const cwd = makeFolder(["photo.heic", "photo.jpg"]);
    expect(
      (await plan(cwd, "heictojpg", ["photo.heic"], { overwrite: true }))
        .outputs,
    ).toEqual(["photo.jpg"]);
  });

  it.each([false, true])(
    "numbers a clash inside the run (overwrite: %s)",
    async (overwrite) => {
      const cwd = makeFolder(["photo.png", "photo.jpg"]);
      expect(
        (await plan(cwd, "towebp", ["photo.png", "photo.jpg"], { overwrite }))
          .outputs,
      ).toEqual(["photo.webp", "photo (1).webp"]);
    },
  );

  it("never plans an input as an output, even with --overwrite", async () => {
    const cwd = makeFolder(["hero.jpg"]);
    expect(
      (
        await plan(cwd, "compress", ["hero.jpg"], {
          output: "hero.jpg",
          overwrite: true,
        })
      ).outputs,
    ).toEqual(["hero (1).jpg"]);
  });

  it("gives unreadable inputs no output", async () => {
    const cwd = makeFolder(["a.heic", "b.heic"]);
    const mode = findMode("heictojpg")!;
    const inputs = [
      { path: path.join(cwd, "a.heic") },
      { path: path.join(cwd, "b.heic"), unreadable: "permission denied" },
    ];
    const result = planOutputs(mode, inputs, {
      output: "converted",
      overwrite: false,
      cwd,
    });
    expect(
      result.items.map(
        (item) => item.output && path.relative(cwd, item.output),
      ),
    ).toEqual([path.join("converted", "a.jpg"), undefined]);
  });

  it("doesn't create the -o folder while planning", async () => {
    const cwd = makeFolder(["a.heic", "b.heic"]);
    await plan(cwd, "heictojpg", ["a.heic", "b.heic"], { output: "converted" });
    expect(() => mkdirSync(path.join(cwd, "converted"))).not.toThrow();
  });
});
