# Artifacts

Undes produces files that help operators inspect how much of an AI answer is supported.

The exact artifact set depends on the command and task shape. The concepts below are stable.

## result.txt

The main evidence-backed answer candidate.

It should be readable by a developer who did not watch the run.

## result-warning.txt

Warnings and trust notes that should be checked before relying on the result.

Typical warnings:

- unresolved assumptions;
- missing evidence;
- diagnostic-only status;
- risks found by critique or adversarial review.

## result-state.json

Structured state behind the final result.

This is useful for tools and for understanding why a result was safe to apply, needed review, or stayed diagnostic.

## prompt-scope.json

Describes how the run interpreted the prompt.

Examples:

- task kind;
- response contract;
- payload mode;
- prompt quality signals.

## answer-obligations.json

Tracks whether the final answer covered the user-requested prompt items.

The goal is to avoid silent drops: if the user asked for several things, the final answer should answer, defer, or mark each item as not applicable with a reason.

## payload-preservation.json

Tracks whether material payload moved through the synthesis path without silent loss.

For example, generated code should arrive through a dedicated material payload channel or be explicitly truncated with a marker.

## proposal-code-blocks.json

Tracks generated code blocks introduced during proposal phases.

This supports feature implementation tasks where the generated code must be preserved for the final answer.

## Operator Snapshot

Community may write an operator-facing snapshot that groups the prompt, result, warnings, and selected reports for easier review.
