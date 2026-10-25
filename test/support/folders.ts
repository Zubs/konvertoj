import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

const createdFolders: string[] = [];

afterEach(() => {
  for (const folder of createdFolders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

export function makeFolder(files: string[] = []): string {
  const folder = realpathSync.native(
    mkdtempSync(path.join(tmpdir(), "konvertoj-")),
  );
  createdFolders.push(folder);
  for (const file of files) {
    const filePath = path.join(folder, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, file);
  }
  return folder;
}

export const cannotTestPermissions =
  process.platform === "win32" || process.getuid?.() === 0;
