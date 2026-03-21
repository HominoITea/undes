# Documentation Compiler + NotebookLM Publishing Layer

Status: design-review
Priority: high

## Summary

Create a canonical documentation pipeline where Jira data, repo docs, code intelligence, and Hub runtime artifacts are compiled into local project docs under `.ai/docs/`.

NotebookLM stays optional and downstream.

## Core Principle

- Canonical source of truth: repo docs + `.ai/docs/`
- Compiler/orchestration layer: Hub
- External read surface: NotebookLM Enterprise, optional
- Raw prompts/logs are not publishing targets

## Atomic Unit

The atomic documentation unit is `feature dossier`.

Expected outputs:
- human-readable `feature.md`
- machine-readable `feature.json`

## Current MVP Direction

- Start with local canonical docs first.
- Keep NotebookLM out of MVP-critical path.
- Treat `feature dossier` as the only atomic unit allowed to feed aggregate docs.
- Keep the compiler standalone, not embedded into `jira-take`.

## Minimum Publishable Fields

- `id`
- `title`
- `status`
- `sourceRefs`
- `confidence` or equivalent evidence-status marker
- `acceptanceCriteria` or explicit missing-reason
- `implementationSummary` or explicit implementation status

## Current Source Precedence Direction

1. current repo state and accepted repo docs
2. merged implementation artifacts
3. accepted Hub run outputs
4. Jira ticket text/comments
5. explicit model inference marked as assumption

## Recommended MVP Boundary

- First deliverable: local canonical docs only
- Build one dossier from Jira + repo + Hub artifacts
- Keep project aggregate docs downstream from accepted dossiers
- NotebookLM sync stays post-MVP

## CLI Surface

- `ai:docs:compile`
- `ai:docs:project`
- `ai:notebooklm:sync` (later phase)

## Main Risks

- False confidence in compiled docs
- Evidence/source drift from code and accepted docs
- Scope creep from too many output generators
- Treating NotebookLM as the source of truth

## Current Review Pressure

External reviews already converged on:
- narrow MVP first
- keep compiler standalone, not embedded into `jira-take`
- clarify source precedence
- treat implementation summary ownership explicitly
- avoid LLM-heavy quality gates in MVP where simpler checks are enough

## Recommended Rollout

1. `ai:docs:compile`
2. `ai:docs:project`
3. optional `jira-take` hooks
4. optional `ai:notebooklm:sync`

## Open Design Questions

- Should dossier IDs be Jira-only or source-agnostic?
- Should `confidence` stay numeric or become a categorical evidence marker?
- What should own `implementationSummary` in MVP?
- Should project docs rebuild fully or incrementally in MVP?
- Which docs, if any, deserve NotebookLM publication by default?

## Related Feature

- `ai/design/features/JIRA_TAKE.md`

## Source

Detailed historical design snapshot is preserved in:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md`
