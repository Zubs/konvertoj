import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.join("scripts", "update-readme.js");
const temporaryFolders: string[] = [];

function runScript(...args: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const folder of temporaryFolders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

describe("README mode section", () => {
  it("matches the mode registry", () => {
    const result = runScript("--check");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("keeps the text outside the markers", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "konvertoj-readme-"));
    temporaryFolders.push(folder);
    const readmePath = path.join(folder, "README.md");
    writeFileSync(
      readmePath,
      "Before\n<!-- modes:start -->\nold\n<!-- modes:end -->\nAfter\n",
    );

    expect(runScript(readmePath).status).toBe(0);

    const updated = readFileSync(readmePath, "utf8");
    expect(
      updated.startsWith("Before\n<!-- modes:start -->\n### Image\n"),
    ).toBe(true);
    expect(updated.endsWith("\n<!-- modes:end -->\nAfter\n")).toBe(true);
    expect(updated).toContain("| `heictojpg` |");
    expect(updated).not.toContain("old");
  });

  it("reports an out-of-date README", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "konvertoj-readme-"));
    temporaryFolders.push(folder);
    const readmePath = path.join(folder, "README.md");
    writeFileSync(
      readmePath,
      "<!-- modes:start -->\nold\n<!-- modes:end -->\n",
    );

    const result = runScript("--check", readmePath);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "README.md is out of date. Run npm run docs.",
    );
    expect(readFileSync(readmePath, "utf8")).toContain("old");
  });
});
