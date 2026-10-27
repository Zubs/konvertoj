# Spec Delta

## ADDED Requirements

### Requirement: Mode option checks
A mode MAY declare rules that look at several of its options together, such as a missing required choice or two options that conflict. A broken rule SHALL fail with exit code `1` and a plain-English message, after the option value checks and before any input is read or any folder is created.

#### Scenario: Conflicting options
- **WHEN** a user runs `konvertoj -m resize photo.jpg --scale 50% --width 800 -o out/`
- **THEN** it fails with exit code `1`, says `--scale` can't be used with `--width`, and no `out` folder is created

#### Scenario: Checked before inputs
- **WHEN** a user runs `konvertoj -m resize missing.jpg` and `missing.jpg` doesn't exist
- **THEN** it fails with "Give --width, --height or --scale", not the missing-file message
