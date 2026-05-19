# Generated Code Needs A Trust Layer

AI coding tools made it easy to generate code.

That changed the bottleneck. The hard part is no longer getting a model to produce something plausible. The hard part is deciding whether the answer is supported enough to use.

Developers now ask a different set of questions:

- Did the model read the right files?
- Did it preserve the code it generated earlier in the workflow?
- Did reviewers or critique agents reject part of the idea?
- Are there open integration checks?
- Is this a patch candidate or only a diagnostic answer?

Most AI coding workflows compress all of that into a confident final response.

Undes takes a different approach: it treats the final answer as an engineering artifact that should carry its own trust signals.

## Generate, Then Verify

The workflow is simple in principle:

1. Generate candidate proposals.
2. Critique them.
3. Check evidence against the codebase.
4. Preserve material payload like generated code.
5. Separate supported claims from assumptions.
6. Produce a final result with warnings and trust status.

The output should help a developer decide what to merge, what to inspect manually, and what to reject.

## Not A War With Coding Assistants

This is not about claiming that AI coding tools are bad.

They are useful. They are also incomplete when their output is treated as self-validating.

Undes exists because AI-generated engineering work becomes more useful when the answer explains what supports it.

## Try It

Undes Community is local-first and BYOK.

It lets developers try a generated-and-verified workflow from the command line.

The goal is not to automate trust away. The goal is to make trust review concrete.
