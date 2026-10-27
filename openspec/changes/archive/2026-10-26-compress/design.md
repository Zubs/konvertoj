# Design

## Context

`convertImage(context, target, settings)` opens an input, plans any resize, applies details, encodes to a buffer and saves it. The quality for JPG, WebP and AVIF comes from `--quality` or `defaultQualities`. PNG is always lossless, and GIF always uses sharp's default 256 colours. `compress` is registered with `compressQuality` (`--quality`, 1–100, no default), `level` (`low|medium|high`, default `medium`) and `targetSize` (no rule), with suffix `compressed`, but no `run`. The runner already records `{ skipped }` results and reports sizes. The reporter's success line shows `before → after` without a percentage, while the summary has one.

## Goals / Non-Goals

**Goals:**
- Compress through the same rendering path as conversions, so orientation, details, animation and `--strip-metadata` behave the same.
- Bounded work: at most 8 encodes for a target size.

**Non-Goals:**
- Lossless recompression tools (oxipng, jpegtran). Only sharp's encoders are used, as the tech stack says.
- Compressing BMP, ICO, TIFF, HEIC or SVG. `compress` doesn't list them, so feature 5's input check explains which formats work.

## Decisions

### Splitting the converter
- `renderImage(context, target, settings): Promise<Buffer>` does everything `convertImage` does today except saving.
- `convertImage` becomes `context.save(writeFile(renderImage(...)))`.

`ConvertSettings` gains `quality?: number`, which overrides `--quality` and the default, and turns on palette PNGs and GIF frame and palette sharing:
- **PNG:** `png({ palette: true, quality, effort: 10 })`. This keeps transparency, because libimagequant quantises RGBA.
- **GIF:** `gif({ effort: 10, interFrameMaxError: Math.round((100 − quality) × 0.32), interPaletteMaxError: Math.round((100 − quality) × 0.32) })`. sharp's `colours` setting barely changes GIF output (17 to 256 colours give byte-identical files), so lower quality instead lets neighbouring frames share more pixels and palettes. That clearly shrinks animated GIFs: in probing, the error tolerance at 0 or 8 gave 104 KB, 16 gave 75 KB and 32 gave 28.5 KB. A still GIF has nothing to share between frames, so it usually can't get smaller and is reported as "already optimised".
- **JPG, WebP and AVIF:** the given quality.

Ordinary conversions never pass `quality`, so they keep today's output.

### The compress run (`src/convert/compress.ts`)
`compressImage(context)`:
1. Read the input's size (`stat`).
2. **Quality:**
   - `--quality` → that number,
   - `--level` (lowercased) → `{ low: 85, medium: 70, high: 50 }`,
   - neither and no `--target-size` → 70.
3. **Render** (only without `--target-size`): `renderImage(context, input.format, { keepFormat: true, quality })`.
4. **Target size** (`parseSize("200kb")` → 204800, `"1.5mb"` → 1572864): a binary search on quality with `low = 1`, `high = 100` and at most 8 attempts:
   - each attempt renders at `mid = Math.floor((low + high) / 2)`,
   - a result that fits is remembered as the best so far, then `low = mid + 1`,
   - otherwise `high = mid - 1`,
   - the smallest result is also kept.
   
   Seven attempts cover 100 values, so the highest fitting quality is always found within the limit. With no fitting result, the smallest is used, with `note("couldn't get below 1 KB, so the smallest result (12 KB, quality 1) was kept")`.

   The first attempt (quality 50) is the one that reports notes and details. Later attempts get a copy of the context whose `note` and `detail` do nothing, so the same note isn't printed eight times, and the file is rendered at most 8 times.

   The search assumes a higher quality never gives a smaller file. That holds for JPG. WebP, AVIF and palette PNG sizes can dip slightly at some qualities, so for them the result is the highest quality the search found that fits, which may sit just below another quality that would also fit.
5. **Already optimised:** if the chosen buffer isn't smaller than the input → `return { skipped: "already optimised" }` without saving. When the target also couldn't be reached, the skip reason says both: "already optimised (couldn't get below 1 KB)", because notes aren't printed for skipped files.
6. **Otherwise** `context.save(writeFile(buffer))`.

The registry gives `compress` `run: async (context) => (await import("../convert/compress.js")).compressImage(context)`.

### Option checks
- `targetSize` declares the pattern rule `/^(?=.*[1-9])\d+(\.\d+)?(kb|mb)$/i` with the description "a size such as 200kb or 1.5mb", so `0kb`, `-5kb` and `200` are rejected. `-5kb` reaches the rule as a value and fails the pattern.
- `compress`'s `checkOptions` rejects more than one of `quality`, `level` and `target-size` with "Use only one of --quality, --level and --target-size."

### Percentage on every line
`Reporter.succeeded` appends ` (${formatChange(before, after)})` when the size before is above 0, as the summary does. Existing tests that compare full success lines are updated.

### Tests (`test/compress.test.ts`)
- **Inputs:**
  - large, detailed JPGs (noise at quality 95, a few hundred KB),
  - PNG screenshots made of flat colour blocks with many shades, so palette quantisation clearly shrinks them,
  - a tiny already-compressed JPG (8 × 8 at quality 30) for "already optimised".
- **Target-size check (JPG only):** the search adds a verbose `detail`, "chosen quality N". The test reads N from `--verbose` output, then compresses again with `--quality <N+1>`, and checks that that result is over the target. JPG is used because its sizes rise steadily with quality.

## Risks / Trade-offs

- [Target-size search re-decodes the image up to 8 times] → Bounded by Features.md's limit of 8. Images are small enough for this in practice.
- [Palette PNGs can show banding on photos] → `compress` is opt-in, and `--level low` keeps more quality.
- [Kept details and the sRGB profile add bytes] → A small, already well-compressed file can come out bigger once its EXIF, XMP and profile are written, and is then reported as "already optimised" instead of written. `--strip-metadata` removes that overhead.
