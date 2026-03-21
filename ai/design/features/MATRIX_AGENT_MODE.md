# Matrix Agent Mode

Status: research
Priority: medium

## Summary

Instead of fixed model-role assignments, every configured model performs every role in parallel, critiques peers, and converges on the strongest output.

## Why

- Reduce model bias
- Improve solution diversity
- Increase quality on hard tasks

## Main Tradeoff

Quality may rise, but cost and latency increase sharply.

## Intended Use

- Critical architecture tasks
- High-risk implementation tasks
- Opt-in mode only, never default

## Open Questions

- Trigger contract: `--deep-think` or `--matrix`
- Selection/scoring logic for final output
- Whether code generation should stay multi-implementation or stop at multi-architecture

## Main Risks

- High token cost
- Long latency
- Complex orchestration and evaluation logic
- Harder debugging of failure modes

## Source

Detailed historical design snapshot is preserved in:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md`
