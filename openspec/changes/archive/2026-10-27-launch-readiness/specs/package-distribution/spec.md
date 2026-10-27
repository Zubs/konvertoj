## ADDED Requirements

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
