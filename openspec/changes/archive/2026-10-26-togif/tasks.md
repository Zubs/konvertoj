# Tasks

## 1. Registry and running

- [x] 1.1 Let `usesFfmpeg` be `true` or a function of the inputs; add `needsFfmpeg(mode, inputs)`; use it in `main` and `runBatch`; give `togif` its input-based function and the time-range `checkOptions`; reword `gifWidth` to "Width in pixels (videos default to 480)"; move the "isn't available yet" tests to a test-only mode
- [x] 1.2 Add `src/video/gif.ts` with `makeGif` as in design.md (image path through `convertImage`, leaving out a `--width` that would enlarge with a togif-specific note, video-only options rejected, a GIF given only video options skipped as already a GIF, video path with the probe, section, 30-second limit and `--force`, never-enlarging width, palette filter graph from the chosen stream to `[out]`, `-t` before `-i`, `-loop 0`, progress over the GIF's length, error mapping, the honest message when a mis-named video has no FFmpeg); give `togif` a lazy `run`; run `npm run docs`

## 2. Tests

- [x] 2.1 Add `test/gif.test.ts`:
  - a 0-byte file "is empty",
  - a PNG gives a still GIF, and an animated WebP keeps its frames, both with no FFmpeg available,
  - a 5-second MP4 gives a looping GIF 480 wide at about 10 fps,
  - a folder of clips gives one GIF each,
  - `--fps 1` and `30` work, and `0` and `31` fail,
  - `--speed 2` halves the length, and `0.4` and `5` fail,
  - `--start 0:02 --end 0:05` gives about three seconds,
  - 31 seconds is refused with a tip, 30 is accepted, and `--force` allows 31,
  - a video needs FFmpeg (non-interactive with none mentions `--install-video`) while an image doesn't,
  - the palette GIF is closer to the source than a plain conversion,
  - `--fps` on an image fails, and an earlier GIF in a folder re-run with `--fps` is skipped,
  - `--width 2000` on a small PNG keeps its size with a note, and `--width 10` makes it 10 wide,
  - the screen-recording scenario
  
  Verify the tests pass.

## 3. Decisions and final checks

- [x] 3.1 Add feature 17 entries to `Decisions.md`: the 30-second limit is on the chosen section before `--speed`; `--width` also resizes image GIFs and never enlarges; GIF inputs given only video options are skipped as already GIFs; FFmpeg is needed only when an input has a video extension; the "isn't available yet" rule is kept for future modes
- [x] 3.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 3.3 Tick "17. GIF (`togif`)" in the `Features.md` progress list
