# Tasks

## 1. Probe and convert

- [x] 1.1 Add `probeMedia` to `src/video/ffmpeg.ts` (signal, no shell, `windowsHide`, `\r?\n` lines, optional duration with `N/A`, first video codec and comma-anchored displayed size, rotation from that stream only in both spellings, audio presence, damage only from error strings); make `runFfmpeg` return the last `frame=` count; add unit tests on captured FFmpeg 6 and 9 output text, including `Duration: N/A`
- [x] 1.2 Add `src/video/mp4.ts` with `convertToMp4` as in design.md (has-no-video message for no stream and for zero frames, resolution filter on the shorter side with the kept-size note, even-size trimming otherwise, `yuv420p`, libx264 CRF by quality, AAC or `-an`, `+faststart`, `-f mp4` into the temporary path, progress, aborts re-thrown unchanged, damaged and FFmpeg-failure mapping); give the six MP4 modes lazy `run`s
- [x] 1.3 Make `runBatch` process one item at a time for `usesFfmpeg` modes; add a runner test

## 2. Fixture and CI

- [x] 2.1 Make `test/fixtures/clip.mov` with the local FFmpeg as in design.md and record the commands in `test/fixtures/README.md`
- [x] 2.2 Add `npm run build` and `node dist/cli.js --install-video` before `npm test` in the CI `check` job

## 3. Tests

- [x] 3.1 Add `test/video.test.ts` (skipped when no FFmpeg is found; the found path passed as `KONVERTOJ_FFMPEG_PATH`; explicit 60 s / 180 s timeouts):
  - a video-less file fails with "has no video", and a 0-byte one with "is empty",
  - the iPhone MOV becomes H.264 `yuv420p` with AAC and `moov` before `mdat`,
  - a folder of MOVs converts one at a time,
  - `--resolution 720p` on 4K gives 1280 × 720, and on 480p keeps the size with a note,
  - `--quality high` is bigger than `low`,
  - 1 s and over-an-hour clips convert with matching durations,
  - the upright fixture comes out 180 × 320,
  - a silent video converts,
  - `--mute` drops the audio,
  - MKV, AVI, WebM and M4V convert with `tomp4`,
  - `--resolution 4k` and `--quality max` list the allowed values,
  - a cut MOV (written without faststart) "looks damaged",
  - a video stream with no frames fails with "has no video",
  - a 321 × 181 video becomes 320 × 180,
  - a WebM with `Duration: N/A` converts,
  - Ctrl+C on a long conversion leaves no temporary file,
  - the progress line shows a percentage in a terminal-like reporter,
  - the holiday-folder scenario
  
  Verify the tests pass.

## 4. Decisions and final checks

- [x] 4.1 Add feature 15 entries to `Decisions.md` (from design.md's decisions log)
- [x] 4.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.3 Tick "15. Video to MP4" in the `Features.md` progress list
