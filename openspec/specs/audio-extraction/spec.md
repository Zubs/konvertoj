# audio-extraction Specification

## Purpose
Defines how konvertoj extracts the sound from videos as MP3, WAV, M4A, OGG or FLAC, optionally trimmed to a section, with the right quality and clear failures.

## Requirements

### Requirement: Audio formats
The `<video>to<audio>` and `to<audio>` modes SHALL write the first audio track of a video as MP3 (LAME), M4A (AAC), OGG (Vorbis, or Opus when Vorbis isn't available), WAV (16-bit PCM) or FLAC, with the same length as the video. WAV and FLAC SHALL be lossless.

#### Scenario: MP4 to MP3
- **WHEN** a 4-second MP4 with sound is converted with `mp4tomp3`
- **THEN** a 4-second MP3 is written

#### Scenario: Every format
- **WHEN** a video is converted to MP3, WAV, M4A, OGG and FLAC
- **THEN** each file holds audio in its format's usual codec, which common players play

#### Scenario: Lossless
- **WHEN** the same video is converted to WAV and to FLAC
- **THEN** both decode to exactly the same samples

#### Scenario: A folder of videos
- **WHEN** a folder of videos is given to `tomp3`
- **THEN** each becomes an MP3

### Requirement: Bitrate
`--bitrate` SHALL be `128k`, `192k`, `256k` or `320k` (default `192k`) and SHALL set the bitrate of MP3, M4A and OGG files. With WAV or FLAC it SHALL be ignored, and a warning SHALL say so once, before any file is processed.

#### Scenario: Higher bitrate is bigger
- **WHEN** the same video is converted with `--bitrate 320k` and `--bitrate 128k`
- **THEN** the 320k MP3 is bigger

#### Scenario: Not allowed
- **WHEN** `--bitrate 100k` is given
- **THEN** it fails with exit code `1`, listing `128k, 192k, 256k, 320k`

#### Scenario: Lossless formats
- **WHEN** `towav --bitrate 320k` is run
- **THEN** a warning says `--bitrate` is ignored for WAV, and the WAV is written

### Requirement: Trimming
`--start` and `--end` SHALL accept seconds (`90`), minutes and seconds (`1:30`) or hours, minutes and seconds (`1:02:30`). `--start` alone SHALL run to the end, `--end` alone SHALL start at the beginning, and the result SHALL be accurate to the second. An `--end` that isn't after `--start` SHALL be rejected before any file is read. A `--start` at or past the end of a video SHALL fail for that video, giving the video's length.

#### Scenario: A section
- **WHEN** a 3-minute video is converted with `--start 0:30 --end 2:15`
- **THEN** the audio is 1:45 long

#### Scenario: Start or end alone
- **WHEN** a 3-minute video is converted with `--start 2:00`, and with `--end 0:20`
- **THEN** the first is 1:00 long, and the second is 0:20 long

#### Scenario: Three spellings
- **WHEN** the same video is converted with `--start 90`, `--start 1:30` and `--start 0:01:30`
- **THEN** all three results are the same length

#### Scenario: Backwards
- **WHEN** `--start 2:00 --end 1:00` is given
- **THEN** it fails with exit code `1` before any file is read, saying `--end` must be after `--start`

#### Scenario: End at zero
- **WHEN** `--end 0` is given without `--start`
- **THEN** it fails with exit code `1` before any file is read

#### Scenario: Past the end
- **WHEN** a 3-minute video is converted with `--start 5:00`
- **THEN** it fails, saying the video is only 3:00 long

### Requirement: Videos without usable sound
A video with no audio track SHALL fail with "has no audio", and a damaged video SHALL fail with "looks damaged".

#### Scenario: Silent video
- **WHEN** a video without an audio track is converted with `mp4tomp3`
- **THEN** it fails with "has no audio"

#### Scenario: Damaged
- **WHEN** a video cut off part-way is converted with `mp4tomp3`
- **THEN** it fails with "looks damaged"

### Requirement: Earlier results and audio files
Audio files SHALL be recognised by their contents. Audio files found in a folder from an earlier run SHALL be skipped as already in the output format. An audio file given directly SHALL fail, saying konvertoj extracts audio from videos but doesn't convert between audio formats (or that it is already in the target format).

#### Scenario: Second run
- **WHEN** `tomp3 ./videos` is run twice on a folder of videos
- **THEN** the second run skips the MP3s from the first with "already an MP3", and the exit code is `0`

#### Scenario: Audio given directly
- **WHEN** `towav song.mp3` is run on an MP3
- **THEN** it fails, saying konvertoj doesn't convert between audio formats

### Requirement: Talk to podcast
A recorded talk SHALL become an MP3 in one command.

#### Scenario: Podcast
- **WHEN** a user runs `tomp3 talk.mp4 --start 1:30`
- **THEN** `talk.mp3` holds the talk from 1:30 to the end
