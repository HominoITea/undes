# Cross-Model Diagnosis Review Prompt

Use this prompt when asking another model to diagnose why the pipeline produced a shallow/partial "hotfix" result instead of a robust architectural fix, despite having access to high-quality structural extraction.

## Context
During a recent real-project pilot rerun, the pipeline successfully utilized
`ast-grep` (Lever 2) to inject high-density context for the explicitly named
seams into the `contextBundle`. Evidence-Grounded Patch Mode successfully
prevented hallucinations.
However, despite this deeper context and stronger grounding, the final answer
in `result.txt` still remained a shallow "partial hotfix" rather than a
comprehensive solution.

## Artifacts to analyze (Provide these to the reviewing model)
- Original prompt
- Proposal artifacts (`*-proposal.txt`) if available
- Critique artifacts (`*-critique.txt`) if available
- `result.txt`
- `result-warning.txt`
- `test-report.md` (if available)
- `summary` from `latest.json`
- The current `.context_bundle.md`, proving that the relevant named seams were
  actually present in context

Recommended packet paths:
- `<PROJECT_ROOT>/.ai/prompts/discussions/<TASK_ID>/<RUN_ID>/prompt.txt`
- `<PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-proposal.txt`
- `<PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-critique.txt`
- `<PROJECT_ROOT>/.ai/prompts/result.txt`
- `<PROJECT_ROOT>/.ai/prompts/result-warning.txt`
- `<PROJECT_ROOT>/.ai/prompts/test-report.md`
- `<PROJECT_ROOT>/.ai/prompts/metrics/latest.json`
- `<PROJECT_ROOT>/.ai/.context_bundle.md`

## Diagnostic Questions

Please review the artifacts and provide a structured diagnosis addressing the following:

1. **Why does the answer remain a partial hotfix?**
   Even with improved grounding and structural context, why didn't the agents synthesize a complete architectural fix?
2. **Where in the pipeline is the bottleneck?** Is this a problem of:
   - *Retrieval coverage* (did we extract the method, but miss the surrounding interface or caller context)?
   - *Debate/Consensus behavior* (did the agents agree on a lazy fix because they lacked the confidence to refactor)?
   - *Approval scoring* (did the approval phase fail to penalize a shallow fix as long as it was grounded)?
3. **Do we need a new pipeline seam?**
   - Do we need a *targeted compare-mode* (comparing current logic vs required logic explicitly)?
   - Do we need *critique-driven expansion* (Lever 3 from Answer Depth Improvement) so agents can fetch more context mid-debate?

## Recommended execution mode

Run this diagnosis as **parallel single-agent reviews**, not as a shared debate.
The goal is to collect independent root-cause hypotheses first and compare them
only afterwards.

## Required Output Format

**Diagnosis: Shallow Hotfix Anomaly**

**Root Cause Hypothesis**
- ...

**Why Current Pipeline Stops Short**
- ...

**Minimal Fix (Short-term)**
- ...

**Alternative Heavier Fix (Long-term)**
- ...

**Roadmap Recommendation**
- Should this become a new roadmap item, or does it fall under an existing track (e.g., Answer Depth Improvement / Senior-Developer Skepticism Model)?
