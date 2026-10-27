# output-naming Specification

## Purpose

Defines how konvertoj chooses the output path for each input, so names are predictable, the right extension is always used, nothing is overwritten unless asked, and an original is never replaced.

## Requirements

### Requirement: Output extension
An output SHALL end with the extension of the mode's output format (`.jpg`, `.tiff`, `.pdf`, `.mp4`, ...). For a tool that keeps the format, it SHALL keep the input's own extension as written. When `-o` ends with an extension the output format accepts (`.jpg`, `.jpeg`, `.jfif` or `.jpe` for JPG, `.tif` or `.tiff` for TIFF, any letter case), the name SHALL be used as given.

#### Scenario: Extension added
- **WHEN** a user runs `konvertoj -m heictojpg holiday.heic -o newimage`
- **THEN** the output is `newimage.jpg`

#### Scenario: Extension kept
- **WHEN** `-o newimage.jpg` or `-o newimage.JPEG` is given with `heictojpg`
- **THEN** the output is `newimage.jpg` or `newimage.JPEG`, never `newimage.jpg.jpg`

#### Scenario: Unknown extension kept as part of the name
- **WHEN** `-o holiday.2024` is given with `heictojpg`
- **THEN** the output is `holiday.2024.jpg`

### Requirement: Mode wins over a different extension
When `-o` ends with the extension of a different known format, konvertoj SHALL warn and use the mode's extension instead.

#### Scenario: Wrong extension
- **WHEN** a user runs `konvertoj -m heictojpg holiday.heic -o newimage.png`
- **THEN** a warning says the output will be a JPG named `newimage.jpg`, and the output is `newimage.jpg`

### Requirement: Default names
Without `-o`:
- a conversion's output SHALL be the input's name with the new extension, in the input's folder,
- a tool that keeps the format SHALL add its suffix to the input's name: `-compressed`, `-resized`, `-enlarged`, `-cropped`, `-rotated`, `-flipped` or `-stripped`,
- a mode that writes no file (`info`, `colorpick`) SHALL plan no output.

#### Scenario: Conversion without -o
- **WHEN** a user runs `konvertoj -m heictojpg photos/holiday.heic`
- **THEN** the output is `photos/holiday.jpg`

#### Scenario: Tool without -o
- **WHEN** a user runs `konvertoj -m compress hero.jpg`
- **THEN** the output is `hero-compressed.jpg`

### Requirement: Output folder for batches
When there's more than one input, any folder or pattern input, when the mode writes several files per input, or when `-o` names an existing folder or ends with `/` or `\`, `-o` SHALL be a folder. Each output SHALL use its default file name inside it. Files from a folder or pattern SHALL keep their path below that folder or below the pattern's fixed leading part. The folder SHALL be created only when work starts. If `-o` names an existing file when a folder is needed, the command SHALL fail with exit code `1`.

#### Scenario: Several files into a new folder
- **WHEN** a user runs `konvertoj -m heictojpg a.heic b.heic c.heic -o converted`
- **THEN** the outputs are `converted/a.jpg`, `converted/b.jpg` and `converted/c.jpg`

#### Scenario: Recursive folder keeps its structure
- **WHEN** a user runs `konvertoj -m pngtojpg shots -r -o out`, and `shots` holds `a.png` and `2024/b.png`
- **THEN** the outputs are `out/a.jpg` and `out/2024/b.jpg`

#### Scenario: Single file into an existing folder
- **WHEN** `-o jpgs` is given with one input file, and `jpgs` is an existing folder
- **THEN** the output is `jpgs/<input name>.jpg`

#### Scenario: Several files from one input
- **WHEN** a user runs `konvertoj -m pdftopng report.pdf -o pages`
- **THEN** the page images are written inside the `pages` folder

#### Scenario: Folder needed but -o is a file
- **WHEN** a user runs `konvertoj -m heictojpg a.heic b.heic -o notes.txt`, and `notes.txt` is an existing file
- **THEN** it fails with exit code `1`, saying `-o` must be a folder when there are several inputs or pages

### Requirement: Combined output
For a mode that combines its inputs (images to PDF), all inputs SHALL produce one output in input order. `-o` SHALL name that file, following the extension rules. Without `-o`, the output SHALL be named after the first input, in its folder. If `-o` names an existing folder, the file SHALL go inside it, named after the first input.

#### Scenario: Several images, one PDF
- **WHEN** a user runs `konvertoj -m jpgtopdf scans -o receipts`, and `scans` holds three JPGs
- **THEN** there's one output, `receipts.pdf`, and the inputs are in natural order

#### Scenario: Named after the first input
- **WHEN** a user runs `konvertoj -m topdf page1.png page2.png` with no `-o`
- **THEN** the single output is `page1.pdf`

### Requirement: Never overwrite
When an output path already exists, or another output in the same run already took it (letter case ignored), the output SHALL be numbered: `photo (1).jpg`, then `photo (2).jpg` and so on, using the first free number. `--overwrite` SHALL turn off numbering for existing files, but never for clashes inside the run.

#### Scenario: Existing file numbered
- **WHEN** `photo.jpg` already exists and `photo.heic` is converted with `heictojpg`
- **THEN** the output is `photo (1).jpg`, and with `photo (1).jpg` existing too, it's `photo (2).jpg`

#### Scenario: Overwrite
- **WHEN** `photo.jpg` already exists and the same command is run with `--overwrite`
- **THEN** the output is `photo.jpg`

#### Scenario: Clash inside the run
- **WHEN** a user runs `konvertoj -m towebp photo.png photo.jpg`
- **THEN** the outputs are `photo.webp` and `photo (1).webp`, with or without `--overwrite`

### Requirement: Inputs are never outputs
An output path SHALL never be the same file as any input in the run, letter case ignored, even with `--overwrite`. Such an output SHALL be numbered instead.

#### Scenario: Output would replace its input
- **WHEN** a user runs `konvertoj -m compress hero.jpg -o hero.jpg --overwrite`
- **THEN** the output is `hero (1).jpg`, and `hero.jpg` is left alone

### Requirement: Dry run
With `--dry-run`, konvertoj SHALL print one line per input, `<input> → <output>`, with paths relative to the current folder. Unreadable inputs SHALL be listed with their reason, and warnings shown. It SHALL create no files or folders, and exit with `0`.

#### Scenario: Planned pairs
- **WHEN** a user runs `konvertoj -m heictojpg a.heic b.heic -o converted --dry-run`
- **THEN** it prints `a.heic → converted/a.jpg` and `b.heic → converted/b.jpg` (with the system's path separator), creates no `converted` folder, and exits with `0`

#### Scenario: Unreadable input in a dry run
- **WHEN** one input can't be read
- **THEN** its line says it can't be read and why, instead of naming an output
