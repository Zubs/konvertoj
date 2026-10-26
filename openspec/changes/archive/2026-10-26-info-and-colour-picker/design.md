# Design

## Context

`info` (options `--json`) and `colorpick` (`--at`, `--palette` with rule 1–16 and default 5, `--json`) are registered with output `none`. For such modes, `planOutputs` already makes one item per input without an output path, and the dry run prints "(prints details, no file)". But the runner treats a run that saves nothing as skipped ("nothing was written"), and the reporter only knows success, skip and failure lines plus a summary. `openImage` decodes every input format and reports the displayed size, pages and (for core formats) sharp metadata. `readDetails` only says whether details exist.

## Goals / Non-Goals

**Goals:**
- One small path for "show details" results, shared by both tools: text sections or one JSON document.
- Never print a location unless asked.

**Non-Goals:**
- Showing every EXIF tag. The summary is camera, date and location, as Features.md lists.
- Colour names ("red"). Only HEX, RGB and HSL are given.

## Decisions

### Showing results
- **`RunContext` gains two fields:**
  - `show(section: { text: string; data: Record<string, unknown> })`,
  - `colours: boolean`, which is true when standard output allows colour codes.
- **The runner:** a run that called `show` counts as converted, without a saved path, sizes or a `✓` line. The runner passes the section to `reporter.shown(index, section)`, where `index` is the item's position in the plan.
- **`Reporter` gains `printing: boolean` and `json: boolean` in its settings.**
  - `printing` is set when `mode.output === "none"`, and `json` when `--json` is given.
  - When printing, `succeeded` lines and the summary are not written. Failure lines on standard error stay.
  - `finish` writes the sections sorted by index. As text, they are joined with blank lines. As JSON, it writes `JSON.stringify(datas, null, 2)` followed by a newline.
  - `--quiet` doesn't suppress sections, because they are the command's result rather than progress.
  - The progress bar still runs on standard error in a terminal.
  - Standard output holds only the sections. While printing, the verbose "Working on …" and detail lines, skip lines and notes go to standard error, so `info --json --verbose` still parses.
  - `shown` does the bookkeeping `succeeded` does: it counts the item as done, clears the job progress and redraws the bar, so the bar reaches the total.
  - In the runner, a run that showed a section is checked before the "nothing was written" skip branch.
  - On Ctrl+C, the sections collected so far are printed, and the "Stopped by Ctrl+C after N of M" line goes to standard error, so an interrupted run still shows what finished.

### Rejecting `-o`
In `main`, after the option checks: if `mode.output === "none"` and `--output` is given → "info doesn't create files, so -o can't be used. Remove -o to see the details." This follows the registry and applies to any future mode that prints.

### Info (`src/convert/info.ts`)
`showInfo(context)` uses `openImage(input, {}, false, { fit: "inside" })` for size and pages, then gathers:
- **Format:** the short label of `input.format` (JPG, HEIC, …).
- **File size:** `formatSize(stat.size)`. JSON gets the bytes.
- **Dimensions:** `opened.width × opened.height`, already upright and per frame.
- **Colour space:** `metadata.space` mapped `srgb` → sRGB, `cmyk` → CMYK, `b-w` → Grayscale, `rgb16` → RGB (16-bit), `grey16` → Grayscale (16-bit), `lab` → Lab, and anything else as is. Inputs decoded to raw pixels (HEIC, BMP, ICO) and SVG are sRGB.
- **Transparency:**
  - for an image without an alpha channel (core metadata `hasAlpha` false), no,
  - otherwise `!(await image.clone().stats()).isOpaque`,
  - if `stats()` fails for any reason (too large, truncated, header only), "yes" is assumed from the alpha channel, because the dimensions are already known.
- **Frames:** `opened.pages`. The text line is shown only when it is over 1. JSON always has it.
- **Details:** `cameraDetails(input, opened)` in `metadata.ts`, using `exifr` (on the EXIF buffer for core formats, on the file for HEIC) with `gps: true` and `reviveValues: false`. Dates then stay as `YYYY:MM:DD HH:MM:SS` strings instead of local-time `Date` objects, and exifr still gives decimal `latitude` and `longitude`. It returns `{ make, model, dateTaken, latitude, longitude }` or `undefined`. A damaged block counts as no details.

Text section:
```
photo.jpg
  Format: JPG
  File size: 2.4 MB
  Dimensions: 1600 × 1200
  Colour space: sRGB
  Transparency: no
  Camera: Canon EOS R5
  Date taken: 2025-05-01 12:00:00
  Location: yes
```
- **Dates:** `YYYY:MM:DD HH:MM:SS` is shown as `YYYY-MM-DD HH:MM:SS`.
- **Location:** with `--verbose` it is `51.50070, -0.12460` (five decimals). Without a location it is `Location: no`.
- **No details:** with no camera, date or location, the three lines are replaced by `No camera details`.
- **JSON:** the same fields: `file` (relative to the working folder), `format`, `fileSize`, `width`, `height`, `colourSpace`, `transparency`, `frames`, `camera` (`{ make, model }` or `null`), `dateTaken` (or `null`) and `location`. The location is `true` or `false`, and with `--verbose`, `{ latitude, longitude }` when there is one.

### Colour picker (`src/convert/colours.ts`)
`pickColours(context)` never decodes more than it needs, taking the first frame for animations:
- **`--at x,y`:**
  - if `x ≥ width` or `y ≥ height` → `UserError("--at x,y is outside the image, which is W × H pixels. Use x from 0 to W−1 and y from 0 to H−1.")`,
  - otherwise only that pixel is read: `image.clone().extract({ left: x, top: y, width: 1, height: 1 }).ensureAlpha().raw()`,
  - an image that can't be decoded at all gives the usual too-large or looks-damaged message.
- **`--palette n`:** median cut.
  1. **Sample:** pixels with alpha > 0, from the image reduced to at most 256 pixels on its longer side with `kernel: "nearest"`, so no new blended colours appear.
  2. **Split:** start with one box of all pixels. Repeatedly split the box with the widest channel range (ties go to the box with more pixels), until there are `n` boxes or no box has a range above 0. The split is by value, so identical values always stay together and both boxes are non-empty: pixels below the channel's median value go in one box and the rest in the other, and when the median equals the minimum, the cut is `value > minimum` instead.
  3. **Colour:** each box's colour is the rounded average of its pixels (including alpha). Its share is its pixel count over the total.
  4. **Order:** boxes are sorted by count, most common first.
  
  An image with fewer distinct colours than `n` reports fewer.
- **Formatting:**
  - HEX in upper case,
  - `rgb(r, g, b)`,
  - `hsl(h, s%, l%)`, using the standard RGB → HSL formula rounded to whole numbers, with the hue taken `% 360` so it never shows 360,
  - when the alpha isn't 255: `#RRGGBBAA`, `rgba(r, g, b, a)` and `hsla(h, s%, l%, a)`, with `a` written as `Number((alpha / 255).toFixed(2))`, so 128 gives `0.5`.
- **Block:** a two-space block, `\x1b[48;2;r;g;bm  \x1b[0m`, is drawn before each colour only when `context.colours` is true and `--json` isn't given. The `██` in the sample below stands for it.

Text section:
```
logo.png
  Pixel 10,10: ██ #FF0000  rgb(255, 0, 0)  hsl(0, 100%, 50%)
  Main colours:
    1. ██ #FF0000  rgb(255, 0, 0)  hsl(0, 100%, 50%)  52%
```
JSON: `{ file, at: { x, y, hex, rgb: [r, g, b], hsl: [h, s, l], alpha }, palette: [{ hex, rgb, hsl, alpha, share }] }`, where `at` and `palette` appear only when asked for.

### Option checks
- **`--at`:** declares the pattern rule `/^\d+,\d+$/` with "two whole numbers such as 10,20".
- **`colorpick`'s `checkOptions`:** neither `at` nor `palette` → "Give --at, e.g. --at 10,10, or --palette, e.g. --palette 5."
- **`--palette`:** loses its default and says "e.g. 5". As a value option it can't be given alone without taking the next word as its value.

### Tests
- `test/info.test.ts` and `test/colorpick.test.ts` go through `main` with images made by sharp and the HEIC fixture.
- JSON output is checked with `JSON.parse(stdout)`.
- A runner/report test checks that printing modes write no summary and keep input order.

## Risks / Trade-offs

- [Sections are held until the batch ends] → They are short text. For huge folders the progress bar shows the work going on.
- [Transparency needs a full decode] → Only for images that have an alpha channel. Very large ones fall back to "has an alpha channel".
