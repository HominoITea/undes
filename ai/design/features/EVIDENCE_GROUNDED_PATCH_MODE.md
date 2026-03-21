# Evidence-Grounded Patch Mode

Status: mvp-complete
Priority: P0

## Why This Exists

The latest real-project pilot on `<TARGET_PROJECT>` proved that the hub can now
complete a full multi-agent run and produce a strong analytical answer.

But it also exposed the next quality gap:

- `result.txt` is good enough to guide implementation;
- `result.txt` is **not yet reliable enough to copy-paste code directly into the target project**.

In other words:

- the pipeline is now operationally strong enough;
- the answer contract is still weaker than the product promise we want.

For this feature, the target product promise is explicit:

- **if `result.txt` contains implementation code, that code must be evidence-grounded, seam-checked, and safe enough to paste into the target project without obvious symbol drift**.

If the hub cannot meet that bar for a given run, it should:

- downgrade to a diagnostic / implementation-outline result;
- clearly say that patch-safe output was not achieved;
- never present a speculative patch as implementation-ready code.

## Concrete Failure Seen In Pilot

`<TARGET_PROJECT>` run `run-1773403157775` reached the end of the pipeline and
produced a useful final answer.

However, the result still mixed:

- strongly grounded findings around `ApproverFacadeImpl`;
- partially grounded hypotheses around `AbstractDocumentHandler`;
- code snippets that referenced seams or types not fully confirmed from the
  files actually read during the run.

This is not a provider failure.
This is a **result contract failure**:

- the hub generated a strong diagnostic answer;
- but formatted part of it like a ready patch.

That gap must now be closed in the core.

## Goal

Turn `result.txt` into a trustworthy output surface with two valid modes only:

1. **Patch-safe result**
   - code is grounded in read files;
   - referenced symbols are confirmed;
   - assumptions are isolated;
   - result is safe to apply manually.

2. **Diagnostic result**
   - the hub could not prove a patch-safe answer;
   - result stays analytical;
   - assumptions and uncertainty are explicit;
   - no speculative patch is presented as copy-paste-ready.

## Core Principle

The hub must distinguish between:

- **evidence-backed fixes**
- **hypotheses**
- **unverified implementation suggestions**

Today these are still too easy to mix into one smooth-looking answer.

This feature is about making that impossible by contract.

## MVP

### Batch 1. Patch-Safe Result Contract

Define an explicit final-output contract for implementation tasks.

New concepts:

- `diagnostic`
- `implementation-ready`
- `patch-safe`

Rules:

- `result.txt` may contain code only if the run satisfies the patch-safe gate;
- otherwise `result.txt` must clearly stay in diagnostic mode and must not
  present speculative code as final patch content.

Minimal user-facing requirement:

- top-of-file marker in `result.txt`:
  - `RESULT_MODE: PATCH_SAFE`
  - or `RESULT_MODE: DIAGNOSTIC`

### Batch 2. Evidence Binding For Patch Claims

Every code-level fix claim must bind back to read evidence.

For each proposed patch area, the runtime should preserve:

- source file(s) actually read;
- relevant methods/classes/symbols observed;
- whether the output is grounded directly or inferred indirectly.

MVP requirement:

- every final code patch section in `result.txt` must carry explicit file anchors;
- speculative or inferred parts must be labeled as assumptions and excluded from
  the patch-safe section.

### Batch 3. Symbol / Seam Validation

Before a final answer is allowed to claim patch-safe status, validate that its
code references do not invent unknown seams.

MVP checks can be heuristic:

- referenced files exist;
- referenced classes/methods/fields mentioned in the patch appear in read files
  or in indexed symbols;
- obvious drift like `authService.getCurrentUserId()` in a repo that uses
  `Utils.getCurrentUserPltId()` is caught as non-grounded.

If this validation fails:

- patch-safe status is denied;
- result falls back to diagnostic mode.

### Batch 4. Assumption Segregation

The final answer must never hide uncertainty inside patch-ready code.

Required structure:

- `Grounded fixes`
- `Assumptions / Unverified seams`
- `Deferred checks`

Patch-safe mode:

- only `Grounded fixes` may contain copy-paste patch content.

Diagnostic mode:

- grounded and inferred content may coexist, but must remain separated.

### Batch 5. Dedicated Patch-Safe Artifact

Keep `result.txt` human-readable, but also write a stricter artifact when
patch-safe gating passes.

Recommended file:

- `.ai/prompts/patch-safe-result.md`

If the run is not patch-safe:

- this file should not be created.

This allows:

- `result.txt` to remain the main operator narrative;
- `patch-safe-result.md` to become the "take and apply" surface.

## Recommended MVP Boundary

The narrowest high-value MVP is:

1. explicit `RESULT_MODE`;
2. evidence binding for final code sections;
3. heuristic symbol/seam validation;
4. assumption segregation;
5. optional `patch-safe-result.md` artifact only when the gate passes.

This is enough to stop the most dangerous failure mode:

- speculative code presented as if it were implementation-ready.

## Assumed Implementation Section (post-MVP enhancement)

Added after live validation showed that when evidence is insufficient for
`Grounded Fixes`, the result contained almost no code — only prose.

The output contract now has a 4-section structure:

1. `## Grounded Fixes` — code backed by `Evidence:` anchors (unchanged)
2. `## Assumptions / Unverified Seams` — prose list of what's uncertain (unchanged)
3. `## Assumed Implementation` — **NEW**: best-effort code for ungrounded items
4. `## Deferred Checks` — verification steps (unchanged)

Rules for `## Assumed Implementation`:

- Every code block must have an `Assumption:` line stating what evidence is missing
- Code must be realistic and follow project patterns observed in context
- Must not duplicate items already in `Grounded Fixes`
- Items from `Assumptions / Unverified Seams` that can be expressed as code go here

Trust gate (`patchSafeEligible`) is unchanged — it evaluates only `Grounded Fixes`.
The `Assumed Implementation` section is excluded from trust scoring and from the
`patch-safe-result.md` artifact. It exists only in `result.txt` (the full narrative).

## Non-Goals (MVP)

- full AST compilation of generated patches;
- language-specific semantic compilation for all ecosystems;
- automatic patch application into target repos;
- formal proof of correctness;
- cross-provider self-healing patch generation loops.

## Relationship To Existing Features

- **Pipeline Hardening** made outputs complete and observable.
- **Adaptive Runtime Control** made runs more predictable and controllable.
- **Local Memory** improves recall across runs.
- **Evidence-Grounded Patch Mode** is the next layer: final-answer trust.

This is not the same as:

- `Patch-Based Learning Loop` — that is about storing and reusing fixes;
- `Language-Aware Arch Check` — that is about static structure checks;
- `Docs Pipeline` — that is about documentation canon.

## Next Discussion Track (2026-03-13)

The current live rerun on `<TARGET_PROJECT>` narrowed the next gap:

- structural-search fallback is no longer the main blocker;
- false-negative patch-safe denials are now the sharper problem.

Planned discussion scope:

1. Why does the patch-safe gate fail to count enough evidence from files that
   were actually read or surfaced through Context Pack excerpts?
2. Where does `observedFiles` under-report reality:
   - context bundle extraction only;
   - explicit read-file metadata only;
   - missing propagation from structural-search / snippet selection?
3. Which current validation rules are too coarse and force DIAGNOSTIC mode too
   early:
   - unobserved evidence anchors;
   - substantive assumptions heuristic;
   - seam confirmation based only on file/index hits?
4. What bounded telemetry should be added before changing the gate:
   - final trust counts/categories in `operationalSignals`;
   - sample gap messages for analytics;
   - archived run comparison on false-negative cases?

Expected deliverables for the discussion:

- a concrete false-negative taxonomy from archived and live runs;
- a proposal for better evidence-observation propagation;
- a decision on whether to relax heuristics, enrich evidence capture, or both.

Current findings from the `2026-03-13` investigation:

- One live false-negative was a real parser bug: dotted message keys such as
  `error.template.not.found` were being treated as file anchors and inflated
  `missing file` grounding gaps. This was fixed in the runtime with a
  regression test.
- Two other live warnings were legitimate, not false negatives:
  `TemplaterClient.java` and `TemplateListResponse.java` were cited in
  `Evidence:` lines even though those files were not observed in the current
  run context.
- The current `observedFiles` model is:
  - file paths explicitly present in the context bundle;
  - file paths returned through `READ_FILE` tool turns.
- For the inspected live run, under-reporting by `observedFiles` is still a
  hypothesis, not yet proven. The stronger immediate issue was evidence
  overreach in the final answer, not missing propagation alone.
- This means the next implementation batch should separate:
  - parser/normalization bugs;
  - prompt/contract discipline for evidence anchors;
  - only then, if needed, broader evidence-propagation changes.

## Cross-Model Diagnosis Packet (2026-03-14)

The next live reruns narrowed the remaining failure mode even further.

Observed sequence:

- run `run-1773509025629`:
  - `contractGapCount=0`
  - `groundingGapCount=1`
  - `groundingGapCategories=["substantive-assumptions"]`
  - `evidenceAnchorCount=2`
  - `observedFileCount=99`
- run `run-1773510332754` after Context Pack prompt-named seam pinning:
  - `contractGapCount=0`
  - `groundingGapCount=1`
  - `groundingGapCategories=["substantive-assumptions"]`
  - `evidenceAnchorCount=3`
  - `observedFileCount=102`

What changed:

- the hub now reliably surfaces prompt-named seams such as
  `ApproverFacadeImpl`, `approveDocument`, and related ranges in the Context
  Pack;
- evidence anchors are now recognized and counted correctly;
- rhetorical downgrade noise from approval / critique phases is much lower.

What did **not** change:

- the final result is still `DIAGNOSTIC`;
- the only remaining blocker is substantive content left under
  `## Assumptions / Unverified Seams`;
- tester still reports the same core misses:
  - no confirmed fix for `ApprovalSetting -> ApprovalInstance` mapping;
  - no proven synchronization with `document.currentStep`;
  - no grounded finalization logic through the real last/max step;
  - no grounded comparison explaining why `Order` works while `Document` fails.

### Why this is discussion-worthy

The remaining issue is no longer obviously "missing evidence parsing" or
"wrong retrieval surface". The system now sees more of the right files, but it
still converges to a partial hotfix diagnosis instead of a fully grounded
solution. That makes this a good candidate for cross-model diagnosis before
adding more implementation complexity.

### Questions for external review

1. Why does the pipeline still stop at a partial hotfix even after explicit
   seam pinning, better evidence anchors, and evidence-aware debate contracts?
2. Which layer is now the real bottleneck:
   - retrieval coverage,
   - proposal/critique/consensus behavior,
   - approval / Devil's Advocate weighting,
   - lack of compare-mode against the working `Order` path,
   - or absence of a deeper agentic read loop?
3. What is the **minimum** hub change needed to stop this class of runs from
   ending in `substantive-assumptions`?
4. Should this become:
   - a critique-driven context expansion batch,
   - a compare-path feature,
   - a targeted "working path vs broken path" diagnosis mode,
   - or a stronger agentic file-read loop?

### Review packet inputs

Give reviewers these artifacts together:

- the original prompt:
  `<PROJECT_ROOT>/.ai/prompts/discussions/<TASK_ID>/<RUN_ID>/prompt.txt`
- proposal artifacts (or at least a short proposal summary):
  `<PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-proposal.txt`
- critique artifacts (or at least a short critique summary):
  `<PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-critique.txt`
- latest result:
  `<PROJECT_ROOT>/.ai/prompts/result.txt`
- latest warning:
  `<PROJECT_ROOT>/.ai/prompts/result-warning.txt`
- latest tester report:
  `<PROJECT_ROOT>/.ai/prompts/test-report.md`
- latest run metrics:
  `<PROJECT_ROOT>/.ai/prompts/metrics/latest.json`
- the current context bundle proving the named seams are now present:
  `<PROJECT_ROOT>/.ai/.context_bundle.md`

### Recommended execution format

Run this diagnosis as **parallel single-agent reviews**, not as one shared
debate round.

Why:

- the goal is to collect independent root-cause hypotheses, not to synthesize
  one answer yet;
- a full debate risks early anchoring, where the second model starts from the
  first model's diagnosis instead of forming its own;
- independent passes make it easier to compare where models genuinely agree vs
  where one model merely echoed another.

Recommended practical order:

1. run Claude, Gemini, and another reviewer model independently on the same
   packet;
2. compare their `Root cause` / `Minimum fix` / `Heavier follow-up` sections;
3. only then synthesize the overlap into a roadmap decision.

Follow-up discussion templates:

- `ai/DIAGNOSIS_DISCUSSION_PROMPT_CLAUDE.md`
- `ai/DIAGNOSIS_DISCUSSION_PROMPT_GEMINI.md`

### Ready reviewer prompt

Use this prompt for Claude / Gemini / another reviewer model:

```text
You are reviewing a real failure mode in an AI coding hub pipeline.

Goal:
Diagnose why the hub still ends with a DIAGNOSTIC partial-hotfix answer instead
of a fully grounded patch-safe diagnosis, even after multiple trust and
retrieval improvements.

Artifacts to review:
- Original user prompt:
  <PROJECT_ROOT>/.ai/prompts/discussions/<TASK_ID>/<RUN_ID>/prompt.txt
- Proposal artifacts:
  <PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-proposal.txt
- Critique artifacts:
  <PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-critique.txt
- Latest result:
  <PROJECT_ROOT>/.ai/prompts/result.txt
- Latest warning:
  <PROJECT_ROOT>/.ai/prompts/result-warning.txt
- Latest tester report:
  <PROJECT_ROOT>/.ai/prompts/test-report.md
- Latest metrics:
  <PROJECT_ROOT>/.ai/prompts/metrics/latest.json
- Current context bundle:
  <PROJECT_ROOT>/.ai/.context_bundle.md

Important context:
- Earlier hub changes already fixed:
  - evidence-anchor parsing (`Evidence:` vs `**Evidence:**`)
  - same-language drift
  - evidence-aware approval scoring
  - typed critique taxonomy
  - Context Pack pinning for prompt-named seams like ApproverFacadeImpl
- Latest run state:
  - contractGapCount = 0
  - groundingGapCount = 1
  - only remaining category = substantive-assumptions
  - evidenceAnchorCount = 3
  - observedFileCount = 102
- Tester still says the answer does not prove:
  - ApprovalSetting -> ApprovalInstance mapping fix
  - synchronization with document.currentStep
  - real finalization logic through the last/max step
  - grounded comparison with the working Order flow

Questions:
1. What is the most likely root cause of this remaining failure mode?
2. Which layer is failing now:
   - retrieval
   - debate/consensus behavior
   - approval / devil's-advocate pressure
   - missing compare-path logic
   - missing agentic read loop
3. What is the minimum viable hub change to fix this class of cases?
4. What heavier but more correct follow-up should be considered if the minimal
   fix is not enough?
5. Should this become a roadmap item? If yes, how would you phrase it?

Required output format:
- Verdict
- Root cause
- Why current pipeline stops short
- Minimum fix
- Heavier follow-up
- Roadmap recommendation

Do not just critique the final answer. Diagnose the pipeline behavior that led
to it.
```

## Open Questions

1. Should `result.txt` always remain human-oriented while `patch-safe-result.md`
   carries the strict patch contract, or should `result.txt` itself become the
   strict artifact?
2. Is heuristic symbol validation enough for MVP, or do we need language-specific
   validation for Java/TypeScript/Python immediately?
3. Should `patch-safe` require all code blocks to be grounded, or allow a mixed
   answer as long as only one marked section is patch-safe?
4. Should approval / devil's-advocate be allowed to downgrade a run from
   `implementation-ready` to `diagnostic` automatically?

## Recommended Starting Point

Start with the narrowest rule that changes operator trust immediately:

1. `RESULT_MODE` in final artifact;
2. a patch-safe gate that fails on ungrounded symbols or unresolved assumptions;
3. explicit split between grounded patch content and inferred guidance.

That gives a visible product upgrade quickly, without waiting for a full
language-aware validator stack.

## MVP Risk Debt / Assumption Register

- **Assumption:** Heuristic symbol/seam validation is enough for the first patch-safe gate.
  - **Why accepted now:** it delivers a large trust improvement using data the runtime already has: observed files and code index symbols.
  - **User/operator risk:** heuristic validation can still miss deeper semantic drift or type-level incompatibilities.
  - **Revisit trigger:** patch-safe runs continue to produce compile/runtime drift despite passing the heuristic gate.
  - **Exit path:** language-aware validators and deeper seam checks.

- **Assumption:** `PATCH_SAFE` is a trust gate, not a proof of correctness.
  - **Why accepted now:** product trust needed to improve immediately, even before full semantic verification exists.
  - **User/operator risk:** operators may overread `PATCH_SAFE` as a legal or formal guarantee if the docs and artifact contract are not explicit enough.
  - **Revisit trigger:** any evidence that users treat `PATCH_SAFE` as "no review required" or that false-safe outputs still slip through.
  - **Exit path:** stronger validation plus clearer operator/legal boundaries.

- **Assumption:** Mixed grounded + inferred answers may still exist in `DIAGNOSTIC` mode.
  - **Why accepted now:** the urgent problem was to stop speculative code from masquerading as ready patches, not to purge all inference from narrative outputs.
  - **User/operator risk:** diagnostic results can still look authoritative if operators ignore the mode/header and read only the body.
  - **Revisit trigger:** users continue copy-pasting from `DIAGNOSTIC` outputs despite warnings and separate artifacts.
  - **Exit path:** stricter diagnostic formatting or further narrowing of code content in non-patch-safe results.

- **Assumption:** Language-specific validation stays deferred.
  - **Why accepted now:** a generic groundedness contract was the fastest way to raise trust across projects.
  - **User/operator risk:** stacks with tricky language semantics can still pass a generic gate while hiding stack-specific problems.
  - **Revisit trigger:** repeated false-safe outcomes cluster by language or framework.
  - **Exit path:** integrate language-aware validators incrementally by highest-risk stacks first.

## Discussion

### Discussion Response: Claude (2026-03-13)

**Verdict: Accepted. P0 обоснован.**

Проблема реальная и правильно диагностирована: hub даёт сильный аналитический ответ, но оформляет часть как "готовый патч", хотя символы/швы не подтверждены из прочитанных файлов. Это именно тот тип ошибки, который подрывает доверие оператора. Для пилота на реальном проекте — это блокер продуктовой ценности.

**Сильные стороны дизайна:**

1. Бинарный контракт (`PATCH_SAFE` / `DIAGNOSTIC`) — понятен оператору, нет размытого спектра.
2. Evidence binding (Batch 2) — каждый code block привязан к файлам, реально прочитанным в run. Auditable.
3. Assumption segregation (Batch 4) — ключевой контракт. Явное разделение `Grounded fixes` / `Assumptions` / `Deferred checks` убирает основной failure mode.
4. Отдельный артефакт `patch-safe-result.md` (Batch 5) — `result.txt` остаётся нарративом, строгий патч выносится отдельно. Не создаётся если gate не пройден.

**Позиция по Open Questions:**

1. **result.txt vs patch-safe-result.md** — однозначно: `result.txt` = оператору (readable narrative), `patch-safe-result.md` = для применения (strict). Не менять контракт `result.txt`.
2. **Heuristic vs language-specific** — для MVP хватит heuristic. Уже есть `architecture-check.js` и индекс символов из context pack. Проверки: файл существует, класс/метод упомянут в прочитанных файлах. Language-specific — Phase 2, пересекается с `Language-Aware Arch Check`.
3. **All blocks grounded vs mixed** — patch-safe section должен быть полностью grounded. Assumptions могут быть в `result.txt`, но НЕ в `patch-safe-result.md`. Это суть контракта.
4. **Approval/DA auto-downgrade** — да, devil's advocate ДОЛЖЕН мочь downgrade с `implementation-ready` до `diagnostic`. Одна из самых ценных его функций. Только downgrade, не upgrade.

**Рекомендации по реализации:**

- Batch 1+2 стартовать вместе (marker + evidence binding) — дают немедленное улучшение.
- Batch 3 — самый сложный. Для MVP symbol validation: сравнивать referenced symbols с тем, что реально попало в `contextBundle` (прочитанные файлы + индекс). Не нужен отдельный парсер — достаточно string matching по именам классов/методов.
- Batch 4+5 — чистые, зависят от 1-3.

**Риск:** если gate слишком строгий — большинство runs станут `DIAGNOSTIC`. Нужен баланс: gate ловит явный drift (`authService.getCurrentUserId()` vs `Utils.getCurrentUserPltId()`), но не блокирует на мелких расхождениях в форматировании.

---

## Discussion Response: Gemini CLI — 2026-03-13

### Verdict

**Ready to Implement. Essential next step for operational trust.**

I fully agree with the problem definition and Claude's assessment. Generating a smart analytical answer that *looks* like a safe copy-paste patch but actually contains hallucinated symbol seams (like `authService.getCurrentUserId()` instead of the actual local API) is the most dangerous failure mode right now. A binary contract (`PATCH_SAFE` vs `DIAGNOSTIC`) is the perfect solution.

### Additions to Open Questions & Architecture

1. **The Diagnostic vs Patch-Safe split:** Claude is exactly right. `result.txt` should remain the human-readable narrative. The `patch-safe-result.md` artifact should only be generated if the gate is passed, serving as a strict "ready to apply" artifact.
2. **Heuristic validation is sufficient for MVP:** We already have the `contextBundle` and the AST-based `.code_index.json`. We can do a string-matching pass: if the proposed patch block introduces a new method call that doesn't exist in the read files or the index, it fails the gate. 
3. **Auto-downgrade by DA:** Yes. If `devil's-advocate` finds an ungrounded assumption or a severe risk, it should automatically strip the `PATCH_SAFE` status and force the result into `DIAGNOSTIC` mode.

### Execution Sequence

I agree with Claude's rollout suggestion:
Start with **Batch 1 (Contract Definition)** + **Batch 2 (Evidence Binding)** + **Batch 4 (Assumption Segregation)**. These three changes are entirely prompt-driven and format-driven. We can teach the `synthesizer` to output the strict `Grounded fixes` vs `Assumptions` format immediately, without writing complex validation code yet. Once the format is stable, we can write the engine logic for Batch 3 (Heuristic Validation) and Batch 5 (Dedicated Artifact).

## Current Consensus (After Claude + Gemini Reviews)

This consensus block is the Codex synthesis response after Claude and Gemini
reviews.

### Verdict

**Ready to implement. Keep this feature at `P0 core`.**

### Closed Open Questions

1. **`result.txt` vs `patch-safe-result.md`**
   Consensus: keep `result.txt` as the human-readable operator narrative.
   `patch-safe-result.md` becomes the strict apply-ready artifact.

2. **Heuristic vs language-specific validation**
   Consensus: heuristic validation is sufficient for MVP. Use read-file
   evidence, the code index, and obvious seam-drift checks first.

3. **Mixed answers**
   Consensus: mixed answers are acceptable only in `DIAGNOSTIC` mode.
   `PATCH_SAFE` output must contain only grounded patch content.

4. **Auto-downgrade**
   Consensus: approval and Devil's Advocate may downgrade a run from
   `PATCH_SAFE` to `DIAGNOSTIC`, but must not upgrade in the opposite direction
   without the patch-safe gate succeeding.

### Agreed MVP Baseline

- The hub must emit a binary final contract:
  - `RESULT_MODE: PATCH_SAFE`
  - `RESULT_MODE: DIAGNOSTIC`
- `result.txt` remains operator-facing and readable.
- `patch-safe-result.md` is created only when the patch-safe gate passes.
- Patch-safe output may contain only grounded fixes.
- Assumptions and inferred guidance must stay explicit and segregated.

### Accepted Execution Order

The agreed MVP implementation sequence is:

1. **Batch 1. Patch-Safe Result Contract**
2. **Batch 2. Evidence Binding For Patch Claims**
3. **Batch 4. Assumption Segregation**
4. **Batch 3. Symbol / Seam Validation**
5. **Batch 5. Dedicated Patch-Safe Artifact**

Rationale:

- Batches `1 + 2 + 4` are prompt/format-first and immediately improve operator
  trust without waiting for engine-heavy validation.
- Batch `3` should validate an already-stable patch-safe format instead of
  defining that format itself.
- Batch `5` should land only after the gate semantics are already trustworthy.

### Implementation Notes Accepted From Review

- Heuristic validation should use:
  - files actually read during the run;
  - symbol/index data already available from the code index;
  - obvious seam-drift checks for invented services, methods, and fields.
- The gate should be strict enough to catch clear drift, but not so strict that
  harmless wording or formatting differences collapse most runs into
  `DIAGNOSTIC`.
- `patch-safe-result.md` must not be created if the gate fails.

## Implementation Status

### Landed So Far

- **Batch 1 (partial):** `result.txt` already carries an explicit trust header
  via `RESULT_MODE` and `COPYPASTE_READY`.
- **Batches 1 + 2 + 4 (prompt/format slice):**
  - consensus and revision prompts now require the strict structure:
    - `## Grounded Fixes`
    - `## Assumptions / Unverified Seams`
    - `## Deferred Checks`
  - grounded implementation claims are explicitly required to include
    `Evidence:` anchors.
  - runtime now detects missing required sections and missing evidence anchors
    and records those gaps in `result-warning.txt`.
- **Batch 3 (heuristic seam validation):**
  - the runtime now tracks files actually observed during the run from both the
    context bundle and tool-driven file reads;
  - final trust mode is now decided by a heuristic grounding gate, not only by
    prompt format;
  - `PATCH_SAFE` is granted only when:
    - required sections exist;
    - `Grounded Fixes` carry explicit evidence anchors;
    - evidence anchors point to files that exist and were observed in the run;
    - likely project-specific seams referenced in grounded code are confirmed by
      the symbol index or anchored file contents;
    - `Assumptions / Unverified Seams` does not contain substantive items.
- **Batch 5 (dedicated strict artifact):**
  - `.ai/prompts/patch-safe-result.md` is now written only when the patch-safe
    gate passes;
  - the strict artifact contains the grounded patch surface, not the full
    narrative answer;
  - non-patch-safe runs delete any stale patch-safe artifact instead of leaving
    a misleading old file behind.

### Still Open

- richer language-specific validation beyond heuristic seam checks;
- deeper evidence aggregation beyond observed files + symbol index;
- optional stricter patch artifact shaping per language/ecosystem.

### Code Review: Full MVP — Claude (2026-03-13)

**Verdict: Accepted**

**Reviewed files:**
- `ai/scripts/generate-context.js` — core logic (~lines 2937-3325, integration ~5010-5030, ~5260-5285)
- `ai/scripts/domain/prompt-content.js` — OUTPUT CONTRACT in prompts (lines 90-155)
- `ai/scripts/path-utils.js` — `patchSafeResultPath` layout (line 161)
- `ai/scripts/__tests__/generate-context.contract.test.js` — 10 new tests (lines 315-456)

**Test result:** 369 pass, 0 fail, 1 skipped.

**All 5 batches landed:**

1. **Result Contract:** `RESULT_MODE` + `COPYPASTE_READY` header, `normalizeResultMode()` defaults to DIAGNOSTIC.
2. **Evidence Binding:** `extractEvidenceAnchors()` parses `Evidence: path/File.java:10`, validates against disk and code index, checks observed files.
3. **Symbol/Seam Validation:** `extractGroundedSeamCandidates()` extracts `receiver.method()` and `new Type()` from code blocks; `isLikelyProjectReceiver()` filters standard types (String, Math, console) via `STANDARD_SEAM_RECEIVERS` whitelist (22 entries); `LIKELY_PROJECT_RECEIVER_SUFFIXES` (17 entries) catches project-specific types. Seams validated against `indexedSymbols` and anchored file contents.
4. **Assumption Segregation:** `analyzeEvidenceGroundedResultStructure()` checks 3 required sections; `hasSubstantiveEvidenceSection()` distinguishes real items from "None" via `EVIDENCE_NONE_PATTERNS`. Prompt contract in `prompt-content.js` instructs agents to write format and forbids self-assigning `RESULT_MODE`.
5. **Dedicated Artifact:** `buildPatchSafeResultContent()` writes strict `patch-safe-result.md` with only Grounded Fixes + Deferred Checks. Created only on gate pass, deleted on DIAGNOSTIC (line 5029-5031). DA revision re-evaluates trust (line 5274-5285).

**Strengths:**

- Gate logic is safe: `allAgreed + patchSafeEligible` required, default = DIAGNOSTIC.
- Symbol validation well-calibrated: catches pilot failure case (`authService.getCurrentUserId()` vs `Utils.getCurrentUserPltId()`), does not false-positive on standard library calls.
- DA downgrade works correctly: re-assessment after revision, stale artifact cleanup.
- Prompt contract clean: agents instructed on format, explicitly forbidden from writing trust headers.

**Observations (non-blocking):**

1. `anchoredContents` re-reads files from disk (line 3145-3154) — could reuse context bundle contents. Not critical for MVP.
2. `extractGroundedSeamCandidates` catches `receiver.method()` and `new Type()` only — static imports and field access without call are not covered. Sufficient for MVP seam patterns.

---

## Code Review: Gemini CLI — 2026-03-14 (False Positives Fix)

### Verdict

**Accepted.**

Codex effectively resolved the annoying parser bug that was causing false-negative `DIAGNOSTIC` downgrades. 
During the pilot, the heuristics gate was overly aggressive, treating Java localization keys (like `error.template.not.found`) as missing Java files because of the dotted notation. 
The fix is two-fold and solid:
1. **Parser level:** The `generate-context.js` logic now filters out multi-dot constants from the evidence anchor array.
2. **Prompt level:** Agents are now explicitly instructed not to cite message keys, enums, or constants as `Evidence:` files in the `Grounded Fixes` block.

This perfectly balances strictness and pragmatism. We keep the strict grounding gate, but stop punishing the agent for legitimate architectural constants.

---

## Code Review: Claude — 2026-03-14 (Patch-Safe False Negatives — 5 Batch Chain)

### Verdict

**Accepted.**

### Scope

5 consecutive batches forming one logical chain: fix ast-grep CLI → bundle binary → live rerun → telemetry → first false-negative fix.

### Reviewed files

- `ai/scripts/structural-search.js` (502 lines) — CLI fix, case-preserving tokens, bundled binary detection
- `ai/scripts/domain/prompt-content.js` (433 lines) — same-language guardrails, dotted-constant contract
- `ai/scripts/generate-context.js` — `buildFinalTrustSignal()`, `shouldValidateUnknownEvidenceAnchor()`, telemetry logging
- `ai/scripts/structural-search-ab.js` (585 lines) — A/B test harness
- `ai/scripts/__tests__/structural-search.test.js` — updated tests for new functions
- `ai/scripts/__tests__/structural-search-ab.test.js` — 3 tests for A/B harness
- `ai/scripts/__tests__/generate-context.contract.test.js` — dotted-key test (lines 432-466)
- `ai/scripts/__tests__/prompt-content.test.js` — same-language + contract tests

**Test result:** 388 tests, 387 pass, 0 fail, 1 skipped.

### Batch-by-batch assessment

**1. Fix ast-grep CLI invocation + case-preserving tokens:**
`runAstGrepSearchCommand()` tries `run --pattern` first, falls back to legacy `scan --pattern`. `collectStructuralQueryTokens()` rewritten to preserve raw case from prompt text and prioritize code-like identifiers (camelCase, `$`, known suffixes like Handler/Service/Controller) with index-aware scoring. Without this, ast-grep was technically installed but never produced useful results on real prompts.

**2. Productize ast-grep as optional bundled dependency:**
`resolveAstGrepCommandCandidates()` checks: env override → `node_modules/.bin/` → `@ast-grep/cli/` package → system PATH. `optionalDependencies` means install failure on unsupported platforms doesn't break the kit. Doctor reports availability. `THIRD_PARTY_NOTICES.md` added for release compliance.

**3. Live rerun validation:**
`backendUsed=ast-grep`, `fallback=false`, 72 structural symbols. Result still `DIAGNOSTIC` — confirming that the next blocker is evidence-grounding precision, not structural search. This data-driven pivot is exactly how the pipeline should evolve.

**4. Structured finalTrust telemetry + same-language guardrails:**
`buildFinalTrustSignal()` emits machine-readable signal: `resultMode`, `contractGapCount`/`groundingGapCount`, categories, samples, anchor/file/seam counts. `buildSameLanguageInstruction()` injected into all 8 user-facing prompt builders — prevents Russian prompts drifting into English responses.

**5. Fix dotted message keys as false evidence anchors:**
`shouldValidateUnknownEvidenceAnchor()` skips validation for tokens with >2 dots that aren't in the index and don't contain `/`. This correctly filters `error.template.not.found` while preserving validation for real file paths. Prompt contract updated to forbid citing message keys as evidence.

### Strengths

1. Each batch motivated by real pilot data, not speculation.
2. A/B harness provides reproducible offline validation — results show 3/5 prompts now produce different (better) structural search output with ast-grep vs index.
3. Same-language instruction is a cross-cutting fix that improves all agents simultaneously.
4. Telemetry design is compact but complete — categories + samples enable diagnosis without dumping raw warnings.

### Observation (non-blocking)

`shouldValidateUnknownEvidenceAnchor` uses `dotCount <= 2` heuristic. This could theoretically skip a real file with a deeply nested package-style name (e.g., `com.example.service.Impl.java` has 4 dots). In practice, evidence anchors use project-relative paths (e.g., `src/main/java/...`), so risk is minimal.

---

## Cross-Model Diagnosis Decision (2026-03-14)

### Decision: Root cause identified — conservative bias

Cross-model diagnosis completed. All reviewers (Gemini CLI, Claude Opus 4.6)
converged on the same root cause:

- The remaining `substantive-assumptions` blocker is caused by **conservative
  bias**, not by retrieval failure, debate behavior, or approval pressure.
- Evidence-Grounded Patch Mode + approval scoring penalties make agents avoid
  anything outside their narrow structural extraction keyhole.
- The keyhole (method-level ast-grep snippets) is accurate but too narrow for
  architectural fixes.

### Accepted Next Step

Expand structural extraction window (Lever 2 enhancement in
`ANSWER_DEPTH_IMPROVEMENT.md`): include parent class fields, constructor,
imports, and interface signatures alongside the matched method.

### Deferred

- Lever 3 (critique-driven expansion) — try keyhole widening first.
- Compare-path logic — not needed if context is sufficient.
- Deeper agentic read loop (Lever 4) — long-term separate mode.

Full decision record: `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md` →
"Cross-Model Diagnosis Decision (2026-03-14)".

## Validation Outcome (2026-03-15)

The widened structural keyhole was validated with two live reruns on the same
`<TARGET_PROJECT>` prompt.

Outcome:
- seam discovery improved materially; agents reached broader approval-flow
  evidence instead of staying trapped in a single method
- one rerun reached the `ApprovalSetting -> ApprovalInstance` seam
- but both reruns still ended with
  `groundingGapCategories=substantive-assumptions` and
  `patchSafeEligible=no`

Interpretation:
- the "conservative bias" diagnosis was real, but only partial
- widening the initial structural slice helps retrieval depth, yet it does not
  by itself satisfy patch-safe evidence requirements for the remaining
  approval-flow case

Decision:
- do not widen the default keyhole further right now
- the next justified step is **Lever 3: critique-driven context expansion**
- full validation record and rationale live in
  `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
