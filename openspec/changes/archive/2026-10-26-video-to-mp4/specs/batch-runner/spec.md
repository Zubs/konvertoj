# Spec Delta

## MODIFIED Requirements

### Requirement: Limited parallel work
konvertoj SHALL process at most `min(4, number of CPU cores)` items at the same time, and at least one. Modes that use FFmpeg SHALL process one item at a time, because FFmpeg already uses every core.

#### Scenario: Videos one at a time
- **WHEN** a folder of MOV files is converted with `movtomp4`
- **THEN** only one video is being converted at any moment

#### Scenario: Many cores
- **WHEN** twenty files are processed on a machine with 16 cores
- **THEN** no more than 4 are being processed at any moment
