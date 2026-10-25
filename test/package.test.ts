import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

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
