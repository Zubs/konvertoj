# Design

## Context

After feature 4, `runBatch` calls a mode's `run` for each planned item with the item's `InputFile`s, which only carry a path (plus `base` and `unreadable`). No registry mode has a `run` yet, so every real command still ends with "isn't available yet." The registry already lists each mode's accepted input formats, and `src/modes/formats.ts` already holds the format names, labels and extension aliases. See proposal.md for why, and the specs for the behaviour.

## Goals / Non-Goals

**Goals:**
- One place that answers "what is this file?" and "may this mode use it?", run by the runner before any mode's work, so every later mode gets checked inputs for free.
- Messages that tell the user which mode to use instead.
- Detection that loads only when files are actually processed, so `--help` stays instant.

**Non-Goals:**
- Converting anything. Converters arrive with features 6 and 7, and they use the detected format this change provides.
- Checking that a whole image decodes. Header detection can't see a truncated body. Decoder failures become "looks damaged" inside the converters (feature 6 on), using the shared message added here.
- Checking formats during `--dry-run`, which only plans names.

## Decisions

### Detection (`src/detect.ts`)
`detectFormat(file)` returns konvertoj's format name or `undefined`:
1. `stat` the file. Size 0 → `UserError("is empty. Check the file was saved or downloaded completely.")`.
2. `fileTypeFromFile(file)` from `file-type`. Its `ext` is mapped through a small table: `jpg`, `png`, `webp`, `avif`, `gif`, `bmp`, `ico`, `heic`, `pdf`, `mov`, `mkv`, `avi`, `webm`, `m4v` and `mp4` map to themselves, `tif` maps to `tiff`, and `apng` (an animated PNG, which `file-type` names separately) maps to `png`. Any other result means "not a format konvertoj knows". `file-type` already reports both HEIC and HEIF brands as `heic`, and iPhone `qt` brands as `mov`.
3. If `file-type` finds nothing, or only `xml`, the first 4 KB are read as UTF-8 and tested with one regular expression: an optional byte-order mark, then any mix of whitespace, `<?xml …?>`, `<!-- … -->` and `<!DOCTYPE …>`, then `<svg` followed by whitespace, `>` or `/`. A match is `svg`.
4. Otherwise, a `.svg` extension (any case) is `svg`. This is the only place the extension decides the format, because SVG is text and has no signature.
5. An error thrown by `file-type` while reading a file's contents (not an error opening it) becomes the shared "looks damaged" error.

`file-type` is imported statically by `detect.ts`, which only the runner imports, and the runner is already loaded with a dynamic `import()` after the inputs are known. So `--help` and `--list-modes` load neither.

### The shared "looks damaged" error (`src/errors.ts`)
`damagedFile()` returns `new UserError("looks damaged and can't be read. Try opening it in another app, or get a fresh copy.")`. Detection uses it now, and converters use it from feature 6 when a decoder rejects a file.

### Input checks (`checkItem` in `src/detect.ts`)
`checkItem(mode, item, options, cwd)` returns either `{ inputs }` (each `InputFile` with its `format` filled in) or `{ skipped: reason }`, and throws a `UserError` for a failed check. For each input, in order:
1. Detect the format. `undefined` → "isn't a file konvertoj can convert. Run konvertoj --list-modes to see the formats it works with."
2. If `mode.inputs` includes the format, the input passes.
3. Otherwise, for a mode with a fixed output (not `same` or `none`):
   - a file already in the output format → "is already a JPG, so there's nothing to convert."
   - else the replacement is `<format>to<output>` if it's a registry mode, else `to<output>` if that mode accepts the format → "looks like a PNG. Try: -m pngtojpg".
4. Otherwise (no replacement, or a tool keeping the input's format) the "wrong kind" message: "is an MP4, which topdf can't use. topdf works with any image. Modes for MP4 files: mp4tomp3, mp4towav, …". The list holds registry modes that accept the format, those named `<format>to…` first, at most six, followed by "and N more (run konvertoj --list-modes)" when longer. "Works with" uses the registry's existing `describeFormats`.

Messages use a short label: the registry label up to any bracket, so "HEIC (iPhone photo)" becomes "HEIC" and "ICO (icon)" becomes "ICO". Articles: "an" before short labels starting with A, E, I, O, M, S or X (an AVIF, an MP4, an SVG, an ICO), otherwise "a" (a PNG, a HEIC, a WebP).

**Combined items** (`mode.combinesInputs`): before step 3, if the item's inputs have more than one detected format, the mode isn't the `to<output>` one, and the `to<output>` mode accepts every detected format, the reason is "<file> is a PNG, but jpgtopdf only takes JPG. Try: -m topdf" for the first input that doesn't match. If `to<output>` can't take them all (a JPG and an MP4 for `jpgtopdf`), the offending file gets the normal steps 3 and 4, so `topdf` is never suggested for a file it can't use. Every reason for a combined item starts with that input's path relative to `cwd`, so the user knows which file stopped the PDF. Single-input items don't repeat the file name, because the report line already starts with it (`✗ holiday.heic: looks like a PNG. Try: -m pngtojpg`).

**Already the target**: after all inputs pass, a mode is a `to<format>` mode when `mode.name === "to" + mode.output`. If such a mode gets a single input already in its output format, and none of the mode's own options (the names in `mode.options`, e.g. `quality`, `background`, `width` for `tojpg`) nor `--strip-metadata` is set in `options`, the result is `{ skipped: "already a JPG" }`. `parseArgs` only puts given options into `values`, so "set" means "not `undefined`". `--strip-metadata` counts because removing details is a reason to rewrite a file (feature 8). No other common option counts: `--output`, `--overwrite`, `--recursive`, `--dry-run`, `--quiet` and `--verbose` don't change the file's contents, so a JPG given to `tojpg --overwrite` is still skipped.

The suggestions only consider the registry's `modes`, never test-only extra modes.

### Runner integration (`src/runner.ts`)
`runItem` calls `checkItem` after the unreadable check and after `reporter.started`, so verbose shows "Working on …" for every file that is checked. A thrown `UserError` is a failure with its message, as today. `{ skipped }` is a skip, through the existing skip path. The checked inputs replace `item.inputs` in the `RunContext`.

Checks run only for modes whose every input format is a known format (a key of `formatLabels`). Every registry mode qualifies, so for real modes the checks always run. The condition exists only for the test-only `copy` mode, whose input format is `txt` and whose test files are plain text, so the existing runner, main and launcher tests keep working unchanged instead of all being rewritten around image headers.

### `InputFile.format`
`InputFile` gains `format?: string`. `resolveInputs` never sets it; the runner does. Modes read `context.inputs[i].format` to pick a converter.

### Tests
- `test/support/samples.ts` writes minimal valid headers for each recognised format (PNG signature and IHDR, JPEG SOI, `GIF89a`, `RIFF…WEBPVP8 `, `BM`, ICO directory, `II*\0`, `ftyp` boxes for AVIF, HEIC, MOV, M4V and MP4, `%PDF-`, RIFF `AVI `, EBML headers for MKV and WebM). These are enough for content detection; real images arrive with `sharp` in feature 6.
- `test/fixtures/iphone.heic`: a real HEIC photo made on macOS with ImageIO (a camera-style HEIC with EXIF, used again in features 7 and 8), with the small Swift script that made it, `test/fixtures/make-fixtures.swift`, so it can be regenerated. It's the only fixture added here.
- `test/detect.test.ts` covers detection and `checkItem` directly. Runner tests use registry modes (`heictojpg`, `tojpg`, `jpgtopng`, `jpgtopdf`, `topdf`, `compress`) with a fake `run` that records each input's format and copies the file, so the whole flow is checked through `runBatch` without converters. An APNG sample checks animated PNGs are PNG. The "looks damaged" case mocks `file-type` to throw, because no small file makes `file-type` fail reliably.

### Decisions log
`Decisions.md` is added at the project root, linked from `Features.md`, listing each decision taken outside the Features.md plan with its reason. Its first entries: Features.md tests for feature 5 that need a real conversion are completed in features 6 and 7; and in a messy folder, files konvertoj can't use are reported as failed (with exit code `2`), not skipped, because the reporter and exit codes from feature 4 count a file konvertoj couldn't process as a failure, while "skipped" is kept for files that need no work.

## Risks / Trade-offs

- [Header-only detection passes truncated files] → Converters turn decoder errors into "looks damaged" from feature 6, with tests there.
- [The SVG check reads only 4 KB] → A file with more than 4 KB of comments before `<svg` falls back to its extension, which is enough for real-world SVGs.
- [`file-type` is pure ESM and needs Node.js 22's ESM loader] → konvertoj is already ESM on Node.js 22+.
