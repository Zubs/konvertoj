# Design

## Context

`src/cli.ts` checks the Node.js version and does nothing else. `src/node-version.ts` is its only import. There are no runtime dependencies, and `README.md` is a placeholder. CLAUDE.md requires the mode registry to be the single source of truth for help, `--list-modes`, input checks and the README, and requires `--help` to stay instant. See proposal.md for why, and the specs for the required behaviour.

## Goals / Non-Goals

**Goals:**
- One registry that later features extend by adding a mode's work (a "runner"), not by adding modes or options elsewhere.
- Parsing and validation that every later feature reuses unchanged.
- Help output that's easy to test without spawning a process.

**Non-Goals:**
- Resolving inputs or output names, `--dry-run` and `--overwrite` behaviour (feature 3).
- Exit code `2`, colours, `--quiet`/`--verbose` effects and the progress bar (feature 4).
- Option checks beyond a word list or number range. These stay with each mode's feature:
  - colours (`--background`),
  - lists and sizes (`--sizes`, `--target-size`, resize `--scale 50%`),
  - pages, points, ratios and times (`--page`, `--at`, `--aspect`, `--start`, `--end`),
  - conflicts between options (`--scale` with `--width`),
  - limits that depend on the file (a margin bigger than half the page).
- `--install-video` (feature 14).

## Decisions

### Registry layout
`src/modes/` holds plain data and small builders:
- `formats.ts`: format lists (image inputs, image outputs, video inputs, audio outputs), each with a display label such as "HEIC (iPhone photo)".
- `options.ts`: named option definitions. Each has a name, a kind (`flag` or `value`), a short explanation, an optional short letter, an optional default and an optional rule. A rule is either `{ choices: [...] }` or `{ min, max?, wholeNumber }`. An option name can have more than one definition when its meaning differs between modes: `imageQuality` (1–100, whole) and `videoQuality` (`low|medium|high`) both use `--quality`, and resize's `--scale` and enlarge's `--scale` (`2x|4x`) are separate too. Common options are a named list. Each mode lists the definitions it accepts. A registry test checks that every definition sharing a name has the same kind, since `parseArgs` needs one kind per name.
- `registry.ts`: builds the conversion modes from the format lists, then adds the tool modes and `togif` by hand. It exports `modes` (in group order) and `findMode(name)`.

A mode is `{ name, group, inputs, output, options, description, examples }`. `output` is a format name, or `"none"` for `info` and `colorpick`. It's built once at module load. That's about 150 small objects, which is negligible at start-up.

Per-mode options, taken from Features.md:
- **Image conversion** (to jpg, png, webp, avif, gif, tiff, bmp, ico):
  - all of them: `--background` (default `white`), `--grayscale`, `--width`, `--height` and `--fit` (default `inside`),
  - `--quality` for jpg (80), webp (80), avif (50) and tiff (80),
  - `--lossless` for webp and avif,
  - `--progressive` for jpg,
  - `--sizes` (default `16,32,48`) for ico,
  - `--dpi` when the input is svg.
- **Images to PDF** (`<image>topdf`, `topdf`): `--page-size` (A4), `--orientation` (auto) and `--margin` (10, or 0 with `--page-size fit`).
- **PDF to images** (`pdfto<image>`): `--page` (all), `--dpi` (150) and `--background`, plus the target's quality, lossless, progressive or sizes option.
- **`togif`:** `--width` (480), `--fps` (10), `--start`, `--end`, `--speed` (1) and `--force`.
- **To MP4:** `--quality` (medium), `--resolution` and `--mute`.
- **To audio:** `--bitrate` (192k), `--start` and `--end`.
- **Tools:**
  - `compress`: `--quality`, `--level` (medium) and `--target-size`
  - `resize`: `--width`, `--height`, `--scale`, `--fit` (inside) and `--no-enlarge`
  - `enlarge`: `--scale` (2x)
  - `crop`: `--width`, `--height`, `--left`, `--top`, `--position` (center), `--aspect` and `--trim`
  - `rotate`: `--angle`, `--auto` and `--background`
  - `flip`: `--direction`
  - `strip`: none
  - `info`: `--json`
  - `colorpick`: `--at`, `--palette` (5) and `--json`

`--quality` means 1–100 for images and `low|medium|high` for video. Both are values, so the kinds still agree. Each mode's explanation, default and rule show the difference.

Rules, taken from Features.md:
- **Allowed words:**
  - `--fit`: `contain|cover|fill|inside|outside`
  - `--level`: `low|medium|high`
  - `--position`: the 9 positions
  - `--direction`: `horizontal|vertical`
  - `--page-size`: `A4|letter|fit`
  - `--orientation`: `portrait|landscape|auto`
  - video `--quality`: `low|medium|high`
  - `--resolution`: `1080p|720p|480p`
  - `--bitrate`: `128k|192k|256k|320k`
  - enlarge `--scale`: `2x|4x`
- **Whole-number ranges:**
  - image `--quality`: 1–100
  - `--fps`: 1–30
  - `--palette`: 1–16
  - `--width` and `--height`: 1 or more
  - crop `--left` and `--top`: 0 or more
- **Number ranges:**
  - `--speed`: 0.5–4
  - PDF `--dpi`: 36–600
  - SVG `--dpi`: 1 or more
  - `--margin`: 0 or more
  - `--angle`: any number

### Value checks
After the option-membership checks, each value option with a rule is checked:
- **Words:** compared ignoring case, so `--page-size a4` passes.
- **Numbers:** must match `^-?\d+(\.\d+)?$`, then fall inside the range. Whole-number rules also reject decimals.

Error messages:
- "--fit must be one of contain, cover, fill, inside, outside. You gave banana."
- "--quality must be a whole number from 1 to 100. You gave 101."
- "--width must be a whole number of 1 or more. You gave 0."

The checked value is passed to the runner unchanged, as a string. Each feature converts it when it uses it, so this change doesn't fix a parsed type for later features.

### HEIC and SVG are input only
Before the closest-mode search, `suggest.ts` checks whether the normalised name is `to<heic|svg>` or `<format>to<heic|svg>`, where `<format>` is any known format. If it is, the message says "konvertoj can read HEIC files but can't create them." (or SVG). It then suggests the same mode with `jpg` (for HEIC) or `png` (for SVG) as the output, when that mode exists. So `pngtoheic` suggests `pngtojpg`, `tosvg` suggests `topng`, and `pngtosvg` gets no suggestion. The name still fails with exit code `1`.

*Alternative considered:* a per-feature registry file that each feature adds later. Rejected, because `--list-modes` and the "option from another mode" check need every mode now (see the user's decision in the proposal).

### Parsing: `parseArgs` with `strict: false` and tokens
`util.parseArgs` is called with every option from the registry plus `mode`/`-m`, `help`/`-h`, `version` and `list-modes`, using `allowPositionals`, `strict: false` and `tokens: true`. konvertoj then checks each option token itself:
- a name no mode declares → "--banana isn't a konvertoj option",
- a name the chosen mode doesn't declare → "--angle can't be used with heictojpg",
- a value option with no value → "--quality needs a value",
- a flag with an inline value → "--overwrite doesn't take a value".

*Why not `strict: true`?* Its errors are technical, and it rejects values starting with `-` (`--angle -90`) as "ambiguous", which feature 11 needs. With `strict: false`, a value option takes the next argument even when it starts with `-`. This was checked on Node.js 24: `--angle -90` gives the value `"-90"`, and `-m` with nothing after it gives a token with no value.

`--no-enlarge` is declared as its own flag name. This avoids relying on `allowNegative`, which needs a newer Node.js 22 release.

### Command flow
`src/main.ts` exports `main(args, output)`, where `output` has `out(text)` and `err(text)`. It returns the exit code. `src/cli.ts` keeps the version check, then runs `const { main } = await import("./main.js")`, writes to `process.stdout`/`process.stderr` and sets `process.exitCode`. The dynamic import keeps the old-Node.js message working, and later lets heavy runners load only when needed.

Order of handling:
1. `--version`
2. `--list-modes`
3. no mode:
   - no other arguments, or `--help`: show main help
   - otherwise, a missing `-m` value or positionals without `-m`: error with the command shape
4. unknown mode: the input-only message, or the suggestion
5. `--help` with a mode: show mode help
6. option checks: membership, then missing or unexpected values
7. value checks against each option's rule
8. the mode's runner, or "isn't available yet"

A mode in the registry may have an optional `run` function. None do in this change, which gives step 8's message.

Testing `main` directly with a fake `output` keeps most tests fast. A few tests spawn `dist/cli.js` to cover the real process.

### Mode suggestions
`src/modes/suggest.ts` normalises the typed name:
1. lowercase it and remove `-`, `_` and spaces,
2. replace `2` with `to`,
3. replace `jpeg`→`jpg`, `tif` (not followed by `f`)→`tiff` and `heif`→`heic`.

If the result is a mode name, that's the suggestion. Otherwise it picks the mode with the smallest optimal string alignment distance (Levenshtein plus swapped neighbours, so `jgp`→`jpg` costs 1), accepting it only if the distance is at most 2 and at most a third of the name's length. Otherwise there's no suggestion. Ties go to the first mode in registry order. No mode name contains `2`, so step 2 is safe.

### Help text
`src/help.ts` builds three plain strings from the registry: the main help, the mode list and a mode's help. They're plain text, because colours arrive in feature 4. In mode help, options are aligned in two columns, with the default as `(default: 80)`. Examples are generated:
- conversions: `konvertoj -m heictojpg photo.heic -o beach`
- `to<format>`: a mixed folder
- tools: hand-written in the registry

### Version
`main` reads `package.json` at runtime with `readFileSync(new URL("../package.json", import.meta.url))`. That path works from both `src/` (tests) and `dist/` (published, since `package.json` is always packed). Importing the JSON would put `package.json` outside `rootDir`.

### `npm run docs`
`scripts/update-readme.js` is plain JavaScript, so nothing new is published. It imports the built registry from `../dist/modes/registry.js` and renders one Markdown table per group (mode, description, example). It replaces the text between the `<!-- modes:start -->` and `<!-- modes:end -->` markers in `README.md`.
- With `--check`, it writes nothing and exits with code `1` and "README.md is out of date. Run npm run docs." when the content would change.
- The `docs` script is `npm run build && node scripts/update-readme.js`.
- A Vitest test runs it with `--check` after the global build, so CI catches a stale README through `npm test`.
- `node:process` is imported explicitly, so ESLint's recommended rules don't need a Node.js globals config.

*Alternative:* a TypeScript generator under `src/`. Rejected, because it would be published in `dist/` and isn't needed at runtime.

### Fast start check
The "no heavy modules" test spawns `node --import <hook> dist/cli.js --help`. The hook uses `module.registerHooks` to record every module that gets resolved, and the test asserts each one is a `node:` built-in or under `dist/`. This stays meaningful once sharp and pdfjs are installed.

## Risks / Trade-offs

- [The registry now encodes option names and defaults for features 6–17 before they're built; a later feature may find a default wrong] → That feature updates the registry and runs `npm run docs`. The registry tests and README check make the change visible.
- [~150 modes make `--list-modes` long] → It's grouped, one line per mode, and plain text, so it pipes well to `grep`/`less`. Matches the spec's "every mode once".
- [`module.registerHooks` needs Node.js 22.15 or newer] → CI uses the latest Node.js 22 and local development uses 24. If it's missing, the test fails with a clear message, rather than passing silently.
- [Edit-distance suggestions could suggest odd modes for short names] → The threshold of at most 2 and at most a third of the length keeps short typos like `banana` from matching.
- [`strict: false` treats `--banana x` as a flag followed by a positional `x`] → The unknown-option error stops the command first, so `x` is never used.
