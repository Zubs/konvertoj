import fg from "fast-glob";
import fs from "node:fs";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { UserError } from "./errors.js";
import { commandShape } from "./help.js";
import { displayPath } from "./paths.js";

export interface InputFile {
  path: string;
  base?: string;
  unreadable?: string;
  format?: string;
}

export interface ResolvedInputs {
  inputs: InputFile[];
  warnings: string[];
}

const naturalOrder = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
}).compare;

function readdirSkippingLocked(lockedFolders: string[]): typeof fs.readdir {
  const readdir = (
    folder: string,
    options: { withFileTypes: true },
    callback: (
      error: NodeJS.ErrnoException | null,
      entries: fs.Dirent[],
    ) => void,
  ) =>
    fs.readdir(folder, options, (error, entries) => {
      if (error?.code === "EACCES" || error?.code === "EPERM") {
        lockedFolders.push(folder);
        callback(null, []);
        return;
      }
      callback(error, entries);
    });
  return readdir as unknown as typeof fs.readdir;
}

async function search(
  pattern: string,
  cwd: string,
  lockedFolders: string[],
): Promise<string[]> {
  const matches = await fg(pattern, {
    cwd,
    onlyFiles: true,
    dot: false,
    absolute: true,
    fs: { readdir: readdirSkippingLocked(lockedFolders) },
  });
  return matches.map((match) => path.resolve(match)).sort(naturalOrder);
}

function staticBase(pattern: string): string {
  const segments = pattern.split("/");
  const fixed = segments.slice(
    0,
    segments.findIndex(
      (segment) => segment !== "" && fg.isDynamicPattern(segment),
    ),
  );
  return fixed.length === 0 ? "." : `${fixed.join("/")}/`;
}

function describeReadError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EACCES" || code === "EPERM") {
    return "permission denied";
  }
  if (code === "EBUSY") {
    return "it's in use by another program";
  }
  return "it couldn't be opened";
}

async function unreadableReason(file: string): Promise<string | undefined> {
  try {
    const handle = await open(file, "r");
    await handle.close();
    return undefined;
  } catch (error) {
    return describeReadError(error);
  }
}

export async function resolveInputs(
  args: string[],
  options: { recursive: boolean; cwd: string },
): Promise<ResolvedInputs> {
  if (args.length === 0) {
    throw new UserError(`No input files given.\n\nUsage: ${commandShape}`);
  }

  const found: InputFile[] = [];
  const problems: string[] = [];
  const lockedFolders: string[] = [];

  for (const arg of args) {
    const absolute = path.resolve(options.cwd, arg);
    const stats = await stat(absolute).catch(() => undefined);
    if (stats?.isDirectory()) {
      const matches = await search(
        options.recursive ? "**" : "*",
        absolute,
        lockedFolders,
      );
      if (matches.length === 0) {
        problems.push(`No matching files found in ${arg}.`);
      }
      found.push(...matches.map((match) => ({ path: match, base: absolute })));
    } else if (stats) {
      found.push({ path: absolute });
    } else if (fg.isDynamicPattern(arg)) {
      const pattern =
        process.platform === "win32" ? arg.replaceAll("\\", "/") : arg;
      const matches = await search(pattern, options.cwd, lockedFolders);
      if (matches.length === 0) {
        problems.push(`No matching files found for "${arg}".`);
      }
      const base = path.resolve(options.cwd, staticBase(pattern));
      found.push(...matches.map((match) => ({ path: match, base })));
    } else {
      problems.push(`${arg} can't be found. Check the name and try again.`);
    }
  }

  if (problems.length > 0) {
    throw new UserError(problems.join("\n"));
  }

  const seen = new Set<string>();
  const inputs: InputFile[] = [];
  for (const input of found) {
    const key = fs.realpathSync.native(input.path);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const unreadable = await unreadableReason(input.path);
    inputs.push(unreadable ? { ...input, unreadable } : input);
  }

  const warnings = lockedFolders.map(
    (folder) =>
      `Skipped ${displayPath(options.cwd, folder)} because it can't be opened.`,
  );
  return { inputs, warnings };
}
