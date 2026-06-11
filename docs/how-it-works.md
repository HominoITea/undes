# How Undes Works

Undes is built around one principle: AI-generated engineering work should expose its trust boundary before it is trusted.

## The Workflow

1. **Understand the task**
   Undes classifies the task shape and builds a bounded context from the repository.

2. **Generate proposals**
   AI roles propose a solution or diagnosis.

3. **Critique the proposals**
   Other roles challenge assumptions, identify missing evidence, and surface risks.

4. **Synthesize an answer**
   The synthesizer builds one engineering artifact from the debate.

5. **Check evidence and trust**
   Undes separates grounded claims from assumptions, deferred checks, and unresolved risk.

6. **Produce a trust artifact**
   The output is meant to be reviewed by an engineer, not blindly applied.

Agent participation and per-phase model routing are configurable. See
[Agent And Model Routing](agent-and-model-routing.md) for the public
configuration surface.

## What Makes It Different

Undes is not only a post-fact checker. It generates the candidate answer and exposes its trust boundary in one workflow.

The final result should answer:

- what is proposed;
- why it is supported;
- what was rejected;
- what is still risky;
- whether the result is safe to apply, needs review, or has insufficient evidence.

## Trust Status

Undes can produce diagnostic output when there is not enough evidence. That refusal is a feature: a confident answer without evidence is worse than an honest diagnostic artifact.
