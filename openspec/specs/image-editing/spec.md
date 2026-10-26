# image-editing Specification

## Purpose
Defines konvertoj's editing tools: `crop` (exact area, position, aspect ratio and trimming borders), `rotate` (any angle, or upright from the orientation tag) and `flip`, including their option rules, limits and how they treat animations.

## Requirements

### Requirement: Crop by area or position
`crop` SHALL cut `--width` × `--height` pixels from the image, at `--left`/`--top` when given, or else at `--position` (`center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`; default `center`). It SHALL keep the format and save `<name>-cropped.<ext>`.

#### Scenario: Centred crop
- **WHEN** a 1600 × 1200 image is cropped with `--width 800 --height 800`
- **THEN** the output is 800 × 800, taken from the middle

#### Scenario: Every position
- **WHEN** an image with a different colour in each corner, edge and centre region is cropped with each `--position`
- **THEN** each output comes from the matching place

#### Scenario: Exact area
- **WHEN** an image is cropped with `--width 10 --height 10 --left 5 --top 20`
- **THEN** the output is the 10 × 10 area starting 5 pixels from the left and 20 from the top

#### Scenario: Whole image
- **WHEN** a crop is exactly a PNG's size
- **THEN** the output has the same size and pixels as the input

#### Scenario: Past the edge
- **WHEN** a 1600 × 1200 image is cropped with `--width 2000 --height 800`, with `--width 2000 --height 800 --position right`, or with `--width 800 --height 800 --left 1000 --top 0`
- **THEN** it fails, saying the crop goes past the edge of the image, which is 1600 × 1200 pixels

### Requirement: Crop to an aspect ratio
`--aspect W:H` SHALL crop the largest area with that ratio, placed by `--position`. The ratio SHALL be two positive numbers; anything else SHALL be rejected before any file is read.

#### Scenario: Square and wide
- **WHEN** a 1600 × 1200 image is cropped with `--aspect 1:1`, and with `--aspect 16:9`
- **THEN** the outputs are 1200 × 1200 and 1600 × 900

#### Scenario: Bad ratios
- **WHEN** `--aspect 0:9`, `--aspect 16` or `--aspect abc` is given
- **THEN** each fails with exit code `1`, giving an example such as `16:9`

### Requirement: Trim borders
`--trim` SHALL remove plain borders that match the image's top-left colour. When there is no such border, the image SHALL be left at its size and the result SHALL carry a note saying no border was found.

#### Scenario: Screenshot border
- **WHEN** a screenshot with a plain white border around its content is cropped with `--trim`
- **THEN** the output is the content without the border

#### Scenario: No border
- **WHEN** an image whose corners differ is cropped with `--trim`
- **THEN** the output keeps the image's size, and a note says no plain border was found

### Requirement: Crop option rules
Before any file is read, `crop` SHALL fail with exit code `1` when:
- no crop option is given, with a list of the ways to crop,
- the options are incomplete: only one of `--left` and `--top`, `--left`/`--top` without `--width` and `--height`, or only one of `--width` and `--height`,
- the options conflict: `--aspect` or `--trim` with any other crop option except `--position` for `--aspect`, or `--position` with `--left`/`--top`.

#### Scenario: No options
- **WHEN** `crop` is run with no options
- **THEN** it fails, listing `--width` and `--height`, `--aspect` and `--trim`

#### Scenario: Incomplete
- **WHEN** `crop --width 100 --height 100 --left 10` is run
- **THEN** it fails, saying `--left` and `--top` go together

#### Scenario: Conflicting
- **WHEN** `crop --aspect 1:1 --trim` is run
- **THEN** it fails, saying `--aspect` and `--trim` can't be used together

### Requirement: Rotate by any angle
`rotate --angle` SHALL turn the image clockwise by any number of degrees, including negative ones. Multiples of 90 SHALL turn it exactly. `0` and `360` SHALL leave it unchanged. Other angles SHALL enlarge the canvas to fit, filling the corners with `--background`, or with transparency where the format can hold it and white otherwise. A non-numeric angle SHALL be rejected.

#### Scenario: Quarter turns
- **WHEN** an 800 × 600 image is rotated by `90`, `180`, `270` and `-90`
- **THEN** the outputs are 600 × 800, 800 × 600, 600 × 800 and 600 × 800, each turned the right way

#### Scenario: No turn
- **WHEN** a PNG is rotated by `0` or `360`
- **THEN** the output has the same size and pixels

#### Scenario: Forty-five degrees
- **WHEN** a PNG and a JPG are rotated by `45`
- **THEN** both canvases grow, the PNG's corners are transparent and the JPG's corners are white

#### Scenario: Not a number
- **WHEN** `rotate --angle abc` is run
- **THEN** it fails with exit code `1`

### Requirement: Upright from the orientation tag
`rotate --auto` SHALL turn a photo upright using its orientation tag, and the output SHALL have no orientation tag. A photo that is already upright, or a format without an orientation tag, SHALL be skipped with "already upright" when no `--angle` is given. With `--angle` too, the photo SHALL be turned upright and then rotated. `rotate` with neither `--angle` nor `--auto` SHALL fail with a usage hint before any file is read.

#### Scenario: Sideways photo
- **WHEN** a 60 × 40 JPG tagged with orientation 6 is run through `rotate --auto`
- **THEN** the output is 40 × 60 with no orientation tag

#### Scenario: Already upright
- **WHEN** an untagged photo is run through `rotate --auto`
- **THEN** it is skipped with "already upright" and nothing is written

#### Scenario: Upright and then turned
- **WHEN** a 60 × 40 JPG tagged with orientation 6 is run through `rotate --auto --angle 90`
- **THEN** it is turned upright and then by 90°, giving 60 × 40, and is not skipped

#### Scenario: Missing angle
- **WHEN** `rotate` is run with neither `--angle` nor `--auto`
- **THEN** it fails, suggesting `--angle 90` or `--auto`

### Requirement: Flip
`flip --direction horizontal` SHALL mirror the image left to right, and `vertical` SHALL mirror it top to bottom. A missing or unknown direction SHALL fail, listing `horizontal` and `vertical`.

#### Scenario: Both directions
- **WHEN** an image red on the left and blue on the right is flipped horizontally, and one red on top and blue below is flipped vertically
- **THEN** the first output is blue on the left, and the second is blue on top

#### Scenario: Missing direction
- **WHEN** `flip` is run without `--direction`, or with `--direction sideways`
- **THEN** it fails, listing `horizontal` and `vertical`

### Requirement: Editing keeps animation
Rotating, flipping and cropping (including `--trim`) an animated GIF or WebP SHALL keep it animated, with the same number of frames, frame delays and loop count. `--trim` SHALL use the first frame's border for every frame.

#### Scenario: Animated GIF
- **WHEN** a three-frame animated GIF is rotated by `90`, flipped horizontally, cropped with `--width` and `--height`, and cropped with `--trim`
- **THEN** every output is an animated GIF with three frames and the original delays

#### Scenario: Edited icon
- **WHEN** a 48 pixel ICO is cropped with `--width 20 --height 20`
- **THEN** the output is an ICO holding one 20 pixel image

### Requirement: Real-world editing
Folders SHALL be edited in one command.

#### Scenario: Social posts and upside-down scans
- **WHEN** a creator runs `crop ./photos --aspect 1:1 -o ./square`, then `rotate ./scans --angle 180 -o ./fixed`
- **THEN** every photo in `square` is square, and every scan in `fixed` is turned the right way up
