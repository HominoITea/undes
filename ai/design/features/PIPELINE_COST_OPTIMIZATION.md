# Pipeline Cost & Efficiency Optimization

Status: discussion
Priority: P1

## Why This Exists

The hub pipeline runs 14-15 LLM calls per baseline run (up to 25-35 with
Lever 3 and revision rounds). As the pipeline gains more features (Lever 3,
typed debate contracts, DA-revision), the per-run cost grows. This document
identifies concrete optimization opportunities that reduce cost without
sacrificing answer quality.

## Pipeline Snapshot (2026-03-15)

| Metric | Value |
|---|---|
| Agents | 7 (3 providers: Anthropic, Google, OpenAI) |
| Phases | 8 (pre-process → post-process) |
| LLM calls baseline | 14-15 |
| LLM calls max (Lever 3 + revisions) | 25-35 |
| Total context budget | 154K tokens |
| Context Pack per agent | 2-5KB (4-8% of budget) |
| Baseline cost per run | ~$0.82 |
| Worst case cost per run | ~$1.36 |
| Wall time | 40-90s baseline |

## Optimization Proposals

### 1. Prompt Caching (Anthropic)

Priority: P0
Complexity: Low
Estimated savings: -$0.15-0.25/run (-20-30% input cost)

**Problem:** Sequential Anthropic calls (prompt-engineer, architect) share the
same context prefix (system prompt, context pack, project metadata). Each call
re-sends the full prefix as new input tokens.

**Fix:** Enable Anthropic prompt caching. Cached prefix tokens cost ~10% of
full input price. For 2+ sequential Anthropic calls with shared prefix, this
saves ~90% input cost on the repeated portion.

**Implementation:**
- Add `cache_control` markers to the shared prefix in the API call builder
- No architecture change, no prompt change
- Provider-specific: only affects Anthropic agents

**Risk:** None. Prompt caching is read-only, deterministic, and does not
change model behavior.

### 2. Complexity-Based Routing

Priority: P1
Complexity: Medium
Estimated savings: -60% tokens on simple tasks (-$0.50/simple run)

**Problem:** Every task — from a typo fix to an architectural refactor — gets
the full 3-agent debate panel (architect + reviewer + developer). For trivial
tasks, 3 proposals + 3 critiques = 6 LLM calls of wasted budget.

**Fix:** Classify task complexity at pre-process time and route accordingly:
- `trivial` (typo, config, rename): 1 agent proposal, 1 critique, skip DA
- `standard` (feature, bug fix): 2 agents, normal flow
- `architectural` (refactor, new system): full 3-agent panel

**Implementation:**
- Extend prompt-engineer output with `complexity: trivial|standard|architectural`
- Add routing logic in orchestrator before proposal phase
- Preserve full panel as default for unknown/unclassified tasks

**Risk:** Misclassification. A task classified as `trivial` that is actually
complex would get a weaker answer. Mitigation: default to `standard` on
uncertainty, allow operator override with `--full-panel`.

**Relationship:** Already in roadmap as `Complexity-Based Routing` (research).
This proposal provides the concrete MVP shape.

### 3. Conditional Devil's Advocate Skip

Priority: P2
Complexity: Low
Estimated savings: -$0.10-0.15/clean run

**Problem:** Devil's Advocate runs on every run, even when all approval agents
gave 9-10/10 and unanimously agreed. In these cases, DA rarely finds anything
actionable — the answer is already well-grounded.

**Fix:** Skip DA when:
- `allAgreed === true`, AND
- `avgApprovalScore >= 9`

Still run DA when any approval round had disagreement or low scores.

**Implementation:** ~4 lines of conditional logic before DA invocation.

**Risk:** Low. High-confidence unanimous approval is a strong signal. If a
subtle issue slips through, it would likely also slip through DA at 9+
confidence. The evidence-grounding gate catches hallucinations independently.

### 4. Conditional Tester Skip for DIAGNOSTIC Results

Priority: P2
Complexity: Low
Estimated savings: -$0.08-0.10/diagnostic run

**Problem:** The tester (post-process) generates test cases and validates the
result. But for DIAGNOSTIC results there is no patch code to test. The tester
produces generic test suggestions that the operator cannot apply.

**Fix:** Skip tester when `resultMode === 'DIAGNOSTIC'`.

**Implementation:** ~4 lines of conditional logic before tester invocation.

**Risk:** Minimal. DIAGNOSTIC results explicitly state they are not
implementation-ready. Test generation for non-existent code adds no value.

### 5. Skip Prompt Enhancement on Reruns

Priority: P2
Complexity: Low
Estimated savings: -$0.06/run, -3-5s latency

**Problem:** When the operator reruns the same prompt (e.g., after Lever 3
expansion or context changes), prompt-engineer re-enhances the exact same text.
The enhanced prompt is identical to the previous run.

**Fix:** Add `--skip-enhance` flag. For reruns, detect if the prompt matches
the previous run's input and skip enhancement automatically. Also useful for
operators who write precise prompts and do not want LLM rewriting.

**Implementation:**
- Add CLI flag `--skip-enhance`
- Optionally: hash-compare prompt against last checkpoint
- Pass original prompt directly to proposal phase

**Risk:** None. Operator opt-in.

### 6. Reduce maxApprovalRounds from 3 to 2

Priority: P2
Complexity: Low (config change)
Estimated savings: -3 LLM calls in worst case (-$0.20/worst run)

**Problem:** `maxApprovalRounds=3`. If the first approval round scores low,
revision happens and round 2 runs. If round 2 also fails, round 3 usually also
fails — the problem is in the content quality, not scoring calibration.

**Fix:** Set `maxApprovalRounds=2`. If 2 rounds cannot converge, fall back to
DIAGNOSTIC immediately.

**Risk:** Slight reduction in revision opportunity. Mitigated by: Lever 3
expansion addresses the real cause (missing evidence), not more approval loops.

### 7. Decompose generate-context.js

Priority: P1
Complexity: Medium
Estimated savings: 0 (cost), significant (dev velocity)

**Problem:** The main orchestrator is 6750 lines in one file. It contains:
pipeline control flow, trust assessment, context pack integration, telemetry,
checkpoint logic, file I/O, Lever 3 expansion, approval parsing, DA logic.
Every feature addition risks unintended side effects.

**Fix:** Extract cohesive modules:
- `trust-assessment.js` — grounding gate, evidence validation, finalTrust
- `critique-expansion.js` — Lever 3 logic, seam resolver, expansion round
- `pipeline-orchestrator.js` — main phase sequencing and control flow

**Risk:** Refactoring risk. Mitigated by: existing test suite (397 tests),
incremental extraction (one module at a time), no behavior change.

**Relationship:** This is an enabler, not a feature. Every future feature
(Stack-Aware Skills, Complexity Routing, Lever 4) becomes cheaper to implement
after this decomposition.

## Savings Summary

| Scenario | Current cost | After optimizations | Savings |
|---|---|---|---|
| Simple task (routing) | ~$0.82 | ~$0.30 | -63% |
| Standard + prompt cache | ~$0.82 | ~$0.57-0.65 | -20-30% |
| Clean run (skip DA+tester) | ~$0.82 | ~$0.62 | -24% |
| Worst case (all rounds) | ~$1.36 | ~$1.05 | -23% |

## What Should NOT Be Optimized

1. **Number of providers.** 3 providers = diversity of thought. This is product
   value, not waste.
2. **Multi-agent debate for complex tasks.** 3 agents produce better answers
   than 1 on architectural questions. Do not reduce.
3. **Evidence-grounding checks.** Heuristic, 0 LLM cost. Free quality gate.
4. **Structural search.** 200-500ms, 0 LLM cost. Pure win.

## Recommended Implementation Order (after Lever 3)

1. Prompt caching (P0) — cheapest to implement, highest ROI
2. Complexity routing (P1) — biggest savings, needs classifier
3. Skip DA/tester conditionally (P2) — quick wins, ~4 lines each
4. Decompose orchestrator (P1) — no cost savings, accelerates all future work
5. Skip enhance / reduce approval rounds (P2) — operator polish

## MVP Risk Debt

- **Assumption:** Complexity classification by prompt-engineer is reliable.
  - **Why accepted:** prompt-engineer already analyzes the prompt; adding a
    complexity field is a natural extension.
  - **User/operator risk:** misclassification → weaker answer on complex task.
  - **Revisit trigger:** operator reports that a routed-to-trivial task needed
    full panel.
  - **Exit path:** default to `standard` on uncertainty; operator override.

- **Assumption:** Skipping DA on high-confidence runs is safe.
  - **Why accepted:** avgApprovalScore >= 9 AND allAgreed=true is a very strong
    signal; evidence-grounding gate catches hallucinations independently.
  - **User/operator risk:** subtle issue in a confident-looking answer.
  - **Revisit trigger:** any PATCH_SAFE result with a post-deployment bug where
    DA skip was active.
  - **Exit path:** remove DA skip, or lower the threshold.

## Open Questions For Discussion

1. Should prompt caching be enabled by default, or opt-in?
2. For complexity routing, should the operator be able to force full-panel mode
   even after trivial classification?
3. Should DA skip threshold be configurable per project?
4. Is maxApprovalRounds=2 too aggressive, or should it be configurable?
5. Should orchestrator decomposition happen before or after Lever 3 lands?

## Discussion

(Open for Codex, Gemini CLI, and Claude responses.)
