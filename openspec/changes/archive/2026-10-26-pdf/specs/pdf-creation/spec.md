# Spec Delta

## Purpose

Defines how konvertoj turns one or many images into a single PDF: page order, page size, orientation, margins, how images are placed, and how a bad image stops the PDF.

## ADDED Requirements

### Requirement: One PDF from all inputs
The images-to-PDF modes SHALL turn all inputs into one PDF with one page per image, in input order, with natural order for folders and patterns. `-o` SHALL name the PDF; without it, the PDF SHALL be named after the first input.

#### Scenario: One JPG
- **WHEN** one JPG is given to `jpgtopdf`
- **THEN** a one-page A4 PDF named after it is written, with the image centred inside a 10 mm margin

#### Scenario: Three images in order
- **WHEN** `c.jpg`, `a.jpg` and `b.jpg` are given to `jpgtopdf` in that order, and a folder holding `page1.jpg`, `page2.jpg` and `page10.jpg` is given to it
- **THEN** the first PDF's pages follow c, a, b, and the second's follow page1, page2, page10

### Requirement: Page size and orientation
`--page-size` SHALL be `A4` (default), `letter` or `fit`. `fit` SHALL make each page the size of its image with no margin unless one is given. `--orientation` SHALL be `portrait`, `landscape` or `auto` (default), where `auto` makes a wide image's page landscape and a tall image's portrait.

#### Scenario: Fit and letter
- **WHEN** a 300 × 200 image is made into a PDF with `--page-size fit`, and with `--page-size letter`
- **THEN** the first page is 300 × 200 points, and the second is a US letter page

#### Scenario: Auto orientation
- **WHEN** a wide image and a tall image are made into an A4 PDF
- **THEN** the wide image's page is landscape and the tall image's page is portrait

### Requirement: Margins
`--margin` SHALL be in millimetres, 10 by default for A4 and letter and 0 for `fit`. A margin of half the page's shorter side or more SHALL be rejected before any file is read.

#### Scenario: No margin and a wide margin
- **WHEN** `--margin 0` and `--margin 50` are given for A4
- **THEN** both work, the image filling the page width in the first and leaving 50 mm on each side in the second

#### Scenario: Margin too big
- **WHEN** `--margin 110` is given for A4
- **THEN** it fails with exit code `1`, saying the margin is half the page or more

### Requirement: Images placed without stretching
On A4 and letter pages, each image SHALL be scaled down to fit inside the margins, keeping its shape, and centred. A small image SHALL NOT be enlarged.

#### Scenario: Large and small images
- **WHEN** a 4000 × 3000 image and a 100 × 100 image are made into an A4 PDF
- **THEN** the large image fits inside the margins with its shape kept, and the small one is drawn 100 points wide in the centre of its page

### Requirement: Embedding
JPGs that are upright RGB or grayscale SHALL be embedded unchanged. PNGs SHALL keep their transparency. Other images SHALL be converted first, keeping transparency where they have it. HEIC, WebP and AVIF images SHALL all be accepted.

#### Scenario: Transparent PNG
- **WHEN** a PNG with transparent areas is made into a PDF and the page is drawn back
- **THEN** the transparent areas show the white page

#### Scenario: Other formats
- **WHEN** a HEIC, a WebP and an AVIF are given to `topdf`
- **THEN** the PDF has three pages

#### Scenario: Mixed formats
- **WHEN** a JPG and a PNG are given to `topdf`, and to `jpgtopdf`
- **THEN** `topdf` makes a two-page PDF, and `jpgtopdf` fails suggesting `-m topdf`

### Requirement: A bad image stops the PDF
A damaged or unusable image SHALL stop the PDF, and the reason SHALL name that image. No PDF SHALL be written.

#### Scenario: Damaged image in the list
- **WHEN** three JPGs, one of them truncated, are given to `jpgtopdf`
- **THEN** it fails, naming the truncated file, and no PDF is written

### Requirement: Readable PDFs
The PDFs konvertoj writes SHALL be standard PDFs that PDF readers open.

#### Scenario: Read back
- **WHEN** a PDF made by konvertoj is opened with a PDF reader library and with `pdftopng`
- **THEN** it has the expected number of pages, each drawing its image

### Requirement: Receipts into a PDF
A folder of phone photos SHALL become one A4 PDF in one command.

#### Scenario: Scanned receipts
- **WHEN** a user runs `heictopdf ./receipts -o receipts` on a folder of HEIC photos
- **THEN** `receipts.pdf` has one A4 page per photo, in order
