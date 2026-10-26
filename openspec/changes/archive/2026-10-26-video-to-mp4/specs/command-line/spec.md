# Spec Delta

## MODIFIED Requirements

### Requirement: Modes not built yet
A valid command for a registered mode whose work isn't built yet SHALL fail with exit code `1` and say `<mode> isn't available yet.` This SHALL happen after its inputs have been found and its outputs planned, so input mistakes are reported first, and SHALL NOT create any folders. `--dry-run` SHALL still print the plan and exit with `0`.

#### Scenario: Running an unbuilt mode
- **WHEN** a user runs `konvertoj -m mp4tomp3 clip.mp4` before audio extraction exists, and `clip.mp4` exists
- **THEN** it fails with exit code `1` and "mp4tomp3 isn't available yet."

#### Scenario: Input mistakes come first
- **WHEN** a user runs `konvertoj -m mp4tomp3 missing.mp4` and the file doesn't exist
- **THEN** it fails, naming `missing.mp4`, without mentioning that the mode isn't available

#### Scenario: Dry run of an unbuilt mode
- **WHEN** a user runs `konvertoj -m mp4tomp3 clip.mp4 --dry-run`
- **THEN** it prints `clip.mp4 → clip.mp3` and exits with `0`
