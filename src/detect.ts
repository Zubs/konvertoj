import { Buffer } from "node:buffer";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromFile } from "file-type";
import { damagedFile, isUserError, UserError } from "./errors.js";
import type { InputFile } from "./inputs.js";
import { formatLabels } from "./modes/formats.js";
import {
  describeFormats,
  findMode,
  modes,
  type Mode,
} from "./modes/registry.js";
import type { PlannedItem } from "./outputs.js";

export type CheckedItem = { inputs: InputFile[] } | { skipped: string };

const detectedFormats: Record<string, string> = {
  jpg: "jpg",
  png: "png",
  apng: "png",
  webp: "webp",
  avif: "avif",
  gif: "gif",
  tif: "tiff",
  bmp: "bmp",
  ico: "ico",
  heic: "heic",
  pdf: "pdf",
  mov: "mov",
  mkv: "mkv",
  avi: "avi",
  webm: "webm",
  m4v: "m4v",
  mp4: "mp4",
};

const svgStart =
  /^\uFEFF?(?:\s|<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)*<svg[\s>/]/i;
const sniffedBytes = 4096;
const mostModesListed = 6;

async function startOfText(file: string): Promise<string> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(sniffedBytes);
    const { bytesRead } = await handle.read(buffer, 0, sniffedBytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function detectFormat(file: string): Promise<string | undefined> {
  if ((await stat(file)).size === 0) {
    throw new UserError(
      "is empty. Check the file was saved or downloaded completely.",
    );
  }
  let found: Awaited<ReturnType<typeof fileTypeFromFile>>;
  try {
    found = await fileTypeFromFile(file);
  } catch (error) {
    if (typeof (error as NodeJS.ErrnoException).code === "string") {
      throw error;
    }
    throw damagedFile(error);
  }
  if (found && found.ext !== "xml") {
    return detectedFormats[found.ext];
  }
  if (svgStart.test(await startOfText(file))) {
    return "svg";
  }
  return path.extname(file).toLowerCase() === ".svg" ? "svg" : undefined;
}

function shortLabel(format: string): string {
  return (formatLabels[format] ?? format).replace(/ \(.*\)$/, "");
}

function withArticle(format: string): string {
  const label = shortLabel(format);
  return `${/^[AEIOMSX]/.test(label) ? "an" : "a"} ${label}`;
}

function wrongKind(mode: Mode, format: string): UserError {
  const accepting = modes.filter((other) => other.inputs.includes(format));
  const ordered = [
    ...accepting.filter((other) => other.name.startsWith(`${format}to`)),
    ...accepting.filter((other) => !other.name.startsWith(`${format}to`)),
  ];
  const shown = ordered
    .slice(0, mostModesListed)
    .map((other) => other.name)
    .join(", ");
  const more =
    ordered.length > mostModesListed
      ? ` and ${ordered.length - mostModesListed} more (run konvertoj --list-modes)`
      : "";
  return new UserError(
    `is ${withArticle(format)}, which ${mode.name} can't use. ${mode.name} works with ${describeFormats(mode.inputs)}. Modes for ${shortLabel(format)} files: ${shown}${more}.`,
  );
}

function rejection(mode: Mode, format: string, formats: string[]): UserError {
  const anyFormatMode = findMode(`to${mode.output}`);
  if (
    mode.combinesInputs &&
    new Set(formats).size > 1 &&
    anyFormatMode &&
    anyFormatMode !== mode &&
    formats.every((each) => anyFormatMode.inputs.includes(each))
  ) {
    return new UserError(
      `is ${withArticle(format)}, but ${mode.name} only takes ${describeFormats(mode.inputs)}. Try: -m ${anyFormatMode.name}`,
    );
  }
  if (mode.output !== "same" && mode.output !== "none") {
    if (format === mode.output) {
      return new UserError(
        `is already ${withArticle(format)}, so there's nothing to convert.`,
      );
    }
    const replacement = [findMode(`${format}to${mode.output}`), anyFormatMode]
      .filter((candidate) => candidate !== undefined)
      .find((candidate) => candidate.inputs.includes(format));
    if (replacement) {
      return new UserError(
        `looks like ${withArticle(format)}. Try: -m ${replacement.name}`,
      );
    }
  }
  return wrongKind(mode, format);
}

export async function checkItem(
  mode: Mode,
  item: PlannedItem,
  options: Record<string, string | boolean | undefined>,
  cwd: string,
): Promise<CheckedItem> {
  const naming = (input: InputFile, error: unknown) =>
    item.inputs.length > 1 && isUserError(error)
      ? new UserError(`${path.relative(cwd, input.path)} ${error.message}`)
      : error;

  const checked: (InputFile & { format: string })[] = [];
  for (const input of item.inputs) {
    try {
      const format = await detectFormat(input.path);
      if (!format) {
        throw new UserError(
          "isn't a file konvertoj can convert. Run konvertoj --list-modes to see the formats it works with.",
        );
      }
      checked.push({ ...input, format });
    } catch (error) {
      throw naming(input, error);
    }
  }

  const formats = checked.map((input) => input.format);
  for (const input of checked) {
    if (!mode.inputs.includes(input.format)) {
      throw naming(input, rejection(mode, input.format, formats));
    }
  }

  const conversionOptionGiven = [
    ...mode.options.map((option) => option.name),
    "strip-metadata",
  ].some((name) => options[name] !== undefined);
  const [only] = checked;
  if (
    mode.name === `to${mode.output}` &&
    checked.length === 1 &&
    only?.format === mode.output &&
    !conversionOptionGiven
  ) {
    return { skipped: `already ${withArticle(mode.output)}` };
  }
  return { inputs: checked };
}
