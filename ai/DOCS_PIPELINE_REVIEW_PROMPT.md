# Docs Pipeline Review Prompt

Use this prompt when asking another model to review the proposed `Jira + Hub + NotebookLM` documentation pipeline in `ai/design/features/DOCS_PIPELINE.md`.

## Goal

Review the current design proposal critically and help converge on a realistic MVP for:
- `ai:docs:compile`
- `ai:docs:project`
- `ai:notebooklm:sync`

The review should focus on architecture, scope control, source-of-truth rules, evidence quality, and rollout risk.

## Read First

Read these sections fully before responding:
- `ai/design/features/DOCS_PIPELINE.md`

Optional supporting context if needed:
- `ai/design/features/JIRA_TAKE.md`
- `ai/ROADMAP.md` — short priority/status view
- `README.md` — current Hub workflow / multi-project behavior
- `AI_WORKFLOW.md` — current artifact/log flow

## What To Evaluate

Evaluate the proposal against these dimensions:

1. **Canonical source model**
   - Is `repo docs + .ai/docs/` the right source of truth?
   - Should NotebookLM remain strictly downstream?

2. **Atomic documentation unit**
   - Is `feature dossier` the right canonical unit?
   - Are the proposed minimum publishable fields sufficient?
   - Is the `feature.md + feature.json` dual-output the right contract?

3. **Source precedence**
   - Is the proposed precedence order correct?
   - Where should implementation summary come from: repo state, git diff, Hub result, Jira, or a merge of them?

4. **MVP scope discipline**
   - Is the phased rollout realistic?
   - What should be removed from MVP to reduce risk?
   - What is missing but necessary even for MVP?

5. **Quality and evidence**
   - Are `sourceRefs` + `confidence` enough?
   - What documentation quality gate rules are mandatory?
   - How should unsupported claims be handled?

6. **NotebookLM integration**
   - Is project-level aggregate publication the right default?
   - Should individual feature dossiers be published at all in MVP?
   - Is the manifest/hash sync model sufficient?

7. **Operational risk**
   - Where are the highest risks of drift, duplication, or false confidence?
   - What are the main failure modes in real projects?

## Questions That Need Concrete Answers

Please answer these explicitly:

1. Which parts of the current design direction should be accepted as-is?
2. Which parts should be changed before implementation starts?
3. Which parts should be postponed to post-MVP?
4. What is the minimum safe MVP boundary?
5. What are the top 3 architectural risks?
6. What are the top 3 go/no-go criteria before implementing `ai:notebooklm:sync`?

## Output Format

Use this structure:

```markdown
**Review: Docs Pipeline MVP**

**Verdict:** <Clean direction / Promising but needs narrowing / Needs redesign>

**Accepted As-Is**
- ...

**Changes Required Before Implementation**
1. ...
2. ...

**Post-MVP / Remove From MVP**
- ...

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
- `UNIFIED_MODEL_CHANGE_LOG.md` as the **primary manual review record**
- `PROJECT_PLANNED_CHANGES.md` only if the review creates a concrete next step, scope change, or status update

Do **not** write this kind of manual architecture review into `ai/logs/AI_DISCUSSION_LOG.md` unless it is part of a runtime multi-agent execution.

### Suggested Log Entry Template

Append a compressed summary like this to `UNIFIED_MODEL_CHANGE_LOG.md`:

```markdown
## [YYYY-MM-DD HH:mm:ss UTC] - Model: <Model name>
Project: ai-hub-coding
Path: .
Task ID: review-docs-pipeline-mvp-<YYYYMMDD>
Task Summary: Review Jira + Hub + NotebookLM docs pipeline proposal
Request: Review `Documentation Compiler + NotebookLM Publishing Layer` design proposal
Changes:
- (review only — no file modifications)
Status: COMPLETED
Notes: Verdict: <Clean direction | Promising but needs narrowing | Needs redesign>. Accepted: <1-line summary>. Required changes: <1-line summary>. Top risks: <short list>. MVP boundary: <1-line summary>.
```

If the review produces concrete follow-up work, add a short planning entry to `PROJECT_PLANNED_CHANGES.md` with:
- proposed change
- owner model
- priority
- status `PLANNED`
- target files

## Review Rules

- Do not rewrite the whole design document.
- Do not give generic product advice detached from this repository.
- Prefer concrete changes to schema, lifecycle, CLI, and source precedence.
- If you disagree with `feature dossier` as the atomic unit, propose one replacement and explain why.
- If you propose adding Confluence or other connectors to MVP, justify the complexity tradeoff.
- Keep the review grounded in the current Hub architecture rather than idealized greenfield design.
