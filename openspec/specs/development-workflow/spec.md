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
