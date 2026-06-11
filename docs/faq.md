# FAQ

## Is Undes another coding assistant?

No. Undes is a trust-layer workflow around AI-generated engineering answers.

The point is not only to generate code. The point is to make the generated candidate easier to trust, reject, or narrow.

## Does Undes replace code review?

No. It gives reviewers a better artifact:

- what was generated;
- what evidence supports it;
- what assumptions remain;
- what the workflow rejected;
- whether the result is safe to apply, needs review, or has insufficient evidence.

## Does Community send my code to Undes servers?

Community is local-first BYOK tooling.

Model calls still go to the model providers you configure. Undes does not need to host your code to run the Community workflow.

## Can I use Community while working on a commercial product?

Yes, for limited individual use on your own initiative.

Community is not licensed for regular team/company use, client delivery, CI/CD, production workflow use, or organization-managed development processes. Those uses require a separate paid license.

For Pro access and current licensing entry points, see [undes.app/pricing](https://undes.app/pricing).

## What is "patch-safe"?

Patch-safe means the workflow has enough evidence to present a change as a grounded candidate.

Diagnostic means the answer may still be useful, but unresolved assumptions or evidence gaps remain.

## Can I use one model provider only?

Undes is BYOK, so users configure the providers they want to use, subject to the workflow requirements of a given mode.

## What should I try first?

Start with one focused task:

- a small bug;
- a narrow feature;
- a validation rule;
- a review of one change;
- a short integration-risk question.

Broad prompts are harder to verify and usually produce more diagnostic output.
