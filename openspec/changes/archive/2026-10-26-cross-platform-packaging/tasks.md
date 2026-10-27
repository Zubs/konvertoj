## 1. Proxy support

- [x] 1.1 In `src/video/ffmpeg.ts`, use the run's proxy settings for the download through `http.setGlobalProxyFromEnv` when it exists (typed check, looked up at download time), restoring the previous setting in a `finally` after the body has streamed; turn an invalid proxy value into the plain-English `UserError`; on a connection failure with a proxy setting, no runtime support and no `NODE_USE_ENV_PROXY`, add the advice
- [x] 1.2 In `test/ffmpeg.test.ts`, add the proxy tests from design.md with a local `CONNECT` proxy: `HTTP_PROXY` through the proxy, `NO_PROXY` direct, no setting direct, `HTTPS_PROXY` tunnel to `example.invalid:443`, invalid address message (skipped without the runtime API); and the older-Node.js advice with the API removed (always runs)

## 2. Packaging scripts

- [x] 2.1 Add `scripts/install-size.js` as in design.md
- [x] 2.2 Add `scripts/smoke.js` as in design.md, including the no-`-o` step, the reduced environment for video and the local proxy for `--install-video` (with `NODE_USE_ENV_PROXY=1` only when the runtime API is missing)
- [x] 2.3 In `test/package.test.ts`, test that `install-size.js` passes on a small folder and fails with `--budget` below its size, naming the size and the budget

## 3. CI

- [x] 3.1 Add the `package` job to `.github/workflows/ci.yml` with the runner and Node.js matrix, `fail-fast: false`, `shell: bash`, `cache: npm`, the tarball path from `package.json`'s version, the clean install, `npx --yes <tarball> --help` checked for `Usage:`, the proxy tests (`test/ffmpeg.test.ts`), the install-size check and the smoke test

## 4. Finish

- [x] 4.1 Run the smoke test and the install-size check locally against a clean install of the packed release
- [x] 4.2 Add feature 18 entries to `Decisions.md`: the 150 MB budget and how it is measured (with each system's figure once CI has run); `NO_PROXY` and the redirect host; proxy support through Node.js built-ins, with `NODE_USE_ENV_PROXY=1` for older Node.js 22; the smoke test checks `--help` timing on the installed copy; the runner names
- [x] 4.3 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 4.4 Tick "18. Cross-platform packaging" in the `Features.md` progress list
