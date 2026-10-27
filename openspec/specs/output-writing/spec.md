# output-writing Specification

## Purpose

Defines how konvertoj writes results to disk, so a failure or interruption never leaves a half-written file, an unwritable folder is caught before any work, and originals are never touched.

## Requirements

### Requirement: Output folders prepared first
Before any input is processed, every folder that planned outputs go into SHALL be created if missing and checked by writing a test file. A folder that can't be created or written to SHALL stop the command with exit code `1`, naming the folder and saying to choose another with `-o`. No input SHALL be processed in that case.

#### Scenario: New output folder
- **WHEN** outputs are planned in `converted/`, which doesn't exist
- **THEN** `converted/` is created before the first input is processed

#### Scenario: Unwritable folder
- **WHEN** outputs are planned in a folder without write permission
- **THEN** the command fails before processing any input, naming that folder

### Requirement: Results written through a temporary file
Each result SHALL be written to a hidden temporary file in its output folder, and renamed to its final name only when it's complete. If writing fails, the temporary file SHALL be removed, and no file SHALL appear at the final name.

#### Scenario: Successful write
- **WHEN** a result is written to `out/photo.jpg`
- **THEN** `out/photo.jpg` holds the complete result and no temporary file is left in `out/`

#### Scenario: Failed write
- **WHEN** writing a result fails part-way
- **THEN** neither `out/photo.jpg` nor any temporary file is left behind, and the error is reported

### Requirement: Last check before replacing
Without `--overwrite`, if a file has appeared at the final name since planning, the result SHALL take the next free number instead of replacing it.

#### Scenario: File appeared meanwhile
- **WHEN** `photo.jpg` is created by something else after planning but before the result is renamed into place
- **THEN** the result is saved as `photo (1).jpg`, and the other file is left alone

### Requirement: Inputs are only read
konvertoj SHALL never modify, move or delete an input file.

#### Scenario: Original untouched
- **WHEN** any command runs on `photo.jpg`, with or without `--overwrite`
- **THEN** `photo.jpg` has the same contents and modification time afterwards

### Requirement: Empty output folders are removed
An output folder that konvertoj created for a run, including any parent folders it created for it, SHALL be removed at the end of the run if nothing was saved in it, also when the run stops because of an error or the first Ctrl+C. A folder that already existed SHALL never be removed. A second Ctrl+C, which stops konvertoj at once, MAY leave such empty folders.

#### Scenario: Every file fails
- **WHEN** `pdftopng locked.pdf -o pages` fails and `pages/` didn't exist before
- **THEN** `pages/` doesn't exist afterwards

#### Scenario: Existing folder
- **WHEN** the same command fails with `-o pages` and `pages/` already existed, empty
- **THEN** `pages/` is still there

#### Scenario: Nested new folders
- **WHEN** a run with `-o out/pages`, where neither exists, saves nothing
- **THEN** neither `out/pages` nor `out` exists afterwards

#### Scenario: Something was saved
- **WHEN** at least one file is saved in a new output folder
- **THEN** the folder stays
