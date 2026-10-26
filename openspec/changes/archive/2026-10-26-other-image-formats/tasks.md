# Tasks

## 1. Dependencies and types

- [x] 1.1 Install `heic-decode`, `bmp-ts` and `decode-ico`; add `src/types/heic-decode.d.ts`; verify `npm run check` passes and the start-up test still shows `--help` loads none of them

## 2. Decoding

- [x] 2.1 Add `src/convert/decode.ts` with `openImage` as in design.md: core formats as before, HEIC through a dynamic `heic-decode` import (primary image, raw RGBA, `console.log` silenced while decoding and restored in `finally`), BMP through `bmp-ts` with unused alpha made opaque, ICO through `decode-ico` picking the largest entry, SVG from an in-memory buffer at the density from `svgDensity`, returning the image with its decoded width and height (used by the "is too large" message instead of re-opening the file), and every library error except `UserError` turned into `damagedFile(error)`
- [x] 2.2 Add `svgDensity` (own size only when the root tag has both `width` and `height` in plain numbers or px, natural size from `metadata()`, `--width`/`--height` (smaller scale when both)/`--dpi`/default 512-wide scale, densities over 100000 failing with "would be too large to draw at that size") and the exact-size correction after rendering (`resize({ width })`, `resize({ height })`, or `resize(width, height, { fit: "inside" })` when both); give `svgDpi` a maximum of 7200

## 3. Encoding

- [x] 3.1 Add `src/convert/ico.ts` with `writeIco` (ICONDIR, 16-byte entries with 256 written as 0, PNG data; sizes sorted and de-duplicated)
- [x] 3.2 Update `src/convert/image.ts`: use `openImage`, remove the "can't be converted yet" check, add BMP output (flatten onto `--background`, raw RGB to ABGR, 24-bit `bmp-ts` encode) and ICO output (each `--sizes` size as a transparent-padded square PNG, default from the declared option)
- [x] 3.3 Add the `{ sizeList: { min, max } }` rule to `OptionRule`, `followsRule` and `describeRule`, and declare it on `sizes` with 1 to 256
- [x] 3.4 Give every image `<from>to<to>` and `to<format>` mode `run: convertTo(to)`; remove the core-format gate (and `coreImageFormats` if unused); verify `npm run docs` leaves `README.md` unchanged

## 4. Tests

- [x] 4.1 Move `test/main.test.ts` cases that expected HEIC modes to be unbuilt to `movtomp4` (running an unbuilt mode, input mistakes first, dry run) and make "valid values pass" check that no option check fails; replace the feature 6 "can't be converted yet" test with a HEIC that converts; add `--sizes 0`, `257`, `abc` and `16,,32` rejection tests and a registry check for the `--sizes` rule
- [x] 4.2 Add `test/other-formats.test.ts` through `main`:
  - HEIC:
    - a 0-byte `.heic` fails with "is empty",
    - `iphone.heic` with `heictojpg` gives a 48 × 64 JPG with blue top-left and red top-right,
    - it converts to all eight output formats,
    - `burst.heic` gives one 80 × 40 PNG,
    - a folder of 20 HEICs all convert,
    - a mixed HEIC, PNG and WebP folder converts with `tojpg`.
  - BMP:
    - a 1 × 1 BMP to PNG and back keeps colour and size,
    - a WebP with `tobmp` keeps its size,
    - a transparent PNG to BMP is white.
  - ICO:
    - `pngtoico` holds 16, 32 and 48 by default,
    - `--sizes 16,32,64,128,256` holds all five,
    - `--sizes 256` works,
    - a 60 × 30 PNG at 32 is centred with transparent padding,
    - the ICO container structure is valid, with 256 recorded as 0 and PNG entries,
    - an ICO with 16, 32 and 48 converts to a 48 × 48 PNG,
    - an ICO whose entries are BMP-type also converts.
  - SVG:
    - an SVG at its own size,
    - `viewBox` only gives 512 × 256,
    - an empty SVG gives a blank 512-wide PNG,
    - `--width 2000` gives a 2000-wide PNG matching a direct sharp render at that density,
    - `--dpi 144` on an SVG with `width="100" height="50"` gives 200 × 100,
    - an SVG with only `width="100"` gives the 512-wide default,
    - `--width 300 --height 300` on a 120 × 80 SVG gives 300 × 200,
    - a huge `--width` on a tiny SVG fails with "would be too large to draw",
    - an SVG converts to all eight output formats,
    - transparent as PNG and white as JPG,
    - a linked PNG isn't loaded,
    - a SVG with no extension converts with `topng`.
  - `tobmp` and `toico` accept a JPG, a HEIC and an SVG, and both appear in `--list-modes`.
  - `pngtoheic`, `toheic`, `pngtosvg` and `tosvg` say HEIC and SVG are input only.
  - A truncated HEIC (with nothing from libheif on standard output), a broken BMP (keeping the `BM` signature but with a header that makes `bmp-ts` throw), a broken ICO and broken SVG markup each fail with "looks damaged".
  - The scenario: `heictojpg ./iphone -o ./jpgs`, then `svgtopng` and `svgtoico -o favicon` on a logo.

  Verify the tests pass.

## 5. Decisions and final checks

- [x] 5.1 Add feature 7 entries to `Decisions.md`: BMP written as 24-bit with transparency filled by `--background`; SVG read from memory so linked files can't load; `--width`/`--height` on SVG set the render size now, with a one-pixel exact-size correction until feature 9; the burst fixture's main image is its first image because ImageIO always marks the first as primary; the "opens in a browser and in Windows" test is checked as a valid standard ICO container with PNG entries (the format browsers and Windows Vista onwards read), because no browser or Windows is available to the test suite; libheif's own console output is silenced
- [x] 5.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 5.3 Tick "7. Other image formats" in the `Features.md` progress list
