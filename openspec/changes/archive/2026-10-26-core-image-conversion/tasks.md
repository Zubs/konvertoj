# Tasks

## 1. Dependency and registry

- [x] 1.1 Install `sharp` as a dependency; verify `npm run check` passes and the start-up import test still passes
- [x] 1.2 Move the default qualities to `defaultQualities` in `src/modes/formats.ts` (JPG and WebP 80, AVIF 50) and add `coreImageFormats`; build `--quality` defaults from them, with TIFF's `--quality` having no default; verify the registry tests pass and add a check that `pngtotiff`'s `--quality` has no default
- [x] 1.3 Add `src/modes/colours.ts` with `isColour` (hex in 3, 4, 6 or 8 digits, `rgb()`/`rgba()` with 0–255 values and spaces, the CSS colour names in any case, but not `transparent`); add the `{ colour: true }` rule to `OptionRule`, `followsRule` and `describeRule`, and declare it on `background` and `rotateBackground`; add unit tests for valid and invalid colours and a `main` test that `--background banana` fails with exit `1` naming the option, value and examples, and writes nothing
- [x] 1.4 Update the command-line pass-through test to use `-m crop photo.jpg --aspect banana`

## 2. Notes

- [x] 2.1 Add `note(message)` to `RunContext`; have the runner collect notes per file and pass them to `reporter.succeeded`, which prints `  Note: <message>` lines on standard output after the `✓` line unless quiet; add report and runner tests for a note and for quiet mode

## 3. Converter

- [x] 3.1 Add `src/convert/image.ts` with `convertImage(context, target)` as in design.md: core-format check ("can't be converted yet."), `autoOrient`, `animated` for GIF/WebP → GIF/WebP, the first-frame note for animated GIF/WebP and the first-page note for other multi-page inputs, `grayscale`, `flatten` onto `--background` (falling back to the declared default, white) for JPG and quality TIFF, the encoders with defaults from `defaultQualities`, lossless LZW TIFF unless `--quality`, encoding with `toBuffer()` and writing with `writeFile` through `context.save`, and the error mapping ("is too large to convert (W × H pixels)…", `UserError`s and file-system errors rethrown, everything else `damagedFile()`)
- [x] 3.2 Set the lazy `convertTo(target)` `run` on every core `<from>to<to>` mode and on `tojpg`, `topng`, `towebp`, `toavif` and `totiff`; verify `node dist/cli.js --help` loads no `sharp` module (start-up test) and `npm run docs` leaves `README.md` unchanged

## 4. Tests

- [x] 4.1 Add `test/support/images.ts` with helpers that write test images with sharp: a solid or transparent image of a given size and format, a detailed noise image, a three-frame animated GIF, a JPG with orientation 6, a Display P3 PNG, a huge-header PNG and a truncated copy of a file (keeping the first half of a detailed image, well past its header)
- [x] 4.2 Add `test/image-conversion.test.ts` through `main`:
  - a 1 × 1 image converts in every direction,
  - one PNG to JPG, WebP, AVIF, GIF and TIFF has the right format and size,
  - all 30 pairs,
  - `--quality 1` and `100` work, and `0`, `101` and `abc` are rejected,
  - a transparent PNG to JPG is white by default and red with `--background red`,
  - `#ff8800` and `rgb(255,136,0)` give the same pixels, and an invalid colour is rejected,
  - quality 20 is smaller than 90,
  - TIFF with `--quality 50` is smaller than lossless TIFF,
  - `--lossless` WebP made from an opaque PNG has identical pixels,
  - `--progressive` gives a progressive JPG,
  - `--grayscale` gives equal channels when read back with `.toColourspace("srgb").raw()`,
  - transparency is kept in WebP,
  - an animated GIF to WebP keeps three frames, and to JPG gives one frame with the `Note:` line,
  - orientation 6 comes out upright,
  - a Display P3 PNG comes out as a JPG with no embedded profile and its pixel converted to sRGB,
  - a three-page TIFF to PNG gives one page with an "only the first page was kept" note,
  - the huge PNG fails with "is too large" and "20000 × 20000",
  - truncated PNG and JPG fail with "looks damaged",
  - `--lossless` with `pngtojpg` is rejected,
  - a PNG named `holiday.heic` converts with `tojpg`,
  - a PNG and a WebP folder converts with `tojpg`,
  - a messy folder (PNG, JPG, text file, MP4) with `tojpg` converts the PNG, skips the JPG and fails the other two, exiting `2`,
  - a HEIC with `tojpg` fails with "can't be converted yet",
  - a folder of PNG screenshots to WebP at quality 80 shows per-file sizes and a summary total
  
  Verify the tests pass.
- [x] 4.3 Move any existing `test/main.test.ts` cases that expected "isn't available yet" from a now-built mode to a mode that isn't built yet (e.g. `heictojpg`, `movtomp4`); verify `npm test` passes

## 5. Decisions and final checks

- [x] 5.1 Add feature 6 entries to `Decisions.md`: TIFF is lossless by default and JPEG-compressed with `--quality`; visible `Note:` lines for notes such as the first frame; `--width`, `--height` and `--fit` accepted without effect until feature 9; non-core inputs to `to<format>` modes fail as "can't be converted yet" until feature 7
- [x] 5.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 5.3 Tick "6. Core image conversion" in the `Features.md` progress list
