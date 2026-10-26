## Why

konvertoj is run with `npx` on people's own computers, on Windows, macOS and Linux, on Intel and ARM processors, and on several Node.js versions. Today CI only runs the test suite from a checkout on three systems with Node.js 22. Nothing checks that the packed release installs and works on a clean computer, that a dependency hasn't made it much bigger, that `--help` stays instant, or that the video add-on downloads behind a company proxy (feature 18 in Features.md).

## What Changes

- A new CI job packs konvertoj with `npm pack`, installs the tarball into an empty folder on clean runners (Windows x64, macOS Intel, macOS Apple Silicon, Linux x64 and Linux arm64), each with Node.js 22, 24 and the latest version, and runs a smoke test.
- A smoke test script (`scripts/smoke.js`) runs the installed konvertoj: `npx` shows the help screen, `--help` responds in under half a second, and one conversion from each group (Image, PDF, GIF, Video & Audio, Tools) works, using a work folder whose name has a space and paths in the system's own form (backslashes on Windows).
- An install-size script (`scripts/install-size.js`) adds up the installed `node_modules` and fails above a budget of 150 MB. CI runs it after the clean install.
- The FFmpeg add-on download uses the standard `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` settings, through Node.js's built-in proxy support.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `package-distribution`: adds the clean-install smoke test, the install-size budget and the start-up time limit.
- `video-add-on`: the download honours the standard proxy settings.
- `development-workflow`: CI adds the packaging job across five systems and three Node.js versions.

## Impact

- `.github/workflows/ci.yml`: a new `package` job.
- `scripts/smoke.js`, `scripts/install-size.js`: new.
- `src/video/ffmpeg.ts`: proxy settings for the download.
- Tests: `test/package.test.ts` (install-size budget), `test/ffmpeg.test.ts` (proxy).
- No new dependencies.
