# Spec Delta

## Purpose

Defines how konvertoj converts images between formats on the user's computer: which conversions exist, the quality, background, lossless, progressive and grayscale options, animation, orientation and colour space, and how oversized or damaged images fail.

## ADDED Requirements

### Requirement: Core format conversions
Every `<from>to<to>` mode between JPG, PNG, WebP, AVIF, GIF and TIFF, and the `to<format>` modes for JPG, PNG, WebP, AVIF and TIFF, SHALL convert their input into a file of the target format with the same width and height, the right way up.

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
- **WHEN** a folder holding a PNG and a WebP is given to `tojpg`
- **THEN** both become JPGs

#### Scenario: Messy folder with tojpg
- **WHEN** a folder holding a PNG, a JPG, a text file and an MP4 is given to `tojpg`
- **THEN** the PNG becomes a JPG, the JPG is skipped as already a JPG, the other two fail with their reasons, and the exit code is `2`

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
When the target can't hold transparency, transparent areas SHALL be filled with `--background`, white by default. Targets that hold transparency (PNG, WebP, AVIF, GIF, lossless TIFF) SHALL keep it.

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
Outputs SHALL be turned upright using the input's orientation tag, and SHALL be in the sRGB colour space.

#### Scenario: Sideways phone photo
- **WHEN** a 60 × 40 JPG tagged with orientation 6 (turn 90° clockwise) is converted to PNG
- **THEN** the PNG is 40 × 60

#### Scenario: Wide-gamut input
- **WHEN** a PNG with a Display P3 colour profile is converted to JPG
- **THEN** the JPG has no embedded colour profile, and its colours are converted to sRGB rather than copied as they are

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

### Requirement: Formats still to come
Until their converters exist, a `to<format>` mode SHALL fail an input in HEIC, SVG, BMP or ICO with "can't be converted yet", and the `<from>to<to>` modes for those formats SHALL still say "isn't available yet".

#### Scenario: HEIC with tojpg before feature 7
- **WHEN** a HEIC photo is given to `tojpg`
- **THEN** it fails with a reason containing "can't be converted yet"

### Requirement: Space saved
A batch conversion SHALL report each file's size before and after, and the summary SHALL total them.

#### Scenario: Screenshots to WebP
- **WHEN** a folder of PNG screenshots is converted with `pngtowebp --quality 80 -o webp`
- **THEN** each file gets a line with its sizes, and the summary shows the total before → after with the change in percent
