# Tasks

## 1. Converter and reporting

- [x] 1.1 Split `convertImage` into `renderImage` (returns the buffer) and `convertImage` (render then save); add `quality` to `ConvertSettings`, used for JPG/WebP/AVIF and turning on palette PNG (`palette`, `quality`, `effort: 10`) and GIF frame sharing (`interFrameMaxError` and `interPaletteMaxError` of `round((100 − q) × 0.32)`, `effort: 10`); verify every existing test still passes
- [x] 1.2 Append the percentage change to success lines in `Reporter.succeeded`; update the report and other tests that compare full success lines; add a test for `2.4 MB → 410 KB (−83%)`

## 2. compress

- [x] 2.1 Add the `--target-size` pattern rule ("a size such as 200kb or 1.5mb") and `compress`'s `checkOptions` (only one of `--quality`, `--level`, `--target-size`); add `main` tests for valid and invalid sizes and for each conflict
- [x] 2.2 Add `src/convert/compress.ts` with `compressImage` as in design.md: quality from `--quality`, `--level` or the medium default; no starting render when `--target-size` is given; target-size binary search (at most 8 attempts starting at 50, highest fitting quality found, smallest kept with a note when unreachable, a verbose detail naming the chosen quality, notes only from the first attempt); "already optimised" skip, naming the unreached target too when that applies; and saving otherwise; give `compress` its lazy `run`

## 3. Tests

- [x] 3.1 Add `test/compress.test.ts` through `main`:
  - no options equals `--level medium`,
  - a large JPG ends up smaller at the same size, with a `(−N%)` line,
  - a folder of JPG, PNG and WebP all compress and the summary totals match the per-file sizes,
  - `--level high` is smaller than `--level low`,
  - `--target-size 200kb` on a JPG is at or under 200 KB and one quality higher is over,
  - `kb`/`mb` in any case are accepted and `0kb`, `-5kb` and `200` rejected,
  - `1kb` keeps the smallest result with a note,
  - a tiny image is "already optimised", writes nothing and counts as skipped,
  - a transparent PNG stays transparent,
  - `--quality` with `--level` or `--target-size` is rejected,
  - BMP and ICO list the supported formats,
  - an animated GIF stays animated, and `--level high` makes it smaller than `--level low`,
  - `--strip-metadata` works with `compress`,
  - the website-images folder scenario
  
  Verify the tests pass.

## 4. Decisions and final checks

- [x] 4.1 Add feature 10 entries to `Decisions.md`: GIF compression uses frame sharing rather than fewer colours, and still GIFs usually stay as they are; the target-size search assumes larger files at higher quality; 1 KB = 1024 bytes for `--target-size`; the percentage on every success line; giving more than one of `--quality`, `--level` and `--target-size` is rejected (Features.md lists only `--quality` with the others)
- [x] 4.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.3 Tick "10. Compress" in the `Features.md` progress list
