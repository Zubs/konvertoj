## ADDED Requirements

### Requirement: Packaging checks in CI
For every push and pull request, CI SHALL build konvertoj, pack it with `npm pack`, install the tarball into an empty folder outside the checkout, run the install-size check and run the smoke test, on Windows x64, macOS Intel, macOS Apple Silicon, Linux x64 and Linux arm64, each with Node.js 22, 24 and the latest version. A failure in any combination SHALL fail the run without cancelling the others.

#### Scenario: Every combination passes
- **WHEN** the packed release works everywhere
- **THEN** all fifteen packaging jobs succeed

#### Scenario: One combination fails
- **WHEN** the smoke test fails on one system and Node.js version
- **THEN** the CI run fails, and the other packaging jobs still run to completion
