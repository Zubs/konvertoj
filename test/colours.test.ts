import { describe, expect, it } from "vitest";
import { isColour } from "../src/modes/colours.js";

describe("isColour", () => {
  it.each([
    "white",
    "RebeccaPurple",
    "#f80",
    "#f80a",
    "#ff8800",
    "#FF8800CC",
    "rgb(255,136,0)",
    "rgb( 255 , 136 , 0 )",
    "rgba(255, 136, 0, 0.5)",
  ])("accepts %s", (value) => {
    expect(isColour(value)).toBe(true);
  });

  it.each([
    "banana",
    "transparent",
    "#ff888",
    "#gg8800",
    "ff8800",
    "rgb(256, 0, 0)",
    "rgb(1, 2)",
    "rgba(1, 2, 3, 2)",
    "",
  ])("rejects %s", (value) => {
    expect(isColour(value)).toBe(false);
  });
});
