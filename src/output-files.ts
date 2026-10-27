import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { mkdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UserError } from "./errors.js";
import type { PlannedItem } from "./outputs.js";
import { displayPath } from "./paths.js";

export const pendingTemporaryFiles = new Set<string>();

function randomName(): string {
  return randomBytes(6).toString("hex");
}

export async function removeEmptyFolders(folders: string[]): Promise<void> {
  const deepestFirst = [...folders].sort((a, b) => b.length - a.length);
  for (const folder of deepestFirst) {
    await rmdir(folder).catch(() => {});
  }
}

export async function prepareOutputFolders(
  items: PlannedItem[],
  cwd: string,
): Promise<string[]> {
  const created: string[] = [];
  const folders = new Set(
    items.flatMap((item) => (item.output ? [path.dirname(item.output)] : [])),
  );
  for (const folder of folders) {
    const testFile = path.join(folder, `.konvertoj-write-test-${randomName()}`);
    try {
      const first = await mkdir(folder, { recursive: true });
      if (first) {
        const top = path.resolve(first);
        let current = path.resolve(folder);
        created.push(current);
        while (current !== top && path.dirname(current) !== current) {
          current = path.dirname(current);
          created.push(current);
        }
      }
      await writeFile(testFile, "");
      await rm(testFile);
    } catch {
      await removeEmptyFolders(created);
      throw new UserError(
        `Can't write to ${displayPath(cwd, folder)}. Choose another folder with -o.`,
      );
    }
  }
  return created;
}

function nextFreeName(wanted: string): string {
  const { dir, name, ext } = path.parse(wanted);
  let candidate = wanted;
  for (let number = 1; fs.existsSync(candidate); number++) {
    candidate = path.join(dir, `${name} (${number})${ext}`);
  }
  return candidate;
}

export async function writeOutputFile(
  finalPath: string,
  write: (temporaryPath: string) => Promise<void>,
  options: { overwrite: boolean },
): Promise<string> {
  const { dir, base } = path.parse(finalPath);
  const temporaryPath = path.join(
    dir,
    `.${base}.${randomName()}.konvertoj-tmp`,
  );
  pendingTemporaryFiles.add(temporaryPath);
  try {
    await write(temporaryPath);
    const savedPath = options.overwrite ? finalPath : nextFreeName(finalPath);
    await rename(temporaryPath, savedPath);
    return savedPath;
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  } finally {
    pendingTemporaryFiles.delete(temporaryPath);
  }
}
