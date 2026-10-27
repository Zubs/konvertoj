## ADDED Requirements

### Requirement: Paths outside the current folder
A path shown to the user SHALL be relative to the current folder when the file is inside it, and absolute when it is outside it, so the user never sees a chain of `../`.

#### Scenario: File inside the current folder
- **WHEN** `photos/a.jpg` in the current folder is converted
- **THEN** its line shows `photos/a.jpg` (with the system's separator)

#### Scenario: File outside the current folder
- **WHEN** a file in a folder outside the current folder is converted or fails
- **THEN** its line shows the file's absolute path

### Requirement: Combined items count only what they used
A combined item's line SHALL name its first used input, count only the other inputs it used, and give the size before as the total of the inputs it used. An input it left out (for example an earlier PDF in the folder) SHALL appear only in its note.

#### Scenario: Earlier PDF left out
- **WHEN** `topdf scans -o again.pdf` runs on a folder with `page1.jpg`, `page2.jpg` and an earlier `page1.pdf`
- **THEN** the line names `page1.jpg and 1 other`, its size before is the two JPGs' total, and a note says `page1.pdf` was left out

## MODIFIED Requirements

### Requirement: A line per file
Each finished file SHALL get one line:
- a success goes to standard output: `✓ <input> → <output>  <size before> → <size after> (<change>)`, where the change, shown when the size before is above 0, is the percentage the size went down (`−83%`) or up (`+12%`), as in the summary,
- a skip goes to standard output: `- <input> skipped: <reason>`,
- a failure goes to standard error: `✗ <input>: <reason>`.

A mode MAY attach short notes to a file. Each note SHALL be printed to standard output as its own line, `  Note: <note>`, straight after that file's line, unless `--quiet` is given.

Paths SHALL be shown as described in "Paths outside the current folder". A combined item SHALL name its first used input and how many other inputs it used.

#### Scenario: One success
- **WHEN** one file is converted
- **THEN** standard output has one `✓` line naming the input, the output, both sizes and the change in percent, followed by the summary

#### Scenario: Size change on each line
- **WHEN** `hero.jpg` of 2.4 MB is compressed to 410 KB
- **THEN** its line ends with `2.4 MB → 410 KB (−83%)`

#### Scenario: A failure
- **WHEN** a file fails because the mode reported a problem
- **THEN** standard error has a `✗` line with the file and the mode's plain-English reason

#### Scenario: A note
- **WHEN** a file succeeds and its mode attached the note "only the first frame was kept, because JPG can't be animated"
- **THEN** the line after its `✓` line is `  Note: only the first frame was kept, because JPG can't be animated`

#### Scenario: Notes in quiet mode
- **WHEN** the same happens with `--quiet`
- **THEN** no note is printed
