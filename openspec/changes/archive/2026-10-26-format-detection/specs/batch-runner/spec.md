# Spec Delta

## MODIFIED Requirements

### Requirement: Running every planned item
For a mode that can run, konvertoj SHALL first prepare the output folders, then process every planned item and save each result through a temporary file. Before a mode's work starts on an item, every input of the item SHALL pass the input format checks, and the work SHALL be given each input's detected format. A mode that combines its inputs SHALL be one item. A mode that can't run yet SHALL still fail with "<mode> isn't available yet." before any folder is created.

#### Scenario: One file
- **WHEN** a runnable mode is given one readable file
- **THEN** its output is written to the planned path, and the exit code is `0`

#### Scenario: Ten files
- **WHEN** a runnable mode is given ten readable files
- **THEN** all ten outputs are written

#### Scenario: Input check before work
- **WHEN** a runnable image mode is given a file that fails the input checks
- **THEN** the mode's work never starts for that file, nothing is written for it, and it is reported as failed
