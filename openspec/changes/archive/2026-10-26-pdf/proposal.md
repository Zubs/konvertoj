# Proposal

## Why

Turning phone photos of receipts into one PDF, and pulling a page out of a report as an image, are two of the most common reasons people use online converters (Spec.md 5.3). The 19 PDF modes are registered with their options, but none can run. Feature 13 builds both directions locally: `pdf-lib` writes PDFs, and `pdfjs-dist` (Mozilla's PDF engine) with `@napi-rs/canvas` draws pages, with nothing extra to install.

## What Changes

- **Images to PDF** (`jpgtopdf`, `pngtopdf`, `heictopdf`, the other `<image>topdf` modes, and `topdf` for any image):
  - all inputs become one PDF, one page per image, in input order (natural order for folders and patterns),
  - `-o` names the PDF; without it, the PDF is named after the first input,
  - JPGs are embedded as they are when they are already upright RGB or grayscale. PNGs are embedded keeping their transparency. Every other image (and a sideways or CMYK JPG) is turned upright and converted first: to PNG when it has transparency, otherwise to JPG at quality 90,
  - `--page-size A4|letter|fit` (default `A4`). `fit` makes each page the image's size, one point per pixel,
  - `--orientation portrait|landscape|auto` (default `auto`, which makes a wide image's page landscape and a tall image's portrait),
  - `--margin` in millimetres: 10 by default for A4 and letter, 0 for `fit`. A margin of half the page's shorter side or more is rejected,
  - on A4 and letter pages, images are scaled down to fit inside the margins and centred, never stretched, and never enlarged,
  - a damaged or unusable image stops the PDF and names the file, rather than leaving a page out.
- **PDF to images** (`pdftojpg`, `pdftopng`, `pdftowebp`, `pdftoavif`, `pdftogif`, `pdftotiff`, `pdftobmp`, `pdftoico`):
  - `--page 3`, `--page 1-5`, `--page 1,3,7` or `--page all` (default `all`). `0`, backwards ranges such as `2-1` and anything else are rejected before any work. A page past the end fails, saying how many pages the PDF has,
  - `--dpi` sets sharpness (36 to 600, default 150),
  - pages are drawn on `--background` (white by default), then encoded like any conversion, with each format's options,
  - outputs are named `<name>-1.png`, `<name>-2.png` and so on, padded to sort properly (`-01` to `-12` for a 12-page PDF). `-o` is always a folder,
  - a password-protected PDF fails with "is password-protected", a damaged one with "looks damaged", and one with no pages with "has no pages".
- **Several outputs from one input.** A mode can save more than one file per input. The `pdfto` modes are marked as such, so `-o` is always a folder for them, and each saved file gets its own suffix through the normal safe-writing rules. The success line names the first file and how many others were written.
- Tick "13. PDF" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `pdf-creation`: images to one PDF: order, page size, orientation, margins, scaling and embedding.
- `pdf-export`: PDF pages to images: page selection, DPI, naming, and password, damaged and empty PDFs.

### Modified Capabilities

- `output-naming`: "Output folder for batches" also makes `-o` a folder for modes that write several files per input.
- `mode-registry`: "Option value rules" covers `--page`, and "Output naming details" marks the `pdfto` modes as writing several files per input.
- `command-line`: the "unchecked values pass through" example moves to an option that is still unchecked, because `--page` is now checked.

## Impact

- New dependencies, all listed in the CLAUDE.md tech stack: `pdf-lib`, `pdfjs-dist` and `@napi-rs/canvas`. They are loaded only when a PDF mode runs.
- New source:
  - `src/convert/pdf-create.ts`,
  - `src/convert/pdf-export.ts`.
- Changed source:
  - `src/convert/image.ts`: `renderOpened`, so a decoded page can be encoded like any image,
  - `src/modes/registry.ts`: `run`, `checkOptions` and the several-outputs flag,
  - `src/outputs.ts`: `-o` is a folder for several-output modes,
  - `src/runner.ts` and `src/report.ts`: saving several files, and the success line,
  - `src/modes/options.ts`: the `--page` rule.
- New fixture: `test/fixtures/locked.pdf`, a password-protected PDF made by `make-fixtures.swift` with Apple's PDFKit, because no install-free library can encrypt PDFs. Other test PDFs are made with `pdf-lib` in the tests.
