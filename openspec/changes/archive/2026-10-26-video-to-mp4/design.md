# Design

## Context

Feature 14 gives every `usesFfmpeg` mode `context.ffmpeg` (the FFmpeg path) and `runFfmpeg(path, args, { signal, duration, onProgress })`, which runs without a shell, reports progress from `-progress pipe:1`, and rejects with FFmpeg's last standard-error lines. The MP4 modes are registered with `--quality` (`low|medium|high`, default `medium`), `--resolution` (`1080p|720p|480p`) and `--mute`. Feature 5's checks already detect MOV, MKV, AVI, WebM, M4V and MP4 by content, and make `tomp4` skip an MP4 without options. Probing the Homebrew FFmpeg 9 here showed:
- `ffmpeg -i <file>` prints `Duration: HH:MM:SS.xx`, `Stream #0:0…: Video: hevc …, 320x180 …` and `Display Matrix: rotation of 90.00 degrees` (FFmpeg 6 writes `displaymatrix: rotation of -90.00 degrees`),
- FFmpeg turns frames upright by default, so a 320 × 180 clip tagged 90° encodes to 180 × 320.

## Goals / Non-Goals

**Goals:**
- MP4s that play on every browser, Windows, macOS, Android and iOS: H.264 in `yuv420p`, AAC, and `faststart`.
- A media probe that features 16 and 17 reuse.

**Non-Goals:**
- Hardware encoders, two-pass encoding, subtitles, chapters, or keeping extra audio tracks. The first video and first audio stream are used.
- `ffprobe`, which isn't part of the add-on download.

## Decisions

### Probing (`probeMedia(ffmpeg, file)` in `src/video/ffmpeg.ts`)
- **How:** run `ffmpeg -hide_banner -i <file>` with no output (no shell, `windowsHide`, with the run's `signal`). It always exits with code 1. Its standard error is split on `/\r?\n/`:
  - `Duration: (\d+):(\d\d):(\d\d(?:\.\d+)?)` → seconds. `Duration: N/A`, common for recorded WebM files, leaves the duration unknown, and progress then shows no percentage,
  - the first `Stream #… Video: (\w+)` line → the codec. On that line, `, (\d{2,5})x(\d{2,5})` (anchored on the comma, so hex codec tags never match) → width and height,
  - `display ?matrix: rotation of (-?[\d.]+)` (any case), read only from the lines that belong to that first video stream, before the next `Stream #` line → the rotation. ±90 and ±270 swap the displayed width and height,
  - any `Stream #… Audio:` line → has audio.
- **Damaged:** only the error strings decide it: "Invalid data found", "moov atom not found" or "could not find codec parameters" → `damagedFile(error)`.
- **Result:** `{ duration?, video?: { codec, width, height }, hasAudio }`, with `width`/`height` as displayed.

### Converting (`convertToMp4(context)` in `src/video/mp4.ts`)
1. `probe = await probeMedia(context.ffmpeg, input.path)`. No `video` → `UserError("has no video. konvertoj turns videos into MP4s; for sound only, try -m tomp3.")`.
2. **Video filter:**
   - with `--resolution N` and `min(width, height) > N`, scale so the shorter side is N, keeping the shape. The filter is `scale=-2:N` when the displayed video is landscape, or `scale=N:-2` when portrait. `-2` keeps the other side even, as H.264 needs,
   - otherwise, with `--resolution`, note "kept at W × H, because --resolution only makes videos smaller",
   - otherwise, `scale=trunc(iw/2)*2:trunc(ih/2)*2`, because libx264 in FFmpeg 6 rejects odd widths and heights (common in screen recordings), while FFmpeg 9 quietly crops them,
   - always, `format=yuv420p`.
3. **Arguments:** `-i <input> -map 0:v:0 [-map 0:a:0?] -vf <filters> -c:v libx264 -preset medium -crf <28|23|18> -profile:v high -c:a aac -b:a 160k -movflags +faststart -f mp4 <temporary path>`.
   - `-map 0:a:0?` is left out for `--mute`, or when the input has no audio. Then `-an` is added.
   - Rotation needs no flags: FFmpeg's default auto-rotation turns the frames and writes no rotation tag.
4. **Run:** inside `context.save(async (temporaryPath) => runFfmpeg(context.ffmpeg, args, { signal: context.signal, duration: probe.duration, onProgress: context.progress }))`. `-f mp4` is needed because the temporary file ends in `.konvertoj-tmp`.
5. **No frames:** `runFfmpeg` now returns the last `frame=N` from its progress output, and puts the same count on its error when FFmpeg fails. When it is 0, whether FFmpeg succeeded or failed, the video stream had no frames: the save throws `UserError("has no video. …")`, so the empty temporary MP4 is removed.
6. **Errors:**
   - when `context.signal.aborted`, the error is re-thrown unchanged, so Ctrl+C is reported as an interruption and not as a failure,
   - an FFmpeg failure whose text says the input is invalid becomes `damagedFile(error)`,
   - other failures become `UserError("couldn't be converted by FFmpeg. Run again with --verbose for details.", { cause })`, so `--verbose` shows FFmpeg's own message.
7. **Ctrl+C:** aborting kills FFmpeg. `runFfmpeg` rejects, `writeOutputFile` removes the temporary file, and the runner records the interruption.

The registry gives each MP4 mode `run: async (context) => (await import("../video/mp4.js")).convertToMp4(context)`.

### One file at a time
`runBatch` uses a limit of 1 when `mode.usesFfmpeg`, else `parallelLimit()`. The progress line already shows "Converting 3/10… 45%, about 20 seconds left".

### Test media and CI
- **`test/fixtures/clip.mov`:** made once with the local FFmpeg. It is 2 s of `testsrc2` at 320 × 180 in HEVC (`hvc1`), with AAC sine audio, remuxed with `-display_rotation 90`. The command is recorded in a new `test/fixtures/README.md`.
- **Other inputs** are made in the tests with the FFmpeg that konvertoj finds (`findFfmpeg(defaultSettings())`):
  - 1 s and 3700 s clips (the long one at 64 × 36 and 1 fps, so it encodes in seconds),
  - a 3840 × 2160 one-second clip at 2 fps,
  - an 854 × 480 clip,
  - a silent clip,
  - an audio-only MP4,
  - MKV (H.264), AVI (MPEG-4), WebM (VP9 when `libvpx-vp9` exists, else VP8) and M4V files,
  - a MOV cut in half,
  - a zero-frame video: an MKV written with `-frames:v 0`,
  - a WebM without a duration: VP8/VP9 piped out of FFmpeg with `-f webm pipe:1` into a file, which then shows `Duration: N/A`.
  
  The whole file is skipped (`describe.skipIf`) when no FFmpeg is found. The path found is passed to `main` as `KONVERTOJ_FFMPEG_PATH` in the test environment, because the shared test helper gives `main` a temporary home folder, where no cached copy exists.
- **Timeouts:** the video tests get explicit timeouts (60 s, and 180 s for the hour-long and 4K clips), so slower CI machines pass.
- **The cut MOV** is written without `faststart`, so its `moov` index is at the end, and cutting it in half removes the index and makes it really unreadable.
- **Checks** use `probeMedia`, plus a scan of the output's top-level MP4 boxes for `moov` before `mdat`. Codec names and the pixel format are read from the probe's stream line.
- **CI:** the `check` job runs `npm run build` and `node dist/cli.js --install-video` before `npm test`. On a runner without FFmpeg, the explicit install downloads and verifies the pinned build. On one that already has FFmpeg 5 or newer, it downloads nothing. Either way the tests then find an FFmpeg.

### Decisions log
- A 0-byte file says "is empty" (feature 5), not "has no video".
- Video runs one file at a time.
- AAC is at 160 kb/s.
- The first video and audio streams are kept.
- `--resolution` limits the shorter side, so portrait videos work.

## Risks / Trade-offs

- [FFmpeg's text output could change between versions] → Both rotation spellings are handled, and the parsing is covered by tests running against the FFmpeg on each CI system.
- [CI may download 20–30 MB per run] → Only on runners without FFmpeg 5 or newer, where it also tests the real download and checksum path.
- [libx264 at `medium` on a long 4K video is slow] → That's expected for video, and the progress shows the time left.
