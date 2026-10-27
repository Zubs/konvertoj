# image-metadata Specification

## Purpose
Defines how konvertoj treats photo details (camera, date, location, colour profile) when converting: kept by default wherever the format can hold them, removed on request with `--strip-metadata` or the `strip` tool, and never at the cost of a sideways image.

## Requirements

### Requirement: Details kept by default
When converting to JPG, PNG, WebP or AVIF, the input's EXIF details (camera, date taken, GPS position) and XMP SHALL be copied to the output. A TIFF output SHALL keep XMP and the colour profile. An input without details SHALL convert without errors and gain none.

#### Scenario: JPG to WebP keeps details
- **WHEN** a JPG with camera, date and GPS details is converted with `jpgtowebp`
- **THEN** the WebP has the same camera, date and GPS details

#### Scenario: No details
- **WHEN** an image with no details is converted to JPG
- **THEN** it converts, and the output has no camera, date or GPS details

### Requirement: HEIC details carried over
For HEIC input, the camera make, model and lens, the date taken and the GPS position SHALL be written into outputs that hold details, with the orientation recorded as normal because the pixels are already upright.

#### Scenario: iPhone photo to JPG
- **WHEN** the iPhone-style HEIC fixture is converted with `heictojpg`
- **THEN** the JPG names Apple and iPhone 15 Pro, has the date taken 2026:07:14 10:30:00 and a GPS position near 51.5007 N, 0.1246 W, and its orientation is normal

### Requirement: Formats that can't hold details
Converting to BMP, GIF or ICO SHALL work as usual. When the input had details, `--verbose` SHALL say that they were dropped because the format can't hold them. Converting to TIFF SHALL say the same in verbose output for camera, date and GPS details.

#### Scenario: JPG with details to BMP
- **WHEN** a JPG with camera details is converted with `jpgtobmp --verbose`
- **THEN** it converts, and the output mentions that the details were dropped because BMP can't hold them

### Requirement: --strip-metadata
`--strip-metadata` SHALL work on every image mode that creates files (`info` and `colorpick` only read images, so they don't take it), and SHALL remove EXIF, XMP and IPTC details, keeping only the colour profile. The image SHALL be turned upright before its orientation tag is removed.

#### Scenario: Details removed
- **WHEN** a JPG with camera, date and GPS details is converted with `jpgtopng --strip-metadata`
- **THEN** the PNG has no camera, date or GPS details

#### Scenario: HEIC details not written
- **WHEN** the HEIC fixture is converted with `heictojpg --strip-metadata`
- **THEN** the JPG has no camera, date or GPS details

#### Scenario: Every image mode accepts it
- **WHEN** the registry is inspected
- **THEN** every Image, PDF and Tools mode that creates files accepts `--strip-metadata`

### Requirement: strip tool
`strip` SHALL keep each input's format and remove its details, saving `<name>-stripped.<ext>`. An upright JPG SHALL keep its picture data exactly. A sideways photo SHALL come out upright, with no orientation tag.

#### Scenario: Strip a JPG
- **WHEN** `strip` is run on an upright JPG with camera, date and GPS details
- **THEN** `<name>-stripped.jpg` is a JPG with the same pixels and no camera, date or GPS details

#### Scenario: Strip a sideways photo
- **WHEN** `strip` is run on a 60 × 40 JPG tagged with orientation 6
- **THEN** the output is a 40 × 60 JPG with no orientation tag

#### Scenario: Strip other formats
- **WHEN** `strip` is run on a PNG, a WebP, an AVIF and a TIFF that have details
- **THEN** each output keeps its format and size and has no camera, date or GPS details

#### Scenario: Strip a JPG with a hidden trailer
- **WHEN** `strip` is run on a JPG that has a second JPG with GPS details stored after its end
- **THEN** the output holds only the first image, without the trailer or its GPS details

#### Scenario: Strip a lossless WebP
- **WHEN** `strip` is run on a lossless WebP with details
- **THEN** the output is a WebP with exactly the same pixels and no details

#### Scenario: Strip a folder before posting
- **WHEN** a user runs `konvertoj -m strip ./holiday -o ./to-share` on a folder of photos with GPS details
- **THEN** every photo in `to-share` has no GPS details, and the originals still have theirs

### Requirement: Damaged details
An input whose EXIF details can't be read SHALL still convert, without those details, and its result SHALL carry a note saying the details looked damaged and were left out.

#### Scenario: Corrupt EXIF block
- **WHEN** a JPG whose EXIF block is corrupted is converted with `jpgtopng`
- **THEN** the PNG is written, has no EXIF details, and a note says the details looked damaged and were left out
