import { describe, expect, it } from "vitest";
import { followsRule } from "../src/modes/options.js";
import { findMode } from "../src/modes/registry.js";
import { formatTime, parseTime } from "../src/video/times.js";

describe("times", () => {
  it.each([
    ["90", 90],
    ["1:30", 90],
    ["0:01:30", 90],
    ["1:02:30", 3750],
    ["2.5", 2.5],
    ["0:02.5", 2.5],
  ])("reads %s as %d seconds", (text, seconds) => {
    expect(parseTime(text)).toBe(seconds);
  });

  it("writes times for messages", () => {
    expect(formatTime(200)).toBe("3:20");
    expect(formatTime(3750)).toBe("1:02:30");
    expect(formatTime(5)).toBe("0:05");
  });

  it("accepts the three spellings and rejects others", () => {
    const rule = findMode("mp4tomp3")?.options.find(
      (option) => option.name === "start",
    )?.rule;
    expect(rule).toBeDefined();
    for (const good of ["90", "1:30", "1:02:30", "0:01:30.5"]) {
      expect(followsRule(rule!, good), good).toBe(true);
    }
    for (const bad of ["1:70", "abc", "-5", "1::30", ""]) {
      expect(followsRule(rule!, bad), bad).toBe(false);
    }
  });
});
