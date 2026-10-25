import { describe, expect, it } from "vitest";
import { followsRule, type OptionDefinition } from "../src/modes/options.js";
import {
  acceptedOptions,
  findMode,
  groups,
  modes,
  type Mode,
} from "../src/modes/registry.js";

function modesIn(group: string): Mode[] {
  return modes.filter((mode) => mode.group === group);
}

function option(
  modeName: string,
  optionName: string,
): OptionDefinition | undefined {
  const mode = findMode(modeName);
  if (!mode) {
    throw new Error(`${modeName} isn't in the registry`);
  }
  return acceptedOptions(mode).find(
    (candidate) => candidate.name === optionName,
  );
}

describe("mode registry", () => {
  it("puts every mode in a known group, in group order", () => {
    const groupOrder = modes.map((mode) => groups.indexOf(mode.group));
    expect(groupOrder.every((index) => index >= 0)).toBe(true);
    expect(groupOrder).toEqual([...groupOrder].sort((a, b) => a - b));
  });

  it("uses one lowercase spelling per mode with canonical format names", () => {
    const names = modes.map((mode) => mode.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z0-9]+$/);
      expect(name).not.toMatch(/jpeg|tif(?!f)/);
    }
  });

  it("has the image conversion modes", () => {
    const image = modesIn("Image").map((mode) => mode.name);
    expect(image.filter((name) => !name.startsWith("to"))).toHaveLength(72);
    expect(image.filter((name) => name.startsWith("to"))).toHaveLength(7);
    expect(image).toEqual(
      expect.arrayContaining(["heictojpg", "pngtowebp", "svgtoico", "tojpg"]),
    );
    for (const missing of ["jpgtojpg", "pngtoheic", "tosvg", "toheic"]) {
      expect(findMode(missing)).toBeUndefined();
    }
  });

  it("has the PDF modes", () => {
    const pdf = modesIn("PDF").map((mode) => mode.name);
    expect(pdf).toHaveLength(19);
    expect(pdf).toEqual(
      expect.arrayContaining([
        "jpgtopdf",
        "heictopdf",
        "topdf",
        "pdftopng",
        "pdftojpg",
      ]),
    );
  });

  it("has togif accepting images and video", () => {
    const gif = modesIn("GIF");
    expect(gif.map((mode) => mode.name)).toEqual(["togif"]);
    expect(gif[0]?.inputs).toEqual(
      expect.arrayContaining(["png", "webp", "mp4", "mov"]),
    );
  });

  it("has the video and audio modes", () => {
    const videoAndAudio = modesIn("Video & Audio").map((mode) => mode.name);
    expect(videoAndAudio).toHaveLength(41);
    expect(videoAndAudio).toEqual(
      expect.arrayContaining([
        "movtomp4",
        "tomp4",
        "mp4tomp3",
        "movtowav",
        "toflac",
      ]),
    );
    expect(findMode("mp4tomp4")).toBeUndefined();
  });

  it("has the tool modes", () => {
    expect(modesIn("Tools").map((mode) => mode.name)).toEqual([
      "compress",
      "resize",
      "enlarge",
      "crop",
      "rotate",
      "flip",
      "strip",
      "info",
      "colorpick",
    ]);
  });

  it("documents every mode", () => {
    for (const mode of modes) {
      expect(mode.description, mode.name).not.toBe("");
      expect(mode.examples.length, mode.name).toBeGreaterThan(0);
      for (const example of mode.examples) {
        expect(example.startsWith(`konvertoj -m ${mode.name}`), example).toBe(
          true,
        );
      }
      expect(mode.inputs.length, mode.name).toBeGreaterThan(0);
      expect(mode.output, mode.name).not.toBe("");
    }
  });

  it("gives every mode the common options", () => {
    const common = [
      "output",
      "overwrite",
      "strip-metadata",
      "recursive",
      "dry-run",
      "quiet",
      "verbose",
    ];
    for (const modeName of ["heictojpg", "rotate", "movtomp4"]) {
      for (const optionName of common) {
        expect(
          option(modeName, optionName),
          `${modeName} --${optionName}`,
        ).toBeDefined();
      }
    }
  });

  it("gives each mode the options from its feature", () => {
    expect(option("rotate", "angle")).toBeDefined();
    expect(option("rotate", "auto")).toBeDefined();
    expect(option("rotate", "background")).toBeDefined();
    expect(option("heictojpg", "quality")?.defaultValue).toBe("80");
    expect(option("heictojpg", "angle")).toBeUndefined();
    expect(option("pngtoico", "sizes")?.defaultValue).toBe("16,32,48");
    expect(option("compress", "level")?.defaultValue).toBe("medium");
  });

  it("never uses one option name as both a flag and a value", () => {
    const kinds = new Map<string, Set<string>>();
    for (const mode of modes) {
      for (const definition of acceptedOptions(mode)) {
        kinds.set(
          definition.name,
          (kinds.get(definition.name) ?? new Set()).add(definition.kind),
        );
      }
    }
    for (const [name, kindsUsed] of kinds) {
      expect(kindsUsed.size, `--${name}`).toBe(1);
    }
  });

  it("declares the value rules", () => {
    expect(option("resize", "fit")?.rule).toEqual({
      choices: ["contain", "cover", "fill", "inside", "outside"],
    });
    expect(option("heictojpg", "quality")?.rule).toEqual({
      min: 1,
      max: 100,
      wholeNumber: true,
    });
    expect(option("movtomp4", "quality")?.rule).toEqual({
      choices: ["low", "medium", "high"],
    });
    expect(option("togif", "fps")?.rule).toEqual({
      min: 1,
      max: 30,
      wholeNumber: true,
    });
    expect(option("togif", "speed")?.rule).toEqual({
      min: 0.5,
      max: 4,
      wholeNumber: false,
    });
    expect(option("enlarge", "scale")?.rule).toEqual({ choices: ["2x", "4x"] });
    expect(option("colorpick", "palette")?.rule).toEqual({
      min: 1,
      max: 16,
      wholeNumber: true,
    });
    expect(option("pdftopng", "dpi")?.rule).toEqual({
      min: 36,
      max: 600,
      wholeNumber: false,
    });
  });

  it("only declares defaults that pass their own rule", () => {
    for (const mode of modes) {
      for (const definition of acceptedOptions(mode)) {
        if (definition.rule && definition.defaultValue !== undefined) {
          expect(
            followsRule(definition.rule, definition.defaultValue),
            `${mode.name} --${definition.name}`,
          ).toBe(true);
        }
      }
    }
  });
});
