# Spec Delta

## MODIFIED Requirements

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
