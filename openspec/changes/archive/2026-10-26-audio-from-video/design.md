# Design

## Context

Feature 15 added `probeMedia` (duration, main video stream, whether there is audio, damaged detection) and `convertToMp4`. `runFfmpeg` runs FFmpeg without a shell and reports progress against a duration. The 35 audio modes are registered as `usesFfmpeg` with `bitrate` (choices `128k`–`320k`, default `192k`), `start` and `end`. `start` and `end` are the same option definitions `togif` uses, and they have no rule yet. `main` prints `plan.warnings` as `Warning: …` before running. The Homebrew FFmpeg on this machine has `libmp3lame`, `aac`, `flac` and `libopus`, but no `libvorbis`. The `ffmpeg-static` builds may have both.

## Goals / Non-Goals

**Goals:**
- Accurate trims, and audio that common players open.
- Time parsing shared with `togif` (feature 17).

**Non-Goals:**
- Audio-to-audio conversion (out of scope in Spec.md), choosing a track other than the first, and changing sample rate or channel count.

## Decisions

### Times (`src/video/times.ts`)
- **Parsing:** `parseTime("1:02:30.5")` → 3750.5. It accepts `S`, `M:SS` and `H:MM:SS`, with optional decimals on the seconds.
- **Formatting:** `formatTime(200)` → `3:20` (or `1:02:30` past an hour) for messages.
- **Rule:** `start` and `end` declare the pattern `/^(\d+(\.\d+)?|\d+:[0-5]\d(\.\d+)?|\d+:[0-5]\d:[0-5]\d(\.\d+)?)$/`, described as "a time such as 90, 1:30 or 1:02:30". This rule also applies to `togif` from now on, as Features.md says its times work "as in feature 16".

### Option checks and warnings
- **`checkOptions`** for the audio modes: a missing `--start` counts as 0, so `end ≤ start` is rejected whenever `--end` is given: "--end 1:00 must be after --start 2:00.", or "--end 0 must be after the start of the video." when there is no `--start`. Otherwise `-t 0` would write an empty file and count it as converted.
- **Warnings:** `Mode.warnings?: (options) => string[]` is new. `main` adds its result to `plan.warnings` before printing them, so they appear once, before any file runs. WAV and FLAC modes return "--bitrate is ignored for WAV, which is lossless." (or FLAC) when `--bitrate` is given.

### Extracting (`extractAudio(context, target)` in `src/video/audio.ts`)
1. `media = await probeMedia(ffmpeg, input.path, signal)`. No audio → `UserError("has no audio, so there's nothing to extract.")`.
2. **Range:**
   - `start = parseTime(--start) ?? 0`. With a known duration, `start ≥ duration` → `UserError("starts at 5:00, but the video is only 3:20 long. Choose a --start before 3:20.")`.
   - `end = min(parseTime(--end) ?? duration, duration)`. The `length` is `end − start` (unknown when neither the duration nor `--end` is known).
3. **Arguments:** `[-ss start] -i input [-t length] -map 0:a:0 -vn [-map_metadata -1 -map_chapters -1 for --strip-metadata] <codec> -f <muxer> <temporary path>`. `-ss` before `-i` seeks quickly, and is accurate because the audio is decoded and re-encoded.

   | Target | Codec arguments | Muxer |
   |---|---|---|
   | mp3 | `-c:a libmp3lame -b:a <bitrate>` | `mp3` |
   | m4a | `-c:a aac -b:a <bitrate>` | `ipod` |
   | ogg | `-c:a libvorbis -b:a <bitrate>`, or `libopus` when there is no `libvorbis` | `ogg` |
   | wav | `-c:a pcm_s16le` | `wav` |
   | flac | `-c:a flac -sample_fmt s16` | `flac` |

FLAC is made 16-bit like the WAV, so both hold exactly the same samples (FFmpeg would otherwise pick 24-bit for a floating-point source such as AAC).

   `encoders(ffmpeg)` runs `ffmpeg -hide_banner -encoders` once per FFmpeg path and keeps the list for that path, so OGG can check for `libvorbis`.
4. **Run:** in `context.save`, with progress over `length`. The error handling is the same as `convertToMp4`: aborts re-thrown, damaged text → `damagedFile`, other failures → "couldn't be converted by FFmpeg…".

The registry gives each audio mode `run: (context) => extractAudio(context, to)` through a lazy import, the shared `checkOptions`, and `warnings` for `wav`/`flac`.

### Audio files are recognised
`detectedFormats` in `src/detect.ts` gains `mp3`, `wav`, `flac`, `m4a` and `ogg`, with `file-type`'s `opus` (Ogg Opus) also counted as `ogg`. No mode accepts them, so:
- an audio file given directly gets the normal wrong-kind message,
- outputs from an earlier run found in a folder are skipped as "already an MP3" (feature 13's earlier-results rule), instead of failing as files konvertoj can't convert.

### Tests (`test/audio.test.ts`, skipped without FFmpeg, explicit timeouts)
- **Inputs** are made with FFmpeg: `testsrc2` plus a 440 Hz sine, 4 s and 180 s long (the 180 s one at 64 × 36 and 1 fps), a silent video, and a cut file.
- **Lengths** are read with `probeMedia` and must be within 0.1 s, or within 0.05 s for the "accurate to the second" checks.
- **Lossless check:** decode the WAV and the FLAC to raw `s16le` with FFmpeg and compare the bytes.
- **The OGG check** accepts Vorbis or Opus.

## Risks / Trade-offs

- [Opus in OGG where FFmpeg lacks Vorbis] → Players that support OGG support both codecs. It is recorded in Decisions.md.
- [MP3 lengths can differ by a frame (about 26 ms)] → Within the "accurate to the second" requirement.
