# Example: Evidence-Backed Trust Artifact

This is a simplified, sanitized example of the kind of output Undes is designed to produce.

## Task

Review an authentication validation change and report whether the result is safe
to merge.

## Proposed Change

- Add audience validation before accepting a token.
- Add a focused unit test for cross-tenant token rejection.

## Evidence

- The verifier already checks signature and expiry before accepting a token.
- Existing tests cover expired and malformed tokens.
- No existing test proves that a token for one tenant is rejected for another
  tenant.

## Rejected Hypotheses

- The issue is not caused by clock skew; expiry handling is already covered by
  deterministic tests.
- The issue is not caused by token parsing; malformed-token behavior is already
  tested.

## Assumptions

- Audience validation should fail before downstream authorization logic runs.
- The existing test style should be preserved.

## Open Checks

- Confirm whether existing clients rely on the previous permissive audience
  behavior.
- Run the authentication test suite before merge.

## Trust Verdict

Diagnostic until the downstream caller behavior is checked.

This example is illustrative. Real artifacts include project-specific evidence and should be sanitized before sharing publicly.
