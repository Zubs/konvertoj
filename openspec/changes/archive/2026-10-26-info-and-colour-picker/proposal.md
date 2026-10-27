# Proposal

## Why

Two everyday questions don't need a new file at all: "what is this image, and does it still hold my location?" and "what colour is this?" (Spec.md 5.2: Info and Colour picker). `info` and `colorpick` are registered, but konvertoj's runner only knows modes that write files, so they can't run. Feature 12 adds a way for a mode to show details instead, and builds both tools on the existing decoders, so every input format works.

## What Changes

- **Printing modes.** A mode whose output is "none" shows one section per file instead of writing a file.
  - Sections are printed on standard output in input order, once the batch is done.
  - With `--json`, standard output instead holds one JSON array with one object per file, and nothing else, so scripts can parse it.
  - Failures still go to standard error with the usual exit codes. There are no `✓` lines and no summary.
  - `--quiet` doesn't hide the sections, because they are the result.
  - `-o` is rejected for these modes, explaining that they don't create files.
- **`info`** shows, for every supported input format (including HEIC, SVG, BMP and ICO):
  - format,
  - file size,
  - dimensions (as displayed, so a sideways photo shows its upright size),
  - colour space,
  - whether it has transparency,
  - the frame count for animations,
  - a summary of its details: camera make and model, date taken, and whether a GPS location is present.
  
  GPS coordinates are shown only with `--verbose`, so they aren't printed by accident. An image with no camera details says "No camera details".
- **`colorpick`:**
  - `--at x,y` reports the pixel at that point, counted from the top left starting at 0. A point outside the image fails, giving the image's size.
  - `--palette <n>` reports the `n` main colours (1 to 16) using median-cut quantisation, from most to least common, each with its share of the image.
  - Each colour is shown as HEX, RGB and HSL, with a coloured block in a terminal. The alpha is added when the colour isn't fully opaque (`#FF000080`, `rgba(…)`, `hsla(…)`).
  - With neither option it fails with a usage hint. Both may be given together.
  - `--at` must be two whole numbers such as `10,20`, checked before any work.
- **`--palette` needs a number.** It is a value option, so konvertoj can't tell `--palette logo.png` from a count. Its help shows "e.g. 5" instead of a default (see Decisions.md).
- Tick "12. Info and colour picker" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `image-info`: what `info` reports, in text and JSON, including the location rule.
- `colour-picker`: `colorpick --at` and `--palette`, colour formats, transparency and JSON.

### Modified Capabilities

- `run-reporting`: a new requirement for modes that print details: sections, JSON, no summary, quiet.
- `command-line`: a new requirement that `-o` is rejected for modes that don't create files.
- `mode-registry`: "Option value rules" covers `--at`, and `--palette` has no default.

## Impact

- New source:
  - `src/convert/info.ts`: reads and formats the details,
  - `src/convert/colours.ts`: the pixel lookup, median cut and colour formatting.
- Changed source:
  - `src/modes/registry.ts`: `RunContext` gains `show(section)` and `colours`, and `info` and `colorpick` get `run` and `checkOptions`,
  - `src/runner.ts` and `src/report.ts`: collect and print sections or JSON,
  - `src/main.ts`: rejects `-o` for printing modes,
  - `src/convert/metadata.ts`: a reader for camera, date and GPS values,
  - `src/modes/options.ts`: the `--at` rule, and no default for `--palette`.
