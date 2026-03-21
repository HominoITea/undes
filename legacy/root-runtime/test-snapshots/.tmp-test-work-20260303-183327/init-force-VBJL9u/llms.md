# Project Architecture Summary

Detected stack: node

## 1) Product Context
- Multi-module application with typed boundaries.
- Goal: maintainable architecture and predictable delivery.

## 2) Baseline Rules
- Keep business logic separate from transport/UI.
- Validate external input at module boundaries.
- Keep secrets out of source control and prompts.
- Favor small, testable modules over god files.

## 3) Required Follow-up
- Replace this default summary with project-specific modules.
- Describe real data flow and auth model.
- List critical invariants and known pitfalls.
