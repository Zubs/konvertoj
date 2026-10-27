# Spec Delta

## ADDED Requirements

### Requirement: Install the video add-on
`konvertoj --install-video` SHALL make sure FFmpeg is available for video and audio modes, downloading the add-on if needed, and SHALL be listed on the main help screen. It SHALL work without `-m` or any input.

#### Scenario: Help lists it
- **WHEN** a user runs `konvertoj --help`
- **THEN** the help shows `--install-video`

#### Scenario: Nothing to do
- **WHEN** a user runs `konvertoj --install-video` with FFmpeg 6 on the `PATH`
- **THEN** it says FFmpeg is already installed, naming it, and exits with `0`
