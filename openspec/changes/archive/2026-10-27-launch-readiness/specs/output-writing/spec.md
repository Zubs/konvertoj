## ADDED Requirements

### Requirement: Empty output folders are removed
An output folder that konvertoj created for a run, including any parent folders it created for it, SHALL be removed at the end of the run if nothing was saved in it, also when the run stops because of an error or the first Ctrl+C. A folder that already existed SHALL never be removed. A second Ctrl+C, which stops konvertoj at once, MAY leave such empty folders.

#### Scenario: Every file fails
- **WHEN** `pdftopng locked.pdf -o pages` fails and `pages/` didn't exist before
- **THEN** `pages/` doesn't exist afterwards

#### Scenario: Existing folder
- **WHEN** the same command fails with `-o pages` and `pages/` already existed, empty
- **THEN** `pages/` is still there

#### Scenario: Nested new folders
- **WHEN** a run with `-o out/pages`, where neither exists, saves nothing
- **THEN** neither `out/pages` nor `out` exists afterwards

#### Scenario: Something was saved
- **WHEN** at least one file is saved in a new output folder
- **THEN** the folder stays
