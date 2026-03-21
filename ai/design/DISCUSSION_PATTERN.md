# Discussion Pattern (Reusable)

Purpose:
- Unified style for multi-model task discussions (architecture/code/risks/solutions).
- Repeatable process with recoverable history and explicit consolidation point.

## 1. Input Format

1. Capture the task in a single file (e.g., `prompt.txt`).
2. Each model responds in a consistent form:
- `For TASK N, I am <MODEL_NAME>, and I propose the following: ...`

## 2. Model Response Format

Every response must include:
1. Concise solution.
2. Risks/limitations.
3. Practical implementation steps.
4. Expected impact and metrics.

## 3. Building the Combined Solution

1. Create a summary file (e.g., `final.txt`).
2. Include only:
- agreed-upon items,
- open risks,
- action items by priority (P0/P1/P2),
- KPIs and readiness criteria.

## 4. Architectural Review Cycle

1. Add review blocks from models (bugs/risks/fixes).
2. Define a `P0 gate` (mandatory fixes before implementation starts).
3. Separate:
- "must fix now",
- "can defer".

## 5. Transition to Working Specification

1. Create a single specification file (e.g., `version0.md`).
2. Document:
- scope,
- changes by file and method,
- acceptance criteria,
- minimum tests.

## 6. History Rule (Mandatory)

After moving a discussion to a new primary file:
1. In all previous files, add a redirect block:

---
HISTORY_REDIRECT_<DATE>
History note: further reasoning and final decisions have been moved to `<TARGET_FILE>`.
Single continuation point for the discussion: `<TARGET_FILE>`.

2. In `<TARGET_FILE>`, keep only the current working version.

## 7. Definition of Done for a Discussion

A discussion is considered complete when:
1. A single specification file exists.
2. A P0 gate is defined.
3. Acceptance criteria are documented.
4. History redirects are placed in all previous files.
5. The next implementation step is unambiguously defined.

## 8. Recommended File Names

- Original task: `prompt.txt`
- Model responses: `tasks.txt`
- Summary: `final.txt`
- Implementation details: `draft_code.txt`
- Working specification: `version0.md`
