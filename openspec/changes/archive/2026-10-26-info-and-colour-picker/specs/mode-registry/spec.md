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
  - `colorpick`'s `--at` allows two whole numbers of 0 or more separated by a comma, such as `10,20`.

#### Scenario: Defaults are valid
- **WHEN** every option default in the registry is checked against its option's rule
- **THEN** every default passes

#### Scenario: Palette count has no default
- **WHEN** `colorpick`'s options are inspected
- **THEN** `--palette` has no default, because it always needs a count

#### Scenario: TIFF quality has no default
- **WHEN** `pngtotiff`'s options are inspected
- **THEN** `--quality` allows whole numbers from 1 to 100 and has no default, because TIFF is lossless unless a quality is given

### Requirement: Common options
Every mode SHALL accept the common options `-o/--output`, `--overwrite`, `--strip-metadata`, `-r/--recursive`, `--dry-run`, `-q/--quiet` and `-v/--verbose`, except that a mode which shows details instead of creating files SHALL NOT accept `-o/--output`, `--overwrite` or `--strip-metadata`, and its help SHALL NOT list them.

#### Scenario: Common options on any mode
- **WHEN** the options of `heictojpg`, `rotate` and `movtomp4` are inspected
- **THEN** each includes all seven common options

#### Scenario: Modes that print details
- **WHEN** the options and help of `info` and `colorpick` are inspected
- **THEN** they include `-r/--recursive`, `--dry-run`, `-q/--quiet` and `-v/--verbose`, but not `-o/--output`, `--overwrite` or `--strip-metadata`, and the usage line has no `-o`
