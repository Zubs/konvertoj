## 1. Package and dependencies

- [x] 1.1 Update `package.json` as in design.md, and check `node dist/cli.js --version` prints `1.0.0`
- [x] 1.2 Run `npm update` for in-range updates and `npm audit`; leave TypeScript 7 and `@types/node` 23+
- [x] 1.3 In `test/package.test.ts`, test the package fields, and extend the existing `npm pack --dry-run --json` test to check the name `konvertoj` and version `1.0.0` (offline; `npm publish --dry-run` stays in the release workflow only, since it contacts the registry and fails once a version is published)

## 2. Release

- [x] 2.1 Add `.github/workflows/release.yml` as in design.md
- [x] 2.2 Add the `npm audit` step to CI's `check` job on Linux

## 3. Fixes from the final check

- [x] 3.1 Add `src/paths.ts` with `displayPath`, use it everywhere a path is shown, and test it (inside, outside, the current folder itself, and another drive on Windows only), update tests that expected `.`, and a failing file outside the current folder in a run
- [x] 3.2 In `src/runner.ts`, use the checked inputs for the size before, the success line and a failure after the check (line and summary); test with `topdf` and an earlier PDF in the folder
- [x] 3.3 Remove output folders (and parents) konvertoj created that end up empty, including when preparing fails, in a `try/finally`; test a failing `pdftopng … -o pages` (new folder removed, nested `out/pages` both removed, existing folder kept, folder with a saved file kept)

## 4. Documents

- [x] 4.1 Add `docs/launch-checklist.md` as in design.md
- [x] 4.2 Rename the CHANGELOG section to 1.0.0, add "Releasing" to CONTRIBUTING.md (the token, the dry run, the tag, trusted publishing) linking the checklist, and add the GitHub source link to the README
- [x] 4.3 Add feature 20 entries to `Decisions.md`: dependencies left at their majors and why; token or trusted publishing; the three fixes; what the maintainer still has to do; feature 20 stays unticked until after publishing; `npm audit` can fail CI if the registry can't be reached

## 5. Finish

- [x] 5.1 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 5.2 Leave "20. Launch readiness" unticked in `Features.md` (it is done only when 1.0.0 is on npm and works with `npx`); add a Decisions.md line that the maintainer ticks it after the checks that follow publishing
