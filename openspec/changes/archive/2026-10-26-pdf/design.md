# Design

## Context

The registry has 11 images-to-PDF modes (`<image>topdf` and `topdf`, `combinesInputs`, options `--page-size` default `A4`, `--orientation` default `auto`, `--margin` default `10`) and 8 `pdfto<image>` modes (options `--page` default `all` with no rule, `--dpi` 36–600 default 150, `--background`, and the target's encoding options). None has a `run`.
- `planOutputs` already plans one PDF for a combining mode, named after the first input or `-o`.
- The runner's `save(write)` writes exactly one file to the planned path.
- `renderImage` opens a file and encodes it, keeping details, resizing and so on.
- Feature 5's checks already fail a combined item naming the bad file and suggesting `topdf` for mixed formats.

Probing in a scratch folder showed:
- `pdfjs-dist` 6.4 (legacy build) with `@napi-rs/canvas` renders pages in Node,
- text needs `standardFontDataUrl` pointing at the package's `standard_fonts/` folder,
- `verbosity: 0` silences its console warnings,
- it throws `PasswordException` for protected files and `InvalidPDFException` for damaged ones,
- macOS PDFKit can write a password-protected PDF for a fixture.

## Goals / Non-Goals

**Goals:**
- PDFs built from images that look right in any reader: upright, unstretched, centred.
- Page images go through the same encoders and options as conversions.
- PDF libraries are loaded only by PDF modes.

**Non-Goals:**
- Editing PDFs (merging PDFs, splitting, rotating pages).
- Text extraction or OCR.
- Encrypting PDFs, or opening protected ones with a password.

## Decisions

### Images to PDF (`src/convert/pdf-create.ts`)
`createPdf(context)` builds one `PDFDocument` with `pdf-lib`. For each input in order:
1. **Open and decode** with `openImage(input, {}, false, { fit: "inside" })` (the first frame for animations), then fully decode it once with `await opened.image.clone().stats()`. Reading metadata and `embedJpg` only look at the header, so a truncated JPG would otherwise reach the PDF. The whole open, decode and embed step for each input sits in one `try`. A `UserError`, or any decoder failure turned into `damagedFile`, is re-thrown with the input's path relative to the working folder in front when the item has several inputs, so the PDF fails naming the file, and no PDF is saved.
2. **Embed:**
   - a JPG whose orientation is 1 or missing and whose `metadata.space` is `srgb` or `b-w` is embedded from its file bytes with `embedJpg`, unchanged. CMYK JPGs are converted, because some readers show Adobe CMYK JPGs inverted,
   - anything else is rendered upright through sharp: images with transparency (`!isOpaque` from the same `stats()`) become PNG (`embedPng`), and the rest become JPG at quality 90 (`embedJpg`).
3. **Page:**
   - size in points: A4 595.28 × 841.89, letter 612 × 792,
   - `--orientation landscape`, or `auto` with a wider-than-tall image, swaps the two sides,
   - `--page-size fit` makes the page the image's pixel size plus twice the margin, one point per pixel,
   - the margin is `--margin` mm × 72 / 25.4, defaulting to 10 mm for A4 and letter and 0 for `fit` (`--margin` given explicitly always wins).
4. **Place:** `scale = min(1, (pageWidth − 2m) / w, (pageHeight − 2m) / h)`. The image is drawn at `w·scale × h·scale`, centred.

The bytes from `doc.save()` are written through `context.save`.

### `checkOptions` for images-to-PDF modes
- With `--page-size` A4 or letter (default A4), a margin of at least half the shorter side (105 mm for A4, 107.95 mm for letter) is rejected: "--margin 110 is half the page or more (A4 is 210 mm across). Choose a smaller margin."
- `fit` has no limit.

### PDF to images (`src/convert/pdf-export.ts`)
`exportPages(context, target)`:
1. **Open:**
   - `const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")`, and `@napi-rs/canvas`, both dynamically,
   - `getDocument({ data, standardFontDataUrl, cMapUrl, cMapPacked: true, wasmUrl, verbosity: 0, isEvalSupported: false })`. The three URLs are the `standard_fonts/`, `cmaps/` and `wasm/` folders next to `pdfjs-dist`'s `package.json` (found with `createRequire(import.meta.url).resolve`). Each always ends with `/`, even on Windows, because pdf.js rejects other endings ("Invalid factory url") and Node.js reads such paths fine there. The CMaps and WebAssembly decoders let CJK PDFs without embedded CMaps, and JPX or JBIG2 scans, render fully,
   - errors: `PasswordException` → "is password-protected. Remove the password in a PDF app, then try again.", any other error → `damagedFile(error)`,
   - `numPages === 0` → "has no pages."
2. **Pages:** `pagesFrom(option, count)` expands `all`, `3`, `1-5` and `1,3,7`. A page above `count` → "has N pages, so there is no page P. Choose pages from 1 to N."
3. **Each page:**
   - `viewport = page.getViewport({ scale: dpi / 72 })`, on a canvas of `ceil(width) × ceil(height)`,
   - before the canvas is made, a page over 16384 pixels on a side or over 268 million pixels fails in plain English: "page P would be W × H pixels at N dpi, which is too large. Choose a lower --dpi.",
   - `page.render({ canvas, canvasContext, viewport, background })` draws the page onto `--background` (white by default). pdf.js fills the canvas itself, so the colour is passed to `render` rather than painted first,
   - the canvas's raw RGBA (`canvas.data()`) becomes an `OpenedImage` (`sharp(data, { raw: { width, height, channels: 4 } })`, one page), which avoids encoding and re-decoding a PNG at high DPI,
   - `page.cleanup()` runs after each page,
   - `renderOpened(context, opened, target, {})` encodes it with the target's options (quality, lossless, `--sizes` for ICO, and so on),
   - the result is written with `context.save(write, { suffix: "-" + String(page).padStart(digits, "0") })`, where `digits = String(count).length`.
4. **Clean up:** `pdf.destroy()` in `finally`.

### Splitting the converter
`renderImage(context, target, settings)` becomes `openImage(...)` followed by `renderOpened(context, opened, target, settings)`, which holds everything after opening. A page has no camera details: `readDetails` finds no metadata on the page image.

### Several files per input
- `Mode` gains `multipleOutputs?: true`, set on the eight `pdfto` modes.
- `planOutputs` treats `-o` as a folder whenever the mode has `multipleOutputs`, so the planned path is `<folder>/<name>.<ext>`. For these modes the base path is claimed only against the paths already planned in the run, not against existing files: no file is ever written at the base path, so an unrelated `report.png` mustn't push the pages to `report (1)-1.png`. `writeOutputFile` numbers each page file that already exists.
- The "-o is a file" error says "-o must be a folder when there are several inputs or pages", because it now also applies to a single PDF.
- `RunContext.save(write, options?: { suffix?: string })` inserts the suffix before the extension of the planned path, then uses `writeOutputFile`, so the temporary file, numbering and `--overwrite` rules apply to each page.
- The runner keeps every saved path. Sizes after are summed.
- `reporter.succeeded` receives the first path and the number of others: `✓ report.pdf → pages/report-1.png and 11 others  …`.
- `--dry-run` still prints the planned base path. The page numbers aren't known until the PDF is read.

### `--page` rule
`page` declares the pattern rule `/^(all|[1-9]\d*(-[1-9]\d*)?(,[1-9]\d*(-[1-9]\d*)?)*)$/i` with the description "all, a page such as 3, a range such as 1-5 or a list such as 1,3,7". Backwards ranges are rejected by the `pdfto` modes' `checkOptions`: "--page 2-1 goes backwards. Write the lower page first, e.g. 1-2."

### Tests
- **PDFs** are made with `pdf-lib` in the tests:
  - pages with a red rectangle, Helvetica text and an embedded PNG,
  - 1, 2 and 12-page documents,
  - a document with no pages, written with `save({ addDefaultPage: false })`, because `pdf-lib` otherwise adds a blank page.
- **`test/fixtures/locked.pdf`** is added by `make-fixtures.swift`: it draws a one-page PDF with Core Graphics and writes it with PDFKit and a user password.
- **Geometry checks:** page sizes and image placement are read back with `pdf-lib`. Rendered pixels are checked with `pdftopng`.

## Risks / Trade-offs

- [`pdfjs-dist` and `@napi-rs/canvas` add a lot to the install size] → They are in the tech stack. Feature 18 checks the install-size budget.
- [Fonts that aren't embedded in a PDF are drawn with pdf.js's standard fonts] → That is how Firefox shows such PDFs too.
- [One point per pixel for `fit` pages] → Such pages print at 72 dpi. The PDF still holds every pixel, so zooming in loses nothing.
