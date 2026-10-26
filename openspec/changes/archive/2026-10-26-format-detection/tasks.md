# Tasks

## 1. Dependency and fixtures

- [x] 1.1 Install `file-type` as a dependency; verify `npm run check` passes and `npm pack --dry-run` still lists only `dist/`, `README.md`, `LICENSE` and `package.json`
- [x] 1.2 Add `test/fixtures/make-fixtures.swift`, which uses ImageIO to write `test/fixtures/iphone.heic` (a small camera-style HEIC photo with EXIF camera, date and GPS details), and run it to create the fixture; verify `file-type` reports it as `heic`
- [x] 1.3 Add `test/support/samples.ts` with a function that writes a minimal valid header for each recognised format (jpg, png, an animated PNG, webp, avif, gif, tiff, bmp, ico, heic, pdf, mov, mkv, avi, webm, m4v, mp4) and an SVG text sample; verify `npm run check` passes

## 2. Detection

- [x] 2.1 Add `damagedFile()` to `src/errors.ts`, returning the "looks damaged and can't be read. Try opening it in another app, or get a fresh copy." `UserError`
- [x] 2.2 Add `detectFormat(file)` to `src/detect.ts` as in design.md: empty files, `file-type` mapping (`tif` → `tiff`, `apng` → `png`), SVG text sniffing for no result or `xml`, `.svg` extension fallback, and contents errors turned into `damagedFile()`
- [x] 2.3 Add `test/detect.test.ts` cases for `detectFormat`: a 0-byte file fails with "is empty"; `iphone.heic` is HEIC; a PNG named `holiday.heic` is PNG; an animated PNG is PNG; every sample format saved as `.bin` is its own format; an SVG with no extension, with a BOM, comments and a doctype is SVG; non-SVG text named `logo.svg` is SVG; plain text named `notes.jpg` is `undefined`; a mocked `file-type` failure gives "looks damaged"; verify it passes

## 3. Input checks

- [x] 3.1 Add `format?: string` to `InputFile` in `src/inputs.ts`
- [x] 3.2 Add `checkItem(mode, item, options, cwd)` to `src/detect.ts` as in design.md: unknown files, accepted formats, "is already a …" for a fixed-output mode, "looks like a … Try: -m …" suggestions, the wrong-kind message with at most six modes and the `--list-modes` pointer, short labels and articles, combined items naming the file and suggesting `to<output>` for mixed formats only when it accepts them all, and the `to<format>` skip unless a mode option or `--strip-metadata` is set
- [x] 3.3 Extend `test/detect.test.ts` for `checkItem`: PNG as `holiday.heic` with `heictojpg` gives "looks like a PNG. Try: -m pngtojpg" and passes `tojpg` as PNG; a JPG given to `heictojpg` says it's already a JPG; `.jpeg`, `.jfif` and `.JPG` JPGs pass `jpgtopng`; a JPG with `tojpg` is skipped with "already a JPG", but not with `quality: "60"` or `strip-metadata: true`, and still skipped with `overwrite: true`; a HEIC and an ICO with `pngtojpg` say "looks like a HEIC" and "looks like an ICO"; text as `notes.jpg` gives "isn't a file konvertoj can convert"; an MP4 with `topdf` names `mp4tomp3` and says `topdf` works with any image; a BMP with `compress` lists JPG, PNG, WebP, AVIF and GIF; a PDF with `tojpg` suggests `pdftojpg`; a JPG and a PNG with `jpgtopdf` name the PNG and suggest `-m topdf`; a JPG and an MP4 with `jpgtopdf` name the MP4 without suggesting `topdf`; three JPGs with one empty given to `jpgtopdf` name the empty one; verify it passes

## 4. Runner

- [x] 4.1 Update `runItem` in `src/runner.ts` to call `checkItem` for modes whose inputs are all known formats, after `reporter.started`, recording a thrown `UserError` as a failure and `{ skipped }` as a skip, and passing the checked inputs to `run`; verify the existing runner tests pass unchanged
- [x] 4.2 Add runner tests using registry modes with a fake `run` that records formats and copies the input: a folder with a HEIC, a PNG and a WebP given to `tojpg` reaches `run` three times with `heic`, `png` and `webp`; a mismatched file never reaches `run` and nothing is written for it; a downloads folder with a PNG, a JPG, a text file and an MP4 given to `tojpg` reports 1 converted, 1 skipped ("already a JPG") and 2 failed with their reasons, and exits with `2`; a JPG given to `tojpg` alone exits `0` as skipped; verify `npm test` passes
- [x] 4.3 Confirm the start-up test still shows that `--help` loads no `file-type` module

## 5. Decisions log and final checks

- [x] 5.1 Add `Decisions.md` with its first entries (feature 5's conversion-dependent tests completed in features 6 and 7; unusable files in a messy folder reported as failed rather than skipped; and why), and link it from the top of `Features.md`
- [x] 5.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass and `README.md` is unchanged
- [x] 5.3 Tick "5. Format detection" in the `Features.md` progress list; verify the line reads `- [x] 5. Format detection`
