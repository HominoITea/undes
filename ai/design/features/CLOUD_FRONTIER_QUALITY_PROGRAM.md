# Cloud Frontier Quality Program

Status: research
Priority: medium

## Summary

Improve correctness and consistency of frontier-model outputs without relying on local fine-tuning.

## Main Directions

- provider-specific prompt profiles
- stronger response contracts
- evidence-first RAG packets
- verifier/rewrite flow
- uncertainty gates
- hallucination guardrails
- benchmark and telemetry loops

## Why

- Better factual reliability
- Better stability across provider changes
- Better first-pass acceptance on high-risk tasks

## Main Risks

- Too much orchestration for small gains
- False sense of safety from weak evidence handling
- Quality logic drifting across providers without measurement

## Source

Detailed historical design snapshot is preserved in:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md`
