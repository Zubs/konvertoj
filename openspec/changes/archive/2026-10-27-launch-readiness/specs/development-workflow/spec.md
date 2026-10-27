## ADDED Requirements

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
