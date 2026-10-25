# Proposal

## Why

konvertoj can read a command, but it doesn't yet know which files the user means or where results should go. Every mode needs the same answers: which input files a mix of files, folders and patterns adds up to, and which safe, predictable output path each one gets. The answer must never overwrite an original or lose a file from an earlier run. Building this once, before any conversion, lets every later mode inherit it.

## What Changes

- **Inputs:** one or more files, folders or patterns.
  - Patterns are expanded with `fast-glob`, so quoted patterns like `"photos/*.heic"` work the same on Windows.
  - Folders give their top-level files, or every subfolder's files with `-r/--recursive`.
  - Hidden files and folders inside folders and patterns are skipped. A hidden file named directly is used.
  - Each folder's or pattern's matches are sorted in natural order (`page2` before `page10`), while files typed directly keep their typed order. Duplicates are removed.
- **Input errors:**
  - no inputs: "No input files given",
  - an empty folder or a pattern with no matches: "No matching files found",
  - a named file or folder that doesn't exist: fails, naming it.

  All of these stop the command with exit code `1` before any work.
- **Unreadable files:** a file that exists but can't be read doesn't stop the command. It's kept in the plan and marked as unreadable, so feature 4 can report it as a failed file while the rest continue.
- **Output naming:**
  - `-o newimage` adds the mode's extension, giving `newimage.jpg`.
  - `-o newimage.jpg` (or `.jpeg`) is used as given.
  - `-o newimage.png` with a JPG mode warns, then uses `newimage.jpg`.
  - With no `-o`, a conversion keeps the input's name and folder with the new extension.
  - With no `-o`, a tool that keeps the format adds a suffix, e.g. `hero-compressed.jpg`.
  - With several inputs, a folder or a pattern, `-o` is a folder, created when the work starts. It keeps the subfolder structure for recursive folders and patterns.
- **Combined output:** images-to-PDF modes (`jpgtopdf`, `topdf`, ...) combine all inputs into one output. `-o` names that file, and without `-o` it's named after the first input. PDF-to-images page naming waits for feature 13.
- **No overwriting:**
  - An existing output gets a number: `photo (1).jpg`, then `photo (2).jpg`.
  - `--overwrite` turns this off, but an input file is never replaced by an output, even with `--overwrite`.
  - Two inputs that would produce the same name in one run are numbered too.
- **Safe writing:** a helper writes each result to a temporary file in the output folder, then renames it into place. A failure leaves no partial file. Output folders are created and checked for write access before any work, so an unwritable folder fails up front. Feature 4 connects these helpers to the batch runner.
- **`--dry-run`:** prints each planned `input → output` pair, warnings and unreadable files, writes nothing (not even folders), and exits with `0`.
- Running a mode that isn't built yet still ends with "<mode> isn't available yet.", but only after its inputs have been checked.
- The mode registry gains each tool's output suffix, and marks which modes combine their inputs.
- Add `fast-glob` as the first runtime dependency (approved), loaded only when a command has inputs, so `--help` stays instant.
- Tick "3. Inputs and output naming" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `input-files`: How the files, folders and patterns a user types become an ordered list of input files, and the errors when they don't.
- `output-naming`: How each input's output path is chosen, numbered and protected from overwriting, and what `--dry-run` shows.
- `output-writing`: How results are written safely: output folders prepared and checked before work, and temporary files renamed into place only when complete.

### Modified Capabilities

- `command-line`:
  - "Option values are checked": valid values now lead on to the input checks, not straight to "isn't available yet".
  - "Modes not built yet": the message appears only after the inputs have been found.
- `mode-registry`: adds a requirement that every tool which keeps the format names its output suffix, and that images-to-PDF modes are marked as combining their inputs.

## Impact

- New source:
  - `src/inputs.ts`: resolving inputs, using `fast-glob` and natural sorting.
  - `src/outputs.ts`: planning output paths, numbering and protecting inputs.
  - `src/output-files.ts`: preparing folders and writing through temporary files.
- Changed source:
  - `src/main.ts`, which becomes async: inputs, planning, `--dry-run`, then "isn't available yet".
  - `src/cli.ts`, which awaits `main`.
  - `src/modes/registry.ts` (suffixes, combining modes) and `src/modes/formats.ts` (extension aliases such as `jpeg` and `tif`).
- Tests: new tests for inputs, naming, writing and dry runs. `test/main.test.ts` changes because its sample files must now exist.
- New runtime dependency: `fast-glob`.
