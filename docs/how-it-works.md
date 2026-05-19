# How Undes Works

Undes is built around one principle: AI-generated engineering work should be verified before it is trusted.

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

6. **Produce an operator artifact**
   The output is meant to be reviewed by an engineer, not blindly applied.

## What Makes It Different

Undes is not only a post-fact checker. It generates the answer and verifies the answer in one workflow.

The final result should answer:

- what is proposed;
- why it is supported;
- what was rejected;
- what is still risky;
- whether the result is safe enough to apply.

## Trust Status

Undes can produce diagnostic output when there is not enough evidence. That refusal is a feature: a confident answer without evidence is worse than an honest diagnostic artifact.

