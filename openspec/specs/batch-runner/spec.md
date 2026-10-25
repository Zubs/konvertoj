# batch-runner Specification

## Purpose

Defines how konvertoj runs a mode's work over every planned file: safely, a few at a time, carrying on past failures, with exit codes scripts can rely on and a clean stop on Ctrl+C.

## Requirements

### Requirement: Running every planned item
For a mode that can run, konvertoj SHALL first prepare the output folders, then process every planned item and save each result through a temporary file. A mode that combines its inputs SHALL be one item. A mode that can't run yet SHALL still fail with "<mode> isn't available yet." before any folder is created.

#### Scenario: One file
- **WHEN** a runnable mode is given one readable file
- **THEN** its output is written to the planned path, and the exit code is `0`

#### Scenario: Ten files
- **WHEN** a runnable mode is given ten readable files
- **THEN** all ten outputs are written

### Requirement: Limited parallel work
konvertoj SHALL process at most `min(4, number of CPU cores)` items at the same time, and at least one.

#### Scenario: Many cores
- **WHEN** twenty files are processed on a machine with 16 cores
- **THEN** no more than 4 are being processed at any moment

### Requirement: Failures don't stop the batch
A file that fails SHALL NOT stop the others. Its reason SHALL be kept for the report. Inputs marked unreadable during input checks SHALL count as failed, with their reason, and SHALL NOT be processed. A mode MAY report a file as skipped, with a short reason, instead of producing an output.

#### Scenario: Three of ten fail
- **WHEN** ten files are processed and three fail
- **THEN** the other seven outputs are written, and the three failures are reported with their reasons

#### Scenario: Unreadable input
- **WHEN** one of two inputs couldn't be read
- **THEN** the other is processed, and the unreadable one is reported as failed with "can't be read (permission denied)"

### Requirement: Exit codes
The exit code SHALL be:
- `0` when no file failed, including when some or all files were skipped,
- `2` when some files failed and at least one didn't,
- `1` when every file failed, or the command was invalid,
- `130` when stopped with Ctrl+C.

#### Scenario: All succeed
- **WHEN** ten files all succeed
- **THEN** the exit code is `0`

#### Scenario: Some fail
- **WHEN** three of ten files fail
- **THEN** the exit code is `2`

#### Scenario: All fail
- **WHEN** all ten files fail
- **THEN** the exit code is `1`

#### Scenario: All skipped
- **WHEN** every file is skipped and none fails
- **THEN** the exit code is `0`

#### Scenario: Scripts can rely on it
- **WHEN** a script runs konvertoj on a folder and checks `$?`
- **THEN** it can tell full success (`0`), partial failure (`2`) and complete failure (`1`) apart

### Requirement: Ctrl+C stops cleanly
On the first Ctrl+C, konvertoj SHALL start no new files and ask running files to stop. It SHALL then:
- remove every half-written temporary file,
- keep outputs that were already finished,
- print what was finished,
- exit with `130`.

On a second Ctrl+C it SHALL exit at once, still removing temporary files.

#### Scenario: Stopped mid-batch
- **WHEN** Ctrl+C is pressed while a batch of slow files is running
- **THEN** finished outputs remain, no temporary file is left in the output folder, the finished count is printed, and the exit code is `130`
