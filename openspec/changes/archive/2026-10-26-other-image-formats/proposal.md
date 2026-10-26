# Proposal

## Why

Feature 6 converts between the six core formats, but the formats people most often struggle with are still missing: iPhone photos (HEIC), logos (SVG), old Windows bitmaps (BMP) and favicons (ICO). `sharp`'s prebuilt binaries can't read HEIC, BMP or ICO, or write BMP or ICO, so each needs its own small bridge to raw pixels. With this feature, every image mode in the registry works.

## What Changes

- **HEIC input:** `heic-decode` (libheif in WebAssembly) decodes the main image to raw pixels, which go to `sharp`.
  - libheif applies the photo's rotation, so it comes out upright.
  - A file with several images (a burst or Live Photo) gives its main image only.
  - HEIC stays input only.
- **BMP input and output:** `bmp-ts` reads and writes BMP as raw pixels to and from `sharp`.
  - BMP is written as 24-bit, so transparency is filled with `--background` (white by default), as for JPG.
  - BMPs without a real alpha channel are read as opaque.
- **ICO input and output:**
  - `decode-ico` reads an ICO, and its largest image is used.
  - konvertoj's own small ICO writer packs PNG images into the ICO container.
  - `--sizes` (default `16,32,48`) chooses the sizes. Each is a square from 1 to 256 pixels, resized from the source with transparent padding, so a non-square image is never stretched.
- **SVG input:**
  - rendered by `sharp` from the file's contents in memory, so links to external files or URLs inside the SVG are never loaded,
  - the output size is the SVG's own size, or 512 pixels wide when the SVG has no `width` and `height`,
  - `--width`, `--height` or `--dpi` choose the size by rendering at a higher resolution, so a large output stays sharp,
  - transparency is kept for PNG, WebP, AVIF, GIF and ICO, and filled with `--background` for JPG and BMP,
  - SVG stays input only.
- **Every image mode now runs.** All `<from>to<to>` image modes and every `to<format>` image mode have a converter. Feature 6's "can't be converted yet" message is removed.
- **`--sizes` is checked before any work:** a comma-separated list of whole numbers from 1 to 256, so `0`, `257` and `abc` are rejected.
- **Damaged files:** a damaged HEIC, BMP, ICO or SVG fails with "looks damaged", like the core formats.
- Feature 5's deferred HEIC case (a mixed folder of HEIC, PNG and WebP converting with `tojpg`) is completed.
- Tick "7. Other image formats" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `image-conversion`:
  - gains requirements for HEIC, BMP, ICO and SVG,
  - "Core format conversions" becomes every image conversion,
  - the temporary "Formats still to come" requirement is removed.
- `command-line`:
  - "Option values are checked" and "Modes not built yet" use examples that are still unbuilt, because HEIC conversion now exists,
  - `--sizes` values are checked.
- `mode-registry`: "Option value rules" covers `--sizes` lists.

## Impact

- New dependencies, all listed in the CLAUDE.md tech stack: `heic-decode`, `bmp-ts` and `decode-ico`. `heic-decode` ships no TypeScript types, so konvertoj adds a small declaration file for it.
- New source:
  - `src/convert/decode.ts`: opening any image format as a `sharp` pipeline,
  - `src/convert/ico.ts`: the ICO writer,
  - `src/types/heic-decode.d.ts`: the declaration file.
- Changed source:
  - `src/convert/image.ts`: BMP and ICO output, SVG sizing, and the removal of the "can't be converted yet" check,
  - `src/modes/registry.ts`: every image mode runs,
  - `src/modes/options.ts`: the `--sizes` rule.
- The HEIC decoder (WebAssembly) is loaded only for HEIC files, so start-up stays fast.
