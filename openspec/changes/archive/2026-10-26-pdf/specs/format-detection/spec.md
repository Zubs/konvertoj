# Spec Delta

## ADDED Requirements

### Requirement: Earlier results in folders
A file found through a folder or pattern that is already in the mode's output format, and that the mode doesn't accept, SHALL be treated as an earlier result rather than a mistake: a single file SHALL be skipped with "already a <format>", and in a combined output it SHALL be left out with a note. Files named one by one SHALL still fail as before.

#### Scenario: PDF made again from a folder
- **WHEN** `jpgtopdf scans` is run twice, the first run having written `scans/page1.pdf`
- **THEN** the second run leaves `page1.pdf` out with a note, and the PDF has one page per JPG

#### Scenario: Pages exported again
- **WHEN** `pdftopng docs` is run twice on a folder holding a PDF
- **THEN** the second run skips the PNGs from the first with "already a PNG", and the exit code is `0`
