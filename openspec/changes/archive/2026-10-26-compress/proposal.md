# Proposal

## Why

Making images smaller for websites is one of the main reasons developers and creators reach for a converter (Spec.md: "Quick format changes and smaller images for websites"). `compress` is registered with `--quality`, `--level` and `--target-size`, but has no `run`. Feature 10 makes it work, reusing the converter so details, orientation and animation behave as everywhere else.

## What Changes

- **`compress`** keeps the format and writes `<name>-compressed.<ext>`, for JPG, PNG, WebP, AVIF and GIF.
  - `--quality 1–100`, `--level low|medium|high` (quality 85, 70 and 50), or `--target-size 200kb`.
  - With none of them, `medium` is used.
- **How each format gets smaller:**
  - JPG, WebP and AVIF are re-encoded at the chosen quality.
  - PNG uses palette quantisation at that quality.
  - GIF lets neighbouring frames share more pixels and palettes as quality goes down, which shrinks animated GIFs. sharp's colour count barely changes GIF output, so it isn't used. A still GIF usually can't get smaller.
- **`--target-size`:**
  - a binary search over quality, at most 8 attempts, keeps the highest quality whose file fits,
  - if none fits, the smallest result is kept, with a note saying the target couldn't be reached,
  - sizes use 1 KB = 1024 bytes, like the rest of konvertoj's output,
  - values such as `200kb` and `1.5MB` are accepted in any letter case, and `0`, negatives and `200` without a unit are rejected before any work.
- **Already optimised:** if the result isn't smaller than the original, nothing is written. The file is reported as skipped with "already optimised".
- **Conflicts:** `--quality` with `--level` or `--target-size`, and `--level` with `--target-size`, are rejected before any file is read.
- **Other formats:** BMP or ICO given to `compress` fails, listing the formats it supports (from feature 5's input check).
- **Size change on every line:** each file's `✓` line now ends with the change in percent, e.g. `hero.jpg → hero-compressed.jpg  2.4 MB → 410 KB (−83%)`. This matches the summary and applies to every mode.
- Tick "10. Compress" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `image-compression`: the `compress` tool, its quality, level and target-size options, how each format is made smaller, and "already optimised".

### Modified Capabilities

- `run-reporting`: "A line per file" adds the percentage change to each success line.
- `mode-registry`: "Option value rules" covers `--target-size`.

## Impact

- New source: `src/convert/compress.ts`.
- Changed source:
  - `src/convert/image.ts`: split into `renderImage` (which returns the encoded buffer) and `convertImage` (render, then save), and a quality for PNG palettes and GIF frame sharing when compressing,
  - `src/modes/registry.ts`: `compress` gets `run` and `checkOptions`,
  - `src/modes/options.ts`: a `--target-size` pattern rule,
  - `src/report.ts`: the percentage on success lines.
- Existing report tests are updated for the new line format.
