# image-compression Specification

## Purpose
Defines how konvertoj makes images smaller with the `compress` tool: by quality, by level or to a target size, how each format is compressed, and when a file is left alone because it can't get smaller.

## Requirements

### Requirement: Compress keeps the format
`compress` SHALL accept JPG, PNG, WebP, AVIF and GIF, keep each file's format and dimensions, and save `<name>-compressed.<ext>`. Other formats SHALL fail with a message listing the supported ones.

#### Scenario: One large JPG
- **WHEN** a large, detailed JPG saved at quality 95 is compressed
- **THEN** `<name>-compressed.jpg` is smaller, has the same dimensions, and its line shows the sizes before and after with the change in percent

#### Scenario: Unsupported format
- **WHEN** a BMP or an ICO is given to `compress`
- **THEN** it fails, saying `compress` works with JPG, PNG, WebP, AVIF and GIF

### Requirement: Quality and level
`--quality 1–100` SHALL set the quality directly. `--level low`, `medium` and `high` SHALL mean quality 85, 70 and 50. With none of `--quality`, `--level` and `--target-size`, `medium` SHALL be used. JPG, WebP and AVIF SHALL be re-encoded at that quality, PNG SHALL be palette-quantised at that quality, and an animated GIF SHALL let neighbouring frames share more as quality goes down.

#### Scenario: Default level
- **WHEN** `compress` is run with no options
- **THEN** the result is the same as with `--level medium`

#### Scenario: Higher level is smaller
- **WHEN** the same image is compressed with `--level high` and with `--level low`
- **THEN** the `high` file is smaller

#### Scenario: Mixed folder
- **WHEN** a folder of JPG, PNG and WebP files is compressed
- **THEN** each file is compressed, and the summary's total before and after equals the sum of the per-file sizes

#### Scenario: Animated GIF levels
- **WHEN** the same animated GIF is compressed with `--level high` and with `--level low`
- **THEN** both stay animated, and the `high` file is smaller

#### Scenario: Transparent PNG
- **WHEN** a transparent PNG is compressed
- **THEN** the output is still transparent

### Requirement: Target size
`--target-size` SHALL accept a positive size in `kb` or `mb` (1 KB = 1024 bytes), in any letter case. konvertoj SHALL try qualities with a binary search, at most 8 attempts, and keep the highest quality the search found whose result is at or under the target. When no attempt reaches the target, the smallest result SHALL be kept, with a note saying the target couldn't be reached.

#### Scenario: Reaching the target
- **WHEN** a large JPG photo is compressed with `--target-size 200kb`
- **THEN** the output is at most 200 KB, and compressing at the next quality up would have been over 200 KB

#### Scenario: Units in any case
- **WHEN** `--target-size` is given as `200kb`, `200KB`, `1mb` or `1.5Mb`
- **THEN** each is accepted

#### Scenario: Invalid sizes
- **WHEN** `--target-size` is given as `0kb`, `-5kb` or `200`
- **THEN** each fails with exit code `1` before any file is touched, giving an example such as `200kb`

#### Scenario: Unreachable target
- **WHEN** a large, detailed photo is compressed with `--target-size 1kb`
- **THEN** the smallest result is kept, and a note says 1 KB couldn't be reached

### Requirement: Already optimised
When the compressed result isn't smaller than the original, no file SHALL be written, and the file SHALL be reported as skipped with "already optimised".

#### Scenario: Can't get smaller
- **WHEN** a tiny, already-compressed image is compressed
- **THEN** no output is written, the file is listed as skipped with "already optimised", and the summary counts it as skipped

### Requirement: Conflicting compress options
`--quality`, `--level` and `--target-size` SHALL be used one at a time. Giving more than one SHALL fail with exit code `1` before any file is read.

#### Scenario: Quality with level
- **WHEN** `compress --quality 60 --level high` or `compress --quality 60 --target-size 200kb` is run
- **THEN** it fails, saying to use only one of `--quality`, `--level` and `--target-size`

### Requirement: Website images
A whole folder SHALL compress in one command, with the total saved shown.

#### Scenario: Before committing
- **WHEN** a developer runs `compress ./images -o ./images-small` on a folder of large JPGs and PNGs
- **THEN** every image is written smaller, and the summary shows the total before and after with the percentage saved
