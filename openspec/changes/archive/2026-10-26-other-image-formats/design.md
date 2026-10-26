# Design

## Context

Feature 6 added `convertImage(context, target)` in `src/convert/image.ts`. It opens core formats with `sharp(path, { animated, autoOrient })`, applies grayscale and flatten, encodes to a buffer and writes it with `writeFile` through `context.save`. Non-core inputs throw "can't be converted yet." The registry gives a lazy `run` only to core pairs and core `to<format>` modes. The registry already declares `--sizes` (default `16,32,48`, no rule) for ICO targets, and `--dpi` (a number of 1 or more, no default) for modes accepting SVG. Probing the libraries showed:
- `heic-decode` returns the primary image as RGBA with libheif's rotation already applied (the fixture comes out 48 × 64), and has no TypeScript types,
- `bmp-ts` decodes to RGBA with `toRGBA: true`, gives alpha 0 for 24-bit files, and encodes from ABGR byte order,
- `decode-ico` returns each entry as PNG bytes or RGBA,
- `sharp` loads images an SVG links to when given the SVG's *path*, but not when given its contents as a buffer.

## Goals / Non-Goals

**Goals:**
- One function that opens any supported input as a `sharp` pipeline, so features 8 to 13 never care where pixels came from.
- No HEIC WebAssembly, BMP or ICO code loaded unless such a file is processed.

**Non-Goals:**
- Metadata (feature 8, including HEIC EXIF through `exifr`).
- `--width`/`--height`/`--fit` resizing of non-SVG images (feature 9). For SVG they choose the render size here, because an SVG has no fixed pixel size.
- Animated output from HEIC sequences.

## Decisions

### Opening any input (`src/convert/decode.ts`)
`openImage(input, options, animated)` returns `Promise<{ image: Sharp; width: number; height: number }>`. The width and height are the decoded pixel size (from the raw pixels for HEIC, BMP and ICO, from `metadata()` with `limitInputPixels: false` for core formats, and the render size for SVG), so the "is too large" message in `image.ts` uses them and never re-opens the file with sharp, which can't read HEIC, BMP or ICO. Every library error is turned into `damagedFile(error)` here, apart from `UserError`s:
- **Core formats:** `sharp(input.path, { animated, autoOrient: true })`, as in feature 6.
- **HEIC:**
  - `const { default: decode } = await import("heic-decode")`,
  - `decode({ buffer: await readFile(path) })` gives the primary image only,
  - libheif-js prints "Could not parse HEIF file" with `console.log` before it throws on a damaged file. `console.log` is replaced with a no-op while `decode` runs and restored in `finally`, so nothing technical reaches standard output (konvertoj itself writes through `process.stdout.write`, which is unaffected),
  - then `sharp(Buffer.from(data.buffer), { raw: { width, height, channels: 4 } })`.
  - Dynamic import keeps the WebAssembly out of every other run.
- **BMP:**
  - `decode(buffer)` from `bmp-ts`, whose pixels are ABGR at every bit depth, re-ordered to RGBA by konvertoj (`toRGBA: true` mis-orders palette BMPs),
  - if every alpha byte is 0, alpha is set to 255 (24-bit files and 32-bit files with an unused alpha channel),
  - then raw `sharp`.
- **ICO:**
  - `decodeIco(buffer)`, picking the entry with the largest `width × height`, ties broken by the higher `bpp`,
  - a `png` entry goes to `sharp(entry.data)`, a `bmp` entry to raw `sharp` with 4 channels,
  - an ICO with no entries → `damagedFile()`.
- **SVG:**
  - the contents are read with `readFile` and passed to `sharp(buffer, { density })` as a buffer, so the renderer has no base path and loads no linked files,
  - the size comes from `svgDensity` below.

`autoOrient` only matters for formats that carry an orientation tag. HEIC pixels from libheif are already upright, and BMP, ICO and SVG have no tag.

### SVG size (`svgDensity`)
1. Read the root `<svg …>` start tag with a regular expression.
2. Take its `width` and `height` attributes: numbers with no unit or with px, pt, pc, mm, cm, in, em or ex (percentages don't count). The SVG "has its own size" only when it has both. librsvg gives an SVG with just one of them and no `viewBox` a natural size of 1 × 1, so a single attribute isn't trusted.
3. Get the SVG's natural size at 72 dpi from `sharp(buffer).metadata()`. With no `width` and `height`, librsvg uses the `viewBox` or 100 × 100.
4. Pick the scale:
   - `--width` → `width / naturalWidth`,
   - `--height` → `height / naturalHeight`,
   - both → the smaller of the two,
   - `--dpi` → `dpi / 72`,
   - otherwise 1. An SVG without both `width` and `height` is first given `width="512"` and a height from its `viewBox`'s shape (512 when there is no `viewBox`) in its root tag, in memory, before it is measured. librsvg can't size an SVG with neither a full size nor a `viewBox` ("bad dimensions"), so setting the size in the markup is the one approach that works for every such SVG.
5. Render with `density = 72 × scale`. sharp accepts densities up to 100000. A larger density (a huge `--width` on a tiny SVG) fails with `UserError("would be too large to draw at that size. Choose a smaller --width, --height or --dpi.")`. `--dpi` itself is limited to 1–7200 by its rule.

Rounding can leave the result one pixel off a requested `--width`. When `--width` or `--height` is given, a final resize removes that difference: `resize({ width })` or `resize({ height })` keeping the shape when one is given, and `resize(width, height, { fit: "inside" })` when both are. This is a one-pixel correction, not an enlargement, so the render stays sharp. A real resize step for every format arrives in feature 9, which will replace this correction.

### Outputs (`src/convert/image.ts`)
- **The "can't be converted yet" check is removed.**
- **BMP:**
  - flattened onto `--background` (now also in `losesTransparency`),
  - `.raw()` RGB from sharp, re-packed as ABGR,
  - `encode({ width, height, data, bitPP: 24 })` from `bmp-ts`, whose `.data` is the file.
- **ICO:**
  - for each size in `--sizes` (default from the option's declared default), the pipeline is `.clone().resize(size, size, { fit: "contain", background: transparent }).png().toBuffer()`,
  - those PNGs go to `writeIco` in `src/convert/ico.ts`.
- Animation and notes are unchanged. HEIC, BMP, ICO and SVG inputs are never animated.

### ICO writer (`src/convert/ico.ts`)
`writeIco(images: { size: number; png: Buffer }[]): Buffer` builds:
- a 6-byte `ICONDIR` (reserved 0, type 1, count),
- one 16-byte `ICONDIRENTRY` per image:
  - width and height as a byte, where 256 is written as 0,
  - colour count 0, reserved 0, planes 1, 32 bits per pixel,
  - the data size, and the data offset,
- the PNG data, in order.

Sizes are sorted and de-duplicated before writing. PNG entries in ICO files are supported by every browser and by Windows Vista and later.

### `--sizes` rule
`OptionRule` gains `{ sizeList: { min: 1, max: 256 } }`:
- `followsRule` accepts `^\d+(,\d+)*$` with each number within range,
- `describeRule` gives "whole numbers from 1 to 256 separated by commas".

The `sizes` option declares it, and the declared default `16,32,48` passes it.

### Registry
Every image `<from>to<to>` mode and every image `to<format>` mode gets `run: convertTo(to)`. The `coreImageFormats` gate on `run` goes. `coreImageFormats` stays only if something still uses it; otherwise it is removed.

### Types for `heic-decode`
`src/types/heic-decode.d.ts` declares `module "heic-decode"` with a default `decode(options: { buffer: Uint8Array }): Promise<{ width: number; height: number; data: Uint8ClampedArray }>`. `tsc` includes it through `src`, and it emits nothing.

### Tests
- **Fixtures:** `iphone.heic` and `burst.heic` already exist (feature 5). ImageIO always records the first image as the primary one, so in `burst.heic` the main 80 × 40 image is first and a 32 × 32 image follows. The test checks that exactly one output of the main image's size is written. Every other test image is made in the tests:
  - BMPs with `bmp-ts`,
  - ICOs with konvertoj's own writer and with a hand-built BMP-entry ICO,
  - SVGs as text.
- **iPhone photo check:** the fixture's quadrants are red (top-left), green, blue and yellow before rotation, so the upright 48 × 64 JPG has blue at its top-left and red at its top-right. The check uses pixel colour within a tolerance.
- **Twenty photos:** 20 copies of `iphone.heic` in a folder.
- **Damaged files:**
  - a HEIC cut to half its length,
  - a BMP with a corrupted header after the `BM` signature,
  - an ICO whose directory points past the end of the file,
  - `<svg xmlns="http://www.w3.org/2000/svg"><rect` (unfinished markup).
- **Existing tests:** tests in `test/main.test.ts` that relied on HEIC modes being unbuilt move to `movtomp4`, following the command-line spec delta.

## Risks / Trade-offs

- [The HEIC WebAssembly is large and slow to start the first time in each process] → It is loaded only for HEIC files, and once per run.
- [Decoding many big HEICs at once uses memory] → The runner already processes at most four files at once.
- [SVG with CSS units other than px (mm, in, %)] → Those fall back to librsvg's own size at 72 dpi, which already converts units, and the 512-pixel default applies unless the tag has both `width` and `height`.
