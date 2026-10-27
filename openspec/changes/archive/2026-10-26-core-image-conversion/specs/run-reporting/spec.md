# Spec Delta

## MODIFIED Requirements

### Requirement: A line per file
Each finished file SHALL get one line:
- a success goes to standard output: `✓ <input> → <output>  <size before> → <size after>`,
- a skip goes to standard output: `- <input> skipped: <reason>`,
- a failure goes to standard error: `✗ <input>: <reason>`.

A mode MAY attach short notes to a file. Each note SHALL be printed to standard output as its own line, `  Note: <note>`, straight after that file's line, unless `--quiet` is given.

Paths SHALL be relative to the current folder. A combined item SHALL name its first input and how many others there are.

#### Scenario: One success
- **WHEN** one file is converted
- **THEN** standard output has one `✓` line naming the input, the output and both sizes, followed by the summary

#### Scenario: A failure
- **WHEN** a file fails because the mode reported a problem
- **THEN** standard error has a `✗` line with the file and the mode's plain-English reason

#### Scenario: A note
- **WHEN** a file succeeds and its mode attached the note "only the first frame was kept, because JPG can't be animated"
- **THEN** the line after its `✓` line is `  Note: only the first frame was kept, because JPG can't be animated`

#### Scenario: Notes in quiet mode
- **WHEN** the same happens with `--quiet`
- **THEN** no note is printed
