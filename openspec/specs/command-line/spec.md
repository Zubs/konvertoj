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
A value outside its option's declared word list, range, colour rule, size list rule or pattern SHALL fail with exit code `1` before the mode runs. The message SHALL name the option, the value given, and the allowed words, range or kind of value. Word matching SHALL ignore letter case. Options without a declared rule SHALL pass through unchecked. Option values SHALL be checked before inputs, so a wrong value is reported even when the inputs are wrong too.

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
- **WHEN** a user runs `-m heictojpg photo.heic --quality 1`, `--quality 100`, or `-m movtomp4 clip.mov --quality HIGH`, with those files present
- **THEN** none fails an option check

#### Scenario: Same name, different rule
- **WHEN** a user runs `-m movtomp4 clip.mov --quality 80`
- **THEN** it fails, listing `low, medium, high`

#### Scenario: Negative numbers pass
- **WHEN** a user runs `-m rotate photo.jpg --angle -90`
- **THEN** no option check fails, because `--angle` allows any number

#### Scenario: Colour not recognised
- **WHEN** a user runs `-m pngtojpg logo.png --background banana`
- **THEN** it fails with exit code `1`, naming `--background` and `banana` and giving examples such as `white`, `#ff8800` and `rgb(255,136,0)`, and no file is written

#### Scenario: Colours accepted
- **WHEN** a user runs `-m pngtojpg logo.png` with `--background red`, `--background #f80`, `--background #ff8800` or `--background rgb(255, 136, 0)`
- **THEN** no option check fails

#### Scenario: Icon sizes
- **WHEN** a user runs `-m pngtoico logo.png` with `--sizes 0`, `--sizes 257`, `--sizes abc` or `--sizes 16,,32`
- **THEN** each fails with exit code `1`, saying `--sizes` must be whole numbers from 1 to 256 separated by commas

#### Scenario: Unchecked values pass through
- **WHEN** a user runs `-m pngtojpg logo.png -o "my banana"`
- **THEN** no option check fails, because `-o` takes any name and has no declared rule

#### Scenario: Option checked before inputs
- **WHEN** a user runs `-m heictojpg missing.heic --quality 101` and `missing.heic` doesn't exist
- **THEN** it fails with the `--quality` message, not the missing-file message

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
A valid command for a registered mode whose work isn't built yet SHALL fail with exit code `1` and say `<mode> isn't available yet.` This SHALL happen after its inputs have been found and its outputs planned, so input mistakes are reported first, and SHALL NOT create any folders. `--dry-run` SHALL still print the plan and exit with `0`.

#### Scenario: Running an unbuilt mode
- **WHEN** a test-only mode without a `run` is used on an existing file
- **THEN** it fails with exit code `1` and "<mode> isn't available yet."

#### Scenario: Input mistakes come first
- **WHEN** the same test-only mode is given a file that doesn't exist
- **THEN** it fails, naming the file, without mentioning that the mode isn't available

#### Scenario: Dry run of an unbuilt mode
- **WHEN** the same test-only mode is run with `--dry-run`
- **THEN** it prints the planned output and exits with `0`

### Requirement: Errors are for people
Every command-line error SHALL go to standard error as a plain-English message without a stack trace, and SHALL say how to fix the problem. An unexpected error anywhere in konvertoj SHALL also be shown as a plain-English message that suggests running again with `--verbose`, with exit code `1`. Its technical details and stack trace SHALL appear only with `--verbose`.

#### Scenario: No stack traces
- **WHEN** any of the wrong commands above is run
- **THEN** standard error contains no stack trace lines (no line starting with `    at `), and standard output is empty

#### Scenario: Unexpected error
- **WHEN** something inside konvertoj fails unexpectedly, outside any single file's work
- **THEN** standard error says konvertoj hit an unexpected problem and suggests `--verbose`, with no stack trace, and the exit code is `1`

#### Scenario: Unexpected error with --verbose
- **WHEN** the same happens with `--verbose`
- **THEN** standard error also shows the technical error and its stack trace

### Requirement: Help and version are fast
`konvertoj --help`, `--version` and `--list-modes` SHALL NOT load image, PDF, HEIC or FFmpeg libraries.

#### Scenario: No heavy modules
- **WHEN** `konvertoj --help` runs
- **THEN** only konvertoj's own modules and Node.js built-ins are loaded

### Requirement: Mode option checks
A mode MAY declare rules that look at several of its options together, such as a missing required choice or two options that conflict. A broken rule SHALL fail with exit code `1` and a plain-English message, after the option value checks and before any input is read or any folder is created.

#### Scenario: Conflicting options
- **WHEN** a user runs `konvertoj -m resize photo.jpg --scale 50% --width 800 -o out/`
- **THEN** it fails with exit code `1`, says `--scale` can't be used with `--width`, and no `out` folder is created

#### Scenario: Checked before inputs
- **WHEN** a user runs `konvertoj -m resize missing.jpg` and `missing.jpg` doesn't exist
- **THEN** it fails with "Give --width, --height or --scale", not the missing-file message

### Requirement: No output for modes that print details
For a mode that shows details instead of creating files, `-o`/`--output` SHALL fail with exit code `1` before any file is read, saying the mode doesn't create files.

#### Scenario: info with -o
- **WHEN** a user runs `konvertoj -m info photo.jpg -o details`
- **THEN** it fails with exit code `1`, saying `info` doesn't create files, so `-o` can't be used

#### Scenario: colorpick with -o
- **WHEN** a user runs `konvertoj -m colorpick logo.png --at 0,0 -o colours`
- **THEN** it fails the same way, naming `colorpick`

### Requirement: Install the video add-on
`konvertoj --install-video` SHALL make sure FFmpeg is available for video and audio modes, downloading the add-on if needed, and SHALL be listed on the main help screen. It SHALL work without `-m` or any input.

#### Scenario: Help lists it
- **WHEN** a user runs `konvertoj --help`
- **THEN** the help shows `--install-video`

#### Scenario: Nothing to do
- **WHEN** a user runs `konvertoj --install-video` with FFmpeg 6 on the `PATH`
- **THEN** it says FFmpeg is already installed, naming it, and exits with `0`

### Requirement: Mode warnings
A mode MAY declare warnings about the options given, such as an option that has no effect for its format. They SHALL be printed on standard error as `Warning: <message>`, once, before any file is processed, and SHALL NOT change the exit code.

#### Scenario: Ignored bitrate
- **WHEN** a user runs `konvertoj -m towav talk.mp4 --bitrate 320k`
- **THEN** standard error shows one warning that `--bitrate` is ignored for WAV, and the WAV is written
