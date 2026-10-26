# Spec Delta

## Purpose

Defines how konvertoj changes an image's dimensions, both inside every conversion and with the `resize` and `enlarge` tools: width, height and scale, how `--fit` shapes the result, rounding, `--no-enlarge`, and the largest size allowed.

## ADDED Requirements

### Requirement: Width and height
`--width` and `--height` SHALL set the output size in every image conversion mode and in `resize`. Giving only one SHALL keep the image's shape. Sizes SHALL be whole numbers of 1 or more, and a result that isn't a whole number of pixels SHALL be rounded.

#### Scenario: Width only
- **WHEN** a 1600 × 1200 image is resized with `--width 800`
- **THEN** the output is 800 × 600

#### Scenario: Smallest width
- **WHEN** an image is resized with `--width 1`
- **THEN** the output is 1 pixel wide

#### Scenario: Invalid sizes
- **WHEN** `--width 0`, `--width -5` or `--width abc` is given
- **THEN** the command fails with exit code `1` before any file is touched

#### Scenario: Odd result
- **WHEN** a 667 × 1001 image is resized with `--width 333`
- **THEN** the output height is rounded to a whole number and the command succeeds

#### Scenario: While converting
- **WHEN** the HEIC fixture (displayed 48 × 64) is converted with `heictojpg --width 24`
- **THEN** the JPG is 24 × 32

#### Scenario: Resized icons
- **WHEN** a 100 × 100 PNG is converted with `pngtoico --width 64 --height 32 --fit cover --sizes 32`
- **THEN** the 32 pixel icon holds the 64 × 32 crop, fitted inside with transparent padding above and below

### Requirement: Fit
When both `--width` and `--height` are given, `--fit` SHALL decide the result, default `inside`:
- `inside`: the largest size that fits within both, keeping the shape,
- `outside`: the smallest size that covers both, keeping the shape,
- `cover`: exactly the given size, cropped from the centre,
- `contain`: exactly the given size, the image fitted inside with transparent padding (or `--background` where transparency can't be kept),
- `fill`: exactly the given size, stretched.

#### Scenario: Each fit on a wide image
- **WHEN** a 1600 × 1200 image is resized with `--width 800 --height 800` and each `--fit`
- **THEN** `inside` gives 800 × 600, `outside` 1067 × 800, and `cover`, `contain` and `fill` 800 × 800

#### Scenario: Each fit on a tall image
- **WHEN** a 1200 × 1600 image is resized with `--width 800 --height 800` and each `--fit`
- **THEN** `inside` gives 600 × 800, `outside` 800 × 1067, and `cover`, `contain` and `fill` 800 × 800

#### Scenario: Cover crops from the centre
- **WHEN** a 1600 × 1200 image whose outer 150 pixels on the left and right are red and whose middle is blue is resized with `--width 800 --height 800 --fit cover`
- **THEN** the output is 800 × 800 and blue at its left and right edges

### Requirement: Scale for resize
`resize` SHALL accept `--scale` as a positive percentage, such as `50%` or `200%`, applied to both sides. `--scale` with `--width` or `--height` SHALL be rejected as conflicting, and `resize` with none of `--width`, `--height` and `--scale` SHALL fail with "Give --width, --height or --scale". Both checks SHALL happen before any file is touched.

#### Scenario: Half and double
- **WHEN** a 400 × 300 image is resized with `--scale 50%`, and again with `--scale 200%`
- **THEN** the outputs are 200 × 150 and 800 × 600

#### Scenario: No size
- **WHEN** `resize` is run with no size option
- **THEN** it fails with exit code `1` and "Give --width, --height or --scale"

#### Scenario: Conflicting options
- **WHEN** `resize --scale 50% --width 800` is run
- **THEN** it fails with exit code `1`, saying `--scale` can't be used with `--width`

#### Scenario: Invalid percentages
- **WHEN** `--scale 0%`, `--scale 50` or `--scale abc` is given to `resize`
- **THEN** each fails with exit code `1`, saying `--scale` must be a percentage such as `50%`

### Requirement: No enlarging
With `--no-enlarge`, `resize` SHALL never make an image bigger. An image that would have grown SHALL keep its size, and its result SHALL carry a note saying so.

#### Scenario: Small image kept
- **WHEN** a 400 × 300 image is resized with `--width 800 --no-enlarge`
- **THEN** the output is 400 × 300 and a note says it was kept at its size because of `--no-enlarge`

### Requirement: Enlarge
`enlarge` SHALL make an image exactly 2 or 4 times as big on each side (`--scale 2x` or `4x`, default `2x`), using the high-quality Lanczos method followed by a light sharpen. Any other scale SHALL be rejected, listing `2x` and `4x`.

#### Scenario: Default
- **WHEN** `enlarge` is run on a 400 × 300 image with no options
- **THEN** the output is 800 × 600

#### Scenario: Four times
- **WHEN** `enlarge --scale 4x` is run on a 400 × 300 image
- **THEN** the output is 1600 × 1200

#### Scenario: Tiny image
- **WHEN** `enlarge` is run on a 1 × 1 image
- **THEN** the output is 2 × 2

#### Scenario: Other scales
- **WHEN** `enlarge --scale 3x`, `--scale 1x` or `--scale abc` is run
- **THEN** each fails, listing `2x` and `4x`

#### Scenario: Any capitalisation
- **WHEN** `enlarge --scale 2X` is run on a 400 × 300 image
- **THEN** the output is 800 × 600

#### Scenario: Enlarging an icon
- **WHEN** `enlarge` is run on an ICO whose largest image is 48 pixels
- **THEN** the output is an ICO holding one 96 pixel image, and `resize --width 300` on the same ICO is refused because icons can be at most 256 pixels

#### Scenario: Folder of icons
- **WHEN** `enlarge` is run on a folder of small icons
- **THEN** every icon is enlarged

### Requirement: Size limit
A result larger than 16,384 pixels on either side SHALL be refused, and the reason SHALL give the size it would have been.

#### Scenario: Too big
- **WHEN** a 5000 × 4000 image is enlarged with `--scale 4x`
- **THEN** it fails, saying it would be 20000 × 16000 pixels, over the 16384-pixel limit

### Requirement: Resizing keeps what matters
Resizing and enlarging SHALL keep an animated GIF animated, keep transparency, keep the format for `resize` and `enlarge` (saving `<name>-resized.<ext>` and `<name>-enlarged.<ext>`), and work with `--strip-metadata`.

#### Scenario: Animated GIF
- **WHEN** a three-frame animated GIF is resized with `--width 6`
- **THEN** the output is an animated GIF with three frames, 6 pixels wide

#### Scenario: Transparent PNG
- **WHEN** a transparent PNG is resized and enlarged
- **THEN** both outputs are still transparent

#### Scenario: Stripping while resizing
- **WHEN** a JPG with camera details is run through `resize --width 10 --strip-metadata` and `enlarge --strip-metadata`
- **THEN** neither output has camera details

### Requirement: Real-world resizing
A folder of screenshots SHALL resize in one command, and a small photo SHALL enlarge for printing.

#### Scenario: Blog screenshots and a print
- **WHEN** a writer runs `resize ./screenshots --width 1200 -o ./blog` on screenshots wider than 1200 pixels, then `enlarge old.jpg --scale 4x`
- **THEN** every screenshot in `blog` is 1200 pixels wide, and `old-enlarged.jpg` is four times the size of `old.jpg`
