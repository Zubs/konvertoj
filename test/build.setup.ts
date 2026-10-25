import { spawnSync } from "node:child_process";
import path from "node:path";

export default function buildProject() {
  const tscPath = path.join("node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(
    process.execPath,
    [tscPath, "-p", "tsconfig.build.json"],
    {
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `The build failed before the tests could run:\n${result.stdout}${result.stderr}`,
    );
  }
}
