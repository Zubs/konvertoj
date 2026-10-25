import { describe, expect, it } from "vitest";
import { unsupportedNodeVersionMessage } from "../src/node-version.js";

describe("unsupportedNodeVersionMessage", () => {
  it.each(["20.11.0", "21.99.0"])(
    "explains how to fix Node.js %s",
    (version) => {
      expect(unsupportedNodeVersionMessage(version)).toBe(
        `konvertoj needs Node.js 22 or newer. You have Node.js ${version}. Install a newer version from https://nodejs.org`,
      );
    },
  );

  it.each(["22.0.0", "23.7.0", "24.0.0"])("accepts Node.js %s", (version) => {
    expect(unsupportedNodeVersionMessage(version)).toBeUndefined();
  });
});
