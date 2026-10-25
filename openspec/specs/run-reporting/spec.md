# run-reporting Specification

## Purpose

Defines what konvertoj shows while a batch runs and when it ends: a line per file, a progress bar in terminals, an accurate summary, quiet and verbose levels, colours only where they belong, and errors written for people.

## Requirements

### Requirement: A line per file
Each finished file SHALL get one line:
- a success goes to standard output: `✓ <input> → <output>  <size before> → <size after>`,
- a skip goes to standard output: `- <input> skipped: <reason>`,
- a failure goes to standard error: `✗ <input>: <reason>`.

Paths SHALL be relative to the current folder. A combined item SHALL name its first input and how many others there are.

#### Scenario: One success
- **WHEN** one file is converted
- **THEN** standard output has one `✓` line naming the input, the output and both sizes, followed by the summary

#### Scenario: A failure
- **WHEN** a file fails because the mode reported a problem
- **THEN** standard error has a `✗` line with the file and the mode's plain-English reason

### Requirement: Progress bar in terminals
When standard error is a terminal and `--quiet` isn't given, a single line SHALL show `Converting <done>/<total>…`, redrawn in place with `\r` as files finish. File lines SHALL be printed above it without breaking it. A mode MAY report a single file's progress, which SHALL add a percentage and, once it can be estimated, the time left. The line SHALL be cleared before the summary.

#### Scenario: Terminal
- **WHEN** 120 files are processed with standard error attached to a terminal
- **THEN** a line like `Converting 37/120…` is redrawn in place, and it's gone when the summary prints

#### Scenario: Long single job
- **WHEN** a mode reports a file as 45% done after 30 seconds
- **THEN** the progress line shows `45%` and about 37 seconds left

### Requirement: Summary
After the batch, a summary SHALL show:
- how long it took,
- the counts of converted, failed and skipped files,
- for converted files, the total size before → after and the change in percent,
- every failure with its reason.

Sizes SHALL use B, KB, MB and GB, with 1 KB = 1024 bytes. A smaller result SHALL show a minus sign (`−74%`), and a bigger one a plus sign (`+12%`).

#### Scenario: Ten succeed
- **WHEN** ten files all succeed
- **THEN** the summary says 10 converted, 0 failed, 0 skipped

#### Scenario: Sizes add up
- **WHEN** two files of 1000 and 3000 bytes become outputs of 500 and 4000 bytes
- **THEN** the summary shows 3.9 KB → 4.4 KB and `+13%`, matching the per-file lines

#### Scenario: Failures repeated in the summary
- **WHEN** three of ten files fail
- **THEN** the summary lists those three files with their reasons

### Requirement: Quiet and verbose
With `-q/--quiet`, only failure lines and errors SHALL be shown: no success or skip lines, no progress bar and no summary. With `-v/--verbose`, each file's start and the mode's extra details SHALL be shown, and each failure SHALL include its full technical details. Giving both SHALL fail with exit code `1`: "Use either --quiet or --verbose, not both."

#### Scenario: Quiet success
- **WHEN** a batch succeeds with `--quiet`
- **THEN** nothing is printed and the exit code is `0`

#### Scenario: Quiet failure
- **WHEN** a batch has failures with `--quiet`
- **THEN** only the `✗` lines are printed

#### Scenario: Verbose failure
- **WHEN** a file fails with an unexpected error under `--verbose`
- **THEN** the failure shows the technical error and its stack trace

### Requirement: Colours only where they belong
Colours SHALL be used only on a stream that is a terminal, and never when the `NO_COLOR` environment variable is set to a non-empty value. Output written to a file or pipe SHALL contain no colour codes and no progress bar.

#### Scenario: Piped output
- **WHEN** konvertoj's output is redirected to a file
- **THEN** the file has the same lines with no escape codes and no `\r` progress line

#### Scenario: NO_COLOR
- **WHEN** `NO_COLOR=1` is set in a terminal
- **THEN** no colour codes are written

### Requirement: Friendly errors from modes
When a mode reports an expected problem for a file, its message SHALL be shown as the reason. When a mode fails unexpectedly, the reason SHALL be "couldn't be converted because of an unexpected problem. Run again with --verbose for details." The technical error SHALL appear only with `--verbose`.

#### Scenario: Unexpected error
- **WHEN** a mode throws an unexpected error for one file
- **THEN** that file's line shows the friendly reason with no stack trace, the other files carry on, and `--verbose` adds the technical error
