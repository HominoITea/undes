# Wattman Pilot Disagreement Analysis

Status: discussion
Created: 2026-03-22
Primary continuation file for this topic.

## Task

For TASK `wattman-pilot-disagreement-analysis-20260322`, analyze the completed live pilot on `wattman/front` after `architect` critique was removed.

Each model should answer in this form:

`For TASK wattman-pilot-disagreement-analysis-20260322, I am <MODEL_NAME>, and I propose the following:`

Required structure for every model response:
1. Concise diagnosis.
2. Risks / limitations.
3. Practical implementation steps.
4. Expected impact and metrics.

## Goal

Reach a shared conclusion on the next highest-ROI quality fix after the completed live pilot:
- why the run still ended `DIAGNOSTIC`
- why `approval` roles diverged
- why seam expansion requested seams but fetched none
- whether the next track should be:
  - `role-aware evidence packaging`
  - `seam fetch precision`
  - `discovery micro-phase`
  - another bounded fix

## Pilot Artifacts

Target project:
- `/home/kair/wattman/front`

Completed run:
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658-1774170517334/run-flow.json`

Key artifacts:
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658/architect-proposal.txt`
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658/reviewer-proposal.txt`
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658/reviewer-critique.txt`
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658/developer-critique.txt`
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658/synthesizer-consensus.txt`
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658/reviewer-approval-1.json`
- `/home/kair/wattman/front/.ai/prompts/runs/run-1774170225658/developer-approval-1.json`
- `/home/kair/wattman/front/.ai/prompts/result-warning.txt`
- `/home/kair/wattman/front/.ai/prompts/metrics/latest.json`

## Facts Already Established

- `architect` no longer ran `critique`; it participated only in `proposal`.
- The rerun completed end-to-end; the earlier `consensusOutputPath` runtime defect is fixed.
- Final trust:
  - `resultMode=DIAGNOSTIC`
  - `patchSafeEligible=false`
  - `primaryFailureClass=role-evidence-divergence`
- Grounding gap categories:
  - `substantive-assumptions`
- Approval summary:
  - `allAgreed=false`
  - only one approval round
- Critique expansion summary:
  - `requestedCount=4`
  - `fetchedCount=0`
  - `skippedCount=4`
- DA/tester were skipped by gate after the diagnostic result.

## Budget Snapshot

From the completed pilot metrics:

- `architect`: `59786 in / 2816 out`
- `reviewer`: `54870 in / 2573 out`
- `developer`: `35513 in / 1492 out`
- `synthesizer`: `81883 in / 3369 out`
- total: `232052 in / 10250 out`

Phase totals:
- `proposal`: `73259 in / 4004 out`
- `critique`: `34622 in / 1899 out`
- `approval-1`: `42288 in / 978 out`
- `consensus`: `81883 in / 3369 out`

## Questions To Answer

1. What is the most likely primary cause of `role-evidence-divergence` on this run?
2. Is the bigger problem:
   - missing evidence,
   - bad evidence distribution across roles,
   - weak seam normalization / lookup,
   - or weak synthesis after critique?
3. Why did seam expansion fail to fetch all requested seams deterministically?
4. What is the single best next bounded implementation slice?
5. What metrics should confirm that the fix worked?

## Codex Position

For TASK `wattman-pilot-disagreement-analysis-20260322`, I am Codex, and I propose the following:

### 1. Concise Diagnosis

My current diagnosis is:

- the main blocker is not raw token budget anymore;
- the main blocker is the combination of:
  - `role-evidence-divergence` at approval time;
  - seam requests that do not resolve into fetchable deterministic seams;
  - residual substantive assumptions in the final synthesis.

I do **not** think this run primarily failed because `architect` critique was removed.
The run still produced a full proposal/critique/consensus/approval cycle and completed cleanly.
The more likely issue is that the evidence handoff into `approval` and `critique-expansion` was still too weak or too uneven.

My working hypothesis:

- reviewer and developer did not disagree because they saw different prompts;
- they disagreed because the final draft still contained claims that one role treated as sufficiently grounded and the other treated as unverified;
- seam expansion then could not close the gap because the requested seams were not mapped cleanly enough to deterministic fetch targets.

So the likely order of causes is:

1. weak seam normalization / lookup
2. uneven evidence distribution into approval
3. final synthesis still carrying substantive assumptions

### 2. Risks / Limitations

- I have not yet done a line-by-line semantic comparison of both approval JSON files against every claim in the consensus.
- `role-evidence-divergence` may still partly reflect role prompt differences rather than only evidence distribution.
- a seam fetch failure can hide a deeper discovery problem upstream.

### 3. Practical Implementation Steps

My recommended next bounded slice is:

1. add a targeted `approval disagreement analysis` pass on this run:
   - compare `reviewer-approval-1.json`
   - compare `developer-approval-1.json`
   - map disagreements to concrete claims in `synthesizer-consensus.txt`
2. add richer seam-request diagnostics:
   - requested seam label
   - normalized seam key
   - why it was skipped:
     - missing owner
     - ambiguous match
     - no symbol match
     - unsupported format
3. based on that analysis, implement one of two bounded fixes:
   - `role-aware evidence packaging`, if both roles need the same evidence in different projection
   - `seam fetch precision`, if the real failure is deterministic fetch resolution

If I must choose one before doing the manual breakdown, I would start with:

- `seam fetch precision`

because `requested=4 / fetched=0` is too strong a signal to ignore.

### 4. Expected Impact And Metrics

Expected impact:

- fewer approval disagreements caused by unresolved seams
- lower chance of ending with `substantive-assumptions`
- better conversion from seam requests into actual fetched evidence

Metrics I would watch:

- `critiqueExpansion.fetchedCount / requestedCount`
- count of skipped seam reasons by category
- approval score delta between roles
- frequency of `role-evidence-divergence`
- final `patchSafeEligible` rate on repeated `wattman/front` runs

## Claude Position

For TASK `wattman-pilot-disagreement-analysis-20260322`, I am Claude Opus 4.6, and I propose the following:

### 1. Concise Diagnosis

The run failed for one mechanical reason and one structural reason, and I can prove both from the artifacts.

**Mechanical (root cause): duplicate index entries break seam lookup.**

`buildManhattanRoute` exists in the code index twice — once as `app/_helpers/manhattan.ts` and once as `./app/_helpers/manhattan.ts`. The `resolveSingleMissingSeam` function finds both, `candidates.length > 1`, and returns `ambiguous-symbol-match`. This is a path normalization bug in the indexer, not a seam expansion design flaw.

Verified:
```
buildManhattanRoute: 2 entries (app/_helpers/manhattan.ts vs ./app/_helpers/manhattan.ts)
```

The other 3 seam requests failed for connected reasons:
- `updateLinesForMovedShape`: **does not exist in the codebase** (0 index entries). The agent hallucinated this function name — it's not in `canvasHelpers.ts` or anywhere else. The actual function is `updateConnectedLines`.
- `app/_helpers/manhattan.ts` (file-level request): seam expansion looked for symbols in this file path but matched `0` because the index has both `./`-prefixed and non-prefixed entries, and the path normalization in `resolveHintedFile` compared against one form.
- `canvas.tsx:перемещение слоя...` (natural language + path): `canvas.tsx` has **0 symbols** in the index entirely. The file was never indexed.

So the 4/4 skip breakdown is:
| Seam | Skip reason | Root cause |
|------|-------------|------------|
| `updateLinesForMovedShape` | `symbol-not-found` | Hallucinated function name |
| `buildManhattanRoute` | `ambiguous-symbol-match` | Duplicate `./` prefix in index |
| `app/_helpers/manhattan.ts` | `hinted-file-not-indexed` | Same `./` normalization bug |
| `canvas.tsx:...` | `hinted-file-not-indexed` | File has 0 indexed symbols |

**Structural (downstream): reviewer approved (score 8), developer rejected (score 5) on the same consensus.**

Both roles requested the same missing evidence (manhattan.ts body, move-path flow). But they evaluated the consequence differently:
- Reviewer (Gemini): "assumptions are listed, patch is correct for what we can see" → score 8, agreed
- Developer (GPT-5.4): "claims in Grounded Fixes cite evidence we don't have; -2 for ungrounded primary cause, -1 for phantom file references" → score 5, disagreed

This is not role-prompt divergence. The developer applied the evidence-grounding contract more strictly. The consensus draft placed "Manhattan-router reads width/height for sector" in `## Grounded Fixes` with `Evidence: canvasHelpers.ts:25-37`, but that evidence only shows `Math.abs()` stripping sign — it does NOT show the router reading width/height. That's a downstream claim without direct evidence. The developer correctly flagged this.

**Causal chain:**
1. Index has `./` prefix duplicates → `buildManhattanRoute` ambiguous → seam expansion fetches 0/4
2. Without manhattan.ts body, consensus can't ground the downstream claim
3. Synthesizer placed the downstream claim in Grounded Fixes anyway
4. Developer penalizes ungrounded claim in Grounded section; reviewer tolerates it
5. `role-evidence-divergence` → DIAGNOSTIC

### 2. Risks / Limitations

- I verified the duplicate-path hypothesis directly against the live `.code_index.json`. The `./` prefix duplication is confirmed on this project. It may or may not affect other projects depending on how `scanTree`/indexer handles paths.
- The hallucinated function name (`updateLinesForMovedShape`) is an agent error, not a system error. No system fix can prevent all hallucinations, but better discovery could reduce them.
- `canvas.tsx` having 0 indexed symbols may be a tree-sitter parse failure for TSX files, or a depth/size exclusion. I did not investigate the indexer failure specifically.
- Fixing the `./` normalization will unblock 2 of 4 seam requests on this specific run. The other 2 (hallucinated name + unindexed file) need different fixes.

### 3. Practical Implementation Steps

**Recommended next bounded slice: seam fetch precision (path normalization fix).**

Step 1: Fix duplicate `./` prefix in code index generation.
- In the indexer, normalize all `file` paths to strip leading `./` before insertion.
- Or in `critique-expansion.js`, normalize both the index entries and the lookup key before matching.
- Estimated effort: ~15-30 lines, 1-2 hours including tests.

Step 2: Add normalization in `resolveHintedFile` to strip `./` from both sides of comparison.
- `critique-expansion.js:582`: `normalizeRelativePath` should handle `./` stripping.
- Verify it already does, or add it.

Step 3: Add dedup guard in seam lookup.
- If `candidates.length > 1` but all candidates point to the same file+name after normalization, treat as 1 match instead of ambiguous.

Step 4: Validate on this exact run.
- Rerun wattman/front with the same prompt after fix.
- Expected: `buildManhattanRoute` resolves, `manhattan.ts` file-hint resolves. 2/4 → fetched. `updateLinesForMovedShape` still fails (hallucinated). `canvas.tsx` still fails (unindexed).
- But 2/4 fetched may be enough: manhattan.ts body would confirm or deny the "router reads width/height" claim, resolving the approval disagreement.

### 4. Expected Impact and Metrics

**Immediate (this run):**
- `critiqueExpansion.fetchedCount`: 0 → 2 (manhattan.ts functions)
- `role-evidence-divergence` likely eliminated: with manhattan.ts body visible, both roles can evaluate the downstream claim on evidence
- `patchSafeEligible`: likely `true` if manhattan.ts confirms the claim (or claim gets narrowed to grounded level)

**Systemic:**
- Any project with `./`-prefixed index entries will benefit from the normalization fix
- `ambiguous-symbol-match` rate drops across all projects
- `hinted-file-not-indexed` rate drops for files that ARE indexed but under a different path form

**Metrics to watch:**
- `critiqueExpansion.fetchedCount / requestedCount` (target: > 0.5)
- `skippedSeams` by reason category — `ambiguous-symbol-match` should approach 0
- `patchSafeEligible` rate on wattman/front reruns
- `role-evidence-divergence` frequency across pilots

### Verdict

**Do: seam fetch precision (path normalization).** Not the other two.

**Why not discovery micro-phase:** Discovery is a larger architectural change (new phase, new agent call, new artifact format). The wattman failure is not caused by "wrong files discovered" — the right files (`manhattan.ts`, `canvasHelpers.ts`) were in the context pack. The failure is that seam expansion couldn't fetch them because of a path normalization bug. Discovery doesn't fix this.

**Why not role-aware evidence packaging:** Both roles received the same evidence. They didn't disagree because of different projections. They disagreed because one claim was placed in `Grounded Fixes` without sufficient evidence, and the strictest role caught it. The fix is to provide the missing evidence (by fixing seam fetch), not to repackage the same insufficient evidence differently.

**Why this has highest ROI:** It's the smallest fix (~30 lines), directly addresses the mechanical failure (4/4 skipped), and unblocks the evidence that would resolve the approval disagreement. The structural problem (synthesizer placing ungrounded claims in Grounded Fixes) is a downstream consequence that self-corrects once the evidence is available.

## Gemini Position

For TASK wattman-pilot-disagreement-analysis-20260322, I am Gemini CLI, and I propose the following:

### 1. Concise Diagnosis
The run ended in a `DIAGNOSTIC` state with `role-evidence-divergence` primarily because the generated consensus included claims about downstream consumer behavior (how the Manhattan router uses width/height) that were logical leaps, not grounded facts. 
The roles diverged on the scoring threshold: the Reviewer (score 8, agreed) accepted the leap as reasonable but asked to verify it, while the Developer (score 5, disagreed) strictly enforced the evidence rule and penalized the draft for asserting unproven downstream usage.
Seam expansion then failed completely (`requestedCount=4`, `fetchedCount=0`) because the requested seams were structurally flawed or overly broad (e.g., `symbol-not-found; hinted-file-not-indexed` for a raw file path with Russian text appended, and `ambiguous-symbol-match` for a bare function name).

The root cause chain is:
1. Consensus made ungrounded claims about downstream usage.
2. Developer rejected the draft for lacking evidence.
3. Both agents requested missing seams, but used poor/unstructured `symbolOrSeam` keys.
4. Seam expansion lookup failed to resolve the noisy requests into deterministic fetch targets.

### 2. Risks / Limitations
- It is possible that even if the seams were perfectly formatted, they might not exist in the index (e.g., if the file wasn't indexed or the function name was slightly different). 
- Modifying how we parse seams might make the system too lenient and pull in completely wrong context if the fuzzy matching is too broad.

### 3. Practical Implementation Steps
The single best next bounded implementation slice is **seam fetch precision**.

We need to fix how `critique-expansion.js` (or the lookup engine) resolves user-provided `symbolOrSeam` strings, especially when they contain file paths combined with raw text or ambiguous names. 
1. Improve the fallback logic for `ambiguous-symbol-match`: if a function like `buildManhattanRoute` is requested and has multiple matches, use the `fetchHint` (which explicitly contained `app/_helpers/manhattan.ts`) to disambiguate.
2. Improve parsing for noisy file-based requests: when a seam is requested as `file.ts:some text`, the lookup should isolate the valid file path and use the text as a line-range/grep hint, rather than failing completely with `hinted-file-not-indexed`.

### 4. Expected Impact and Metrics
**Expected Impact:** 
The pipeline will successfully convert agent curiosity into hard evidence. By fetching the actual downstream routing logic, the consensus draft will either prove its claim (reaching `PATCH_SAFE`) or correct itself based on the new context. The divergence between strict and lenient roles will shrink because the facts will be present.

**Metrics to track:**
- `critiqueExpansion.fetchedCount / requestedCount` (should approach 1.0)
- Number of `symbol-not-found` and `ambiguous-symbol-match` skip reasons (should decrease)
- Final `patchSafeEligible` rate on evidence-heavy tasks (should increase)

### Verdict
**Do: seam fetch precision.** 

**Why not discovery micro-phase:** As Claude pointed out, the right files were already in the pack. The problem wasn't discovery; it was extraction failure due to poor formatting by the agents. 
**Why not role-aware evidence packaging:** The agents disagreed on the *assessment* of the evidence, not the *presentation* of it. One role enforced the rules strictly, the other loosely. Giving them the actual missing evidence (via better fetch precision) naturally resolves the disagreement.

## Consensus Draft


## Post-Fix Gemini Response (2026-03-22)

For TASK wattman-pilot-disagreement-analysis-20260322, I am Gemini CLI, and I propose the following:

### 1. Concise Diagnosis
The previous fix (seam fetch precision) worked: `requested=6`, `fetched=3` proves the pipeline can now extract evidence. However, the run still ended `DIAGNOSTIC` due to `role-evidence-divergence`. 
The core issue has shifted from **evidence retrieval** to **evidence classification**. 
Synthesizer continues to bundle unproven assumptions (downstream consumption logic, exact move-order) into the `Grounded Fixes` section alongside proven mechanical facts (Math.abs destroys the vector sign). 
The Reviewer is pragmatically satisfied with the core fix and ignores the unproven downstream claims (score=9), while the Developer strictly penalizes the draft for claiming unread code as "Grounded" (score=4). 

### 2. Risks / Limitations
- If we over-engineer the "Evidence Digest" generation, we might add another expensive LLM call to the pipeline, violating our cost-optimization goals.
- If we force the Developer to only evaluate "Confirmed Facts", we risk the Developer ignoring actual logical flaws in the proposed patch just because the facts themselves are accurate.

### 3. Practical Implementation Steps
I agree with Codex that the next bounded slice is **role-aware evidence packaging**, but we must implement it cheaply.
We do not need a new "post-expansion evidence digest" LLM phase. We just need to enforce the structure in the **Synthesizer's prompt** and the **Approval schema**.

1. **Synthesizer Prompt Update:** Add a strict rule: "If a claim depends on downstream behavior or execution order that has NOT been explicitly read into context via Seam Expansion, it MUST NOT be placed in `Grounded Fixes`. It MUST be placed in `Assumptions / Unverified Seams`."
2. **Role-Aware Approval Prompts:** 
   - Update Reviewer prompt: Focus on "Does the proposed patch solve the primary mechanical issue safely?"
   - Update Developer prompt: Focus on "Are there any unread/guessed file anchors inside Grounded Fixes?" 
3. **Approval Threshold Sync:** Ensure both roles share the same baseline for what constitutes a passing score (e.g., "A draft is acceptable even if downstream mechanisms are unverified, AS LONG AS they are explicitly moved to the Assumptions section").

### 4. Expected Impact and Metrics
**Expected Impact:** 
The synthesizer will stop polluting `Grounded Fixes` with guesses. The Developer will stop penalizing the draft because the guesses are now correctly labeled as `Assumptions`. Both roles will converge on a high score for the safely isolated patch, allowing the trust gate to pass.

**Metrics to track:**
- Approval score delta between Reviewer and Developer (should approach 0)
- `role-evidence-divergence` frequency (should drop to 0)
- Final `patchSafeEligible` rate (should increase)

### Verdict
**Do: role-aware evidence packaging (via prompt tuning).** 

**Why not another seam fetch fix:** Seam fetch is now working (fetched=3). The problem is how the synthesizer packages the fetched (and un-fetched) facts.
**Why not discovery micro-phase:** Discovery is still unnecessary here; the agents know what files to look at, they just disagree on how strictly to classify the things they *haven't* looked at yet.
