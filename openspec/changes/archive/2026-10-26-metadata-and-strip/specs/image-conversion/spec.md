# Spec Delta

## MODIFIED Requirements

### Requirement: Upright and sRGB
Outputs SHALL be turned upright using the input's orientation tag, and SHALL be in the sRGB colour space. Outputs in formats that hold a colour profile SHALL carry an sRGB profile, so the profile always matches the pixels.

#### Scenario: Sideways phone photo
- **WHEN** a 60 × 40 JPG tagged with orientation 6 (turn 90° clockwise) is converted to PNG
- **THEN** the PNG is 40 × 60

#### Scenario: Wide-gamut input
- **WHEN** a PNG with a Display P3 colour profile is converted to JPG
- **THEN** the JPG carries an sRGB colour profile, not the Display P3 one, and its colours are converted to sRGB rather than copied as they are
