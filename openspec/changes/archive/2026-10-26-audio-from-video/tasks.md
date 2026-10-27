# Tasks

## 1. Times and options

- [x] 1.1 Add `src/video/times.ts` with `parseTime` and `formatTime`; declare the time pattern rule on `start` and `end`; add unit tests
- [x] 1.2 Add `Mode.warnings` and print its result with the plan warnings in `main`; add the audio modes' `checkOptions` (end after start, with a missing start counting as 0) and the WAV/FLAC `--bitrate` warning; update the command-line pass-through test to use `-o`

## 2. Extraction

- [x] 2.1 Add `encoders(ffmpeg)` (one lookup per FFmpeg path) to `src/video/ffmpeg.ts`, and add `mp3`, `wav`, `flac`, `m4a` and `ogg` (with `opus` as `ogg`) to `detectedFormats`
- [x] 2.2 Add `src/video/audio.ts` with `extractAudio` as in design.md (has-no-audio, start past the end with the video's length, `-ss`/`-t` range, first audio stream, codec and muxer table with Vorbis-or-Opus and 16-bit FLAC, bitrate, `--strip-metadata` removing details and chapters, progress over the extracted length, error mapping); give the 35 audio modes lazy `run`s; run `npm run docs`

## 3. Tests

- [x] 3.1 Add `test/audio.test.ts` (skipped without FFmpeg; the found FFmpeg passed as `KONVERTOJ_FFMPEG_PATH`; explicit timeouts):
  - a silent video fails with "has no audio",
  - one MP4 gives an MP3 of the same length,
  - a folder of videos all extract to MP3,
  - every format has its codec, and WAV and FLAC decode to the same samples,
  - 320k is bigger than 128k, and 100k lists the allowed values,
  - `towav --bitrate` warns once,
  - `--start 0:30 --end 2:15` gives 1:45,
  - `--start` alone and `--end` alone,
  - `90`, `1:30` and `0:01:30` give the same result,
  - `--end` before `--start`, and `--end 0` alone, are rejected, and `--start` past the end gives the video's length,
  - running `tomp3` on a folder a second time skips the earlier MP3s, and an MP3 given to `towav` says konvertoj doesn't convert between audio formats,
  - a damaged video "looks damaged",
  - the podcast scenario
  
  Verify the tests pass.

## 4. Decisions and final checks

- [x] 4.1 Add feature 16 entries to `Decisions.md`: OGG uses Opus when FFmpeg has no Vorbis; WAV and FLAC are 16-bit; the first audio stream is used; `--start`/`--end` rules now apply to `togif` too
- [x] 4.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.3 Tick "16. Audio from video" in the `Features.md` progress list
