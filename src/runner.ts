import { stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { isUserError } from "./errors.js";
import type { Mode } from "./modes/registry.js";
import { prepareOutputFolders, writeOutputFile } from "./output-files.js";
import type { OutputPlan, PlannedItem } from "./outputs.js";
import type { BatchResult, Reporter } from "./report.js";

export interface BatchSettings {
  options: Record<string, string | boolean | undefined>;
  overwrite: boolean;
  cwd: string;
  signal: AbortSignal;
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

  const runItem = async (item: PlannedItem) => {
    const unreadable = item.inputs.find((input) => input.unreadable);
    if (unreadable) {
      const reason = `can't be read (${unreadable.unreadable})`;
      result.failed.push({ item, reason });
      reporter.failed(item, reason);
      return;
    }
    const output = item.output ?? "";
    const startedAt = Date.now();
    reporter.started(item);
    try {
      let savedPath: string | undefined;
      const outcome = await mode.run({
        inputs: item.inputs,
        output,
        options: settings.options,
        save: async (write) => {
          savedPath = await writeOutputFile(output, write, {
            overwrite: settings.overwrite,
          });
          return savedPath;
        },
        progress: (fraction) => reporter.progress(fraction, startedAt),
        detail: (message) => reporter.detail(message),
        signal: settings.signal,
      });
      if (outcome?.skipped || !savedPath) {
        result.skipped++;
        reporter.skipped(item, outcome?.skipped ?? "nothing was written");
        return;
      }
      const before = await totalSize(item.inputs.map((input) => input.path));
      const after = await totalSize([savedPath]);
      result.converted++;
      result.sizeBefore += before;
      result.sizeAfter += after;
      reporter.succeeded({ ...item, output: savedPath }, before, after);
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
      const item = plan.items[next++];
      if (item) {
        await runItem(item);
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(parallelLimit(), plan.items.length) },
      worker,
    ),
  );

  result.interrupted = settings.signal.aborted;
  reporter.finish(result);
  return result;
}
