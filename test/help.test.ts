import { describe, expect, it } from "vitest";
import { mainHelp, modeHelp, modeList } from "../src/help.js";
import { findMode, groups, modes } from "../src/modes/registry.js";

describe("help text", () => {
  it("explains the command shape and points to --list-modes", () => {
    const help = mainHelp();
    expect(help).toContain("konvertoj -m <mode> <input>");
    expect(help).toContain("--list-modes");
    expect(help).toContain("-m <mode> --help");
    expect(help).toContain("--overwrite");
  });

  it("lists every mode once, under its group, with the groups in order", () => {
    const lines = modeList().split("\n");
    const headingLines = groups.map((group) => lines.indexOf(group));
    expect(headingLines.every((line) => line >= 0)).toBe(true);
    expect(headingLines).toEqual([...headingLines].sort((a, b) => a - b));

    for (const mode of modes) {
      const matches = lines.flatMap((line, index) =>
        line.trim().split(/\s+/)[0] === mode.name ? [index] : [],
      );
      expect(matches, mode.name).toHaveLength(1);
      const groupIndex = groups.indexOf(mode.group);
      const nextHeading = headingLines[groupIndex + 1] ?? lines.length;
      expect(matches[0]).toBeGreaterThan(headingLines[groupIndex] ?? -1);
      expect(matches[0]).toBeLessThan(nextHeading);
    }
  });

  it("shows a mode's description, options with defaults and examples", () => {
    const mode = findMode("heictojpg");
    expect(mode).toBeDefined();
    const help = modeHelp(mode!);
    expect(help).toContain(mode!.description);
    expect(help).toMatch(/--quality <number> .*\(default: 80\)/);
    expect(help).toContain("--overwrite");
    expect(help).toContain("  konvertoj -m heictojpg ");
  });
});
