# Proposal

## Why

konvertoj now knows which files to use and where each result goes, but nothing runs: every real command ends with "isn't available yet." Each mode from feature 5 on needs the same machinery:
- process many files safely,
- keep going when one fails,
- show progress and a clear summary,
- exit with codes scripts can rely on,
- stop cleanly on Ctrl+C.

Building it once, before any real mode, means a mode only has to say how to turn one input into one output.

## What Changes

- **Batch runner:** runs a mode's work over every planned item.
  - It processes up to `min(4, CPU cores)` files at once.
  - It prepares output folders first, and writes each result through the safe temporary-file helper from feature 3.
  - A failed file doesn't stop the others.
  - Unreadable inputs from feature 3 count as failed files.
- **Modes gain an optional `run` function.** A mode without one still says "<mode> isn't available yet.", and no real mode gets one in this change.
- **Each file's result** is one of:
  - succeeded: a line with input → output and its before → after size,
  - failed: a plain-English reason,
  - skipped: a short note, for modes like `compress` and `tojpg` later.
- **Progress:** a one-line progress bar, `Converting 37/120…`, redrawn in place on standard error when it's a terminal. A long single job can add its own percentage and time left.
- **End summary:** succeeded, failed and skipped counts, total size before → after with the change in percent, time taken, and every failure with its reason.
- **Exit codes:**
  - `0`: no file failed (skipped files count as fine, even if every file was skipped)
  - `1`: every file failed, or the command was invalid
  - `2`: some files failed
- **`-q/--quiet`** shows only errors. **`-v/--verbose`** adds each step's detail and full technical error details. Using both together is rejected.
- **Colours:** Node's `util.styleText`, used only when a stream is a terminal and `NO_COLOR` isn't set. Piped output has no colour codes and no progress bar.
- **Friendly errors:**
  - an expected problem (a "user error") shows its own message,
  - an unexpected error inside a mode shows "<file> couldn't be converted because of an unexpected problem. Run again with --verbose for details.",
  - an unexpected error anywhere else in konvertoj shows a similar message,
  - stack traces appear only with `--verbose`.
- **Ctrl+C:** stops starting new files, lets in-progress files stop, removes half-written temporary files, keeps finished outputs, prints what was finished, and exits with `130`. A second Ctrl+C exits at once, still removing temporary files.
- **Test-only `copy` mode:** lives in `test/support/` and is passed into `main` by the tests and by a small test launcher for real-process checks. Nothing about it is in `dist/` or the published package.
- Tick "4. Batch runner and reporting" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `batch-runner`: How a mode's work runs over the planned files: preparing folders, how many run at once, carrying on after failures, exit codes and Ctrl+C.
- `run-reporting`: What konvertoj shows while and after running: per-file lines, the progress bar, the summary, `--quiet` and `--verbose`, colours, and friendly error messages.

### Modified Capabilities

- `command-line`: the "Errors are for people" requirement now also covers unexpected errors, which show a friendly message and only show technical details with `--verbose`.

## Impact

- New source:
  - `src/runner.ts`: runs the batch, with concurrency, results, Ctrl+C and exit codes.
  - `src/report.ts`: formats lines, the progress bar, the summary, sizes and colours.
  - `src/errors.ts`: `UserError`, replacing feature 3's `InputError`. Its uses in `inputs.ts`, `outputs.ts` and `output-files.ts` and their tests are renamed.
- Changed source:
  - `src/main.ts`: calls the runner. `Output` gains terminal and colour information, and `main` accepts extra modes so tests can add `copy`.
  - `src/cli.ts`: passes real stream details, catches unexpected errors, and handles Ctrl+C.
  - `src/output-files.ts`: tracks temporary files so Ctrl+C can remove them.
  - `src/modes/registry.ts`: the optional `run` field on `Mode`.
- New test support: `test/support/copy-mode.ts` and `test/support/run-with-copy.ts`, which builds into a small launcher.
- No new dependencies.
