# Launch checklist for 1.0.0

This is the final check of konvertoj against the goals in [Spec.md](../Spec.md) section 2, and the steps left before and after publishing 1.0.0.

Timings were measured on an Apple M1 Mac with Node.js 24.22.1, using a 12-megapixel (4032 × 3024) test photo with fine detail, which is harder to compress than most real photos.

## Goals

| Goal | Status | Evidence |
| --- | --- | --- |
| **Private** | Met | The only network access in konvertoj is the video add-on download in `src/video/ffmpeg.ts`, which only happens after the user agrees or runs `--install-video` (`test/ffmpeg.test.ts`: "never downloads in a non-interactive run", "explains both routes when the download is declined"). Image, PDF and GIF-from-image modes never touch the network, because that download is the only code that does; `test/gif.test.ts` and `test/ffmpeg.test.ts` check they work with no FFmpeg at all. |
| **Zero setup** | Met | CI's `package` job installs the packed release on clean Windows, macOS (Intel and Apple Silicon) and Linux (x64 and arm64) runners with Node.js 22, 24 and the latest version, and runs `npx` and one mode from each group (`scripts/smoke.js`). The video add-on is the one exception, as the spec allows. |
| **Simple by default** | Met | Every mode works with just a mode and a file; every option has a default (`test/readme-examples.test.ts` runs every example, most with no options). |
| **Safe** | Met | Originals are only read and outputs go through a temporary file (`test/output-files.test.ts`, `test/main.test.ts`); existing files get a new number unless `--overwrite` is given (`test/outputs.test.ts`); camera and location details are kept unless asked (`test/metadata.test.ts`); empty output folders konvertoj made are removed again (`test/pdf.test.ts`). |
| **Fast** | Met, just | `konvertoj --help` answers in about 0.05 s, most of which is Node.js itself starting. Converting the 12-megapixel photo: HEIC to JPG 0.9 s, JPG to PNG 0.7 s, JPG to WebP 1.0 s, compress 0.1 s (konvertoj's own "Done in" time). HEIC and WebP are right at the one-second mark on this computer, and will be slower on older ones. Video shows live progress and the time left (`test/video.test.ts`). |
| **Helpful** | Met | Errors are plain English and say how to fix them (`test/main.test.ts`, `test/detect.test.ts`, `test/suggest.test.ts`); stack traces only appear with `--verbose`. Paths outside the current folder are shown in full rather than as `../../…` (`test/paths.test.ts`). |
| **Scriptable** | Met | Exit codes `0`, `1`, `2` and `130`, plain output when piped, and `--json` for `info` and `colorpick` (`test/launcher.test.ts`, `test/runner.test.ts`, `test/info.test.ts`). |
| **Documented** | Met | The README has a tested example for every mode and is generated from the mode registry (`test/readme.test.ts`, `test/readme-examples.test.ts`); every mode has `-m <mode> --help`. |
| **Portfolio-ready** | Pending (maintainer) | Needs the published package, the demo GIF and the short write-up, below. |

## Feature 20

| Item | Status | Evidence |
| --- | --- | --- |
| Package details on npm | Met | `description`, `keywords`, `repository`, `homepage`, `bugs` and `publishConfig` are set (`test/package.test.ts`). |
| Version 1.0.0 | Met | `package.json`, `konvertoj --version`, and `npm pack --dry-run` (`test/package.test.ts`). |
| `npm audit` reports nothing | Met | `found 0 vulnerabilities`; CI's `check` job and the release workflow run `npm audit`. |
| Dependencies up to date | Met, with an exception | All in-range updates are applied. TypeScript stays at 6 (7 is a new compiler) and `@types/node` at 22 (konvertoj supports Node.js 22); see Decisions.md. |
| Publishing with provenance from a tag | Ready | `.github/workflows/release.yml`; nothing is published until the tag is pushed. |

## Before publishing

Do these in order, so the release workflow's dry run checks exactly what the tag will publish.

1. Record the demo with `npm run demo` (it needs [vhs](https://github.com/charmbracelet/vhs)), or download the GIF from the CI `demo` job. Commit `docs/demo.gif`, then run `npm run docs` and commit the README, which now shows the demo at the top.
2. Write the short write-up for your portfolio.
3. Put today's date on the CHANGELOG's `1.0.0` heading, for example `## 1.0.0 - 2026-11-02`, and commit. This is the last commit before the tag.
4. Check CI is green on every system for that commit.
5. Log in to npmjs.com (or create an account). Create a granular access token with read and write access to packages and "Bypass two-factor authentication" turned on, and save it in the GitHub repository as the `NPM_TOKEN` secret. Without the bypass the first publish fails with `EOTP`.
6. In GitHub, run the Release workflow by hand (Actions → Release → Run workflow). Check that every step passes and that the dry run lists `konvertoj@1.0.0` with only `package.json`, `README.md`, `LICENSE` and `dist/`.
7. Push the tag: `git tag v1.0.0 && git push origin v1.0.0`. The Release workflow checks everything again and publishes.

## After publishing

8. On npmjs.com, set up trusted publishing for the package: GitHub repository `Zubs/konvertoj`, workflow `release.yml`. Then delete the token and the `NPM_TOKEN` secret, and remove the `NODE_AUTH_TOKEN` line from `release.yml` so npm uses trusted publishing; later releases need no token.
9. Add the npm link (and a badge, if you like) to the README, now that the page exists.
10. On a clean computer with only Node.js 22, check `npx konvertoj@1.0.0 --version` prints `1.0.0`.
11. Ask someone else to convert an iPhone photo using only the README.
12. Tick "20. Launch readiness" in Features.md and change the stage in Spec.md from pre-release.
