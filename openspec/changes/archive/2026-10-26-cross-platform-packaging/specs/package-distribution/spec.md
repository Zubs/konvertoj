## ADDED Requirements

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
