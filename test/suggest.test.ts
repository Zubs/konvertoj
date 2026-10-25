import { describe, expect, it } from "vitest";
import { modes } from "../src/modes/registry.js";
import { suggestMode } from "../src/modes/suggest.js";

const modeNames = modes.map((mode) => mode.name);

describe("suggestMode", () => {
  it.each(["heic2jpg", "heic-to-jpg", "HEICtoJPG", "heictojgp", "heic_to jpg"])(
    "suggests heictojpg for %s",
    (name) => {
      expect(suggestMode(name, modeNames)).toEqual({
        kind: "closest",
        suggestion: "heictojpg",
      });
    },
  );

  it.each([
    ["jpegtopng", "jpgtopng"],
    ["pngtotif", "pngtotiff"],
    ["heiftopng", "heictopng"],
  ])("maps format aliases in %s", (name, suggestion) => {
    expect(suggestMode(name, modeNames)).toEqual({
      kind: "closest",
      suggestion,
    });
  });

  it.each(["banana", "x"])("suggests nothing for %s", (name) => {
    expect(suggestMode(name, modeNames)).toEqual({
      kind: "closest",
      suggestion: undefined,
    });
  });

  it.each([
    ["pngtoheic", "HEIC", "pngtojpg"],
    ["toheif", "HEIC", "tojpg"],
    ["png2heic", "HEIC", "pngtojpg"],
    ["jpgtosvg", "SVG", "jpgtopng"],
    ["tosvg", "SVG", "topng"],
    ["pngtosvg", "SVG", undefined],
  ])("explains %s is input only", (name, format, suggestion) => {
    expect(suggestMode(name, modeNames)).toEqual({
      kind: "input-only",
      format,
      suggestion,
    });
  });
});
