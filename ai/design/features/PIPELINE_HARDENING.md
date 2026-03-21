# Pipeline Hardening

Status: ready
Priority: P0

Implementation status:
- Batch 1 complete on 2026-03-10:
  - provider success metadata now surfaces normalized `stopReason` plus usage/headers;
  - `callAgent(...)` now returns `{ text, meta }`;
  - `callAgentWithValidation(...)` now returns `{ text, completionStatus, meta }`;
  - runtime call sites no longer depend on the old string-only contract.
- Batch 2 complete on 2026-03-11:
  - text responses are now classified as `complete`, `truncated`, or `invalid`;
  - truncation uses a two-signal rule: missing `END_MARKER` plus provider `stopReason` when available, or a narrow syntactic fallback when provider metadata is absent;
  - proposal / critique / consensus / revision paths no longer log truncated text outputs as plain `Completed`;
  - incomplete text outputs now stop the pipeline instead of silently flowing into later phases.
- Batch 3 complete on 2026-03-11:
  - truncated text outputs now get one bounded same-model repair pass before final status is set;
  - repair runs without tool/file access and uses a capped output budget `min(originalBudget, 1024)`;
  - repair uses continuation semantics instead of re-running the whole phase;
  - if repair still fails, the non-complete status remains visible and the pipeline stops.
- Batch 4 complete on 2026-03-11:
  - JSON phases now preserve both parsed `.json` artifacts and raw `.raw.txt` provider output sidecars;
  - Prompt Engineer, Devil's Advocate, and Tester no longer lose raw forensic evidence behind parser fallback objects;
  - checkpoint behavior stays unchanged: the parsed `.json` artifact remains the canonical structured output.

MVP status:
- The 4-batch Pipeline Hardening MVP is complete.
- Any remaining follow-up items in roadmap wording should be treated as separate optional extensions, not blockers for this MVP.

Review prompt:
- `ai/PIPELINE_HARDENING_REVIEW_PROMPT.md`

## Summary

Harden the multi-agent pipeline against partial-but-successful model outputs.

Current runtime already handles:
- provider errors and retries;
- `retry-after` aware waiting;
- preflight rate-limit gating;
- forced finalization after file-reader budget exhaustion.

But one reliability gap is still open:

- a provider can return a syntactically successful response that is actually truncated;
- runtime currently treats missing `END_MARKER` mostly as a warning;
- those partial outputs are still archived and logged as `Completed`.

## Why This Matters Now

Real pilot evidence from `/abs/path/to/<PILOT_PROJECT_A>` shows the problem clearly.

Affected archived artifacts:
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-architect-proposal.txt`
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-architect-critique.txt`
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-reviewer-proposal.txt`
- `.ai/prompts/archive/2026-03-10T18-06-53-492Z-reviewer-critique.txt`

Observed behavior:
- `architect` no longer collapsed to `Error: Max tool loops reached.` after the forced-finalization fix;
- however, both `architect` outputs still ended mid-sentence with no `=== END OF DOCUMENT ===`;
- `reviewer` outputs were even shorter and also ended mid-sentence;
- these artifacts were still logged as `Completed`.

This means the main defect is no longer "agent produced a raw fallback error".
The main defect is now:

- **partial successful outputs are not promoted to an explicit recovery path**.

## Claude Change Already Landed

Claude already moved the roadmap in the right direction.

`ai/ROADMAP.md` now contains a `Pipeline Hardening (Quick Wins)` item with:
- per-provider rate limit snapshot;
- truncation detection + auto-retry with increased budget;
- heuristic critique scoring.

This document turns that short roadmap bullet into a concrete discussion surface.

## Current Root Cause

The problem is not disk persistence.

The problem is control-flow classification:

1. provider returns `200 OK` (or equivalent success envelope);
2. response text is incomplete;
3. `END_MARKER` is missing;
4. runtime prints a warning;
5. artifact is still saved and logged as completed.

Two blind spots make this worse:

- successful-response `stop_reason` / `finishReason` is not surfaced in run decisions;
- success-side truncation is not classified as `repair-needed`.

## Likely Causes Of Partial Successful Outputs

The exact cause is not yet fully observable because success-side completion
metadata is not persisted today. But the current evidence suggests several
likely contributors:

### 1. Output budget exhaustion

This is the strongest hypothesis for long text phases.

Signals:
- multiple text artifacts end mid-sentence;
- they are missing `END_MARKER`;
- they still look semantically coherent up to the truncation point;
- active agent budgets are relatively tight for long analytical answers:
  - `architect.maxOutputTokens = 1536`
  - `reviewer.maxOutputTokens = 1536`
  - `synthesizer.maxOutputTokens = 1800`

Most likely meaning:
- provider reached its output boundary or another completion boundary before the
  document finished.

### 2. Provider-specific successful-but-incomplete termination

Not every incomplete answer is necessarily `max_tokens`.

Possible variants:
- provider-side finish reason equivalent to `length` / `max_tokens`;
- model-side early stop after internal completion heuristic;
- malformed structured-output path that still yields partial text.

This is especially relevant for Gemini because the repository already observed
`MALFORMED_FUNCTION_CALL` failures on adjacent runs.

### 3. Overloaded prompt contracts

Some phases demand:
- detailed analysis,
- references to peer outputs,
- JSON or semi-structured formatting,
- confidence marker,
- end marker.

That increases the chance that the model spends output budget on analysis body
and never reaches the tail requirements.

### 4. Recovery gap in runtime

Even if partial output is understandable, runtime currently:
- does not trigger repair;
- does not downgrade status;
- does not capture enough success metadata to explain why it stopped.

So a small provider-side incompleteness becomes a larger pipeline-quality defect.

### 5. Parsed JSON phases lose raw forensic evidence

For JSON-returning phases like Devil's Advocate, runtime currently stores the
parsed result object instead of the raw model text.

Implication:
- if the raw JSON/text was truncated, the archived artifact may only contain the
  parser fallback view (for example `success: false` plus truncated `summary`);
- the original raw provider output is not preserved for diagnosis.

This makes root-cause analysis weaker than for plain-text proposal/critique
phases.

## Proposed MVP

### 1. Add explicit output completion states

For text phases, runtime should classify results as:
- `complete`
- `truncated`
- `provider_error`
- `invalid`

`missing END_MARKER` should no longer be a passive warning in proposal/critique/consensus-style text phases.

### 2. Capture success-side completion metadata

Persist provider success metadata when available:
- Anthropic: `stop_reason`, usage
- Google: `finishReason`, usage metadata
- OpenAI: `finish_reason`, usage

This should be attached to runtime decision-making, not only raw logs.

### 3. Run one repair-pass on truncated success

If a response is likely truncated:
- no new tool access;
- no new file reads;
- small output budget;
- continuation prompt:
  - continue from the last unfinished point,
  - do not repeat the whole answer,
  - terminate with `=== END OF DOCUMENT ===`.

Only one repair-pass should be attempted in MVP.

### 4. Do not mark partial outputs as completed

If repair fails too:
- artifact may still be archived for forensics;
- but phase/agent status should not be reported as plain `Completed`;
- it should be marked `PARTIAL` or `TRUNCATED`.

### 5. Keep scope narrow

Do not combine this with:
- broader scoring/ranking refactors;
- bigger prompt rewrites;
- provider switching logic;
- new checkpoint schema redesign.

## Recommended Starting Point

### Step 1

Promote missing `END_MARKER` from warning to recovery trigger for text phases.

### Step 2

Log and surface success-side `stop_reason` / `finishReason`.

### Step 3

Add one bounded repair-pass for truncated text outputs.

### Step 4

Update checkpoint/log status so truncated outputs are not silently treated as completed.

## Open Questions For Review

1. Should missing `END_MARKER` always trigger repair, or only when the ending also looks syntactically unfinished?
2. Should repair-pass reuse the same model/agent only, or allow provider fallback later?
3. Should truncated artifacts be written to the canonical archive path immediately, or to a `partial/` sub-surface first?
4. Is one repair-pass enough for MVP, or do we need a second "append only tail" retry mode?
5. Should text completeness be enforced for all text phases equally, or stricter for proposal/critique/consensus than post-process notes?
6. Should JSON phases archive both raw provider output and parsed structured result?

## Recommended Baseline

The safest MVP baseline is:

- one repair-pass max;
- same agent/model only;
- no tool access during repair;
- missing `END_MARKER` means `not complete`;
- `Completed` status only after a complete text artifact exists.

## Current Consensus (After Claude + Gemini Reviews)

The review round converged on a narrower MVP than the initial draft.

### Accepted As-Is

- keep `END_MARKER` as the primary completion contract;
- keep the scope limited to pipeline hardening, not broad orchestration changes;
- use one bounded repair-pass only;
- keep repair same-model-only;
- forbid tool/file access during repair;
- introduce explicit `PARTIAL` / `TRUNCATED` semantics instead of silently treating partial outputs as completed.

### Required Before Implementation

- success-side provider metadata must be preserved in the runtime path:
  - Anthropic `stop_reason`
  - OpenAI `finish_reason`
  - Google `finishReason`
  - usage metadata for all providers when available
- truncation detection must be stricter than `missing END_MARKER` alone:
  - MVP baseline is `END_MARKER` + provider finish metadata when available
  - fallback heuristic is allowed only when provider finish metadata is absent
- JSON-returning phases must preserve raw provider output alongside parsed structured result
- runtime return contracts must stop collapsing provider responses into plain strings too early

### Explicitly Out Of MVP

- JSON repair / continuation
- multi-pass repair chains
- provider fallback during repair
- budget auto-tuning
- heuristic critique scoring
- broad checkpoint redesign beyond what is needed for completion status

## MVP Risk Debt / Assumption Register

- **Assumption:** `END_MARKER` remains the primary completion contract.
  - **Why accepted now:** it is simple, explicit, and provider-agnostic.
  - **User/operator risk:** a provider can still end "successfully" without honoring the marker, forcing us to infer incompleteness indirectly.
  - **Revisit trigger:** repeated incomplete outputs that look complete enough to evade the current gate.
  - **Exit path:** richer provider-native completion signals or stricter per-phase completion contracts.

- **Assumption:** Truncation detection can stay narrow in MVP.
  - **Why accepted now:** it avoids inventing broad heuristics before success metadata plumbing existed.
  - **User/operator risk:** some incomplete answers may still fall into ambiguous territory between `complete` and `truncated`.
  - **Revisit trigger:** recurring partial outputs that do not trip the current two-signal rule cleanly.
  - **Exit path:** stronger syntactic/phase-aware detection once the failure patterns justify it.

- **Assumption:** One same-model repair pass is enough.
  - **Why accepted now:** bounded continuation gives recovery without exploding cost or complexity.
  - **User/operator risk:** some runs still fail even though a second bounded continuation or alternate recovery path might have salvaged them.
  - **Revisit trigger:** repeated evidence that one-shot repair under-recovers otherwise salvageable outputs.
  - **Exit path:** carefully staged second-pass or alternate repair modes.

- **Assumption:** JSON phases only need forensic preservation, not repair.
  - **Why accepted now:** raw `.raw.txt` sidecars closed the observability gap with lower risk than JSON continuation logic.
  - **User/operator risk:** malformed or partial JSON still stops value creation with no structured recovery path.
  - **Revisit trigger:** JSON phases become a frequent blocker rather than a minority failure mode.
  - **Exit path:** dedicated JSON repair/continuation flow.

- **Assumption:** Archived partial outputs can stay in the normal run archive.
  - **Why accepted now:** preserving forensics mattered more than reorganizing storage.
  - **User/operator risk:** operators may still read partial artifacts in canonical run folders and overtrust them.
  - **Revisit trigger:** confusion persists around partial artifacts even after status/warnings improved.
  - **Exit path:** separate partial/truncated storage surface or clearer archive partitioning.

- **Assumption:** Provider success metadata coverage is "good enough" where available.
  - **Why accepted now:** runtime now captures far more than before without requiring uniform provider semantics.
  - **User/operator risk:** observability is still only as strong as the provider envelope, so cross-provider behavior can remain uneven.
  - **Revisit trigger:** provider-specific blind spots keep showing up in pilots.
  - **Exit path:** normalize richer provider metadata or add stronger fallback instrumentation.

## Implementation Plan

### Batch 1 — Provider Metadata Plumbing

Goal:
- preserve success-side finish metadata end-to-end

Scope:
- extend provider success results with completion metadata
- stop discarding provider metadata in runtime call stack
- make `callAgent` / `callAgentWithValidation` return structured result objects instead of plain text too early

Contract fixed before implementation:
- `callAgent(...) -> { text, meta }`
- `meta` must preserve at least:
  - `stopReason`
  - `inputTokens`
  - `outputTokens`
  - provider/model identity
  - success headers when available
- `callAgentWithValidation(...) -> { text, completionStatus, meta }`
- `completionStatus` is a stable field introduced in Batch 1 so Batch 2 can harden semantics without another return-contract break

Target areas:
- `ai/scripts/infrastructure/providers.js`
- `ai/scripts/generate-context.js`
- provider/runtime tests

Exit criteria:
- text phases can inspect `text`, usage, finish reason, and headers from successful calls

### Batch 2 — Completion Classification

Goal:
- classify successful-but-incomplete outputs explicitly

Scope:
- add `completionStatus` for text outputs
- apply two-signal truncation detection
- stop logging/archiving truncated text outputs as plain `Completed`

Target areas:
- `ai/scripts/response-validator.js`
- `ai/scripts/generate-context.js`
- checkpoint/log status writes

Exit criteria:
- proposal / critique / consensus text outputs can become `complete`, `truncated`, `invalid`, or `provider_error`

### Batch 3 — Bounded Repair Pass

Goal:
- recover from truncated text outputs without rerunning the whole phase

Scope:
- one continuation-style repair pass only
- same model
- no tool access
- small output budget pinned to `min(originalBudget, 1024)`
- append tail and require `END_MARKER`

Target areas:
- `ai/scripts/generate-context.js`
- prompt-builder helpers for repair prompt
- focused regression tests

Exit criteria:
- truncated text phase gets exactly one bounded repair attempt before final status is set

### Batch 4 — JSON Forensics

Goal:
- keep raw evidence for JSON phases

Scope:
- write `.raw.txt` sidecar next to parsed JSON artifacts
- keep current parsed JSON outputs, but stop losing the raw provider payload

Target areas:
- Devil's Advocate / Tester / Prompt Engineer save paths
- parse/save logic

Exit criteria:
- JSON phases preserve both parsed artifact and raw provider response for diagnosis

## Recommended Implementation Order

1. Batch 1
2. Batch 2
3. Batch 3
4. Batch 4

This order keeps the blast radius under control:
- first make runtime metadata visible;
- then classify truncation correctly;
- then add recovery;
- finally improve JSON forensics.

Note:
- Batch 4 is operationally independent from Batches 2-3 and can run in parallel if implementation bandwidth matters, but the default execution order above remains the recommended path.
