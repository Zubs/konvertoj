## 1. Generated sections

- [x] 1.1 Export `commonOptionRows` from `src/help.ts`, built with the same `optionName` and `optionExplanation` as `mainHelp`
- [x] 1.2 Extend `scripts/update-readme.js` to generate the options section and the demo image line, with `--check` covering all sections
- [x] 1.3 Update `test/readme.test.ts`: help and README options agree; an out-of-date options section fails `--check`; the demo line appears only when `docs/demo.gif` exists

## 2. README, changelog and contributing guide

- [x] 2.1 Rewrite `README.md` as in design.md, keeping the markers
- [x] 2.2 Add `CHANGELOG.md` and `CONTRIBUTING.md`
- [x] 2.3 Run `npm run docs`

## 3. Checks

- [x] 3.1 Add `test/readme-examples.test.ts` as in design.md: README commands and every registry example, 1000 × 1000 images, three-page PDFs, videos longer than `--start`, FFmpeg settings for `main`, the quote and unknown-mode failures, the every-mode check and the quick start
- [x] 3.2 Add `scripts/check-links.js`, and tests running it offline on the README and on broken links
- [x] 3.3 Add the online link check to CI's `check` job on Ubuntu

## 4. Demo

- [x] 4.1 Add `docs/demo.tape` (hidden alias, never `npx`), the `demo` script in `package.json`, the `.gitignore` and `.gitattributes` entries and the `demo` CI job checking for `1 converted, 0 failed`

## 5. Finish

- [x] 5.1 Add feature 19 entries to `Decisions.md`: the generated options section; the demo line appears once the GIF exists, and why it wasn't recorded here; examples are run through `main` with generated inputs; online link checks only in CI, and neither they nor the demo job have run yet; recording and committing `docs/demo.gif` and adding a `repository` field are left for feature 20
- [x] 5.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 5.3 Tick "19. Documentation" in the `Features.md` progress list
