# Design

## Context

`renderImage(context, target, settings)` opens any input (upright, through `autoOrient`), plans a resize from `--width`/`--height`/`--fit` or a scale, applies details, encodes and returns a buffer. `convertImage` saves it. Tools that keep the format call it with `{ keepFormat: true }`. `crop` (options `width`, `height`, `left`, `top`, `position`, `aspect`, `trim`), `rotate` (`angle`, `auto`, `background` with a colour rule and no default) and `flip` (`direction` with choices `horizontal`/`vertical`) are registered with suffixes but no `run`. `Mode.checkOptions` exists for rules across options.

Probing sharp 0.35.5 showed:
- `flip()`, `flop()` and `extract()` work on animated pipelines,
- `rotate()` fails on them ("Rotate is not supported for multi-page images"),
- `rotate(angle)` and `extract()` after `autoOrient` act on the upright image,
- `trim()` reports the trimmed size, and doesn't trim when the corners differ,
- `rotate(45, { background })` enlarges the canvas.

## Goals / Non-Goals

**Goals:**
- One `edit` hook in the converter, so the three tools add only their own geometry.
- Error messages that give the image's real size.

**Non-Goals:**
- Combining crop, rotate and flip in one run (one tool per command, as Features.md describes).
- Lossless JPEG rotation. The image is re-encoded at the format's default quality, like `resize`.

## Decisions

### The `edit` hook
`ConvertSettings` gains two fields:
- `edit?: (image: Sharp, source: OpenedImage, target: string) => Promise<Sharp>`,
- `resize?: false`.

`renderImage` runs `edit` where the resize would go, after opening and before grayscale, flatten and details. Each tool's `run` builds its `edit` as a closure over its `context`, so the edit can read the options and call `context.note`.

With `resize: false`, `renderImage` passes an empty size request to `openImage` and makes no size plan, because crop's `--width`/`--height` describe the crop and not a resize. An SVG then renders at its own size.

**ICO output size:**
- when the format is kept, the icon's side is read from the edited image itself: `icoFile` renders the base PNG with `toBuffer({ resolveWithObject: true })` and uses the larger side of `info`, refusing sides over 256,
- a cropped or rotated ICO keeps its new size,
- this replaces feature 9's use of the planned size, and gives the same result for `resize`/`enlarge`.

### Crop (`cropRegion` in `src/convert/edit.ts`)
`source.width`/`height` are the upright size (feature 9).
- **`--trim`:** sharp can't trim multi-page images, so trimming is done as an `extract` of a trim box.
  - The box is measured on a still image: the first frame (`sharp(path, { autoOrient: true })`) for animated input, otherwise `image.clone()`.
  - The measurement is `trim().toBuffer({ resolveWithObject: true })`. The box is `left = −trimOffsetLeft`, `top = −trimOffsetTop`, and the trimmed `width × height`.
  - If the box is the whole image, note "no plain border was found, so it wasn't trimmed" and return the image unchanged.
  - Otherwise return `image.extract(box)`, which also works across every frame of an animation.
- **`--aspect W:H`:** `r = W / H`.
  - If `w / h > r`, the area is `round(h·r) × h`; otherwise it is `w × round(w / r)`.
  - It is placed by position.
- **Width and height:**
  - `left`/`top` when given,
  - otherwise placed by position:
    - `center` → `floor((w − cw) / 2)`, `floor((h − ch) / 2)`,
    - `top`/`bottom` and `left`/`right` pin one side and centre the other,
    - corner positions pin both.
- **Bounds:** first `cw > w || ch > h`, then `left + cw > w || top + ch > h`, either → `UserError("goes past the edge of the image, which is W × H pixels. Choose a smaller crop.")`. The size check comes first, because a position such as `right` would otherwise give a negative `left`.
- **Result:** `image.extract({ left, top, width: cw, height: ch })`. A crop of the whole image extracts everything, so the pixels are unchanged.

### Rotate (`rotateImage`)
- **`--auto` without `--angle`:**
  - the `rotate` run itself reads `sharp(path).metadata().orientation` before converting,
  - when it is missing or 1 (always the case for BMP and ICO, which have no tag), it returns `{ skipped: "already upright" }`, which the runner already handles,
  - otherwise it converts, and the edit returns the image as it is: `openCore` already applied the orientation, and details are written with orientation 1.
- **`--auto` with `--angle`** is allowed: the image is turned upright (as every conversion does), then rotated by the angle, and is never skipped.
- **`--angle a`:**
  - `a = ((a % 360) + 360) % 360`, and `0` returns the image unchanged,
  - the corner colour is `--background`, else transparent when the target keeps transparency (`losesTransparency` is false), else white,
  - still images use `image.rotate(a, { background })`.
- **Animated images** (`source.pages > 1` and the target is GIF or WebP):
  - read all frames as raw RGBA once (`image.clone().ensureAlpha().raw()`),
  - rotate each `width × pageHeight` frame with its own `sharp(frame, { raw }).rotate(a, { background }).raw()`,
  - join them as `sharp(joined, { raw: { width, height: frameHeight × pages, channels: 4, pageHeight: frameHeight } })`.
  - The frame delays and loop count come from `source.metadata`.

### Keeping frame delays and loop counts
`encode` passes `delay` and `loop` from the opened image's metadata into `gif()` and `webp()` when the input was animated. Pipelines that came straight from the animated file already carry them, and passing them again is harmless. A raw re-joined pipeline would otherwise lose them.

### Flip
`horizontal` → `image.flop()`, `vertical` → `image.flip()`. Both work on animated pipelines.

### Option checks (`checkOptions`)
- **crop:**
  - none of `width`, `height`, `aspect` and `trim` → "Choose how to crop: --width and --height (placed with --left and --top, or --position), --aspect such as 16:9, or --trim."
  - `trim` with any other crop option, or `aspect` with `width`/`height`/`left`/`top`/`trim` → "--aspect and --trim can't be used together" (naming the actual pair).
  - only one of `left` and `top` → "--left and --top go together."
  - `left`/`top` without both sizes, or only one of `width` and `height` → "--width and --height go together for crop."
  - `position` with `left`/`top` → "--position can't be used with --left and --top."
- **rotate:** neither `angle` nor `auto` → "Give --angle, e.g. --angle 90, or --auto to turn a photo upright."
- **flip:** no `direction` → "Give --direction horizontal or --direction vertical."

`aspect` gains the pattern rule `/^(?=[^:]*[1-9])\d+(\.\d+)?:(?=.*[1-9])\d+(\.\d+)?$/` with "a ratio such as 16:9 or 1:1".

### Runs
`crop`, `rotate` and `flip` get lazy `run`s calling `convertImage(context, input.format, { keepFormat: true, resize: false, edit })`, with the matching function from `edit.ts`.

### Tests (`test/edit.test.ts`)
- **Images** come from raw buffers with known colours:
  - nine regions for positions,
  - red/blue halves for flips,
  - an 800 × 600 image with a red top-left marker to check the direction of each quarter turn,
  - a white-bordered screenshot for trim,
  - an animated GIF with distinct delays.
- **Pixel checks** use the shared `pixels` helper.

## Risks / Trade-offs

- [Frame-by-frame rotation decodes the whole animation into memory] → GIFs and WebPs are small, and the runner limits parallel files to 4.
- [An animated WebP rebuilt from raw frames for rotation keeps no EXIF or XMP, because there is nothing left for `keepExif` to copy] → Animated WebPs rarely carry camera details. It is noted in Decisions.md.
- [Skipping "already upright" photos in `--auto` means a folder run writes only the files that changed] → That matches "changes nothing" in Features.md, and the summary lists the skipped files.
