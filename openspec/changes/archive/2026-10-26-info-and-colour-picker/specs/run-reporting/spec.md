# Spec Delta

## ADDED Requirements

### Requirement: Sections for modes that print details
A mode that shows details instead of creating files SHALL print one section per file on standard output, in input order, once the batch is done, with no `✓` lines and no summary. `--quiet` SHALL NOT hide the sections. Failures SHALL be reported on standard error as usual, with the usual exit codes.

#### Scenario: Several files
- **WHEN** `info` is run on three images
- **THEN** standard output holds three sections, one per file, in the order given, and nothing else

#### Scenario: Verbose lines stay off standard output
- **WHEN** `info --verbose` is run on two images
- **THEN** the "Working on" lines go to standard error, and standard output holds only the two sections

#### Scenario: Stopped with Ctrl+C
- **WHEN** a long `info` batch is stopped with Ctrl+C
- **THEN** the sections for the files already done are printed, and standard error says how many of the files were done

#### Scenario: One bad file
- **WHEN** `info` is run on an image and a text file
- **THEN** the image's section is printed, the text file's failure goes to standard error, and the exit code is `2`

### Requirement: JSON for modes that print details
With `--json`, standard output SHALL hold exactly one JSON array with one object per successful file, in input order, and nothing else.

#### Scenario: Valid JSON
- **WHEN** `info --json` is run on two images
- **THEN** standard output parses as a JSON array of two objects, also with `--verbose`
