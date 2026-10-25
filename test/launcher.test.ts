import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coloursAllowed } from "../src/start.js";
import { makeFolder } from "./support/folders.js";

const launcher = path.resolve("test", "support", "run-with-copy.mjs");

function folderWith(files: string[]) {
  const folder = makeFolder();
  for (const file of files) {
    writeFileSync(path.join(folder, file), file);
  }
  return folder;
}

function launch(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd,
    encoding: "utf8",
  });
}

describe("launched konvertoj", () => {
  it("writes plain lines with no colour codes or progress bar when piped", () => {
    const cwd = folderWith(["a.txt", "b.txt", "fail.txt"]);
    const result = launch(cwd, ["-m", "copy", "a.txt", "b.txt", "fail.txt"]);
    expect(result.stdout + result.stderr).not.toContain("\x1b[");
    expect(result.stdout + result.stderr).not.toContain("\r");
    expect(result.stdout).toContain("✓ a.txt → a-copy.txt");
    expect(result.stderr).toBe(
      "✗ fail.txt: couldn't be copied because its name says fail\n",
    );
  });

  it.each([
    [["good1.txt", "good2.txt"], 0],
    [["good1.txt", "fail1.txt"], 2],
    [["fail1.txt", "fail2.txt"], 1],
  ])("gives scripts a reliable exit code for %j", (files, code) => {
    const cwd = folderWith(files);
    expect(launch(cwd, ["-m", "copy", ".", "-o", "out"]).status).toBe(code);
  });

  it("explains an unexpected error without a stack trace", () => {
    const cwd = folderWith(["a.txt"]);
    const result = launch(cwd, ["-m", "explode", "a.txt"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      "konvertoj hit an unexpected problem: kaboom. Run again with --verbose for details.\n",
    );
  });

  it("adds the stack trace to an unexpected error with --verbose", () => {
    const cwd = folderWith(["a.txt"]);
    const result = launch(cwd, ["-m", "explode", "a.txt", "--verbose"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "konvertoj hit an unexpected problem: kaboom.",
    );
    expect(result.stderr).toMatch(/^ {4}at /m);
  });

  it.skipIf(process.platform === "win32")(
    "stops cleanly on Ctrl+C",
    async () => {
      const files = [
        "1.txt",
        "2.txt",
        ...Array.from({ length: 12 }, (_, index) => `slow${index + 1}.txt`),
      ];
      const cwd = folderWith(files);
      const child = spawn(
        process.execPath,
        [launcher, "-m", "copy", ".", "-o", "out"],
        { cwd },
      );
      let stdout = "";
      child.stdout.setEncoding("utf8");
      const sentInterrupt = new Promise<void>((resolve) => {
        child.stdout.on("data", (chunk: string) => {
          stdout += chunk;
          if (stdout.includes("✓") && !child.killed) {
            child.kill("SIGINT");
            resolve();
          }
        });
      });
      const exitCode = await new Promise<number | null>((resolve) =>
        child.on("close", resolve),
      );
      await sentInterrupt;
      expect(exitCode).toBe(130);
      expect(stdout).toContain("Stopped by Ctrl+C after");
      const outputs = readdirSync(path.join(cwd, "out"));
      expect(outputs.length).toBeGreaterThan(0);
      expect(outputs.length).toBeLessThan(files.length);
      expect(outputs.filter((name) => name.includes("konvertoj-tmp"))).toEqual(
        [],
      );
      expect(existsSync(path.join(cwd, "out", "1-copy.txt"))).toBe(true);
    },
  );
});

describe("coloursAllowed", () => {
  it("allows colours only in a terminal without NO_COLOR", () => {
    expect(coloursAllowed(true, {})).toBe(true);
    expect(coloursAllowed(true, { NO_COLOR: "" })).toBe(true);
    expect(coloursAllowed(true, { NO_COLOR: "1" })).toBe(false);
    expect(coloursAllowed(false, {})).toBe(false);
    expect(coloursAllowed(undefined, {})).toBe(false);
  });
});
