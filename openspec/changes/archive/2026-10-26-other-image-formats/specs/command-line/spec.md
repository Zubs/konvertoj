# Spec Delta

## MODIFIED Requirements

### Requirement: Option values are checked
A value outside its option's declared word list, range, colour rule or size list rule SHALL fail with exit code `1` before the mode runs. The message SHALL name the option, the value given, and the allowed words, range or kind of value. Word matching SHALL ignore letter case. Options without a declared rule SHALL pass through unchecked. Option values SHALL be checked before inputs, so a wrong value is reported even when the inputs are wrong too.

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
- **THEN** none fails an option check

#### Scenario: Same name, different rule
- **WHEN** a user runs `-m movtomp4 clip.mov --quality 80`
- **THEN** it fails, listing `low, medium, high`

#### Scenario: Negative numbers pass
- **WHEN** a user runs `-m rotate photo.jpg --angle -90`
- **THEN** no option check fails, because `--angle` allows any number

#### Scenario: Colour not recognised
- **WHEN** a user runs `-m pngtojpg logo.png --background banana`
- **THEN** it fails with exit code `1`, naming `--background` and `banana` and giving examples such as `white`, `#ff8800` and `rgb(255,136,0)`, and no file is written

#### Scenario: Colours accepted
- **WHEN** a user runs `-m pngtojpg logo.png` with `--background red`, `--background #f80`, `--background #ff8800` or `--background rgb(255, 136, 0)`
- **THEN** no option check fails

#### Scenario: Icon sizes
- **WHEN** a user runs `-m pngtoico logo.png` with `--sizes 0`, `--sizes 257`, `--sizes abc` or `--sizes 16,,32`
- **THEN** each fails with exit code `1`, saying `--sizes` must be whole numbers from 1 to 256 separated by commas

#### Scenario: Unchecked values pass through
- **WHEN** a user runs `-m crop photo.jpg --aspect banana`
- **THEN** no option check fails, because `--aspect` has no declared rule (aspect ratios are checked by feature 11)

#### Scenario: Option checked before inputs
- **WHEN** a user runs `-m heictojpg missing.heic --quality 101` and `missing.heic` doesn't exist
- **THEN** it fails with the `--quality` message, not the missing-file message

### Requirement: Modes not built yet
A valid command for a registered mode whose work isn't built yet SHALL fail with exit code `1` and say `<mode> isn't available yet.` This SHALL happen after its inputs have been found and its outputs planned, so input mistakes are reported first, and SHALL NOT create any folders. `--dry-run` SHALL still print the plan and exit with `0`.

#### Scenario: Running an unbuilt mode
- **WHEN** a user runs `konvertoj -m movtomp4 clip.mov` before video conversion exists, and `clip.mov` exists
- **THEN** it fails with exit code `1` and "movtomp4 isn't available yet."

#### Scenario: Input mistakes come first
- **WHEN** a user runs `konvertoj -m movtomp4 missing.mov` and the file doesn't exist
- **THEN** it fails, naming `missing.mov`, without mentioning that the mode isn't available

#### Scenario: Dry run of an unbuilt mode
- **WHEN** a user runs `konvertoj -m movtomp4 clip.mov --dry-run`
- **THEN** it prints `clip.mov → clip.mp4` and exits with `0`
