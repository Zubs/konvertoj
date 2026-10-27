import { stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { checkItem, withArticle } from "./detect.js";
import { isUserError } from "./errors.js";
import { extensionsFor, formatLabels } from "./modes/formats.js";
import { needsFfmpeg, type Mode } from "./modes/registry.js";
import { prepareOutputFolders, writeOutputFile } from "./output-files.js";
import type { OutputPlan, PlannedItem } from "./outputs.js";
import type { BatchResult, Reporter, Section } from "./report.js";

export interface BatchSettings {
  options: Record<string, string | boolean | undefined>;
  overwrite: boolean;
  cwd: string;
  signal: AbortSignal;
  colours?: boolean;
  ffmpeg?: string;
}

const unexpectedProblem =
  "couldn't be converted because of an unexpected problem. Run again with --verbose for details.";

export function parallelLimit(cores = availableParallelism()): number {
  return Math.max(1, Math.min(4, cores));
}

export function exitCodeFor(result: BatchResult, total: number): number {
  if (result.interrupted) {
    return 130;
  }
  if (result.failed.length === 0) {
    return 0;
  }
  return result.failed.length === total ? 1 : 2;
}

async function totalSize(files: string[]): Promise<number> {
  const sizes = await Promise.all(
    files.map(async (file) => (await stat(file)).size),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
}

export async function runBatch(
  mode: Mode & Required<Pick<Mode, "run">>,
  plan: OutputPlan,
  settings: BatchSettings,
  reporter: Reporter,
): Promise<BatchResult> {
  await prepareOutputFolders(plan.items, settings.cwd);
  const result: BatchResult = {
    converted: 0,
    failed: [],
    skipped: 0,
    sizeBefore: 0,
    sizeAfter: 0,
    interrupted: false,
  };

  const checksFormats = mode.inputs.every((format) =>
    Object.hasOwn(formatLabels, format),
  );

  const runItem = async (item: PlannedItem, index: number) => {
    const unreadable = item.inputs.find((input) => input.unreadable);
    if (unreadable) {
      const reason = `can't be read (${unreadable.unreadable})`;
      result.failed.push({ item, reason });
      reporter.failed(item, reason);
      return;
    }
    let output = item.output ?? "";
    const startedAt = Date.now();
    reporter.started(item);
    try {
      let inputs = item.inputs;
      const notes: string[] = [];
      if (checksFormats) {
        const checked = await checkItem(
          mode,
          item,
          settings.options,
          settings.cwd,
        );
        if ("skipped" in checked) {
          result.skipped++;
          reporter.skipped(item, checked.skipped);
          return;
        }
        inputs = checked.inputs;
        notes.push(...checked.notes);
      }
      const realFormat = inputs[0]?.format;
      const extension = path.extname(output);
      if (
        mode.output === "same" &&
        realFormat &&
        extension &&
        !extensionsFor(realFormat).includes(extension.slice(1).toLowerCase())
      ) {
        output = `${output.slice(0, -extension.length)}.${realFormat}`;
        notes.push(
          `saved as .${realFormat}, because ${path.basename(item.inputs[0]?.path ?? "")} is really ${withArticle(realFormat)} file`,
        );
      }
      const savedPaths: string[] = [];
      let shown: Section | undefined;
      const outcome = await mode.run({
        inputs,
        output,
        options: settings.options,
        save: async (write, { suffix = "" } = {}) => {
          const { dir, name, ext } = path.parse(output);
          const savedPath = await writeOutputFile(
            path.join(dir, `${name}${suffix}${ext}`),
            write,
            { overwrite: settings.overwrite },
          );
          savedPaths.push(savedPath);
          return savedPath;
        },
        progress: (fraction) => reporter.progress(fraction, startedAt),
        detail: (message) => reporter.detail(message),
        note: (message) => notes.push(message),
        show: (section) => {
          shown = section;
        },
        colours: settings.colours === true,
        ffmpeg: settings.ffmpeg,
        signal: settings.signal,
      });
      if (shown && !outcome?.skipped) {
        result.converted++;
        reporter.shown(index, shown, notes);
        return;
      }
      if (outcome?.skipped || savedPaths.length === 0) {
        result.skipped++;
        reporter.skipped(item, outcome?.skipped ?? "nothing was written");
        return;
      }
      const before = await totalSize(item.inputs.map((input) => input.path));
      const after = await totalSize(savedPaths);
      result.converted++;
      result.sizeBefore += before;
      result.sizeAfter += after;
      reporter.succeeded(
        { ...item, output: savedPaths[0] },
        before,
        after,
        notes,
        savedPaths.length - 1,
      );
    } catch (error) {
      if (settings.signal.aborted) {
        return;
      }
      const reason = isUserError(error) ? error.message : unexpectedProblem;
      result.failed.push({ item, reason });
      reporter.failed(item, reason, error);
    }
  };

  let next = 0;
  const worker = async () => {
    while (next < plan.items.length && !settings.signal.aborted) {
      const index = next++;
      const item = plan.items[index];
      if (item) {
        await runItem(item, index);
      }
    }
  };
  await Promise.all(
    Array.from(
      {
        length: Math.min(
          needsFfmpeg(
            mode,
            plan.items.flatMap((item) => item.inputs),
          )
            ? 1
            : parallelLimit(),
          plan.items.length,
        ),
      },
      worker,
    ),
  );

  result.interrupted = settings.signal.aborted;
  reporter.finish(result);
  return result;
}
