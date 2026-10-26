# Tasks

## 1. Printing modes

- [x] 1.1 Add `show` and `colours` to `RunContext`; count a run that showed a section as converted; add `printing` and `json` to the reporter settings and `reporter.shown(index, section)`; when printing, write no `✓` lines or summary, send verbose, detail, skip and note lines to standard error, print sections in input order (text joined by blank lines, or one JSON array) from `finish` even with `--quiet` or after Ctrl+C (with the stopped line on standard error), make `shown` count the item, clear job progress and redraw the bar, and check for a shown section before the runner's "nothing was written" skip; add report and runner tests, including that `info --json --verbose` output parses
- [x] 1.2 Reject `-o` in `main` for modes whose output is `none`; add `main` tests for `info` and `colorpick`

## 2. Info

- [x] 2.1 Add `cameraDetails` to `src/convert/metadata.ts` (make, model, date taken, latitude, longitude, through `exifr` with `gps: true` and `reviveValues: false`, damaged counting as none)
- [x] 2.2 Add `src/convert/info.ts` with `showInfo` as in design.md (format, size, displayed dimensions, colour space names, transparency with the alpha-channel fallback on any `stats()` failure, frames, details, the location rule, text and JSON); give `info` a lazy `run`

## 3. Colour picker

- [x] 3.1 Add the `--at` pattern rule, drop `--palette`'s default (describing "e.g. 5"), and add `colorpick`'s `checkOptions`
- [x] 3.2 Add `src/convert/colours.ts` with `pickColours` as in design.md (pixel at a point read with a 1 × 1 `extract`, with the outside-the-image message; median cut by value over the reduced sample, ignoring transparent pixels; HEX/RGB/HSL with alpha as `Number(a.toFixed(2))` and hue `% 360`, terminal blocks only with colours and without `--json`, text and JSON); give `colorpick` a lazy `run`; run `npm run docs`

## 4. Tests

- [x] 4.1 Add `test/info.test.ts`:
  - no file fails,
  - a JPG shows format, size, dimensions and camera,
  - several files print one section each in order,
  - 1 × 1 and the 20000 × 20000 header show their dimensions,
  - an animated GIF shows its frames,
  - a GPS photo shows "Location: yes" and coordinates only with `--verbose`,
  - no details shows "No camera details",
  - `--json` parses with every field,
  - every format works,
  - `-o` is rejected,
  - the before-and-after-strip scenario
- [x] 4.2 Add `test/colorpick.test.ts`:
  - neither option fails with a hint,
  - `--at 0,0` on red gives the three forms,
  - several files print one section each,
  - `--palette 3` on 40% red, 30% green and 30% blue stripes gives pure red, green and blue, red first,
  - the last pixel works and one past fails with the size,
  - `--palette 1` and `16` work and `0`, `17` and `abc` fail,
  - a half-transparent pixel reports its alpha,
  - `--json` parses with every field,
  - every format works,
  - `-o` is rejected,
  - `--at` with bad values is rejected,
  - the brand-colours scenario
  
  Verify both pass.

## 5. Decisions and final checks

- [x] 5.1 Add feature 12 entries to `Decisions.md`: sections printed after the batch in input order; `--json` always an array; `--quiet` keeps the sections; `--palette` needs a number (no default); colours reported as HEX, RGB and HSL only
- [x] 5.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 5.3 Tick "12. Info and colour picker" in the `Features.md` progress list
