# Pilot Runbook: Baseline Before SLA Router

## Purpose
Collect real runtime data before implementing the Adaptive SLA Router.

This pilot is required to avoid routing based on guessed thresholds.

## Success Criteria
- At least `8` completed real runs (target: `10`).
- At least `6` saved quality ratings in `metrics/quality.json`.
- Coverage of task types:
  - `3+` bug fixes
  - `3+` refactor/architecture tasks
  - `2+` documentation/process tasks
- Stable metric baseline captured:
  - latency (`totalTimeSeconds`)
  - token usage (`totalTokens`)
  - confidence (`avgConfidence`)
  - agreement score (from run logs)
  - quality rating (`1-5`)

## Prerequisites
1. Register a real target project in hub:
```bash
npm run undes:add -- --path="/abs/path/to/repository"
```
2. Select active project once:
```bash
npm run undes:start
```
3. Ensure API keys are configured in `.ai.env`.
4. Run pilot in interactive mode (do not use `--non-interactive`) so quality rating is recorded.

## Recommended Prompt Set (10 runs)
Use real tasks from your project backlog. Keep each prompt concrete (file/function/error specific).

Suggested structure:
1. Bug fix in one module
2. Bug fix with edge case
3. Bug fix with test update
4. Medium refactor in one file
5. Refactor across 2-3 files
6. Design/architecture improvement
7. Performance optimization
8. Logging/observability improvement
9. API contract change
10. Documentation/update + code consistency

## Run Command Template
```bash
npm run undes -- \
  --prompt="YOUR_REAL_PROMPT" \
  --prepost --test
```

Notes:
- Keep flags consistent across all pilot runs.
- After each run, provide quality rating (`1-5`) when prompted.
- Do not delete `prompts/metrics/history.json` during pilot.
- For one-off run against another project, add `--project-path="/abs/path/to/other-project"`.

## Per-Run Capture Sheet
Copy this table into your tracking doc and fill after each run.

| Run | Prompt ID | Task Type | Total Time (s) | Total Tokens | Avg Confidence | Agreement Score | Rating (1-5) | Notes |
|---|---|---|---:|---:|---:|---:|---:|---|
| 01 | P01 | bugfix |  |  |  |  |  |  |
| 02 | P02 | bugfix |  |  |  |  |  |  |
| 03 | P03 | bugfix |  |  |  |  |  |  |
| 04 | P04 | refactor |  |  |  |  |  |  |
| 05 | P05 | refactor |  |  |  |  |  |  |
| 06 | P06 | architecture |  |  |  |  |  |  |
| 07 | P07 | performance |  |  |  |  |  |  |
| 08 | P08 | observability |  |  |  |  |  |  |
| 09 | P09 | api |  |  |  |  |  |  |
| 10 | P10 | docs/process |  |  |  |  |  |  |

## Baseline Aggregation Command
Run from hub root after pilot:
```bash
node -e "
const fs=require('fs'); const path=require('path');
const project=process.argv[1];
const aiDir=fs.existsSync(path.join(project,'.ai'))?path.join(project,'.ai'):path.join(project,'ai');
const metricsDir=path.join(aiDir,'prompts','metrics');
const historyPath=path.join(metricsDir,'history.json');
const qualityPath=path.join(metricsDir,'quality.json');
const history=fs.existsSync(historyPath)?JSON.parse(fs.readFileSync(historyPath,'utf8')):[];
const quality=fs.existsSync(qualityPath)?JSON.parse(fs.readFileSync(qualityPath,'utf8')):[];
const nums=(arr,k)=>arr.map(x=>x?.[k]).filter(v=>typeof v==='number'&&Number.isFinite(v));
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const p=(a,q)=>{ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); const i=Math.min(s.length-1,Math.max(0,Math.ceil(q*s.length)-1)); return s[i]; };
const total=nums(history,'totalTimeSeconds');
const tokens=nums(history,'totalTokens');
const conf=nums(history,'avgConfidence');
const rounds=nums(history,'consensusRounds');
const ratings=nums(quality,'rating');
console.log(JSON.stringify({
  runs: history.length,
  ratedRuns: ratings.length,
  avgRating: avg(ratings),
  avgLatencySec: avg(total),
  p50LatencySec: p(total,0.50),
  p95LatencySec: p(total,0.95),
  avgTokens: avg(tokens),
  p50Tokens: p(tokens,0.50),
  p95Tokens: p(tokens,0.95),
  avgConfidence: avg(conf),
  avgConsensusRounds: avg(rounds)
}, null, 2));
" "/abs/path/to/repository"
```

## Go/No-Go for SLA Router
Proceed to SLA Router implementation only if:
- `runs >= 8`
- `ratedRuns >= 6`
- No repeated pipeline failures due to missing/invalid metrics
- Baseline JSON report generated successfully

If criteria are not met, continue pilot until data is sufficient.

## Next Step After Pilot
Implement SLA Router MVP using measured percentiles:
- latency thresholds from `p50/p95`
- budget tiers from `p50/p95 tokens`
- quality floor from `avgRating`
- conservative fallback to current behavior when routing confidence is low

## Pilot Results

### Baseline Status

- Baseline threshold was first met on `2026-03-12`: `8` completed real runs and
  `6` saved ratings across real projects.
- As of `2026-03-13`, the persisted runtime metrics now show `10` completed runs
  and `6` saved ratings because later `<TARGET_PROJECT>` reruns were also
  preserved in project metrics.
- This means the pilot is operationally closed for baseline purposes; later runs
  should be treated as post-baseline validation, not as a blocker for the
  original go/no-go gate.

### Project Breakdown

- `/abs/path/to/<PILOT_PROJECT_A>`: `1` run, `0` ratings.
- `/abs/path/to/<PILOT_PROJECT_B>`: `1` run, `0` ratings.
- `/abs/path/to/<TARGET_PROJECT>`: `8` runs, `6` ratings,
  average rating `3.5`.

### Aggregate Metrics Snapshot

- `runs`: `10`
- `ratedRuns`: `6`
- `avgRating`: `3.5`
- `avgLatencySec`: `6748.92`
- `p50LatencySec`: `791.99`
- `p95LatencySec`: `59278.11`
- `avgTokens`: `377891.89`
- `p50Tokens`: `323953`
- `p95Tokens`: `636877`
- `avgConfidence`: `92.3`
- `avgConsensusRounds`: `1.4`

### What The Pilot Proved

- The hub can complete full real-project multi-agent runs on the main Java
  workload (`<TARGET_PROJECT>`) after the runtime hardening fixes.
- Adaptive Runtime Control work addressed a real pilot bottleneck: preflight
  waits now happen before predictable Anthropic rate-limit failures instead of
  only after a later `429`.
- Context compression and pack-oriented context selection improved practical
  context density on `<PILOT_PROJECT_A>`; live smoke showed a bundle reduction and a
  shift from whole-file requests toward targeted ranged reads.
- The pilot exposed and validated a real runtime bugfix path: a false-positive
  refusal detector rejected a valid analytical proposal, was fixed, and the
  rerun then completed the full pipeline successfully.

### Main Findings

- The most important remaining runtime blocker after baseline closure was not a
  hub defect but provider-side economics: Anthropic billing / balance limits
  blocked further extension on the main project.
- The next quality gap after runtime stabilization was final-answer trust, not
  raw run completion. Successful pilot outputs were still stronger as
  diagnostic artifacts than as copy-paste-safe patch artifacts.
- Structural/context-pack infrastructure is already active in production, but
  broader validation of `ast-grep` quality versus index-backed fallback still
  remains a separate post-pilot task before stronger rollout.

### Post-MVP Validation Rerun — 2026-03-13

- A later live rerun was completed on
  `/abs/path/to/<TARGET_PROJECT>` using task id
  `ast-grep-live-validation-20260313` and the archived diagnostic patch prompt
  from `run-1773308708834`.
- This rerun confirmed real runtime structural-search use, not just offline
  harness behavior:
  - `contextPackActive: true`
  - `structuralSearch.backendRequested: "ast-grep"`
  - `structuralSearch.backendUsed: "ast-grep"`
  - `structuralSearch.fallback: false`
  - `structuralSearch.symbolCount: 72`
  Source: `<TARGET_PROJECT>/.ai/prompts/metrics/latest.json`
- Operationally, the rerun completed end-to-end:
  - total time `401.18s`
  - consensus rounds `1`
  - average confidence `95`
  - reviewer/developer approval passed in the first round
- Product outcome was mixed:
  - structural-search rollout goal was validated in real runtime;
  - final output still remained `RESULT_MODE: DIAGNOSTIC`, not `PATCH_SAFE`.
- The current trust gap is now clearer and narrower than before:
  - patch-safe denial was caused by missing / unobserved evidence anchors and
    substantive assumptions, not by structural-search fallback;
  - tester verdict was `PASS_WITH_NOTES (8/10)`;
  - devil's advocate verdict was `CONCERNS`, overall risk `MEDIUM`.
- This means the next post-pilot step is no longer `prove ast-grep runs live`.
  It is `improve evidence grounding / patch-safe precision on top of a now
  validated ast-grep-backed runtime`.

### Decisions Taken From The Pilot

- `Real-project pilot` is considered `baseline-met` and is no longer the active
  blocking work item for roadmap progression.
- `Adaptive Runtime Control` and `Evidence-Grounded Patch Mode` were promoted by
  concrete pilot findings, not by speculative roadmap preference.
- `Grep-AST Structural Search` remains `in-progress`; its next step is
  precision tuning and broader rollout decisions after live validation, not
  basic proof that the backend can run.

### Remaining Operational Blockers

- Anthropic provider balance / billing limited further main-project extension.
- Large-run variance remains high (`p95LatencySec` is dominated by one very long
  early `<TARGET_PROJECT>` run), so future routing work should rely on the
  measured percentiles rather than intuition.
- Ratings are still concentrated in one project (`<TARGET_PROJECT>`), so
  future evaluation should expand rated coverage if cross-project quality
  comparisons become important.
