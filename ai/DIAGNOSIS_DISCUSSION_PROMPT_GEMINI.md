# Follow-Up Diagnosis Discussion Prompt for Gemini

Use this prompt after the first independent diagnosis round.

Goal:
Refine your earlier diagnosis into a **concrete next implementation slice**.
Do not repeat the first diagnosis verbatim. Update it against the latest shared
facts and choose the narrowest high-value batch the hub should build next.

Reply in Russian.

## Artifacts to attach

- `<PROJECT_ROOT>/.ai/prompts/discussions/<TASK_ID>/<RUN_ID>/prompt.txt`
- `<PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-proposal.txt`
- `<PROJECT_ROOT>/.ai/prompts/runs/<RUN_ID>/*-critique.txt`
- `<PROJECT_ROOT>/.ai/prompts/result.txt`
- `<PROJECT_ROOT>/.ai/prompts/result-warning.txt`
- `<PROJECT_ROOT>/.ai/prompts/test-report.md`
- `<PROJECT_ROOT>/.ai/prompts/metrics/latest.json`
- `<PROJECT_ROOT>/.ai/.context_bundle.md`

## Current shared facts

- `ast-grep` is already working and is used as the preferred structural-search
  backend when available.
- Prompt-named seam pinning already improved the Context Pack.
- Evidence-anchor parsing and debate/approval evidence contracts were already
  tightened.
- The latest run no longer fails on missing evidence anchors or fake file
  paths.
- The remaining blocker is `substantive-assumptions`.
- Tester still says the answer does not prove:
  - the real `ApprovalSetting -> ApprovalInstance` mapping fix
  - synchronization with `document.currentStep`
  - finalization through the real last/max step
  - a grounded comparison with the working `Order` flow

## Your earlier diagnosis

Your prior hypothesis was:

- the hub suffers from a **conservative bias**
- structural extraction gives agents a narrow but accurate "keyhole" view
- Evidence-Grounded Patch Mode and approval penalties make agents avoid broader
  refactors outside that keyhole
- the result is a safe but shallow partial hotfix

Your proposed direction was:

- short-term: widen the extracted slice around matched methods
  (for example class fields, constructor, imports, interface signature)
- longer-term: implement critique-driven expansion (Lever 3)

## Questions for Gemini

1. Does the latest evidence still support your **conservative bias** diagnosis
   as the best explanation?
   Answer `yes`, `mostly yes`, or `no`.
2. If `yes` or `mostly yes`, define the **smallest implementable MVP slice**
   precisely:
   - what exactly should be added to the extracted context
   - when it should trigger
   - what safety bounds it must keep
3. If `no`, what should replace your earlier proposal as the new primary seam:
   - critique-driven expansion
   - compare-mode: working path vs broken path
   - stronger debate/approval pressure
   - deeper agentic read loop
4. What metrics should be used to judge success in the next 3 live runs?
5. What should remain explicitly **out of scope** for this next batch?

## Required output format

**Updated Verdict**
- ...

**What Changed Since Your First Diagnosis**
- ...

**Recommended MVP Slice**
- ...

**Validation Plan**
- ...

**Non-Goals**
- ...

**Roadmap Wording**
- one short paragraph or 2-3 bullets suitable for the roadmap

