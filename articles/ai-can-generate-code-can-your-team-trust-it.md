# AI can generate code. Can your team trust the generated answer?

AI coding tools made generation cheap.

The hard part moved somewhere else: deciding whether the generated answer is supported by the codebase, whether it smuggled in assumptions, and what the team still needs to check before merge.

That is the gap Undes is built for.

Undes is a local-first CLI that generates an engineering answer through multiple AI roles, then verifies the result with critique, evidence checks, risk review and open checks before telling the team how much to trust it.

## The Problem Is Not Generation

Most teams already know that AI can produce code, tests, refactors and migration plans.

The harder questions come after generation:

- Which files support this answer?
- What did the model assume without evidence?
- Which hypotheses were considered and rejected?
- What still needs to be checked before this can be merged?
- Is this answer patch-safe or only diagnostic?

A confident AI answer without this context can become a review burden instead of a productivity gain.

## What A Verified Engineering Artifact Should Contain

A useful AI engineering answer should not be only prose or only code. It should show:

- the proposed change;
- evidence from the repository;
- risks and assumptions;
- rejected hypotheses;
- open checks;
- a trust status.

That is the shape Undes is designed to produce.

## How Undes Approaches It

Undes runs a structured workflow:

1. build bounded repository context;
2. generate proposals;
3. critique the proposals;
4. synthesize one answer;
5. check evidence and unresolved risks;
6. produce a reviewable artifact.

The point is not that several AI agents magically become correct. The point is that the answer becomes inspectable: the team can see what is supported, what is risky, and what still needs human or automated validation.

## What Undes Is Not

Undes is not a fight with Cursor, Claude Code, Copilot or any other coding assistant.

Those tools made generation useful. Undes focuses on the trust layer around generated engineering work.

## Try It

Community is distributed as an npm package:

```bash
npm install -g @undes.ai/cli
undes --help
```

Try it on a small repository and inspect the generated-and-verified artifact. If the artifact is missing a signal your team would need before merge, open an issue and describe that missing trust signal.
