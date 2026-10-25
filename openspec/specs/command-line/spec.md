# command-line Specification

## Purpose

Defines how konvertoj reads a command (`konvertoj -m <mode> <input> -o <output> [options]`), what the help screens show, and the plain-English errors and exit codes for commands that are wrong.

## Requirements

### Requirement: Main help screen
Running `konvertoj` with no arguments, or with `-h`/`--help` and no mode, SHALL print to standard output:
- what konvertoj does,
- the command shape,
- a few common examples,
- the common options,
- pointers to `--list-modes` and `-m <mode> --help`.

It SHALL then exit with code `0`.

#### Scenario: No arguments
- **WHEN** a user runs `konvertoj` with no arguments
- **THEN** standard output shows the help screen, including `konvertoj -m <mode> <input>` and `--list-modes`, standard error is empty, and the exit code is `0`

#### Scenario: Help flag
- **WHEN** a user runs `konvertoj --help` or `konvertoj -h`
- **THEN** the same help screen is shown with exit code `0`

### Requirement: Version
`konvertoj --version` SHALL print only the version from `package.json` and exit with code `0`.

#### Scenario: Version printed
- **WHEN** a user runs `konvertoj --version`
- **THEN** standard output is the `version` field of `package.json` followed by a newline, and the exit code is `0`

### Requirement: List modes
`konvertoj --list-modes` SHALL list every registered mode exactly once with its description, under headings for Image, PDF, GIF, Video & Audio and Tools in that order, and exit with code `0`.

#### Scenario: Every mode listed once
- **WHEN** a user runs `konvertoj --list-modes`
- **THEN** each mode name from the registry appears exactly once, under its group's heading, and the five headings appear in order

### Requirement: Mode help
`konvertoj -m <mode> --help` SHALL show the mode's name, description, accepted inputs, output, its options with explanations and defaults, the common options, and its examples, and exit with code `0`.

#### Scenario: heictojpg help
- **WHEN** a user runs `konvertoj -m heictojpg --help`
- **THEN** the output contains the mode's description, `--quality` with its default, the common option `--overwrite`, and at least one example starting with `konvertoj -m heictojpg`

### Requirement: Short and long options are equivalent
`-m` and `--mode` SHALL behave identically, as SHALL `-o` and `--output`, and every other short and long pair.

#### Scenario: Same result either way
- **WHEN** a user runs `konvertoj -m heictojpg --help` and `konvertoj --mode heictojpg --help`
- **THEN** both print the same output with the same exit code

#### Scenario: Output option either way
- **WHEN** a user runs `konvertoj -m heictojpg photo.heic -o beach` and `konvertoj -m heictojpg photo.heic --output beach`
- **THEN** both give the same result

### Requirement: Unknown mode suggestions
An unknown mode SHALL fail with exit code `1`, saying `Unknown mode <name>.` and `Did you mean <mode>?` for the closest real mode. Matching SHALL ignore letter case, `-`, `_` and spaces, treat `2` as `to`, `jpeg` as `jpg`, `tif` as `tiff` and `heif` as `heic`, and allow small typos. A variant that matches a real mode still fails; it's only suggested.

#### Scenario: Common variants
- **WHEN** a user runs `-m heic2jpg`, `-m heic-to-jpg`, `-m HEICtoJPG` or `-m heictojgp`
- **THEN** each fails with exit code `1` and a message containing "Did you mean heictojpg?"

#### Scenario: Format aliases
- **WHEN** a user runs `-m jpegtopng`
- **THEN** it fails with "Did you mean jpgtopng?"

#### Scenario: No close match
- **WHEN** a user runs `-m banana`
- **THEN** it fails with exit code `1`, says the mode is unknown, and tells the user to run `konvertoj --list-modes`

### Requirement: Missing mode
A missing `-m` value, or inputs given without `-m`, SHALL fail with exit code `1`. The message SHALL explain the problem and show the command shape `konvertoj -m <mode> <input> -o <output> [options]`.

#### Scenario: -m with no value
- **WHEN** a user runs `konvertoj -m`
- **THEN** it fails with exit code `1`, says a mode name is needed after `-m`, and shows the command shape

#### Scenario: File with no mode
- **WHEN** a user runs `konvertoj photo.heic`
- **THEN** it fails with exit code `1`, says to choose a mode with `-m`, and shows the command shape

### Requirement: Options must belong to the mode
An option that exists for other modes but not the chosen one SHALL fail with exit code `1`, naming the option and the mode and pointing to that mode's help. An option no mode has SHALL fail as an unknown option.

#### Scenario: Option from another mode
- **WHEN** a user runs `konvertoj -m heictojpg photo.heic --angle 90`
- **THEN** it fails with exit code `1` and a message naming `--angle` and `heictojpg`, and suggesting `konvertoj -m heictojpg --help`

#### Scenario: Option nobody has
- **WHEN** a user runs `konvertoj -m heictojpg photo.heic --banana`
- **THEN** it fails with exit code `1` and a message saying `--banana` isn't a konvertoj option

#### Scenario: Value missing or not expected
- **WHEN** a user runs `konvertoj -m heictojpg photo.heic --quality`, or `--overwrite=yes`
- **THEN** it fails with exit code `1` and a plain-English message saying `--quality` needs a value, or `--overwrite` doesn't take one

### Requirement: Option values are checked
A value outside its option's declared word list or range SHALL fail with exit code `1` before the mode runs. The message SHALL name the option, the value given, and the allowed words or range. Word matching SHALL ignore letter case. Options without a declared rule SHALL pass through unchecked.

#### Scenario: Word not allowed
- **WHEN** a user runs `konvertoj -m resize photo.jpg --fit banana`
- **THEN** it fails with exit code `1` and a message naming `--fit` and `banana` and listing `contain, cover, fill, inside, outside`

#### Scenario: Number out of range
- **WHEN** a user runs `-m heictojpg photo.heic --quality 101`, `--quality 0` or `--quality abc`
- **THEN** each fails with exit code `1` and a message saying `--quality` must be a whole number from 1 to 100

#### Scenario: Whole numbers only
- **WHEN** a user runs `-m togif clip.mp4 --fps 2.5`
- **THEN** it fails, saying `--fps` must be a whole number from 1 to 30

#### Scenario: Valid values pass
- **WHEN** a user runs `-m heictojpg photo.heic --quality 1`, `--quality 100`, or `-m movtomp4 clip.mov --quality HIGH`
- **THEN** none fails an option check, and each reaches the "isn't available yet" message

#### Scenario: Same name, different rule
- **WHEN** a user runs `-m movtomp4 clip.mov --quality 80`
- **THEN** it fails, listing `low, medium, high`

#### Scenario: Negative numbers pass
- **WHEN** a user runs `-m rotate photo.jpg --angle -90`
- **THEN** no option check fails, because `--angle` allows any number

#### Scenario: Unchecked values pass through
- **WHEN** a user runs `-m heictojpg photo.heic --background banana`
- **THEN** no option check fails, because `--background` has no declared rule (colours are checked by feature 6)

### Requirement: HEIC and SVG are input only
A mode name asking to create HEIC or SVG (`<format>toheic`, `toheic`, `<format>tosvg`, `tosvg`, including the variants the suggestion matching accepts) SHALL fail with exit code `1`. The message SHALL say konvertoj can read that format but can't create it. When a mode with the same input and JPG (for HEIC) or PNG (for SVG) output exists, it SHALL suggest that mode.

#### Scenario: Creating HEIC
- **WHEN** a user runs `-m pngtoheic`
- **THEN** it fails with exit code `1`, says HEIC files can be read but not created, and suggests `pngtojpg`

#### Scenario: Creating SVG
- **WHEN** a user runs `-m jpgtosvg` or `-m tosvg`
- **THEN** each fails with exit code `1`, says SVG files can be read but not created, and suggests `jpgtopng` or `topng`

#### Scenario: No matching suggestion
- **WHEN** a user runs `-m pngtosvg`
- **THEN** it fails with the SVG input-only message and no suggestion, because `pngtopng` doesn't exist

#### Scenario: Variants
- **WHEN** a user runs `-m toheif` or `-m png2heic`
- **THEN** each gets the HEIC input-only message

### Requirement: Modes not built yet
A valid command for a registered mode whose work isn't built yet SHALL fail with exit code `1` and say `<mode> isn't available yet.`

#### Scenario: Running an unbuilt mode
- **WHEN** a user runs `konvertoj -m heictojpg photo.heic` before HEIC conversion exists
- **THEN** it fails with exit code `1` and "heictojpg isn't available yet."

### Requirement: Errors are for people
Every command-line error SHALL go to standard error as a plain-English message without a stack trace, and SHALL say how to fix the problem.

#### Scenario: No stack traces
- **WHEN** any of the wrong commands above is run
- **THEN** standard error contains no stack trace lines (no line starting with `    at `), and standard output is empty

### Requirement: Help and version are fast
`konvertoj --help`, `--version` and `--list-modes` SHALL NOT load image, PDF, HEIC or FFmpeg libraries.

#### Scenario: No heavy modules
- **WHEN** `konvertoj --help` runs
- **THEN** only konvertoj's own modules and Node.js built-ins are loaded
