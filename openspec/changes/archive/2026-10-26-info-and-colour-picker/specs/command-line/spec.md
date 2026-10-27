# Spec Delta

## ADDED Requirements

### Requirement: No output for modes that print details
For a mode that shows details instead of creating files, `-o`/`--output` SHALL fail with exit code `1` before any file is read, saying the mode doesn't create files.

#### Scenario: info with -o
- **WHEN** a user runs `konvertoj -m info photo.jpg -o details`
- **THEN** it fails with exit code `1`, saying `info` doesn't create files, so `-o` can't be used

#### Scenario: colorpick with -o
- **WHEN** a user runs `konvertoj -m colorpick logo.png --at 0,0 -o colours`
- **THEN** it fails the same way, naming `colorpick`
