# Proposal

## Why

Resizing is the most common image task after converting: shrinking screenshots for a blog, or making a small photo bigger to print. Every conversion mode already declares `--width`, `--height` and `--fit`, but since feature 6 they have had no effect (Decisions.md). `resize` and `enlarge` are registered but can't run. Feature 9 builds one resize step and uses it everywhere.

## What Changes

- **One shared resize step** in the image converter, used by every image conversion mode (so `heictojpg --width 1200` works), `resize` and `enlarge`:
  - `--width` and/or `--height`. Giving only one keeps the shape.
  - `--fit contain|cover|fill|inside|outside` (default `inside`) when both are given. `cover` crops from the centre. `contain` pads, transparent where the format allows and `--background` where it doesn't.
  - Sizes are rounded to whole pixels, never failing on halves.
  - Animated GIF and WebP stay animated, and transparency is kept.
- **`resize`:** keeps the format and writes `<name>-resized.<ext>`.
  - `--width`, `--height`, `--scale 50%` (a percentage), `--fit` and `--no-enlarge`.
  - With no size option it fails with "Give --width, --height or --scale".
  - `--scale` with `--width` or `--height` is rejected as conflicting.
  - `--no-enlarge` leaves an image that would grow at its size, with a note.
- **`enlarge`:** keeps the format and writes `<name>-enlarged.<ext>`.
  - `--scale 2x|4x`, default `2x`.
  - Uses the high-quality Lanczos method, then a light sharpen.
- **Size limit:** a result larger than 16,384 pixels on either side is refused, giving the size it would have been.
- **SVG** renders at the resolution the resize needs, then goes through the same step. This replaces feature 7's one-pixel correction, and keeps large SVG outputs sharp.
- **Mode option checks:** a mode can now declare a check across its options, run before any file is read. `resize` uses it for the missing-size and conflict errors. Later features will use it too: crop, rotate, compress and colorpick each have such rules.
- **`--scale` values** for `resize` are checked as positive percentages before any work.
- Tick "9. Resize and enlarge" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `image-resizing`: the shared resize step, `resize`, `enlarge`, `--fit` behaviour, `--no-enlarge`, rounding and the size limit.

### Modified Capabilities

- `command-line`: a new requirement that a mode's own option checks (missing or conflicting options) fail with exit code `1` before any file is touched.
- `mode-registry`: "Option value rules" covers `resize`'s `--scale` percentages.
- `image-conversion`: "Core format conversions" keeps the input's size only when no `--width` or `--height` is given.

## Impact

- New source: `src/convert/resize.ts`, which plans the output size and applies the resize.
- Changed source:
  - `src/convert/image.ts` and `src/convert/decode.ts`: apply the resize, take SVG sizing from the plan, and report the oriented source size,
  - `src/modes/registry.ts`: `run` for `resize` and `enlarge`, and the optional `checkOptions` on `Mode`,
  - `src/modes/options.ts`: a pattern rule for `--scale`,
  - `src/main.ts`: calls `checkOptions`.
- `Decisions.md`: the temporary "no effect until feature 9" entry is resolved, and an entry for `contain` padding is added.
