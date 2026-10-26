# Proposal

## Why

Pulling the sound out of a recording, a talk turned into a podcast or a song from a video, is the other video job in Spec.md 5.5. The 35 audio modes are registered with `--bitrate`, `--start` and `--end`, but can't run. Feature 16 builds them on feature 14's FFmpeg and feature 15's media probe.

## What Changes

- **Modes:** `mp4tomp3`, `movtomp3`, `mp4towav` and every other `<video>to<audio>` pair (MOV, MKV, AVI, WebM, M4V and MP4 to MP3, WAV, M4A, OGG and FLAC), plus `tomp3`, `towav`, `tom4a`, `toogg` and `toflac` for any supported video.
- **Encoding:**
  - MP3 with LAME,
  - M4A with AAC,
  - OGG with Vorbis, or Opus when the FFmpeg in use has no Vorbis encoder,
  - WAV as 16-bit PCM,
  - FLAC.
  - The first audio stream is used, and the details are kept unless `--strip-metadata` is given.
- **`--bitrate 128k|192k|256k|320k`** applies to MP3, M4A and OGG (default `192k`). WAV and FLAC are lossless: with `--bitrate`, a warning says it is ignored, once, before the batch starts.
- **`--start` and `--end`** accept `90`, `1:30` or `1:02:30` (seconds may have decimals). `--start` alone runs to the end, and `--end` alone starts from the beginning.
  - An `--end` that isn't after `--start` is rejected before any file is read.
  - A `--start` at or past the end of a video fails for that video, giving its length.
  - Trimming is accurate to the second.
- **Progress:** a percentage and time left, based on the length of the part being extracted.
- **Errors:** a video with no audio track fails with "has no audio", and a damaged one with "looks damaged".
- **Mode warnings:** a mode can declare warnings about its options, printed with the existing warnings before the batch. The lossless formats use it for `--bitrate`.
- Tick "16. Audio from video" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `audio-extraction`: extracting audio to MP3, WAV, M4A, OGG and FLAC: codecs, bitrate, trimming, progress and failures.

### Modified Capabilities

- `mode-registry`: "Option value rules" covers `--start` and `--end` times.
- `command-line`: the "unchecked values pass through" example moves to `-o`, the last option without a rule, because `--start` and `--end` (shared with `togif`) are now checked. A new requirement covers mode warnings.

## Impact

- New source: `src/video/audio.ts`.
- Changed source:
  - `src/video/ffmpeg.ts`: an encoder list lookup, so OGG can pick Vorbis or Opus,
  - `src/modes/registry.ts`: `run`, `checkOptions` and `warnings` for the audio modes,
  - `src/modes/options.ts`: the time rule,
  - `src/main.ts`: prints mode warnings.
