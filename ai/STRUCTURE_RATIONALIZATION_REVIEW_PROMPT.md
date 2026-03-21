# Structure Rationalization Review Prompt

Use this prompt when asking another model to review the current consensus on
repository structure rationalization.

This is **not** for reopening the whole debate from scratch. The goal is to
stress-test the current consensus baseline and identify what must be clarified
before implementing Step 0.

## Goal

Review the current consensus for splitting:
- authored control/design/source surface
- generated runtime surface

The review should focus on the proposed path model, migration safety, namespace
clarity, runtime-vs-authored boundaries, and rollout risk.

## Read First

Read these sections first:
- `ai/design/features/STRUCTURE_RATIONALIZATION.md`
  Focus especially on:
  - `Current Consensus (After Debate Rounds 1-4)`
  - `Debate Round 1: Claude Opus 4.6`
  - `Debate Round 3: Codex`

Optional supporting context if needed:
- `README.md` — root layout policy and hub workflow
- `ai/scripts/path-utils.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/infrastructure/run-logs.js`
- `HUB_RULES.md`

## What To Evaluate

Evaluate the current consensus against these dimensions:

1. **Namespace clarity**
   - Is `ai/` as authored source/control/design surface the right long-term boundary?
   - Is `<project>/.ai/` as target-project runtime the right rule?
   - Is `config/` the right home for hub registry/config state?

2. **Dual-root path contract**
   - Is a shared resolver like `resolveProjectLayout(projectPath)` the right Step 0?
   - What fields must that resolver expose to avoid scattered path logic?
   - Is there a simpler safe contract than dual-root?

3. **Migration sequencing**
   - Is `no file moves before Step 0` the right constraint?
   - Is `target-project-first` migration the right rollout?
   - Should hub-global runtime namespace remain explicitly post-MVP?

4. **Runtime vs authored artifacts**
   - Are typed logs correctly classified as runtime artifacts?
   - Are governance logs correctly kept at repo root?
   - Is `KNOWLEDGE_BASE.md` inside or outside the core scope of this proposal?

5. **Compatibility and risk**
   - Where are the real breakpoints for current scripts/tests/docs?
   - What hidden collisions or backward-compatibility traps remain?
   - What would most likely go wrong during Step 0 or Step 1?

6. **Verification discipline**
   - What tests are mandatory before Step 1 file moves?
   - What go/no-go criteria should be met before migrating real runtime files?

## Questions That Need Concrete Answers

Please answer these explicitly:

1. Is the current consensus direction sound enough to start Step 0?
2. What must change before Step 0 implementation starts?
3. Is `resolveProjectLayout(projectPath)` the right contract, and what fields are mandatory?
4. What are the top 3 architectural risks?
5. What are the top 3 must-have tests before Step 1 file moves?
6. What are the top 3 go/no-go criteria before moving target-project runtime artifacts to `.ai/`?

## Output Format

Use this structure:

```markdown
**Review: Structure Rationalization Consensus**

**Verdict:** <Ready for Step 0 / Good direction but needs tightening / Needs redesign>

**Accepted Consensus**
- ...

**Changes Required Before Step 0**
1. ...
2. ...

**Top Risks**
1. ...
2. ...
3. ...

**Required Tests Before Step 1**
- ...

**Go / No-Go Criteria Before File Moves**
- ...

**Open Questions**
- ...
```

## Where To Log The Review

For this repository, the review result should be written to:
- `UNIFIED_MODEL_CHANGE_LOG.md` as the primary manual review record
- `PROJECT_PLANNED_CHANGES.md` only if the review creates a concrete follow-up step or changes the migration baseline

Do **not** write this kind of manual architecture review into `ai/logs/AI_DISCUSSION_LOG.md` unless it is part of a runtime multi-agent execution.

### Suggested Log Entry Template

Append a compressed summary like this to `UNIFIED_MODEL_CHANGE_LOG.md`:

```markdown
## [YYYY-MM-DD HH:mm:ss UTC] - Model: <Model name>
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: review-structure-rationalization-<YYYYMMDD>
Task Summary: Review structure rationalization consensus
Request: Review `Repository Structure Rationalization` consensus proposal
Changes:
- (review only — no file modifications)
Status: COMPLETED
Notes: Verdict: <Ready for Step 0 | Good direction but needs tightening | Needs redesign>. Accepted: <1-line summary>. Required changes: <1-line summary>. Top risks: <short list>. Required tests: <short list>.
```

## Review Rules

- Do not rewrite the whole proposal.
- Do not reopen already agreed points without a concrete technical reason.
- Keep the review grounded in the current repository structure and code paths.
- Prefer concrete changes to path contracts, migration sequencing, namespaces, and test coverage.
- If you disagree with `resolveProjectLayout(projectPath)`, propose exactly one replacement contract and explain why it is safer.
