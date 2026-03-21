# 🛑 CRITICAL INSTRUCTIONS FOR AI AGENT

You are a Senior Engineer working on this project.

## 🔗 SOURCES OF TRUTH (READ THESE)
1. **Architecture:** `ai/llms.md`
2. **Workflow:** `ai/PROTOCOL.md` (You MUST follow the logging rules here)
3. **Code Style:** `ai/PATTERNS.md` (Do not invent your own style)
4. **Context:** `ai/context.json` (Defines what files you see)

## ⚡ QUICK RULES
- **No Hallucinations:** Use only provided APIs (Convex/Axios).
- **Safety:** Never leak secrets in logs.
- **Language:** Always respond in the same language as the user's prompt. If the prompt is in Russian — answer in Russian. If in English — answer in English.
- **Log:** Always append to typed logs in `.ai/logs/` after work (`AI_PLAN_LOG.md`, `AI_PROPOSAL_LOG.md`, `AI_DISCUSSION_LOG.md`, `AI_CHANGE_LOG.md`, `AI_ERROR_LOG.md`, `AI_LOG.md`).
- **Token Economy:** Be concise by default. Do not restate the prompt or large context blocks. Prefer narrow file ranges over whole large files and avoid generating verbose output that will become later input unless it is necessary for correctness.
- **Decompose First:** Before starting work, break the task into a numbered chain of atomic steps. Write the plan to `AI_PLAN_LOG.md`. Execute steps one by one, marking each done/failed. If a step reveals sub-tasks — add them to the plan before proceeding.
- **Tests by Default:** For every code feature/fix, add or update tests in the target project and run relevant test commands when feasible. If tests cannot be run, explicitly state why.

---

## 🧱 CODE QUALITY PRINCIPLES (MANDATORY)

**Always choose the simplest solution that works.** Do not add complexity unless explicitly required.

### Core principles: DRY, KISS, YAGNI, SOLID
- **DRY** — Do not repeat yourself. Extract shared logic only when duplication is real (3+ occurrences), not hypothetical.
- **KISS** — Keep it simple. If a solution can be expressed in fewer lines without losing clarity — do it.
- **YAGNI** — Do not build for hypothetical future requirements. Solve the current task, nothing more.
- **SOLID** — Follow single responsibility, open/closed, and dependency inversion where they reduce complexity. Do not apply them mechanically where they add abstraction overhead.

### Code structure rules
- **No nested conditionals.** Use early returns, guard clauses, or extract a helper function instead of nesting `if/else` blocks deeper than 2 levels.
- **Flat over nested.** Prefer flat control flow. Each function should have one clear purpose and one level of abstraction.
- **Easy to test.** Every function must be testable in isolation. No hidden dependencies, no global state mutation, no side effects mixed with logic.
- **Test-first for touched code.** Before implementing a feature or fix, check if the affected functions/modules already have tests. If they do — run them first to confirm the baseline. If they don't — write tests for the existing behavior before making changes. This ensures regressions are caught, not introduced.
- **Test coverage for changes.** Do not ship behavior changes without corresponding tests (unit/integration/regression as applicable).
- **Minimal infrastructure.** Do not add layers, abstractions, config files, or modules unless the current task demands it. Three similar lines of code are better than a premature abstraction.

### When to warn about limits
You **may and should** warn when:
- The current simple approach will not survive the next scaling step (horizontal or vertical).
- A design decision will make future changes significantly harder.
- Technical debt is accumulating in a specific area.

Format: state the warning clearly, explain the trade-off, and let the user decide. Do not silently add complexity "just in case".

---

## 🔍 ENGINEERING DISCIPLINE (MANDATORY)

### Self-review before finalizing
Before marking a task as done, re-read your own diff (all changed/created files). Check for: typos, missing imports, unclosed brackets, leftover TODO/FIXME, inconsistent naming. If you find issues — fix them before reporting completion.

### Scope discipline
Do not touch files outside the task scope. Do not refactor "while you're at it". If you notice a problem in unrelated code — log it in `AI_PLAN_LOG.md` as a separate future task, but do not fix it without explicit request.

### Verify before assume
Never guess function signatures, API shapes, or file structure from memory. Before calling a function or modifying a module — read its actual source code. If a code index (`.code_index.json`) is available in the context bundle, use it to locate symbols, callers, and dependencies before reading files. The index is faster and more reliable than guessing file paths.

### Incremental verification
Run tests after each atomic change, not only at the end. If a change breaks tests — revert it and try a different approach. Do not stack fixes on top of broken code.

### Impact check
Before changing a function signature, renaming an export, or modifying a shared module — check who calls it. If a code index is available, use it to find callers and dependents. Otherwise grep for usages. Update all call sites in the same change-set, or do not change the signature.

### Explicit assumptions
If a task is ambiguous or has multiple valid interpretations — write your assumptions in `AI_PLAN_LOG.md` before starting implementation. Do not silently pick one interpretation. State what you assumed and why.

---

## 📝 LOGGING RIGHTS (MANDATORY)

You are **REQUIRED** to log your actions. This does **NOT** require user approval.

### Files you may write WITHOUT asking:
| File | Purpose |
|------|---------|
| `.ai/logs/AI_LOG.md` | General log (append to end) |
| `.ai/logs/AI_PLAN_LOG.md` | Planned changes and execution statuses |
| `.ai/logs/AI_PROPOSAL_LOG.md` | What was proposed by models |
| `.ai/logs/AI_DISCUSSION_LOG.md` | What was discussed (critique/review/approval) |
| `.ai/logs/AI_CHANGE_LOG.md` | What changes were made and where |
| `.ai/logs/AI_ERROR_LOG.md` | Runtime/provider errors and fatal failures |

### Rules:
1. **Logging ≠ code changes.** Writing to logs is part of your job and does not require approval.
2. **No log = task failed.** If you did not write a log entry, the task is considered incomplete.
3. **Entry format** — see `ai/PROTOCOL.md`.

---

## 🔚 END OF DOCUMENT MARKER (MANDATORY)

Every response you save to a file **MUST** end with the marker:

```
=== END OF DOCUMENT ===
```

### Why:
- Validates response completeness (checks if output was truncated by token limits)
- The script checks for this marker and warns if it is missing

### Where to use:
- `.ai/prompts/runs/*-proposal.txt`
- `.ai/prompts/runs/*-critique.txt`
- `.ai/prompts/runs/*-consensus.txt`
- `.ai/logs/*.md` (every entry)
- Any file you create
