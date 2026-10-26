# Spec Delta

## MODIFIED Requirements

### Requirement: Modes not built yet
A valid command for a registered mode whose work isn't built yet SHALL fail with exit code `1` and say `<mode> isn't available yet.` This SHALL happen after its inputs have been found and its outputs planned, so input mistakes are reported first, and SHALL NOT create any folders. `--dry-run` SHALL still print the plan and exit with `0`.

#### Scenario: Running an unbuilt mode
- **WHEN** a test-only mode without a `run` is used on an existing file
- **THEN** it fails with exit code `1` and "<mode> isn't available yet."

#### Scenario: Input mistakes come first
- **WHEN** the same test-only mode is given a file that doesn't exist
- **THEN** it fails, naming the file, without mentioning that the mode isn't available

#### Scenario: Dry run of an unbuilt mode
- **WHEN** the same test-only mode is run with `--dry-run`
- **THEN** it prints the planned output and exits with `0`
