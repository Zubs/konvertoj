# Tasks

## 1. Reading and writing details

- [x] 1.1 Install `exifr`; verify the start-up test still shows `--help` doesn't load it
- [x] 1.2 Add `src/convert/metadata.ts` with `readDetails` as in design.md (core formats through the `metadata()` result `openImage` already read, with the EXIF checked by a dynamically imported `exifr` and counted damaged when it throws, returns `undefined`, or returns `errors`; HEIC through `exifr` with `reviveValues: false`, turned into a sharp `Exif` object with orientation 1 and all three GPS parts as /10000 rationals, `undefined` meaning no details; BMP, ICO and SVG with nothing)
- [x] 1.3 Update `convertImage` to apply details per the table in design.md (strip, damaged with its visible note, HEIC `withExif`, core `keepExif`/`keepXmp`, always `withIccProfile("srgb")` except for BMP and ICO), skip `readDetails` when stripping, and add the verbose dropped-details detail for BMP, GIF and ICO, and for camera details in TIFF only when the input had EXIF

## 2. strip tool

- [x] 2.1 Add `removeJpegDetails` (marker walk with fill bytes, length-less TEM/RST markers and checked lengths; dropping APP1, APP13, COM and non-ICC APP2; scanning entropy data for markers; stopping at EOI and discarding any trailer; `damagedFile()` on a broken structure) and `stripDetails`, which writes it through `context.save` for upright JPGs and otherwise calls `convertImage` with `strip-metadata` forced on, re-encoding lossless WebPs (a top-level `VP8L` chunk, or one inside an `ANMF` frame, found by one RIFF chunk walk) losslessly
- [x] 2.2 Give `strip` a lazy `run` in the registry; verify `npm run docs` leaves `README.md` unchanged

## 3. Tests

- [x] 3.1 Update the feature 6 wide-gamut test to expect an sRGB profile
- [x] 3.2 Add `test/metadata.test.ts` through `main`:
  - an image without details converts and gains none,
  - a JPG with camera, date and GPS keeps all three after `jpgtowebp`, and after `jpgtopng`, `jpgtoavif` and `pngtojpg`,
  - the HEIC fixture's camera, date and GPS appear in the JPG after `heictojpg`, with normal orientation,
  - `--strip-metadata` removes them for `jpgtopng` and `heictojpg`, keeping the sRGB profile,
  - `strip` on a JPG removes the details, keeps identical pixels and the JPG format, and writes `<name>-stripped.jpg`,
  - `strip` on an orientation-6 JPG gives an upright 40 × 60 JPG without an orientation tag,
  - `strip` on PNG, WebP, AVIF and TIFF keeps format and size and removes details,
  - JPG with details to BMP, GIF and ICO works, and `--verbose` says the details were dropped,
  - TIFF keeps XMP and says camera details were dropped with `--verbose`,
  - every Image, PDF and Tools mode accepts `--strip-metadata`,
  - a corrupted EXIF block, and a partly corrupted one, convert with a "looked damaged" note and no EXIF,
  - `strip` removes a JPG trailer with its own GPS, writing exactly the stripped first image,
  - `strip` on a lossless WebP keeps every pixel,
  - `strip ./holiday -o ./to-share` removes GPS from every copy and leaves the originals unchanged

  Verify the tests pass.

## 4. Decisions and final checks

- [x] 4.1 Add feature 8 entries to `Decisions.md`: TIFF can't hold camera details in sharp; outputs carry an sRGB profile; HEIC orientation written as normal; `strip` removes JPG detail blocks without re-compressing and discards anything after the JPG's end, re-encodes other formats, keeping lossless WebP lossless; EXIF that can't be parsed is left out with a visible warning; IPTC isn't copied
- [x] 4.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.3 Tick "8. Metadata and strip" in the `Features.md` progress list
