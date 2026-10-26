# Spec Delta

## MODIFIED Requirements

### Requirement: Modes that need FFmpeg
Every mode in the Video & Audio group SHALL be marked as needing FFmpeg. `togif` SHALL need FFmpeg only when at least one of its inputs is a video. No Image, PDF or Tools mode SHALL need it.

#### Scenario: Marked modes
- **WHEN** the registry is inspected
- **THEN** all 41 Video & Audio modes need FFmpeg, and no Image, PDF or Tools mode does

#### Scenario: togif decides from its inputs
- **WHEN** `togif` is asked whether it needs FFmpeg for `logo.png`, and for `clip.mp4`
- **THEN** it doesn't for the PNG, and does for the MP4
