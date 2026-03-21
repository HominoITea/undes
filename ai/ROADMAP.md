# AI System Roadmap

This roadmap is intentionally brief.

It is only for:
- future features
- current priorities
- links to detailed design docs

Detailed design lives in:
- `ai/design/features/README.md`

Historical detailed roadmap snapshot lives in:
- `ai/design/archive/ROADMAP_DETAILED_20260310.md`

> **Important:** As of 2026-03-01, `ai-hub-coding` is the sole active project.
> The original `node-ai` project is legacy-only.

## Planning Tracks

- **OSS Core Track:** this file tracks public engineering work that belongs in the open-source core.
- **Shared Architecture Enablers:** features may stay in this file if they are useful in OSS on their own and also enable future paid add-ons via generic extension points, plugin hooks, adapter interfaces, or runtime contracts.
- **Commercial Add-on Track:** detailed paid-feature planning, pricing, customer packaging, and private-integration sequencing must live outside the public OSS roadmap. Current internal working docs live in `docs/commercialization/` only while the repository is private and must move to a private planning surface before public OSS release.

## Track Tags

- `core` = standalone OSS feature with direct end-user value
- `shared-enabler` = OSS-safe architectural layer that also enables future add-ons
- commercial-private planning does **not** belong in this file

## Current Priority Order

1. Pilot on a real project
   Link: `ai/PILOT_RUNBOOK.md`
   Status: baseline met globally (`8` completed real runs, `6` saved quality ratings); a later `<TARGET_PROJECT>` rerun also completed successfully on `2026-03-13`, and further post-baseline extension is currently blocked by Anthropic billing, not by a hub runtime defect

2. Pipeline Hardening (Quick Wins)
   Link: `ai/design/features/PIPELINE_HARDENING.md`
   - Per-provider rate limit snapshot (instead of per-agent)
   - Truncation detection + bounded repair-pass for partial successful outputs
   - Heuristic critique scoring (rule-based, no ML)
   Status: MVP complete (Batches 1-4 landed; heuristic critique scoring remains optional follow-up if kept)

3. Adaptive Runtime Control & Predictive Budgeting
   Link: `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
   - Honest effective-limits summary
   - Checkpoint fingerprint includes runtime settings
   - Heuristic forecast first, calibrated forecast later
   - Runtime overrides between phases
   Status: MVP complete (Batches 1-5 landed; a live `<TARGET_PROJECT>` rerun has already completed; conservative auto-raise for `maxOutputTokens` now applies per agent/stage with telemetry; the next validation step is a post-MVP rerun once provider balance/workload permits)

4. Phase Contract Normalization
   Link: `ai/design/features/PHASE_CONTRACT_NORMALIZATION.md`
   Status: in progress (approval-only MVP, evidence-aware approval scoring, and typed debate contracts are landed; wider normalization still deferred until after pilot; any rebuttal round remains optional and deferred until validation proves it is needed)

5. Local Memory MVP
   Link: `ai/design/features/LOCAL_MEMORY_MVP.md`
   Status: MVP complete (SQLite + FTS5 + Markdown landed; typed entries `fact/decision/episode`; pre-run recall, post-run auto-save, and manual save/search commands are available)

6. DevSecOps Reviewer
   Link: `ai/design/features/DEVSECOPS_REVIEWER.md`
   Status: discussion (consensus mostly closed; implementation deferred behind current pilot/runtime blockers)

7. Stack-Aware Dynamic Skills
   Link: `ai/design/features/STACK_AWARE_DYNAMIC_SKILLS.md`
   Status: planned

8. Documentation Compiler + Spec-First Dossier Layer
   Link: `ai/design/features/DOCS_PIPELINE.md`
   Status: design-review

9. Repository Structure Rationalization
   Link: `ai/design/features/STRUCTURE_RATIONALIZATION.md`
   Status: complete (migration window closed, transitional tooling removed)

## Next Steps

1. `core` - Expanded structural extraction window validation
   Status: landed and validated as a partial success. Two reruns on the same `<TARGET_PROJECT>` prompt improved seam reach beyond the original narrow method slice, but both still ended with `groundingGapCategories=substantive-assumptions` and `patchSafeEligible=no`.
   Outcome: keep the wider same-file structural slice; do not widen it further by default.
   Decision record: `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md` → "Validation Outcome (2026-03-15)"

2. `core` - Critique-driven seam expansion (formerly Lever 3)
   Goal: let critique/approval stages request only the missing seams that still block patch-safe grounding after the expanded keyhole pass.
   MVP shape: bounded expansion rounds, structured missing-seam requests, deterministic structural fetch only, then focused revision rounds for proposal/critique plus synthesis/approval on the expanded evidence set.
   Landed fixes (2026-03-18):
   - Dedup key fix: `normalizeMissingSeams`, `toSeamKey`, `buildApprovalSeamKey` all dedup by `symbolOrSeam` only (not `fetchHint`). Same method from different agents is now correctly deduped.
   - Hard cap removed: `DEFAULT_MAX_MISSING_SEAMS` eliminated. All unique seams pass through; context size controlled by `maxAppendixBytes`. User can still override via `critiqueExpansionMaxRequests` config.
   - Provider overflow resilience: OpenAI/Gemini `finish_reason: length` with empty response returns gracefully instead of crash. Anthropic logs warning. Gemini `MALFORMED_FUNCTION_CALL` → retryable error (up to 3 retries). Gemini `SAFETY`/`BLOCKED` → explicit non-retryable.
   - Parallel agent resilience: `Promise.all` → `Promise.allSettled` in `runAgentsWithProviderLimit`. One agent crash no longer kills the parallel group. Pipeline fails only if ALL agents fail; otherwise warns and continues with partial results.
   - Seam expansion graceful degradation: any recoverable error (timeout, rate limit, network, truncation) breaks out of expansion loop and continues with pre-expansion result instead of killing the pipeline.
   - File read safety: `readBoundedRange`/`readBoundedRangeAroundToken` catch file read errors and return null.
   - Owner-body fallback: when scoped method not in AST index and token search fails but owner class IS in index, reads the owner class body. Captures DTOs, small classes with unindexed fields/getters.
   - Getter/setter token variants: `buildTokenVariants()` tries `get`/`set`/`is` prefixed forms. `readBoundedRangeAroundTokenVariants()` reads file once for all variants (no repeated I/O).
   - Agreed+seams gate: seam expansion triggers even when agents agree if substantive assumptions remain with fetchable seams.
   - Output sanitization: fixed `\b` after Cyrillic (doesn't work in JS), `## Логи` (h2) header, standalone `=== AI_PLAN_LOG ===` blocks in code fences, `runs\run-XXXXX` path references.
   - Renamed: all `Lever 3` / `lever3` identifiers → `Seam Expansion` / `seamExpansion` across code and user-facing output.
   - Seam expansion checkpoint: post-expansion consensus saved as checkpoint (`post-expansion-N.txt`). On resume, consensus loads post-expansion version.
   - DA-revision graceful fallback: if synthesizer fails on DA-revision (output length limit), keeps pre-DA consensus result instead of crashing.
   - 455 tests pass.
   Validation status: needs live rerun on nornick to confirm all fixes resolve seam loss + crash resilience.
   Post-MVP improvements landed:
   - Discussion log windowing: bounded at 120KB, oldest entries dropped with truncation header (5 tests added, 460 total).
   - Approval repair checkpoint: `repaired` flag persisted in checkpoint metadata per agent per approval round.
   - loadRun() caching: mtime-based in-memory cache eliminates redundant run-flow.json reads (4 tests added, 464 total).

3. `shared-enabler` - Orchestrator Tech Debt Reduction
   Goal: reduce implementation risk before the next major quality feature and before the second validation wave.
   Immediate batch: decomposition of `generate-context.js` complete (Batches 1-11). Nineteen extraction modules landed:
   - Batch 1: `ai/scripts/domain/final-result-trust.js` (final trust / result-artifact helpers)
   - Batch 2: `ai/scripts/runtime-overrides.js` (runtime overrides / phase pacing)
   - Batch 3: `ai/scripts/infrastructure/retry.js` (retry logic), `ai/scripts/domain/forecast.js` (risk forecast), `ai/scripts/domain/config-validation.js` (config validation)
   - Batch 4: `ai/scripts/domain/operational-signals.js` (signal recording, 16 fns), `ai/scripts/domain/seam-decision.js` (seam expansion decisions, 10 fns), `ai/scripts/domain/runtime-display.js` (UI/display helpers, 6 fns)
   - Batch 5: `ai/scripts/infrastructure/rate-limit.js` (rate-limit header parsing, token estimation, 9 fns + 1 constant)
   - Batch 6: `ai/scripts/domain/text-utilities.js` (10 fns), `ai/scripts/domain/output-artifacts.js` (9 fns)
   - Batch 7: `ai/scripts/domain/agent-config.js` (15 fns: env parsing, scoped config, agent enablement, rate-limit buckets)
   - Batch 8: `ai/scripts/infrastructure/file-operations.js` (10 fns: detectLanguage, redact, loadAiEnv, readFile, tree/git/walk)
   - Batch 9: `ai/scripts/domain/metrics-tracking.js` (5 fns: createMetricsState, trackAgentCall, buildMetricsReport, print, save)
   - Batch 10: `ai/scripts/domain/operational-signals-snapshot.js` (3 fns), `ai/scripts/domain/prompt-content.js` (24 fns: all prompt builders, parsers, utilities)
   - Batch 11: `ai/scripts/domain/context-bundle.js` (8 fns: context transforms, provider profiles, result caching), `ai/scripts/domain/memory-context.js` (7 fns: memory digests, project memory sections, context caching, limits), `ai/scripts/infrastructure/io-wrappers.js` (10 fns + factory: context header, secrets, file reading, agents config, prompt reading, runtime args, task ID), `ai/scripts/domain/bootstrap.js` (11 fns: CLI args, project path resolution, layout validation, state factories/resets)
   Result: `generate-context.js` reduced from ~7079 → 4636 lines (cumulative -2443 lines, -34.5%). `getProviderName`/`getProviderLabel` also moved to `infrastructure/providers.js`.
   Why now: Claude review correctly called out monolith growth as the main maintainability risk. The quality stack is already feature-rich enough that another major addition on top of the current orchestrator shape is riskier than a focused decomposition pass.

4. `shared-enabler` - Bootstrap prompt-file scaffolding parity
   Goal: remove the current UX/documentation gap where `ai:init` and hub project scaffolding create `.ai/prompts/` but do not create `.ai/prompts/prompt.txt`, even though runtime supports it as the default manual prompt surface.
   Scope: decide and implement one explicit contract: either scaffold an empty/template `prompt.txt` during bootstrap, or document clearly that operators must create it manually or use `--prompt` / `--prompt-file`.
   Why later: this is operator-facing polish / documentation debt, not a blocker for current pilot or answer-depth validation.

5. `shared-enabler` - Second validation case preparation
   Goal: prove that the current answer-depth stack generalizes beyond the original `<TARGET_PROJECT>` Java workflow.
   Offline scope while balances are exhausted:
   - choose a materially different case type
   - prepare prompt, starting seams, success criteria, and expected grounded seams
   - wire the case into local fixtures / validation manifests where possible
   Exit condition: when balances return, the same stack can be rerun on both the original case and the second case without additional planning work.
   Current prepared case: `backend-java-lifecycle-sync` for `<SECOND_VALIDATION_PROJECT>`, recorded in `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md` and `ai/specs/answer-depth-validation-cases.json`. Wired into `golden-manifest.json` as `status: "pending"` entry; regression harness skips pending cases. Activated when live run artifacts are available.

6. `shared-enabler` - Offline validation harness + quota-aware runtime hardening
   Goal: keep answer-depth validation moving while pilot providers are quota-limited.
   Landed now: provider quota exhaustion detection avoids wasteful retries, `run-artifact-summary.js` can summarize old runs, partial runs now autodiscover `run-flow.json` and classify failure shape (`provider_length` vs `quota_exhausted`), a golden-case regression harness compares local `narrow / broadened / targeted-*` fixtures offline, and provider fetch now has timeout protection.
   What still makes sense before balances return:
   - salvage more historical runs into offline summaries only if they add a genuinely new failure shape
   - prepare operator comparison views for the second validation case
   - record and tune conservative auto-raise gaps when live pilots still truncate on long proposal turns; the `2026-03-17` `nornick` pilot showed that adaptive `maxOutputTokens` did trigger, but `reviewer proposal` still failed at `MAX_TOKENS` and the bounded `1024`-token repair pass did not recover
   - avoid new quality levers until the second case is ready

7. `shared-enabler` - Round Orchestration Rationalization
   Goal: reduce token waste from low-value approval/revision chatter and move deterministic seam fetch earlier in the run.
   Status: Phase 1 landed (2026-03-17). Early seam expansion trigger after approval round 1 with quality threshold, max 2 approval rounds, no-material-progress stop condition, DA skip on diagnostic + no-fetchable-seams, Tester mode split (patch-validation vs diagnostic-review), and all 5 telemetry metrics collecting. Phase 2 gated by `critiqueSeamOverlap > 70%` over 10+ runs.
   Next: live validation on `nornick` and `plta-document-flow` to confirm routing improvements and collect Phase 1 telemetry baseline.
   Design discussion: `ai/design/features/ROUND_ORCHESTRATION_RATIONALIZATION.md`

8. `shared-enabler` - Semantic Context Bridge
   Goal: enrich the symbol index with outline, container ownership, param/return types, and call graph (all from tree-sitter, no IDE required). Formalize context levels (L0 outline / L1 target bodies / L2 expanded). Auto-detect project stack at init. Expected: -40-60% tokens per run, +30-50% context precision.
   Status: in-progress. Batch 1 landed: canonical `.ai/stack-profile.json`, derived `ai/llms.md`, deterministic stack detection, questionnaire/CLI overrides for empty projects. Batch 2 landed: AST-backed outline + container enrichment in `.code_index.json`, trust labels (`exact-ast` / `regex-fallback`), virtual containers for functional TS/JS, and scope-safe regex fallback outline. Batch 3 landed: formal L0/L1/L2 context levels in `context-pack.js`, prompt-based level routing, small-file full-body heuristic, and L2 dependency-body expansion. Batch 4 landed: seam expansion in `critique-expansion.js` now consumes enriched ownership via `container` metadata, resolves `Class#method` even when the owner symbol is absent, and disambiguates duplicate method names inside one file by container before falling back to older owner/token heuristics. Batch 5 landed: signature detail in the code index (`params`, `returnType`, `visibility`, `isAsync`, `isStatic`) for TS/JS, Python, Java, C#, and Go, plus index format bump to `version: 4` so older cached symbols without signature metadata are not silently reused. Batch 6 landed in guarded first-wave mode: bounded `callEdges` with trust `approx-ast`, typed-first extraction for Java/C#/Go/Rust, L2 dependency expansion only for unambiguous calls, index format bump to `version: 5`, and dynamic-language call-graph expansion still disabled by default in MVP. Offline validation on `nornick` confirmed real Java call-edge generation (`832` `callEdges` over `8809` file/ref edges, within the `<= 3x` budget) and observable L2 pack deltas on sampled prompts, but the effect is still modest because the legacy file/ref graph often already covers the same dependencies.
   Design doc: `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
   Implementation batches: 6 (stack-profile → outline+container → L0/L1/L2 → seam precision → signature detail → call graph)
   Key decisions: .ai/stack-profile.json as source of truth, virtual containers for functional JS, small-file heuristic (< 150 lines → full body), call graph disabled for dynamic languages in MVP

9. `shared-enabler` - Grep-AST Structural Search precision tuning after seam expansion
   Goal: tune structural fetch quality for critique-driven expansion and later-stage precision. Do not widen the initial extraction window again unless seam expansion data shows a remaining same-file context gap.

10. `shared-enabler` - Senior-Developer Skepticism Model (Levers 6-8)
   Goal: extend answer-depth with context completeness assessment, domain-aware impact severity, and mid-debate targeted verification. Long-term direction documented in `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`.

11. `core` - Stack-Aware Dynamic Skills
   Goal: start the next major OSS core capability once the current answer-depth seam has a validated direction.

## Active Future Features

| Priority | Track | Feature | Status | Short note | Design doc |
|---|---|---|---|---|---|
| P0 | `core` | Real-project pilot | baseline-met | Aggregate pilot baseline captured across real projects (`8` runs / `6` ratings); later `<TARGET_PROJECT>` reruns, including the `2026-03-13` post-MVP validation run, completed successfully. The next issue is answer trust / grounding quality, not pilot viability. | `ai/PILOT_RUNBOOK.md` |
| P0 | `core` | Pipeline Hardening (Quick Wins) | mvp-complete | 4-batch hardening MVP landed; optional heuristic critique scoring may be handled separately | `ai/design/features/PIPELINE_HARDENING.md` |
| P0 | `shared-enabler` | Adaptive Runtime Control & Predictive Budgeting | mvp-complete | Batches 1-5 landed, plus operator polish: honest limits/warnings, runtime-settings-aware checkpoint fingerprint, heuristic forecast, operational signal recording, calibrated forecast from recent run history, runtime-scoped overrides, conservative per-stage `maxOutputTokens` auto-raise with telemetry, operator template/aliases, and project-type-aware warning cleanup | `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md` |
| P0 | `core` | Evidence-Grounded Patch Mode | mvp-complete | Final-answer trust layer landed: explicit patch-safe vs diagnostic result modes, evidence binding, assumption segregation, heuristic symbol/seam validation, and strict `patch-safe-result.md` artifact when the gate passes. Post-MVP enhancement (2026-03-17): added `## Assumed Implementation` section to the output contract so results always contain code — grounded code in `Grounded Fixes`, best-effort code in `Assumed Implementation` with `Assumption:` labels. Trust gate unchanged (evaluates only Grounded Fixes). | `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md` |
| P1 | `shared-enabler` | Phase Contract Normalization | in-progress | Keep text/JSON split and normalize phase families and artifact semantics; approval-only MVP, evidence-aware approval scoring, and typed debate contracts are landed, while broader normalization remains deferred until after pilot. Any rebuttal round stays optional until live validation proves it is needed. | `ai/design/features/PHASE_CONTRACT_NORMALIZATION.md` |
| P1 | `core` | Local Memory MVP | mvp-complete | SQLite + FTS5 + Markdown landed; typed entries (`fact`, `decision`, `episode`), pre-run recall, post-run auto-save, and `ai:memory:save/search` commands now exist | `ai/design/features/LOCAL_MEMORY_MVP.md` |
| P2 | `core` | DevSecOps Reviewer | discussion | Conditional infra/security/deploy reviewer; structured critique role for Docker/K8s/Terraform/CI/CD/secrets-related tasks; consensus mostly closed, MVP semantics for `block` stay informational-only for now | `ai/design/features/DEVSECOPS_REVIEWER.md` |
| P1 | `core` | Answer Depth Improvement | in-progress | Structural-search adapter, Context Pack expansion, precision-tuned seam expansion, dedup fix, hard cap removal, provider overflow resilience, parallel agent resilience (`Promise.allSettled`), Gemini `MALFORMED_FUNCTION_CALL` retry, owner-body fallback for unindexed methods, getter/setter token variants, agreed+seams gate fix, output sanitization hardening (`## Логи`, AI log blocks, Cyrillic `\b` fix), graceful degradation on expansion errors, two bounded `generate-context.js` decomposition slices, and `Lever 3` → `Seam Expansion` rename are all landed (454 tests). Live validation improved the same `<TARGET_PROJECT>` case to `PASS_WITH_NOTES 7/10`, but one `substantive-assumptions` gap still blocks `patchSafeEligible=yes`. Deferred: seam expansion checkpoint, discussion log windowing, approval repair checkpoint, loadRun() caching. | `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md` |
| P1 | `shared-enabler` | Grep-AST Structural Search | in-progress | Adapter, preferred-by-default `ast-grep` backend, runtime diagnostics, safe fallback, Context Pack integration, A/B validation, and expanded skeleton extraction are landed. The remaining tuning target is precision for seam expansion fetches: prefer method/range seams and avoid class-header fallback when approval requests are narrower. | `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md` |
| P1 | `shared-enabler` | Semantic Context Bridge | in-progress | Batches 1-6 landed for the Level A scope: stack-profile bootstrap, AST/regex outline+container enrichment, formal L0/L1/L2 context levels, container-aware seam lookup in critique expansion, signature detail, and guarded first-wave callEdges (`approx-ast`, L2-only, unambiguous resolution, Java/C#/Go/Rust only). Offline validation on `nornick` produced `832` Java call edges and some real L2 pack deltas, but the incremental gain is still modest because file/ref edges already cover many of the same seams. Next: decide whether L2 should prefer precise `callEdges` over broad name-based ref expansion before any wider call-graph or LSP rollout. | `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md` |
| P1 | `shared-enabler` | User Outcome Feedback Loop | planned | Structured 1-5 outcome rating after applying hub result, optional git diff capture, trust calibration report, ground truth pairs for future local model fine-tuning | `ai/design/features/USER_OUTCOME_FEEDBACK.md` |
| P1 | `shared-enabler` | Patch-Based Learning Loop | planned | Structured fix documents in `.ai/patches/`; auto-inject into context by tags | — |
| P1 | `core` | Stack-Aware Dynamic Skills | planned | Generate project-scoped role profiles from detected stack | `ai/design/features/STACK_AWARE_DYNAMIC_SKILLS.md` |
| P1 | `shared-enabler` | Docs Pipeline + Spec-First Dossier | design-review | Compile local canonical docs; feature dossier as upstream for all agents | `ai/design/features/DOCS_PIPELINE.md` |
| P2 | `shared-enabler` | Selective Hashline Edit Mode | research | Anchor-based editing as fallback after failed str_replace; per-provider fallback matrix | — |
| P1 | `shared-enabler` | Pipeline Cost & Efficiency Optimization | discussion | Prompt caching (P0), complexity routing (P1), conditional DA/tester skip (P2), orchestrator decomposition (P1). Full audit by Claude Opus 2026-03-15. | `ai/design/features/PIPELINE_COST_OPTIMIZATION.md` |
| P1 | `shared-enabler` | Round Orchestration Rationalization | phase-1-landed | Phase 1 landed: early seam expansion trigger, max 2 approval rounds, no-material-progress stop, DA skip gate, Tester mode split, telemetry collecting. Phase 2 gated by critiqueSeamOverlap >70% over 10+ runs. | `ai/design/features/ROUND_ORCHESTRATION_RATIONALIZATION.md` |
| P2 | `shared-enabler` | Complexity-Based Routing | research | Trivial/standard/architectural task classification; reduced panel for simple tasks. Now part of Pipeline Cost Optimization as proposal #2. | `ai/design/features/PIPELINE_COST_OPTIMIZATION.md` |
| P2 | `shared-enabler` | Provider-Aware Agent Scheduling | research | Parallel execution across providers; sequential within same provider with preflight gating | — |
| P2 | `shared-enabler` | Repository Structure Rationalization | complete | Migration window closed; transitional tooling removed | `ai/design/features/STRUCTURE_RATIONALIZATION.md` |
| P2 | `shared-enabler` | Matrix Agent Mode | research | Opt-in high-cost ensemble mode for critical tasks | `ai/design/features/MATRIX_AGENT_MODE.md` |
| P2 | `shared-enabler` | Hybrid Orchestration Mode | research | Local/shared router, memory, and model gateway | `ai/design/features/HYBRID_ORCHESTRATION_MODE.md` |
| P2 | `shared-enabler` | Performance Acceleration Pack | research | Next optimization wave after current pipeline hardening | `ai/design/features/PERFORMANCE_ACCELERATION_PACK.md` |
| P2 | `shared-enabler` | Cloud Frontier Quality Program | research | Improve cloud-model reliability via contracts, evidence, and telemetry | `ai/design/features/CLOUD_FRONTIER_QUALITY_PROGRAM.md` |
| P2 | `shared-enabler` | Language-Aware Arch Check | discussion | Make architecture-check.js language-aware (currently Rust-only); add JS profile; later share project-type detection with Adaptive Runtime Control if needed | `ai/design/features/LANGUAGE_AWARE_ARCH_CHECK.md` |
| P2 | `shared-enabler` | Log & Context Growth Management | discussion | Strategy for managing indefinitely-growing log files and run archives. Context bundle is already protected (log window: 10 entries / 9KB, memory: 8 entries / 6KB, total bundle cap 250KB). Disk-side risks: `ai/logs/AI_*.md` files append forever, run archive `.ai/prompts/runs/` grows per-run (manual `ai:clean` only). Options under consideration: automatic log rotation (archive entries older than N days), run archive auto-prune (keep last N runs, auto-trigger), per-project disk budget with warnings. Not urgent — current bundle is ~23KB, well under limits. | — |
| P3 | `core` | Operator TUI/UI Layer | research | Explicit context list, visual diff review, pending changes buffer, realtime token meter | — |

## Roadmap Rules

- Keep this file short.
- Do not store long design debates here.
- Put detailed feature design into `ai/design/features/`.
- If a feature is completed or becomes historical-only, move its long-form detail to archive or rely on logs/changelogs.
- Commercial planning lives in `docs/commercialization/commercial-roadmap.md`, not in this file.
- This file may include shared architecture enablers for future paid add-ons only when they provide standalone OSS value and do not leak proprietary scope.
- Paid add-ons must not land in this repository; use `docs/commercialization/COMMERCIAL_ADDON_BOUNDARY.md` as the boundary policy.

## Related References

- Design index: `ai/design/README.md`
- Feature design index: `ai/design/features/README.md`
- Pilot runbook: `ai/PILOT_RUNBOOK.md`
- Commercial roadmap: `docs/commercialization/commercial-roadmap.md`
- OSS/commercial boundary: `docs/commercialization/COMMERCIAL_ADDON_BOUNDARY.md`
- Historical detailed roadmap snapshot: `ai/design/archive/ROADMAP_DETAILED_20260310.md`
- Change history: `UNIFIED_MODEL_CHANGE_LOG.md`
