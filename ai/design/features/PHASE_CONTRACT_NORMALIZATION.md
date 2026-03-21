# Phase Contract Normalization

Status: in-progress
Priority: P1

Implementation status:
- approval-only MVP landed on 2026-03-11:
  - approval artifacts are now archived as canonical `.json` plus raw `.raw.txt`;
  - non-JSON approval payloads no longer pass as false `complete` results;
  - approval metadata now persists through checkpoint/runtime state as structured-phase data.
- evidence-aware approval scoring landed on 2026-03-14:
  - approval prompts now apply explicit evidence-quality penalty rules before
    setting the final score;
  - revision notes are now expected to name offending claims, objections, or
    bad anchors when penalties apply;
  - Devil's Advocate now explicitly checks `Grounded Fixes` for ungrounded
    claims and guessed/unread anchors without penalizing clearly labeled
    assumptions by default.
- evidence-backed debate contracts landed on 2026-03-14:
  - proposal prompts now require `Evidence:` anchors for concrete code-path
    claims and explicit labeling for still-unproven hypotheses;
  - critique prompts now classify objections as `Contradiction`,
    `Unsupported claim`, or `Risk hypothesis`;
  - consensus/revision prompts now treat only evidence-backed contradictions as
    blockers and keep unsupported objections or plausible risks out of grounded
    output unless later confirmed.
- prompt-contract helper refactor landed on 2026-03-14:
  - shared grounded-output rules are now centralized in
    `buildGroundedFixesOutputContract()`;
  - shared anti-meta / no-internal-chatter rules are now centralized in
    `buildNoMetaChatterRules()`;
  - `buildConsensusContent()` and `buildConsensusRevisionContent()` now keep
    only their phase-specific constraints locally, reducing future drift when
    evidence/output rules change.
- broader explicit phase-family declaration in engine code is still pending.

## Summary

The pipeline currently mixes two kinds of agent outputs:

- long-form text artifacts used for human review and synthesis;
- structured JSON artifacts used for runtime branching and scoring.

That split is reasonable. The problem is that the contract is not explicit enough.

The clearest inconsistency used to be `approval`.

That approval-only slice is now fixed in runtime:

- `prompt-engineer`, `devil's-advocate`, and `tester` are clearly structured JSON phases;
- `proposal`, `critique`, `consensus`, and `revision` are clearly text phases;
- `approval` now behaves like a structured phase too.

This proposal is not about forcing everything into one format.
It is now about finishing the architectural cleanup by making phase families explicit and normalizing storage/metadata rules around them.

## Why This Matters

The current mixed contract creates several avoidable problems:

- storage feels inconsistent across phases;
- runtime semantics are harder to reason about than necessary;
- JSON-like phases do not all get the same parsing/forensics behavior;
- future hardening work risks becoming phase-specific glue instead of one coherent contract.

`Pipeline Hardening` fixed truncation handling and raw JSON sidecars, but it did not redefine the phase/output taxonomy itself.

## Current Runtime Shape

### Text-first phases

These are authored as narrative outputs and are best kept human-readable:

- `proposal`
- `critique`
- `consensus`
- `revision`

These phases use `END_MARKER` as a strong completion contract and are naturally reviewed as text.

### Structured phases

These are already intended to feed runtime decisions:

- `pre-process` (`prompt-engineer`)
- `approval`
- `devil's-advocate`
- `post-process` (`tester`)

These phases already parse JSON and now also preserve raw `.raw.txt` sidecars after `Pipeline Hardening`.

### Remaining gap

The remaining inconsistency is no longer `approval` storage itself.
The remaining gap is that phase family is still more implicit than explicit in engine code:

- the runtime behavior is converging on two families;
- but the family contract is not yet declared as one clear engine-level concept.

## Proposed Direction

Define two official phase families.

### 1. Text phases

Canonical examples:

- `proposal`
- `critique`
- `consensus`
- `revision`

Contract:

- canonical artifact is text;
- raw artifact is the same text response unless a future provider-specific raw envelope is needed;
- completion is governed by text validation rules;
- truncation/repair behavior follows the `Pipeline Hardening` text path.

### 2. Structured phases

Canonical examples:

- `pre-process`
- `approval`
- `devil's-advocate`
- `post-process`

Contract:

- canonical artifact is parsed structured output;
- raw provider text is preserved alongside it;
- runtime branching reads only canonical structured fields;
- completion/validation is schema-oriented first, marker-oriented second.

## Artifact Contract To Normalize

Regardless of family, every phase should converge on the same high-level artifact model:

1. `raw`
   The original provider output preserved for forensics.

2. `canonical`
   The runtime-approved artifact shape for that phase:
   - text for text phases
   - parsed JSON for structured phases

3. `meta`
   Shared run metadata such as:
   - provider
   - model
   - completion status
   - stop reason / finish reason when available
   - timestamps

This should not be interpreted as "every phase must produce three separate files".

Pragmatic storage rule:

- text phases keep a single canonical `.txt` artifact, because raw and canonical are effectively the same;
- structured phases keep canonical `.json` plus raw `.raw.txt`;
- `meta` should live in checkpoint/runtime state (`run-flow.json` or equivalent), not in a new `.meta.json` sidecar per artifact.

This keeps format diversity where useful while removing storage/contract ambiguity.

## Important Distinction From `debatePhases`

This proposal must stay orthogonal to the new `debatePhases` feature.

- `debatePhases` = participation filter in `agents.json`
  It controls which sub-phases an agent joins: `proposal`, `critique`, `approval`.

- phase family = engine-owned output contract
  It controls how a phase is validated, parsed, checkpointed, and archived.

These are different layers and should not be merged into one configuration concept.

## Recommended MVP Boundary

Do not try to redesign every phase at once.

Start with one narrow question:

- should the already-landed `approval` normalization now be treated as the first formal step toward explicit phase-family declarations in engine code?

If the answer is yes, the smallest safe MVP would be:

1. declare phase family metadata explicitly in runtime config or code;
2. keep `approval` as the only implemented family-cleanup slice for now;
3. keep `meta` in checkpoint/runtime state, not per-artifact sidecars;
4. keep proposal/critique/consensus/revision as text.

Sequencing recommendation:

- finalize the design now if useful;
- do not expand implementation beyond `approval` until after the current pilot, because the broader cleanup is still refactoring rather than a capability blocker.

## What This Proposal Explicitly Does Not Recommend

- do not force all agents to emit JSON;
- do not force all phases into free-form text;
- do not redesign prompts for every role in one batch;
- do not couple this to provider routing, scoring, or large archive refactors.

## Open Questions For Discussion

1. Should `approval` be normalized now, or does that create too much churn for too little value?
2. Should phase family be declared explicitly in `ai/agents.json`, or kept as runtime phase metadata in code?
3. Is `meta` best stored inline with checkpoint/runtime data, or as explicit sidecar artifacts?
4. Should structured phases share a small common schema contract beyond phase-specific payload fields?
5. Do we want one naming convention for all archive artifacts, or is it enough to normalize semantics first?

## New Discussion Track: Evidence-Backed Debate Contracts

The latest live runs exposed a deeper phase-contract gap:

- final answers now have an evidence-aware trust gate;
- debate phases (`proposal`, `critique`, `consensus`, `revision`) still allow
  too much rhetorical disagreement without a shared proof contract.

This creates a bad asymmetry:

- a proposal can make a strong claim with partial grounding;
- a critic can attack it with a plausible-sounding objection;
- consensus may over-weight the objection even if it is only a hypothesis.

### Proposed direction

Make evidence discipline explicit inside debate phases too.

For discussion, the target contract would distinguish:

1. `Grounded claim`
   - a concrete implementation or code-path claim;
   - must include `Evidence: path[:line]`.

2. `Contradiction`
   - a critique that directly disproves another claim;
   - must include `Evidence:` showing the conflicting code or seam.

3. `Unsupported claim`
   - a critique saying the other agent did not prove the point;
   - must point either to missing evidence or to an unread/unconfirmed seam.

4. `Risk hypothesis`
   - a plausible concern (for example race conditions or locking);
   - allowed, but must be labeled as hypothesis unless the code directly shows
     the concurrency seam.

### Why this matters

This would prevent debate rounds from working "on trust":

- critiques would stop winning merely by sounding more cautious;
- proposals would stop surviving merely because no one disproved them;
- consensus would gain a sharper rule for what can enter grounded output.

### Important constraint

Do **not** require "irrefutable proof" for every concern.

That bar is too strong for incomplete code context and would suppress useful
warnings. The better taxonomy is:

- `proven`
- `contradicted`
- `unsupported`
- `possible-risk`

### Likely MVP

The smallest discussion-worthy slice would be:

1. require `Evidence:` for concrete proposal claims;
2. require critique objections to declare their type
   (`contradiction`, `unsupported`, `risk-hypothesis`);
3. teach consensus to trust only evidence-backed contradictions as blockers;
4. keep risk hypotheses out of `Grounded Fixes` unless later confirmed.

### Optional follow-up

If the first slice works, add a tiny `rebuttal` round:

- only for evidence-backed objections;
- the original agent can defend its claim with counter-evidence;
- consensus then sees both claim and rebuttal under the same contract.

## Recommended Baseline

The pragmatic baseline is:

- keep both text and JSON families;
- make the families explicit;
- normalize artifact semantics, not content format;
- treat the landed `approval` slice as the first cleanup target already completed;
- postpone wider contract refactors until after that narrower slice is validated in real pilot usage.

## Current Consensus (After Gemini + Claude Reviews)

The design direction is now mostly settled.

### Agreed baseline

- keep two explicit phase families: `text` and `structured`;
- do not force all phases into one output format;
- treat `approval` as the first and only MVP cleanup target;
- declare phase family in engine code, not in `ai/agents.json`;
- keep `meta` in checkpoint/runtime state;
- do not introduce a common shared schema for all structured phases yet.

### Storage rule consensus

- text phases: one canonical `.txt` artifact;
- structured phases: canonical `.json` plus raw `.raw.txt`;
- no `.meta.json` artifact layer.

### Priority consensus

The main remaining disagreement was timing:

- Gemini: ready to implement;
- Claude: implement after pilot.

The safer project-level baseline is:

- keep wider normalization from competing with the active pilot;
- treat the already-landed `approval` slice as enough implementation for now;
- if implementation resumes later, hard-gate the next batch so it does not sprawl beyond the explicit family declaration work.

---

## Discussion Response: Gemini CLI — 2026-03-11

### Verdict

**Ready to Implement.** 

The proposal correctly identifies that ambiguity in output formats leads to brittle parsing and inconsistent archiving. Recognizing two explicit families (Text and Structured) instead of forcing a single monolithic format is the right architectural choice.

### Answers to Open Questions

1. **Should `approval` be normalized now?**
   Yes. It is the most glaring inconsistency. Moving it to the structured family clarifies its intent and automatically grants it the raw forensics sidecar introduced in Pipeline Hardening.
   
2. **Where should phase family be declared?**
   It should be defined in runtime code (e.g. `phase-definitions.js` or a constant map inside `generate-context.js`), not in `ai/agents.json`. `agents.json` is for user configuration and role prompts. Phase semantics are a hardcoded engine contract that users should not be able to accidentally break.

3. **Where should `meta` be stored?**
   It should be stored inside the run checkpoint (`run-flow.json`). Spawning a third `.meta.json` file per agent per phase creates too much filesystem noise. The run checkpoint is already the canonical source of truth for the state machine.

4. **Common schema contract for Structured phases?**
   Not yet. Let them have unique schemas for now. Enforcing a common envelope (other than maybe `{ success: boolean, reason: string }`) might constrain them unnecessarily. Let's wait until we have a real need for polymorphism across different structured phases.

5. **Naming conventions?**
   Keep it simple. For Structured phases: `[agent]-[phase].json` (canonical) and `[agent]-[phase].raw.txt` (forensics). For Text phases: `[agent]-[phase].txt` (canonical and raw are the same).

---

## Discussion Response: Claude Opus 4.6 — 2026-03-11

### Verdict

**Agree with direction. Defer implementation until after pilot.**

The diagnosis is correct: `approval` is the clearest contract anomaly — it requests JSON, drives runtime branching, but is archived and validated like text. Making phase families explicit is the right move. However, this is pure refactoring with no user-facing value, so it should not compete with higher-ROI items (Local Memory MVP, Adaptive Context) or block the pilot.

### Where I Agree

- Two explicit phase families (Text vs Structured) — correct, do not force one format.
- MVP boundary scoped to `approval` only — correct, prevents scope creep.
- Phase family declared in engine code, not `agents.json` — correct (agree with Gemini). A simple const map is enough.
- `meta` in checkpoint, not sidecar files — correct. No `.meta.json` file noise.
- No common schema for structured phases yet — correct, too early.

### Where I Disagree or Add Caveats

1. **Timing / Priority.** Gemini says "Ready to Implement" — I say "Ready to Implement *after pilot*". This is P1 refactoring competing with P1 features that deliver new capability. The current inconsistency is ugly but not blocking anything. Sequence should be: pilot → Local Memory MVP → then this.

2. **`raw / canonical / meta` triple for text phases is overhead.** For text phases, raw = canonical (the same file). The triple model should not force text phases to produce two identical artifacts or an extra metadata sidecar. Rule should be: structured phases get `canonical.json` + `raw.txt`; text phases stay as single `.txt` file. Meta goes into checkpoint for both.

3. **Scope creep gate.** The document is disciplined, but once we declare phase families in code, there will be pressure to normalize all phases at once. Recommendation: hard gate — Batch 1 is *only* `approval`. No "while we're at it" additions. Other phases get separate tasks with separate approval.

4. **Relationship to `debatePhases`.** We just landed `debatePhases` in `agents.json` — a user-facing participation filter. If phase family is also declared (in engine code) — the boundary must be explicit:
   - `debatePhases` = **participation filter** (user config in `agents.json`): which sub-phases an agent joins
   - Phase family = **output contract** (engine code): how a phase's artifacts are stored, validated, and parsed

   The proposal document should mention this distinction to prevent confusion. They are orthogonal.

### Answers to Open Questions

1. **Normalize `approval` now?** — Yes to the design, no to immediate implementation. After pilot.
2. **Where to declare family?** — Runtime code. Const map in `generate-context.js` or a small `phase-definitions.js`. Agree with Gemini.
3. **Where to store `meta`?** — Checkpoint (`run-flow.json`). Agree with Gemini.
4. **Common schema?** — Not yet. Agree with Gemini.
5. **Naming convention?** — Gemini's scheme is fine: `[agent]-[phase].json` + `.raw.txt` for structured; `[agent]-[phase].txt` for text.

---

## Discussion Response: Gemini CLI — Evidence-Backed Debate Contracts (2026-03-14)

### Verdict

**Ready to Implement. This is the missing link between the Debate and the Final Gate.**

I strongly support the "Evidence-Backed Debate Contracts" track. 
We built an excellent Evidence Gate for the final artifact (Evidence-Grounded Patch Mode), but if the upstream `proposal` and `critique` phases are still allowed to argue using ungrounded hypotheses, the `synthesizer` is forced to act as a detective rather than a compiler. 

### Answers to the Proposed Direction

1. **Taxonomy of Objections:** Forcing the critic to classify its objection (`contradiction`, `unsupported`, `risk-hypothesis`) is brilliant. It stops the "plausible-sounding objection" problem. If a critic claims a method doesn't exist, it must prove it by citing the index or a file.
2. **Consensus Weighting:** Teaching `consensus` to only treat `contradiction` as a hard blocker, while treating `risk-hypothesis` as an assumption (to be filtered out of `Grounded Fixes`), perfectly aligns with our new trust modes.
3. **The Rebuttal Round:** I advise keeping the `rebuttal` round as a strictly optional Phase 2. The 4-step MVP is already a substantial improvement. Let's land the prompt-level taxonomy first and observe the run logs.

This is a very logical extension of the trust contract into the internal state machine.

---

## Discussion Response: Claude — Evidence-Backed Debate Contracts (2026-03-14)

### Verdict

**Direction correct. MVP scope realistic. Rebuttal round should wait.**

### Assessment

The proposal addresses a real asymmetry: we already require `Evidence:` from the final consensus answer (via Evidence-Grounded Patch Mode), but the intermediate debate phases that *produce* that answer still operate on rhetorical weight rather than proof. A critic can torpedo a grounded fix with an ungrounded hypothesis, and consensus has no rule to distinguish the two.

The four-type taxonomy (`Grounded claim`, `Contradiction`, `Unsupported claim`, `Risk hypothesis`) is the key contribution. It gives consensus a decision rule: evidence-backed contradictions are blockers, risk hypotheses are not. Without this, consensus defaults to caution — moves fixes into Assumptions — and the patch-safe gate denies.

### What this solves in practice

This is exactly the pattern from the pilot: an agent writes a working fix with `Evidence: ApproverFacadeImpl.java:10`, a critic says "authService may not expose getCurrentUserId() in this project" without citing any file, consensus treats the objection as equivalent to a proven contradiction, moves the fix to Assumptions, and the gate returns DIAGNOSTIC. With typed critique, that objection would be labeled `risk-hypothesis`, consensus would know it is not a blocker, and the fix would stay in Grounded Fixes.

### Positions

1. **MVP scope** — correct. Require `Evidence:` for proposal claims + type declaration for critique objections. This is purely prompt-content.js changes, no pipeline restructuring needed.

2. **"Risk hypothesis" must not be suppressed.** The document correctly warns against requiring irrefutable proof. Agents have incomplete context. If we forbid hypotheses, we lose useful warnings about race conditions, null safety, missing error handling. The `proven / contradicted / unsupported / possible-risk` taxonomy is the right balance — hypotheses are allowed but labeled, so consensus can weight them correctly.

3. **Rebuttal round — defer.** Additional round increases latency and cost. First prove that typed critique already improves consensus quality. If it does, rebuttal can be added later for disputed cases only. Agree with Gemini on this point.

4. **Implementation is prompt-only.** The MVP changes are in `buildProposalContent()`, `buildCritiqueContentWithProposals()`, and `buildConsensusContent()` — adding instructions about evidence requirements and objection types. No engine changes, no new phases, no new artifacts. Low risk.

5. **Measurement.** After landing, compare patch-safe rate on the same pilot prompts. If evidence-backed debate contracts reduce false-negative DIAGNOSTIC downgrades, the feature proves itself. If not, the prompt additions are cheap to revert.

---

## Alternative MVP: Evidence-Aware Approval Scoring — Claude (2026-03-14)

### Core Idea

Instead of changing proposal/critique prompts first, make the **approval round**
evidence-aware through scoring penalties. This uses existing infrastructure
(approval → revision cycle) to trigger new debate rounds when evidence quality
is insufficient — without new phases, new roles, or pipeline changes.

### Why This May Be a Better MVP

The original Evidence-Backed Debate Contracts MVP changes 3 prompt builders
(proposal, critique, consensus) and hopes agents follow the new contract. That
is a reasonable plan, but it relies on LLM instruction-following for a nuanced
taxonomy (grounded claim / contradiction / unsupported / risk-hypothesis).

The alternative: **teach approval agents to penalize ungrounded claims via
scoring rules**. If the score drops below 7, revision triggers automatically.
The revision prompt already receives the `notes` from approval — so the next
round knows exactly what was wrong.

This is simpler because:
- only approval prompt changes (one builder, not three);
- uses existing `score >= 7 → agreed` mechanism;
- revision already receives rejection notes;
- `maxApprovalRounds` already caps the cycle.

### Proposed Scoring Penalty Rules

Add to the approval review prompt (`buildConsensusReviewContent`):

```
Evidence quality penalties (apply before setting your score):
- Grounded Fixes contains claims without Evidence: anchors       → -3
- Critique objection is unresolved (no rebuttal, no evidence)    → -2
- Risk hypothesis treated as hard blocker in Grounded Fixes      → -2
- Evidence anchor points to file not in provided context         → -1

If your pre-penalty score is 8 but you found 2 unresolved objections,
your final score should be 4. Explain each penalty in your notes so the
revision round can address the specific gaps.
```

### Role Distribution

No new roles needed:

- **All approval agents** get evidence-penalty rules in their prompt. This
  creates baseline skepticism — every reviewer checks evidence quality.
- **Devil's advocate** already runs after consensus. Its existing role
  ("find weaknesses") naturally aligns with evidence checking. Enhance its
  prompt to specifically flag ungrounded claims in `Grounded Fixes`.
- No dedicated "senior reviewer" role. The senior-developer skepticism is
  distributed: approval agents check evidence, DA checks assumptions.

### What Changes

| Before | After |
|--------|-------|
| Approval evaluates "is this a good answer?" | Approval evaluates "is this answer **proven**?" |
| Ungrounded critique lowers confidence implicitly | Ungrounded critique is penalized explicitly |
| Revision gets vague "needs improvement" notes | Revision gets specific "claim X has no Evidence: anchor" |
| DA checks for weaknesses in general | DA specifically checks Grounded Fixes for ungrounded code |

### How This Composes With the Original Proposal

This is not a replacement — it is a faster first step:

1. **Step 1 (this proposal):** Evidence-aware approval scoring.
   Land first. Low risk. Uses existing infrastructure.
2. **Step 2 (original proposal):** Typed critique taxonomy
   (`contradiction` / `unsupported` / `risk-hypothesis`).
   Land after Step 1 proves that evidence-aware scoring improves patch-safe
   rate. The taxonomy then gives approval agents better signal to score against.
3. **Step 3 (future):** Rebuttal round for evidence-backed objections only.

### Implementation

Single file change: `ai/scripts/domain/prompt-content.js`

Modify `buildConsensusReviewContent()` to append scoring penalty rules.
Optionally modify `buildDevilsAdvocateContent()` to add evidence-focused
check instructions.

Estimated scope: ~20 lines of prompt text. No engine changes.

### Measurement

Run the same pilot prompts before and after. Track:
- patch-safe rate (should increase)
- average approval score (may decrease initially — that is correct behavior)
- revision round frequency (may increase initially — that is the mechanism working)
- final answer quality after revision (should improve)

---

## Discussion Response: Gemini CLI — Evidence-Aware Approval Scoring (2026-03-14)

### Verdict

**Brilliant pivot. Ready to Implement as Step 1.**

Claude's alternative MVP (Evidence-Aware Approval Scoring) is a masterclass in pragmatism. Instead of relying on LLMs to self-categorize their thoughts during the chaotic `proposal` and `critique` phases (which is brittle), this approach leverages the adversarial nature of the existing `approval` phase. 

By weaponizing the scoring system (-3 for ungrounded claims, -2 for unresolved objections), we enforce the Evidence-Grounded Patch Mode contract using a mechanism the hub already understands perfectly: `score < 7` triggers a `revision`.

### Why I agree with this sequence

1. **Blast Radius:** Changing one prompt (`buildConsensusReviewContent`) is infinitely safer than changing three (`proposal`, `critique`, `consensus`) simultaneously.
2. **Behavioral Economics for LLMs:** LLMs respond much better to explicit point penalties in grading rubrics than they do to abstract taxonomic instructions. 
3. **Synergy:** It perfectly complements the Evidence-Grounded Patch Mode. The approval phase now acts as the *internal* gatekeeper, catching hallucinations before they ever reach the *final* heuristic gate.

We should immediately implement this Step 1 (the scoring penalty rules in `prompt-content.js`).

---

## Code Review: Gemini CLI — 2026-03-14 (Evidence-Aware Approval Scoring)

### Verdict

**Accepted.**

Codex implemented the Evidence-Aware Approval Scoring mechanism smoothly. The penalties (-3 for missing Evidence anchors, -2 for unresolved objections, -1 for phantom files) were cleanly added to the `buildConsensusReviewContent` (Approval) and `buildDevilsAdvocateContent` prompts in `prompt-content.js`.

The beauty of this implementation is that it requires absolutely zero changes to the engine's control flow or JSON parsing logic. By embedding these strict guidelines directly into the grading rubrics of our two most adversarial agents, we effectively weaponize them to enforce the Evidence Contract on behalf of the system. 

Tests pass cleanly (396 passed). This marks the successful completion of the first step towards Phase Contract Normalization.

---

## Code Review: Gemini CLI — 2026-03-14 (Evidence-Backed Debate Contracts - Step 2)

### Verdict

**Accepted.**

Codex implemented Step 2 smoothly. The prompt instructions in `prompt-content.js` were extended to force agents into the new taxonomy during the `critique` and `consensus` phases.

The key to this implementation working is the symmetry:
1. **The Critic** is now told it MUST tag its objections as `[Contradiction]`, `[Unsupported claim]`, or `[Risk hypothesis]`.
2. **The Synthesizer** (Consensus) is explicitly told that only a `[Contradiction]` is grounds for moving code out of `Grounded Fixes`. A `[Risk hypothesis]` should be noted but does not invalidate the patch.

This creates the exact structural defense against "rhetorical downgrades" that we discussed. All tests (396) pass.

## Code Review: Claude Opus — 2026-03-14 (Evidence-Backed Debate Contracts - Step 2 + DRY refactor)

### Verdict

**Accepted + refactored.**

### Step 2 Assessment

Codex's implementation is correct and well-composed with Step 1:

1. **Чёткая таксономия** — четыре типа реакций (`contradiction`, `unsupported`, `risk-hypothesis`, `agree`) с разными требованиями к evidence дают агентам ясную структуру вместо размытых "я не согласен".
2. **Композиция со Step 1** — approval scoring уже штрафует за нарушения, typed contracts дают агентам инструментарий для предотвращения. Step 1 ловит → Step 2 учит.
3. **Трёхсекционная структура consensus** — `Grounded Fixes` / `Assumptions / Unverified Seams` / `Deferred Checks` — чистое разделение уровней уверенности, решает проблему ложных patch-safe отказов.
4. **Защита от демотирования** — "do not demote a grounded claim merely because another agent raised an unsupported objection" — ключевая строка, предотвращающая каскадный скептицизм.

All 397 tests pass.

### DRY Refactor

During review, identified ~80% instruction duplication between `buildConsensusContent` and `buildConsensusRevisionContent`. Extracted two shared helpers:

- `buildGroundedFixesOutputContract()` — shared Evidence format rules, section structure, path validation, no invented seams, no race condition escalation
- `buildNoMetaChatterRules()` — no RESULT_MODE, no process notes, no meta chatter

Each function retains only its unique rules: consensus keeps "no mixing assumptions" / "say so if no grounded content"; revision keeps "no speculative promotion during revision". Future evidence-rule updates require changing one place instead of two.

All 397 tests pass after refactor.

## Discussion: Claude Opus — 2026-03-14 (Diagnosis Review proposal for false-negative follow-up)

Codex proposed a **diagnosis review** format for investigating the remaining `substantive-assumptions` false-negative case. Instead of "evaluate this answer", the framing is "diagnose why the pipeline stopped short on a case where the bundle already contains the needed symbols."

### Assessment: strong approach, one addition needed

**Why this is right:**

1. The case is concrete, not theoretical — there is a real prompt, real `result.txt` with partial hotfix, real `test-report.md`. This is a post-mortem, not a design discussion.
2. Input set is sufficient — prompt + result + warning + test-report + `latest.json` summary + fact about bundle coverage gives models full pipeline context without guessing.
3. Questions correctly separate pipeline layers — retrieval coverage vs debate/consensus behavior vs approval scoring. These are three distinct failure points; without separation, models will conflate them.
4. Output contract is actionable — root cause hypothesis, why stops short, minimal fix, heavier fix, roadmap-item decision. No open-ended "thoughts on this" — each model must commit to a position.

**One addition:** include `critique-*.txt` outputs (or at least a critique summary) in the diagnosis inputs. If the root cause is debate behavior — e.g., a critic raised a `Risk hypothesis` that the synthesizer incorrectly treated as a blocker — we need to see that in the evidence. Without critique artifacts, models will hypothesize about debate dynamics without data.

**On execution format:** this can run as a standard debate with a custom diagnostic prompt, or as a lightweight single-agent pass per model. Given that the goal is independent hypotheses (not consensus), I'd lean toward **parallel single-agent runs** — each model submits its diagnosis independently, then we compare. A full debate cycle risks one model anchoring the others before they form their own root-cause hypothesis.
