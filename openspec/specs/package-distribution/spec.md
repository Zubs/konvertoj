# package-distribution Specification

## Purpose

Defines what the published `konvertoj` npm package declares and contains, so `npx konvertoj` installs a small package with the right command and nothing from development.

## Requirements

### Requirement: Package identity and command
The package SHALL be named `konvertoj`, SHALL be an ES module package, and SHALL expose a `konvertoj` command that runs `dist/cli.js`.

#### Scenario: Package declares the command
- **WHEN** `package.json` is read
- **THEN** `name` is `konvertoj`, `type` is `module` and `bin.konvertoj` is `dist/cli.js`

### Requirement: Supported Node.js versions declared
The package SHALL declare that it needs Node.js 22 or newer.

#### Scenario: Engines field
- **WHEN** `package.json` is read
- **THEN** `engines.node` is `>=22`

### Requirement: Published file list
The packed package SHALL contain only `package.json`, `README.md`, `LICENSE` and files under `dist/`. Source files, tests, fixtures and configuration SHALL NOT be included.

#### Scenario: Dry-run pack
- **WHEN** `npm pack --dry-run` is run after a build
- **THEN** every listed file is `package.json`, `README.md`, `LICENSE` or under `dist/`, and no file from `src/`, `test/` or `test/fixtures/` appears

### Requirement: MIT licence
The package SHALL be released under the MIT licence.

#### Scenario: Licence declared and included
- **WHEN** the package is packed
- **THEN** `package.json` has `license` set to `MIT` and a `LICENSE` file with the MIT licence text is included

### Requirement: Works from a clean install
The packed release SHALL install with `npm` into an empty folder on Windows x64, macOS Intel, macOS Apple Silicon, Linux x64 and Linux arm64, on Node.js 22, Node.js 24 and the latest Node.js, with nothing else installed, and SHALL pass the same smoke test on every one of them.

#### Scenario: Same result everywhere
- **WHEN** the packaging job runs on all five systems with all three Node.js versions
- **THEN** the smoke test passes in every combination

### Requirement: Smoke test
The smoke test SHALL check that `npx` shows the help screen and that one mode from each group works: Image (`heictojpg`), PDF (`topdf`), GIF (`togif`), Video & Audio (`movtomp4`, after `--install-video`) and Tools (`info`). It SHALL also run one conversion without `-o`, which writes the output beside the input, and SHALL install the video add-on through a local proxy given by `HTTPS_PROXY`, with no FFmpeg on the `PATH`.

#### Scenario: Help screen from npx
- **WHEN** `npx` runs the packed konvertoj with `--help` on a computer with only Node.js 22
- **THEN** the help screen is shown and the exit code is `0`

#### Scenario: One conversion from each group
- **WHEN** the smoke test runs against the installed konvertoj on any supported system and Node.js version
- **THEN** `heictojpg`, `topdf`, `togif`, `movtomp4` and `info` each succeed and write the expected output

#### Scenario: Paths with spaces and backslashes
- **WHEN** the smoke test gives inputs and outputs inside a folder whose name has a space, as absolute paths in the system's own form (with backslashes on Windows) and as relative paths
- **THEN** every conversion succeeds

#### Scenario: A friend on another system
- **WHEN** someone on a different operating system runs `npx konvertoj -m heictojpg photo.heic`
- **THEN** `photo.jpg` is written beside `photo.heic` with no setup

#### Scenario: Add-on download through a proxy
- **WHEN** the smoke test runs `--install-video` with `HTTPS_PROXY` pointing at a local proxy and no FFmpeg on the `PATH`
- **THEN** the proxy is asked for a tunnel to `github.com:443`, the add-on installs, and `movtomp4` and `togif` on a video then work

### Requirement: Install-size budget
The installed size of konvertoj and its dependencies SHALL be at most 150 MB, measured as the total size of the files in `node_modules` after a clean install of the packed release. CI SHALL fail when it is over the budget.

#### Scenario: Within the budget
- **WHEN** the install-size check runs after a clean install
- **THEN** it prints the installed size and the budget, and exits with code `0`

#### Scenario: Over the budget
- **WHEN** the installed size is more than the budget
- **THEN** the check names the size and the budget, and exits with code `1`, failing CI

### Requirement: Instant help
`konvertoj --help` SHALL respond in under half a second on every supported system, measured as the median of several runs of the installed konvertoj.

#### Scenario: Help is fast
- **WHEN** the smoke test times `konvertoj --help`
- **THEN** the median time is under 500 ms

### Requirement: Package details for npm
`package.json` SHALL have version `1.0.0`, a `description`, `keywords` that describe what konvertoj converts, `repository` pointing to `https://github.com/Zubs/konvertoj`, `homepage` pointing to the repository's README, and `bugs` pointing to its issues page. `publishConfig` SHALL set `access` to `public` and `provenance` to `true`.

#### Scenario: Fields filled in
- **WHEN** `package.json` is read
- **THEN** `version` is `1.0.0`, and `description`, `keywords`, `repository.url`, `homepage` and `bugs.url` are set

#### Scenario: Packed name, version and files
- **WHEN** `npm pack --dry-run --json` is run after a build (offline, in the test suite)
- **THEN** it reports the name `konvertoj`, version `1.0.0`, and only `package.json`, `README.md`, `LICENSE` and files under `dist/`

#### Scenario: Dry-run publish in the release workflow
- **WHEN** the release workflow is started by hand
- **THEN** `npm publish --dry-run` reports `konvertoj@1.0.0` with the same files

### Requirement: Publishing from a tag with provenance
konvertoj SHALL be published only by the release workflow, when a tag `v<version>` matching `package.json`'s version is pushed, using `npm publish` with provenance (set in `publishConfig`), so every release can be traced to the commit and workflow that built it. A tag that doesn't match the version SHALL fail the workflow before anything is published. Whether it publishes or only does a dry run SHALL depend on how the workflow was started (a pushed tag or by hand), not on the selected ref.

#### Scenario: Matching tag
- **WHEN** the tag `v1.0.0` is pushed and every check passes
- **THEN** konvertoj 1.0.0 is published to npm with a provenance statement

#### Scenario: Mismatched tag
- **WHEN** the tag `v1.0.1` is pushed while `package.json` says `1.0.0`
- **THEN** the workflow fails, naming both versions, and nothing is published

#### Scenario: Dry run
- **WHEN** the release workflow is run by hand with nothing changed since the last check
- **THEN** every check passes and `npm publish --dry-run` runs, and nothing is published
