# Spec Delta

## Purpose

Defines how konvertoj turns MOV and other common videos into MP4 files that play everywhere: codecs, quality, resolution, sound, rotation, progress and the failures for empty, damaged and video-less files.

## ADDED Requirements

### Requirement: MP4 that plays everywhere
`movtomp4`, `mkvtomp4`, `avitomp4`, `webmtomp4`, `m4vtomp4` and `tomp4` SHALL write an MP4 with H.264 video in the `yuv420p` pixel format, AAC audio when the input has sound, and the index at the start of the file so playback can begin before it has fully downloaded. HEVC input SHALL be re-encoded.

#### Scenario: iPhone MOV
- **WHEN** the iPhone-style HEVC MOV fixture is converted with `movtomp4`
- **THEN** the MP4 has H.264 `yuv420p` video, AAC audio, and its `moov` index comes before its `mdat` data

#### Scenario: Odd size
- **WHEN** a 321 × 181 video is converted
- **THEN** the MP4 is 320 × 180

#### Scenario: Unknown duration
- **WHEN** a WebM whose header gives no duration is converted
- **THEN** it converts, without a percentage in its progress

#### Scenario: Every input format
- **WHEN** an MKV, an AVI, a WebM and an M4V are each given to `tomp4`
- **THEN** each becomes an MP4

### Requirement: Quality
`--quality low`, `medium` and `high` SHALL set CRF 28, 23 and 18, default `medium`. Other values SHALL be rejected, listing the allowed ones.

#### Scenario: High is bigger than low
- **WHEN** the same detailed video is converted with `--quality high` and `--quality low`
- **THEN** the `high` MP4 is bigger

#### Scenario: Not allowed
- **WHEN** `--quality max` is given
- **THEN** it fails with exit code `1`, listing `low, medium, high`

### Requirement: Resolution
`--resolution 1080p`, `720p` and `480p` SHALL make the video's shorter side at most 1080, 720 or 480 pixels, keeping its shape and never enlarging it. A video already that small SHALL keep its size, and its result SHALL carry a note. Other values SHALL be rejected, listing the allowed ones.

#### Scenario: 4K to 720p
- **WHEN** a 3840 × 2160 video is converted with `--resolution 720p`
- **THEN** the MP4 is 1280 × 720

#### Scenario: Already small
- **WHEN** an 854 × 480 video is converted with `--resolution 720p`
- **THEN** the MP4 stays 854 × 480, and a note says it was kept at its size

#### Scenario: Not allowed
- **WHEN** `--resolution 4k` is given
- **THEN** it fails with exit code `1`, listing `1080p, 720p, 480p`

### Requirement: Sound
`--mute` SHALL write an MP4 with no audio track. A video with no audio SHALL convert without errors.

#### Scenario: Muted
- **WHEN** a video with sound is converted with `--mute`
- **THEN** the MP4 has no audio stream

#### Scenario: Silent input
- **WHEN** a video with no audio stream is converted
- **THEN** it succeeds, and the MP4 has no audio stream

### Requirement: Upright videos stay upright
A video tagged as filmed upright SHALL come out upright, with its displayed width and height.

#### Scenario: Portrait phone video
- **WHEN** the fixture, stored 320 × 180 with a 90° rotation tag, is converted
- **THEN** the MP4 is 180 × 320

### Requirement: Any length
Very short and very long videos SHALL both convert, with progress shown as a percentage and time left.

#### Scenario: One second and over an hour
- **WHEN** a one-second clip and a clip over an hour long are converted
- **THEN** both MP4s are written, with durations matching their inputs

#### Scenario: Progress
- **WHEN** a video converts in a terminal
- **THEN** the progress line shows the file's percentage

### Requirement: Videos that can't be converted
A file with no video stream, or whose video stream has no frames, SHALL fail with "has no video". A damaged video SHALL fail with "looks damaged". Ctrl+C SHALL stop FFmpeg and remove the half-written MP4.

#### Scenario: No video stream
- **WHEN** an MP4 holding only audio is given to `tomp4 --quality high`
- **THEN** it fails with "has no video"

#### Scenario: No frames
- **WHEN** a video whose video stream holds no frames is converted
- **THEN** it fails with "has no video", and nothing is written

#### Scenario: Damaged
- **WHEN** a MOV cut off part-way is converted
- **THEN** it fails with "looks damaged"

#### Scenario: Ctrl+C
- **WHEN** Ctrl+C is pressed while a long video converts
- **THEN** no part of the MP4 is left behind

### Requirement: Details and streams
The details in a video, such as its GPS location, SHALL be kept unless `--strip-metadata` is given, which SHALL remove them. When a file holds several video streams, the main one SHALL be converted, never a cover picture.

#### Scenario: Location removed
- **WHEN** a MOV with a GPS location is converted with `movtomp4 --strip-metadata`
- **THEN** the MP4 has no location, and without the option it keeps it

#### Scenario: Cover picture
- **WHEN** a file's first video stream is a still cover picture and its second is the video
- **THEN** the MP4 is made from the video

### Requirement: Holiday videos
A folder of iPhone videos SHALL become MP4s in one command, one file at a time.

#### Scenario: Holiday folder
- **WHEN** a user runs `movtomp4 ./holiday -o ./mp4s` on a folder of MOV files
- **THEN** every video becomes an MP4 in `mp4s`
