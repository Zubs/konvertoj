# Tasks

## 1. Dependency and registry

- [x] 1.1 Install `fast-glob@^3.3.3` as a runtime dependency; verify it appears under `dependencies` in `package.json`, `npm audit` reports 0 vulnerabilities, and `test/package.test.ts` still passes
- [x] 1.2 Add `extensionAliases` to `src/modes/formats.ts` (`jpg`, `jpeg`, `jfif`, `jpe` for JPG; `tif`, `tiff` for TIFF; `heic`, `heif` for HEIC; every other format maps to itself), and add `outputSuffix` to the seven format-keeping tools and `combinesInputs` to the 11 images-to-PDF modes in `src/modes/registry.ts`; extend `test/registry.test.ts` with the "Output naming details" scenarios, and verify it passes and `npm run docs` leaves `README.md` unchanged

## 2. Resolving inputs

- [x] 2.1 Add `src/inputs.ts` with `resolveInputs(args, { recursive, cwd })` and `InputError`, as in design.md: existing file, folder (fast-glob with `cwd`, `*` or `**`, `dot: false`, the `readdir` adapter that records locked folders), or pattern (`\` changed to `/` on Windows), natural sort for each folder or pattern, typed order kept, duplicates removed by `realpath.native`, unreadable files marked by trying to open them, each input's base recorded, and all missing or empty inputs reported together; verify `npm run check` passes
- [x] 2.2 Add `test/inputs.test.ts` using temporary folders for every input-files scenario: no arguments, single file, quoted pattern, top-level vs `--recursive`, hidden files and folders skipped but a named hidden file kept, natural order, typed order, duplicates (same name twice, `./` form, file plus its folder), missing file named, several missing names reported together, empty folder and unmatched pattern, a locked subfolder skipped with a warning, an unreadable file marked "permission denied" (skipped on Windows and as root), names with spaces, accents, emoji and 200 characters, and the base recorded for folders and patterns; verify it passes

## 3. Planning outputs

- [x] 3.1 Add `src/outputs.ts` with `planOutputs(mode, inputs, { output, overwrite, cwd })` following design.md: extension rules and the mismatch warning, default names and tool suffixes, when `-o` is a folder (including an existing folder for one input, and the error when it's an existing file), subfolder structure below each base, combined output for images-to-PDF modes, numbering against taken keys seeded with every input, `--overwrite` allowing existing non-input files, no output for unreadable inputs or `info`/`colorpick`; verify `npm run check` passes
- [x] 3.2 Add `test/outputs.test.ts` covering every output-naming scenario with temporary folders: `-o newimage`, `-o newimage.jpg`, `-o newimage.JPEG`, `-o holiday.2024`, `-o newimage.png` warning, conversion and tool defaults, three files into `converted`, recursive structure under `out`, one file into an existing folder, the existing-file `-o` error, combined PDF output with and without `-o`, `photo (1)` then `photo (2)`, `--overwrite`, the in-run clash with and without `--overwrite`, and `compress hero.jpg -o hero.jpg --overwrite` giving `hero (1).jpg`; verify it passes

## 4. Writing outputs

- [x] 4.1 Add `src/output-files.ts` with `prepareOutputFolders(items)` (create with `recursive`, write and delete a test file, throw `InputError` naming the folder) and `writeOutputFile(finalPath, write, { overwrite })` (hidden temporary file in the same folder, recheck the final name without `--overwrite`, rename, remove the temporary file on any error); verify `npm run check` passes
- [x] 4.2 Add `test/output-files.test.ts` checking that a missing folder is created, an unwritable folder fails naming it (skipped on Windows and as root), a successful write leaves only the final file, a failing `write` leaves neither the final file nor a temporary file and rethrows, a file appearing before the rename makes the result `photo (1).jpg`, `--overwrite` replaces it, and an input's contents and modification time are unchanged after a write next to it; verify it passes

## 5. Command flow

- [x] 5.1 Make `main` async in `src/main.ts`: after option checks, dynamically import `./inputs.js`, resolve inputs, plan outputs, print warnings as `Warning: …` to stderr, print the dry-run plan (relative paths, unreadable reasons, no-file note) and return `0` with `--dry-run`, otherwise fail with "<mode> isn't available yet."; await `main` in `src/cli.ts`; verify `npm run build` succeeds and `node dist/cli.js -m heictojpg missing.heic` names the missing file
- [x] 5.2 Update `test/main.test.ts` for the async `main`, creating the sample files it uses in a temporary folder used as the working directory, and add tests for the modified command-line scenarios: valid values reaching "isn't available yet" with files present, an option checked before a missing input, input mistakes reported before "isn't available yet", "No input files given.", and a dry run printing `photo.heic → photo.jpg` with exit `0`, plus three inputs with `-o converted --dry-run` listing three pairs without creating `converted`; verify `npm test` passes
- [x] 5.3 Confirm the start-up test still shows only `dist/` modules and Node.js built-ins for `--help` (fast-glob not loaded), and add a spawned-process test that `dist/cli.js -m heictojpg "<tmp>/*.heic" --dry-run` expands the quoted pattern itself; verify `npm test` passes

## 6. Final checks

- [x] 6.1 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass and `README.md` is unchanged
- [x] 6.2 Walk through the real-world scenario with the built CLI in a scratch folder: a folder of photos with `-o` into a new folder under `--dry-run`, then create the planned output files by hand and dry-run again to see numbered names instead of lost files; check the output reads clearly
- [x] 6.3 Tick "3. Inputs and output naming" in the `Features.md` progress list; verify the line reads `- [x] 3. Inputs and output naming`

## Workflow follow-up

- Push and confirm CI passes on Ubuntu, macOS and Windows and in the `old-node` job; the Windows job is the real test of patterns, path separators and long names.
- Archive the change once CI has passed.
