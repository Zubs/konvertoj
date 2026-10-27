# Spec Delta

## MODIFIED Requirements

### Requirement: Continuous integration on three systems
For every push and pull request, CI SHALL run `npm run check`, `npm test` and `npm run build` on Ubuntu, macOS and Windows. Before the tests, it SHALL build konvertoj and install the video add-on with `konvertoj --install-video`, so video tests run with the real downloaded FFmpeg on every system. A failure on any one system SHALL fail the run, and a failure on one system SHALL NOT cancel the others.

#### Scenario: All systems pass
- **WHEN** a commit is pushed and every check passes on all three systems
- **THEN** the CI run succeeds

#### Scenario: One system fails
- **WHEN** a check fails on Windows only
- **THEN** the CI run fails, and the Ubuntu and macOS jobs still run to completion
