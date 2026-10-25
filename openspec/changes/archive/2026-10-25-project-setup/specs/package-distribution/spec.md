# Spec Delta

## Purpose

Defines what the published `konvertoj` npm package declares and contains, so `npx konvertoj` installs a small package with the right command and nothing from development.

## ADDED Requirements

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
