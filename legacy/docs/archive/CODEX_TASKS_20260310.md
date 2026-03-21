# Codex Tasks

> Last completed: Response Quality & Pipeline Hardening (Phase 3/3) — 2026-03-02
> Tests: 125/125 passed
> Status: **Pilot phase — collecting baseline metrics on real project**
> Hub UX update (2026-03-02): active project persistence in `hub-config.json`; `npm run ai` auto-targets selected project after `ai:hub start`.

---

## Current: Pilot on Real Project

**Goal:** Run 10 real tasks, collect metrics, establish baseline for SLA Router.

**Runbook:** `ai/PILOT_RUNBOOK.md`

**What to collect:**
- `metrics/history.json` — latency, tokens, confidence per run
- `metrics/quality.json` — user ratings 1-5
- Agreement scores from run logs
- Context pack hit rate, result cache usage

**Go/No-Go for SLA Router:**
- ≥8 completed runs
- ≥6 quality ratings
- Baseline aggregation report generated

---

## Next (after pilot): Adaptive SLA Router MVP

Scope (from Codex proposal):
1. Routing config section in `context.json` (complexity/risk/budget thresholds)
2. `routeAgent()` / `routePhase()` in `generate-context.js` (proposals + critiques first)
3. Router decision logging to metrics
4. `enabled: false` by default, rollout via flag
5. Before/after comparison: latency, tokens, rating

**Thresholds will come from pilot data, not assumptions.**
