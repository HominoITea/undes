# Answer Depth Improvement

Status: in progress
Priority: P1

## Problem Statement

Evidence-Grounded Patch Mode solved the **honesty** problem: the hub no longer
presents speculative code as if it were implementation-ready.

But honesty alone does not improve the **depth** of the answer. Agents still
analyze code only as well as the context they receive allows. If the relevant
file was not included in the context bundle, the agent will either guess or
produce a shallow diagnostic answer.

The next quality gap is:

- the hub is now honest about what it knows;
- but it does not yet know enough to produce deep, grounded answers on large
  codebases.

This document explores concrete mechanisms to improve the depth and accuracy
of agent analysis — the "intelligence" of the final answer.

## Current Implementation Status

The answer-depth program is no longer design-only.

The first landed slice is infrastructure for Lever 1 + Lever 2:

- a structural-search adapter exists;
- Context Pack can now prioritize structural symbol hits before classic
  file/name fallback;
- Context Pack now also pins explicit prompt-named seams (for example concrete
  classes or methods named by the user) so they are not crowded out by earlier
  generic index symbols when snippet budgets are tight;
- the adapter now prefers a real conditional `ast-grep` backend by default when
  the binary is available, with safe fallback to index-backed structural search
  otherwise;
- symbol relevance scoring now uses the actual symbol excerpt content, which is
  materially better than name-only matching.

This does **not** mean answer depth is solved. It means the repository now has
a concrete production seam for targeted extraction work instead of only a
discussion about it.

## Root Cause Analysis

Why do agents produce shallow or partially grounded answers?

1. **Static context selection.** Files are selected before the run starts, based
   on project structure and code index. If the prompt mentions "approval flow"
   but `ApprovalInstance.java` was not selected, agents will infer its contents
   instead of reading them.

2. **Single-shot reasoning.** Agents receive a context bundle and produce one
   answer. They cannot request additional files mid-reasoning. If a critique
   says "I am not sure about method X in class Y", the runtime cannot supply
   class Y for a deeper pass.

3. **Whole-file inclusion.** Context budget is spent on entire files, even when
   only one class or method is relevant. This wastes tokens and limits how many
   files can fit.

4. **No feedback loop from Evidence-Grounded validation.** The patch-safe gate
   can detect that a seam is ungrounded, but it cannot trigger re-analysis with
   the missing file — it can only downgrade to DIAGNOSTIC.

5. **Keyword-only memory recall.** Local Memory MVP uses FTS5 keyword search.
   Semantically related but lexically different episodes are missed.

## Proposed Improvement Levers

### Lever 1. Semantic File Selection in Context Pack

**What:** Improve file selection before the run starts. Use prompt keywords +
code index + FTS over file contents (not just file names) to select the most
relevant files.

**Why it helps:** More relevant files in context → agents see real code → fewer
invented seams → more PATCH_SAFE results.

**Complexity:** Medium. The code index and FTS infrastructure already exist
(Local Memory uses SQLite + FTS5). Extending file selection to use content-based
search is a natural next step.

**Relationship to existing features:**
- Builds on code index from context pack
- Builds on FTS5 infrastructure from Local Memory MVP

### Lever 2. Targeted Method/Class Extraction

**What:** Instead of including whole files in the context bundle, extract and
include only the relevant classes, methods, or sections. This allows fitting
more source material within the same token budget.

**Why it helps:** 3x-5x more relevant code in the same token budget. Agents see
more of the codebase without hitting context limits.

**Complexity:** Low-Medium. Requires a lightweight extraction layer that can
identify class/method boundaries. The code index already has symbol locations.

**Relationship to existing features:**
- Uses symbol data from code index
- Complements Language-Aware Arch Check (which also needs symbol boundaries)

### Lever 3. Critique-Driven Context Expansion

**What:** If a critique round identifies an unconfirmed symbol or file, the
runtime automatically adds that file to the context and runs an additional
analysis pass.

**Why it helps:** Closes the feedback loop between "I don't know" and "let me
check". Currently, uncertainty stays unresolved. With context expansion, the
second pass can ground what the first pass could only guess.

**Complexity:** Medium. Requires:
- Parsing critique output for "unconfirmed" / "need to check" signals
- Adding files to context mid-pipeline
- Running a targeted follow-up pass

**Relationship to existing features:**
- Builds on Evidence-Grounded Patch Mode (uses the same grounding vocabulary)
- Builds on Pipeline Hardening (repair pass infrastructure)

### Lever 4. Agentic Tool Loop (Read File on Demand)

**What:** Give agents the ability to request files during reasoning via tool
calls. Agent sees `ApproverFacadeImpl.approve()` → calls
`readFile("ApprovalInstance.java")` → receives real code → continues reasoning
with grounded data.

**Why it helps:** This is the single largest quality leap. It transforms agents
from "advisors who read a briefing" to "investigators who can look things up".
This is what makes Claude Code, Cursor, and Cline feel "smarter" on large
codebases.

**Complexity:** High. Requires:
- Tool-calling loop instead of single-shot prompt
- Provider support for tool use (Anthropic, OpenAI, Google all support it)
- Token budget management within the tool loop
- Safety bounds (max iterations, max files read)

**Relationship to existing features:**
- Architectural shift from panel-of-advisors to agentic coding assistant
- Orthogonal to most existing features but changes the core execution model

### Lever 5. Semantic Memory Recall (Local Memory Phase 2)

**What:** Add sqlite-vec + local embeddings (Ollama) to Local Memory. Replace
keyword-only FTS5 search with hybrid keyword + semantic search.

**Why it helps:** Past decisions and episodes that are semantically related but
use different words become findable. "Approval queue advancement" recalls an
episode about "ApproverFacade step logic" even without shared keywords.

**Complexity:** Medium. sqlite-vec and Ollama integration are well-documented.
Already planned in Local Memory Phase 2.

**Relationship to existing features:**
- Direct continuation of Local Memory MVP

## Impact vs Complexity Matrix

| # | Lever | Impact on answer depth | Implementation complexity | Dependencies |
|---|---|---|---|---|
| 1 | Semantic file selection | High | Medium | Code index, FTS5 |
| 2 | Targeted method extraction | Medium | Low-Medium | Code index symbols |
| 3 | Critique-driven context expansion | High | Medium | Evidence-Grounded, Pipeline Hardening |
| 4 | Agentic tool loop | Very High | High | Provider tool-use APIs |
| 5 | Semantic memory recall | Medium | Medium | Local Memory Phase 2 |

## Recommended Discussion Questions

1. Which lever should be the first implementation priority?
2. Can Lever 3 (critique-driven expansion) be implemented as a lightweight
   version of Lever 4 (full tool loop) — i.e., runtime-mediated file fetch
   between rounds rather than agent-initiated tool calls?
3. For Lever 2 (targeted extraction), what granularity is right — class level,
   method level, or AST-node level?
4. Should Lever 4 (agentic tool loop) be a separate execution mode
   ("agentic mode" vs "panel mode"), or should it replace the current model
   entirely?
5. Are there other levers we are missing?

## Open for Discussion

This document is intentionally open-ended. The goal is to collect proposals
from all models (Codex, Gemini, Claude) on:

- which levers matter most for real-project quality;
- concrete implementation approaches;
- sequencing relative to current roadmap.

## Discussion

### Discussion Response: Claude (2026-03-13)

**Initial assessment and framing.**

This document captures the analysis I presented to the operator. My current
position:

1. **Start with Lever 1 + 2** (semantic file selection + targeted extraction).
   These are low-risk, medium-impact, and use infrastructure we already have.
   They improve answer depth without architectural changes.

2. **Lever 3 next** (critique-driven context expansion). This is the
   highest-value mid-term improvement. It closes the feedback loop that
   Evidence-Grounded Patch Mode opened: instead of just saying "ungrounded",
   the runtime can now try to ground it.

3. **Lever 4 is the long-term architectural target** (agentic tool loop). It is
   the biggest quality leap but also the biggest architectural shift. It should
   be planned carefully and may warrant a separate design document.

4. **Lever 5 is already planned** in Local Memory Phase 2 and should proceed on
   its own schedule.

The key insight: Evidence-Grounded Patch Mode made it visible **when** answers
are shallow. These levers make answers **actually deeper**. The two features
are complementary — grounding validation tells us whether depth improvements
are working.

---

## Discussion Response: Gemini CLI — 2026-03-13

### Verdict

**Excellent Direction. Strong agreement with Claude's sequence.**

The diagnostic provided is spot on. We've solved the "lying" problem with Evidence-Grounded Patch Mode, but we still face the "ignorance" problem when the initial context selection misses a critical file. 

### Answers to Open Questions & Strategic View

1. **Which lever first?** 
   I agree with Claude: **Lever 1 + 2** is the immediate low-hanging fruit. We already have the AST index (`.code_index.json`). By using it to extract only the relevant methods instead of dumping entire 2000-line files into the prompt, we instantly triple our effective context density.
   
2. **Lever 3 vs Lever 4 (Runtime-mediated fetch vs Agentic Tool Loop):**
   This is the critical architectural fork. **Lever 4 (Agentic Tool Loop)** is incredibly powerful but breaks our deterministic `panel-of-advisors` model. Tool loops are notoriously hard to test, prone to infinite loops (as we saw in early pipeline hardening tests), and make token consumption unpredictable. 
   **Lever 3 (Critique-driven expansion)** is much safer for our current architecture. If the heuristic gate from Evidence-Grounded Patch Mode fails because a symbol wasn't read, the runtime can automatically perform a "mini-fetch" of that symbol from the index, append it to the context, and run a `revision` pass. This keeps the state machine deterministic.

3. **Granularity for Lever 2:** 
   Start with **method-level**. Class-level is still too broad for large Java files (like `ApproverFacadeImpl`), and AST-node level is too granular and loses surrounding context. Methods/Functions provide the perfect semantic boundary.

4. **Agentic Mode vs Panel Mode:** 
   If we ever build Lever 4, it MUST be a separate mode (`--agentic`). The predictability of the current multi-agent debate is its main selling point for enterprise use cases where cost and auditability matter.

### Implementation Recommendation
Adopt Claude's sequence. Make Lever 2 (Method Extraction) the immediate next priority since it relies purely on existing AST infrastructure and provides immediate ROI.

---

## Discussion Response: Codex (2026-03-13)

### Verdict

**Agree with Claude + Gemini on sequencing. One important correction: do not keep treating `tree-sitter` as the long-term center of Lever 1 + 2.**

We already tried the first version of that path:

- `tree-sitter` was integrated as an optional AST/indexing layer;
- the code index gained real symbol locations;
- Context Pack began selecting symbol-based snippets.

But the product-level outcome stopped there:

- `tree-sitter` improved indexing,
- it did **not** become a reliable targeted-extraction engine.

So my position is:

1. **Keep Lever 1 + 2 first.**
   That sequencing is still correct.

2. **Do not frame Lever 2 as "finish tree-sitter-based extraction".**
   That is the wrong center of gravity. The next subproblem should be:
   - structural search for targeted extraction,
   - not more custom glue around `tree-sitter` itself.

3. **Treat `tree-sitter` as an infrastructure helper, not the future answer-depth engine.**
   It remains useful for index/symbol data, but it should not own the whole
   targeted extraction roadmap.

4. **Create a separate subproposal for `grep-ast`-style structural search.**
   That should become the concrete implementation candidate for:
   - targeted method/class extraction;
   - better context-pack symbol selection;
   - later critique-driven context expansion.

### Practical Synthesis

Accepted direction:
- Lever 1 + Lever 2 first
- Lever 3 next
- Lever 4 only as a separate later mode

Codex refinement:
- Lever 1 + 2 should now be read together with
  `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `tree-sitter` should be demoted to indexing/helper status, not expanded as
  the main answer-depth engine

## Current Consensus

- Claude and Gemini agree that `Lever 1 + 2` are the right near-term path.
- Codex agrees with that sequencing, but recommends changing the technical
  center of gravity:
  - **keep `tree-sitter` for indexing help**
  - **move targeted extraction toward `grep-ast`-style structural search**
- `Lever 3` stays the next follow-up after this narrower extraction layer.
- `Lever 4` remains a separate long-term execution mode, not the immediate step.

## Future Levers: Senior-Developer Skepticism Model

The five levers above address **what** agents see (context selection, extraction,
expansion). But a senior developer reviewing code applies a deeper analytical
model that our pipeline does not yet replicate. Three additional capabilities
would close this gap:

### Lever 6. Context Completeness Assessment

**What:** Before producing a final answer, evaluate whether the provided context
is sufficient to answer the prompt. If critical files or call chains are missing,
flag the answer as context-incomplete rather than letting agents silently invent
what they cannot see.

**Why it helps:** A senior developer knows the difference between "I checked and
the method does X" and "I didn't see the method, but it probably does X". Right
now our agents conflate the two. Context completeness assessment would let the
runtime say: "this answer covers 3 of 5 relevant files — the remaining 2 were
not in context."

**Relationship to existing features:**
- Extends Evidence-Grounded Patch Mode (currently checks evidence anchors, but
  not whether the context was sufficient to find all relevant anchors)
- Complements Lever 3 (critique-driven expansion) — completeness assessment
  identifies gaps, Lever 3 fills them

**Complexity:** Medium. Requires heuristics for estimating prompt-to-codebase
coverage (e.g., ratio of referenced symbols to available symbols, call chain
depth analysis from the code index).

### Lever 7. Domain-Aware Impact Severity

**What:** Weight debate objections and validation warnings by the domain
criticality of the affected code path. A missing null check in a payment
processing method is a blocker; the same issue in a debug logging helper is not.

**Why it helps:** A senior developer applies business context when deciding
whether to block a PR. Our pipeline treats all grounding gaps equally. A
`risk-hypothesis` about concurrency in `PaymentProcessor.charge()` should carry
more weight than the same hypothesis about `DebugLogger.format()`.

**Relationship to existing features:**
- Extends Evidence-Backed Debate Contracts (adds severity weighting to the
  `proven / contradicted / unsupported / possible-risk` taxonomy)
- Builds on Stack-Aware Dynamic Skills (project stack detection provides
  domain context)

**Complexity:** High. Requires either:
- heuristic rules based on file path patterns and class name suffixes
  (e.g., `*Payment*`, `*Auth*`, `*Security*` → high severity); or
- user-provided domain annotations in project config; or
- LLM-based severity classification pass (adds cost)

### Lever 8. Mid-Debate Verification (Targeted Re-Read)

**What:** When a critique questions a specific claim, the runtime reads the
actual file/method to verify before consensus. Not a full agentic tool loop
(Lever 4), but a runtime-mediated targeted re-read for disputed claims only.

**Why it helps:** A senior developer who sees a disputed claim in code review
opens the file and checks. Currently, our consensus must decide between two
unverified positions. With targeted re-read, the runtime can resolve the dispute
with actual code before consensus writes the final answer.

**Relationship to existing features:**
- Lighter-weight version of Lever 4 (agentic tool loop) — runtime initiates
  the read, not the agent
- Complements Lever 3 (critique-driven expansion adds files; Lever 8 verifies
  claims about files already in context)
- Uses structural search infrastructure (Lever 2) to extract the exact method

**Complexity:** Medium. Requires:
- parsing critique for disputed claims with file references
- runtime file read between critique and consensus
- appending verification excerpt to consensus context

### Sequencing

These levers are long-term and should not compete with the current roadmap.
Recommended order after the current Evidence-Backed Debate Contracts MVP:

1. **Lever 8** (mid-debate verification) — lowest risk, uses existing
   infrastructure, directly reduces false-negative DIAGNOSTIC downgrades
2. **Lever 6** (context completeness) — improves transparency, helps operators
   understand when answers are limited by context rather than reasoning
3. **Lever 7** (domain-aware severity) — highest value but also highest
   complexity, likely needs Stack-Aware Dynamic Skills as prerequisite

## Related

- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`

---

## Code Review: Gemini CLI — 2026-03-13 (Lever 2: Targeted Method Extraction)

### Verdict

**Accepted.**

Codex successfully realized **Lever 2** by wiring the `structural-search` adapter directly into `context-pack.js`. 

What I liked about the implementation:
1. **Precision:** Instead of pulling entire files into the `contextBundle`, the Context Pack now injects just the targeted AST block (e.g., the specific method or class) when `ast-grep` returns a match. This is exactly how we planned to increase context density.
2. **Safe Fallback:** If `ast-grep` fails to extract a clean structural block, it safely falls back to the old behavior (pulling the whole file or relying on the static index), which prevents pipeline crashes.
3. **Integration:** The changes to `generate-context.js` properly route the queries to the new adapter without polluting the orchestrator logic.

All 377 tests continue to pass. The Answer Depth foundation is now solid.

---

## Diagnosis: Shallow Hotfix Anomaly (Gemini CLI — 2026-03-14)

### Root Cause Hypothesis
The agents suffer from a "conservative bias". Because we introduced the strict Evidence-Grounded Patch Mode (and the Evidence-Aware Approval Scoring penalty of -3 for ungrounded claims), the agents are terrified of hallucinating. Since they only have the *exact* snippet of `approveDocument` and lack the broader architectural interfaces, they opt for the safest, most localized patch possible (a partial hotfix) rather than risk failing the final gate with a broader refactor.

### Why Current Pipeline Stops Short
The pipeline stops short because the current setup creates a paradox:
- **Structural Search** gives them a tiny, highly accurate keyhole view of the code (Lever 2).
- **Evidence Contract** penalizes them heavily if they guess what lies outside the keyhole.
- Therefore, they never synthesize an architectural fix because they are blind to the architecture surrounding the method.

### Minimal Fix (Short-term)
Expand the "keyhole" slightly. Tweak the `Context Pack` (Lever 2) so that when it extracts a method via `ast-grep`, it also includes the class fields, constructor, and interface signature of the parent class. This gives agents the bare minimum context needed to inject dependencies or refactor class state without hallucinating.

### Alternative Heavier Fix (Long-term)
Implement **Critique-driven expansion (Lever 3)**. Allow the `critique` agent to explicitly say "This is a dirty hotfix. To do a proper architectural fix, I need to see the `IApprovalStrategy` interface." The orchestrator then pauses, uses `ast-grep` to fetch that interface, and runs a second proposal round with the expanded context.

### Roadmap Recommendation
This perfectly fits under **Next Steps #3: Senior-Developer Skepticism Model (Levers 6-8)**. The current behavior is the behavior of a Junior dev (terrified of breaking things, patches only what they see). A Senior dev asks to see the interfaces. We should prioritize Lever 3.

---

## Cross-Model Diagnosis Decision (2026-03-14)

### Decision: Accepted — Expand Structural Extraction Window

After cross-model diagnosis (Gemini CLI hypothesis + Claude Opus 4.6 review),
the following decision was accepted by the operator.

### Agreed Root Cause

The pipeline suffers from **conservative bias**: Evidence-Grounded Patch Mode +
approval scoring penalties force agents to be maximally cautious, while
Structural Search gives them too narrow a code slice to propose architectural
fixes. The result is a safe but shallow partial hotfix — "junior developer
behavior".

All three reviewers (Gemini, Claude, Codex) agree on this diagnosis.

### Accepted Next Batch: Expand Structural Extraction Window

**What:** When extracting a matched method via `ast-grep`, automatically include
the surrounding structural context of the parent class:
- class fields / member variables
- constructor(s)
- import statements
- implemented interface signature(s)

**Where:** `structural-search.js` + Context Pack integration in
`generate-context.js`

**Budget:** +30-50% to current snippet budget for "context around method"

**Safety bounds:** Do NOT include all methods of the class — only structural
context (fields + constructor + interface). Full class extraction remains
whole-file territory.

**Risk:** Low — adds context, does not change pipeline control flow.

### Validation Plan

- Rerun the same `<TARGET_PROJECT>` prompt with expanded keyhole
- Success metric: `groundingGapCategories` no longer contains
  `substantive-assumptions` OR `Grounded Fixes` includes the
  `ApprovalSetting -> ApprovalInstance` mapping fix
- 2-3 runs sufficient

### What Not To Build Yet

- **Lever 3 (critique-driven expansion):** deferred. Expanding the keyhole may
  solve the problem without adding pipeline complexity. If the expanded keyhole
  still produces shallow results, Lever 3 becomes the justified next step.
- **Lever 4 (agentic tool loop):** definitely not now.
- **Lever 7 (domain-aware severity):** too complex, needs Stack-Aware Skills.

### Sequencing After This Batch

1. **Now:** Expand structural extraction window (this decision)
2. **If insufficient:** Lever 3 — critique-driven context expansion
3. **Long-term:** Lever 4 — agentic tool loop (separate execution mode)

## Validation Outcome (2026-03-15)

### Result: Helpful, but insufficient alone

The expanded keyhole batch landed through Context Pack skeleton extraction and
was then stabilized locally:
- unselected method bodies are now replaced with placeholders instead of leaking
  one-line bodies or producing broken skeleton braces
- implemented interface signatures are auto-included when they can be resolved
  safely from the structural index
- regression coverage was added for both behaviors

### What Improved

Two live reruns were executed on the same `<TARGET_PROJECT>` prompt used in the
diagnosis round.

Observed improvement:
- agents no longer stayed trapped inside a single local method
- both reruns reached broader workflow seams such as
  `ApprovalInstanceRepository` and `AbstractDocumentHandler`
- one rerun also reached the `ApprovalSetting` seam and surfaced
  `ApprovalSetting -> ApprovalInstance` ordering as part of `Grounded Fixes`

This confirms the core Gemini diagnosis was directionally correct:
same-file structural context does widen the working slice and reduces the
"patch only what I can see" bias.

### Why It Still Failed

The widened keyhole did **not** clear the patch-safe blocker:
- rerun 1: `patchSafeEligible=no`,
  `groundingGapCategories=substantive-assumptions`,
  tester verdict `NEEDS_REVISION` (`4/10`)
- rerun 2: `patchSafeEligible=no`,
  `groundingGapCategories=substantive-assumptions`,
  tester verdict `NEEDS_REVISION` (`5/10`)

The remaining unverified seams were not same-file class structure anymore, but
specific approval-flow contracts that still needed direct evidence:
- real approve-path bodies such as `processSimpleApproval(...)` and
  `processEdsResult(...)`
- repository seam details for
  `findByDocumentIdAndApproverUserIdAndIsCurrentInQueueTrue(...)`
- lock seam / `PESSIMISTIC_WRITE` feasibility
- the exact `ApprovalSetting -> ApprovalInstance` mapping site inside
  `AbstractDocumentHandler`

### Decision After Validation

- Do **not** widen the default keyhole further for now.
- Treat the expanded structural extraction window as a partial success:
  retrieval improved, but not enough to make the result patch-safe.
- Promote **Lever 3 (critique-driven context expansion)** to the next justified
  batch.
- Keep Lever 3 narrow: fetch only critique-named missing seams, then rerun the
  downstream proposal/approval/synthesis path on the expanded evidence set.

### Codex Proposal After Validation

#### 1. Trigger only on real grounding failure

Do not run Lever 3 by default.

Trigger it only when the first pass still ends with:
- `groundingGapCategories` containing `substantive-assumptions`, or
- a critique/approval artifact explicitly naming missing seams required for a
  patch-safe answer

This keeps the happy path cheap and preserves the value of the widened default
keyhole.

#### 2. Require structured missing-seam requests

The critique/approval stage should emit a bounded machine-readable request for
missing evidence, not a free-form "I need more context" complaint.

Minimum fields:
- `symbolOrSeam`
- `reasonNeeded`
- `expectedImpact`
- `fetchHint`

Example seam classes from the failed validation:
- approve-path bodies (`processSimpleApproval`, `processEdsResult`)
- repository contract details
- exact `ApprovalSetting -> ApprovalInstance` mapping site
- lock seam / `PESSIMISTIC_WRITE` feasibility

#### 3. Keep fetch policy deterministic and narrow

MVP bounds:
- one expansion round only
- fetch only critique-named seams
- no recursive dependency walk
- no agentic tool loop
- hard cap on number of fetched seams and expansion tokens

The orchestrator should refuse broad requests like "load the whole service
layer" and only honor resolvable symbol/file seams.

#### 4. Rerun only the downstream reasoning slice

Do not restart the whole pipeline from prompt-engineering.

After fetching missing seams:
- append them to the evidence set
- run one focused revision round for proposal/critique
- rerun synthesis and approval on the expanded evidence set

This keeps the state machine deterministic while giving the reasoning agents a
real chance to revise earlier shallow proposals.

#### 5. Add telemetry that proves Lever 3 is helping

Minimum telemetry:
- `critiqueExpansion.triggered=true|false`
- `critiqueExpansion.requestedSeams`
- `critiqueExpansion.fetchedSeams`
- `critiqueExpansion.skippedRequests`
- `critiqueExpansion.expansionTokens`
- `critiqueExpansion.revisionRounds`

Without this, we will not be able to tell whether Lever 3 fixes grounding or
just increases token burn.

#### 6. Success criteria for the first Lever 3 batch

Validation should reuse the same `<TARGET_PROJECT>` case.

Success means:
- `substantive-assumptions` disappears from `groundingGapCategories`, and
- the result no longer leaves the approval-flow fix trapped inside
  `Assumptions / Unverified Seams`

Strong success:
- `patchSafeEligible=yes`

Failure signal:
- the same seams are requested repeatedly but the revised pass still cannot
  ground them

#### 7. What not to build in this batch

- no wider default keyhole
- no recursive fetch planner
- no multi-hop dependency expansion
- no agentic tool loop
- no general "ask for anything" runtime

The next batch should prove that narrow critique-driven seam fetch is enough
before we add more autonomy.

### Lever 3 MVP Implementation Batch

Based on the current runtime shape in `ai/scripts/generate-context.js`, the
lowest-risk MVP is to extend the **approval JSON contract**, not to invent a
new parser for critique text.

#### Batch A. Structured seam requests in approval artifacts

Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/__tests__/prompt-content.test.js`

Changes:
- Extend `buildConsensusReviewContent(...)` so approval agents may optionally
  return:
  - `missingSeams: [{ symbolOrSeam, reasonNeeded, expectedImpact, fetchHint }]`
- Extend `parseApproval(...)` so it normalizes `missingSeams` into a bounded
  array and rejects malformed/non-array values safely.
- Preserve backward compatibility: old approval JSON with only `score` and
  `notes` must still parse cleanly.

Why approval first:
- approval already uses strict JSON output and writes `approval-*.json`
  artifacts
- the runtime already parses and stores approval results structurally
- this is a smaller seam than parsing free-form critique text

Schema guardrail:
- `missingSeams` is the canonical schema for critique-driven expansion requests
- MVP emitter: `approval` only
- future emitters may include `critique` and/or `devils-advocate`, but they
  must reuse the same `missingSeams` schema and the same
  parser/normalizer/resolver path
- do not introduce a second phase-specific request format for the same concept

#### Batch B. Deterministic seam resolver

Files:
- `ai/scripts/structural-search.js` or a new helper such as
  `ai/scripts/critique-expansion.js`
- `ai/scripts/__tests__/structural-search.test.js` or dedicated new tests

Changes:
- Add a deterministic resolver for requested seams:
  - exact symbol-name lookup from the code index
  - optional file anchor lookup when `fetchHint` contains a path/range
  - bounded same-file snippet extraction around the resolved symbol
- Refuse broad requests such as "entire service layer" or unresolved fuzzy
  natural-language descriptions.
- Return telemetry-friendly results:
  - requested seams
  - fetched seams
  - skipped seams with reasons

Important:
- do not reuse prompt-scored structural search as-is for this path; Lever 3
  needs exact seam resolution, not another heuristic prompt search

#### Batch C. Expansion trigger and focused revision path

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`

Insertion point:
- right after the first `assessFinalResultTrust(...)` decision for the
  consensus result
- before the run is finalized as the stable post-approval outcome

Trigger:
- `groundingGapCategories` contains `substantive-assumptions`
- and approval outputs include at least one valid `missingSeams` request
- and no prior Lever 3 expansion has already been run in this flow

Runtime steps:
1. Collect missing-seam requests from the latest approval round.
2. Resolve them deterministically against the code index.
3. Build a compact expansion appendix with the fetched snippets.
4. Run one focused revision round on top of the existing debate:
   - revised proposal pass
   - revised critique pass
   - revised synthesis
   - revised approval
5. Recompute trust and continue the normal pipeline from there.

Why not consensus-only revision:
- the missing seams affect the substance of the fix, not just wording
- consensus alone is too weak if the deeper evidence never reaches proposal /
  critique agents

#### Batch D. Telemetry and checkpoints

Files:
- `ai/scripts/generate-context.js`
- relevant runtime metrics / signal tests

Add:
- `critiqueExpansion.triggered`
- `critiqueExpansion.requestedSeams`
- `critiqueExpansion.fetchedSeams`
- `critiqueExpansion.skippedSeams`
- `critiqueExpansion.expansionRound`
- `critiqueExpansion.expansionBytes`

Checkpoint behavior:
- expansion is at most once per run
- resumed runs must know whether Lever 3 already executed
- approval/revision artifacts after expansion should be archived distinctly so
  the operator can compare pre- and post-expansion outcomes

#### Batch E. Minimum validation suite

Tests should prove:
- approval JSON still parses old payloads
- approval JSON correctly preserves valid `missingSeams`
- malformed `missingSeams` does not crash parsing
- Lever 3 triggers only on `substantive-assumptions`
- expansion runs at most once
- skipped seam requests are recorded with reasons
- final trust is recomputed after expansion instead of reusing stale warnings

Live validation should reuse the same `<TARGET_PROJECT>` case first.

### Gemini CLI Implementation Strategy for Lever 3 (Critique-Driven Expansion)

I agree with Codex's narrow MVP bounds. Here is how we should implement it technically in the codebase:

#### 1. Prompt Contract (The Trigger)
Modify `buildCritiqueContentWithProposals` and `buildDevilsAdvocateContent` in `ai/scripts/domain/prompt-content.js`. Instruct the agent to append an explicit `Missing Evidence Requests` JSON block if and only if it must flag a `substantive-assumptions` gap due to missing architectural context.

Example format expected from the agent:
```json
[
  { "seam": "processSimpleApproval", "reason": "need to see exact status transitions" },
  { "seam": "ApprovalSetting", "reason": "need to verify field mapping to ApprovalInstance" }
]
```

#### 2. Runtime Interception
In `ai/scripts/generate-context.js`, after parsing the critique or approval output, check for the presence of the `Missing Evidence Requests` block.
If found and `expansionRound < 1` (hard MVP cap):
- Extract the requested seam names.
- Treat these seams as explicit pins and pass them to `searchStructuralSymbols()` via the existing adapter to fetch the targeted AST snippets.

#### 3. Context Injection & Revision Rerun
Instead of restarting the entire pipeline, we dynamically append the retrieved snippets as a new block (e.g., `### Expanded Evidence (Critique-Driven)`) to the context state.
We then trigger a focused `revision` round (or loop back to `consensus`), explicitly instructing the agent to resolve its previous `substantive-assumptions` using the newly fetched evidence.

#### 4. Safety & Telemetry
- **Limit:** Max 1 expansion round per run. No recursive looping.
- **Budget:** Cap the expanded snippets payload (e.g., max 2048 tokens / ~8KB) to prevent context blowout.
- **Telemetry:** Record `operationalSignals.critiqueExpansion` (triggered: boolean, requestedSeams: string[], fetchedSeams: string[]) so we can measure if the fetched context actually resolved the gap in the final output.


---

## [2026-03-15] Lever 3 MVP Live Validation Outcome

The first runtime batch for Lever 3 is now landed and has been revalidated on
the same `<TARGET_PROJECT>` case.

### What the live runs proved

- A real orchestration bug existed in the initial MVP: the trigger expected a
  flattened trust signal, but `runLever3ExpansionRound(...)` was receiving the
  raw `assessFinalResultTrust(...)` shape. That mismatch is now fixed.
- One rerun after the fix failed earlier in `approval-1` because the reviewer
  returned markdown instead of JSON. This exposed **approval structured-output
  fragility**, not a critique-expansion design failure.
- A subsequent rerun completed the full Lever 3 path:
  - `critiqueExpansion.triggered=true`
  - `requestedSeams=3`
  - `fetchedSeams=3`
  - `expansionRound=1`

This means Lever 3 is now confirmed as a **working runtime seam**, not just a
design hypothesis.

### Why the outcome still failed

The successful Lever 3 rerun still ended with:
- `patchSafeEligible=no`
- `groundingGapCategories=substantive-assumptions`
- tester verdict `NEEDS_REVISION` (`4/10`)

The remaining failure is now best explained as a **fetch-precision problem**,
not a trigger problem:
- approval requested coarse class/file seams such as `ApproverFacadeImpl` and
  `ApprovalInstanceRepository`
- the deterministic resolver accepted those requests and fetched broad
  class-level/header-heavy ranges
- the expansion did **not** fetch the still-missing approval-chain generation
  seam in `AbstractDocumentHandler`
- so the revised pass consumed more tokens, but still left substantive items in
  `Assumptions / Unverified Seams`

In other words: Lever 3 now runs, but current `missingSeams` quality is too
weak to close the remaining grounding gap.

### Accepted next batch: Lever 3 precision + approval hardening

#### 1. Make `missingSeams` method-first

The next batch should prefer requests like:
- `AbstractDocumentHandler#initiateApprovalWorkflow`
- `ApproverFacadeImpl#processSimpleApproval`
- `ApproverFacadeImpl#processEdsResult`
- `ApproverFacadeImpl#resetApprovalChain`
- `ApprovalInstanceRepository#findByDocumentIdAndApproverUserIdAndIsCurrentInQueueTrue`

Allowed forms:
- `Class#method`
- exact symbol name
- explicit line-range hint

What should be discouraged:
- whole-class requests such as `ApproverFacadeImpl`
- file-only requests unless the file itself is the real seam

#### 2. Stop falling back from method-shaped requests to class headers

If a request is clearly method-shaped or contains a narrow range hint, the
resolver should not silently degrade to a class header or a primary symbol in
the file.

Preferred behavior:
- resolve the exact method/range
- otherwise skip the request and record a telemetry reason

This is the key precision fix surfaced by the live rerun.

#### 3. Harden approval structured output

Approval remains the right MVP emitter, but the phase is still operationally
fragile. We now have live evidence that one approval response can fall back to
plain markdown and abort the run before Lever 3 even starts.

The next hardening step should be narrow:
- keep approval as strict JSON
- add one bounded retry/repair path for invalid approval JSON
- do not silently coerce markdown into a valid approval result

This is consistent with the existing Pipeline Hardening direction: preserve the
structured contract, but tolerate one recoverable provider-format miss.

#### 4. Keep current guardrails unchanged

Still true after validation:
- `approval` remains the only MVP emitter
- `missingSeams` remains the canonical schema
- no wider default keyhole
- no critique/devils-advocate emitter yet
- no recursive dependency walk
- no agentic tool loop

#### 5. Review of colleague proposals

Accepted as relevant now:
- Claude's earlier guardrail still stands: even if other phases emit seam
  requests later, they must reuse the same `missingSeams` schema and shared
  parser/normalizer/resolver path.
- Gemini's broader direction remains correct at a high level: critique-driven
  expansion is the right seam, but it now needs **precision**, not more width.

Explicitly deferred for this batch:
- Gemini's broader future ideas such as semantic ranking, context compaction,
  and Lever 4 verified execution
- Claude's pipeline cost optimizations such as prompt caching, complexity
  routing, or conditional DA/tester skip

These are still useful future proposals, but they should not displace the
immediate need to make Lever 3 fetch the **right** seams.

## [2026-03-15] Future Roadmap & Workflow Optimization Proposals (Gemini CLI)

Following a high-level review of the Hub's current effectiveness, the following strategic directions are proposed for future discussion and implementation:

### 1. Dynamic Context Evolution (The "Curious" Hub)
*   **A/B Semantic Ranking:** Supplement current token-based structural search with lightweight local embeddings (e.g., via `transformers.js`) to bridge the gap between prompt intent and code terminology (e.g., "advance queue" vs "process next item").
*   **Context Compaction & Snapshotting:** Implement automatic "Log Compaction" to archive historical discussion into `history/` folders, keeping the main `context_bundle` clean and focused on the current delta.

### 2. Verified Execution (Lever 4: Agentic Tool Loop)
*   **Sandboxed Iteration:** Move from "Proposal-only" to "Verified-Proposal" mode. The Hub should apply changes to a temporary directory, run `npm test` or `lint`, and only present the operator with results that pass basic sanity checks.
*   **Self-Healing Cycle:** If a proposal causes a regression, the Hub should automatically feed the error back to the agents for a second iteration before involving the human operator.

### 3. Developer Experience (Process Ergonomics)
*   **Unified Logging Utility:** Replace manual `bash/node` log appending with a dedicated CLI command (e.g., `npm run ai:log -- --task="id" --summary="..."`) to eliminate shell escaping errors and ensure log consistency.
*   **TDD-First Orchestration:** Optional "test-driven" mode where the Hub extracts failing test cases first and pins them to the `context_bundle` to force agents to focus on the regression evidence.

### 4. Cross-Project Knowledge Transfer
*   **Local Memory Mining:** Enhance the current `memory.db` to store not just facts, but "Patterns of Failure" (e.g., "In project X, we solved similar race condition with Y"). This allows the Hub to suggest architectural precedents from other indexed workspaces.

*Discussion status: OPEN (Awaiting feedback after Lever 3 precision batch).*

---

## Cross-Model Review: Claude Opus 4.6 — 2026-03-15

### Assessment of Current State

Lever 3 as a runtime seam is confirmed. The live run proved: trigger works,
seams are requested and fetched, expansion round executes. This is no longer a
hypothesis.

The remaining failure is a **fetch-precision problem**, not a trigger, width, or
debate problem.

### Key Insight: Precision Over Width

Every improvement iteration so far followed the same pattern:

| Iteration | What we tried | Outcome |
|---|---|---|
| Evidence contracts | Tighten debate discipline | Fixed rhetorical downgrades, but agents still shallow |
| Expanded keyhole | Wider structural extraction | Agents reached more seams, but still could not ground |
| Lever 3 trigger | Let approval request missing seams | Trigger works, but fetched class headers instead of method bodies |
| **Next: precision** | Method-first `missingSeams` | Should close the loop |

The bottleneck moved through layers:
1. retrieval coverage → fixed
2. debate behavior → fixed
3. approval scoring → fixed
4. keyhole width → fixed (partial)
5. expansion trigger → fixed
6. **fetch precision → current blocker**

Each layer was fixed correctly. The problem was never "wrong fix" — it was
"right fix at the current layer, but the next layer was also broken."

### Agreement with Codex Precision Batch

Fully agree with the accepted next batch:

1. **Method-first `missingSeams`** — correct. `Class#method` not `Class`.
   Approval agents are smart enough to name specific methods; the prompt just
   needs to encourage that format.
2. **No silent fallback** from method-request to class header — critical. The
   current fallback defeats the purpose of precise requests.
3. **Approval JSON hardening** — necessary. Live evidence shows one bad JSON
   response can abort the run before Lever 3 even starts.
4. **Guardrails unchanged** — correct. No scope expansion until precision is
   validated.

### Deferred Proposals Status

My pipeline cost optimization proposals (`PIPELINE_COST_OPTIMIZATION.md`)
remain valid but correctly deferred. Rationale: optimizing cost of a pipeline
that cannot yet produce PATCH_SAFE results is premature. Fix precision first,
optimize cost second.

Same logic applies to Gemini's broader proposals (semantic ranking, Lever 4,
TDD mode, context compaction).

### What If Precision Batch Also Fails?

If method-level seams still do not clear `substantive-assumptions`:

1. **Most likely cause:** the specific case needs evidence from more than one
   expansion round. Consider increasing the hard cap from 1 to 2 rounds.
2. **Alternative:** add critique as a second `missingSeams` emitter. Critique
   sees the proposals and may identify different gaps than approval.
3. **Escalation:** if 2 rounds + 2 emitters still fail, Lever 4 (agentic tool
   loop) becomes the justified next step — the panel-of-advisors model has
   reached its retrieval ceiling for this class of tasks.

### Recommended Success Criteria

Same `<TARGET_PROJECT>` case:
- **Success:** `substantive-assumptions` disappears from `groundingGapCategories`
- **Strong success:** `patchSafeEligible=yes`
- **Failure signal:** method-level seams fetched but revised pass still cannot
  ground — indicates the problem is deeper than retrieval


---

## Strategic Synthesis & Evaluation (Gemini CLI — 2026-03-15)

### Overall Assessment: High Maturity / Structured Execution
The project has transitioned from a basic "functional pipeline" to a sophisticated **Quality Immune System**. We are no longer just retrieving code; we are enforcing structural evidence-grounding, which is the hallmark of a professional-grade AI engineering tool.

### Key Wins
1.  **Evidence-Grounded Patch Mode (Lever 2+):** Fundamental shift from chat-based generation to verifiable artifacts. Segmenting "Grounded Fixes" from "Assumptions" is critical for trust.
2.  **Lever 3 (Critique-Driven Expansion):** The successful live validation of the post-approval expansion path proves we can dynamically "cure" the conservative bias of models by providing targeted evidence upon request.
3.  **Phase Contract Normalization:** The [Contradiction]/[Risk hypothesis] taxonomy provides the necessary "debate logic" to prevent ungrounded critiques from blocking valid patches.

### Critical Bottlenecks
1.  **Fetch Precision:** The "Precision over Width" challenge is real. Retrieving class headers when method bodies are needed is the current primary blocker for `patchSafeEligible` status.
2.  **Structured Output Fragility:** Approval JSON degradation remains a risk for automated orchestration.

### Verdict & Strategic Alignment
*   **Strategy:** The decision to prioritize **"Precision over Width"** in Lever 3 (method-first requests, no header fallback) is 100% correct.
*   **Efficiency:** The current pipeline is high-cost (~$0.82/run) but high-signal. Claude's cost-optimization proposals (Prompt Caching P0) are the logical next step after grounding precision is solved.
*   **Maturity Score: 9/10.** The project is solving the "lost in the middle" and "conservative bias" problems with architectural rigor rather than prompt-hacking.

*Actionable Priority: Focus on Lever 3 Precision (Method-first resolver) to clear the final substantive-assumptions blockers.*


---

## Progress Assessment: Claude Opus 4.6 — 2026-03-15

### Iteration History

| # | Change | Test count | Tester verdict | patchSafeEligible |
|---|---|---|---|---|
| 0 | Baseline (pre-fix) | 397 | NEEDS_REVISION 4/10 | no |
| 1 | Expanded keyhole (class fields, constructor, interfaces) | ~400 | NEEDS_REVISION 5/10 | no |
| 2 | Lever 3 MVP (missingSeams trigger + deterministic resolver) | ~410 | NEEDS_REVISION 5/10 | no |
| 3 | Precision batch (method-first `Class#method`, no header fallback) | ~415 | — | no |
| 4 | Second expansion round + precision fixes | 421 | PASS_WITH_NOTES 7/10 | no |
| 5 | Next: close remaining route-model seams + prompt-scope awareness | — | target 8+/10 | target yes |

### Strengths

1. **Layer-by-layer discipline.** Each iteration correctly diagnosed and fixed its specific layer (retrieval → debate → scoring → keyhole → trigger → fetch precision). No premature jumps to Lever 4.
2. **Lever 3 live-confirmed.** The expansion round triggers, resolves, and runs — the mechanism works. The remaining issue is precision of what gets fetched, not whether it triggers.
3. **Prompt-scope awareness.** Discovering that over-constrained operator prompts silently bias retrieval is a genuine insight that improves the system beyond this specific case.
4. **Documentation discipline.** Every decision is recorded in design docs, change logs, and memory. Cross-model reviews (Claude, Codex, Gemini) are all captured.
5. **Test growth.** 397 → 421 tests across iterations. No regressions reported.

### Concerns

1. **`generate-context.js` monolith (6863 lines).** Every Lever 3 batch adds more logic to one file. Decomposition (proposal #7 in `PIPELINE_COST_OPTIMIZATION.md`) should happen soon — before the next major feature, not after.
2. **Single validation case.** All iterations validated on the same `<TARGET_PROJECT>` prompt. One case cannot prove generalization. A second validation case with a different project type is needed before declaring Lever 3 production-ready.
3. **Approval JSON fragility.** The precision batch depends on well-formed `missingSeams` JSON from approval agents. One retry on invalid JSON may not be enough if multiple providers produce inconsistent formats.
4. **Growing deferred proposals.** Pipeline cost optimization, Lever 4, semantic ranking, TDD mode, context compaction — all correctly deferred, but the backlog grows. Need a clear sequencing decision after precision batch lands.

### Recommendations

1. **Approval hardening first.** Before the next live run, add structured-output validation with clear error recovery. This is a prerequisite for reliable Lever 3, not an optimization.
2. **Second validation case.** After precision batch, run on a fundamentally different project (e.g., frontend React component vs. backend Java workflow). Same-case improvement proves the fix; cross-case improvement proves the architecture.
3. **Orchestrator decomposition timing.** Schedule after Lever 3 precision batch, before Stack-Aware Dynamic Skills. Every future feature becomes cheaper with a decomposed orchestrator.

### Numerical Scores

| Dimension | Score | Note |
|---|---|---|
| Architectural decisions | 9/10 | Correct layer-by-layer approach, no premature optimization |
| Velocity | 8/10 | 5 iterations in ~2 days, each productive |
| Code quality | 7/10 | Functional but monolith risk growing |
| Documentation | 9/10 | Comprehensive cross-model records |
| Tech debt management | 6/10 | Monolith and single-case validation are accumulating risk |
| **Overall** | **8.5/10** | Strong execution, needs decomposition and second validation case |

## [2026-03-15] Offline Validation Harness While Pilot Quotas Are Exhausted

Pilot balances on the current `<TARGET_PROJECT>` runs are temporarily exhausted,
which means quality work must continue without depending on fresh live reruns.
The short-term answer-depth plan is now explicitly split into two tracks:

1. **Offline regression harness**
   - summarize old run artifacts deterministically (`prompt-scope-warning`,
     `tester-validation`, `result-warning`)
   - keep local golden fixtures for the key iterations:
     `narrow`, `broadened`, `targeted`
   - assert the known trend offline (`4/10 -> 6/10`, targeted run incomplete
     due to provider quota)

2. **Quota-aware runtime hardening**
   - detect provider quota exhaustion explicitly
   - stop wasting retries on `insufficient_quota` / exhausted-credit responses
   - preserve partial evidence so operator review can continue even when a live
     run aborts before tester or final synthesis

This salvage layer is now landed as well: offline summaries can autodiscover
matching `run-flow.json` files and distinguish at least two important partial
failure shapes from historical pilot artifacts:
- `provider_length` (for example `finish_reason: length`)
- `quota_exhausted` (`insufficient_quota`, exhausted credits, billing lockout)

This does **not** replace live validation. It is a holding pattern that keeps
the answer-depth work measurable until provider balances recover. Once credits
return, the next live step remains unchanged: close the remaining route-model
seams and validate on a second non-Java case before calling Lever 3
production-ready.


---

## Review of Offline Harness Batches: Claude Opus 4.6 — 2026-03-15

### What Was Done

Two Codex batches landed while pilot provider budgets are exhausted:

1. **Offline Regression Harness + Quota Hardening**
   - `run-artifact-summary.js` (355 lines): CLI for aggregating run artifacts
   - `run-artifact-regression.js` (170 lines): golden-case regression with comparison operators
   - Golden fixtures for 4 cases: `narrow`, `broadened`, `targeted-length`, `targeted-quota`
   - Quota exhaustion detection in `providers.js` (dual-layer: flag + fingerprint)
   - Early retry abort on exhausted quota in `generate-context.js`

2. **Partial-Run Salvage**
   - `run-flow.json` autodiscovery for matching artifacts to runs
   - Failure shape classification: `provider_length` vs `quota_exhausted`
   - Extended golden-manifest to 4 cases with cross-case comparison

Tests: 421 → 433 (+12, 0 regressions)

### Strengths

1. **Correct pivot.** Budget exhausted → offline tooling instead of idle. Productive use of a blocker.
2. **Quota hardening overdue.** Empty retries on `insufficient_quota` wasted time and remaining tokens. Two-layer detection covers all 3 providers.
3. **Well-designed golden fixtures.** 4 cases cover the key progression and both failure modes. Cross-case comparison in manifest is the right approach.
4. **Code quality.** Defensive programming, null-checks, try-catch on JSON, temp dirs in tests.

### Concerns

1. **DRY violation in quota detection.** Same 5-keyword fingerprint logic duplicated in `providers.js` and `generate-context.js`. Quota detection should live only in `providers.js`; the orchestrator should check `error.quotaExhausted` flag only.
2. **Monolith growth.** `generate-context.js` is now **7055 lines** (was 6863). Each batch adds logic to one file. Decomposition is needed before the next major feature.
3. **Offline harness ≠ validation.** Golden fixtures validate parsing and classification, not answer quality. A second live validation case on a different project is still required.
4. **No fetch timeout.** `providers.js` has no timeout on fetch operations. A hung request to one provider could block the entire pipeline.

### Scores

| Dimension | Score |
|---|---|
| Productivity under blocker | 9/10 |
| Code quality | 7.5/10 |
| Test coverage | 9/10 |
| Architectural contribution | 7/10 |
| **Overall** | **8/10** |

### Action Items for Next Coding Window

1. Extract quota detection from `generate-context.js` into `providers.js` (single source of truth)
2. Begin orchestrator decomposition — 7055 lines exceeds healthy maintainability

### Follow-Through Status Update — 2026-03-15

Status against the Claude offline-harness review:

1. **Quota DRY cleanup: landed.**
   - Quota exhaustion detection now lives in `ai/scripts/infrastructure/providers.js`.
   - `generate-context.js` no longer carries its own duplicate fingerprint rules; it checks the provider-layer signal instead.

2. **Provider fetch timeout: landed.**
   - Provider requests now have timeout protection and distinguish timeout failures from quota exhaustion.
   - This reduces wasted retry loops and avoids hanging the full pipeline on one stuck provider call.

3. **Decomposition still next.**
   - The monolith concern remains valid even after the infra hardening follow-through.
   - The next coding window should begin with orchestrator tech-debt reduction before another major quality feature.

4. **Second validation case remains mandatory.**
   - Offline harness work is useful, but it still does not prove answer-depth generalization.
   - After the first decomposition slice is underway, the next product-facing task is preparing a materially different second validation case.

### Immediate Priority Order While Provider Balances Are Exhausted

1. **Tech debt first:** start decomposing `generate-context.js` in bounded slices.
2. **Second validation case second:** prepare prompt, starting seams, success criteria, and expected grounded seams for a non-`<TARGET_PROJECT>` case.
3. **Only low-risk offline work after that:** fixture prep, operator comparison views, and other support tasks that do not add new quality levers.

Explicitly not next:
- wider context expansion
- new answer-depth levers
- broader cost-optimization rollout before decomposition

### Decomposition Progress Update — 2026-03-16

Two bounded decomposition slices are now landed:

1. Extracted final-result trust and result-artifact logic from `generate-context.js` into `ai/scripts/domain/final-result-trust.js`.
2. Extracted runtime overrides / phase pacing into `ai/scripts/runtime-overrides.js`.
3. Kept `generate-context.js` as the orchestration owner via thin wrappers, so external contracts and existing tests stayed stable.
4. Reduced `generate-context.js` from `7043` lines to `6442` lines across the two slices.

Verification:
- `node --test ai/scripts/__tests__/generate-context.contract.test.js`
- `npm run ai:test` → `435 tests, 434 pass, 0 fail, 1 skipped`

What this changes in the plan:
- orchestrator tech debt reduction is now demonstrably underway rather than just planned;
- further decomposition should stay bounded and low-risk;
- the next product-facing offline task can now shift to the second validation case dossier without waiting for a full orchestrator rewrite.

## Second Validation Case Dossier (Prepared) — 2026-03-16

The second validation case should be materially different from the current
`<TARGET_PROJECT>` Java approval workflow. The prepared choice is another Java
project, but with a different reasoning shape centered on lifecycle / status
synchronization rather than approval-route generation (`<SECOND_VALIDATION_PROJECT>`
in the validation manifest).

### Why This Case

1. It tests a different reasoning shape than the Java workflow.
   - Current validated case is backend-heavy in a very specific way: route
     generation, repositories, queue transitions, and approval sequencing.
   - The second case should force the stack to reason across service entry
     points, entity field mutation, repository read/write paths, listener/event
     side effects, and reset/compensation seams.

2. It specifically checks that answer-depth does not overfit to one file.
   - A Java lifecycle bug is easy to misdiagnose by reading only one visible
     service or handler method.
   - The system must trace the real mutation path and readback path instead of
     stopping at the first business-method seam it sees.

3. It is a good prompt-scope stress test.
   - The known risk from the first case was narrow prompt anchoring.
   - A lifecycle bug with one obvious entry seam is the right place to verify
     that `starting seams` guidance still leads to deeper grounded reads.

### Proposed Case Shape

- Project alias: `<SECOND_VALIDATION_PROJECT>`
- Project type: `backend-java-lifecycle`
- Case id: `backend-java-lifecycle-sync`
- Candidate central symptom:
  - after a lifecycle action, entity status / current step / derived flags
    drift because one write path, event/listener seam, or read model remains
    unsynchronized.

### Prompt Draft

```text
Investigate why entity status, current step, or other derived lifecycle flags
drift after a business action. Start from the visible service/handler seam, but
do not stop there. Trace any upstream/downstream code needed to ground the real
mutation path: entity fields, repository read/write methods, mapper/read-model
seams, event/listener side effects, and any reset/retry/compensation flow that
can change the same lifecycle state.

Treat the listed seams as starting seams, not a hard limit. If the bug depends
on transaction boundaries, derived projections, listener order, or a reset path,
read those seams too. Return a grounded fix only if the actual write path and
readback/synchronization path are verified from code.
```

### Starting Seams

These are the intended starting seams for the case:

1. the service / handler method that triggers the lifecycle transition
2. the entity fields that represent current lifecycle state
3. the repository methods that read or persist that state
4. any listener / event / subscriber seam triggered by the transition
5. any reset / retry / compensation seam that can rewrite the same state

### Expected Grounded Seams

A strong answer should ground at least these seam groups:

1. the entry-point service/handler path
2. the entity mutation and persistence seam
3. the readback / projection / synchronization seam

If the diagnosis depends on a listener, event, transaction hook, or reset flow,
the answer should also ground that boundary explicitly rather than leaving it
under `Assumptions / Unverified Seams`.

### Success Criteria

Target success:

1. `patchSafeEligible=yes`
2. tester score `>= 8/10`
3. `groundingGapCategories` does **not** contain `substantive-assumptions`
4. grounded fixes cite at least entry seam + mutation seam + readback/side-effect seam

Acceptable partial success:

1. tester score `>= 7/10`
2. no `unconfirmed-seam` gaps
3. at most one remaining gap, and it is narrower than the current
   `<TARGET_PROJECT>` route-model gap

Failure signals that would matter:

1. diagnosis stays trapped inside one service / handler method
2. answer proposes lifecycle fixes without grounding the real entity write path
3. readback / listener / reset behavior remains under assumptions
4. prompt-scope warning still dominates despite the broadened wording above

### Operational Notes

- This case is now recorded in `ai/specs/answer-depth-validation-cases.json`.
- No live run is possible until provider balances return.
- When balances return, the same stack should be rerun on:
  1. `<TARGET_PROJECT>` Java workflow case
  2. `<SECOND_VALIDATION_PROJECT>` Java lifecycle-synchronization case

Only after both runs should Lever 3 + prompt-scope awareness be treated as
generalized rather than case-specific.
