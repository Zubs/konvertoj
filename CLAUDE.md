# CLAUDE.md

## Project

konvertoj is a local, private command-line tool, published on npm, for converting and editing images, PDFs and a few common video and audio files, like FreeConvert but run entirely on the user's computer. Users run it with `npx konvertoj -m <mode> <input> -o <output> [options]`, e.g. `konvertoj -m heictojpg holiday.heic -o beach`. Nothing is uploaded and nothing needs setting up beyond Node.js. The one exception is video and audio, which use FFmpeg: an installed copy if there is one, otherwise a one-time download the user confirms. It is released once as v1.0.0, when every feature is done.

- [Spec.md](Spec.md) describes the product.
- [Features.md](Features.md) lists every feature in build order, with how it works and its tests. Build features in that order and tick each one in the progress list once it's complete.

## Tech stack

| Area | Choice |
|---|---|
| Language | TypeScript (strict), ES modules |
| Runtime | Node.js 22 or newer |
| Build | `tsc`, compiling `src/` to `dist/` (`NodeNext` modules) |
| Command line | Node's built-in `util.parseArgs` |
| Images | sharp |
| HEIC input | heic-decode |
| Metadata | exifr (reading HEIC details) and sharp |
| BMP and ICO | bmp-ts, decode-ico, plus our own ICO writer |
| Format detection | file-type |
| PDF | pdf-lib (creating), pdfjs-dist with @napi-rs/canvas (rendering pages) |
| Video and audio | FFmpeg: installed copy or a downloaded `ffmpeg-static` build, cached in the user's cache folder |
| Inputs | fast-glob |
| Output | Node's built-in `util.styleText` for colours, and our own one-line progress bar |
| Testing | Vitest |
| Linting and formatting | ESLint, Prettier |
| CI and publishing | GitHub Actions on Windows, macOS and Linux, published to npm with provenance |
| Demo | vhs |
| Licence | MIT |

## Coding rules

- **No comments.** Write code that explains itself through clear names. Only add a comment when the code is genuinely complicated or something is deliberately set up for a future change.
- **Keep it simple.** Write the simplest code that meets the requirement. Don't add abstractions, layers or options that aren't needed yet.
- **Use what's built in first.** Before writing custom logic, use what Node.js, TypeScript and the libraries in the tech stack already provide. Only install a new package when those can't do the job. Don't add or change dependencies without approval.
- **The mode registry is the single source of truth.** Every mode is defined once in the registry, with its name, group, inputs, output, options, description and examples. Help text, `--list-modes`, input checks and the README all come from it. Never hard-code a mode list anywhere else.
- **Never touch the user's originals.** Inputs are only ever read. Outputs are written to a temporary file and renamed when complete, and existing files are never overwritten without `--overwrite`.
- **Errors are for people.** Every error shown to the user is plain English and says how to fix it. Stack traces and technical details only appear with `--verbose`.
- **Keep start-up fast.** Load heavy libraries (PDF, HEIC, FFmpeg handling) only when a mode needs them, so `konvertoj --help` stays instant.
- **Cross-platform always.** Use `node:path` for paths, never pass arguments to FFmpeg through a shell, and don't assume a Unix-only behaviour. Everything must work on Windows, macOS and Linux.

## After every plan

Once a plan has been applied, run these checks and fix every issue they report:

```bash
npm run format
npm run check
npm test
npm run build
```

`npm run check` runs type checks and ESLint. `npm test` runs the full Vitest suite. Run the full suite yourself after every plan rather than asking the user to. After any change to the mode registry, also run `npm run docs` so the README stays in sync.

Repeat until all of them pass with no errors. Don't consider the work finished until they do.
