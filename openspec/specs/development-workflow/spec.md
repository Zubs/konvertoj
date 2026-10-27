# development-workflow Specification

## Purpose

Defines the commands developers use to format, check, test and build konvertoj, and the continuous integration that runs those checks on Windows, macOS and Linux for every change.

## Requirements

### Requirement: Developer scripts
The project SHALL provide `npm run format` (formats all files), `npm run check` (type checks and lints without writing files), `npm test` (runs the full test suite once) and `npm run build` (compiles `src/` into `dist/`).

#### Scenario: Fresh clone passes every check
- **WHEN** a developer clones the repository and runs `npm install`, `npm run check`, `npm test` and `npm run build`
- **THEN** every command exits with code `0`

#### Scenario: Check fails on a type error
- **WHEN** a file in `src/` contains a type error or a lint error
- **THEN** `npm run check` exits with a non-zero code and names the file

### Requirement: Build output mirrors source
The build SHALL compile each file in `src/` to a matching `.js` file in `dist/` at the same relative path.

#### Scenario: Entry point compiled
- **WHEN** `npm run build` is run
- **THEN** `src/cli.ts` produces `dist/cli.js`

### Requirement: Test suite
The test suite SHALL run every test under `test/`, and SHALL include at least one passing test. A `test/fixtures/` folder SHALL exist for files that tests can't generate.

#### Scenario: Sample test passes
- **WHEN** `npm test` is run locally or in CI
- **THEN** at least one test runs and all tests pass

### Requirement: Continuous integration on three systems
For every push and pull request, CI SHALL run `npm run check`, `npm test` and `npm run build` on Ubuntu, macOS and Windows. Before the tests, it SHALL build konvertoj and install the video add-on with `konvertoj --install-video`, so video tests run with the real downloaded FFmpeg on every system. A failure on any one system SHALL fail the run, and a failure on one system SHALL NOT cancel the others.

#### Scenario: All systems pass
- **WHEN** a commit is pushed and every check passes on all three systems
- **THEN** the CI run succeeds

#### Scenario: One system fails
- **WHEN** a check fails on Windows only
- **THEN** the CI run fails, and the Ubuntu and macOS jobs still run to completion

### Requirement: Packaging checks in CI
For every push and pull request, CI SHALL build konvertoj, pack it with `npm pack`, install the tarball into an empty folder outside the checkout, run the install-size check and run the smoke test, on Windows x64, macOS Intel, macOS Apple Silicon, Linux x64 and Linux arm64, each with Node.js 22, 24 and the latest version. A failure in any combination SHALL fail the run without cancelling the others.

#### Scenario: Every combination passes
- **WHEN** the packed release works everywhere
- **THEN** all fifteen packaging jobs succeed

#### Scenario: One combination fails
- **WHEN** the smoke test fails on one system and Node.js version
- **THEN** the CI run fails, and the other packaging jobs still run to completion

### Requirement: Release workflow
`.github/workflows/release.yml` SHALL run on a pushed `v*` tag and when started by hand. On a clean Ubuntu runner with Node.js 24 it SHALL run every check (`npm audit`, `npm run check`, `npm run build`, `npm test` with the video add-on, and the README check) before publishing with provenance (for a tag) or running `npm publish --dry-run` (by hand). It SHALL only be allowed to read the repository and request an ID token for provenance.

#### Scenario: Started by hand
- **WHEN** the workflow is started by hand
- **THEN** it runs every check and the dry run, and doesn't publish

#### Scenario: A check fails on a tag
- **WHEN** a tag is pushed and a test fails
- **THEN** the workflow stops before publishing

### Requirement: Audit in CI
CI's `check` job SHALL run `npm audit` on Ubuntu and fail when it reports any vulnerability.

#### Scenario: A vulnerable dependency
- **WHEN** `npm audit` reports a vulnerability
- **THEN** the CI run fails
