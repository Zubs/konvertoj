# Spec Delta

## MODIFIED Requirements

### Requirement: Errors are for people
Every command-line error SHALL go to standard error as a plain-English message without a stack trace, and SHALL say how to fix the problem. An unexpected error anywhere in konvertoj SHALL also be shown as a plain-English message that suggests running again with `--verbose`, with exit code `1`. Its technical details and stack trace SHALL appear only with `--verbose`.

#### Scenario: No stack traces
- **WHEN** any of the wrong commands above is run
- **THEN** standard error contains no stack trace lines (no line starting with `    at `), and standard output is empty

#### Scenario: Unexpected error
- **WHEN** something inside konvertoj fails unexpectedly, outside any single file's work
- **THEN** standard error says konvertoj hit an unexpected problem and suggests `--verbose`, with no stack trace, and the exit code is `1`

#### Scenario: Unexpected error with --verbose
- **WHEN** the same happens with `--verbose`
- **THEN** standard error also shows the technical error and its stack trace
