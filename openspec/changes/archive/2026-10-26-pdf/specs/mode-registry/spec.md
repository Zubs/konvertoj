# Spec Delta

## MODIFIED Requirements

### Requirement: Option value rules
A value option whose valid values are a fixed list of words, a number range, a colour, a list of sizes or a fixed pattern SHALL declare that list, range, colour rule, size list rule or pattern for its mode. A range SHALL state whether only whole numbers are allowed. Every declared default SHALL satisfy its own rule.

#### Scenario: Declared rules
- **WHEN** the registry is inspected
- **THEN**:
  - `--fit` allows `contain`, `cover`, `fill`, `inside` and `outside`,
  - `heictojpg`'s `--quality` allows whole numbers from 1 to 100,
  - `movtomp4`'s `--quality` allows `low`, `medium` and `high`,
  - `togif`'s `--fps` allows whole numbers from 1 to 30 and `--speed` allows 0.5 to 4,
  - `enlarge`'s `--scale` allows `2x` and `4x`,
  - `colorpick`'s `--palette` allows whole numbers from 1 to 16,
  - `pdftopng`'s `--dpi` allows 36 to 600,
  - `--background` in `pngtojpg` and `rotate` allows colours,
  - `pngtoico`'s `--sizes` allows comma-separated whole numbers from 1 to 256,
  - `svgtopng`'s `--dpi` allows numbers from 1 to 7200,
  - `resize`'s `--scale` allows positive percentages such as `50%`,
  - `compress`'s `--target-size` allows a positive size in `kb` or `mb`, in any letter case, such as `200kb` or `1.5MB`,
  - `crop`'s `--aspect` allows a ratio of two positive numbers, such as `16:9` or `1:1`,
  - `colorpick`'s `--at` allows two whole numbers of 0 or more separated by a comma, such as `10,20`,
  - `pdftopng`'s `--page` allows `all`, a page, a range or a comma-separated list of pages and ranges, such as `3`, `1-5` or `1,3,7`.

#### Scenario: Defaults are valid
- **WHEN** every option default in the registry is checked against its option's rule
- **THEN** every default passes

#### Scenario: Palette count has no default
- **WHEN** `colorpick`'s options are inspected
- **THEN** `--palette` has no default, because it always needs a count

#### Scenario: TIFF quality has no default
- **WHEN** `pngtotiff`'s options are inspected
- **THEN** `--quality` allows whole numbers from 1 to 100 and has no default, because TIFF is lossless unless a quality is given

### Requirement: Output naming details
Every Tools mode whose output keeps the input's format SHALL declare its output suffix:
- `compress`: `compressed`
- `resize`: `resized`
- `enlarge`: `enlarged`
- `crop`: `cropped`
- `rotate`: `rotated`
- `flip`: `flipped`
- `strip`: `stripped`

Every `<image>topdf` mode and `topdf` SHALL be marked as combining all inputs into one output. No other mode SHALL be. Every `pdfto<image>` mode SHALL be marked as writing several files per input. No other mode SHALL be.

#### Scenario: Suffixes declared
- **WHEN** the registry is inspected
- **THEN** every mode with output "same as input" has a suffix, and `compress` has `compressed`

#### Scenario: Several outputs per input
- **WHEN** the registry is inspected
- **THEN** exactly the 8 `pdfto<image>` modes write several files per input

#### Scenario: Combining modes
- **WHEN** the registry is inspected
- **THEN** exactly the 11 images-to-PDF modes combine their inputs, and `pdftopng` and `heictojpg` don't

