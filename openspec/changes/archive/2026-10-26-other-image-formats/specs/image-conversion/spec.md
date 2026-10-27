# Spec Delta

## MODIFIED Requirements

### Requirement: Core format conversions
Every `<from>to<to>` image mode and every `to<format>` image mode SHALL convert its input into a file of the target format, the right way up. Between JPG, PNG, WebP, AVIF, GIF, TIFF and BMP the output SHALL have the input's width and height. HEIC, SVG and ICO inputs and ICO outputs follow their own requirements below.

#### Scenario: One PNG to every core format
- **WHEN** one PNG is converted with `pngtojpg`, `pngtowebp`, `pngtoavif`, `pngtogif` and `pngtotiff`
- **THEN** each output is a file of that format with the PNG's width and height

#### Scenario: Every pair
- **WHEN** an image of each core format is converted to each other core format
- **THEN** all 30 conversions succeed, and each output has the right format and size

#### Scenario: Smallest image
- **WHEN** a 1 × 1 pixel image is converted in every direction
- **THEN** every output is a 1 × 1 image of the target format

#### Scenario: Renamed PNG with tojpg
- **WHEN** a PNG named `holiday.heic` is given to `tojpg`
- **THEN** a JPG is written

#### Scenario: Mixed folder with tojpg
- **WHEN** a folder holding a HEIC, a PNG and a WebP is given to `tojpg`
- **THEN** all three become JPGs

#### Scenario: Messy folder with tojpg
- **WHEN** a folder holding a PNG, a JPG, a text file and an MP4 is given to `tojpg`
- **THEN** the PNG becomes a JPG, the JPG is skipped as already a JPG, the other two fail with their reasons, and the exit code is `2`

#### Scenario: Any image to BMP and ICO
- **WHEN** a JPG, a HEIC and an SVG are each given to `tobmp` and to `toico`
- **THEN** every conversion succeeds

### Requirement: Background where transparency is lost
When the target can't hold transparency, transparent areas SHALL be filled with `--background`, white by default. JPG and BMP can't hold transparency. Targets that hold transparency (PNG, WebP, AVIF, GIF, ICO, lossless TIFF) SHALL keep it.

#### Scenario: White by default
- **WHEN** a fully transparent PNG is converted with `pngtojpg`
- **THEN** its pixels are white

#### Scenario: Chosen colour
- **WHEN** the same PNG is converted with `pngtojpg --background red`
- **THEN** its pixels are red

#### Scenario: Same colour, different spellings
- **WHEN** the PNG is converted with `--background #ff8800` and with `--background rgb(255,136,0)`
- **THEN** both outputs have the same colour

#### Scenario: Transparency kept
- **WHEN** a transparent PNG is converted to WebP
- **THEN** the WebP is still transparent

#### Scenario: BMP background
- **WHEN** a fully transparent PNG is converted with `pngtobmp`
- **THEN** its pixels are white

## ADDED Requirements

### Requirement: HEIC photos
A HEIC file SHALL be converted from its main image only, upright, with the main image's displayed width and height, with nothing extra to install. This SHALL hold for every output format and for folders of many photos.

#### Scenario: iPhone photo to JPG
- **WHEN** the real iPhone-style HEIC fixture (stored 64 × 48 and rotated for display) is converted with `heictojpg`
- **THEN** the JPG is 48 × 64, portrait, with the photo's top-left corner where it is when the photo is viewed

#### Scenario: Every output format
- **WHEN** the HEIC is converted to JPG, PNG, WebP, AVIF, GIF, TIFF, BMP and ICO
- **THEN** every conversion succeeds

#### Scenario: Several images in one file
- **WHEN** a HEIC holding a main 80 × 40 image and a second 32 × 32 image is converted to PNG
- **THEN** one PNG is written, 80 × 40

#### Scenario: Twenty photos
- **WHEN** a folder of 20 HEIC photos is converted with `heictojpg`
- **THEN** all 20 JPGs are written

#### Scenario: Empty HEIC
- **WHEN** a 0-byte `photo.heic` is given to `heictojpg`
- **THEN** it fails with "is empty"

### Requirement: BMP images
BMP files SHALL be read and written with nothing extra to install. Written BMPs SHALL be 24-bit. A BMP whose alpha channel is unused (all zero) SHALL be read as opaque.

#### Scenario: Tiny round trip
- **WHEN** a 1 × 1 BMP is converted to PNG and that PNG back to BMP
- **THEN** both conversions keep the pixel's colour and size

#### Scenario: Any image to BMP
- **WHEN** a WebP is given to `tobmp`
- **THEN** a BMP with the WebP's width and height is written

### Requirement: ICO output
An ICO SHALL hold one PNG image for each size in `--sizes`, default `16,32,48`. Each image SHALL be square, resized from the source to fit inside the square without stretching, with transparent padding. Sizes SHALL be whole numbers from 1 to 256. The file SHALL be a standard ICO that browsers and Windows open.

#### Scenario: Default sizes
- **WHEN** a PNG is converted with `pngtoico`
- **THEN** the ICO holds 16, 32 and 48 pixel images

#### Scenario: Chosen sizes
- **WHEN** a PNG is converted with `pngtoico --sizes 16,32,64,128,256`
- **THEN** the ICO holds all five sizes

#### Scenario: Size limits
- **WHEN** `--sizes 256` is given
- **THEN** the ICO holds one 256 pixel image, and `--sizes 0`, `--sizes 257` and `--sizes abc` are rejected before any file is touched

#### Scenario: Non-square source
- **WHEN** a 60 × 30 PNG is converted with `pngtoico --sizes 32`
- **THEN** the 32 × 32 icon has the image 32 × 16 in the middle, with transparent rows above and below

#### Scenario: Standard container
- **WHEN** an ICO made by konvertoj is read back
- **THEN** its header and directory are valid ICO structures, a 256 pixel entry records its size as 0, and each entry's data is a PNG of the recorded size

### Requirement: ICO input
An ICO SHALL be converted from its largest image.

#### Scenario: Several sizes
- **WHEN** an ICO holding 16, 32 and 48 pixel images is converted to PNG
- **THEN** the PNG is 48 × 48

### Requirement: SVG images
An SVG SHALL be rendered from the file's contents only: images, fonts or styles it links to SHALL NOT be loaded. The output SHALL have the SVG's own size when it has both `width` and `height`, or otherwise be 512 pixels wide. `--width`, `--height` or `--dpi` SHALL set the size by rendering at that resolution, not by enlarging a small render.

#### Scenario: Own size
- **WHEN** an SVG with `width="120" height="80"` is converted to PNG
- **THEN** the PNG is 120 × 80

#### Scenario: No size
- **WHEN** an SVG with only `viewBox="0 0 100 50"` is converted to PNG
- **THEN** the PNG is 512 × 256

#### Scenario: No content
- **WHEN** an SVG with no shapes and no size is converted to PNG
- **THEN** a blank, transparent PNG 512 pixels wide is written

#### Scenario: Large and sharp
- **WHEN** an SVG 100 pixels wide with a thin diagonal line is converted with `svgtopng --width 2000`
- **THEN** the PNG is 2000 pixels wide, and the line's edge is as crisp as a render at that size (it matches `sharp` rendering the SVG at the equivalent density)

#### Scenario: Chosen DPI
- **WHEN** an SVG with `width="100" height="50"` is converted with `--dpi 144`
- **THEN** the PNG is 200 × 100

#### Scenario: Only one dimension
- **WHEN** an SVG with only `width="100"` and no `viewBox` is converted to PNG
- **THEN** the PNG is 512 pixels wide

#### Scenario: Width and height together
- **WHEN** an SVG with `width="120" height="80"` is converted with `--width 300 --height 300`
- **THEN** the PNG is 300 × 200, the largest size that fits

#### Scenario: Too large to draw
- **WHEN** a 1 × 1 SVG is converted with `--width 200000`
- **THEN** it fails with "would be too large to draw", never a crash

#### Scenario: Every output format
- **WHEN** an SVG is converted to JPG, PNG, WebP, AVIF, GIF, TIFF, BMP and ICO
- **THEN** every conversion succeeds

#### Scenario: Transparency
- **WHEN** an SVG with a transparent background is converted to PNG and to JPG
- **THEN** the PNG is transparent and the JPG is white where the SVG was transparent

#### Scenario: Linked image not loaded
- **WHEN** an SVG links to a red PNG next to it, and is converted to PNG
- **THEN** the area where the linked image would be is transparent

### Requirement: Damaged HEIC, BMP, ICO and SVG
A HEIC, BMP, ICO or SVG file that can't be decoded SHALL fail with "looks damaged", never a crash.

#### Scenario: Damaged files
- **WHEN** a truncated HEIC, a BMP with a broken header, an ICO with a broken directory and an SVG with broken markup are each converted to PNG
- **THEN** each fails with a reason containing "looks damaged", and nothing from the decoders is printed

### Requirement: Real-world image formats
A whole folder of iPhone photos and a logo SHALL convert with one command each.

#### Scenario: iPhone export and favicon
- **WHEN** a user runs `heictojpg ./iphone -o ./jpgs`, then `svgtopng logo.svg` and `svgtoico logo.svg -o favicon`
- **THEN** every photo becomes a JPG in `jpgs`, and `logo.png` and `favicon.ico` are written

## REMOVED Requirements

### Requirement: Formats still to come
**Reason**: HEIC, SVG, BMP and ICO conversion now exists, so no image input is "can't be converted yet".
**Migration**: None. Every image mode converts its inputs.
