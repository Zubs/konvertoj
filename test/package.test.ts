import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeFolder } from "./support/folders.js";

const allowedRootFiles = ["package.json", "README.md", "LICENSE"];

function packedFilePaths(): string[] {
  const npmPath = process.env.npm_execpath;
  if (!npmPath) {
    throw new Error("npm_execpath is not set: run this through npm test");
  }
  const result = spawnSync(
    process.execPath,
    [npmPath, "pack", "--dry-run", "--json"],
    {
      encoding: "utf8",
    },
  );
  expect(result.status, result.stderr).toBe(0);
  const [packResult] = JSON.parse(result.stdout) as [
    { files: { path: string }[] },
  ];
  return packResult.files.map((file) => file.path);
}

describe("published package", () => {
  it("contains only dist, README.md, LICENSE and package.json", () => {
    const paths = packedFilePaths();
    expect(paths).toEqual(
      expect.arrayContaining([...allowedRootFiles, "dist/cli.js"]),
    );
    for (const filePath of paths) {
      expect(
        allowedRootFiles.includes(filePath) || filePath.startsWith("dist/"),
        filePath,
      ).toBe(true);
    }
  });
});

describe("install-size check", () => {
  function checkSize(folder: string, ...args: string[]) {
    return spawnSync(
      process.execPath,
      ["scripts/install-size.js", folder, ...args],
      { encoding: "utf8" },
    );
  }

  function installFolder(): string {
    const folder = makeFolder();
    const packageFolder = path.join(folder, "node_modules", "dependency");
    mkdirSync(packageFolder, { recursive: true });
    writeFileSync(path.join(packageFolder, "index.js"), "x".repeat(300_000));
    return folder;
  }

  it("passes within the budget and prints the size", () => {
    const result = checkSize(installFolder());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Installed size: 0.3 MB (budget 150 MB)");
  });

  it("fails over the budget, naming the size and the budget", () => {
    const result = checkSize(installFolder(), "--budget", "0.1");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Installed size 0.3 MB is over the budget of 0.1 MB.",
    );
  });
});
