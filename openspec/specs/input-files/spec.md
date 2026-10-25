# input-files Specification

## Purpose

Defines how the files, folders and patterns a user types after the mode become one ordered list of input files, the same way on Windows, macOS and Linux, and how konvertoj explains inputs it can't use.

## Requirements

### Requirement: Input kinds
Each input SHALL be read as:
- an existing file, which is used as given, even when its name starts with a dot,
- an existing folder, which gives the files inside it,
- otherwise, when it contains `*`, `?`, `[` or `{`, a pattern, which gives the files it matches.

Patterns SHALL be expanded by konvertoj itself, so a quoted pattern behaves the same on every system.

#### Scenario: A single file
- **WHEN** a user runs `konvertoj -m heictojpg holiday.heic --dry-run` and `holiday.heic` exists
- **THEN** the plan has exactly one input, `holiday.heic`

#### Scenario: Quoted pattern
- **WHEN** a user runs `konvertoj -m heictojpg "photos/*.heic" --dry-run` on any system, with `a.heic` and `b.heic` in `photos`
- **THEN** both files are inputs

#### Scenario: Windows-style separators in a pattern
- **WHEN** a user on Windows runs `konvertoj -m heictojpg "photos\*.heic" --dry-run`
- **THEN** it matches the same files as `"photos/*.heic"`

### Requirement: Folder depth
A folder SHALL give only its top-level files, unless `-r/--recursive` is given, in which case it SHALL give the files in every subfolder too.

#### Scenario: Top level only
- **WHEN** a folder holds `a.png` and `sub/b.png` and is given without `--recursive`
- **THEN** only `a.png` is an input

#### Scenario: Recursive
- **WHEN** the same folder is given with `--recursive`
- **THEN** both `a.png` and `sub/b.png` are inputs

### Requirement: Hidden files skipped
Files and folders whose names start with `.` SHALL be skipped when they're found inside a folder or by a pattern.

#### Scenario: .DS_Store skipped
- **WHEN** a folder holds `photo.jpg`, `.DS_Store` and `.cache/old.jpg`, and is given with `--recursive`
- **THEN** only `photo.jpg` is an input

### Requirement: Input order and duplicates
Files typed directly SHALL keep their typed order. The files from each folder or pattern SHALL be sorted in natural order (numbers compared by value, letter case ignored) at that folder's or pattern's place in the list. A file reached more than once SHALL be kept only at its first place.

#### Scenario: Natural order
- **WHEN** a folder holds `page10.png`, `page2.png` and `page1.png`
- **THEN** the inputs are `page1.png`, `page2.png`, `page10.png` in that order

#### Scenario: Typed order kept
- **WHEN** a user gives `b.jpg a.jpg`
- **THEN** the inputs are `b.jpg` then `a.jpg`

#### Scenario: Duplicates removed
- **WHEN** a user gives `photo.jpg photo.jpg ./photo.jpg`, or a file and a folder that contains it
- **THEN** that file is an input only once

### Requirement: Missing inputs stop the command
The command SHALL fail with exit code `1`, before any work, when:
- no inputs are given: "No input files given.", with the command shape,
- a named file or folder doesn't exist: naming it,
- a folder has no files, or a pattern matches nothing: "No matching files found", naming the folder or pattern.

When several inputs are wrong, every one SHALL be named.

#### Scenario: No inputs
- **WHEN** a user runs `konvertoj -m heictojpg`
- **THEN** it fails with exit code `1` and "No input files given."

#### Scenario: Missing file
- **WHEN** a user runs `konvertoj -m heictojpg holday.heic` and that file doesn't exist
- **THEN** it fails with exit code `1`, and the message names `holday.heic` and says it can't be found

#### Scenario: Nothing matched
- **WHEN** a user gives an empty folder, or the pattern `"*.heic"` in a folder with no HEIC files
- **THEN** it fails with exit code `1` and "No matching files found", naming the folder or pattern

### Requirement: Unreadable files continue
A file that exists but can't be read SHALL NOT stop the command. It SHALL stay in the input list marked as unreadable, with a plain-English reason, and get no output. A subfolder that can't be opened during a recursive search SHALL be skipped with a warning naming it.

#### Scenario: Unreadable file in a batch
- **WHEN** a user gives `a.jpg` and `secret.jpg`, and `secret.jpg` has no read permission
- **THEN** the command continues, `a.jpg` gets an output, and `secret.jpg` is listed as "can't be read (permission denied)"

### Requirement: Any file name
Inputs SHALL work with names containing spaces, accented letters, emoji and long names, on Windows, macOS and Linux.

#### Scenario: Unusual names
- **WHEN** files named `my photo.jpg`, `café.jpg`, `🌴 beach.jpg` and a 200-character name are given
- **THEN** each is found and appears in the plan with its name unchanged
