# Round Orchestration Rationalization

Status: partial-implementation
Priority: P0

Implementation note (2026-03-21): the original Phase 1 discussion accepted a
lightweight `diagnostic-review` tester mode for `DIAGNOSTIC` results. Runtime
behavior has since been tightened by the Pipeline Cost Optimization track:
tester is now skipped for `DIAGNOSTIC` results and runs only for
`patch-validation` cases. Historical discussion below is preserved for context;
current source of truth is `ai/scripts/generate-context.js` plus
`ai/design/features/PIPELINE_COST_OPTIMIZATION.md`.

Implementation note (2026-03-22): the first Phase 2 slice is now landed.
`generate-context.js` skips synthesizer revision when approval disagreement is
classified as evidence-gap-only, records the avoided revision call in
operational telemetry, and stops early instead of rewriting ungrounded prose
when the disagreement requests more evidence but does not provide fetchable
seams.

## Why This Exists

The current hub pipeline spends too many tokens on "text convergence" before it
performs deterministic evidence acquisition. In practice:

- proposal and critique rounds often discover the real disagreements;
- approval rounds then restate those disagreements as prose;
- only Lever 3 turns unresolved gaps into targeted seam reads.

This means the pipeline can spend several LLM calls arguing about missing
evidence before it actually fetches that evidence.

## Current Waste Pattern

### Observed behavior

- `proposals` produce initial alternatives and often request useful reads.
- `critiques` identify contradictions, unsupported claims, and risk hypotheses.
- `consensus` synthesizes a draft.
- `approval` loops frequently ask for revisions without adding new evidence.
- `revision` rewrites the same draft from prose notes.
- `Lever 3` arrives later and finally performs deterministic seam fetch.

### Why this is inefficient

- approval rounds are too often used as a disagreement echo chamber;
- the same unresolved seam can be described in different words across multiple
  rounds without being fetched;
- low agreement is logged, but it does not immediately trigger earlier evidence
  acquisition;
- `broadenedPrompt` existed as an artifact, but historically was not used to
  reshape the active run;
- Devil's Advocate and Tester run after the expensive debate, even when the
  draft is already clearly `DIAGNOSTIC`.

## Design Goal

Shift the pipeline from:

- "debate more, then fetch evidence"

to:

- "debate once, fetch missing evidence early, then converge quickly"

Primary optimization target:

- reduce redundant approval/revision loops that do not produce new file reads,
  new seams, or new trust-state changes.

## Proposed Revision Plan

### 1. Turn Approval into an Evidence-Gap Router, Not a Long Debate Loop

Current problem:
- approval agents often explain what is still unresolved, but do not always
  emit `missingSeams`.

Plan:
- treat approval as a structured gate whose main job is:
  - approve as-is;
  - request narrow `missingSeams`;
  - or request one concise textual correction.
- consider prose-only disagreement without new `missingSeams` a weak signal.

Expected outcome:
- fewer "rewrite the same draft again" cycles;
- more immediate transition into deterministic seam fetch.

### 2. Trigger Lever 3 Earlier

Current problem:
- Lever 3 only starts after multiple approval rounds.

Plan:
- after the first approval round, if any unresolved evidence gap is still
  retrievable, jump directly into seam expansion.
- do not wait for multiple approval rounds to repeat the same missing proof.

Expected outcome:
- fewer wasted approval/revision cycles;
- faster movement from disagreement to evidence.

### 3. Make "No New Evidence" a First-Class Stop Condition

Current problem:
- several rounds can happen even when no new files were fetched and no trust
  category changed.

Plan:
- track per-round progress signals:
  - new fetched seams count;
  - new observed files count;
  - trust delta (`contractGapCount`, `groundingGapCount`, categories);
  - whether `missingSeams` changed meaningfully.
- if a round produces no material change, stop repeating the same loop.

Expected outcome:
- the orchestrator stops paying for stylistic rewrites that do not move the
  result toward `PATCH_SAFE`.

### 4. Collapse Approval + Revision into a Single Pass When the Feedback Is Purely Editorial

Current problem:
- approval can reject on issues that do not require a new fetch, but the system
  still spends a full loop to discover that.

Plan:
- separate approval findings into:
  - `needsEvidence`;
  - `needsTextRevision`;
  - `approved`.
- if all agents return only `needsTextRevision`, do one revision pass only.
- do not run a second approval round unless the revision is expected to change
  trust materially.

Expected outcome:
- fewer approval loops for cosmetic or claim-tightening fixes.

### 5. Gate Devil's Advocate and Tester by Result Mode and Trust State

Current problem:
- DA and Tester often run even when the result is already clearly
  `DIAGNOSTIC`.

Plan:
- skip or downgrade DA when:
  - trust already shows unresolved substantive assumptions and no new seams
    remain to fetch in the current run.
- skip or downgrade Tester when:
  - no grounded implementation-ready patch exists;
  - the result remains `DIAGNOSTIC`.

Expected outcome:
- fewer expensive late-phase calls that restate "needs more evidence."

### 6. Use Prompt Broadening as an Active Routing Tool, Not Just a Warning Artifact

Current problem:
- narrow-starting-seam prompts bias the whole run too early.

Plan:
- when prompt-engineer reports `narrow-starting-seams`, allow the orchestration
  layer to switch to `broadenedPrompt` automatically once the first unresolved
  evidence gap appears.
- keep explicit hard-scope prompts authoritative.

Expected outcome:
- earlier collection of adjacent call sites and data-flow seams;
- fewer late discoveries that the initial prompt was too local.

## Proposed Target Pipeline

### Current rough shape

1. pre-process
2. proposal
3. critique
4. consensus
5. approval round 1
6. revision
7. approval round 2
8. revision
9. approval round 3
10. Lever 3
11. Devil's Advocate
12. Tester

### Proposed rough shape

1. pre-process
2. proposal
3. critique
4. consensus draft
5. approval gate round 1
6. if retrievable gaps exist: immediate seam expansion
7. one focused revision from fetched seams
8. one final approval gate
9. conditional DA
10. conditional Tester

Key difference:
- only keep looping while the pipeline is gaining new evidence or materially
  reducing trust gaps.

## Concrete Rollout Phases

### Phase 1. Early-Lever Routing

- trigger seam expansion after first approval round when `missingSeams` exist;
- reduce default `maxApprovalRounds` from 3 to 2;
- add "no material progress" stop condition.

Low-risk, highest ROI.

### Phase 2. Typed Approval Outcomes

- replace plain `agreed + notes` mental model with:
  - `approved`
  - `revise-text`
  - `fetch-evidence`
- only loop when the outcome type justifies it.

### Phase 3. Late-Phase Cost Gating

- skip/downgrade DA on clearly unresolved diagnostic runs;
- skip/downgrade Tester when no implementation-ready grounded patch exists.

### Phase 4. Full Pipeline Telemetry Review

- report per-run:
  - tokens spent before first deterministic seam fetch;
  - tokens spent in approval/revision loops with zero new evidence;
  - trust delta per round;
  - calls avoided by gating.

## Acceptance Criteria

- Median number of approval/revision calls per run decreases.
- Median tokens spent before first deterministic seam fetch decreases.
- Runs with repeated prose-only disagreement but no new evidence decrease.
- `PATCH_SAFE` rate does not regress on evidence-heavy tasks.
- `DIAGNOSTIC` runs fail earlier and cheaper when the pipeline cannot ground
  the answer.

## Discussion Questions

1. Should Lever 3 trigger immediately after the first approval round, or even
   earlier directly from critiques when unresolved seams are explicit?
2. Should Devil's Advocate be allowed to emit `missingSeams` too, or should it
   stay purely adversarial?
3. Should Tester be split into:
   - patch validation mode;
   - diagnostic review mode?
4. Should low agreement itself trigger evidence fetch, or only structured
   `missingSeams` requests?

## Additional Discussion Notes (2026-03-16)

### 1. "Senior-Developer Skepticism" is Mostly a Semantic Overlay Today

Current state:

- the roadmap/design language introduced a strong "senior developer skepticism"
  framing;
- but the runtime did not land a single dedicated skepticism mechanism;
- instead, skepticism was distributed across approval scoring, Devil's
  Advocate, and stricter prompt contracts.

Practical consequence:

- we added more review pressure and more discussion text;
- but we did not add an equally strong routing mechanism that says:
  - fetch more evidence now;
  - stop the loop now;
  - branch differently now.

Discussion position:

- treat "senior skepticism" as incomplete until it becomes explicit runtime
  behavior, not just stricter prose expectations.
- avoid adding more skepticism-themed prompt layers unless they come with a
  concrete orchestration contract.

### 2. We Currently Mix Two Different Kinds of Scoring

There are two very different score families in the system:

- **routing score**: should change what the pipeline does next;
- **telemetry score**: useful for diagnostics, but does not change execution.

Current problem:

- approval scoring is effectively routing-aware because low approval drives
  revision loops;
- critique agreement scoring is mostly telemetry-only and currently just logs a
  warning;
- this creates operator confusion because both are called "scores", but only
  one actually branches the run.

Discussion position:

- explicitly classify every score in the pipeline as either:
  - routing;
  - advisory telemetry.
- if a score is routing-capable, define the exact branch it controls.
- if a score is telemetry-only, stop presenting it as if it should affect the
  debate path.

### 3. The Main Architecture Smell is "Layering on Top"

Observed pattern:

- we kept adding quality layers on top of the existing panel loop;
- many additions improved honesty and diagnostics;
- but several of them landed as overlays on the old flow rather than as a
  redesigned flow.

Practical consequence:

- more phases can comment on the same unresolved issue;
- fewer phases are empowered to resolve it directly.

Discussion position:

- prioritize changes that remove or re-route low-value loops over changes that
  add another interpretive layer.
- when adding a new phase or score, require one explicit answer:
  - what concrete branch or stop condition does this add?

### 4. Candidate Decisions for the Next Discussion

1. Formally declare `agreementScore` telemetry-only unless we intentionally
   give it routing power.
2. Reduce the role of approval from "extended debate" to "gate + seam request".
3. Treat `senior skepticism` as a design objective, not a landed runtime
   feature, until context-completeness / mid-debate verification / route
   branching are implemented.
4. Reject any new round proposal that cannot show:
   - what new evidence it can produce;
   - what route it changes;
   - what existing loop it replaces.

## Recommended Next Implementation Order

1. Early Lever 3 trigger after approval round 1
2. No-progress stop condition
3. Reduce approval rounds to 2
4. Conditional DA / Tester gating
5. Typed approval outcomes

## MVP Risk Debt

- **Assumption:** Most wasted rounds are approval/revision loops, not
  proposals/critiques.
  - **Why accepted now:** current orchestration and pilot evidence point there.
  - **User/operator risk:** we optimize the wrong segment and save less than
    expected.
  - **Revisit trigger:** telemetry shows waste is concentrated earlier.
  - **Exit path:** move early fetch trigger directly after critiques.

- **Assumption:** Earlier seam expansion will improve quality more than another
  textual approval round.
  - **Why accepted now:** missing evidence is the dominant blocker to
    `PATCH_SAFE`.
  - **User/operator risk:** we may fetch too early on tasks where one concise
    revision would have sufficed.
  - **Revisit trigger:** telemetry shows many early-expansion runs would have
    converged without extra reads.
  - **Exit path:** add a stricter threshold for triggering early expansion.

- **Assumption:** Skipping Tester on clearly diagnostic runs is safe.
  - **Why accepted now:** tester feedback is often generic when no grounded
    patch exists.
  - **User/operator risk:** we may lose useful requirement-gap findings.
  - **Revisit trigger:** operators report missing high-value tester findings on
    diagnostic runs.
  - **Exit path:** keep a lightweight diagnostic-review tester mode instead of a
    full skip.

## Review Comments — Claude Opus 4.6 (2026-03-17)

Overall score: 9/10. Most mature design doc from Codex so far. Diagnosis is
accurate, proposals are concrete, risk debt is honest.

### General Assessment

The core insight — "we debate more before we fetch evidence" — is confirmed by
both live projects:

- `nornick`: Lever 3 triggered only in the last run; 4 earlier runs spent tokens
  on approval loops without new evidence.
- `plta-document-flow`: same pattern, 2-3 approval rounds before first seam fetch.

The "Senior Skepticism is a Semantic Overlay" observation is the most important
architectural call in this doc. We added prompt pressure without routing logic.

### Comment 1: Phase 1 — Early Lever 3 Trigger Position

Agree with "after first approval" as MVP. But critique already contains enough
information for seam requests in most observed runs. Approval round 1 typically
restates critique findings as "I don't approve because X wasn't read."

**Recommendation:** Phase 1 MVP = after first approval (as written). But
immediately add telemetry: "% of runs where critique already contained all seams
that appeared in approval round 1." If >70%, move trigger to post-critique in a
follow-up batch.

### Comment 2: Typed Approval Outcomes — Avoid Breaking Change

Current approval contract: `approved: boolean, score: number, missingSeams: array`.
The proposed `approved | revise-text | fetch-evidence` is a different contract
shape.

**Recommendation:** Do not change the existing schema. Instead, derive
`outcomeType` from existing fields in the orchestrator:

- `missingSeams.length > 0` → `fetch-evidence`
- `!approved && missingSeams.length === 0` → `revise-text`
- `approved` → `approved`

This gives routing power without changing agent prompts or approval JSON format.

### Comment 3: DA Skip — Agree; Tester Skip — Partial Disagree

DA on `DIAGNOSTIC` runs: agree with skip. On `nornick` DA spent 26 seconds
saying "needs more evidence" — we already know that.

Tester on `DIAGNOSTIC` runs: do not fully skip. Tester is the most expensive
agent in the run (43 seconds, 2602 output tokens on `nornick`), but it often
finds **requirement gaps** not visible in debate.

**Recommendation:** Do not skip Tester. Switch to **lightweight diagnostic-review
mode** (as mentioned in exit path). Shorter prompt: instead of "verify this patch"
→ "verify requirement coverage in diagnostic output." This preserves the
requirement-gap finding value at lower token cost.

### Comment 4: Discussion Answers

**Q1 — When to trigger Lever 3:**
After first approval as MVP. Track critique-vs-approval seam overlap. If >70%
overlap, move to post-critique trigger.

**Q2 — DA emitting missingSeams:**
No. DA should stay adversarial reviewer, not evidence requester. Mixing roles
weakens both. If DA discovers a gap, it should be a finding, not a seam request.

**Q3 — Tester split:**
Yes, correct idea. Two modes:

- `patch-validation`: full Tester (only when `patchSafeEligible = true`)
- `diagnostic-review`: lightweight Tester, checks requirement coverage (when
  `DIAGNOSTIC`)

**Q4 — Low agreement triggering evidence fetch:**
Only structured `missingSeams`, not raw agreement score. Low agreement is too
noisy — agents can disagree on phrasing/style, not on evidence. Keep
`agreementScore` as telemetry-only unless we intentionally give it routing power.

### Baseline Numbers for Phase 1 Savings Estimate

From current live data:

- `nornick` run-1773693115279: 3 approval rounds × 2 agents = 6 LLM calls before
  Lever 3 trigger
- `plta-document-flow`: 2-3 approval rounds before first seam fetch (similar
  pattern)
- Estimated savings from Phase 1 (early trigger + reduce to 2 rounds):
  ~2-4 LLM calls per run, ~30-50K tokens

### What I Would Add to the Doc

1. **Concrete telemetry spec for Phase 4**: define the exact metrics before
   implementing Phase 1 so we can measure impact:
   - `tokensBeforeFirstSeamFetch`
   - `approvalRoundsWithZeroNewSeams`
   - `trustDeltaPerRound`
   - `callsAvoidedByGating`
2. **Backward compatibility contract**: explicitly state that Phase 1 changes
   must not break existing checkpoint resume. Runs checkpointed mid-approval
   should still complete correctly.
3. **agreementScore formal classification**: declare it telemetry-only now.
   If we ever want routing power, that's a separate design decision with its
   own acceptance criteria.

## Review Comments — Gemini CLI + Codex Synthesis (2026-03-17)

Gemini provided an additional round of comments after reading both this document
and Claude's review. The remarks are directionally strong and mostly align with
the current proposal, but they sharpen several implementation boundaries.

### Gemini Comment 1: Do Not Change Approval Schema

Gemini's concern:

- replacing the current approval contract with explicit typed outcomes
  (`approved | revise-text | fetch-evidence`) would be a high-blast-radius
  contract change;
- it would risk breaking log compatibility, parser behavior, and prompt
  assumptions.

Codex synthesis:

- agree fully;
- this should be solved inside the orchestrator, not by changing agent JSON.

Accepted implementation direction:

- derive `outcomeType` from existing fields:
  - `missingSeams.length > 0` → `fetch-evidence`
  - `!agreed && missingSeams.length === 0` → `revise-text`
  - `agreed === true` → `approved`

Decision:

- keep the approval schema stable for Phase 1;
- typed outcomes remain an orchestration concept, not an agent contract change.

### Gemini Comment 2: Do Not Fully Disable Tester on `DIAGNOSTIC`

Gemini's concern:

- Tester is not only a code-test generator;
- it often catches missing business requirements that debate agents do not name
  explicitly.

Codex synthesis:

- agree;
- full Tester skip is too aggressive for diagnostic runs.

Accepted implementation direction:

- split Tester behavior into two modes:
  - `patch-validation` when the result is implementation-ready;
  - `diagnostic-review` when the result is still `DIAGNOSTIC`.

Decision:

- preserve the requirement-gap function of Tester;
- reduce cost by shrinking prompt scope in diagnostic mode instead of skipping.

### Gemini Comment 3: Early Lever 3 Needs a Quality Threshold

Gemini's concern:

- a single agent can request a file that is not actually critical;
- naive early-trigger behavior may expand context with noise and waste tokens.

Codex synthesis:

- agree with the risk;
- disagree that the right fix is "majority confirmation" alone;
- a vote count is too blunt and can delay useful evidence fetch.

Accepted direction:

- early Lever 3 should require a **quality threshold**, not just "someone asked
  for a file";
- possible conditions:
  - a trust gap still exists (`substantive-assumptions` or equivalent);
  - the seam request is structured and narrow;
  - the seam is resolvable deterministically;
  - the fetch is plausibly capable of reducing trust debt.

Decision:

- do not trigger early Lever 3 on free-form curiosity;
- do trigger it on high-quality, trust-relevant seam requests.

### Gemini Comment 4: Critique Should Eventually Become an Emitter

Gemini's concern:

- waiting until approval to collect `missingSeams` is still too late;
- critique often already knows the draft is missing evidence.

Codex synthesis:

- agree;
- but this should not be the first rollout step.

Accepted direction:

- Phase 1: keep approval as the primary structured emitter for safety;
- Phase 2 or 3: allow critique to emit `missingSeams` and trigger earlier
  expansion before the first consensus draft, if telemetry proves the overlap is
  high enough.

Decision:

- critique-emitted seams are the right next evolution,
  but not the first migration batch.

### Consolidated Position

After combining Claude's review and Gemini's extra comments, the practical
consensus is:

1. Do **not** change approval JSON schema.
2. Do derive routing outcomes from the current approval fields.
3. Do trigger Lever 3 earlier, but only behind a seam-quality threshold.
4. Do keep Tester, but split it into `patch-validation` vs
   `diagnostic-review`.
5. Do treat critique as the next likely seam emitter after the first routing
   batch proves stable.

### Codex Final Comment on Gemini's Additions

Gemini's strongest contribution here is architectural restraint:

- solve routing in the orchestrator;
- avoid breaking agent contracts;
- avoid deleting quality checks that still have distinct value.

This is the correct bias for the next batch. The biggest remaining gap is still
the same one identified earlier: we need a concrete routing table and stop
conditions, not just more conceptual review pressure.

## Final Consensus — All Models (2026-03-17)

All three models (Claude Opus, Gemini CLI, Codex) agree on consolidated position.
No material disagreements remain. This section records the binding decisions and
green-lights Phase 1 implementation.

### Binding Decisions

1. **Approval schema**: unchanged. Derive `outcomeType` in orchestrator from
   existing `agreed`, `missingSeams` fields.
2. **Early Lever 3**: trigger after first approval round, gated by quality
   threshold (not free-form curiosity).
3. **Tester**: never fully skip. Split into `patch-validation` and
   `diagnostic-review` modes.
4. **DA**: skip on clearly `DIAGNOSTIC` runs with unresolved substantive
   assumptions and no remaining fetchable seams.
5. **Critique as emitter**: deferred to Phase 2+. Track seam overlap metric
   first.
6. **agreementScore**: classified as telemetry-only. No routing power unless a
   separate design decision grants it.

### Phase 1 Quality Threshold for Early Lever 3

MVP gate (both conditions must be true):
- `substantive-assumptions` gap exists in current trust state;
- at least one `missingSeams` entry has a structured `fetchHint`.

Phase 2 additions (not now):
- seam is deterministically resolvable (file exists, range is valid);
- fetch is plausibly capable of reducing trust debt (not just curiosity).

### Phase 1 Routing Table

This is the concrete `(state, signal) → action` table for the approval loop:

| State | Signal | Action |
|-------|--------|--------|
| After approval round 1 | All agents `agreed` | → skip to DA/Tester |
| After approval round 1 | Any `missingSeams` with `fetchHint` + trust gap | → immediate Lever 3 expansion |
| After approval round 1 | `!agreed`, no `missingSeams` | → one revision pass, then final approval |
| After approval round 2 | All agents `agreed` | → proceed to DA/Tester |
| After approval round 2 | Still `!agreed`, no new seams vs round 1 | → **stop**: no-material-progress, proceed to DA/Tester |
| After approval round 2 | New `missingSeams` appeared | → Lever 3 expansion (max 1 more round) |
| After Lever 3 expansion | Expansion fetched new evidence | → one focused revision + one final approval |
| After Lever 3 expansion | Expansion fetched nothing new | → stop, proceed to DA/Tester |
| DA gate | `DIAGNOSTIC` + unresolved `substantive-assumptions` + no fetchable seams | → skip DA |
| DA gate | Otherwise | → run DA |
| Tester gate | `patchSafeEligible = true` | → run Tester in `patch-validation` mode |
| Tester gate | `patchSafeEligible = false` | → run Tester in `diagnostic-review` mode (lighter prompt) |

### Phase 1 Telemetry (define before implementing)

Collect from day one so Phase 2 decisions are data-driven:

- `tokensBeforeFirstSeamFetch`: total tokens spent before Lever 3 triggers
- `approvalRoundsWithZeroNewSeams`: count of approval rounds that added no new
  `missingSeams` vs prior round
- `trustDeltaPerRound`: change in `groundingGapCount` / `contractGapCount`
  between rounds
- `callsAvoidedByGating`: DA/Tester calls skipped or downgraded
- `critiqueSeamOverlap`: % of approval round 1 `missingSeams` that were already
  described (in prose) during critique — this metric gates the Phase 2 decision
  to move Lever 3 trigger to post-critique

### Backward Compatibility Contract

Phase 1 changes must not break checkpoint resume:
- Runs checkpointed mid-approval must still complete correctly.
- New routing logic must check checkpoint state before applying early-exit or
  early-expansion rules.
- No existing run artifacts (approval JSON, revision text) may be dropped or
  reformatted.

### Live Observation: Revision Round Waste (2026-03-18, nornick run-1773773250415)

Compared `synthesizer-consensus.txt` vs `synthesizer-revised.txt` after approval
round triggered a revision. Findings:

**What changed:**
- Cosmetic rephrasing (no semantic value)
- Evidence references lost precision (line numbers removed)
- Variable renamed in code snippet (`container` → `orderContainer`)
- One new speculative block added: `shipScheduleCapacityService` /
  `mtfOrderContainerPlacementService` calls — but marked as Assumption, not
  grounded

**What did NOT change:**
- No grounded code was corrected
- No factual errors were fixed
- No new evidence was cited
- Trust state unchanged (still `patchSafeEligible=no`, same gaps)

**Cost:** full synthesizer LLM call (~4K output tokens) for zero grounded
improvement.

**Proposed Phase 2 addition — Revision Skip Gate:**
Skip revision round when approval disagreements contain only:
- requests for more evidence (→ trigger Lever 3 instead)
- cosmetic/phrasing concerns (no factual error in grounded code)
- new assumptions (→ add to Assumptions section, don't rewrite draft)

Trigger condition: approval `missingSeams.length > 0` AND no approval agent
flagged a factual error in `Grounded Fixes`. In this case, skip revision and go
straight to Lever 3 fetch (if available) or stop.

This is consistent with the existing "debate once, fetch early" philosophy and
would save 1 LLM call per run where approval disagreement is evidence-gap, not
code-error.

### Live Observation: Lever 3 Seam Loss (2026-03-18, nornick run-1773773250415)

Full trace of why agents could not read `MtfCalculationService#calculate` and
`getEditableOrder` despite Lever 3 triggering and successfully fetching 3 other
methods.

**What Lever 3 successfully fetched:**
- `MtfOrderOperationService#clearReserves` (lines 380-412) — real method body
- `MtfOrderOperationService#revokeOrder` (lines 152-175) — real method body
- `ValidateOrdersService#validateForRevokePossibility` (lines 158-182) — real
  method body

**What was lost:**
- `MtfCalculationService#calculate` — requested by developer, dropped by
  maxItems cap
- `MtfOrderOperationService#getEditableOrder` — requested by developer, dropped
  by maxItems cap
- `OrderContainer#equivalent_iso20` — requested by reviewer, skipped
  (method-not-found-in-owner-type)

**Root cause chain:**

1. Reviewer requested 4 seams, developer requested 4 seams → 8 raw requests
2. Dedup key in `normalizeMissingSeams` = `symbolOrSeam|fetchHint` — but same
   method from different agents has different `fetchHint` text (reviewer says
   `"Method body"`, developer says long Russian description) → NOT deduplicated
3. After failed dedup: 8 entries survive, `maxItems = 4` → `.slice(0, 4)`
4. All scoped-method requests get priority=400 (equal) → tiebreak by insertion
   order → reviewer's 4 seams come first → developer's unique seams dropped
5. `MtfCalculationService#calculate` was the KEY missing seam — without it
   agents could not verify whether `calculate()` handles capacity release →
   `⚠️ Hypothesis` label → `patchSafeEligible=no`

**Fix plan (2 changes in `critique-expansion.js`):**

| Fix | File | What |
|-----|------|------|
| Dedup by symbolOrSeam only | `normalizeMissingSeams` | Change key from `symbolOrSeam\|fetchHint` to `symbolOrSeam` only. When duplicates merge, keep the entry with the most structured fetchHint. |
| Raise maxItems | `normalizeMissingSeams` | Raise from 4 to `min(uniqueSymbolCount, 8)`. Prevents artificial drop of valid unique requests. |

These are part of the Lever 3 Precision Batch (P0).

### Phase 2 Trigger Criteria

Move to Phase 2 only when:
- 10+ runs completed under Phase 1 routing;
- telemetry shows `critiqueSeamOverlap > 70%` (critique already names the seams
  that approval round 1 requests);
- no regressions in `PATCH_SAFE` rate on evidence-heavy tasks.

### Green Light

Phase 1 is approved for implementation. Scope:
1. Early Lever 3 trigger with quality threshold (after approval round 1)
2. No-material-progress stop condition (after approval round 2)
3. Reduce max approval rounds from 3 to 2
4. DA skip on diagnostic + no-fetchable-seams
5. Tester mode split (patch-validation vs diagnostic-review)
6. Telemetry collection for all 5 metrics listed above

Implementation owner: Codex (GPT-5).
Review: Claude Opus + Gemini CLI.

Post-approval implementation status:
- Phase 1 landed on `2026-03-17` and was refined on `2026-03-21`.
- Phase 2 slice 1 landed on `2026-03-22`: `revision` is skipped when approval disagreement is evidence-gap-only and seam expansion should happen first.
- Phase 2 slice 2 landed on `2026-03-22`: final trust and `result-warning.txt` now carry operator-visible failure taxonomy (`primaryFailureClass`, `failureClasses`, `failureSummary`) so end-state diagnostics surface the real failure shape directly.
- Latest live validation: `nornick` run `run-1774118745813` confirmed the revision-skip route end-to-end; the next live validation target should be chosen explicitly with the user, with `wattman/front` as the default second target.
