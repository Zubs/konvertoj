# Design

## Context

`src/main.ts` parses the command, checks the mode and its options, and then always ends with "<mode> isn't available yet." It's synchronous, and its positional arguments are never read. There are no runtime dependencies yet. The registry describes each mode's `inputs` and `output`, where `output` is a format name, `"same"` (tools that keep the format) or `"none"` (`info`, `colorpick`). No mode can run yet; feature 4 adds the batch runner and the first (test-only) runner. See proposal.md for why, and the specs for the behaviour.

## Goals / Non-Goals

**Goals:**
- Three small modules with plain inputs and outputs, so most tests use temporary folders without spawning konvertoj:
  - resolve the inputs,
  - plan the outputs,
  - write the files.
- A plan that feature 4 can run directly: an ordered list of `{ input, output }`, plus warnings.

**Non-Goals:**
- Running modes, progress, the summary and exit code `2` (feature 4). Unreadable inputs are only marked here.
- Checking file formats (feature 5). Folders and patterns include every non-hidden file. Feature 5 decides what each file is.
- PDF-to-images page naming such as `report-01.png` (feature 13), which needs the page count. Until then, `pdfto<image>` plans one output per PDF, like a conversion.
- Rejecting `-o` for `info` and `colorpick` (feature 12). Until then, they plan no outputs and `-o` has no effect.
- Ctrl+C clean-up (feature 4). The temporary-file helper only cleans up its own failures.

## Decisions

### Order of handling in `main`
`main` becomes `async` and returns `Promise<number>`, and `cli.ts` awaits it. After the existing option checks:
1. Resolve the inputs. Errors stop the command.
2. Plan the outputs. Errors stop the command, warnings are collected.
3. Print any warnings to standard error as `Warning: …`.
4. With `--dry-run`, print the plan and return `0`.
5. Otherwise, the mode has no runner yet, so fail with "<mode> isn't available yet."

Preparing folders and writing aren't called from `main` in this change, because nothing runs yet, and creating folders for an unbuilt mode would leave clutter. Feature 4 calls them between steps 4 and 5. This is why they're tested directly.

`src/inputs.ts` is loaded with `await import()` at step 1, so `fast-glob` is never loaded for `--help`, `--version` or `--list-modes`. The existing start-up test keeps proving this.

### Resolving inputs (`src/inputs.ts`)
`resolveInputs(args, { recursive, cwd })` returns `{ inputs, warnings }` or throws an `InputError` with a plain-English message.

Each argument is handled in turn:
- **Exists** (checked with `fs.stat`):
  - a file is added as is,
  - a folder is searched with fast-glob, using `cwd` set to the folder and the pattern `*` (or `**` with `--recursive`). Using `cwd` means folder names never need escaping.
- **Doesn't exist, but looks dynamic** (`fg.isDynamicPattern`): it's a pattern. On Windows, `\` is changed to `/` first, because fast-glob only accepts `/`. Windows doesn't allow `\` in file names, so nothing is lost.
- **Neither:** recorded as missing.

Checking existence first means a real file named `a[1].png` is never treated as a pattern.

fast-glob options:
- `onlyFiles: true`,
- `dot: false`, which skips hidden files and folders (checked: `.DS_Store` and `.hidden/d.png` are skipped),
- `absolute: true`,
- a custom `fs.readdir` that records folders failing with `EACCES` or `EPERM` and returns no entries for them, so a locked subfolder becomes a warning instead of aborting the search. This was checked against fast-glob 3.3.3: by default it throws `EACCES`, and with the adapter it finds the other files and reports the locked folder.

Each folder's or pattern's matches are sorted with `Intl.Collator(undefined, { numeric: true, sensitivity: "base" })`. That gives `page1`, `page2`, `page10`, with letter case ignored.

**Duplicates:** each input is keyed by `fs.realpath.native`, which gives the file's canonical path and letter case on macOS and Windows. Only the first occurrence of each key is kept.

**Readability:** each file is opened for reading and closed straight away. `fs.access(R_OK)` isn't used because it doesn't reflect Windows permissions. A failure marks the input `{ unreadable: "permission denied" }`, or the error's code turned into plain English. It isn't thrown.

**Errors:** all missing names and empty folders or patterns are collected, then reported together:
- `holday.heic can't be found. Check the name and try again.`
- `No matching files found in empty-folder.`
- `No matching files found for "*.heic".`

No arguments at all gives "No input files given." with the command shape.

**Base folder:** each input records the base it came from, so outputs can keep the structure below it:
- a folder input's base is the folder,
- a pattern's base is its leading segments up to the first dynamic one (`photos/2024/*.png` gives `photos/2024`),
- a directly named file has no base.

### Planning outputs (`src/outputs.ts`)
`planOutputs(mode, inputs, { output, overwrite, cwd })` returns `{ items: { input, output? }[], warnings }` or throws `InputError`. It's synchronous, using `fs.existsSync` and `fs.statSync`.

- **Extension:** the mode's output format gives the extension (`.jpg`, `.tiff`, `.pdf`, ...). For `"same"` it's the input's own extension.
  - `formats.ts` gains `extensionAliases` (`jpg`: `jpg`, `jpeg`, `jfif`, `jpe`; `tiff`: `tif`, `tiff`; `heic`: `heic`, `heif`), and every other format maps to itself.
  - A user-given name keeps its extension when that extension (any case) belongs to the output format.
  - The extension is replaced, with a warning, when it belongs to another known format.
  - Otherwise the mode's extension is appended, so `-o holiday.2024` with a JPG mode becomes `holiday.2024.jpg`.
- **Default name:** the input's base name, plus `-<suffix>` for tools, plus the extension, in the input's folder.
- **When `-o` is a folder:** there's more than one input, or any input came from a folder or pattern, or `-o` is an existing folder, or ends with `/` or `\`.
  - In that case, each output is `-o` / (path from the input's base to its folder) / default name.
  - When `-o` must be a folder but is an existing file, an `InputError` is thrown.
- **Combining modes:** one item holds every readable input and one output. It's named from `-o`, following the extension rules, or inside `-o` if that's an existing folder, or else after the first input in its folder.
- **Numbering:** every output is checked against a set of taken keys, `path.resolve(output).toLowerCase()`.
  - The set starts with every input's resolved path, so outputs can never be inputs.
  - Without `--overwrite`, it also counts files that exist.
  - With `--overwrite`, existing files that aren't inputs are allowed.
  - If an output is taken, ` (1)`, ` (2)` and so on is tried before the extension until one is free.
  - Lowercase keys are slightly stricter than case-sensitive Linux file systems need, but it's always safe: at worst a number is added.
- **Unreadable inputs** get no output and take no name.

### Dry-run output
One line per input: `path.relative(cwd, input) → path.relative(cwd, output)`. Unreadable inputs read `<input> → can't be read (permission denied)`. `info` and `colorpick` read `<input> → (prints details, no file)`. Paths use the system's separator, so Windows users see paths they can paste.

### Writing (`src/output-files.ts`)
- **`prepareOutputFolders(items)`** collects the distinct output folders. For each one, it calls `fs.mkdir(folder, { recursive: true })`, then writes and deletes `.konvertoj-write-test-<random>`. A failure throws `InputError`: `Can't write to converted. Choose another folder with -o.` Writing a real file is used because `fs.access(W_OK)` doesn't reflect Windows folder permissions.
- **`writeOutputFile(finalPath, write, { overwrite })`** works like this:
  1. Make a temporary path, `.<name>.<random>.konvertoj-tmp`, in the same folder. That keeps the rename on one disk, so it's a single atomic step.
  2. Await `write(tempPath)`.
  3. Without `--overwrite`, if `finalPath` now exists, move to the next free number.
  4. Rename into place and return the final path.

  On any error, the temporary file is removed (ignoring "not found") and the error is rethrown. `fs.rename` replaces an existing file on Windows, macOS and Linux, which is what `--overwrite` needs.

Results are always written to the temporary file and never to the original. Nothing opens an input for writing, which is what "inputs are only read" requires. A test checks an input's contents and modification time after a write.

### Registry additions
`Mode` gains an optional `outputSuffix` and an optional `combinesInputs: true`. The tools set `compressed`, `resized`, `enlarged`, `cropped`, `rotated`, `flipped` and `stripped`, and the 11 images-to-PDF modes set `combinesInputs`. No help text changes, so `npm run docs` produces the same README. It still runs as part of the checks, to confirm that.

### Dependency
`fast-glob@^3.3.3` goes in `dependencies` (approved). It brings 5 small sub-dependencies, ships its own types, and is CommonJS, so it's imported as `import fg from "fast-glob"`. With NodeNext that's allowed for a CommonJS module's `module.exports`.

## Risks / Trade-offs

- [A file can appear at the final name between planning and renaming] → `writeOutputFile` checks again just before renaming. A tiny gap remains between that check and the rename, which is acceptable for a desktop tool.
- [Lowercase name keys number some outputs on case-sensitive Linux disks that wouldn't strictly clash, e.g. `Photo.jpg` and `photo.jpg`] → Always safe. Nothing is overwritten, only renamed.
- [Turning `\` into `/` in Windows patterns loses `\` as an escape character] → Windows users rarely escape glob characters, and names with literal `*` or `?` aren't allowed on Windows anyway.
- [Permission tests can't run on Windows, or as root, where `chmod` doesn't block reading] → Those tests are skipped there, with the reason in the test name. Linux and macOS CI still run them.
- [A 200-character file name passes on Linux and macOS but could hit Windows' 260-character path limit in deep CI folders] → The test puts it in a short temporary folder, and Node.js on Windows uses long-path-aware APIs.
- [`main` becoming async changes its signature] → Only `cli.ts` and the tests call it. Both are updated in this change.
