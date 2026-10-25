import fs from "node:fs";
import path from "node:path";
import { UserError } from "./errors.js";
import type { InputFile } from "./inputs.js";
import { extensionsFor, formatLabels } from "./modes/formats.js";
import type { Mode } from "./modes/registry.js";

export interface PlannedItem {
  inputs: InputFile[];
  output?: string;
}

export interface OutputPlan {
  items: PlannedItem[];
  warnings: string[];
}

const knownFormats = Object.keys(formatLabels);
const knownExtensions = new Set(knownFormats.flatMap(extensionsFor));

function formatOfExtension(extension: string): string | undefined {
  const bare = extension.slice(1).toLowerCase();
  return knownFormats.find((format) => extensionsFor(format).includes(bare));
}

function outputFormat(mode: Mode, input: InputFile): string | undefined {
  return mode.output === "same"
    ? formatOfExtension(path.extname(input.path))
    : mode.output;
}

function outputExtension(mode: Mode, input: InputFile): string {
  return mode.output === "same" ? path.extname(input.path) : `.${mode.output}`;
}

function defaultName(mode: Mode, input: InputFile): string {
  const { name } = path.parse(input.path);
  const suffix = mode.outputSuffix ? `-${mode.outputSuffix}` : "";
  return `${name}${suffix}${outputExtension(mode, input)}`;
}

function withExtension(
  wanted: string,
  mode: Mode,
  input: InputFile,
  warnings: string[],
): string {
  const extension = path.extname(wanted);
  const bare = extension.slice(1).toLowerCase();
  const format = outputFormat(mode, input);
  const accepted = format
    ? extensionsFor(format)
    : [outputExtension(mode, input).slice(1).toLowerCase()];
  if (extension && accepted.includes(bare)) {
    return wanted;
  }
  if (extension && knownExtensions.has(bare)) {
    const fixed = `${wanted.slice(0, -extension.length)}${outputExtension(mode, input)}`;
    const label = format
      ? formatLabels[format]
      : "the same format as the input";
    warnings.push(
      `-o ${path.basename(wanted)} ends in ${extension}, but ${mode.name} makes ${label} files. Saving as ${path.basename(fixed)}.`,
    );
    return fixed;
  }
  return `${wanted}${outputExtension(mode, input)}`;
}

function isFolder(target: string): boolean {
  return fs.statSync(target, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function takenKey(file: string): string {
  return path.resolve(file).toLowerCase();
}

export function planOutputs(
  mode: Mode,
  inputs: InputFile[],
  options: { output?: string; overwrite: boolean; cwd: string },
): OutputPlan {
  const warnings: string[] = [];
  const taken = new Set(inputs.map((input) => takenKey(input.path)));
  const claim = (wanted: string) => {
    const { dir, name, ext } = path.parse(wanted);
    let candidate = wanted;
    for (let number = 1; ; number++) {
      const isFree =
        !taken.has(takenKey(candidate)) &&
        (options.overwrite || !fs.existsSync(candidate));
      if (isFree) {
        taken.add(takenKey(candidate));
        return candidate;
      }
      candidate = path.join(dir, `${name} (${number})${ext}`);
    }
  };

  const readable = inputs.filter((input) => !input.unreadable);
  const unreadableItems = inputs
    .filter((input) => input.unreadable)
    .map((input) => ({ inputs: [input] }));
  const target =
    options.output === undefined
      ? undefined
      : path.resolve(options.cwd, options.output);

  if (mode.output === "none") {
    return { items: inputs.map((input) => ({ inputs: [input] })), warnings };
  }

  if (mode.combinesInputs) {
    const [first] = readable;
    if (!first) {
      return { items: unreadableItems, warnings };
    }
    let wanted = path.join(path.dirname(first.path), defaultName(mode, first));
    if (target && isFolder(target)) {
      wanted = path.join(target, defaultName(mode, first));
    } else if (target) {
      wanted = withExtension(target, mode, first, warnings);
    }
    return {
      items: [{ inputs: readable, output: claim(wanted) }, ...unreadableItems],
      warnings,
    };
  }

  const targetIsFolder =
    target !== undefined &&
    (inputs.length > 1 ||
      inputs.some((input) => input.base) ||
      isFolder(target) ||
      /[/\\]$/.test(options.output ?? ""));
  if (targetIsFolder && fs.existsSync(target) && !isFolder(target)) {
    throw new UserError(
      `-o ${options.output} is a file, but -o must be a folder when there are several inputs. Choose a folder name, e.g. -o converted.`,
    );
  }

  const items = inputs.map((input): PlannedItem => {
    if (input.unreadable) {
      return { inputs: [input] };
    }
    let wanted = path.join(path.dirname(input.path), defaultName(mode, input));
    if (target && targetIsFolder) {
      const below = path.relative(
        input.base ?? path.dirname(input.path),
        path.dirname(input.path),
      );
      wanted = path.join(target, below, defaultName(mode, input));
    } else if (target) {
      wanted = withExtension(target, mode, input, warnings);
    }
    return { inputs: [input], output: claim(wanted) };
  });
  return { items, warnings };
}
