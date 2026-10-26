# Proposal

## Why

Video, audio and video-to-GIF modes (features 15 to 17) need FFmpeg. Spec.md 5.7 keeps konvertoj small for everyone else: FFmpeg isn't part of the main download. konvertoj uses one that is already installed, or offers a one-time, verified download the first time it's needed, saved for every later run, including `npx`. Image and PDF modes are never affected.

## What Changes

- **Finding FFmpeg**, in this order:
  1. `KONVERTOJ_FFMPEG_PATH`, if set (it must point at a working FFmpeg),
  2. `ffmpeg` on the `PATH`, if it is version 5 or newer,
  3. the copy konvertoj downloaded before, in the user's cache folder: `%LOCALAPPDATA%\konvertoj` on Windows, `~/Library/Caches/konvertoj` on macOS, and `$XDG_CACHE_HOME/konvertoj` or `~/.cache/konvertoj` on Linux.
- **Offering the download.** When none is found, an interactive run asks once, before the batch starts:
  *"Video and audio need a one-time download of 18 MB (FFmpeg, from github.com/eugeneware/ffmpeg-static, GPL-licensed). Continue? (Y/n)"*. The size is the exact download for the computer's system and processor.
- **The download:**
  - comes from the pinned `ffmpeg-static` b6.1.1 release builds (Windows x64, macOS x64 and Apple Silicon, Linux x64, arm64, arm and ia32),
  - is checked against SHA-256 checksums stored in konvertoj before use,
  - is unpacked and saved atomically,
  - is guarded by a lock file, so two runs at the same time don't both download or corrupt the saved copy,
  - leaves nothing behind when it fails part-way or doesn't match its checksum, so the next run offers it again.
- **No download without asking.** Non-interactive runs (scripts, CI) never prompt or download. They fail with instructions to run `konvertoj --install-video` first, or to install FFmpeg.
- **Declined or offline:** konvertoj explains both routes, `--install-video` later or installing FFmpeg yourself, and exits with `1`. Image and PDF modes keep working.
- **`konvertoj --install-video`:**
  - downloads the add-on in advance, after the same prompt,
  - an explicit `--install-video` in a non-interactive run downloads without prompting, because the user asked for it,
  - when a usable FFmpeg (installed, or downloaded before) is already there, it says so and downloads nothing.
- **Running FFmpeg:** as a separate process with an argument list, never through a shell, so names with spaces or quotes are safe. Its progress output is read as the share of the input's duration done, which the existing reporter shows as a percentage and time left.
- **Registry:** modes that need FFmpeg declare it (`usesFfmpeg`), so `main` makes sure FFmpeg is available before the batch. Every Video & Audio mode declares it. `togif` decides per input in feature 17.
- Tick "14. FFmpeg add-on" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `video-add-on`: finding FFmpeg, the cache folder, the prompt, the verified download, `--install-video`, non-interactive and offline behaviour, and running FFmpeg safely.

### Modified Capabilities

- `command-line`: a new requirement for the `--install-video` command, which the main help lists.
- `mode-registry`: a new requirement that the Video & Audio modes are marked as needing FFmpeg.

## Impact

- No new npm dependencies. The download uses Node.js's built-in `fetch`, `zlib`, `crypto` and `fs`. The builds are downloaded at run time from GitHub, as `ffmpeg-static` does, and are not bundled.
- New source: `src/video/ffmpeg.ts`, with finding, the cache folder, downloading, the lock, `ensureFfmpeg` and `runFfmpeg`.
- Changed source:
  - `src/main.ts` and `src/start.ts`: `--install-video`, the prompt (stdin through `node:readline/promises`) and ensuring FFmpeg before batches,
  - `src/modes/registry.ts`: `usesFfmpeg`,
  - `src/help.ts`: `--install-video` in the main help.
- Proxies (`HTTPS_PROXY`) are feature 18.
