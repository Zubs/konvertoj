# Proposal

## Why

konvertoj can find files, name outputs, run batches and recognise formats, but it still converts nothing: every mode says "isn't available yet." Converting between the six everyday image formats (JPG, PNG, WebP, AVIF, GIF and TIFF) is the core of the tool and the base for every later image feature. Resize, compress, crop, metadata and PDF all reuse its decode and encode steps.

## What Changes

- **Real conversions** with `sharp` for every `<from>to<to>` mode where both formats are among JPG, PNG, WebP, AVIF, GIF and TIFF (30 modes), and for `tojpg`, `topng`, `towebp`, `toavif` and `totiff` when the input is one of those six. Each file's detected format (feature 5) picks how it is read.
- **Options:**
  - `--quality 1–100`, with each format's default (80 for JPG and WebP, 50 for AVIF). TIFF is saved lossless by default, and `--quality` makes a smaller, JPEG-compressed TIFF.
  - `--background <colour>`, used where transparency is lost (JPG, and TIFF with `--quality`), default white,
  - `--lossless` for WebP and AVIF,
  - `--progressive` for JPG,
  - `--grayscale`.
- **Colours** are accepted as names (`white`), hex (`#ff8800`, `#f80`) or `rgb(…)`. A colour that isn't one of these is rejected before any file is touched, naming the option and the value.
- **Animation:** an animated GIF or WebP stays animated, with the same frames, when the target is GIF or WebP. For other targets the first frame is used, and a note says so.
- **Upright and sRGB:** images are turned upright using their orientation tag, and colours are converted to sRGB.
- **Errors:**
  - an image over sharp's pixel limit fails with "is too large", giving its size,
  - a file whose header looked right but can't be decoded fails with "looks damaged" (the feature 5 message),
  - neither ever crashes.
- **Notes:** a mode can add a short visible note to a file's result, e.g. "only the first frame was kept, because JPG can't be animated". It is printed unless `--quiet` is given.
- **Feature 5's deferred tests** are completed here for the six core formats: a PNG renamed to `.heic` converts with `tojpg`, a truncated or corrupt image fails with "looks damaged", and a mixed folder of PNG and WebP files converts with `tojpg`. HEIC in that folder waits for feature 7.
- **Not yet:** `--width`, `--height` and `--fit` are declared for these modes, but they are built in feature 9. Until then they are accepted but have no effect. Inputs in HEIC, SVG, BMP and ICO are feature 7. Their `<from>to<to>` modes stay "isn't available yet", and `to<format>` modes report them as "can't be converted yet".
- Tick "6. Core image conversion" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `image-conversion`: Converting images between formats: which conversions exist, quality, background, lossless, progressive and grayscale, animation, orientation, colour space, and the "too large" and "looks damaged" failures.

### Modified Capabilities

- `command-line`: "Option values are checked" now covers colour values, and its pass-through example moves to an option that is still unchecked.
- `mode-registry`: "Option value rules" now covers colour options, which declare a colour rule.
- `run-reporting`: "A line per file" gains notes, which are printed with a file's result.

## Impact

- New dependency: `sharp` (listed in the CLAUDE.md tech stack). Its prebuilt binaries install on Windows, macOS and Linux.
- New source:
  - `src/convert/image.ts`: decoding, encoding and the error mapping, loaded only when an image mode runs.
  - `src/modes/colours.ts`: the colour check used by the option rules.
- Changed source:
  - `src/modes/registry.ts`: core conversion modes get a lazy `run`, and TIFF's quality loses its default.
  - `src/modes/options.ts`: a colour rule for `--background`.
  - `src/runner.ts` and `src/report.ts`: notes.
  - `src/modes/formats.ts`: the default qualities move here, so the registry and the converter share them.
- `npm run docs` is run after the registry changes. The README's mode table doesn't show option defaults, so it isn't expected to change.
- `Decisions.md` gains entries for TIFF quality and for the visible notes.
