# image-info Specification

## Purpose
Defines what `info` reports about an image — format, size, dimensions, colour space, transparency, frames and a summary of its camera details — without printing a location by accident.

## Requirements

### Requirement: Image details
`info` SHALL report each image's format, file size, displayed dimensions, colour space, whether it has transparency, and its frame count when it is animated. It SHALL work for every supported image input format.

#### Scenario: A JPG
- **WHEN** `info` is run on a 1600 × 1200 JPG from a Canon EOS R5 taken on 2025:05:01 12:00:00
- **THEN** it shows the format JPG, the file size, `1600 × 1200`, the camera Canon EOS R5 and the date taken

#### Scenario: Smallest and largest
- **WHEN** `info` is run on a 1 × 1 image and on a PNG whose header says 20000 × 20000
- **THEN** it shows `1 × 1` and `20000 × 20000`

#### Scenario: Animation
- **WHEN** `info` is run on a three-frame animated GIF
- **THEN** it shows 3 frames

#### Scenario: Every format
- **WHEN** `info` is run on a JPG, PNG, WebP, AVIF, GIF, TIFF, BMP, ICO, HEIC and SVG
- **THEN** each shows its format and dimensions

#### Scenario: Transparency
- **WHEN** `info` is run on a transparent PNG and on an opaque JPG
- **THEN** the PNG shows transparency yes and the JPG shows no

### Requirement: Location shown only on request
When an image holds a GPS location, `info` SHALL say "Location: yes" without coordinates, and SHALL show the coordinates only with `--verbose`. An image without camera details SHALL say "No camera details" instead of empty fields.

#### Scenario: Photo with GPS
- **WHEN** `info` is run on the iPhone-style HEIC fixture
- **THEN** it shows "Location: yes" and no coordinates, and with `--verbose` it shows coordinates near 51.5007, -0.1246

#### Scenario: No details
- **WHEN** `info` is run on an image without camera details
- **THEN** it shows "No camera details"

### Requirement: Info as JSON
`info --json` SHALL include every field: file, format, file size in bytes, width, height, colour space, transparency, frames, camera, date taken and location. The location SHALL be `true` or `false`, or the coordinates with `--verbose`.

#### Scenario: JSON fields
- **WHEN** `info --json` is run on the HEIC fixture
- **THEN** the object has every field, and its location is `true`

### Requirement: Checking a photo before sharing
`info` SHALL tell a user at a glance whether a photo still holds its location.

#### Scenario: Before and after strip
- **WHEN** a user runs `info` on a photo with GPS, then on the result of `strip`
- **THEN** the first says "Location: yes" and the second says "No camera details"
