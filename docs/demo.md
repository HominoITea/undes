# One-Minute Demo

This is a sanitized example of the workflow shape. It is written as a compact
developer-facing walkthrough, not as a guarantee that every run produces the
same wording.

## Prompt

```bash
undes run --prompt="Review this authentication change for risky assumptions, missing tests, and unsafe merge conditions."
```

## What Undes Looks For

Undes asks the models to produce a candidate answer, then keeps the trust
boundary visible:

- which evidence from the repository supports the candidate;
- which assumptions are still unproven;
- which hypotheses were considered and rejected;
- which checks should happen before merge;
- whether the result is safe, needs review, or remains diagnostic.

## Example Output Shape

```text
Trust verdict: Needs review

Candidate:
- Add audience validation to the token verifier.
- Add a focused test for cross-tenant token rejection.

Evidence:
- The verifier checks expiry and signature before accepting a token.
- The current tests cover expired and malformed tokens.
- No test proves that a token for one tenant is rejected for another tenant.

Rejected hypothesis:
- The failure is not explained by clock skew. Expiry handling is already covered
  by deterministic tests.

Open checks:
- Confirm whether existing clients rely on the previous permissive audience
  behavior.
- Run the auth test suite before merging.
```

## Why This Is Different From Plain Chat

A plain AI answer can propose a patch. Undes is designed to make the confidence
boundary inspectable: what was supported, what was assumed, what was rejected,
and what still needs human or CI verification.

That is the product promise: not "AI is always right", but "the answer comes with
the evidence and risk boundary you need to decide what to do next."
