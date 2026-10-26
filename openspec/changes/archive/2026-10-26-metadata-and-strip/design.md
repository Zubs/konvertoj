# Design

## Context

`convertImage` (features 6 and 7) opens any input through `openImage`, applies grayscale and flatten, encodes to a buffer and writes it. sharp's default drops all metadata and converts colours to sRGB. `--strip-metadata` is already a common option, but nothing reads it. `strip` is registered (inputs JPG, PNG, WebP, AVIF and TIFF, output the same format, suffix `stripped`, no options) without a `run`. Probing sharp 0.35.5 showed:
- `keepExif()` and `keepXmp()` carry EXIF and XMP into JPG, PNG, WebP and AVIF, and sharp resets the orientation to 1 after `autoOrient`,
- TIFF output can't hold EXIF ("EXIF metadata is unsupported for TIFF output"), but does keep XMP,
- `withIccProfile("srgb")` converts to sRGB and attaches the sRGB profile,
- a corrupted EXIF block is copied through silently, without an error,
- `exifr` reads the HEIC fixture's details with `reviveValues: false`, giving EXIF-style strings such as `2026:07:14 10:30:00`, and reads sharp's EXIF buffers once their 6-byte `Exif\0\0` prefix is removed.

## Goals / Non-Goals

**Goals:**
- One place (`src/convert/metadata.ts`) that decides what details an output gets, reused by every later image tool (resize, compress, crop, PDF).
- `strip` never makes a JPG worse just to remove its details.

**Non-Goals:**
- Showing details (feature 12, `info`).
- Writing details into BMP, GIF or ICO, which can't hold them.
- IPTC copying, which sharp doesn't offer. IPTC is dropped like other unsupported details.

## Decisions

### Reading what an input has (`readDetails`)
`readDetails(input, opened)` returns `{ present: boolean; hasExif: boolean; damaged: boolean; heicExif?: Exif }`:
- **Core formats:** `sharp(path).metadata()` gives the `exif`, `xmp` and `iptc` buffers.
  - `present` is true when any of them exists.
  - An `exif` buffer is checked with `exifr.parse(exif without the "Exif\0\0" prefix)`. exifr reports partly broken blocks by returning `{ errors: [...] }` instead of throwing, so the EXIF counts as damaged when the call throws, returns `undefined`, has an `errors` field, or has no keys other than `errors`.
  - The `metadata()` result that `openImage` already read for core formats is reused (it is returned from `openCore`), so the file's metadata isn't read twice.
  - `readDetails` isn't called at all when details are being stripped.
- **HEIC:** `exifr.parse(path, { tiff: true, exif: true, gps: true, reviveValues: false, translateValues: false })`.
  - The fields become a sharp `Exif` object:
    - `IFD0`: `Make`, `Model`, and `Orientation: "1"`,
    - `IFD2`: `DateTimeOriginal` and `LensModel`,
    - `IFD3`: `GPSLatitudeRef`, `GPSLatitude`, `GPSLongitudeRef` and `GPSLongitude`. Each of the degree, minute and second values is written as a rational with a 10000 denominator (`Math.round(v * 10000)/10000`), e.g. `"510000/10000 300000/10000 25200/10000"`, so fractional minutes survive.
  - Fields that are missing are left out. `undefined` (as for `burst.heic`) means no details. A thrown error or an `errors` field means damaged.
- **BMP, ICO, SVG:** nothing (`present: false`).

`exifr` is imported dynamically inside `readDetails`, so it loads only during image conversions.

### Applying details (in `convertImage`, before encoding)
| Case | Pipeline |
|---|---|
| `--strip-metadata`, or the `strip` tool | `.withIccProfile("srgb")` only |
| damaged EXIF | `.withIccProfile("srgb")`, plus `.keepXmp()` for a core input. Note: "the photo's details looked damaged, so they were left out" |
| HEIC with details | `.withIccProfile("srgb").withExif(heicExif)` |
| core input | `.withIccProfile("srgb").keepExif().keepXmp()` |

- For BMP and ICO targets nothing is attached, because the pixels are re-packed by konvertoj. GIF ignores profiles.
- When `present` and the target is BMP, GIF or ICO: `context.detail("<file>'s camera, date and location details were dropped, because <Label> can't hold them")`.
- For TIFF the same detail names "camera, date and location details", shown only when the input had EXIF (`hasExif`), while XMP and the profile are kept.

`detail` is the existing verbose-only channel, so these notes appear only with `--verbose`. The damaged-details warning uses `note`, so it is visible.

### The `strip` tool
`strip`'s `run` calls `stripDetails(context)` in `src/convert/metadata.ts`:
- **Upright JPG** (`metadata().orientation` is 1 or missing) → `removeJpegDetails(buffer)`, written through `context.save` like every other output, so the temporary-file and `--overwrite` rules still apply:
  - check SOI (`FFD8`), then walk the markers:
    - skip `0xFF` fill bytes before a marker code,
    - TEM (`01`) and RST0–7 (`D0`–`D7`) have no length,
    - every other segment's two-byte length is checked against the buffer, and one that doesn't fit throws `damagedFile()`,
  - drop APP1 (EXIF and XMP), APP13 (IPTC), COM, and every APP2 that isn't an `ICC_PROFILE` block (this includes MPF),
  - keep everything else (APP0, the ICC APP2 blocks, quantisation and Huffman tables, SOF, DRI),
  - after an SOS segment, copy the entropy-coded data byte for byte. Inside it, `FF00` and `FFD0`–`FFD7` belong to the scan, and any other `FFxx` is a marker. EOI (`FFD9`) ends the image. Other markers (the DHT and SOS between progressive scans) go through the same segment rules,
  - stop at EOI and discard anything after it: secondary images an MPF block pointed to (gain or depth maps with their own EXIF and GPS), motion-photo videos and vendor trailers. Leaving them would leak the location data `strip` is meant to remove.

  The picture data is untouched, so pixels match exactly.
- **Everything else** → `convertImage(context, input.format)` with `strip-metadata` forced on. PNG and TIFF re-encode losslessly, JPG and AVIF at the format's default quality, after turning upright. A WebP is re-encoded losslessly when it is lossless, and otherwise at the default quality, so `strip` never makes a lossless WebP lossy. `isLosslessWebp(buffer)` does one RIFF chunk walk over the whole file: each chunk is a four-byte name, a little-endian length and its data, padded to an even length. The file counts as lossless when a top-level chunk is `VP8L`, or when an `ANMF` frame (whose own chunks start 16 bytes into its data) contains one.
- A malformed JPEG marker structure throws `damagedFile()`.

### Feature 6 test update
The wide-gamut test now expects the JPG's `metadata().icc` buffer to contain the bytes "sRGB", still with converted pixels.

### Tests (`test/metadata.test.ts`)
- Test photos come from sharp: `withExif({ IFD0: { Make: "Canon", Model: "EOS R5" }, IFD2: { DateTimeOriginal: "2025:05:01 12:00:00" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "0/1 7/1 0/1" } })`, and `withMetadata({ orientation: 6 })` for the sideways one.
- Details are read back with a helper: `sharp(file).metadata().exif`, minus the 6-byte prefix when present, through `exifr.parse(…, { gps: true, reviveValues: false })`. This works for every output format, including WebP, which `exifr` can't open as a file.
- A corrupted EXIF block: the bytes after `Exif\0\0` in a test JPG are overwritten with `0xAB`, and a second case corrupts only part of the block, so exifr returns its `errors` result.
- A JPG with a trailer: a small JPG with GPS details is appended after a test JPG's EOI. `strip` must remove it, so the output is exactly the stripped first image.
- The iPhone fixture is checked for Apple, iPhone 15 Pro, `2026:07:14 10:30:00`, and a GPS latitude reference of N and longitude reference of W, with degrees 51 and 0.

## Risks / Trade-offs

- [EXIF that exifr can't read cleanly (it throws, finds nothing, or reports errors) is left out] → The user is told in a visible note. A block exifr can't read is unlikely to be read correctly by other apps either.
- [`strip` re-encodes lossy WebP and AVIF] → Their default quality applies, while lossless WebP stays lossless. Lossless JPG stripping covers the common case of phone photos shared online.
- [TIFF loses camera details] → This is a sharp limitation. It is recorded in Decisions.md and noted with `--verbose`.
