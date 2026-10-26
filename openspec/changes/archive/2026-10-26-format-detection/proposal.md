# Proposal

## Why

The batch runner can run a mode over every file, but nothing yet checks what each file really is. Every conversion from feature 6 on needs to know an input's true format: `to<format>` modes must pick the right converter for each file, and a `<from>to<to>` mode given the wrong kind of file must say which mode to use instead of failing with a decoder error. File names can't be trusted for this (a PNG saved as `.heic`, a `.jfif` from a browser, a `.JPG` from a camera), so the format has to come from the file's contents.

## What Changes

- **Format detection from contents.** `file-type` reads the first bytes of each input to find its format. Its results map onto konvertoj's format names (`jpg`, `png` (including animated PNG), `webp`, `avif`, `gif`, `tiff`, `bmp`, `ico`, `heic`, `pdf`, `mov`, `mkv`, `avi`, `webm`, `m4v`, `mp4`).
- **SVG from text.** SVG is text, so `file-type` can't name it. When it finds nothing (or only generic XML), konvertoj looks for an `<svg` element at the start of the text, so an SVG with no extension is still found. Only then is the extension used, as a fallback: a `.svg` file is treated as SVG.
- **Extension aliases**, already in the registry, keep working: `.jpg`, `.jpeg`, `.jfif`, `.jpe` are JPG; `.tif`, `.tiff` are TIFF; `.heic`, `.heif` are HEIC. Case doesn't matter.
- **Input checks before each file runs.** Before a mode's work starts on a file, the runner detects its format:
  - a 0-byte file fails with "is empty",
  - a file with no recognised format fails with "isn't a file konvertoj can convert",
  - a file of the wrong format for a `<from>to<to>` mode fails with a suggestion, e.g. "looks like a PNG. Try: -m pngtojpg",
  - a supported file of the wrong kind (e.g. an MP4 given to `topdf`) fails, naming the modes that do accept it,
  - otherwise the detected format is handed to the mode, so `to<format>` modes can pick a converter per file and mixed batches work.
- **Already the target.** In a `to<format>` mode, a file already in the target format (a JPG given to `tojpg`) is skipped with "already a JPG", unless a conversion option such as `--quality` or `--strip-metadata` is given.
- **Combined outputs** (the images-to-PDF modes) check every input. A mismatch fails the whole PDF and names the file. A batch of mixed formats given to a single-format PDF mode suggests `topdf` when `topdf` accepts all of them.
- **"Looks damaged" message.** A shared user error, "looks damaged and can't be read", for later modes to use when a decoder rejects a file whose header looked right, so a corrupt file never shows a crash.
- Tick "5. Format detection" in `Features.md` once everything passes.

The tests in Features.md that need a real conversion ("converts fine with `tojpg`", "a mixed folder … all convert", "a truncated image … looks damaged") are checked here up to the point where the right converter is chosen; their full conversion checks are added with features 6 and 7, when the converters exist. This is recorded in `Decisions.md`.

## Capabilities

### New Capabilities

- `format-detection`: How konvertoj identifies each input's real format, which inputs a mode accepts, the messages for empty, unknown, wrong-mode and wrong-kind files, and when a `to<format>` mode skips a file.

### Modified Capabilities

- `batch-runner`: "Running every planned item" now checks each item's input formats before the mode's work starts, and hands the detected format to the mode.

## Impact

- New dependency: `file-type` (listed in the CLAUDE.md tech stack).
- New source: `src/detect.ts` (detection, SVG sniffing, input checks and messages).
- Changed source:
  - `src/runner.ts`: checks inputs before calling a mode's `run`, and records skips.
  - `src/inputs.ts`: `InputFile` gains an optional `format`, filled in by the runner.
  - `src/errors.ts`: a `damagedFile()` helper for the "looks damaged" error.
- New tests: `test/detect.test.ts`, plus runner tests using registry modes with a fake `run`.
- New file: `Decisions.md`, listing decisions taken outside the plans.
- No change to help text, the registry's mode list or the README.
