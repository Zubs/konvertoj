# Design

## Context

After feature 5, the runner checks each input's real format and hands it to a mode's `run` as `input.format`, but no registry mode has a `run`. The registry already declares the conversion modes and their options: `--quality` with per-format defaults, `--background`, `--grayscale`, `--width`, `--height` and `--fit` for all, `--lossless` for WebP and AVIF, `--progressive` for JPG, and `--sizes` for ICO. `--background` has no rule yet, and the command-line spec says colours are checked by this feature. The reporter prints one line per file. See proposal.md for why, and the specs for the behaviour.

## Goals / Non-Goals

**Goals:**
- One image converter (`src/convert/image.ts`) that later features extend: HEIC, SVG, BMP and ICO in 7, metadata in 8, resizing in 9, and the tools after that.
- `sharp` loaded only when an image mode actually runs, so `--help` stays instant.
- Every failure a plain-English reason.

**Non-Goals:**
- `--width`, `--height` and `--fit` (feature 9), metadata (feature 8, so for now sharp's default applies and metadata is not copied), and HEIC, SVG, BMP and ICO (feature 7).
- `togif`, which is feature 17, even for image inputs.

## Decisions

### Lazy `run` in the registry
`src/modes/registry.ts` gets a helper:
```ts
function convertTo(target: string): Mode["run"] {
  return async (context) => (await import("../convert/image.js")).convertImage(context, target);
}
```
It is set on each `<from>to<to>` mode where both formats are in `coreImageFormats = ["jpg", "png", "webp", "avif", "gif", "tiff"]` (exported from `formats.ts`), and on `to<format>` modes whose target is core. The registry stays the single place that says which modes run. The dynamic `import()` keeps `sharp` out of start-up. The start-up import test already fails if `--help` loads anything outside `dist/` and Node.js built-ins.

### Shared default qualities
`defaultQualities = { jpg: 80, webp: 80, avif: 50 }` moves to `src/modes/formats.ts`. The registry builds the `--quality` defaults from it, and the converter uses it when `--quality` isn't given. TIFF gets `--quality` with no default (see the TIFF section).

### Converting (`convertImage(context, target)`)
For the single input of the item:
1. **Read.** If `input.format` isn't a core format → `UserError("can't be converted yet.")`. This is a short-lived message, removed in feature 7.
2. **Open:**
   ```ts
   sharp(input.path, {
     animated: animatable(target) && (format === "gif" || format === "webp"),
     autoOrient: true,
   })
   ```
   `animatable` is GIF and WebP. Without `animated`, sharp reads only the first frame. The converter reads `metadata()` first. When `pages > 1`:
   - an animated GIF or WebP whose target can't animate gets `context.note("only the first frame was kept, because <Label> can't be animated")`,
   - any other input with several pages (a multi-page TIFF) gets `context.note("only the first page was kept")`, whatever the target, because only GIF and WebP inputs are read as animations.
3. **Pipeline:**
   - `.grayscale()` when `--grayscale` is set.
   - `.flatten({ background })` when the target can't hold transparency: JPG, and TIFF with `--quality`.

   `options` holds only what the user typed (`parseArgs` values), so the converter falls back to each option's declared default: `options.background ?? background.defaultValue`, importing the `background` option definition from `src/modes/options.ts`, and `defaultQualities` for quality. Defaults stay declared once, in the registry's option definitions.
4. **Encode:**
   - JPG: `.jpeg({ quality, progressive })`.
   - PNG: `.png()`.
   - WebP: `.webp({ quality, lossless })`.
   - AVIF: `.avif({ quality, lossless })`.
   - GIF: `.gif()`.
   - TIFF: `.tiff({ compression: "lzw" })` by default, or `.tiff({ compression: "jpeg", quality })` when `--quality` is given.
5. **Write:** `const buffer = await pipeline.toBuffer()`, then `context.save((temporaryPath) => writeFile(temporaryPath, buffer))` using `node:fs/promises`. Encoding to a buffer keeps every sharp error inside decoding and encoding. Writing with Node.js means a full disk or a permissions problem gives a normal file-system error with a `code`, never a libvips error that would be mistaken for a damaged input.

sharp's defaults already give sRGB output: without `keepMetadata`/`withMetadata`, it converts using any embedded profile and strips metadata. Feature 8 changes the metadata part.

### TIFF quality
A TIFF is usually a lossless scan or archive copy, so silently making it lossy at quality 80 would surprise users. TIFF is LZW-compressed (lossless, keeps transparency) unless `--quality` is given, and then it is JPEG-compressed at that quality, flattened onto `--background`. The registry's TIFF `--quality` therefore has no default. This goes into `Decisions.md`.

### Errors from sharp
`convertImage` wraps the whole sharp work (metadata, pipeline and write) in one `try`:
- **Pixel limit:** the message matches `/pixel limit/i`. The result is `UserError("is too large to convert (W × H pixels). konvertoj can convert images of up to 268 million pixels.")`, with W and H from `metadata()`, which reads only the header and succeeds for oversized images. The limit is sharp's default `limitInputPixels` (16383 × 16383 ≈ 268 million).
- **Already a `UserError`**, or an error from `save`'s file-system work (anything with a Node.js `code` such as `ENOSPC`): rethrown as it is. Because files are written by `writeFile`, every write problem has such a code.
- **Anything else from sharp:** `damagedFile()`.

### Colours (`src/modes/colours.ts`)
`isColour(value)` accepts:
- `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa` hex,
- `rgb(r, g, b)` and `rgba(r, g, b, a)`, with 0–255 values and spaces allowed,
- the 148 CSS colour names, in any case.

`transparent` is deliberately not accepted: flattening onto it gives black, which would surprise a user, and `rotate` already uses transparent corners when `--background` isn't given.

These are exactly the forms sharp's colour parser accepts that users need. Writing the check ourselves keeps it synchronous and free of sharp at option-check time, without depending on sharp's private colour package.

`OptionRule` gains a third form, `{ colour: true }`:
- `followsRule` calls `isColour`,
- `describeRule` returns "a colour such as white, #ff8800 or rgb(255,136,0)",
- `background` and `rotateBackground` declare it.

The existing message is then "--background must be a colour such as white, #ff8800 or rgb(255,136,0). You gave banana." Help text shows colour options as before, because only word lists and ranges are printed as limits.

### Notes
- `RunContext` gains `note(message)`. The runner collects a file's notes and passes them to `reporter.succeeded(item, before, after, notes)`.
- The reporter prints each note as `  Note: <message>` on standard output, after the `✓` line, unless quiet.
- Notes on failed or skipped files aren't needed yet.

Later features use notes for "--no-enlarge kept the size", "no border found" and "metadata dropped".

### Tests
All test images are made by `sharp` in the tests (`sharp({ create })`, raw buffers with `pageHeight` for animations, `withIccProfile("p3")`, `withMetadata({ orientation: 6 })`). A PNG header with a 20000 × 20000 IHDR and a tiny IDAT stands in for the huge image, so no huge buffer is made. Truncated files are real images cut in half. Conversions run through `main` with real files in temporary folders, checking outputs with `sharp(...).metadata()` and `.raw()` pixels. Details that matter:
- the grayscale check reads pixels with `.toColourspace("srgb").raw()`, because sharp writes a one-channel JPG after `.grayscale()`,
- the lossless WebP check uses an opaque source, because colour values under fully transparent pixels may change,
- the truncated helper keeps the first half of a real, detailed image, well past the header, so `file-type` still detects the format and the failure comes from decoding,
- the sRGB check makes a PNG with a Display P3 profile and a known saturated colour, then checks the JPG has no embedded ICC profile and that the pixel matches sharp's own sRGB conversion of that colour, within a small tolerance, and differs from the raw P3 values.

`test/main.test.ts` cases that expect "isn't available yet" for core modes move to modes that still aren't built.

## Risks / Trade-offs

- [AVIF encoding is slow for big images] → Tests use tiny images. Real users get sharp's default effort.
- [Notes collected per file in memory] → They are a few short strings per file.
- [Accepting `--width`/`--height`/`--fit` before feature 9 with no effect] → This is a temporary state on the way to v1.0.0, which is only released once every feature is done.
