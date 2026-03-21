# Jira Integration + Auto-Branch/PR

Status: planned
Priority: high

## Summary

Add `jira-list` and `jira-take` so the hub can pull a Jira issue, turn it into a structured prompt, run the pipeline, create a branch/PR, and update Jira status.

## MVP Intent

- Manual take only
- One ticket at a time
- Strong prompt gate before AI run
- PR creation and Jira comment/status update

## MVP Surface

- `ai:jira-list`
- `ai:jira-take -- MYAPP-123`

## Important Scope Boundaries

- No watch mode or polling in MVP
- No batch processing
- No auto-merge
- No custom workflow engine in MVP

## Dependencies

- Real-project pilot should happen first
- Strict dispatcher is already in place
- Prompt quality gate already exists
- Docs compiler should remain a separate feature, not fused into `jira-take`

## Key Design Rule

`jira-take` is task execution.
It is not the canonical documentation compiler.

If integrated later, docs hooks should stay optional and downstream.

## Main Risks

- Low-quality Jira tickets create poor prompts
- Branch/PR conflicts
- Jira field variability between instances
- Trying to solve workflow automation too early

## Recommended Rollout

1. list issues
2. take one issue
3. prompt gate + run
4. branch + commit + PR
5. Jira transition/comment

## Related Feature

- `ai/design/features/DOCS_PIPELINE.md`

## Source

Detailed historical design snapshot is preserved in:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md`
