# Follow-Up Diagnosis Discussion Prompt for Claude

Use this prompt after the first independent diagnosis round.

Goal:
Pressure-test the current root-cause hypothesis and choose the **next single
implementation batch** for the hub. This is not a generic code review and not
another first-pass diagnosis. It is a focused follow-up discussion on what the
hub should build next.

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

## Peer diagnosis to evaluate

Gemini's current hypothesis is:

- the hub suffers from a **conservative bias**
- structural extraction gives agents a narrow but accurate "keyhole" view
- Evidence-Grounded Patch Mode and approval penalties make agents avoid broader
  refactors outside that keyhole
- the result is a safe but shallow partial hotfix

Gemini's proposed direction:

- short-term: widen the extracted slice around matched methods
  (for example class fields, constructor, imports, interface signature)
- longer-term: implement critique-driven expansion (Lever 3), so a critique can
  explicitly request a missing interface/class and trigger another targeted pass

## Questions for Claude

1. Do you agree that **conservative bias** is now the main bottleneck?
   Answer `agree`, `partial`, or `disagree`.
2. If you disagree or only partially agree, what is the stronger explanation:
   - insufficient structural slice width
   - missing compare-path logic
   - weak debate/consensus synthesis
   - weak approval/Devil's Advocate pressure
   - missing deeper agentic read loop
3. If the hub team can build only **one** next batch, which should it be?
   Choose exactly one:
   - broader structural extraction around matched methods/classes
   - critique-driven context expansion
   - compare-mode: working path vs broken path
   - stronger debate/approval pressure only
4. What is the **minimum validating experiment** that would prove or falsify
   your choice within the next 2-3 live runs?
5. Which seemingly attractive next step should **not** be built yet, and why?

## Required output format

**Verdict on Gemini Hypothesis**
- ...

**Best Explanation of the Remaining Failure**
- ...

**Recommended Next Batch**
- ...

**Minimum Validation Experiment**
- ...

**What Not To Build Yet**
- ...

**Roadmap Wording**
- one short paragraph or 2-3 bullets with wording suitable for the roadmap

