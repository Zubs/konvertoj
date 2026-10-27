# Design

## Context

The 41 Video & Audio modes are registered without a `run`, so they say "isn't available yet" today. `main` handles `--version` and `--list-modes` before any mode, and checks options before inputs. `start.ts` builds the output streams, handles Ctrl+C, and reports unexpected errors. The reporter already shows per-job progress (`progress(fraction)`) with time left. The `ffmpeg-static` package downloads builds from `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-<platform>-<arch>.gz`, and GitHub publishes each asset's SHA-256 (gathered for every build of that release).

## Goals / Non-Goals

**Goals:**
- No FFmpeg code or download unless a mode needs it.
- Never a surprise download, and never an unverified or half-written binary.
- Everything testable without downloading tens of megabytes: the downloader takes its source as a parameter, so tests serve a small gzipped file from a local HTTP server.

**Non-Goals:**
- The video and audio conversions themselves (features 15 to 17). This feature only makes FFmpeg available and runnable.
- Proxies (feature 18) and updating a downloaded copy to a newer release.

## Decisions

### Download sources
A table in `src/video/ffmpeg.ts`, keyed by `${process.platform}-${process.arch}`:

| Key | gz bytes | SHA-256 of the .gz |
|---|---|---|
| darwin-arm64 | 19246198 | 8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa |
| darwin-x64 | 25296431 | 929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106 |
| linux-arm | 19167563 | 64b115a12f0ab77c277e3c418aae8b40ef881e75e746a0e2d066a206b9bc5172 |
| linux-arm64 | 25568691 | 754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0 |
| linux-ia32 | 22184031 | 169b27c078a8ecedb814cac67afccf15a9868d63e9d74ef86088adefaa500d00 |
| linux-x64 | 29354986 | bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa |
| win32-x64 | 29581307 | 8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77 |

- The URL is `<release>/ffmpeg-<key>.gz`.
- The prompt's size is `formatSize(bytes)`, e.g. 18 MB.
- An unknown key → "konvertoj has no FFmpeg download for this computer (<platform> <arch>). Install FFmpeg yourself from https://ffmpeg.org/download.html, or point KONVERTOJ_FFMPEG_PATH at it."
- During implementation, one build is downloaded once and hashed, to confirm the published digest matches the file.

### Finding (`findFfmpeg(environment)`)
It returns `{ path, source }`, where `source` is `chosen`, `installed` or `cached`, so `--install-video` can say where FFmpeg came from. Nothing is remembered between calls: `main` calls it once per command, and tests run many commands with different environments in one process.

1. **`KONVERTOJ_FFMPEG_PATH`** (an empty value counts as unset):
   - run it with `-version` (via `execFile`, no shell, 10 s timeout),
   - if that fails, or prints no `ffmpeg version`, → `UserError("KONVERTOJ_FFMPEG_PATH is set to <path>, which isn't a working FFmpeg. Fix or unset it.")`,
   - its version isn't checked, because the user chose it.
2. **`ffmpeg` on the `PATH`:** konvertoj searches the `PATH` folders itself, split with `path.delimiter`, for `ffmpeg` (or `ffmpeg.exe` on Windows), and runs the first that exists with `-version`. libuv would also look in the current folder first on Windows, so an `ffmpeg.exe` sitting next to the user's videos could be run. Searching only the `PATH` prevents that.
   - If the first line has `ffmpeg version n?(\d+)\.` with a major version below 5, it is ignored.
   - Any other version string (`6.1`, `N-…` git builds, dated builds such as `2024-05-13-git-…`) is accepted.
   - No FFmpeg, or one that fails to run, falls through.
3. **The cache:** `<cache>/ffmpeg-b6.1.1` (plus `.exe` on Windows) is used if it exists.

Each found path is returned with its source.

### Cache folder (`cacheFolder(environment, platform, home)`)
- **win32:** `LOCALAPPDATA` or `<home>/AppData/Local`, plus `konvertoj`.
- **darwin:** `<home>/Library/Caches/konvertoj`.
- **Others:** `XDG_CACHE_HOME` (when set and absolute) or `<home>/.cache`, plus `konvertoj`.

The environment and home folder are parameters, so the tests cover all three systems.

### Installing (`installFfmpeg({ source, folder, onProgress, signal })`)
1. `mkdir -p folder`.
2. **Lock:** take `<final>.lock` with `open(lock, "wx")`.
   - While the download runs, the lock's modification time is refreshed every 5 seconds.
   - If the lock exists and was refreshed in the last 30 seconds, another run is downloading. konvertoj prints "Another konvertoj is downloading the video add-on. Waiting for it to finish…" once on standard error, then checks every 500 ms until the final file exists (return it) or the lock goes away (try again).
   - A lock not refreshed for 30 seconds is stale (its run was killed) and is removed. Its time is checked again just before removing it, so two waiters don't remove a lock another run has just taken.
   - After taking the lock, konvertoj checks again whether the final file now exists, and returns it if so, because another run may have finished just before. This also avoids renaming over a file in use on Windows.
3. **Download and unpack:**
   - `fetch(source.url, { signal })`, which follows GitHub's redirects. A response that isn't OK → a download error,
   - the body streams through a SHA-256 hash (of the `.gz` bytes) and `zlib.createGunzip()` into `<folder>/.ffmpeg-<random>.download`, using `pipeline` with the same `signal`,
   - the temporary file and the lock are added to `pendingTemporaryFiles`, so a second Ctrl+C, which exits at once, still removes them,
   - a stall timer aborts the download if no bytes arrive for 30 seconds,
   - `onProgress(received, source.bytes)` reports progress.
4. **Verify:** if the hash isn't `source.sha256`, the temporary file is deleted → "The video add-on download didn't match its checksum, so it was deleted. Try again later, or install FFmpeg yourself."
5. **Save:** `chmod 0o755`, then `rename` to the final path (atomic in the same folder).
6. **Clean up:** in `finally`, the temporary file (if still there) and the lock are removed. A failure therefore leaves nothing behind, and the next run offers the download again.
7. **Errors:**
   - any rejection from `fetch` itself (DNS, refused, connect timeout, …) → "konvertoj couldn't connect to download the video add-on. Check your internet connection, then run konvertoj --install-video, or install FFmpeg yourself from https://ffmpeg.org/download.html.",
   - any error while reading the body or unpacking it (a socket closed part-way, "unexpected end of file", the stall timeout) → "The video add-on download stopped part-way, so nothing was saved. Try again, or install FFmpeg yourself from https://ffmpeg.org/download.html.",
   - an aborted `signal` (Ctrl+C) → the abort error. `ensureFfmpeg` runs in `main` before the batch, and for `--install-video`, so `main` catches the abort around both calls: the partial download is already gone through `finally`, `main` prints "Stopped. Nothing was downloaded." on standard error and returns `130`.

### Ensuring (`ensureFfmpeg({ ask, interactive, explicit, err, environment, home, source, signal })`)
- **Found** → `{ path, source }`. After a download, `source` is `downloaded`.
- **Not found, not interactive, not explicit** → "Video and audio need FFmpeg, and konvertoj won't download it without asking. Run konvertoj --install-video first, or install FFmpeg yourself from https://ffmpeg.org/download.html." This is a `UserError`, so the exit code is `1`.
- **Interactive** → `ask("Video and audio need a one-time download of 18 MB (FFmpeg, from github.com/eugeneware/ffmpeg-static, GPL-licensed). Continue? (Y/n) ")`.
  - An empty answer, or one starting with `y`, means yes.
  - Anything else → "Not downloading. Video and audio need FFmpeg: run konvertoj --install-video when you're ready, or install FFmpeg yourself from https://ffmpeg.org/download.html."
- **Explicit `--install-video` without a terminal** → download without asking.
- **While downloading in a terminal**, a one-line `Downloading the video add-on… 7.2 MB of 18 MB` on standard error, redrawn at most every 100 ms, and then `Saved the video add-on to <path>.` Without a terminal (an explicit install from a script), only the `Saved …` line is printed.
- **Ctrl+C at the prompt:** `readline` puts the terminal in raw mode, so Ctrl+C reaches readline rather than the process. The question is asked with the run's `signal`, and readline's own `SIGINT` aborts it. Either counts as an interruption: konvertoj exits with `130` without downloading.

### Where it's called
- **`Mode.usesFfmpeg?: true`** is set on every Video & Audio mode.
- **In `main`,** after inputs and outputs are planned and the mode has a `run`, but before `runBatch`:
  - when `mode.usesFfmpeg` and it isn't a dry run, `await ensureFfmpeg(...)`,
  - a `UserError` fails the command once, with exit code `1`, before any file is processed.
- **`--install-video`** is handled next to `--version`. It calls `ensureFfmpeg` with `explicit: true`.
  - If FFmpeg was found rather than downloaded: "FFmpeg is already installed at <path>, so there's nothing to download." (or "The video add-on is already installed at <path>." for the cached copy), with exit code `0`.
- **`MainOptions` gains:**
  - `ask?: (question: string) => Promise<string>` and `interactive?: boolean`,
  - `environment?: NodeJS.ProcessEnv` (default `process.env`) and `home?: string` (default `os.homedir()`), which decide the `PATH`, `KONVERTOJ_FFMPEG_PATH` and the cache folder,
  - `ffmpegSource?: DownloadSource` (default: the table entry for this computer).
  
  Tests use them to point at a fake `PATH`, a temporary cache and the local HTTP server.
  - `start.ts` sets `interactive = process.stdin.isTTY && process.stderr.isTTY`.
  - `ask` uses `readline/promises` on stdin and stderr, so standard output stays clean.
  - Tests pass their own `ask`.

### Ctrl+C wording
The first Ctrl+C now prints "Stopping. Press Ctrl+C again to stop at once." because it can also arrive during the prompt or the download, before any file is in progress.

### Running (`runFfmpeg(path, args, { signal, duration, onProgress })`)
- **Process:** `spawn(path, ["-hide_banner", "-nostdin", "-y", "-progress", "pipe:1", "-nostats", ...args], { shell: false, windowsHide: true })`.
- **Progress:** standard output is read line by line. `out_time_us=N` with a numeric `N` gives `onProgress(min(1, N / 1e6 / duration))` when a duration is known. `N/A` is ignored.
- **Errors:** standard error is kept (its last 4 KB). A non-zero exit → an `Error` holding that text, which feature 15's caller maps to friendly messages, and which `--verbose` shows.
- **Ctrl+C:** an aborted `signal` kills the process, and the promise rejects.

`ffmpegVersion(path)` and `runFfmpeg` share the same no-shell `execFile`/`spawn` style.

### Tests
- **Fake FFmpeg:** small executable shell scripts written into a temporary `bin` folder put first on the `PATH`. They print `ffmpeg version 6.1.1 …` or `ffmpeg version 4.4 …`, or echo their arguments and `out_time_us` lines. They are skipped on Windows, where a fake executable can't be a script (Node.js no longer runs `.cmd` files without a shell). The no-shell rule and the Windows cache path are still tested there through the pure functions.
- **Downloads:** a `node:http` server on `127.0.0.1` serves a gzipped fake binary for `installFfmpeg` with a matching or wrong `sha256`, can cut a response short, and counts requests for the two-at-once test.
- **Prompt:** `main` is called with a scripted `ask`, `interactive: true`, a temporary cache home and an empty `PATH`.

## Risks / Trade-offs

- [GitHub release files could disappear] → The checksums make tampering impossible, but not unavailability. The failure message then points to installing FFmpeg, and the release tag can be updated in a later version.
- [Scripts can't be fake executables on Windows] → Windows still runs the cache-folder, source-table, download and no-shell tests. Only the fake-binary detection tests are skipped there.
- [`ffmpeg` builds from distributions with unusual version strings] → Anything that isn't clearly older than 5 is accepted.
- [Windows on Arm has no build in the release] → It gets the "no download for this computer" message, pointing to installing FFmpeg or `KONVERTOJ_FFMPEG_PATH`.
