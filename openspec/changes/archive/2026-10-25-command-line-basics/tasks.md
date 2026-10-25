# Tasks

## 1. Mode registry

- [x] 1.1 Add `src/modes/formats.ts` with the image input (jpg, png, webp, avif, gif, tiff, bmp, ico, heic, svg), image output (jpg, png, webp, avif, gif, tiff, bmp, ico), video input (mov, mkv, avi, webm, m4v, mp4) and audio output (mp3, wav, m4a, ogg, flac) lists, each format with a display label; verify `npm run check` passes
- [x] 1.2 Add `src/modes/options.ts` with named option definitions (name, kind `flag` or `value`, explanation, optional short letter, default and rule as `{ choices }` or `{ min, max?, wholeNumber }`), separate definitions where a name's meaning differs (image and video `--quality`, resize and enlarge `--scale`, PDF and SVG `--dpi`), the seven common options, and every rule listed in design.md; verify `npm run check` passes
- [x] 1.3 Add `src/modes/registry.ts` building all modes in group order (72 image pairs, 7 image `to<format>`, 19 PDF, `togif`, 41 video and audio, 9 tools), each with inputs, output, options, description and examples, plus `findMode(name)`; verify `npm run check` passes
- [x] 1.4 Add `test/registry.test.ts` covering the mode-registry spec: group membership and order, name pattern and uniqueness, no `jpeg`/`tif`, the per-group counts and named modes that must and mustn't exist, every mode documented with an example starting `konvertoj -m <name>`, common options on every mode, the `rotate`/`heictojpg`/`pngtoico`/`compress` option checks, no option name used as both flag and value, the declared rules from the "Option value rules" scenario, and every default passing its own rule; verify it passes with `npx vitest run test/registry.test.ts`

## 2. Mode suggestions

- [x] 2.1 Add `src/modes/suggest.ts` with the normalisation (case, `-`, `_`, spaces, `2`→`to`, `jpeg`/`tif`/`heif` aliases), the HEIC/SVG input-only check with its `jpg`/`png` replacement suggestion, and the optimal string alignment distance with the "at most 2 and at most a third of the length" limit; verify `npm run check` passes
- [x] 2.2 Add `test/suggest.test.ts` checking `heic2jpg`, `heic-to-jpg`, `HEICtoJPG` and `heictojgp` suggest `heictojpg`, `jpegtopng` suggests `jpgtopng`, `pngtotif` suggests `pngtotiff`, `banana` and `x` suggest nothing, `pngtoheic`, `toheif` and `png2heic` give the HEIC input-only result (`pngtoheic` suggesting `pngtojpg`), `jpgtosvg` and `tosvg` give the SVG one suggesting `jpgtopng` and `topng`, and `pngtosvg` gives it with no suggestion; verify it passes

## 3. Help text

- [x] 3.1 Add `src/help.ts` producing the main help (what konvertoj does, command shape, common examples, common options, pointers to `--list-modes` and `-m <mode> --help`), the grouped mode list, and a mode's help (name, description, inputs, output, options with defaults, common options, examples); verify `npm run check` passes
- [x] 3.2 Add `test/help.test.ts` checking the main help contains `konvertoj -m <mode> <input>` and `--list-modes`, the mode list has the five headings in order with every mode exactly once under its group, and `heictojpg` help contains its description, `--quality` with `(default: 80)`, `--overwrite` and an example starting `konvertoj -m heictojpg`; verify it passes

## 4. Command handling

- [x] 4.1 Add `src/main.ts` exporting `main(args, output)` with `parseArgs` (`strict: false`, `tokens: true`, `allowPositionals`) and the handling order from design.md: `--version` from `package.json`, `--list-modes`, main help, missing-mode errors with the command shape, unknown mode with suggestion or `--list-modes` pointer, mode help, option checks (unknown option, option from another mode, missing value, unexpected value), value checks against each option's rule with the messages from design.md, then the mode's runner or "<mode> isn't available yet."; verify `npm run check` passes
- [x] 4.2 Change `src/cli.ts` to dynamically import `./main.js` after the version check, write to stdout and stderr and set `process.exitCode`; verify `npm run build` succeeds and `node dist/cli.js --version` prints `0.0.0`
- [x] 4.3 Add `test/main.test.ts` calling `main` with a fake output to cover the command-line spec: no arguments and `-h`/`--help` give help with exit `0`; `--version`; `--list-modes`; `-m`/`--mode` and `-o`/`--output` equivalence; each unknown-mode scenario; `-m` with no value; a file with no `-m`; `--angle` with `heictojpg`; `--banana`; `--quality` with no value; `--overwrite=yes`; `--angle -90` accepted for `rotate`; every scenario under "Option values are checked" (`--fit banana`, `--quality 101`/`0`/`abc`, `--fps 2.5`, `--quality 1`/`100`, video `--quality HIGH` and `80`); the input-only messages for `pngtoheic`, `jpgtosvg`, `tosvg` and `pngtosvg`; "heictojpg isn't available yet."; and no error output containing a line starting with `    at `; verify it passes
- [x] 4.4 Update `test/cli.test.ts` so the bare run checks exit `0`, empty stderr and the help screen on stdout, and add spawned-process tests for `--version` matching `package.json` and an unknown mode exiting with `1`; verify `npm test` passes
- [x] 4.5 Add `test/support/record-imports.mjs` (a `module.registerHooks` resolve hook that writes each resolved URL to stderr) and a test that spawns `node --import` with it on `dist/cli.js --help` and asserts every module is a `node:` built-in or under `dist/`, failing with a clear message if `registerHooks` is missing; verify it passes with `npm test`

## 5. README generation

- [x] 5.1 Add `scripts/update-readme.js` that imports `../dist/modes/registry.js`, renders one Markdown table per group (mode, description, first example) between `<!-- modes:start -->` and `<!-- modes:end -->`, and with `--check` writes nothing and exits `1` with "README.md is out of date. Run npm run docs."; add the `docs` script (`npm run build && node scripts/update-readme.js`); verify `npm run check` lints it cleanly
- [x] 5.2 Add a "## Modes" section with the markers to `README.md` and run `npm run docs`; verify every mode appears in the README and a second `npm run docs` leaves it byte-for-byte unchanged
- [x] 5.3 Add `test/readme.test.ts` that runs `node scripts/update-readme.js --check` and expects exit `0`, and that the script leaves text outside the markers unchanged when run on a temporary README copy; verify it passes, and that editing a registry description without `npm run docs` makes it fail with the "Run npm run docs" message

## 6. Final checks

- [x] 6.1 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass and `git diff README.md` shows no change from the last run
- [x] 6.2 Walk through the first-time user scenario with the built CLI: `node dist/cli.js`, `node dist/cli.js --list-modes`, then `node dist/cli.js -m heictojpg --help`, and check each reads clearly
- [x] 6.3 Tick "2. Command-line basics" in the `Features.md` progress list; verify the line reads `- [x] 2. Command-line basics`

## Workflow follow-up

- Push and confirm CI passes on Ubuntu, macOS and Windows and in the `old-node` job.
- Archive the change once CI has passed.
