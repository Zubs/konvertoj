import { chmodSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isUserError } from "../src/errors.js";
import { resolveInputs } from "../src/inputs.js";
import type { Mode } from "../src/modes/registry.js";
import { planOutputs, type OutputPlan } from "../src/outputs.js";
import { Reporter, type BatchResult, type Output } from "../src/report.js";
import { exitCodeFor, parallelLimit, runBatch } from "../src/runner.js";
import { copyMode, copyStats, resetCopyStats } from "./support/copy-mode.mjs";
import { cannotTestPermissions, makeFolder } from "./support/folders.js";

const runnableCopy = copyMode as Mode & Required<Pick<Mode, "run">>;
const lockedPaths: string[] = [];

beforeEach(() => resetCopyStats());

afterEach(() => {
  for (const locked of lockedPaths.splice(0)) {
    chmodSync(locked, 0o755);
  }
});

function quietOutput(): Output & { text: () => string } {
  let written = "";
  return {
    out: (text) => (written += text),
    err: (text) => (written += text),
    errIsTerminal: false,
    colours: { out: false, err: false },
    text: () => written,
  };
}

async function planFor(cwd: string, files: string[], output?: string) {
  for (const file of files) {
    writeFileSync(path.join(cwd, file), file);
  }
  const { inputs } = await resolveInputs(files, { recursive: false, cwd });
  return planOutputs(copyMode, inputs, { output, overwrite: false, cwd });
}

async function run(
  cwd: string,
  plan: OutputPlan,
  controller = new AbortController(),
  reporter?: Reporter,
) {
  const output = quietOutput();
  const result = await runBatch(
    runnableCopy,
    plan,
    { options: {}, overwrite: false, cwd, signal: controller.signal },
    reporter ??
      new Reporter(
        output,
        { quiet: false, verbose: false, cwd },
        plan.items.length,
      ),
  );
  return {
    result,
    exitCode: exitCodeFor(result, plan.items.length),
    text: output.text(),
  };
}

const names = (count: number, name: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => name(index + 1));

function filesIn(folder: string) {
  return readdirSync(folder).sort();
}

describe("runBatch", () => {
  it("writes one file and exits with 0", async () => {
    const cwd = makeFolder();
    const { result, exitCode } = await run(cwd, await planFor(cwd, ["a.txt"]));
    expect(result.converted).toBe(1);
    expect(exitCode).toBe(0);
    expect(filesIn(cwd)).toEqual(["a-copy.txt", "a.txt"]);
  });

  it("writes ten files", async () => {
    const cwd = makeFolder();
    const files = names(10, (index) => `file${index}.txt`);
    const { result, exitCode } = await run(
      cwd,
      await planFor(cwd, files, "out"),
    );
    expect(result.converted).toBe(10);
    expect(exitCode).toBe(0);
    expect(filesIn(path.join(cwd, "out"))).toHaveLength(10);
  });

  it("keeps going when some files fail, and exits with 2", async () => {
    const cwd = makeFolder();
    const files = [
      ...names(7, (index) => `good${index}.txt`),
      "fail1.txt",
      "fail2.txt",
      "crash.txt",
    ];
    const { result, exitCode } = await run(
      cwd,
      await planFor(cwd, files, "out"),
    );
    expect(result.converted).toBe(7);
    expect(result.failed.map(({ reason }) => reason).sort()).toEqual([
      "couldn't be converted because of an unexpected problem. Run again with --verbose for details.",
      "couldn't be copied because its name says fail",
      "couldn't be copied because its name says fail",
    ]);
    expect(exitCode).toBe(2);
    expect(filesIn(path.join(cwd, "out"))).toHaveLength(7);
  });

  it("exits with 1 when every file fails", async () => {
    const cwd = makeFolder();
    const { result, exitCode } = await run(
      cwd,
      await planFor(
        cwd,
        names(10, (index) => `fail${index}.txt`),
      ),
    );
    expect(result.failed).toHaveLength(10);
    expect(exitCode).toBe(1);
  });

  it("exits with 0 when every file is skipped", async () => {
    const cwd = makeFolder();
    const { result, exitCode } = await run(
      cwd,
      await planFor(cwd, ["skip1.txt", "skip2.txt"]),
    );
    expect(result.skipped).toBe(2);
    expect(exitCode).toBe(0);
    expect(filesIn(cwd)).toEqual(["skip1.txt", "skip2.txt"]);
  });

  it("counts an unreadable input as failed without running it", async () => {
    const cwd = makeFolder();
    const plan = await planFor(cwd, ["a.txt"]);
    plan.items.push({
      inputs: [
        { path: path.join(cwd, "secret.txt"), unreadable: "permission denied" },
      ],
    });
    const { result, exitCode } = await run(cwd, plan);
    expect(result.converted).toBe(1);
    expect(result.failed.map(({ reason }) => reason)).toEqual([
      "can't be read (permission denied)",
    ]);
    expect(exitCode).toBe(2);
  });

  it("never runs more than 4 files at once", async () => {
    const cwd = makeFolder();
    await run(
      cwd,
      await planFor(
        cwd,
        names(20, (index) => `slow${index}.txt`),
        "out",
      ),
    );
    expect(copyStats.mostAtOnce).toBeLessThanOrEqual(4);
    expect(copyStats.mostAtOnce).toBe(parallelLimit());
    expect([
      parallelLimit(16),
      parallelLimit(2),
      parallelLimit(1),
      parallelLimit(0),
    ]).toEqual([4, 2, 1, 1]);
  });

  it("adds up sizes, including an output bigger than its input", async () => {
    const cwd = makeFolder();
    const { result } = await run(
      cwd,
      await planFor(cwd, ["small.txt", "big.txt"]),
    );
    const sizeOf = (file: string) => statSync(path.join(cwd, file)).size;
    expect(result.sizeBefore).toBe(sizeOf("small.txt") + sizeOf("big.txt"));
    expect(result.sizeAfter).toBe(
      sizeOf("small-copy.txt") + sizeOf("big-copy.txt"),
    );
    expect(sizeOf("big-copy.txt")).toBe(2 * sizeOf("big.txt"));
  });

  it("stops cleanly when the signal aborts, keeping finished outputs", async () => {
    const cwd = makeFolder();
    const files = [
      "1.txt",
      "2.txt",
      ...names(8, (index) => `slow${index}.txt`),
    ];
    const plan = await planFor(cwd, files, "out");
    const controller = new AbortController();
    const output = quietOutput();
    class AbortAfterTwo extends Reporter {
      private successes = 0;
      override succeeded(...args: Parameters<Reporter["succeeded"]>) {
        super.succeeded(...args);
        if (++this.successes === 2) {
          controller.abort();
        }
      }
    }
    const reporter = new AbortAfterTwo(
      output,
      { quiet: false, verbose: false, cwd },
      plan.items.length,
    );
    const { result, exitCode } = await run(cwd, plan, controller, reporter);
    expect(result.interrupted).toBe(true);
    expect(exitCode).toBe(130);
    expect(filesIn(path.join(cwd, "out"))).toEqual([
      "1-copy.txt",
      "2-copy.txt",
    ]);
    expect(output.text()).toContain("Stopped by Ctrl+C after 2 of 10");
  });

  it.skipIf(cannotTestPermissions)(
    "fails before running anything when the output folder isn't writable",
    async () => {
      const cwd = makeFolder(["locked/.keep"]);
      const locked = path.join(cwd, "locked");
      const plan = await planFor(cwd, ["a.txt", "b.txt"], "locked");
      chmodSync(locked, 0o555);
      lockedPaths.push(locked);
      const error = await run(cwd, plan).catch((caught: unknown) => caught);
      expect(isUserError(error)).toBe(true);
      expect((error as Error).message).toBe(
        "Can't write to locked. Choose another folder with -o.",
      );
      expect(copyStats.mostAtOnce).toBe(0);
    },
  );
});

describe("exitCodeFor", () => {
  const result = (overrides: Partial<BatchResult>): BatchResult => ({
    converted: 0,
    failed: [],
    skipped: 0,
    sizeBefore: 0,
    sizeAfter: 0,
    interrupted: false,
    ...overrides,
  });
  const failure = { item: { inputs: [] }, reason: "" };

  it.each([
    [result({ converted: 3 }), 3, 0],
    [result({ converted: 2, failed: [failure] }), 3, 2],
    [result({ failed: [failure, failure] }), 2, 1],
    [result({ skipped: 3 }), 3, 0],
    [result({ converted: 1, interrupted: true }), 3, 130],
  ])("gives the right code (%#)", (batch, total, code) => {
    expect(exitCodeFor(batch, total)).toBe(code);
  });
});
