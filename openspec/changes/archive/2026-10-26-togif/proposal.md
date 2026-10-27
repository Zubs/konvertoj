# Proposal

## Why

GIFs are still the easiest way to show a short clip in a README, a chat or a slide (Spec.md 5.4). `togif` is the last mode without a `run`. It joins two paths that already exist: images through the image converter (feature 6), and short videos through FFmpeg (features 14 to 16), using a palette made for the clip so colours look right.

## What Changes

- **Images:** `togif` on an image uses the image converter. An animated WebP (or GIF) stays animated with its frames, and other images become a still GIF. Images never need FFmpeg.
- **Videos:** FFmpeg makes the GIF in one run with two passes over the clip. `palettegen` builds the best 256 colours for the clip first, then `paletteuse` uses them, so there is no banding as with a plain conversion. Video GIFs loop forever.
- **Video options:**
  - `--width` (default 480, keeping the shape, never enlarging),
  - `--fps` (1–30, default 10),
  - `--start` and `--end` (times as in feature 16),
  - `--speed 0.5–4` (default 1, so `--speed 2` halves the GIF's length).
- **Long clips:** a section longer than 30 seconds is refused unless `--force` is given, with a tip to use `--start`/`--end`. A 30-second section is accepted.
- **Video-only options on images:** `--fps`, `--speed`, `--start`, `--end` and `--force` given for an image fail for that image, saying they only apply to videos, except that a GIF input given only those options (an earlier result in a folder) is skipped as already a GIF. `--width` also works for images, resizing them (never enlarging), with no default.
- **FFmpeg only for videos:** `usesFfmpeg` can now be decided from the inputs. `togif` needs FFmpeg only when at least one input looks like a video, so an image GIF works without the add-on or its prompt.
- Tick "17. GIF (`togif`)" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `gif-making`: `togif` for images and videos: palette, size, frame rate, trimming, speed, looping, the 30-second limit and the video-only options.

### Modified Capabilities

- `mode-registry`: "Modes that need FFmpeg" lets `togif` need FFmpeg only for video inputs.
- `command-line`: "Modes not built yet" keeps its rule, but every mode is now built. Its scenarios use a test-only mode without a `run`.

## Impact

- New source: `src/video/gif.ts`.
- Changed source:
  - `src/modes/registry.ts`: `togif`'s `run`, and `usesFfmpeg` as `true` or a function of the input paths,
  - `src/main.ts` and `src/runner.ts`: use that function,
  - `test/main.test.ts`: the "isn't available yet" tests use a test-only mode.
