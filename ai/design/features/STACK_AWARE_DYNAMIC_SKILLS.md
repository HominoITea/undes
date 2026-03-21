# Stack-Aware Dynamic Skills

Status: planned
Priority: high

## Summary

Generate project-scoped role profiles on `ai:init` so agents stop spending tokens rediscovering the stack on every task.

Canonical output stays inside project `.ai/commands/`.

## Why

- Better first-pass answers on real code tasks.
- Lower token waste on framework discovery.
- Clear role separation for developer/tester/reviewer/architect/task-planner.

## MVP Direction

- Deterministic generation only:
  - base templates
  - stack dictionary
  - project override
- No required LLM synthesis on `ai:init`.
- Fixed MVP role set:
  - `developer`
  - `tester`
  - `reviewer`
  - `architect`
  - `task-planner`
- Initial stack coverage limited to:
  - `python+fastapi`
  - `js+next`
  - `postgres`

## Canonical Decisions Already Locked

- Source of truth is `.ai/commands/`, not interactive adapters.
- `.claude/commands/` is sync target only if enabled.
- One override file: `.ai/commands/overrides.json`.
- Stack-specific generation only when `confidence >= 0.70`.
- Detection output must include confidence, evidence, and generation fingerprint.

## MVP Deliverables

- Template set for 5 roles.
- Stack expertise dictionary.
- `ai:skills refresh`.
- Deterministic prompt injection into pipeline agents.
- Stack profile artifact with evidence and confidence.

## Main Risks

- Drift as project stack evolves.
- Prompt bloat if profiles grow too large.
- Wrong detection on monorepos or mixed stacks.
- Source drift if two canonical locations appear.

## Pre-Implementation Gates

- Keep one canonical storage location.
- Freeze MVP role list and stack set.
- Define test plan before coding.
- Preserve `npm run ai:test` green gate.

## Source

Detailed historical discussion is preserved in:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md`
