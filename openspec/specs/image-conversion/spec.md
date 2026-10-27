# image-conversion Specification

## Purpose
Defines how konvertoj converts images between formats on the user's computer: which conversions exist, the quality, background, lossless, progressive and grayscale options, animation, orientation and colour space, and how oversized or damaged images fail.

## Requirements

### Requirement: Core format conversions
Every `<from>to<to>` image mode and every `to<format>` image mode SHALL convert its input into a file of the target format, the right way up. Between JPG, PNG, WebP, AVIF, GIF, TIFF and BMP the output SHALL have the input's width and height, unless `--width` or `--height` is given (see image-resizing). HEIC, SVG and ICO inputs and ICO outputs follow their own requirements below.

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

### Requirement: Quality
Lossy targets SHALL accept `--quality` from 1 to 100. JPG and WebP SHALL default to 80 and AVIF to 50. TIFF SHALL be saved lossless unless `--quality` is given, in which case it SHALL be saved with JPEG compression at that quality. A lower quality SHALL give a smaller file than a higher one for the same image.

#### Scenario: Quality limits
- **WHEN** `--quality 1` and `--quality 100` are given to `pngtojpg`
- **THEN** both convert

#### Scenario: Lower quality is smaller
- **WHEN** the same detailed image is converted with `pngtojpg --quality 20` and `--quality 90`
- **THEN** the quality 20 file is smaller

#### Scenario: TIFF quality
- **WHEN** the same image is converted with `pngtotiff` and with `pngtotiff --quality 50`
- **THEN** the first is lossless and the second is smaller

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

### Requirement: Lossless, progressive and grayscale
`--lossless` SHALL make WebP and AVIF outputs keep every pixel exactly. `--progressive` SHALL save a progressive JPG. `--grayscale` SHALL make the output black and white.

#### Scenario: Lossless WebP
- **WHEN** a PNG is converted with `pngtowebp --lossless`
- **THEN** every pixel of the WebP equals the PNG's

#### Scenario: Progressive JPG
- **WHEN** a PNG is converted with `pngtojpg --progressive`
- **THEN** the JPG is progressive

#### Scenario: Grayscale
- **WHEN** a red image is converted with `pngtojpg --grayscale`
- **THEN** the output's red, green and blue values are equal in every pixel

#### Scenario: No lossless JPG
- **WHEN** `--lossless` is given to `pngtojpg`
- **THEN** it fails with exit code `1`, saying `--lossless` can't be used with `pngtojpg`

### Requirement: Animation
An animated GIF or WebP SHALL stay animated, with the same number of frames, when converted to GIF or WebP. For any other target, the first frame SHALL be used, and the file's result SHALL carry a note saying only the first frame was kept.

#### Scenario: Animated GIF to WebP
- **WHEN** a three-frame animated GIF is converted with `giftowebp`
- **THEN** the WebP is animated with three frames

#### Scenario: Animated GIF to JPG
- **WHEN** the same GIF is converted with `giftojpg`
- **THEN** the JPG has the size of one frame, and a note says only the first frame was kept

#### Scenario: Multi-page TIFF
- **WHEN** a three-page TIFF is converted with `tifftopng`
- **THEN** the PNG has the size of one page, and a note says only the first page was kept

### Requirement: Upright and sRGB
Outputs SHALL be turned upright using the input's orientation tag, and SHALL be in the sRGB colour space. Outputs in formats that hold a colour profile SHALL carry an sRGB profile, so the profile always matches the pixels.

#### Scenario: Sideways phone photo
- **WHEN** a 60 × 40 JPG tagged with orientation 6 (turn 90° clockwise) is converted to PNG
- **THEN** the PNG is 40 × 60

#### Scenario: Wide-gamut input
- **WHEN** a PNG with a Display P3 colour profile is converted to JPG
- **THEN** the JPG carries an sRGB colour profile, not the Display P3 one, and its colours are converted to sRGB rather than copied as they are

### Requirement: Too large
An image with more pixels than konvertoj can safely decode SHALL fail with "is too large", giving its width and height and the limit, never a crash.

#### Scenario: Huge image
- **WHEN** a PNG whose header says 20,000 × 20,000 pixels is converted to JPG
- **THEN** it fails with a reason containing "is too large" and "20000 × 20000"

### Requirement: Damaged images
An image whose format is recognised but whose contents can't be decoded SHALL fail with the "looks damaged" message, never a crash or a stack trace.

#### Scenario: Truncated PNG
- **WHEN** a PNG cut off half-way is converted to JPG
- **THEN** it fails with a reason containing "looks damaged"

#### Scenario: Corrupt JPG
- **WHEN** a JPG cut off half-way is converted to PNG
- **THEN** it fails with a reason containing "looks damaged"

### Requirement: Space saved
A batch conversion SHALL report each file's size before and after, and the summary SHALL total them.

#### Scenario: Screenshots to WebP
- **WHEN** a folder of PNG screenshots is converted with `pngtowebp --quality 80 -o webp`
- **THEN** each file gets a line with its sizes, and the summary shows the total before → after with the change in percent

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
