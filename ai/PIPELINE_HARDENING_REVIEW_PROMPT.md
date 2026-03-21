# Pipeline Hardening Review Prompt

Use this prompt when asking another model to review the current `Pipeline Hardening`
proposal in `ai/design/features/PIPELINE_HARDENING.md`.

## Goal

Review the proposed reliability hardening for partial/truncated model outputs in
the multi-agent pipeline.

The goal is not to reopen the whole architecture. The goal is to decide the
minimum safe MVP for:
- detecting truncated successful outputs;
- repairing them in-place;
- preventing partial artifacts from being reported as plain completed;
- improving observability of why successful responses stopped early.

## Read First

Read these files first:
- `ai/design/features/PIPELINE_HARDENING.md`
- `ai/ROADMAP.md`

Optional supporting context if needed:
- `ai/scripts/generate-context.js`
- `ai/scripts/response-validator.js`
- `ai/scripts/infrastructure/providers.js`
- `ai/scripts/domain/prompt-content.js`

## Real Failure Evidence To Keep In Mind

The proposal is based on real pilot artifacts from `/abs/path/to/<PILOT_PROJECT_A>`.

Examples:
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-architect-proposal.txt`
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-architect-critique.txt`
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-reviewer-proposal.txt`
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-reviewer-critique.txt`
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-synthesizer-consensus.txt`

Observed defect:
- outputs ended mid-sentence;
- `END_MARKER` was missing;
- runtime still archived/logged them as completed.

Additional nuance:
- Devil's Advocate currently archives parsed JSON result, not raw model output,
  so forensic visibility is weaker for JSON phases.

## What To Evaluate

Evaluate the proposal against these dimensions:

1. **Detection correctness**
   - Is missing `END_MARKER` enough to classify output as incomplete?
   - Should detection also use syntactic heuristics (mid-sentence, unclosed code block, broken JSON)?
   - How much should it rely on provider `stop_reason` / `finishReason`?

2. **Repair strategy**
   - Is one bounded repair-pass the right MVP?
   - Should repair be same-model only?
   - Should repair ask for continuation only, or regeneration of the tail section?

3. **Status semantics**
   - What statuses should exist for text outputs?
   - Should truncated outputs be archived but marked `PARTIAL`/`TRUNCATED`?
   - What must checkpoint logic consider "done"?

4. **Provider observability**
   - What success-side metadata must be persisted for Anthropic, Google, and OpenAI?
   - Is `stop_reason` / `finishReason` + usage enough?
   - Should successful-response headers be stored too?

5. **JSON phases**
   - Should JSON phases archive both raw response and parsed result?
   - Is that required in MVP or post-MVP?
   - How should malformed-but-parseable JSON fallback be handled?

6. **Cost / risk control**
   - Does repair-pass risk worsening TPM/RPM pressure too much?
   - How should output budgets change, if at all?
   - What should be explicitly kept out of MVP?

## Questions That Need Concrete Answers

Please answer these explicitly:

1. What part of the current proposal should be accepted as-is?
2. What must change before implementation starts?
3. Is missing `END_MARKER` sufficient as an MVP truncation trigger?
4. What is the minimum safe repair-pass design?
5. What are the top 3 architectural risks?
6. Should JSON phases preserve raw provider output in MVP?
7. What are the top 3 go/no-go criteria before implementing the repair flow?

## Output Format

Use this structure:

```markdown
**Review: Pipeline Hardening MVP**

**Verdict:** <Ready to implement / Good direction but needs tightening / Needs redesign>

**Accepted As-Is**
- ...

**Changes Required Before Implementation**
1. ...
2. ...

**Top Risks**
1. ...
2. ...
3. ...

**Recommended MVP Boundary**
- ...

**Go / No-Go Criteria**
- ...

**Open Questions**
- ...
```

## Where To Log The Review

For this repository, the review result should be written to:
- `UNIFIED_MODEL_CHANGE_LOG.md` as the primary manual review record
- `PROJECT_PLANNED_CHANGES.md` only if the review creates a concrete follow-up
  task or changes the MVP boundary

Do **not** write this kind of manual review into `ai/logs/AI_DISCUSSION_LOG.md`
unless it is part of a runtime multi-agent execution.

### Suggested Log Entry Template

```markdown
## [YYYY-MM-DD HH:mm:ss UTC] - Model: <Model name>
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: review-pipeline-hardening-mvp-<YYYYMMDD>
Task Summary: Review pipeline hardening proposal for partial/truncated outputs
Request: Review `Pipeline Hardening` design proposal
Changes:
- (review only — no file modifications)
Status: COMPLETED
Notes: Verdict: <Ready to implement | Good direction but needs tightening | Needs redesign>. Accepted: <1-line summary>. Required changes: <1-line summary>. Top risks: <short list>. MVP boundary: <1-line summary>.
```

## Review Rules

- Do not rewrite the whole proposal.
- Keep the review grounded in the current repository behavior and real Wattman artifacts.
- Prefer concrete changes to detection, retry/repair flow, checkpoint status, and provider metadata capture.
- If you disagree with the proposed one-pass repair model, propose exactly one replacement flow and explain why it is safer.
