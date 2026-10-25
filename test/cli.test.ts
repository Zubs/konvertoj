import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cliPath = path.join("dist", "cli.js");

describe("built cli", () => {
  it("starts with the node shebang line", () => {
    const firstLine = readFileSync(cliPath, "utf8").split(/\r?\n/)[0];
    expect(firstLine).toBe("#!/usr/bin/env node");
  });

  it("exits successfully without errors", () => {
    const result = spawnSync(process.execPath, [cliPath], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
