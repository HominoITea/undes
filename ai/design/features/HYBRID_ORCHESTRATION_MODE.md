# Hybrid Orchestration Mode

Status: research
Priority: medium

## Summary

Introduce an orchestration layer that can route cheap summarization/context tasks locally or through shared infra, while escalating risky coding/reasoning to stronger cloud models.

## Target Modes

- Local mode for solo workflows
- Team-shared mode for shared memory and routing

## Why

- Lower accepted-change cost
- Better latency on low-risk tasks
- Better memory continuity across sessions and team members

## Core Building Blocks

- policy router
- context builder/summarizer
- RAG layer
- model gateway
- unified audit/event records

## Main Risks

- Context leakage across projects
- Shared infra complexity
- Single point of failure if shared services become central

## Rollout Direction

Start with shared memory/logs and model gateway before adding adaptive routing complexity.

## Source

Detailed historical design snapshot is preserved in:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md`
