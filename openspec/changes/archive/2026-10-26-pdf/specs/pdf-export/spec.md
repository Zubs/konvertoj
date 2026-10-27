# Spec Delta

## Purpose

Defines how konvertoj exports PDF pages as images: which pages, how sharp, how the files are named, and how protected, damaged or empty PDFs fail.

## ADDED Requirements

### Requirement: Pages to images
The `pdfto<image>` modes SHALL draw the chosen pages, text, images and vector drawings included, onto `--background` (white by default), and save each as an image of the target format, using that format's options.

#### Scenario: One page
- **WHEN** a one-page PDF is given to `pdftopng`
- **THEN** one PNG is written

#### Scenario: Two pages
- **WHEN** a two-page PDF is given to `pdftopng`
- **THEN** two PNGs are written, numbered in page order

#### Scenario: Everything on the page
- **WHEN** a page with text, an embedded image and a filled rectangle is exported
- **THEN** all three appear in the image

### Requirement: Choosing pages
`--page` SHALL accept a page (`3`), a range (`1-5`), a list (`1,3,7`, which may include ranges) or `all` (default). `0`, a backwards range such as `2-1`, and anything else SHALL be rejected before any file is read. A page past the end SHALL fail, saying how many pages the PDF has.

#### Scenario: One page and a range
- **WHEN** a two-page PDF is exported with `--page 2`, and with `--page 1-2`
- **THEN** the first exports only page 2, and the second exports both

#### Scenario: Past the end
- **WHEN** a two-page PDF is exported with `--page 3`
- **THEN** it fails, saying the PDF has 2 pages

#### Scenario: Bad values
- **WHEN** `--page 0`, `--page 2-1` or `--page abc` is given
- **THEN** each fails with exit code `1` before any file is read

### Requirement: Sharpness
`--dpi` SHALL set the drawing resolution, from 36 to 600, default 150.

#### Scenario: Twice the DPI
- **WHEN** the same page is exported with `--dpi 300` and with `--dpi 150`
- **THEN** the first image is twice the width and height of the second, within a pixel

#### Scenario: Out of range
- **WHEN** `--dpi 35` or `--dpi 601` is given
- **THEN** it fails with exit code `1`

#### Scenario: Page too large to draw
- **WHEN** a page 3000 × 3000 points is exported at `--dpi 600`
- **THEN** it fails, saying the page would be too large and to choose a lower `--dpi`

### Requirement: Page file names
Exported pages SHALL be named `<name>-<page>.<ext>`, with the page number padded with zeros to the length of the PDF's page count, so they sort properly. `-o` SHALL name the folder they go in.

#### Scenario: Twelve pages
- **WHEN** a 12-page PDF named `report.pdf` is exported to PNG
- **THEN** the files are `report-01.png` to `report-12.png`

#### Scenario: Into a folder
- **WHEN** `report.pdf` is exported with `-o pages`
- **THEN** the images are written inside the `pages` folder

### Requirement: PDFs that can't be exported
A password-protected PDF SHALL fail with "is password-protected", a damaged PDF SHALL fail with "looks damaged", and a PDF with no pages SHALL fail with "has no pages", never with a stack trace.

#### Scenario: Protected, damaged and empty
- **WHEN** a password-protected PDF, a damaged PDF and a PDF with no pages are each exported
- **THEN** each fails with its message

### Requirement: A page for a slide
One page of a report SHALL export in one command.

#### Scenario: Page 3 as a PNG
- **WHEN** a user runs `pdftopng report.pdf --page 3`
- **THEN** only page 3 is written, as a PNG
