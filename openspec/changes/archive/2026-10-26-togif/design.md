# Design

## Context

- **`togif`** is registered in the GIF group with every image and video format as input, and the options `gifWidth` (`--width`, default 480), `fps` (1–30, default 10), the shared `start`/`end` (time rule since feature 16), `speed` (0.5–4, default 1) and `force`. It is the only mode without a `run`.
- **`Mode.usesFfmpeg`** is `true` for the Video & Audio modes. `main` checks it before the batch to make FFmpeg available, and `runBatch` runs those modes one file at a time.
- **The image converter** already keeps animation for GIF/WebP → GIF, and resizes with `--width` through its size plan.
- **The media probe** and `runFfmpeg` (progress, frame count, abort) come from features 15 and 16.

## Goals / Non-Goals

**Goals:**
- Good-looking video GIFs with one FFmpeg run.
- Image GIFs that never touch FFmpeg.

**Non-Goals:**
- GIFs from a series of separate images (out of scope in Spec.md).
- Dithering choices, colour counts, or captions.

## Decisions

### FFmpeg only for videos
- **`usesFfmpeg`** becomes `true | ((inputs: InputFile[]) => boolean)`.
- **`togif`** uses `(inputs) => inputs.some((input) => isVideoFile(input.path))`, where `isVideoFile` checks the extension against `videoInputs` (and their aliases). It runs before content detection, so a video saved with an image extension won't trigger the add-on. If such a file reaches the GIF run without `context.ffmpeg`, it fails with "is a video, so it needs FFmpeg. Run konvertoj --install-video, then try again.", an honest message.
- **A helper `needsFfmpeg(mode, inputs)`** in the registry is used by `main` (to ensure FFmpeg) and by `runBatch` (to run one at a time).

### The run (`makeGif(context)` in `src/video/gif.ts`)
- **Image input** (`input.format` is an image format):
  - any of `fps`, `speed`, `start`, `end` or `force` → `UserError("--fps only applies to videos. Remove it to make a GIF from this image.")`, naming the first option found,
  - a GIF input given only video options (typically an earlier result found in a folder, re-run with `--fps 15`) is skipped as "already a GIF" rather than failed,
  - otherwise `convertImage(context, "gif")`, which handles animation and `--width`. When `--width` is at least the image's own width (read with `openImage` first), `width` is left out of the options passed on, and the note says "kept at W × H, because togif never makes images bigger". It doesn't mention `--no-enlarge`, which the user didn't give.
- **Video input:**
  1. `media = probeMedia(...)`. No video → "has no video".
  2. **Section:** `start = parseTime(--start) ?? 0` and `end = min(parseTime(--end) ?? duration, duration)`. `start ≥ duration` → the same message as feature 16. `length = (end − start)`.
  3. **Limit:** `length > 30` and no `--force` → `UserError("is 31 seconds long, and GIFs of more than 30 seconds get very large. Choose a section with --start and --end, or add --force.")`, with the seconds rounded up. A `length` of exactly 30 is accepted. The length is measured before `--speed`, because it is the part of the video the user chose.
  4. **Size:** `width = min(--width ?? 480, displayed width)`, so a GIF is never enlarged.
  5. **Filter:** `[0:v:<stream>]setpts=PTS/<speed>,fps=<fps>,scale=<width>:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a[out]`, through `-filter_complex`. It starts from the main video stream `probeMedia` chose, so cover art is never used, and ends with `[out]`, which is mapped with `-map [out]`.
  6. **Arguments:** `[-ss start] [-t length] -i input -filter_complex <graph> -map [out] -an -loop 0 -f gif <temporary path>`, run inside `context.save`. `-t` comes before `-i`, so it limits the section of the input: as an output option it would be measured on the sped-up timeline and cut the wrong length. Progress is measured over `length / speed`, the GIF's own length.
  7. **Errors** follow `convertToMp4`: aborts re-thrown, damaged text → `damagedFile`, a zero frame count → "has no video", other failures → "couldn't be converted by FFmpeg…".
- **The registry** gives `togif` `run: lazy(makeGif)`, `usesFfmpeg`, and the shared time-range `checkOptions`.

### "Isn't available yet"
Every registry mode now has a `run`. The message and its tests stay, using a test-only mode without a `run`, because the rule still protects future modes.

### Tests (`test/gif.test.ts`; video parts skipped without FFmpeg; explicit timeouts)
- **Images:** a PNG and a three-frame animated WebP are made with sharp. The image tests run with an environment where no FFmpeg can be found (empty `PATH`, no `KONVERTOJ_FFMPEG_PATH`, a temporary home), to prove no FFmpeg is needed.
- **Videos** are made with FFmpeg: `testsrc2` at 640 × 360 (5 s, 4 s, 31 s, 30 s), and a `mandelbrot` clip for the colour test.
- **GIF checks** use sharp: `metadata({ animated: true })` gives `pages`, `width`, `loop` and `delay`, and the length is the sum of the delays.
- **The colour check** compares the first frame of the `togif` GIF, and of FFmpeg's plain `ffmpeg -i clip.mp4 -vf scale=480:-2:flags=lanczos plain.gif`, with the source's first frame scaled the same way, by mean absolute difference over sharp raw pixels. The palette GIF must be closer.

## Risks / Trade-offs

- [`palettegen` reads the whole section once more] → Sections are at most 30 seconds unless forced.
- [Deciding on FFmpeg from extensions] → Mis-named videos get a clear message pointing to `--install-video`.
