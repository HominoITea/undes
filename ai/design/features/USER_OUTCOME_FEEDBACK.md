# User Outcome Feedback Loop

Status: planned
Priority: P1
Track: shared-enabler

## Summary

After using a hub result (diagnostic or patch), the user provides a structured outcome
rating (1-5) and optionally captures their actual implementation diff. This creates
ground truth pairs that enable trust calibration now and model fine-tuning later.

## Problem

The hub currently has no way to learn from real outcomes:

- The existing `quality.json` rating is subjective and not tied to what the user actually did.
- Trust scoring (`patchSafeEligible`, tester score) is calibrated by design heuristics,
  not by real-world hit rate.
- When the hub says `DIAGNOSTIC` but the user copies 80% of the code as-is, the trust
  gate is provably too strict — but the hub never learns this.
- When the hub says `PATCH_SAFE` but the user rewrites 70%, the trust gate is too loose.

## Outcome Rating Scale

| Score | Label | Meaning | Data captured |
|-------|-------|---------|---------------|
| 1 | Not useful | Discarded, solved differently | User diff (optional) |
| 2 | Idea only | Took the direction, rewrote ~70%+ | User diff |
| 3 | Partial use | Used with significant rework ~30-50% | User diff |
| 4 | Minor edits | Used almost as-is, small fixes | User diff |
| 5 | As-is | Applied directly | Confirmation |

## Storage

```
.ai/feedback/
  {runId}/
    outcome.json          # structured rating + metadata
    user-diff.patch       # optional: git diff of what user actually committed
    hub-output-hash.txt   # hash of the hub result that was rated
```

### outcome.json schema

```json
{
  "version": 1,
  "runId": "run-1773693115279",
  "timestamp": "2026-03-17T10:00:00Z",
  "rating": 3,
  "ratingLabel": "partial-use",
  "hubResultMode": "DIAGNOSTIC",
  "hubTesterScore": 8,
  "hubPatchSafeEligible": false,
  "userDiffCaptured": true,
  "userDiffFiles": ["MtfOrderOperationService.java", "MtfOrderController.java"],
  "userNotes": "Took the service structure, rewrote validation and added missing audit calls"
}
```

## Integration Points

### MVP (Phase 1) — Structured feedback capture

1. **Post-run prompt**: after the interactive quality rating, ask the structured outcome
   question with the 1-5 scale above. Non-interactive mode skips this.
2. **Deferred feedback**: `npm run ai:feedback -- --run=<runId> --rating=4` for rating
   after the user has actually applied the result (hours/days later).
3. **Diff capture**: `npm run ai:feedback -- --run=<runId> --rating=3 --capture-diff`
   runs `git diff` in the target project and saves the patch.
4. **Storage**: write to `.ai/feedback/{runId}/outcome.json` + optional `.patch`.

### Phase 2 — Trust calibration (no model needed)

1. **Calibration report**: `npm run ai:feedback:report` aggregates outcomes vs hub
   predictions:
   - Hub said `DIAGNOSTIC` but user rated 4-5 → trust gate too strict (false negative)
   - Hub said `PATCH_SAFE` but user rated 1-2 → trust gate too loose (false positive)
   - Tester score vs outcome correlation
2. **Memory integration**: auto-save calibration facts to local memory:
   - "For Java service tasks on nornick, hub typically scores 3.5/5"
   - "Trust gate false-negative rate: 40% (hub says DIAGNOSTIC, user uses 80%+)"
3. **Threshold tuning**: if false-negative rate > 30% over 10+ rated runs, suggest
   relaxing the `hasSubstantiveAssumptions` gate for assumption categories that users
   consistently ignore.

### Phase 3 — Ground truth for local model (future)

When 50+ outcome pairs accumulate:

1. **Training pairs**: `(prompt, context_bundle, hub_output)` → `(user_diff, rating)`
2. **Negative examples**: ratings 1-2 with user diff = the model learns what NOT to produce
3. **Positive examples**: ratings 4-5 = the model learns what good output looks like
4. **Fine-tune targets**:
   - Local model predicts likely user rating before showing result
   - Local model suggests which assumptions the user will likely override
   - Local model adjusts trust gate per-project based on historical accuracy

## MVP Scope (what to build now)

1. Structured 1-5 rating with labels in post-run interactive flow
2. `ai:feedback` CLI command for deferred rating + diff capture
3. `outcome.json` storage in `.ai/feedback/{runId}/`
4. Optional `git diff` capture with `--capture-diff`
5. Basic `ai:feedback:report` aggregation (mean rating, false-negative/positive rates)

## What NOT to build now

- Automatic diff comparison (hub output vs user diff) — complex, Phase 2
- Fine-tuning pipeline — Phase 3, needs 50+ pairs
- Embedding-based similarity between hub output and user diff — Phase 3
- Real-time trust gate adjustment — Phase 2, after calibration data exists

## Success Criteria

- 10+ rated runs with structured outcomes across 2+ projects
- Calibration report shows actionable signal (e.g., "trust gate is 35% false-negative")
- Feedback capture takes < 30 seconds for the user
- Deferred feedback works days after the run

## Dependencies

- Local Memory MVP (landed) — for storing calibration facts
- Evidence-Grounded Patch Mode (landed) — provides `patchSafeEligible` to compare against
- Pilot baseline (met) — enough runs to start collecting

## Risks

| Risk | Mitigation |
|------|------------|
| Users won't bother rating | Make it 1-click in interactive mode; remind via deferred CLI |
| Diff capture captures unrelated changes | Scope to files mentioned in hub output by default |
| Small sample size skews calibration | Require 10+ ratings before acting on calibration signals |
| Privacy: user diffs may contain secrets | Store in `.ai/feedback/` which is already in `.gitignore`; no upload |
