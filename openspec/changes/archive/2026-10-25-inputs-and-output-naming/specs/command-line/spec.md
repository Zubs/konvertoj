# Spec Delta

## MODIFIED Requirements

### Requirement: Option values are checked
A value outside its option's declared word list or range SHALL fail with exit code `1` before the mode runs. The message SHALL name the option, the value given, and the allowed words or range. Word matching SHALL ignore letter case. Options without a declared rule SHALL pass through unchecked. Option values SHALL be checked before inputs, so a wrong value is reported even when the inputs are wrong too.

#### Scenario: Word not allowed
- **WHEN** a user runs `konvertoj -m resize photo.jpg --fit banana`
- **THEN** it fails with exit code `1` and a message naming `--fit` and `banana` and listing `contain, cover, fill, inside, outside`

#### Scenario: Number out of range
- **WHEN** a user runs `-m heictojpg photo.heic --quality 101`, `--quality 0` or `--quality abc`
- **THEN** each fails with exit code `1` and a message saying `--quality` must be a whole number from 1 to 100

#### Scenario: Whole numbers only
- **WHEN** a user runs `-m togif clip.mp4 --fps 2.5`
- **THEN** it fails, saying `--fps` must be a whole number from 1 to 30

#### Scenario: Valid values pass
- **WHEN** a user runs `-m heictojpg photo.heic --quality 1`, `--quality 100`, or `-m movtomp4 clip.mov --quality HIGH`, with those files present
- **THEN** none fails an option check, and each reaches the "isn't available yet" message

#### Scenario: Same name, different rule
- **WHEN** a user runs `-m movtomp4 clip.mov --quality 80`
- **THEN** it fails, listing `low, medium, high`

#### Scenario: Negative numbers pass
- **WHEN** a user runs `-m rotate photo.jpg --angle -90`
- **THEN** no option check fails, because `--angle` allows any number

#### Scenario: Unchecked values pass through
- **WHEN** a user runs `-m heictojpg photo.heic --background banana`
- **THEN** no option check fails, because `--background` has no declared rule (colours are checked by feature 6)

#### Scenario: Option checked before inputs
- **WHEN** a user runs `-m heictojpg missing.heic --quality 101` and `missing.heic` doesn't exist
- **THEN** it fails with the `--quality` message, not the missing-file message

### Requirement: Modes not built yet
A valid command for a registered mode whose work isn't built yet SHALL fail with exit code `1` and say `<mode> isn't available yet.` This SHALL happen after its inputs have been found and its outputs planned, so input mistakes are reported first, and SHALL NOT create any folders. `--dry-run` SHALL still print the plan and exit with `0`.

#### Scenario: Running an unbuilt mode
- **WHEN** a user runs `konvertoj -m heictojpg photo.heic` before HEIC conversion exists, and `photo.heic` exists
- **THEN** it fails with exit code `1` and "heictojpg isn't available yet."

#### Scenario: Input mistakes come first
- **WHEN** a user runs `konvertoj -m heictojpg missing.heic` and the file doesn't exist
- **THEN** it fails, naming `missing.heic`, without mentioning that the mode isn't available

#### Scenario: Dry run of an unbuilt mode
- **WHEN** a user runs `konvertoj -m heictojpg photo.heic --dry-run`
- **THEN** it prints `photo.heic → photo.jpg` and exits with `0`
