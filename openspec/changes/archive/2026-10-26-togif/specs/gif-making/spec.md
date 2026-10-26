# Spec Delta

## Purpose

Defines how `togif` turns an image or a short video clip into a GIF: still and animated images, video GIFs with a clip-specific palette, size, frame rate, trimming, speed, looping and the limit on long clips.

## ADDED Requirements

### Requirement: GIFs from images
`togif` SHALL turn an image into a GIF with the image converter, without FFmpeg. An animated WebP or GIF SHALL stay animated with the same number of frames. Any other image SHALL become a still GIF. `--width` SHALL resize an image GIF, never enlarging it. `--fps`, `--speed`, `--start`, `--end` and `--force` SHALL fail for an image, saying they only apply to videos, except that a GIF input given only those options SHALL be skipped as already a GIF.

#### Scenario: Still image
- **WHEN** a PNG is given to `togif`
- **THEN** a still GIF is written

#### Scenario: Animated WebP
- **WHEN** a three-frame animated WebP is given to `togif`
- **THEN** the GIF is animated with three frames

#### Scenario: No FFmpeg needed
- **WHEN** a PNG is given to `togif` with no FFmpeg available and no terminal
- **THEN** the GIF is written, with no prompt and no FFmpeg error

#### Scenario: Width on an image
- **WHEN** a 100-pixel-wide PNG is given to `togif --width 2000`, and to `togif --width 10`
- **THEN** the first GIF stays 100 wide with a note that `togif` never makes images bigger, and the second is 10 wide

#### Scenario: Earlier GIF with video options
- **WHEN** a folder holding a clip and the GIF made from it earlier is given to `togif --fps 15`
- **THEN** the earlier GIF is skipped as already a GIF, and the clip becomes a GIF

#### Scenario: Video option on an image
- **WHEN** a PNG is given to `togif --fps 5`
- **THEN** it fails, saying `--fps` only applies to videos

### Requirement: GIFs from videos
`togif` SHALL turn a video into an animated GIF that loops forever, with FFmpeg, using a palette made for the clip (`palettegen` then `paletteuse`). It SHALL be `--width` pixels wide (default 480, keeping the shape, never enlarged) at `--fps` frames a second (1–30, default 10). It SHALL need the FFmpeg add-on.

#### Scenario: Five-second clip
- **WHEN** a 5-second 640 × 360 MP4 is given to `togif`
- **THEN** the GIF is animated, loops forever, is 480 pixels wide, and has about 50 frames

#### Scenario: Frame rate limits
- **WHEN** `--fps 1` and `--fps 30` are given, and `--fps 0` and `--fps 31`
- **THEN** the first two work and the others fail with exit code `1`

#### Scenario: Better colours than a plain conversion
- **WHEN** a colourful clip becomes a GIF with `togif` and with FFmpeg's plain GIF conversion
- **THEN** the `togif` frames are closer to the source frames

#### Scenario: Needs the add-on
- **WHEN** a video is given to `togif` with no FFmpeg and no terminal
- **THEN** it fails, mentioning `--install-video`

#### Scenario: A folder of clips
- **WHEN** a folder of short clips is given to `togif`
- **THEN** each becomes its own GIF

### Requirement: Trimming and speed
`--start` and `--end` SHALL choose the section, as in feature 16. `--speed` (0.5–4, default 1) SHALL change how fast it plays, so `--speed 2` halves the GIF's length.

#### Scenario: A three-second section
- **WHEN** a clip is given to `togif --start 0:02 --end 0:05`
- **THEN** the GIF lasts about three seconds

#### Scenario: Twice as fast
- **WHEN** a 4-second clip is given to `togif --speed 2`
- **THEN** the GIF lasts about two seconds

#### Scenario: Speed limits
- **WHEN** `--speed 0.4` or `--speed 5` is given
- **THEN** it fails with exit code `1`

### Requirement: Long clips
A section longer than 30 seconds SHALL be refused unless `--force` is given, with a tip to use `--start` and `--end`. A section of 30 seconds or less SHALL be accepted.

#### Scenario: 31 and 30 seconds
- **WHEN** a 31-second clip and a 30-second clip are given to `togif` without options
- **THEN** the first is refused with a tip, and the second becomes a GIF

#### Scenario: Forced
- **WHEN** the 31-second clip is given with `--force`
- **THEN** it becomes a GIF

### Requirement: A GIF for a README
A screen recording SHALL become a GIF in one command.

#### Scenario: Screen recording
- **WHEN** a user runs `togif recording.mov --start 0:01 --end 0:04`
- **THEN** `recording.gif` is an animated, looping GIF of that section
