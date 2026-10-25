# cli-startup Specification

## Purpose

Defines how the `konvertoj` executable starts on a user's computer: that it can be run directly, that it checks the Node.js version first, and that it exits cleanly.

## Requirements

### Requirement: Executable entry point
The built entry point `dist/cli.js` SHALL begin with the line `#!/usr/bin/env node` so it can be run directly as the `konvertoj` command.

#### Scenario: Built entry point has the shebang
- **WHEN** the project is built
- **THEN** the first line of `dist/cli.js` is exactly `#!/usr/bin/env node`

### Requirement: Clean start with nothing to do
Until command-line features exist, running the entry point on a supported Node.js version SHALL exit with code `0` and print no errors.

#### Scenario: Running the built entry point
- **WHEN** a user runs `node dist/cli.js` on Node.js 22 or newer
- **THEN** it exits with code `0` and writes nothing to standard error

### Requirement: Node.js version check
On a Node.js version older than 22, the entry point SHALL print `konvertoj needs Node.js 22 or newer` with the version in use and how to fix it, and exit with code `1`, instead of failing with a stack trace.

#### Scenario: Older Node.js
- **WHEN** konvertoj starts on Node.js 20
- **THEN** standard error contains "konvertoj needs Node.js 22 or newer", names the current version and suggests installing a newer Node.js, and the exit code is `1`

#### Scenario: Supported Node.js
- **WHEN** konvertoj starts on Node.js 22 or newer
- **THEN** no version message is printed

#### Scenario: Version check runs before anything else
- **WHEN** konvertoj starts on an old Node.js version
- **THEN** the message is printed before the rest of konvertoj is loaded, so code relying on newer Node.js features never runs
