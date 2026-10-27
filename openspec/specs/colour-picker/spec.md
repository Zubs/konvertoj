# colour-picker Specification

## Purpose
Defines how `colorpick` reports colours from an image: the pixel at a point, or its main colours, in HEX, RGB and HSL, with transparency and JSON for scripts.

## Requirements

### Requirement: Colour at a point
`colorpick --at x,y` SHALL report the colour of the pixel at that point, counted from the top left starting at 0. A point outside the image SHALL fail, giving the image's size. `--at` SHALL be two whole numbers of 0 or more, such as `10,20`.

#### Scenario: Pure red
- **WHEN** `colorpick --at 0,0` is run on an image whose top-left pixel is pure red
- **THEN** it reports `#FF0000`, `rgb(255, 0, 0)` and `hsl(0, 100%, 50%)`

#### Scenario: Last pixel and past the edge
- **WHEN** `--at 99,49` and `--at 100,49` are given for a 100 × 50 image
- **THEN** the first works, and the second fails, saying the image is 100 × 50 pixels

#### Scenario: Bad points
- **WHEN** `--at 10`, `--at -1,5` or `--at a,b` is given
- **THEN** each fails with exit code `1` before any file is read

#### Scenario: Half-transparent pixel
- **WHEN** the pixel at the point is red at half opacity
- **THEN** the report includes its transparency, as `#FF000080`, `rgba(255, 0, 0, 0.5)` and `hsla(0, 100%, 50%, 0.5)`

### Requirement: Main colours
`colorpick --palette n` SHALL report the image's `n` main colours (1 to 16), found by median-cut quantisation, from most to least common, each with its share of the image. Fully transparent pixels SHALL be ignored.

#### Scenario: Three stripes
- **WHEN** `--palette 3` is run on an image of red, green and blue stripes, the red stripe widest
- **THEN** it reports red, green and blue, red first

#### Scenario: Limits
- **WHEN** `--palette 1` and `--palette 16` are run, and `--palette 0`, `17` and `abc`
- **THEN** the first two work and the others fail

### Requirement: Colour picker usage
`colorpick` SHALL need `--at`, `--palette` or both, failing with a usage hint otherwise. Each colour SHALL be shown with a coloured block when standard output is a terminal with colours allowed. With `--json` the same colours SHALL be printed as JSON.

#### Scenario: No option
- **WHEN** `colorpick` is run without `--at` or `--palette`
- **THEN** it fails with exit code `1`, suggesting `--at 10,10` or `--palette 5`

#### Scenario: JSON
- **WHEN** `colorpick --at 0,0 --palette 3 --json` is run
- **THEN** standard output is a JSON array whose object has the pixel and three palette colours, each with hex, rgb and hsl values

#### Scenario: Every format
- **WHEN** `colorpick --at 0,0` is run on a JPG, PNG, WebP, AVIF, GIF, TIFF, BMP, ICO, HEIC and SVG
- **THEN** each reports a colour

#### Scenario: Brand colours
- **WHEN** a designer runs `colorpick brand.jpg --palette 5`
- **THEN** the five main colours are listed, most common first
