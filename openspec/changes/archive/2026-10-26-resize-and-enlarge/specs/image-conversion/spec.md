# Spec Delta

## MODIFIED Requirements

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
