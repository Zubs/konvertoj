# mode-registry Specification

## Purpose

Defines the complete set of modes konvertoj offers and what every mode must declare, so help screens, `--list-modes`, input checks and the README all describe the same modes from one source.

## Requirements

### Requirement: Mode groups
Every mode SHALL belong to exactly one group: Image, PDF, GIF, Video & Audio or Tools, shown in that order.

#### Scenario: Every mode has a known group
- **WHEN** the registry is inspected
- **THEN** every mode's group is one of Image, PDF, GIF, Video & Audio or Tools

### Requirement: Mode names
Each mode SHALL have exactly one spelling, made of lowercase letters and digits only. Format names in mode names SHALL use `jpg` (never `jpeg`) and `tiff` (never `tif`). No two modes SHALL share a name.

#### Scenario: Names are unique and canonical
- **WHEN** the registry is inspected
- **THEN** every name matches `^[a-z0-9]+$`, no name appears twice, and no name contains `jpeg`, or `tif` without a following `f`

### Requirement: Image conversion modes
The Image group SHALL contain a `<from>to<to>` mode for every pair of different formats, where `<from>` is one of jpg, png, webp, avif, gif, tiff, bmp, ico, heic or svg and `<to>` is one of jpg, png, webp, avif, gif, tiff, bmp or ico. It SHALL also contain `to<format>` modes for jpg, png, webp, avif, tiff, bmp and ico, which accept any image input.

#### Scenario: Conversion pairs exist
- **WHEN** the registry is inspected
- **THEN** `heictojpg`, `pngtowebp`, `svgtoico` and `tojpg` exist in the Image group, and `jpgtojpg`, `pngtoheic`, `tosvg` and `toheic` don't exist

#### Scenario: Image conversion count
- **WHEN** the Image group is counted
- **THEN** it holds 72 `<from>to<to>` modes and 7 `to<format>` modes

### Requirement: PDF modes
The PDF group SHALL contain `<image>topdf` for each of the 10 image input formats, `topdf` (any image), and `pdfto<image>` for each of the 8 image output formats.

#### Scenario: PDF modes exist
- **WHEN** the registry is inspected
- **THEN** `jpgtopdf`, `heictopdf`, `topdf`, `pdftopng` and `pdftojpg` exist in the PDF group, 19 modes in total

### Requirement: GIF mode
The GIF group SHALL contain `togif`, which accepts any image input or any video input.

#### Scenario: togif exists
- **WHEN** the registry is inspected
- **THEN** `togif` is the only mode in the GIF group and accepts both image and video formats

### Requirement: Video and audio modes
The Video & Audio group SHALL contain:
- `<video>tomp4` for mov, mkv, avi, webm and m4v, plus `tomp4`,
- `<video>to<audio>` for every video input (mov, mkv, avi, webm, m4v, mp4) and audio output (mp3, wav, m4a, ogg, flac),
- `to<audio>` for each audio output.

#### Scenario: Video and audio modes exist
- **WHEN** the registry is inspected
- **THEN** `movtomp4`, `tomp4`, `mp4tomp3`, `movtowav` and `toflac` exist, `mp4tomp4` doesn't, and the group holds 41 modes

### Requirement: Tool modes
The Tools group SHALL contain `compress`, `resize`, `enlarge`, `crop`, `rotate`, `flip`, `strip`, `info` and `colorpick`.

#### Scenario: Tools exist
- **WHEN** the registry is inspected
- **THEN** the Tools group holds exactly those 9 modes

### Requirement: Every mode is documented
Every mode SHALL have:
- a one-line description,
- at least one example command that starts with `konvertoj -m <its name>`,
- its accepted input formats,
- its output format, or a note that it writes no file.

#### Scenario: Registry completeness
- **WHEN** every mode in the registry is checked
- **THEN** each has a non-empty description, at least one example starting with `konvertoj -m <name>`, at least one input format and an output description

### Requirement: Common options
Every mode SHALL accept the common options `-o/--output`, `--overwrite`, `--strip-metadata`, `-r/--recursive`, `--dry-run`, `-q/--quiet` and `-v/--verbose`.

#### Scenario: Common options on any mode
- **WHEN** the options of `heictojpg`, `rotate` and `movtomp4` are inspected
- **THEN** each includes all seven common options

### Requirement: Mode options
Each mode SHALL declare the options its feature in Features.md describes, each with a short explanation and its default where there is one. An option name SHALL mean the same kind of value (a flag, or a value) in every mode that uses it.

#### Scenario: Options follow the mode
- **WHEN** the options of `rotate`, `heictojpg`, `pngtoico` and `compress` are inspected
- **THEN** `rotate` has `--angle`, `--auto` and `--background`; `heictojpg` has `--quality` (default 80) but not `--angle`; `pngtoico` has `--sizes` (default `16,32,48`); and `compress` has `--level` (default `medium`)

#### Scenario: Option kinds are consistent
- **WHEN** all modes' options are compared by name
- **THEN** no option is a flag in one mode and takes a value in another

### Requirement: Option value rules
A value option whose valid values are a fixed list of words, a number range or a colour SHALL declare that list, range or colour rule for its mode. A range SHALL state whether only whole numbers are allowed. Every declared default SHALL satisfy its own rule.

#### Scenario: Declared rules
- **WHEN** the registry is inspected
- **THEN**:
  - `--fit` allows `contain`, `cover`, `fill`, `inside` and `outside`,
  - `heictojpg`'s `--quality` allows whole numbers from 1 to 100,
  - `movtomp4`'s `--quality` allows `low`, `medium` and `high`,
  - `togif`'s `--fps` allows whole numbers from 1 to 30 and `--speed` allows 0.5 to 4,
  - `enlarge`'s `--scale` allows `2x` and `4x`,
  - `colorpick`'s `--palette` allows whole numbers from 1 to 16,
  - `pdftopng`'s `--dpi` allows 36 to 600,
  - `--background` in `pngtojpg` and `rotate` allows colours.

#### Scenario: Defaults are valid
- **WHEN** every option default in the registry is checked against its option's rule
- **THEN** every default passes

#### Scenario: TIFF quality has no default
- **WHEN** `pngtotiff`'s options are inspected
- **THEN** `--quality` allows whole numbers from 1 to 100 and has no default, because TIFF is lossless unless a quality is given

### Requirement: Output naming details
Every Tools mode whose output keeps the input's format SHALL declare its output suffix:
- `compress`: `compressed`
- `resize`: `resized`
- `enlarge`: `enlarged`
- `crop`: `cropped`
- `rotate`: `rotated`
- `flip`: `flipped`
- `strip`: `stripped`

Every `<image>topdf` mode and `topdf` SHALL be marked as combining all inputs into one output. No other mode SHALL be.

#### Scenario: Suffixes declared
- **WHEN** the registry is inspected
- **THEN** every mode with output "same as input" has a suffix, and `compress` has `compressed`

#### Scenario: Combining modes
- **WHEN** the registry is inspected
- **THEN** exactly the 11 images-to-PDF modes combine their inputs, and `pdftopng` and `heictojpg` don't
