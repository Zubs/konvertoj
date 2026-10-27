# Tasks

## 1. FFmpeg module

- [x] 1.1 Add `src/video/ffmpeg.ts` with the download source table, `cacheFolder`, `ffmpegVersion` and `findFfmpeg` (returning `{ path, source }`, empty `KONVERTOJ_FFMPEG_PATH` as unset, its own `PATH` search with `path.delimiter` and `.exe`, rejecting only parsed majors below 5, nothing remembered) as in design.md; download the darwin-arm64 build once in a scratch folder and confirm its SHA-256 matches the table
- [x] 1.2 Add `installFfmpeg` (lock refreshed every 5 s and stale after 30 s, a waiting message, a second existence check after taking the lock, `fetch` and `pipeline` with the signal, temporary file and lock in `pendingTemporaryFiles`, a 30 s stall timeout, SHA-256 and gunzip into a temporary file, checksum check, `chmod`, atomic rename, clean-up in `finally`, and the couldn't-connect, stopped-part-way and checksum messages)
- [x] 1.3 Add `ensureFfmpeg` (found with its source, non-interactive message, prompt with the exact size, yes/no handling, Ctrl+C at the prompt as an interruption, explicit installs without a terminal printing only the saved line, download progress on standard error) and `runFfmpeg` (no shell, `-progress pipe:1`, numeric `out_time_us` progress, `N/A` ignored, kept standard error, kill on abort)

## 2. Command line

- [x] 2.1 Add `usesFfmpeg` to `Mode` and set it on every Video & Audio mode; add a registry test
- [x] 2.2 Handle `--install-video` in `main` next to `--version`, list it in the main help, call `ensureFfmpeg` before the batch for modes that use FFmpeg (not for dry runs), and add `ask`, `interactive`, `environment`, `home` and `ffmpegSource` to `MainOptions`, with `ask` filled by `start.ts` with `readline/promises` on stdin/stderr; run `npm run docs`

## 3. Tests

- [x] 3.1 Add `test/ffmpeg.test.ts`:
  - with no FFmpeg and the prompt declined, a test mode using FFmpeg fails with both routes and exit `1`,
  - fake FFmpeg 6 on the `PATH` is used without a download,
  - FFmpeg 4 is ignored and the download offered,
  - `KONVERTOJ_FFMPEG_PATH` wins over the `PATH`, and a broken one is named,
  - accepting downloads, verifies and saves from the local server and the work continues,
  - a second run uses the saved copy without asking,
  - cache folders for Windows, macOS and Linux, with and without `XDG_CACHE_HOME`,
  - two installs at once download once, and a stale lock from a killed run is cleared,
  - a version string such as `2024-05-13-git-…` is accepted,
  - a wrong checksum deletes the file and fails,
  - a download cut short leaves nothing and can be retried,
  - the prompt shows the size for the computer's key,
  - non-interactive runs fail mentioning `--install-video` and make no request,
  - `--install-video` downloads, and says it's already installed the second time,
  - an unreachable server gives the "couldn't connect" message and image modes still work,
  - an awkward file name reaches the fake FFmpeg as one argument,
  - `out_time_us` progress becomes a fraction,
  - Ctrl+C at the prompt or during the download (an `ask` that throws an abort, and an aborted signal) exits `130` with an empty cache,
  - the first-time scenario (prompt, accept, the mode runs FFmpeg)
  
  Verify the tests pass.

## 4. Decisions and final checks

- [x] 4.1 Add feature 14 entries to `Decisions.md`: the pinned release and published checksums; `--install-video` downloads without a prompt when there is no terminal; `--install-video` with an installed FFmpeg downloads nothing; the prompt is on standard error and Enter means yes; fake-FFmpeg tests are skipped on Windows; the download source is a parameter so tests use a local server; konvertoj searches the `PATH` itself so no `ffmpeg.exe` in the current folder runs; the real MP4 part of the first-time scenario is checked in feature 15, when `movtomp4` gets its conversion
- [x] 4.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.3 Tick "14. FFmpeg add-on" in the `Features.md` progress list
