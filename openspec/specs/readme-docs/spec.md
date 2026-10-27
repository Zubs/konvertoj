# readme-docs Specification

## Purpose

Defines the parts of `README.md` generated from the mode registry, and the check that keeps them in step with the code, so the README can't list modes that don't exist or miss ones that do.

## Requirements

### Requirement: Generated mode section
`npm run docs` SHALL rewrite the README section between `<!-- modes:start -->` and `<!-- modes:end -->` from the mode registry, leaving the rest of the README unchanged. The section SHALL have one table per group, in registry group order, listing each mode's name, description and first example.

#### Scenario: Every mode in the README
- **WHEN** `npm run docs` has been run
- **THEN** every mode name in the registry appears in the generated section exactly once, under its group, with an example

#### Scenario: Text outside the markers is kept
- **WHEN** `npm run docs` runs on a README with hand-written text before and after the markers
- **THEN** that text is unchanged

#### Scenario: Running twice changes nothing
- **WHEN** `npm run docs` is run twice in a row
- **THEN** the second run leaves `README.md` byte-for-byte the same

### Requirement: Out-of-date README is caught
The test suite SHALL fail when the README's generated section doesn't match the registry, with a message saying to run `npm run docs`.

#### Scenario: Registry changed without docs
- **WHEN** a mode is added to the registry and `npm run docs` isn't run
- **THEN** `npm test` fails with a message telling the developer to run `npm run docs`

### Requirement: Generated common options
`npm run docs` SHALL rewrite the README section between `<!-- options:start -->` and `<!-- options:end -->` as a table of the common options, built from the same option definitions and wording as the "Common options" in `konvertoj --help`, including each option's short name, placeholder, limits and default.

#### Scenario: Help and README agree
- **WHEN** the README is up to date
- **THEN** every option row in `konvertoj --help`'s "Common options" appears in the README's options table with the same name and explanation, and the table has no other rows

#### Scenario: Option changed without docs
- **WHEN** a common option's description or default changes and `npm run docs` isn't run
- **THEN** `npm test` fails with a message telling the developer to run `npm run docs`

### Requirement: README contents
`README.md` SHALL contain, in this order: the demo GIF (once recorded), what konvertoj is, a quick start with `npx`, an install command, the mode tables, the common options, the video add-on, exit codes, privacy and the licence. The exit codes section SHALL list `0`, `1`, `2` and `130`.

#### Scenario: Every section present
- **WHEN** the README is read
- **THEN** it has the quick start, install, modes, common options, video add-on, exit codes, privacy and licence sections, with FFmpeg credited and the add-on's GPL licence explained

#### Scenario: A new user follows only the README
- **WHEN** a new user copies the quick start commands
- **THEN** they convert an iPhone photo to JPG, compress an image and make a PDF, and each command succeeds

### Requirement: Video add-on and FFmpeg credit
The README's video add-on section SHALL say that FFmpeg is used from the computer when installed, that otherwise konvertoj offers a one-time download it asks about first, how to install it in advance with `--install-video`, where it is cached, and that the downloaded add-on is a GPL-licensed FFmpeg build from the ffmpeg-static project, with credit to FFmpeg.

#### Scenario: Add-on explained
- **WHEN** the README's video add-on section is read
- **THEN** it explains the installed and downloaded routes, `--install-video`, the cache folder, and credits FFmpeg with the GPL licence of the download

### Requirement: Every README example works
A test SHALL run every `konvertoj` command in the README, in inline code in tables and in `bash` code blocks (with a leading `npx` removed), and every example of every registry mode, in a temporary folder holding real test files named as the command expects, and SHALL fail if any command doesn't exit with code `0`. Commands whose mode needs FFmpeg SHALL be skipped only when no FFmpeg can be found; CI installs it, so they run there.

#### Scenario: Every example runs
- **WHEN** `npm test` runs
- **THEN** every README example is run and exits with code `0`

#### Scenario: A placeholder in a code block
- **WHEN** a `bash` block in the README holds a command with no known mode, such as `konvertoj -m <mode> <input>`
- **THEN** the test fails, naming the command

#### Scenario: Every mode has an example
- **WHEN** the commands are collected from the README alone
- **THEN** every mode in the registry has at least one

### Requirement: Links work
Every link in the README SHALL work. A test SHALL check that every link to a file in the repository points to a file that exists, and every link to a heading points to a heading in the README. In CI, `scripts/check-links.js` SHALL also fetch every web link and fail on any that doesn't answer with success.

#### Scenario: Broken file link
- **WHEN** the README links to a file that doesn't exist, or to a heading that isn't there
- **THEN** the test fails, naming the link

#### Scenario: Broken web link
- **WHEN** a web link in the README answers with an error or can't be reached
- **THEN** the link check names it and exits with code `1`

### Requirement: Demo recording
`docs/demo.tape` SHALL be a `vhs` script that runs real konvertoj commands, and `npm run demo` SHALL record `docs/demo.gif` from it. A CI job SHALL record the demo from the script and check that the GIF was written and that the recorded text shows konvertoj's real output. The README SHALL show the GIF at the top once `docs/demo.gif` exists.

#### Scenario: Demo recorded from its script
- **WHEN** the CI demo job runs `vhs docs/demo.tape`
- **THEN** `docs/demo.gif` is a GIF and the recorded text contains konvertoj's summary `1 converted, 0 failed`

### Requirement: Changelog and contributing guide
The repository SHALL have a `CHANGELOG.md` with an "Unreleased" section listing the features for 1.0.0, and a `CONTRIBUTING.md` explaining how to set up, the checks to run, the mode registry as the single source of truth, `npm run docs` and the build order in Features.md.

#### Scenario: Files present
- **WHEN** the repository is checked out
- **THEN** `CHANGELOG.md` and `CONTRIBUTING.md` exist, and the README links to both
