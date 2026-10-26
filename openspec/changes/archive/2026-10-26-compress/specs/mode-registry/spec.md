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
  - `compress`'s `--target-size` allows a positive size in `kb` or `mb`, in any letter case, such as `200kb` or `1.5MB`.

#### Scenario: Defaults are valid
- **WHEN** every option default in the registry is checked against its option's rule
- **THEN** every default passes

#### Scenario: TIFF quality has no default
- **WHEN** `pngtotiff`'s options are inspected
- **THEN** `--quality` allows whole numbers from 1 to 100 and has no default, because TIFF is lossless unless a quality is given
