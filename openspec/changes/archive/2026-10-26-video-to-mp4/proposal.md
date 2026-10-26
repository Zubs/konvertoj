# Proposal

## Why

iPhone videos are MOV files, often HEVC, that many apps, older Windows PCs and Android phones won't play. Converting MOV and other common video formats to an MP4 that plays everywhere is the main video job in Spec.md 5.5. Feature 14 makes FFmpeg available, and this feature uses it.

## What Changes

- **Modes** `movtomp4`, `mkvtomp4`, `avitomp4`, `webmtomp4`, `m4vtomp4` and `tomp4` convert to MP4 with H.264 video (`yuv420p`, so every player can decode it) and AAC audio. HEVC iPhone video is always re-encoded. `-movflags +faststart` puts the index first, so playback can start before the file has fully downloaded.
- **`--quality low|medium|high`** sets CRF 28, 23 and 18 (default `medium`).
- **`--resolution 1080p|720p|480p`** only ever scales down, so the video's shorter side is at most that number, keeping the shape. A video already that small keeps its size, with a note.
- **`--mute`** drops the audio. A video with no audio converts without errors.
- **Rotation is kept:** a phone video filmed upright comes out upright, because FFmpeg turns the frames using the rotation tag.
- **Progress:**
  - FFmpeg's progress shows as a percentage and time left on the progress line,
  - video files run one at a time, since FFmpeg already uses every core, so the bar shows the overall count and the current file's percentage.
- **Odd sizes** are trimmed to even ones, because H.264 needs them.
- **Errors:**
  - a file with no video stream, or a video stream with no frames, fails with "has no video",
  - a damaged one with "looks damaged",
  - a 0-byte file still fails with feature 5's "is empty" (see Decisions.md),
  - Ctrl+C stops FFmpeg and removes the half-written MP4.
- **`tomp4`** skips an MP4 unless a conversion option is given, as for other `to<format>` modes.
- **Fixture and CI:**
  - a small iPhone-style HEVC MOV with a rotation tag and AAC audio is added as `test/fixtures/clip.mov`. Other test videos are made with FFmpeg in the tests,
  - CI runs `konvertoj --install-video` before the tests on every system, so video tests run everywhere (with the downloaded add-on, or the runner's own FFmpeg if it has one),
  - video tests are skipped where no FFmpeg is found.
- Tick "15. Video to MP4" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `video-conversion`: video to MP4: codecs, quality, resolution, mute, rotation, progress, and empty, damaged and video-less inputs.

### Modified Capabilities

- `batch-runner`: "Limited parallel work" runs modes that use FFmpeg one file at a time.
- `development-workflow`: "Continuous integration on three systems" installs the video add-on before the tests.

## Impact

- New source: `src/video/mp4.ts` (probing with FFmpeg's own output, building the arguments, running), plus a shared `probeMedia` in `src/video/ffmpeg.ts`.
- Changed source: `src/modes/registry.ts` (`run` for the MP4 modes), `src/runner.ts` (one at a time for FFmpeg modes).
- Changed CI: `.github/workflows/ci.yml` gains a build and `--install-video` step before `npm test`.
- New fixture: `test/fixtures/clip.mov` (about 65 KB).
