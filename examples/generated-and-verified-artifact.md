# Example: Evidence-Backed Trust Artifact

This is a simplified, sanitized example of the kind of output Undes is designed to produce.

## Task

Implement a small validation change and report whether the result is safe to apply.

## Proposed Change

- Add validation for a missing configuration field.
- Add a focused unit test for the invalid input case.

## Evidence

- The validator currently checks required fields before parsing runtime options.
- Existing tests already cover valid configuration and missing file behavior.

## Rejected Hypotheses

- The issue is not caused by the parser entry point.
- The issue is not caused by environment variable loading.

## Assumptions

- The new validation should fail fast before downstream parsing.
- The existing test style should be preserved.

## Open Checks

- Confirm whether downstream callers rely on the previous permissive behavior.
- Run the full test suite before merge.

## Trust Verdict

Diagnostic until the downstream caller behavior is checked.

This example is illustrative. Real artifacts include project-specific evidence and should be sanitized before sharing publicly.
