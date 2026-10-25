# Spec Delta

## Purpose

Defines the parts of `README.md` generated from the mode registry, and the check that keeps them in step with the code, so the README can't list modes that don't exist or miss ones that do.

## ADDED Requirements

### Requirement: Generated mode section
`npm run docs` SHALL rewrite the README section between `<!-- modes:start -->` and `<!-- modes:end -->` from the mode registry, leaving the rest of the README unchanged. The section SHALL have one table per group, in registry group order, listing each mode's name, description and first example.

#### Scenario: Every mode in the README
- **WHEN** `npm run docs` has been run
- **THEN** every mode name in the registry appears in the generated section exactly once, under its group, with an example

#### Scenario: Text outside the markers is kept
- **WHEN** `npm run docs` runs on a README with hand-written text before and after the markers
- **THEN** that text is unchanged

#### Scenario: Running twice changes nothing
- **WHEN** `npm run docs` is run twice in a row
- **THEN** the second run leaves `README.md` byte-for-byte the same

### Requirement: Out-of-date README is caught
The test suite SHALL fail when the README's generated section doesn't match the registry, with a message saying to run `npm run docs`.

#### Scenario: Registry changed without docs
- **WHEN** a mode is added to the registry and `npm run docs` isn't run
- **THEN** `npm test` fails with a message telling the developer to run `npm run docs`
