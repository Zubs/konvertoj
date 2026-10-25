# Spec Delta

## ADDED Requirements

### Requirement: Output naming details
Every Tools mode whose output keeps the input's format SHALL declare its output suffix:
- `compress`: `compressed`
- `resize`: `resized`
- `enlarge`: `enlarged`
- `crop`: `cropped`
- `rotate`: `rotated`
- `flip`: `flipped`
- `strip`: `stripped`

Every `<image>topdf` mode and `topdf` SHALL be marked as combining all inputs into one output. No other mode SHALL be.

#### Scenario: Suffixes declared
- **WHEN** the registry is inspected
- **THEN** every mode with output "same as input" has a suffix, and `compress` has `compressed`

#### Scenario: Combining modes
- **WHEN** the registry is inspected
- **THEN** exactly the 11 images-to-PDF modes combine their inputs, and `pdftopng` and `heictojpg` don't
