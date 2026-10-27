# Spec Delta

## MODIFIED Requirements

### Requirement: --strip-metadata
`--strip-metadata` SHALL work on every image mode that creates files (`info` and `colorpick` only read images, so they don't take it), and SHALL remove EXIF, XMP and IPTC details, keeping only the colour profile. The image SHALL be turned upright before its orientation tag is removed.

#### Scenario: Details removed
- **WHEN** a JPG with camera, date and GPS details is converted with `jpgtopng --strip-metadata`
- **THEN** the PNG has no camera, date or GPS details

#### Scenario: HEIC details not written
- **WHEN** the HEIC fixture is converted with `heictojpg --strip-metadata`
- **THEN** the JPG has no camera, date or GPS details

#### Scenario: Every image mode accepts it
- **WHEN** the registry is inspected
- **THEN** every Image, PDF and Tools mode that creates files accepts `--strip-metadata`
