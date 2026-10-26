# format-detection Specification

## Purpose
Defines how konvertoj works out each input's real format from its contents, which inputs a mode accepts, and the helpful messages shown when a file is empty, unknown, damaged or meant for a different mode.

## Requirements

### Requirement: Format from contents
konvertoj SHALL identify each input's format from the file's contents, not its name. It SHALL recognise JPG, PNG (including animated PNG), WebP, AVIF, GIF, TIFF, BMP, ICO, HEIC, PDF, MOV, MKV, AVI, WebM, M4V and MP4. A file's extension SHALL NOT change the detected format of a file whose contents are recognised.

#### Scenario: Real HEIC
- **WHEN** a real HEIC photo named `photo.heic` is checked
- **THEN** it is detected as HEIC

#### Scenario: Renamed PNG
- **WHEN** a PNG file named `holiday.heic` is checked
- **THEN** it is detected as PNG

#### Scenario: Animated PNG
- **WHEN** an animated PNG is checked
- **THEN** it is detected as PNG

#### Scenario: Every recognised format
- **WHEN** a file of each recognised format is checked, each saved with a `.bin` extension
- **THEN** each is detected as its own format

### Requirement: SVG from text
A file whose contents aren't recognised as a binary format SHALL be detected as SVG when its text starts with an `<svg` element, optionally after a byte-order mark, whitespace, an XML declaration, comments or a doctype. Otherwise, a file with a `.svg` extension SHALL be treated as SVG, as a fallback.

#### Scenario: SVG with no extension
- **WHEN** a file named `logo` contains `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>`
- **THEN** it is detected as SVG

#### Scenario: Extension fallback
- **WHEN** a file named `logo.svg` contains text that isn't SVG markup
- **THEN** it is treated as SVG

### Requirement: Extension aliases
Where a format is matched by extension, `.jpg`, `.jpeg`, `.jfif` and `.jpe` SHALL all mean JPG, `.tif` and `.tiff` SHALL mean TIFF, and `.heic` and `.heif` SHALL mean HEIC, in any letter case.

#### Scenario: JPG spellings
- **WHEN** JPG files named `a.jpeg`, `b.jfif` and `c.JPG` are given to `jpgtopng`
- **THEN** all three are accepted

### Requirement: Empty files
A 0-byte input SHALL fail with "is empty", and the message SHALL suggest checking the file was saved or downloaded completely.

#### Scenario: Empty file
- **WHEN** a 0-byte `photo.heic` is given to `heictojpg`
- **THEN** that file fails with a reason containing "is empty"

### Requirement: Unknown files
An input whose format can't be identified SHALL fail with "isn't a file konvertoj can convert", pointing to `--list-modes`.

#### Scenario: Text renamed to JPG
- **WHEN** a plain text file named `notes.jpg` is given to `tojpg`
- **THEN** that file fails with a reason containing "isn't a file konvertoj can convert"

### Requirement: Wrong format for the mode
When a mode with a fixed output format doesn't accept an input's detected format, but another mode accepts that format and makes the same output format, the file SHALL fail with "looks like a <format>. Try: -m <mode>", naming the `<from>to<to>` mode where one exists, or otherwise the `to<format>` mode.

#### Scenario: PNG given to heictojpg
- **WHEN** a PNG named `holiday.heic` is given to `heictojpg`
- **THEN** it fails with "looks like a PNG. Try: -m pngtojpg"

#### Scenario: The same file with tojpg
- **WHEN** the same file is given to `tojpg`
- **THEN** it passes the input check and its work starts with its format known to be PNG

### Requirement: Wrong kind of file
When a mode doesn't accept an input's detected format and the rule above gives no suggestion (including tools that keep the input's format), the file SHALL fail, saying what the file is, that the mode can't use it, which formats the mode accepts, and naming up to six modes that do accept the file, pointing to `--list-modes` when there are more.

#### Scenario: MP4 given to topdf
- **WHEN** an MP4 video named `clip.mp4` is given to `topdf`
- **THEN** it fails, saying it's an MP4 that `topdf` can't use and naming `mp4tomp3`

#### Scenario: BMP given to compress
- **WHEN** a BMP is given to `compress`
- **THEN** it fails, listing JPG, PNG, WebP, AVIF and GIF as the formats `compress` works with

### Requirement: Mixed batches with any-format modes
A `to<format>` mode SHALL accept every input format it lists and hand each file's detected format to its work, so one batch can mix formats.

#### Scenario: Mixed folder
- **WHEN** a folder holding a HEIC, a PNG and a WebP is given to `tojpg`
- **THEN** all three pass the input check, each with its own detected format

### Requirement: Already in the target format
In a `to<format>` mode, an input already in the target format SHALL be skipped with "already a <format>", unless one of the mode's own options or `--strip-metadata` is given, in which case it SHALL be processed. Other common options SHALL NOT count.

#### Scenario: JPG with tojpg
- **WHEN** a JPG is given to `tojpg` with no options
- **THEN** it is skipped with "already a JPG" and counted as skipped, and the exit code is `0`

#### Scenario: JPG with tojpg and a quality
- **WHEN** the same JPG is given to `tojpg --quality 60`
- **THEN** it passes the input check and its work starts

#### Scenario: JPG with tojpg and --overwrite
- **WHEN** the same JPG is given to `tojpg --overwrite`
- **THEN** it is still skipped with "already a JPG"

### Requirement: Format names in messages
Messages SHALL name formats by their short name (HEIC, ICO, PNG, MP4), with "a" or "an" as spoken.

#### Scenario: HEIC and ICO wording
- **WHEN** a HEIC and an ICO are each given to `pngtojpg`
- **THEN** the messages say "looks like a HEIC" and "looks like an ICO", without the bracketed descriptions

### Requirement: Combined inputs are all checked
For a mode that combines its inputs into one output, every input SHALL be checked. One failing input SHALL fail the whole output, and the reason SHALL name that file. Inputs of several formats given to a single-format combining mode SHALL suggest the mode that accepts any format, but only when that mode accepts every one of them.

#### Scenario: Mixed images for jpgtopdf
- **WHEN** a JPG and a PNG are given together to `jpgtopdf`
- **THEN** the PDF fails, naming the PNG and suggesting `-m topdf`

#### Scenario: Video among images for jpgtopdf
- **WHEN** a JPG and an MP4 are given together to `jpgtopdf`
- **THEN** the PDF fails, naming the MP4, without suggesting `topdf`

#### Scenario: Empty image in a PDF
- **WHEN** three JPGs, one of them empty, are given to `jpgtopdf`
- **THEN** the PDF fails and the reason names the empty file

### Requirement: Damaged files
A file whose format is recognised but whose contents can't be read SHALL fail with "looks damaged" and a suggestion to get a fresh copy, never a crash or a stack trace.

#### Scenario: Unreadable contents
- **WHEN** reading a file's format fails part-way because its contents are malformed
- **THEN** that file fails with a reason containing "looks damaged"

### Requirement: Messy folders
Problems with some inputs SHALL NOT stop the others: in a folder of mixed files, every convertible file SHALL be processed and every other file SHALL be listed with its reason.

#### Scenario: Downloads folder
- **WHEN** `tojpg` is given a folder holding a PNG, a JPG, a text file and an MP4
- **THEN** the PNG is processed, the JPG is skipped as "already a JPG", and the text file and the MP4 are reported as failed with their reasons
