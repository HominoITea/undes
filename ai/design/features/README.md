# Feature Design Docs

This folder contains active design documents for future features.

Use this folder when:
- a roadmap item needs more than a short summary;
- a feature has open design questions, rollout phases, or MVP boundaries;
- multiple models need one stable design reference for review.

Current active feature docs:
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/design/features/PIPELINE_HARDENING.md`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/design/features/PHASE_CONTRACT_NORMALIZATION.md`
- `ai/design/features/LOCAL_MEMORY_MVP.md`
- `ai/design/features/DEVSECOPS_REVIEWER.md`
- `ai/design/features/STACK_AWARE_DYNAMIC_SKILLS.md`
- `ai/design/features/DOCS_PIPELINE.md`
- `ai/design/features/JIRA_TAKE.md`
- `ai/design/features/STRUCTURE_RATIONALIZATION.md`
- `ai/design/features/MATRIX_AGENT_MODE.md`
- `ai/design/features/HYBRID_ORCHESTRATION_MODE.md`
- `ai/design/features/PERFORMANCE_ACCELERATION_PACK.md`
- `ai/design/features/CLOUD_FRONTIER_QUALITY_PROGRAM.md`
- `ai/design/features/LANGUAGE_AWARE_ARCH_CHECK.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `ai/design/features/PIPELINE_COST_OPTIMIZATION.md`
- `ai/design/features/ROUND_ORCHESTRATION_RATIONALIZATION.md`

Related docs:
- `ai/ROADMAP.md` — short roadmap only: priorities, status, and links
- `ai/PILOT_RUNBOOK.md` — next execution step on a real project
- `ai/design/archive/ROADMAP_DETAILED_20260310.md` — archived detailed roadmap snapshot before the roadmap was shortened

## MVP Risk-Debt Contract

Every feature doc that defines an MVP or records a landed MVP should keep an
explicit section for **MVP risk debt**, not just soft future notes.

For each meaningful assumption or simplification, record:
- the assumption or shortcut itself;
- why it was accepted for MVP;
- the user/operator risk if it turns out to be wrong;
- a concrete revisit trigger;
- the intended exit path or later-phase replacement, when known.

Recommended structure:
- `Assumption`
- `Why accepted now`
- `User/operator risk`
- `Revisit trigger`
- `Exit path`

Working rules:
- do not silently drop these notes after implementation lands;
- do not collapse several unrelated assumptions into one vague bullet if they
  carry different risks;
- append review-discovered assumptions when they become visible during code
  review, pilot runs, or production-like usage;
- when an assumption is removed later, mark it as `resolved` or `obsolete`
  instead of deleting the historical note immediately.

Backfill policy:
- already-landed MVP docs should be tightened when they are next touched;
- new MVP docs should include this section from the start;
- if an MVP ships without this section, treat that as documentation debt, not
  as an optional omission.
