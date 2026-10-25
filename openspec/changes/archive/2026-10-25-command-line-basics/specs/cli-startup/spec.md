# Spec Delta

## REMOVED Requirements

### Requirement: Clean start with nothing to do
**Reason**: konvertoj now has command-line features. A bare run shows the help screen instead of doing nothing.
**Migration**: See the `command-line` capability's "Main help screen" requirement. A bare run still exits with code `0` and writes nothing to standard error.
