# Design

## Context

After feature 3, `main` resolves inputs, plans outputs and prints the plan for `--dry-run`, then ends with "<mode> isn't available yet." `src/output-files.ts` already has `prepareOutputFolders` and `writeOutputFile`, but nothing calls them. Errors meant for the user are `InputError`, defined in `src/inputs.ts`. `cli.ts` writes `main`'s text to `process.stdout`/`process.stderr`. Any error `main` doesn't catch reaches Node.js, which prints a stack trace. See proposal.md for why, and the specs for the behaviour.

## Goals / Non-Goals

**Goals:**
- One small runner contract that every later mode implements: turn one planned item into one saved output, or report a skip.
- Reporting that tests can check exactly, by passing in fake streams that pretend to be terminals or not.
- No test-only code in `dist/`.

**Non-Goals:**
- Any real mode. All 149 modes still say "isn't available yet."
- Per-mode concurrency, e.g. video one at a time (feature 15 adds that if needed).
- Format checks before running (feature 5).
- Changing the dry-run output.

## Decisions

### Errors (`src/errors.ts`)
`export class UserError extends Error { name = "UserError" }` replaces `InputError`. The class moves out of `inputs.ts`, so the runner and modes can use it without loading `fast-glob`. Errors are recognised by `error.name === "UserError"` rather than `instanceof`, because the test-only copy mode is plain JavaScript loaded next to `dist/`. Matching on the name means it doesn't need konvertoj's exact class instance. The four modules and their tests are updated by renaming.

### The runner contract
`Mode` gains `run?: (context: RunContext) => Promise<{ skipped: string } | void>`. The context holds:
- `inputs`: the item's inputs (one file, or every file for a combining mode),
- `output`: the planned final path,
- `options`: the parsed option values,
- `save(write)`: calls `writeOutputFile(output, write, { overwrite })` and returns the saved path. Modes always write through it, so the temporary-file and numbering rules can't be skipped.
- `progress(fraction)`: reports progress for long jobs, from 0 to 1,
- `detail(message)`: a verbose-only note,
- `signal`: an `AbortSignal` that fires on Ctrl+C.

Returning `{ skipped: "already a JPG" }` marks the item skipped. Throwing marks it failed: a `UserError` shows its message, and anything else shows the friendly unexpected-problem reason.

### Running the batch (`src/runner.ts`)
`runBatch(mode, plan, settings, reporter)` returns `{ succeeded, failed, skipped, interrupted }`, with sizes.
- It first calls `prepareOutputFolders`. A failure there is a `UserError`, so it fails the command with exit `1` before any work.
- It uses a simple worker pool: `limit = Math.max(1, Math.min(4, os.availableParallelism()))`. That many async workers pull the next item index until none are left or the signal fires. This needs no dependency and keeps input order for starting work.
- Unreadable items, which have no output, are recorded as failed without being run.
- **Sizes:** "before" is the total `stat` size of the item's inputs, and "after" is the `stat` size of the saved output. Only converted items count towards the summary totals.
- **Exit code** (`exitCodeFor(result)`): `130` if interrupted, otherwise `0` when nothing failed, `1` when every item failed, and `2` otherwise.

### Ctrl+C
`cli.ts` creates an `AbortController` and passes its signal into `main`.
- **First `SIGINT`:** `controller.abort()`. Workers stop taking items, running modes see `signal.aborted`, and `writeOutputFile`'s existing clean-up removes their temporary files when they throw. The reporter prints the summary of what finished, with "Stopped by Ctrl+C", and the exit code is `130`.
- **Second `SIGINT`:** synchronously removes every temporary path still registered and calls `process.exit(130)`.
- **Tracking:** `writeOutputFile` adds each temporary path to an exported `pendingTemporaryFiles` set, and deletes it once renamed or removed. That's the only change to `output-files.ts`.

### Reporting (`src/report.ts`)
- **Streams:** `Output` grows to `{ out, err, outIsTerminal, errIsTerminal, colours }`.
  - `cli.ts` fills it from `process.stdout.isTTY`, `process.stderr.isTTY` and `NO_COLOR` (set and not empty means no colours). Colours are used per stream only when that stream is a terminal.
  - Tests pass plain objects, so "terminal" and "piped" are both easy to test without a real terminal.
- **Colour:** `util.styleText` is called only when colours are on, so piped output can't get escape codes, whatever Node.js 22 point release is in use. The `validateStream` option is newer than Node.js 22.0, so it isn't relied on.
  - `✓` and its line are green,
  - `✗` is red,
  - skips and the summary's counts are dim or bold.
- **Line formats** are taken from the spec. Sizes use 1024: below 1 KB shows bytes, otherwise the value has one decimal below 10 (`3.9 KB`) and is whole from 10 up (`410 KB`). The percentage is `Math.round((after − before) / before × 100)`, shown with `−` (U+2212) or `+`.
- **Progress bar:** only when `errIsTerminal` and not quiet.
  - It's drawn as `\r` + text + `\x1b[K` (clear to the end of the line) on standard error.
  - Before any file line is written, the bar is cleared, the line printed, and the bar redrawn.
  - With single-job progress, the bar adds `45%` and, after at least a second has passed, `about N seconds/minutes left`, estimated as elapsed × (1 − f) / f.
  - Redraws are limited to once every 100 ms, apart from the final one.
- **Summary** (standard output, not with quiet):
  - `Done in 1.2s: 9 converted, 1 failed, 2 skipped. 24.1 MB → 6.3 MB (−74%).`
  - then `Failed:` with one indented `<file>: <reason>` line per failure.
  - When stopped, it starts `Stopped by Ctrl+C after 4 of 10.` instead.
- **Verbose:** `Working on <input>` when an item starts, plus the mode's `detail` lines on standard output, and the failure's `stack` (or `String(error)`) indented under its `✗` line.
- **Quiet:** only `✗` lines and command errors.
- **`--quiet` with `--verbose`:** rejected in `main`, before inputs are resolved, using the existing option-problem path.

### Unexpected errors outside the runner
`cli.ts` wraps the `main` call. An error that escapes prints "konvertoj hit an unexpected problem: <message>. Run again with --verbose for details." Its stack is added when `-v` or `--verbose` is among the arguments. The exit code is `1`. A `UserError` that escapes shows just its message.

### `main` and extra modes
`main(args, output, { extraModes = [], signal })` looks modes up in the registry first, then in `extraModes`. That's how tests add `copy`. Production never passes extra modes. With a runnable mode, after warnings and dry run, it calls `runBatch` and returns its exit code. Without one, it still fails with "isn't available yet." before preparing folders.

### Test-only copy mode
- **`test/support/copy-mode.mjs`** is plain JavaScript with no konvertoj imports, plus `copy-mode.d.mts` with its types. It defines `{ name: "copy", group: "Tools", output: "same", outputSuffix: "copy", run }`. Its `run` copies the input through `save`, and the input's name changes its behaviour:
  - `fail`: throws a `UserError`-named error,
  - `crash`: throws `new Error("boom")`,
  - `skip`: returns a skip,
  - `slow`: waits 300 ms, stopping early on abort,
  - `big`: writes double the input.

  It also counts how many runs happen at once, for the parallel-work test.
- **`test/support/run-with-copy.mjs`** imports `../../dist/main.js` and the copy mode, and runs like `cli.ts`, with real streams, Ctrl+C handling and the version check skipped. Spawned tests use it for piping, `NO_COLOR` and Ctrl+C.

Neither file is under `src/`, so `npm pack` never includes them. The existing package test already checks this.

## Risks / Trade-offs

- [Windows can't deliver `SIGINT` to a child process from a test] → The Ctrl+C test is skipped on Windows. The abort path itself is unit-tested on every system by aborting the signal directly.
- [`os.availableParallelism()` may report 1 in small CI containers] → The limit is at least 1. The parallel-work test asserts "at most 4" and uses many files, so it can't fail because of a low core count.
- [A mode that ignores `signal` keeps the first Ctrl+C waiting until its file finishes] → A second Ctrl+C exits at once and still removes temporary files. Every real mode will be written to honour `signal`.
- [Recognising errors by name means any error named "UserError" shows its message] → Only konvertoj and its test mode create errors with that name.
- [The progress line can flicker in slow terminals] → Redraws are limited to once every 100 ms.
