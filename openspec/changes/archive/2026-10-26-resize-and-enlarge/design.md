# Design

## Context

Every image conversion mode declares `--width`, `--height` and `--fit` (default `inside`), but `convertImage` ignores them, apart from SVG input. There, `openSvg` picks a render density from `--width`/`--height` and adds a small exact-size `resize`. `resize` (options `--width`, `--height`, `--scale`, `--fit`, `--no-enlarge`, output the same format, suffix `resized`) and `enlarge` (`--scale` with choices `2x`/`4x`, default `2x`, suffix `enlarged`) have no `run`. `--scale` for `resize` has no rule. `main` checks each option's value against its rule, and then resolves inputs. It has no way to check options against each other. `openImage` returns the decoded `width` and `height`, but for core formats that is the size before orientation.

## Goals / Non-Goals

**Goals:**
- One function that turns the source size and the options into the final size, used for the limit check, the `--no-enlarge` note and the sharp call.
- A small, general hook for rules across a mode's options, because features 10–12 each need one ("`--quality` with `--level` is rejected", "crop with no options", "rotate needs `--angle` or `--auto`", "colorpick needs `--at` or `--palette`").

**Non-Goals:**
- AI upscaling. `enlarge` uses Lanczos plus a sharpen, as Features.md says.
- Resizing PDFs or video.

## Decisions

### Planning the size (`src/convert/resize.ts`)
`planSize(source: { width; height }, request): { width; height; fit } | undefined`:
- **`request`** comes from the options: `width`, `height`, a scale factor (`resize`'s `--scale 50%` → 0.5, `enlarge`'s `2x` → 2), and `fit`.
- **No size at all** → `undefined`, meaning no resize.
- **Scale `k`** → `round(w·k) × round(h·k)`, fit `fill`.
- **One side** → the other side follows the shape: `round(h · W / w)`, fit `fill`.
- **Both sides:**
  - `inside`: `s = min(W/w, H/h)`, giving `round(w·s) × round(h·s)` with fit `fill`,
  - `outside`: the same with `max`,
  - `cover`, `contain` and `fill`: exactly `W × H`, with that fit.
- **Minimum:** every side is at least 1 pixel after rounding.

`applyResize(image, plan, { background, enlarge })` then calls:
```ts
image.resize(plan.width, plan.height, {
  fit: plan.fit,
  position: "centre",
  kernel: "lanczos3",
  background,
})
```
With `enlarge`, it adds `.sharpen({ sigma: 0.5 })`.

`contain` padding uses the `--background` colour when the target can't hold transparency (JPG, BMP and TIFF with quality), and transparent otherwise. The padding is added by `resize` itself, so it gets the right colour no matter where sharp applies `flatten`.

### Where it runs (`convertImage`)
After `openImage` and before grayscale and flatten:
1. **Plan:** `plan = planSize(opened, requestFrom(options, target))`.
2. **`--no-enlarge`:** if it is set and the plan is bigger than the source on either side, the plan is dropped and the note says `kept at W × H, because --no-enlarge stops images getting bigger`.
3. **Size limit:** if either side of the plan exceeds 16384 → `UserError("would be W × H pixels, larger than the 16384-pixel limit on a side. Choose a smaller size.")`.
4. **Resize:** `applyResize`.

Notes on particular cases:
- The source size is the displayed size. `openCore` now reports `metadata.autoOrient.width/height` (sharp gives the size after orientation), and for animated input the page height. So a sideways photo given `--width 800` gets 800 on its displayed width.
- **Animation:** sharp resizes every frame of an animated pipeline, so `animated` inputs stay animated.
- **ICO:** sharp keeps only one `resize` per pipeline, so `clone().resize()` in the ICO encoder would silently replace the planned resize. The resized image is therefore first rendered to a PNG buffer, and the icon squares are made from `sharp(thatBuffer)`.
  - **Conversion modes** (`pngtoico --width 64 --fit cover`) use `--sizes` as before, on the resized image.
  - **`resize` and `enlarge` on an ICO input** (`convertImage(context, "ico", { keepFormat: true })`) write a single square icon whose side is the larger side of the result: 48 → 96 for `enlarge`. A side over 256 fails with "would be N pixels, but icons can be at most 256 pixels wide.".
- **`enlarge`:** `requestFrom` reads its `--scale` (`2x`/`4x`, default from the option definition) as the factor and turns on the sharpen. Choice rules match case-insensitively, so the value is lowercased before `2x` and `4x` are turned into 2 and 4, and `2X` works.
- **`resize`:** reads `--scale` as a percentage.
- **Conversion modes** have no `--scale`, so only width and height apply.

`resize` and `enlarge` runs call `convertImage(context, input.format, { keepFormat: true })`. Their inputs (JPG, PNG, WebP, AVIF, GIF, TIFF, BMP, ICO) are all formats the converter can write.

### SVG
`openSvg` keeps its density choice, but takes the scale from the plan: the render density is `72 × max(plan.width / naturalWidth, plan.height / naturalHeight)`, so the drawing is at least as big as the plan on both sides. `--dpi` and the no-size default still apply when there is no plan. The exact-size `resize` inside `openSvg` is removed: the shared resize step now produces the exact size, scaling down from a render at least as large, so the output stays sharp. Planning happens once. `openImage` receives the request, `openSvg` plans on the SVG's natural size and returns that plan with the opened image (`opened.plan`), and `convertImage` uses `opened.plan` when there is one. For other formats it plans on the opened size. The same plan then drives the density, the `--no-enlarge` check, the limit check and `applyResize`, so rounding happens only once.

### Mode option checks
`Mode` gains `checkOptions?: (options: RunContext["options"]) => string | undefined`. `main` calls it after `optionProblem` and before resolving inputs, and fails with its message.

`resize`'s check:
- `--scale` with `--width` or `--height` → "--scale can't be used with --width or --height. Choose one way to size the image."
- none of the three → "Give --width, --height or --scale to say how big the image should be."

### Pattern rule
`OptionRule` gains `{ pattern: RegExp; description: string }`. `followsRule` tests the pattern, and `describeRule` returns the description. `resizeScale` declares `pattern: /^(?=.*[1-9])\d+(\.\d+)?%$/` with "a percentage such as 50% or 200%", so `0%`, `50` and `abc` are rejected.

### Tests (`test/resize.test.ts`)
- Images come from the existing helpers. The cover test uses a raw buffer, red in the outer quarters and blue in the middle half.
- The limit test uses a 5000 × 4000 solid PNG (small on disk) with `--scale 4x`. Planning refuses it before any pixels are processed.
- The existing SVG tests from feature 7 (`--width 2000` sharpness, `--width 300 --height 300`) must keep passing.

## Risks / Trade-offs

- [`outside` and `inside` round each side separately, so the shape can differ by under a pixel] → That is the nearest whole-pixel size, as Features.md asks ("rounded, never fails").
- [Sharpening after enlarging can't add real detail] → Features.md asks only for a light sharpen to reduce softness.
