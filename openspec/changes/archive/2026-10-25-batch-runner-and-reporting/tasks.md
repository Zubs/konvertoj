# Tasks

## 1. Errors and the runner contract

- [x] 1.1 Add `src/errors.ts` with `UserError` (its `name` set to `"UserError"`) and an `isUserError(error)` helper that checks the name; replace `InputError` with it in `src/inputs.ts`, `src/outputs.ts`, `src/output-files.ts`, `src/main.ts` and their tests; verify `npm run check` and `npm test` pass unchanged otherwise
- [x] 1.2 Add the `RunContext` type and the optional `run` field to `Mode` in `src/modes/registry.ts` as in design.md (`inputs`, `output`, `options`, `save`, `progress`, `detail`, `signal`; returns `{ skipped }` or nothing); verify `npm run check` passes and `npm run docs` leaves `README.md` unchanged
- [x] 1.3 Make `writeOutputFile` register each temporary path in an exported `pendingTemporaryFiles` set and remove it once renamed or deleted; extend `test/output-files.test.ts` to check the set is empty after both a successful and a failed write, and verify it passes

## 2. Test-only copy mode

- [x] 2.1 Add `test/support/copy-mode.mjs` and `test/support/copy-mode.d.mts` with the `copy` mode from design.md (behaviour from the input name: `fail`, `crash`, `skip`, `slow` honouring `signal`, `big`; a counter of the most runs at once, which can be reset); verify `npm run check` lints and type-checks them
- [x] 2.2 Add `test/support/run-with-copy.mjs`, which imports `../../dist/main.js` and the copy mode and runs like `cli.ts` (real streams, terminal and `NO_COLOR` detection, Ctrl+C handling); verify `npm run build` then `node test/support/run-with-copy.mjs -m copy <file>` copies a file, and that `npm pack --dry-run` lists nothing from `test/`

## 3. Reporting

- [x] 3.1 Add `src/report.ts` with size formatting (1024-based, one decimal below 10, `−`/`+` percent), the success, skip and failure line formats, the progress line (count, optional percentage and time left, `\r` + clear-line, redraws limited to once every 100 ms, cleared before other lines), the summary (time, counts, sizes, failures, "Stopped by Ctrl+C after N of M."), quiet and verbose handling, and colour through `util.styleText` only when the stream allows it; verify `npm run check` passes
- [x] 3.2 Add `test/report.test.ts` with fake streams covering: `formatSize` for 0, 500, 1000, 4000, 4500, 419 840 and 2.4 MB values; `−74%`, `+13%` and `0%`; each line format; the progress line drawn only for a terminal, cleared before lines and the summary, and showing `45%` and "about 37 seconds left" for 0.45 after 30 s; the summary with counts, sizes and failures; quiet showing only failures; verbose adding details and stacks; no escape codes when colours are off and colour codes present when on; verify it passes

## 4. Batch runner

- [x] 4.1 Add `src/runner.ts` with `runBatch` (prepare folders, a worker pool of `max(1, min(4, availableParallelism()))`, unreadable items recorded as failed, before and after sizes, `UserError` messages kept, other errors given the friendly reason with the error kept for verbose, stopping new work when `signal` aborts) and `exitCodeFor` (`130`, `0`, `1`, `2`); verify `npm run check` passes
- [x] 4.2 Add `test/runner.test.ts` using the copy mode and temporary folders: one file succeeds with exit `0`; ten succeed; three of ten fail (`fail` and `crash`) and the rest still finish with exit `2`; all ten fail with exit `1`; all skipped with exit `0`; an unreadable item counted as failed without running; never more than 4 running at once with 20 slow files; sizes add up, including a bigger output (`big`); aborting the signal mid-batch stops new files, leaves no temporary files, keeps finished outputs and gives exit `130`; an unwritable output folder fails before any file runs (skipped on Windows and as root); verify it passes

## 5. Command flow

- [x] 5.1 Update `src/main.ts`: an `options` argument with `extraModes` and `signal`; `Output` gains `outIsTerminal`, `errIsTerminal` and `colours`; `--quiet` with `--verbose` rejected; runnable modes go through `runBatch` and report with its exit code; modes without `run` still say "isn't available yet." before any folder is made; verify `npm run check` passes
- [x] 5.2 Update `src/cli.ts` to pass real stream details and `NO_COLOR`, create the `AbortController` and `SIGINT` handling (first press aborts, second removes `pendingTemporaryFiles` and exits `130`), and catch unexpected errors with the friendly message, adding the stack only with `-v`/`--verbose`; verify `npm run build` succeeds and `node dist/cli.js -m heictojpg <file>` still says "isn't available yet."
- [x] 5.3 Update `test/main.test.ts` for the new `Output` fields and add copy-mode cases through `main`: one success line plus summary with exit `0`, `--quiet` printing nothing on success and only `✗` lines on failure, `--verbose` showing the stack for `crash`, `--quiet --verbose` rejected, and "heictojpg isn't available yet." still returned without creating the `-o` folder; verify it passes
- [x] 5.4 Add spawned-process tests using `run-with-copy.mjs`: output piped to a file has no escape codes and no `\r`, `NO_COLOR=1` gives no colours, a script-style run returns `0`, `2` and `1` for all-good, some-bad and all-bad folders, and Ctrl+C on a folder of slow files exits `130` with finished outputs kept and no `.konvertoj-tmp` files left (skipped on Windows); and a test that an unexpected error escaping `main` prints the friendly message without `    at ` lines, and with them under `--verbose`; verify `npm test` passes

## 6. Final checks

- [x] 6.1 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass and `README.md` is unchanged; confirm the start-up test still shows only `dist/` modules and Node.js built-ins for `--help`
- [x] 6.2 Walk through the scripted scenario by hand in a scratch folder with `run-with-copy.mjs`: a folder with good, failing and skipped files, in a terminal and piped to a file, then Ctrl+C on slow files; check the lines, summary and exit codes read clearly
- [x] 6.3 Tick "4. Batch runner and reporting" in the `Features.md` progress list; verify the line reads `- [x] 4. Batch runner and reporting`

## Workflow follow-up

- Push and confirm CI passes on Ubuntu, macOS and Windows and in the `old-node` job.
- Archive the change once CI has passed.
