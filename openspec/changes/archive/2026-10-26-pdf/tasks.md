# Tasks

## 1. Dependencies and fixtures

- [x] 1.1 Install `pdf-lib`, `pdfjs-dist` and `@napi-rs/canvas`; verify the start-up test still shows `--help` loads none of them
- [x] 1.2 Extend `test/fixtures/make-fixtures.swift` to write `test/fixtures/locked.pdf` (one page, user password) with PDFKit, and run it; verify `pdfjs-dist` reports a `PasswordException` for it

## 2. Shared pieces

- [x] 2.1 Split `renderImage` into opening plus `renderOpened`; verify every existing test passes
- [x] 2.2 Add `multipleOutputs` to `Mode` and set it on the `pdfto` modes; make `planOutputs` treat `-o` as a folder for them, claiming the base path only against the run's planned paths, and reword the "-o is a file" error to "several inputs or pages"; give `save` an optional `suffix`; have the runner keep every saved path, sum the sizes and report the first path with how many others; add outputs and runner tests
- [x] 2.3 Add the `--page` pattern rule, the backwards-range check for `pdfto` modes, and the half-page margin check for images-to-PDF modes

## 3. PDF

- [x] 3.1 Add `src/convert/pdf-create.ts` with `createPdf` as in design.md (open and fully decode each image with `stats()`, all inside one naming `try`, embed upright `srgb`/`b-w` JPGs unchanged and convert others, CMYK included, to PNG or JPG, page sizes, orientation, margins, scale-down-only centring); give the images-to-PDF modes a lazy `run`
- [x] 3.2 Add `src/convert/pdf-export.ts` with `exportPages` as in design.md (dynamic imports, standard fonts, CMaps and WebAssembly folders as `/`-ending paths, quiet pdf.js, password, damaged and empty PDFs, page selection with the page-count message, the too-large-page check before drawing, `background` passed to `render`, DPI scale, raw `canvas.data()` into `renderOpened`, `page.cleanup()`, padded suffixes); give the `pdfto` modes a lazy `run`; run `npm run docs`

## 4. Tests

- [x] 4.1 Add `test/pdf.test.ts` through `main` covering Features.md's list:
  - no images fails,
  - an empty PDF fails with "has no pages",
  - one JPG gives a centred A4 page with a 10 mm margin,
  - a one-page PDF gives one image,
  - three images in the given order, and natural order for a folder,
  - a two-page PDF gives two numbered images,
  - a large image is scaled down and a small one centred, neither stretched,
  - `--page-size fit` matches the image with no margin, and `letter` gives US letter,
  - `--orientation auto`,
  - `--margin 0` and `50` work and a margin over half the page is rejected,
  - `--page 2` and `--page 1-2`,
  - `--page 3` on a two-page PDF names 2 pages, and `0`, `2-1` and `abc` are rejected,
  - `--dpi 300` is twice `--dpi 150`, and `35` and `601` are rejected,
  - a 3000 × 3000 point page at `--dpi 600` fails, saying to choose a lower `--dpi`,
  - a 12-page PDF names `-01` to `-12`,
  - a transparent PNG shows the white page through,
  - HEIC, WebP and AVIF in a PDF,
  - `topdf` mixes formats and `jpgtopdf` suggests `topdf`,
  - the PDF reads back with `pdf-lib` and `pdftopng`,
  - text, an image and a rectangle all appear in an exported page,
  - a truncated JPG among good ones stops the PDF, naming the file,
  - `--background #ff8800` colours the page behind a transparent area,
  - an existing unrelated `report.png` doesn't change the page names,
  - the locked PDF says "is password-protected", and a damaged PDF "looks damaged",
  - `-o` puts pages in a folder,
  - the receipts and slide scenario
  
  Verify the tests pass.

## 5. Decisions and final checks

- [x] 5.1 Add feature 13 entries to `Decisions.md`: one point per pixel for `fit`; small images aren't enlarged on A4 or letter pages; non-JPG images embedded as PNG (with transparency) or JPG at quality 90; pages drawn onto `--background`; `--dry-run` shows the base name for page exports; `locked.pdf` made with PDFKit; readers checked by reading the PDF back with two PDF libraries
- [x] 5.2 Run `npm run format`, `npm run check`, `npm test`, `npm run build` and `npm run docs`, fixing every issue until all pass
- [x] 5.3 Tick "13. PDF" in the `Features.md` progress list
