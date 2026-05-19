# Use Cases

Undes is useful when an AI answer must be checked before it becomes engineering work.

## Feature Implementation

Use Undes when you want a small implementation slice with explicit risk and evidence separation.

Example:

```text
Implement the next-bar market execution model described in docs/execution.md.
Keep it minimal: execution logic, config validation, and tests only.
Do not implement portfolio accounting yet.
```

Expected output:

- touched and new files;
- generated code in the implementation section;
- evidence from existing contracts and tests;
- open checks for anything not verified.

## Bug Diagnosis

Use Undes when a model might guess too quickly.

Example:

```text
Find why empty CSV files pass validation. Propose a minimal fix and tests.
```

Expected output:

- competing hypotheses;
- evidence-backed diagnosis;
- rejected explanations;
- minimal fix path;
- remaining test gaps.

## Code Review

Use Undes for review tasks where the important question is not "what can be improved?" but "what is actually risky?"

Example:

```text
Review this authentication change for correctness and integration risks.
Focus on evidence-backed findings only.
```

Expected output:

- confirmed findings;
- risks tied to code evidence;
- unsupported concerns separated from real blockers.

## Research And Planning

Use Undes to turn a broad engineering question into a verified plan.

Example:

```text
Evaluate whether we can move this validation layer before persistence.
List blockers, required reads, and safest migration order.
```

Expected output:

- supported plan;
- open assumptions;
- files and symbols that need inspection;
- rejected paths.

## When Not To Use It

Undes is not ideal for:

- broad brainstorming with no codebase context;
- one-line questions where a normal chat answer is enough;
- tasks where you do not want local code inspection;
- fully automated merge decisions without human review.
