# Proposal

## Why

`konvertoj` currently runs and exits without doing anything. Every later feature needs the same command shape (`konvertoj -m <mode> <input> -o <output> [options]`), help text, and friendly errors for wrong commands. Building these once, on a single mode registry, means each later feature only adds the work its modes do, and the help, `--list-modes` and README stay in sync with the code.

## What Changes

- Add a **mode registry** defining every v1 mode from Features.md once, about 150 modes in all. Each mode has a name, group (Image, PDF, GIF, Video & Audio, Tools), accepted input formats, output format, options with defaults, a one-line description and at least one example.
  - Conversion modes are generated from format lists as `<from>to<to>` (e.g. `heictojpg`) and `to<format>` (e.g. `tojpg`): one lowercase spelling each, using `jpg` and `tiff`.
  - Tool modes: `compress`, `resize`, `enlarge`, `crop`, `rotate`, `flip`, `strip`, `info` and `colorpick`.
- Parse arguments with Node's built-in `util.parseArgs`. Declare the common options (`-o/--output`, `--overwrite`, `--strip-metadata`, `-r/--recursive`, `--dry-run`, `-q/--quiet`, `-v/--verbose`) once for every mode. Reject options that don't belong to the chosen mode.
- Running `konvertoj` with no arguments, or with `--help`, shows the main help screen.
- `--version` prints the version from `package.json`.
- `--list-modes` lists every mode once, grouped.
- `-m <mode> --help` shows a mode's description, options with defaults and examples.
- An unknown mode suggests the closest real one ("Did you mean heictojpg?"), including common variants such as `heic2jpg`, `heic-to-jpg` and `HEICtoJPG`. With no close match, it points to `--list-modes`.
- Clear, plain-English errors with exit code `1` for:
  - a missing `-m` value,
  - files given without `-m`,
  - unknown options,
  - options from another mode.
- Check simple option values before any mode runs. The registry records each option's allowed words or number range, for example:
  - `--fit contain|cover|fill|inside|outside`,
  - `--quality 1–100` for images and `low|medium|high` for video,
  - `--fps 1–30`.

  Checks that need more than a word list or range (colours, sizes like `200kb`, page ranges, times, conflicting options) stay with each mode's feature.
- Asking for a mode that would create HEIC or SVG (`pngtoheic`, `toheic`, `pngtosvg`, `tosvg`) explains that those formats are input only and suggests a mode that does exist.
- Running a real mode whose work isn't built yet fails with "<mode> isn't available yet" and exit code `1`. Later features replace this one mode family at a time.
- Add `npm run docs`, which writes a grouped mode table into `README.md` from the registry. A test fails when the README is out of date, so CI catches it. Feature 19 extends this into the full README.
- Tick "2. Command-line basics" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `mode-registry`: The set of modes konvertoj offers: their names, groups, naming rules, and the options, description and examples every mode must have.
- `command-line`: How konvertoj reads a command. This covers the main help, `--version`, `--list-modes`, mode help, mode suggestions, option checks, and the errors and exit codes for wrong commands.
- `readme-docs`: The parts of `README.md` generated from the mode registry, and the check that they're up to date.

### Modified Capabilities

- `cli-startup`: The "Clean start with nothing to do" requirement is removed. Running with no arguments now shows the help screen, as covered by `command-line`.

## Impact

- New source: `src/main.ts` (command handling), `src/modes/` (formats, options, the registry and mode suggestions) and `src/help.ts` (help, mode help and `--list-modes` text).
- Changed source: `src/cli.ts` loads `main.js` dynamically after the Node.js version check, so old Node.js versions still get the version message first.
- New script: `scripts/update-readme.js`, with a `docs` entry in `package.json`.
- Changed: `README.md` (generated mode section), `Features.md` (progress tick), `test/cli.test.ts` (bare run now shows help).
- New tests for the registry, parsing, help text, suggestions and README sync.
- No new dependencies.
