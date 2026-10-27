## Why

Features 1–19 are built and CI passes everywhere. Feature 20 in Features.md is everything needed to publish konvertoj 1.0.0 on npm: a final check of every goal in Spec.md section 2, clean and current dependencies, a traceable release from GitHub Actions with npm provenance, complete package details, and version `1.0.0`.

## What Changes

- `package.json`: version `1.0.0`, `keywords`, `repository`, `homepage` and `bugs`, and `publishConfig` with `access: public` and `provenance: true`.
- A release workflow (`.github/workflows/release.yml`): pushing a `v*` tag runs every check on a clean runner, checks the tag matches the package version, and publishes to npm with provenance. Running it by hand (`workflow_dispatch`) does the same checks and an `npm publish --dry-run`, and never publishes.
- Dependencies: `npm audit` reports nothing; in-range updates are applied; major versions that would change the toolchain are left, with the reasons in Decisions.md. CI's `check` job fails on any audit finding.
- `docs/launch-checklist.md`: every Spec.md section 2 goal, the evidence that it is met (tests, CI jobs, measurements), and the steps only the maintainer can do (the demo recording, the npm account, pushing the tag, the checks after publishing).
- Fixes found in the final check, against Spec.md's "Helpful" and "Safe" goals:
  - a path outside the current folder is shown in full, not as `../../../…`;
  - a combined item's line counts and sizes only the inputs it used, not one it left out;
  - an output folder konvertoj created is removed again if nothing was saved in it.
- `CHANGELOG.md`: the "Unreleased" section becomes "1.0.0", and `CONTRIBUTING.md` explains how to release.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `package-distribution`: package details, version 1.0.0, and publishing with provenance from a tag.
- `development-workflow`: the release workflow and the audit check in CI.
- `run-reporting`: paths outside the current folder, and combined items' counts and sizes.
- `output-writing`: empty output folders are cleaned up.

## Impact

- `package.json`, `package-lock.json` (in-range updates), `.github/workflows/release.yml` (new), `.github/workflows/ci.yml` (audit step).
- `src/report.ts`, `src/detect.ts`, `src/main.ts`, `src/output-files.ts`, `src/runner.ts` (or wherever the plan's paths are built and folders are prepared), with a small `displayPath` helper.
- `docs/launch-checklist.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `Decisions.md`, `Features.md`.
- Tests: `test/package.test.ts`, `test/report.test.ts`, `test/output-files.test.ts` or `test/runner.test.ts`, `test/pdf.test.ts`.
- Nothing is published by this change. Publishing happens when the maintainer pushes the `v1.0.0` tag.
