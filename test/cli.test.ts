import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { makeFolder } from "./support/folders.js";

const cliPath = path.join("dist", "cli.js");

function runCli(args: string[], nodeOptions: string[] = []) {
  return spawnSync(process.execPath, [...nodeOptions, cliPath, ...args], {
    encoding: "utf8",
  });
}

describe("built cli", () => {
  it("starts with the node shebang line", () => {
    const firstLine = readFileSync(cliPath, "utf8").split(/\r?\n/)[0];
    expect(firstLine).toBe("#!/usr/bin/env node");
  });

  it("shows the help screen when run with no arguments", () => {
    const result = runCli([]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("konvertoj -m <mode> <input>");
  });

  it("prints the version from package.json", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
      version: string;
    };
    const result = runCli(["--version"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${version}\n`);
  });

  it("exits with 1 for an unknown mode", () => {
    const result = runCli(["-m", "heic2jpg"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Did you mean heictojpg?");
  });

  it("loads only its own modules and Node.js built-ins for --help", () => {
    const hook = pathToFileURL(
      path.resolve("test", "support", "record-imports.mjs"),
    ).href;
    const result = runCli(["--help"], ["--import", hook]);
    expect(result.status, result.stderr).toBe(0);
    const loaded = result.stderr
      .split(/\r?\n/)
      .filter((line) => line.startsWith("LOADED "))
      .map((line) => line.slice("LOADED ".length));
    expect(loaded.length).toBeGreaterThan(0);
    const distUrl = pathToFileURL(path.resolve("dist")).href + "/";
    for (const url of loaded) {
      expect(url.startsWith("node:") || url.startsWith(distUrl), url).toBe(
        true,
      );
    }
  });
  it("expands a quoted pattern itself", () => {
    const folder = makeFolder(["a.heic", "b.heic", "c.png"]);
    const result = runCli([
      "-m",
      "heictojpg",
      path.join(folder, "*.heic"),
      "--dry-run",
    ]);
    expect(result.status, result.stderr).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/a\.heic → .*a\.jpg$/);
    expect(lines[1]).toMatch(/b\.heic → .*b\.jpg$/);
  });
});
