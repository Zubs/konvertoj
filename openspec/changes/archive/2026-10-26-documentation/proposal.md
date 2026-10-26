## Why

The README is still a placeholder with the generated mode tables. Feature 19 in Features.md asks for documentation that explains every mode, can't fall out of date with the code, and lets a new user convert, compress and make a PDF from the README alone.

## What Changes

- `README.md` is rewritten with: a demo GIF at the top, what konvertoj is, a quick start with `npx`, an install command, the mode tables (already generated) with a copy-paste example for every mode, the common options, the video add-on, exit codes, privacy and the licence, with FFmpeg credited and the GPL licence of the downloaded add-on explained.
- `npm run docs` also generates the common options section, from the same definitions and wording as `--help`.
- A test runs every `konvertoj` command in the README against generated test files, so no example is broken. It runs in CI with the rest of the suite.
- A link check: a test checks every link to a file or heading in the README; `scripts/check-links.js` also fetches every web link, and runs in CI.
- `docs/demo.tape`, a `vhs` script, records `docs/demo.gif` with `npm run demo`. A CI job records it from the script and checks it shows real output.
- `CHANGELOG.md` and `CONTRIBUTING.md` are added.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `readme-docs`: the generated common options section, the README contents, the example test, the link check, the demo recording, and the changelog and contributing guide.

## Impact

- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/demo.tape`: new or rewritten.
- `scripts/update-readme.js`: generates the options section and the demo image line.
- `scripts/check-links.js`: new.
- `src/help.ts`: exports the common option rows used by both `--help` and the README.
- `package.json`: a `demo` script.
- `.github/workflows/ci.yml`: a link-check step and a `demo` job.
- Tests: `test/readme.test.ts`, `test/readme-examples.test.ts` (new).
- No new dependencies. `vhs` is a development tool used only by `npm run demo` and CI, not a package dependency.
