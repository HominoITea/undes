# AI System Roadmap

This document outlines future ideas and architectural evolutions for the AI Agent system.

Companion design/research documents that stay active but do not belong directly in the roadmap live in `ai/design/README.md`.

> **Important:** As of 2026-03-01, `ai-hub-coding` is the sole active project.
> The original `node-ai` project is marked as **legacy** and will not receive new features or fixes.
> All future development, roadmap items, and backlog tasks apply exclusively to this hub codebase.

---

## 🚀 Future Feature: Matrix Agent Mode (Dynamic Role Rotation)

**Concept:**
Instead of assigning static roles (Claude = Architect, ChatGPT = Implementer), every configured model performs **every** role in parallel, debates the results, and converges on the best solution.

### Workflow Draft
1.  **Phase 1: Multi-Architecture**
    *   Claude, ChatGPT, and Gemini ALL act as "Architect" for the same prompt.
    *   They generate 3 distinct architectural proposals.
2.  **Phase 2: Cross-Critique**
    *   Each model critiques the other two proposals.
    *   A "Synthesizer" step merges the best parts into a "Golden Architecture".
3.  **Phase 3: Multi-Implementation**
    *   All models write code based on the "Golden Architecture".
    *   Reviewer agents run tests/linting on all 3 variants.
4.  **Phase 4: Selection**
    *   The implementation with the highest score (correctness + style) is selected.

### Pros & Cons
*   **Pros:** Removes model bias, drastically increases quality (Ensemble Learning), redundancy.
*   **Cons:** High token cost (3x-9x), increased latency, complex orchestration.

### Implementation Strategy
*   **Target Platform:** Likely C# (for better concurrency control and strict typing) or a dedicated orchestration service.
*   **Trigger:** Optional flag `--deep-think` or `--matrix` for critical tasks only.

---

## 🧭 Future Feature: Workspace Hub Mode (Single App, Multiple Projects)

**Concept:**
Run one AI app from a dedicated folder ("hub"), but work with many projects.
The hub holds **only executable code, dependencies, and documentation**.
All project-specific data (context, logs, model configs, agent settings) lives **inside the target project** in a `.ai/` folder, gitignored.
This gives physical isolation by design — no shared storage, no cross-contamination.

### Why
- No separate setup/run per project.
- Fast switch between old projects from terminal menu.
- Add new project by path and start immediately.
- Keep full chronology by model/agent/time for each project separately.

### Core Architecture: Split Storage

**Principle:** Hub = code & docs. Project = data & config.

#### Hub (e.g. `~/.ai-hub/` or `node-ai/`) — shared, versioned
```text
hub/
  package.json                    # runtime dependencies
  node_modules/                   # tree-sitter, etc.
  config/
    projects.json                 # project registry (paths, names, timestamps)
    hub-config.json               # global defaults (API keys, default preset)
  ai/
    scripts/                      # all executable scripts
      generate-context.js
      context-index.js
      context-pack.js
      init-project.js
      ...
    specs/
      languages.json              # language specifications
    PROTOCOL.md                   # agent interaction rules
    PATTERNS.md                   # code style standards
    KNOWLEDGE_BASE.md             # tribal knowledge
  README.md                       # hub documentation
  ROADMAP.md                      # hub roadmap
  AI_WORKFLOW.md                  # workflow guide
```

#### Target project (e.g. `my-app/`) — per-project, gitignored
```text
my-app/
  .ai/                            # ← added to .gitignore
    .gitignore                    # contains `*` as safety net
    agents.json                   # model/agent config for this project
    context.json                  # context collection settings
    architecture-rules.json       # code quality rules
    logs/
      AI_LOG.md                   # global timeline
      AI_PLAN_LOG.md              # planned tasks
      AI_PROPOSAL_LOG.md          # model proposals
      AI_DISCUSSION_LOG.md        # critique phase
      AI_CHANGE_LOG.md            # applied changes
    prompts/
      result.txt                  # final consensus
      result-warning.txt          # disagreements
      metrics/
        latest.json
        history.json
      archive/                    # timestamped run artifacts
    .context_cache.json           # cached context
    .code_index.json              # symbol index
    .context_bundle.md            # context pack
  .gitignore                      # includes `.ai/`
  src/...
```

### What This Simplifies

1. **No storage driver needed.** Data path = `path.join(projectPath, '.ai', ...)`. Scripts receive `--project-path=/abs/path` — done.
2. **Isolation is physical.** Different folders = impossible to cross-contaminate. No namespace logic, no ACL, no resolver.
3. **Migration is trivial.** Existing `ai/` → `.ai/` rename + add to `.gitignore`. One command.
4. **Backup/delete is natural.** Delete project = delete its AI data. Copy project = copy its history. No orphaned registry entries.
5. **Concurrent access is simpler.** Two terminals on different projects = different folders, zero conflicts.
6. **Disk growth is distributed.** Each project owns its caches. No central bloat.

### Product Requirements
1. **Single launcher**
   - One command to start hub.
   - Hub path is stable (e.g. `~/.ai-hub` or local `node-ai/`).
2. **Project registry**
   - `config/projects.json` in hub: `projectId`, absolute path, display name, `lastUsed` timestamp, status.
   - `projectId` = `sha256(canonicalPath).slice(0, 12)`.
   - Support `add` / `remove` / `rename` / `archive` operations.
   - Atomic writes (write `.tmp` → `rename`) to prevent corruption.
3. **Per-project `.ai/` folder**
   - Created by `ai:add -- --path=...` inside target project.
   - Contains `.gitignore` with `*` as safety net (even if user forgets root `.gitignore`).
   - Hub-level `agents.json` / `context.json` used as defaults; project `.ai/` overrides.
4. **Config inheritance: hub → project**
   - If project `.ai/agents.json` is absent — hub defaults apply.
   - If present — `Object.assign(hubDefaults, projectConfig)`.
   - API keys — **never in project `.ai/`** and preferably never as plaintext in files.
   - `config/hub-config.json` stores only references (env var names / keychain ids), secrets resolved at runtime.
5. **Terminal UX**
   - On start: show recent projects list with numeric menu.
   - Support: select existing project by number, add new project path, then continue.
   - Simple `select by number` via stdin. No TUI framework in v1.
6. **Debate continuity**
   - Numbered question threads (`Q-xxxx`) tracked per project in `.ai/logs/`.
   - Agents read prior answers and continue debates within project scope.

### Proposed CLI Flow
1. `ai:start`
   - If last-used project exists and is healthy → continue directly.
   - Else open numbered menu with recent projects + "add new path".
   - Active project persisted in `config/hub-config.json` (`activeProjectPath`) and used by default in hub-root runs.
2. `ai:add -- --path=/abs/project/path`
   - Validate path (`fs.realpathSync()` + POSIX normalization).
   - Check not a subfolder of existing project (and vice versa).
   - Create `.ai/` folder with `.gitignore`, copy default configs from hub.
   - Add `.ai/` to project's root `.gitignore` if not already present.
   - Register in `config/projects.json`.
3. `ai:list`
   - Show known projects, status, and last activity.
4. `ai:status`
   - Current project, log entry count, last run timestamp, cache size.
5. `ai -- --project-path=/abs/path --prompt="..."`
   - Run without interactive selection.
6. `ai:migrate -- --path=./existing-project [--dry-run]`
   - Rename `ai/` → `.ai/`, add to `.gitignore`, register in hub.
   - `--dry-run` previews changes without writing.
   - Copy (not move) originals; keep source read-only until user confirms.
7. `ai:gc`
   - Clean old caches and archived logs. Configurable `retentionDays`.
8. `ai:stats`
   - Disk usage breakdown per project.

### Detailed Implementation Plan
1. **Phase A: Registry + Project Init**
   - Implement `config/projects.json` store with atomic writes.
   - `ai:add` — validate path, create `.ai/` scaffold, register.
   - `ai:list` — display projects with status.
   - Path deduplication via `fs.realpathSync()` + subfolder check.
2. **Phase B: Interactive Selector + CLI**
   - `ai:start` — numbered menu via stdin.
   - `ai:status` — project summary.
   - Last-used hint in `config/projects.json` + active project pointer in `config/hub-config.json`.
3. **Phase C: Runtime Integration**
   - All scripts accept `--project-path=` flag.
   - `generate-context.js` resolves paths as `<projectPath>/.ai/...`.
   - Config inheritance: load hub defaults, overlay with project `.ai/` configs.
   - Introduce mandatory path sandbox helpers:
     - `resolveProjectPaths(projectPath)` returns absolute normalized roots.
     - `safeJoinProjectData(root, rel)` rejects `..`, symlink escape, and writes outside `<projectPath>/.ai/`.
     - all write operations go only through safe helpers (no direct `path.join` writes).
   - **Backward compatibility:** if no hub detected, scripts work with local paths as today. No if-branches — just default `projectPath` to `process.cwd()`.
   - Unit tests for path resolution: two project paths, write/read, assert no overlap.
   - Negative tests: reject traversal (`../../`), absolute foreign paths, and symlink escape attempts.
4. **Phase D: Migration + Safety**
   - `ai:migrate` — rename `ai/` → `.ai/`, update `.gitignore`, register.
   - Health check on `ai:start`: path exists, `.ai/` present, `context.json` valid.
   - Project status: `active | archived | broken`. Show `broken` with warning, do not crash.
   - Compatibility window: read from both `ai/` and `.ai/` (priority `.ai/`) with deprecation warning for legacy path.
   - Hub config layout compatibility: read both `config/*.json` and legacy root `*.json` (priority `config/`) with deprecation warning.
   - Add `ai:doctor -- --project-path=...` to validate layout and print one-command fixes.

### Acceptance Criteria
- Selecting project by menu number works from clean start.
- Adding a new path creates `.ai/` in target project, registers in hub, and starts run.
- Logs/debates/contexts of two projects do not mix (physical folder isolation).
- User can switch projects in one session without restarting app.
- Existing single-project workflow still works without hub (backward compatible).
- `.ai/` folder is gitignored and contains inner `.gitignore` as safety net.
- API keys are never stored in project `.ai/` folder.

### Risks & Mitigations
- **Risk:** Path conflicts/symlinks causing duplicate project entries.
  - **Mitigation:** `fs.realpathSync()` + POSIX normalization. `projectId` = `sha256(canonicalPath).slice(0, 12)`.
  - **Mitigation:** On `ai:add` — reject if path is subfolder of existing project (or vice versa).
- **Risk:** Token overhead from large project history.
  - **Mitigation:** `memoryBudget` in `.ai/context.json` — cap lines/bytes loaded. Old entries rotate to `.ai/logs/archive/`, context gets summary + last N entries.
- **Risk:** Migration confusion for existing users.
  - **Mitigation:** `ai:migrate -- --dry-run` previews changes. Copy originals, keep source until confirmed.
  - **Mitigation:** Version `config/projects.json` (`"version": 1`) for future schema migrations.
- **Risk:** Broken/deleted project path still in registry.
  - **Mitigation:** Health check on startup. Status field: `active | archived | broken`. Warning, not crash.
- **Risk:** Concurrent access to same project from multiple terminals.
  - **Mitigation:** Lockfile with PID for log writes in `.ai/`. Reads always allowed. Different projects = no conflict by design.
- **Risk:** User accidentally commits `.ai/` folder.
  - **Mitigation:** `.ai/.gitignore` with `*` as inner safety net. `ai:add` also patches root `.gitignore`.
- **Risk:** Disk growth in project `.ai/` folders.
  - **Mitigation:** `ai:gc` cleans old caches/archives. `ai:stats` shows per-project usage. Configurable `retentionDays`.
  - **Mitigation:** optional content-addressed dedup cache in hub for immutable blobs (`code_index`, archived bundles) with hash-key + read-through copy.
- **Risk:** Secret leakage through hub config or logs.
  - **Mitigation:** hub config stores secret references only, runtime redaction on logs/errors, and startup check that blocks known key patterns in JSON configs.

### Implementation Priority Matrix
```
Critical (must-have before launch):
  ├─ .ai/ scaffold creation in target project
  ├─ --project-path flag in all scripts
  ├─ Path sandbox for all writes (<project>/.ai only)
  ├─ Config inheritance (hub defaults → project overrides)
  ├─ Health check on startup
  └─ Atomic writes for config/projects.json

Important (second iteration):
  ├─ Memory budget + log rotation
  ├─ Compatibility window (ai/ + .ai/) + doctor command
  ├─ ai:stats / ai:gc
  └─ Lockfile for concurrent same-project access

Deferrable:
  ├─ TUI interface (blessed/ink)
  ├─ SQLite instead of JSON for registry
  └─ Per-project .ai-hub.yaml declaration
```

---

## 📝 Phase A/B Code Review (2026-03-01, Claude Opus 4.6)

### Review #1 — Initial Assessment

| Phase | Completeness | Notes |
|-------|-------------|-------|
| **Phase A** | 95% | Registry, scaffold, path validation — done |
| **Phase B** | 100% | Interactive selector, status — done |
| **Phase C** | 0% | Scripts don't accept `--project-path` |
| **Phase D** | 0% | No migration, no doctor |

**Action items issued:** 11 items (5 blocking, 3 parallel, 3 deferred).

### Review #2 — Post-Fix Assessment (2026-03-01, Claude Opus 4.6)

Codex closed 7 of 10 action items in one pass (`hub-phase-a-b-c-hardening`).

| Action Item | Status | Verdict |
|-------------|--------|---------|
| 1. `path-utils.js` (`safeJoinProjectData`, `resolveProjectPaths`) | Done | Approved — traversal, NUL, symlink checks solid |
| 2. `--project-path` flag in scripts | Done | Approved — generate-context.js + hub.js + memory.js |
| 3. Config inheritance (hub → project) | Done | Approved — `mergeContextConfig` + `mergeAgentsConfig` with deep merge |
| 4. `AI_HUB_ROOT` / `--hub-root` support | Done | Approved — flag + env var + fallback |
| 5. Unit tests | Partial | 2 files (path-utils + hub-cli), covers critical paths but needs expansion |
| 6. `ai:migrate -- --dry-run` | Done | Approved — copy mode, gitignore patching |
| 7. Health check in `generate-context.js` startup | **Not done** | **Needs fix** |
| 8. Secret reference support | Not done | Deferred (not a Phase C blocker) |
| 9. Refactor `generate-context.js` into modules | Not done | File grew from 2993 → 3115 lines; config functions should be extracted |
| 10. `ai:doctor` | Done | Approved — validates structure, JSON, suggests fixes |
| 11. Lockfile for concurrent access | Not done | Deferred |

#### Updated Scores

| Aspect | Before | After |
|--------|--------|-------|
| Phase C readiness | 0% | **70%** |
| Security | 5/10 | **8/10** |
| Test coverage | 0/10 | **4/10** |
| Architecture | 8/10 | **7/10** (file grew) |

#### Remaining Issues (3 items for Codex)

See `legacy/docs/CODEX_TASKS.md` for detailed implementation instructions.

1. **Health check on `generate-context.js` startup** — validate `.ai/` integrity before running context generation; if broken, print error with `ai:doctor` hint and exit.
2. **Extract config functions to `config-loader.js`** — move `mergeContextConfig`, `mergeAgentsConfig`, `loadContextConfig`, `resolveReadablePath` out of generate-context.js (~100 lines).
3. **Expand test coverage** — add tests for config inheritance, nested conflict detection, NUL byte rejection, empty path, concurrent atomic writes.

---

## 🧠 Future Feature: Hybrid Orchestration Mode (Local + Team Shared)

**Concept:**
Use a compact orchestrator model for routing/summarization/RAG while delegating complex architecture/coding to stronger cloud models.
Support two deployment modes:
- **Local Mode:** everything runs on one machine (for solo workflows).
- **Team Shared Mode:** orchestrator/vector DB/model gateway run on a team server (for weak laptops and shared memory).

### Goals
- Reduce token cost and latency by handling non-critical reasoning locally/server-side.
- Keep strong quality by escalating complex tasks to cloud frontier models.
- Maintain shared chronology of who changed what, where, and when.
- Enable multi-agent debate continuity across sessions and across team members.

### Core Capabilities
1. **Policy Router**
   - Decides model/provider by task complexity, risk, and budget.
   - Supports model-specific limits (for example stricter TPM/RPM for Claude).
2. **Context Builder + Summarizer**
   - Compresses logs/discussions before cloud calls.
   - Produces deterministic context packets for all agents.
3. **RAG Layer**
   - Pluggable vector store (`Qdrant` / `pgvector` / `Weaviate`).
   - Project-scoped retrieval with strict namespace isolation.
4. **Model Gateway**
   - Unified entrypoint for cloud APIs and self-hosted models (vLLM/Ollama/TGI).
   - Handles retries, backoff, budgets, and provider failover.
5. **Unified Audit Logs**
   - Separate logs for discussion, proposals, applied changes, and decisions.
   - Mandatory metadata: `author`, `model`, `role`, `projectId`, `threadId`, `timestamp`, `affectedFiles`.

### Team Shared Mode Requirements
- Multi-tenant isolation by `workspace/project/thread`.
- RBAC/ACL for read/write access to memory and logs.
- Encryption in transit and at rest.
- Retention policy + archival for old threads.
- Safe fallback to local mode if shared services are unavailable.

### Proposed System Topology
```text
Clients (Codex/Claude/Gemini CLI)
  -> Orchestrator API
      -> Policy Router
      -> Context Builder
      -> RAG (shared vector DB)
      -> Model Gateway
          -> Cloud LLMs
          -> Self-hosted team model
      -> Audit/Event Store
```

### Phased Rollout
1. **Phase 1: Shared Memory + Logs**
   - Deploy centralized log service and shared vector DB.
   - Enforce per-project namespaces and required metadata.
2. **Phase 2: Model Gateway**
   - Add unified provider adapter with per-model budgets/rate limits in config.
   - Add retries/backoff/timeout strategies.
3. **Phase 3: Orchestrator Model**
   - Introduce compact orchestrator model (local or shared server).
   - Route summarization, context packing, and low-risk tasks through it.
4. **Phase 4: Adaptive Escalation**
   - Auto-escalate to strong cloud models for high-risk/high-complexity tasks.
   - Add quality gates (tests/lint/static checks) before accepting outputs.
5. **Phase 5: Distillation (Optional)**
   - Use historical logs/outcomes for supervised distillation/LoRA.
   - Keep legal/licensing checks and strict offline evaluation before rollout.

### Success Metrics
- `Cost per accepted change` reduced by 30-60%.
- `Median first-response latency` reduced by 20-40%.
- `Regression rate` reduced by better routing + memory continuity.
- `Context miss rate` reduced (fewer repeated clarifications from user).

### Risks & Mitigations
- **Risk:** Context leakage across projects/tenants.
  - **Mitigation:** Namespace enforcement + ACL checks at storage and retrieval layers.
- **Risk:** Shared service becomes a single point of failure.
  - **Mitigation:** Health checks + fallback to local mode + circuit breakers.
- **Risk:** Operational complexity increases.
  - **Mitigation:** Start with Phase 1-2 only, add observability and SLOs before scaling.

---

## ⚡ Future Feature: Performance & Flexibility Acceleration Pack

**Concept:**
Improve throughput, reduce token spend, and increase orchestration flexibility with a focused set of runtime optimizations.
Primary scope: local/team orchestration layer, retrieval/runtime path, and system-level control plane.

### Planned Improvements
1. **Delta Context Packing**
   - Send only context deltas plus short rolling summaries instead of full history.
   - Reduce token usage and request payload size.
2. **Two-Level Caching**
   - Prompt cache for normalized inputs.
   - Result cache keyed by task fingerprint + toolchain/model version.
3. **Incremental Code Indexing**
   - Re-index only changed files via hash/watch events.
   - Avoid full-project indexing on each run.
4. **Adaptive SLA Router**
   - Route tasks by complexity/risk/budget to fast or frontier models.
   - Enforce latency/cost quality-of-service targets.
5. **Speculative Parallelism + Early Cancel**
   - Run multiple candidates in parallel for critical steps.
   - Stop slower candidates when one passes quality gates.
6. **Impact-Based Testing**
   - Run tests impacted by changed files first.
   - Keep full test suites for scheduled/nightly validation.
7. **Unified Tool Gateway Reliability**
   - Centralized retry/backoff/timeout/rate-limit/circuit-breaker logic.
   - Consistent provider fallback behavior.
8. **Structured Output Contracts**
   - Enforce JSON schema for planner/reviewer/synthesizer outputs.
   - Reduce parser failures and orchestration ambiguity.
9. **Plugin Architecture for Models/Roles**
   - Provider and role capability registry.
   - Add new models/agents without core orchestration rewrites.
10. **Observability + Auto-Tuning**
   - Track latency/cost/success/regression/context-miss metrics.
   - Periodically auto-adjust routing and context budgets based on telemetry.

### Suggested Delivery Sequence
1. Delta context packing + incremental indexing.
2. Adaptive SLA router + structured output contracts.
3. Two-level cache + unified tool gateway reliability.
4. Impact-based testing + speculative parallelism.
5. Plugin architecture + observability-driven auto-tuning.

### Success Metrics
- Lower median and p95 response latency.
- Lower average tokens per accepted change.
- Lower provider error/retry amplification rate.
- Faster recovery from provider degradation.
- Lower context miss rate and clarification loops.

---

## ☁️ Future Feature: Cloud Frontier Quality Program

**Concept:**
Improve correctness, reasoning reliability, and consistency of answers produced by cloud frontier models (Claude, GPT, Gemini) without relying on local fine-tuning.

### Planned Improvements
1. **Provider-Specific Prompt Profiles**
   - Maintain separate prompt templates per provider/model family.
   - Tune instruction style, verbosity bounds, and tool-use behavior per model.
2. **Strict Response Contracts**
   - Require structured sections for assumptions, answer, evidence, and risks.
   - Reject and regenerate responses that violate schema or omit required fields.
3. **Evidence-First RAG Pack**
   - Build compact evidence packets with source ranking before cloud calls.
   - Force citation binding for factual claims in high-risk tasks.
4. **Two-Pass Reasoning**
   - Pass 1: draft answer.
   - Pass 2: verifier critiques logic gaps and unsupported claims, then final rewrite.
5. **Self-Consistency Voting**
   - Generate multiple reasoning candidates on hard tasks and select consensus output.
   - Use rubric scoring for correctness/completeness/risk.
6. **Uncertainty and Clarification Gate**
   - If ambiguity exceeds threshold, ask targeted clarification before final response.
   - Surface confidence level and explicit unknowns in final output.
7. **Policy Guardrails for Hallucination Reduction**
   - Block unsupported assertions in legal/financial/medical/security-sensitive flows.
   - Require either evidence link or explicit uncertainty tag.
8. **Golden Evaluation Set**
   - Create project-specific benchmark prompts with expected outcomes.
   - Run weekly regressions across providers/models and compare deltas.
9. **Dynamic Model Selection for Quality**
   - Route to stronger cloud model when complexity/risk score is high.
   - Route routine tasks to faster/cheaper model with quality thresholds.
10. **Answer Quality Telemetry**
   - Track factual error rate, contradiction rate, correction loops, and user re-ask rate.
   - Feed metrics back into prompt/profile/router tuning.

### Suggested Delivery Sequence
1. Provider-specific prompt profiles + strict response contracts.
2. Evidence-first RAG pack + uncertainty/clarification gate.
3. Two-pass reasoning + hallucination guardrails.
4. Golden evaluation set + quality telemetry.
5. Self-consistency voting + dynamic quality routing.

### Success Metrics
- Lower factual error and contradiction rate.
- Lower number of user follow-up corrections.
- Higher first-pass acceptance rate of model answers.
- Stable quality across provider/model updates.

---

## 🔄 Future Feature: Checkpoint-based Flow Resume

**Concept:**
On every startup, detect if a previous run was interrupted. If yes — prompt the user: continue from the last successful step or restart from scratch. Uses the existing `=== END OF DOCUMENT ===` marker (already required by PROTOCOL.md and SYSTEM_PROMPT.md) to determine whether an agent's output is complete or truncated.

### Problem
The current flow is a linear pipeline of 5-7 phases, each costing API tokens. An interruption at phase 4 (critique) loses the paid results of phases 1-3. On retry, everything restarts from zero.

### Core Principle: Always Check, Always Ask

On every `npm run ai` startup:
1. Check if `.ai/prompts/run/run-flow.json` exists
2. If yes — scan agent output files for `=== END OF DOCUMENT ===` marker
3. Determine which phases completed, which are partial, which are pending
4. **Ask the user:** `Interrupted run detected (prompt: "..."). Continue from <phase>? [Y/n]`
5. If user says yes → resume from the last incomplete phase
6. If user says no → archive old `run/`, start fresh

No special flag needed. This is the default behavior.

### Completeness Detection

An agent output file is considered **complete** if and only if it contains the `=== END OF DOCUMENT ===` marker. This is already enforced by:
- `ai/PROTOCOL.md` (line 67): mandatory end marker
- `ai/SYSTEM_PROMPT.md` (line 40-46): required in every saved response
- `generate-context.js:81`: `const END_MARKER = '=== END OF DOCUMENT ==='`
- All prompt builders (lines 1380, 1395, 1426, 1446, 1483): instruct agents to append the marker

**Detection logic:**
```javascript
function isOutputComplete(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8').trimEnd();
  return content.endsWith('=== END OF DOCUMENT ===');
}
```

### Flow State File: `run-flow.json`

Stored in `.ai/prompts/run/run-flow.json`. Single source of truth for current run state.

```json
{
  "version": 1,
  "runId": "run-1709312400",
  "startedAt": "2026-03-01T18:00:00Z",
  "prompt": "original user prompt",
  "promptHash": "sha256-of-prompt-first-12-chars",
  "flags": ["--prepost", "--test"],
  "phases": [
    {
      "name": "context",
      "status": "done",
      "finishedAt": "2026-03-01T18:00:05Z",
      "outputFile": "01-context.json"
    },
    {
      "name": "preprocess",
      "status": "done",
      "finishedAt": "2026-03-01T18:00:12Z",
      "outputFile": "02-preprocess.txt",
      "agent": "prompt-engineer",
      "tokens": 512
    },
    {
      "name": "proposals",
      "status": "partial",
      "agents": {
        "architect":  { "status": "done", "outputFile": "03-proposals/architect.txt", "tokens": 2800 },
        "reviewer":   { "status": "done", "outputFile": "03-proposals/reviewer.txt", "tokens": 3100 },
        "developer":  { "status": "failed", "error": "fetch failed", "outputFile": null }
      }
    },
    {
      "name": "critiques",
      "status": "pending"
    },
    {
      "name": "consensus",
      "status": "pending"
    }
  ]
}
```

### Resume Logic per Phase Type

**Single-agent phases** (preprocess, consensus, devils-advocate, postprocess):
- File exists + has `END OF DOCUMENT` → `done`, skip
- File exists but no marker → `truncated`, re-run agent
- File missing → `pending`, run agent

**Multi-agent parallel phases** (proposals, critiques):
- Check each agent's output file independently
- Resume only failed/truncated agents, keep completed ones
- Phase is `done` only when all agents are `done`

**Context phase:**
- `01-context.json` contains collected files + index + pack
- If present and valid JSON → skip (biggest time saver, no API cost but slow I/O)
- If missing or corrupt → rebuild

### Startup Flow

```
npm run ai -- --prompt="..."

  ┌─ run-flow.json exists?
  │
  ├─ NO → create run-flow.json, start fresh
  │
  └─ YES → read run-flow.json
           │
           ├─ promptHash matches current prompt?
           │   │
           │   ├─ YES → find first non-done phase
           │   │         ask: "Interrupted run detected. Resume from <phase>? [Y/n]"
           │   │         │
           │   │         ├─ Y → resume
           │   │         └─ N → archive run/, start fresh
           │   │
           │   └─ NO → warn: "Previous run had different prompt"
           │            ask: "Discard previous run and start fresh? [Y/n]"
           │            │
           │            ├─ Y → archive run/, start fresh
           │            └─ N → exit (user can --restart to force)
```

### CLI Flags

| Flag | Behavior |
|------|----------|
| *(no flag)* | Auto-detect interrupted run, ask user |
| `--restart` | Ignore any existing run-flow.json, start fresh without asking |
| `--non-interactive` | Auto-resume if interrupted run found (for CI/scripts) |

### File Layout

```
.ai/prompts/run/                    ← current run (only one active at a time)
  run-flow.json                     ← flow state
  01-context.json                   ← context snapshot
  02-preprocess.txt                 ← prompt-engineer output
  03-proposals/
    architect.txt                   ← each agent's proposal
    reviewer.txt
    developer.txt
  04-critiques/
    architect.txt                   ← each agent's critique
    reviewer.txt
    developer.txt
  05-consensus.txt                  ← synthesizer output
  06-devils-advocate.txt            ← challenge (optional)
  07-postprocess.txt                ← tester output (optional)

.ai/prompts/archive/                ← completed/discarded runs
  run-1709312400/                   ← archived with runId
    run-flow.json
    ...
```

### Token Savings on Resume

| Failure point | Without resume | With resume | Savings |
|---------------|---------------|-------------|---------|
| After context | Re-collect all files | Skip I/O | ~30s time |
| After proposals (3 agents) | Re-run all 3 | Skip all 3 | ~60% tokens |
| After 2/3 proposals | Re-run all 3 | Run 1 agent | ~40% tokens |
| After critiques | Re-run proposals + critiques | Skip both | ~80% tokens |
| After consensus | Re-run everything | Skip all, re-run only postprocess | ~90% tokens |

### Implementation Plan

1. **New module: `ai/scripts/checkpoint-manager.js`** (~200 lines)
   - `createRun(prompt, flags, agents)` → runId, creates `run-flow.json`
   - `loadRun()` → parsed `run-flow.json` or null
   - `updatePhase(phaseName, status, data)` → atomic write to `run-flow.json`
   - `isAgentDone(phaseName, agentName)` → checks file + END marker
   - `isOutputComplete(filePath)` → checks `=== END OF DOCUMENT ===`
   - `archiveRun(runId)` → moves `run/` to `archive/run-{id}/`
   - `getResumePoint(runFlow)` → first non-done phase name

2. **Integration into `generate-context.js`** (~60 lines of changes)
   - Before each phase: `if (checkpoint.isAgentDone(phase, agent)) skip`
   - After each phase: `checkpoint.updatePhase(phase, 'done', { tokens, file })`
   - On startup: `loadRun()` → ask user → resume or restart
   - On success: `archiveRun(runId)`

3. **Tests: `ai/scripts/__tests__/checkpoint-manager.test.js`** (~100 lines)
   - `isOutputComplete` with/without marker
   - `createRun` + `loadRun` round-trip
   - `updatePhase` partial status
   - `getResumePoint` finds correct phase
   - `archiveRun` moves files

### Risks & Mitigations
- **Risk:** Stale checkpoint from days ago auto-resumes with outdated context.
  - **Mitigation:** Show run age in prompt: `"Interrupted run from 3 days ago..."`. Add `--restart` to force fresh start.
- **Risk:** Agent output file exists but content is garbage (API error returned HTML).
  - **Mitigation:** `isOutputComplete` checks END marker. No marker = re-run. Optionally validate JSON structure for context phase.
- **Risk:** `run-flow.json` corruption mid-write.
  - **Mitigation:** Atomic writes (same `tmp + rename` pattern as `config/projects.json`).

---

## 🎯 Context Pack Improvements (2026-03-02, Claude Opus 4.6)

### Problem

Dry-run testing of `buildContextPack()` revealed **40% fallback rate** — 4 out of 10 realistic
prompts fail to match any symbols, causing full-file fallback (zero token savings).

Root causes:
1. **Russian prompts → 0 matches.** Tokenizer extracts Russian words but symbol names are English.
2. **File-name matching is weak.** Mentioning `hub.js` doesn't reliably select symbols from that file.
3. **0 edges in AST mode.** `extractEdgesAst()` only finds import/require edges; regex ref edges skipped in AST mode.

### Planned Fixes (see `legacy/docs/CODEX_TASKS.md`)

| Task | File | Summary |
|------|------|---------|
| 1 | `context-pack.js` | `fileNameSeeds()` — extract file refs from prompt, include all symbols from those files |
| 2 | `context-pack.js` | `translateTokens()` + `RU_EN_DICT` — ~60-term dictionary mapping Russian dev terms to English |
| 3 | `context-index.js` | Hybrid edge extraction — AST import edges + regex ref edges (deduplicated) |
| 4 | `__tests__/context-pack.test.js` | Unit tests + integration tests for Russian/file-name prompts |
| 5 | Dry-run verification | Target: ≤1 fallback out of 10 prompts |

### Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Fallback rate | 40% | ≤10% |
| Russian prompt coverage | 0% | ~80% |
| File-name precision | Low (wrong files) | High (correct file symbols) |
| Graph edges (AST mode) | 0 | >0 (hybrid) |

---

## 📋 Completed
- [x] **Workspace Hub Mode — Phase A:** Project registry + `ai:add/list` + `.ai/` scaffold. *(done 2026-03-01)*
- [x] **Workspace Hub Mode — Phase B:** Interactive project selector + `ai:status`. *(done 2026-03-01)*
- [x] **Workspace Hub Mode — Phase C:** Health check + config-loader.js + tests 20+. *(done 2026-03-01)*
- [x] **Workspace Hub Mode — Phase D:** Migration + gc/stats + extended doctor. *(done 2026-03-01)*
- [x] **Checkpoint-based Flow Resume:** Auto-detect interrupted runs, per-agent resume, fingerprint-aware. *(done 2026-03-01)*
- [x] **Context Pack Improvements:** File-name seeds + RU→EN dictionary + hybrid edges. Fallback 40%→10%. *(done 2026-03-02)*
- [x] **System Prompt Standardization:** All system files (SYSTEM_PROMPT, PROTOCOL, discussion_pattern) translated to English. *(done 2026-03-02)*

---

## ✅ Completed: Response Quality & Pipeline Hardening (2026-03-02)

> 3-phase rollout. All phases verified with 125/125 tests (now 245 with refinement + full coverage hardening Tiers 1–4 + additional suites).

### Phase 1 — Core Quality Checks
- [x] **Prompt Quality Gate** (`prompt-gate.js`) — local specificity scoring before API calls
- [x] **Response Validation Pipeline** (`response-validator.js`) — refusal detection, length, confidence
- [x] **Unit tests** — 19 tests for gate + validator

### Phase 2 — Pipeline Intelligence
- [x] **Consensus Agreement Scoring** — ✅/❌ counting from critique tables
- [x] **Delta Context** — strips code fragments for later phases (40-60% token savings)
- [x] **Unit tests** — 15 tests for agreement + delta context

### Phase 3 — Optimization & Profiles
- [x] **Adaptive Context Budget** — per-agent `contextBudget` in agents.json
- [x] **Result Cache** — sha256(prompt + index), zero-cost identical reruns
- [x] **Provider-Specific Profiles** — anthropic.md, openai.md, google.md
- [x] **Quality Feedback Loop** — 1-5 rating stored in metrics/quality.json
- [x] **Unit tests** — 10 tests for cache + profiles

---

## 🎯 Current Status (2026-03-05)

**All planned iterations complete.** 275 passed, 1 skipped. Test coverage hardening (Tiers 1–4) closed + additional suites beyond tiers.

- `--refine` / `--feedback="..."` — consensus-only re-run with user feedback (~15-20% token cost vs full run)
- Path traversal guard on archived outputFile reads (realpath + isSameOrSubPath)
- Skips index build in refine mode for fast turnaround
- Instruction sources separated: `ai/PROTOCOL.md` (agent-only) + `HUB_RULES.md` (hub-dev-only)
- Engineering discipline rules added to `ai/SYSTEM_PROMPT.md` (self-review, scope, verify, incremental, impact check, assumptions)
- Hub-only Architecture (Strict Dispatcher) complete: hard-fail guard, require transport for 4/8 modes, legacy aliases removed, bypass removed

**Next step:** Pilot on real project (see `ai/PILOT_RUNBOOK.md`), then Stack-Aware Dynamic Skills, then Jira Integration.

---

## 🧪 Planned Iteration: Test Coverage Hardening

**Goal:** Close major test gaps across all hub modules. Started at 169/169. Final: **245 passed, 1 skipped**.

Gap analysis performed 2026-03-03. Priority order by impact and risk.

### Tier 1 — Critical gaps (completed 2026-03-03)

| # | Module | File | Key cases | Est. tests |
|---|--------|------|-----------|------------|
| 1 | init-project | `ai/scripts/init-project.js` | detectProjectType, normalizeContextConfig, redactSecrets, parseBootstrapResponse, validateBootstrapPayload, --dry-run no writes, --force backup | ~15 |
| 2 | memory | `ai/scripts/memory.js` | --log invalid values, fallback entries/bytes from memoryWindow/logWindow, --project-path invalid, .ai/ai/--ai-dir precedence | ~8 |
| 3 | language-specs | `ai/scripts/language-specs.js` | invalid regex on validate, duplicate ext/id, negative scaffold args, add with extension conflict, sort after add | ~8 |

Status: ✅ Implemented (20 new tests total across Tier 1 modules).

### Tier 2 — Medium priority (completed 2026-03-03)

| # | Module | File | Key cases | Est. tests |
|---|--------|------|-----------|------------|
| 4 | cleanup | `ai/scripts/cleanup.js` | no archive dir, <= KEEP_COUNT, > KEEP_COUNT deletes oldest by mtime | ~4 |
| 5 | architecture-check | `ai/scripts/architecture-check.js` | invalid architecture-rules.json, CLI threshold override, god-module detection, ignore-dir/ignore-path filter | ~6 |
| 6 | config-loader | `ai/scripts/config-loader.js` | resolveReadablePath with hub fallback, readJsonIfExists invalid JSON, loadContextConfig bad exclude + INVALID_CONTEXT_CONFIG | ~5 |

Status: ✅ Implemented (13 new tests total across Tier 2 modules).

### Tier 3 — Hardening & regression (completed 2026-03-04)

| # | Module | File | Key cases | Est. tests |
|---|--------|------|-----------|------------|
| 7 | path-utils | `ai/scripts/path-utils.js` | resolveHubRoot env/flag/error, canonicalProjectPath file/not-found, symlink-escape in safeJoinProjectData | ~5 |
| 8 | hub (extended) | `ai/scripts/hub.js` | project precedence (--project-path > hub-config > lastUsed), invalid config/hub-config.json, start non-TTY multi-project, doctor warnings (legacy ai/, large dir) | ~6 |
| 9 | context-index | `ai/scripts/context-index.js` | resolveMode fallback warning, ignore patterns (*, ?), incremental reuse previousIndex, dedupe edges AST+regex hybrid | ~5 |

Status: ✅ Implemented. Review comments resolved (boilerplate reduction, stronger assertions, magic number extraction).

### Tier 4 — Infra (completed 2026-03-04)

| # | Item | Action |
|---|------|--------|
| 10 | `context-pack-dry-run.js` | Rename to `context-pack-dry-run.test.js`, wrap in `test.skip()` so it's visible in suite but not auto-executed |

Status: ✅ Implemented.

### Beyond Tiers — Additional Coverage (2026-03-04, Codex)

After closing all 4 tiers, additional test suites were added:

| Suite | Tests | Coverage |
|-------|-------|----------|
| `prompt-gate.test.js` | 12 | Score/verdict thresholds, RU→EN translation-sensitive scoring, format output |
| `response-validator.test.js` | ~6 | Length/END marker/refusal/file-refs/confidence validation, formatValidation |
| `context-index-treesitter.test.js` | 6 | AST mock system (createNode/createCursor), Module._load isolation, availability/symbols/edges/parser errors |
| `generate-context.bootstrap.integration.test.js` | 7 | Project resolution contract: hub-config > registry > --project-path > env > .ai vs legacy ai/ |
| `generate-context.failures.integration.test.js` | 7 | Failure paths: invalid --project-path/--hub-root, missing .ai dir/context.json/agents.json, invalid JSON/schema |
| `helpers/generate-context-test-utils.js` | — | Shared helper: `runGenerateContext()` with `options.env`/`options.repoRoot` |

Full precedence chain covered: `--project-path > AI_HUB_PROJECT_PATH env > config/hub-config.json > config/projects.json:lastUsed`.

### Final count: **245 passed, 0 failed, 1 skipped**.

### Verification policy

After any hub code/config/docs change, all models must run `npm run ai:test` before finalizing.

---

## 🔗 Planned Feature: Jira Integration + Auto-Branch/PR (`jira-take`)

**Concept:**
Hub connects to Jira via REST API v3, pulls tasks marked for AI processing, runs the full pipeline, commits changes to a new branch, creates a PR, and updates the Jira ticket status with a link to the PR.

### Why
- Eliminates manual prompt writing — ticket description becomes the prompt.
- Full traceability: Jira ticket → branch → PR → result.txt.
- Reduces context switching: developer reviews PR, not raw AI output.

### Scope (MVP)

**Does:**
- Read Jira tasks by project key + JQL filter
- Parse ticket (summary + description + acceptance criteria) into a structured prompt
- Create branch `ai/{TICKET-KEY}`, run pipeline, commit, push, create PR
- Transition ticket to "In Review" + comment with PR link
- Reject low-quality tickets (prompt gate score < threshold) with a Jira comment

**Does NOT (YAGNI for MVP):**
- Watch mode / cron polling (manual `jira-take` only)
- Multi-ticket batch processing
- Auto-merge PRs
- Custom Jira workflow / webhook listeners
- Subtask creation or time tracking

### Project ↔ Jira Mapping

In `config/projects.json`, each project gets an optional `jira` block:

```json
{
  "path": "/home/kair/my-app",
  "jira": {
    "baseUrl": "https://company.atlassian.net",
    "projectKey": "MYAPP",
    "filter": "status = 'AI Ready'",
    "reviewer": "kair"
  }
}
```

- `filter` — JQL query to find tasks eligible for AI (default: `status = 'AI Ready'`)
- `reviewer` — optional GitHub username for PR assignment; if omitted, PR is unassigned
- Credentials (`JIRA_EMAIL`, `JIRA_TOKEN`) — resolved from `.ai.env` at runtime, never stored in config

### CLI Interface

```bash
# List Jira tasks available for AI processing
npm run ai:jira-list

# Take a specific task into work
npm run ai:jira-take -- MYAPP-123

# Future: watch for new tasks (not in MVP)
npm run ai:jira-watch
```

### Execution Flow (`jira-take MYAPP-123`)

```
1. Resolve project from MYAPP → config/projects.json lookup by jira.projectKey
2. GET /rest/api/3/issue/MYAPP-123  →  parse summary, description, acceptance criteria
3. Build prompt from ticket via jira-prompt-builder
4. Run prompt through existing prompt quality gate
   ├─ score >= threshold → proceed
   └─ score < threshold → POST comment to Jira: "Needs more detail", exit
5. `npm run ai:start -- --project-path=/abs/project/path` (activate if not current)
6. git checkout -b ai/MYAPP-123
7. npm run ai -- --prompt="<generated prompt>" --non-interactive
8. git add -A && git commit -m "MYAPP-123: <summary from result>"
9. git push -u origin ai/MYAPP-123
10. gh pr create --title "MYAPP-123: <summary>" --body "<from result.txt>"
    ├─ if reviewer configured → --reviewer=<reviewer>
    └─ otherwise → unassigned
11. Jira: transition MYAPP-123 → "In Review"
12. Jira: POST comment with PR link
```

### Ticket → Prompt Template

```markdown
# Task: {summary}
# Jira: {key} ({status})
# Project: {projectKey}

## Description
{description → converted to markdown}

## Acceptance Criteria
{custom field / checklist, if present}

## Constraints
- Branch: ai/{key}
- Do not modify: {protected paths from project config, if any}
```

### New Files

| File | Purpose |
|------|---------|
| `ai/scripts/jira-client.js` | REST API v3 wrapper: fetch issue, transition status, post comment |
| `ai/scripts/jira-prompt-builder.js` | Ticket → prompt.txt conversion + quality gate check |
| `ai/scripts/hub.js` (modify) | Add `jira-list` and `jira-take` commands |
| `ai/scripts/__tests__/jira-client.test.js` | Unit tests with mocked HTTP responses |
| `ai/scripts/__tests__/jira-prompt-builder.test.js` | Prompt generation + edge cases |

### Security

- Jira token and email from `.ai.env` (same pattern as LLM API keys)
- No credentials in `config/projects.json` or any committed file
- Path sandbox enforced for all git operations (within project root only)
- PR body sanitized — no raw Jira tokens or internal URLs leaked

### Risks & Mitigations

- **Risk:** Low-quality Jira tickets produce bad prompts → wasted tokens.
  - **Mitigation:** Prompt quality gate rejects and comments in Jira with specific feedback.
- **Risk:** Git conflicts if branch already exists.
  - **Mitigation:** Check `git branch --list ai/{key}` before creating; if exists, warn and exit.
- **Risk:** Jira API rate limits.
  - **Mitigation:** Single-task mode (no batch), no polling loop. One API call per command.
- **Risk:** Jira field structure varies across instances (custom fields, different workflows).
  - **Mitigation:** MVP uses only standard fields (summary, description). Custom field mapping is a future enhancement.

### Future Extensions (post-MVP)

- `jira-watch` — poll on interval or webhook listener for new "AI Ready" tickets
- Multi-ticket batch with priority ordering
- Custom field mapping configuration per project
- Auto-link related Jira tickets as context for the prompt
- Status sync: if PR is merged → transition Jira to "Done"

---

## 📚 Planned Feature: Documentation Compiler + NotebookLM Publishing Layer (`docs:compile`)

> Discussion-stage proposal (Codex, 2026-03-09). No implementation started yet.

**Concept:**
Build a canonical documentation pipeline where Jira data, repository documents, code intelligence, and Hub runtime artifacts are compiled into structured project docs inside `.ai/docs/`. NotebookLM Enterprise is treated as an optional publishing and exploration layer, not the source of truth.

### Why
- Jira tickets are too noisy and inconsistent to serve as durable documentation on their own.
- Hub already owns context assembly, logs, run artifacts, and project scoping; it is the natural place to normalize them.
- NotebookLM works better with curated source packs than with raw prompt archives or full repositories.
- End-to-end traceability becomes explicit: Jira issue -> implementation run -> compiled feature doc -> project knowledge base -> Notebook notebook.

### Core Principle
- **Canonical source of truth:** repository docs + `.ai/docs/`
- **Compilation/orchestration:** Hub
- **External read surface:** NotebookLM Enterprise (optional)
- **Default rule:** never publish raw prompts/logs directly; publish curated outputs with `sourceRefs` and `confidence`

### Canonical Unit: Feature Dossier

For each feature or Jira task, Hub produces one normalized dossier:

```json
{
  "id": "MYAPP-123",
  "title": "Add audit export",
  "status": "in_review",
  "businessValue": "...",
  "scope": ["..."],
  "acceptanceCriteria": ["..."],
  "affectedModules": ["src/audit/export.ts"],
  "implementationSummary": "...",
  "testSummary": "...",
  "knownGaps": ["..."],
  "openQuestions": ["..."],
  "sourceRefs": [
    { "type": "jira", "ref": "MYAPP-123" },
    { "type": "file", "ref": "README.md" },
    { "type": "artifact", "ref": ".ai/prompts/result.txt" }
  ],
  "confidence": 0.84
}
```

### Proposed Output Layout

```text
.ai/
  docs/
    features/
      MYAPP-123/
        feature.md
        feature.json
    project/
      system-overview.md
      capability-map.md
      feature-catalog.md
      integration-map.md
      release-notes-draft.md
    notebooklm/
      manifest.json
```

### Source Inputs
- **Jira:** summary, description, acceptance criteria, comments, linked issues, epic metadata
- **Repository docs:** README, ADRs, runbooks, changelogs, API docs, architecture notes
- **Code intelligence:** `.code_index.json`, `.context_bundle.md`, selected file evidence
- **Hub artifacts:** `result.txt`, archive outputs, proposal/critique summaries, refine outputs, quality metrics
- **Git/PR metadata:** branch, commit summaries, PR title/body, changed file list
- **Future optional connectors:** Confluence, product specs, incident postmortems

### CLI Surface (MVP)

```bash
# Build/update one feature dossier
npm run ai:docs:compile -- --issue=MYAPP-123

# Rebuild project-level compiled docs from feature dossiers
npm run ai:docs:project -- --project-path=/abs/path/to/project

# Sync curated docs to NotebookLM Enterprise
npm run ai:notebooklm:sync -- --project-path=/abs/path/to/project
```

### Execution Flow
1. Resolve target project from `--project-path` or Jira `projectKey` mapping.
2. Load Jira ticket data plus local project sources and Hub artifacts.
3. Normalize markdown/text, deduplicate overlapping facts, and map claims to evidence.
4. Build one `feature dossier` (`feature.md` + `feature.json`) with explicit `sourceRefs` and `confidence`.
5. Run a documentation quality gate before publish:
   - missing acceptance criteria
   - contradictory claims
   - unsupported implementation statements
   - unresolved placeholders / TODO facts
6. Regenerate project-level aggregate docs from accepted dossiers.
7. Optionally sync only curated docs to NotebookLM Enterprise and update `.ai/notebooklm/manifest.json`.

### Integration with `jira-take`
- `jira-take` should remain the task-execution command, not the canonical documentation compiler.
- Recommended coupling:
  - **Before implementation:** create a pre-run dossier from Jira + repo context.
  - **After implementation:** enrich the dossier with implementation summary, test summary, PR link, and changed modules.
- Optional future flags:
  - `npm run ai:jira-take -- MYAPP-123 --compile-docs`
  - `npm run ai:jira-take -- MYAPP-123 --publish-notebook`

### Potential New Files

| File | Purpose |
|------|---------|
| `ai/scripts/docs-compiler.js` | Multi-source feature dossier compiler |
| `ai/scripts/project-docs-builder.js` | Aggregate project docs from accepted dossiers |
| `ai/scripts/notebooklm-client.js` | NotebookLM Enterprise sync adapter |
| `ai/scripts/documentation-quality-gate.js` | Completeness/consistency/evidence validation |
| `ai/scripts/jira-source-loader.js` | Jira normalization and field mapping helper |

### MVP Scope

**Does:**
- Compile structured feature dossiers from Jira + repo + Hub artifacts
- Build project-level curated docs from dossier outputs
- Keep NotebookLM sync idempotent through local manifest/hash tracking
- Enforce `sourceRefs` / `confidence` on generated documentation

**Does NOT:**
- Upload full repositories or raw log archives to NotebookLM
- Treat NotebookLM as the canonical store
- Assume cross-notebook retrieval/querying
- Automate notebook chat workflows
- Require Confluence in MVP

### Risks & Mitigations
- **Risk:** Jira descriptions are low-quality or stale.
  - **Mitigation:** Dossier compiler merges Jira with repo docs and Hub artifacts; unsupported claims stay in `openQuestions`.
- **Risk:** NotebookLM sources are static snapshots and drift from the repo.
  - **Mitigation:** Manifest + hash-based sync; only changed curated docs are republished.
- **Risk:** Notebook-level fragmentation across many projects/features.
  - **Mitigation:** Per-project notebook as default, plus optional portfolio notebook built only from project summaries.
- **Risk:** Vendor lock-in if NotebookLM becomes the main knowledge store.
  - **Mitigation:** `.ai/docs/` stays canonical; NotebookLM is a derived publication target.
- **Risk:** Token/cost bloat from publishing too much detail.
  - **Mitigation:** Publish only curated markdown/json summaries, not raw debate history or full code snapshots.

### Discussion Questions For Other Models
1. Should `feature dossier` IDs be strictly Jira-based, or should the schema also support non-Jira feature IDs from local product docs?
2. What is the minimal mandatory field set required before a dossier can be marked publishable?
3. Should project-level docs be rebuilt fully on each run, or incrementally updated per accepted dossier?
4. Which source should own the implementation summary: git diff heuristics, final consensus output, or both with precedence rules?
5. Should NotebookLM sync publish every feature dossier individually, or only project-level aggregate docs plus a few flagship features?
6. Is Confluence an explicit post-MVP connector, or should the source model be designed from day one to support it cleanly?

### Consensus Draft (Proposed Starting Point, 2026-03-09)

**Recommended MVP decisions**
- The first deliverable is **local canonical docs in `.ai/docs/`**, not NotebookLM sync.
- `feature dossier` is the only atomic input allowed to feed project-level aggregate docs.
- Default dossier format is dual-output: `feature.md` for humans + `feature.json` for tooling.
- Minimum publishable dossier fields:
  - `id`
  - `title`
  - `status`
  - `sourceRefs`
  - `confidence`
  - `acceptanceCriteria` or explicit `missingAcceptanceCriteriaReason`
  - `implementationSummary` or explicit `implementationStatus`
- Proposed source precedence for conflicting facts:
  1. current repo state + accepted project docs
  2. merged PR / final implementation artifacts
  3. accepted Hub run outputs (`result.txt`, reviewed summaries)
  4. Jira ticket text/comments
  5. model inference marked as assumption
- NotebookLM sync default policy:
  - publish **project-level aggregate docs first**
  - publish individual feature dossiers only behind an explicit flag or allowlist
- Notebook topology:
  - one notebook per project by default
  - optional portfolio notebook built only from project summaries, never raw feature archives
- Confluence remains post-MVP unless another model demonstrates a compelling low-complexity adapter path.

**Recommended phased rollout**
1. `ai:docs:compile`
   - build one dossier from Jira + repo + Hub artifacts
   - write only local outputs under `.ai/docs/`
2. `ai:docs:project`
   - aggregate accepted dossiers into project-level docs
   - add documentation quality gate and staleness detection
3. `jira-take` hooks
   - pre-run dossier creation
   - post-run dossier enrichment
4. `ai:notebooklm:sync`
   - publish curated project docs through manifest/hash-based sync

**Go / No-Go gates before NotebookLM sync work starts**
- At least one real project can build dossiers and project aggregates idempotently.
- Dossier schema survives one pilot without field churn.
- Evidence mapping and secret redaction work well enough that docs can be published safely.
- Incremental regeneration strategy is defined well enough to avoid full rebuild on every tiny change.
- Notebook sync manifest proves stable create/update behavior without duplicate source spam.

**What this draft intentionally leaves open**
- Whether non-Jira features get first-class IDs in MVP or only after the first pilot.
- Whether implementation summary should be mostly git-derived, run-derived, or merged with explicit precedence.
- Whether flagship feature dossiers deserve notebook publication by default in addition to project aggregate docs.

### Codex Position (2026-03-09)
- The compiler should be a standalone Hub capability, not embedded inside `jira-take`.
- `feature dossier` should be the atomic documentation unit and the only thing allowed to feed aggregate docs.
- NotebookLM should stay optional and downstream from local canonical docs.
- Quality gates matter as much here as in code generation; "compiled but unsupported" docs are worse than missing docs.

---

## 🧱 Future Feature: Hub-only Architecture (Strict Dispatcher)

**Concept:**
Make `hub.js` the sole entry point for all operations, removing the concept of "local execution". All project runs (`run`, `light`, `index`, `pack`, `init`, `memory`, `arch:check`) are dispatched exclusively through `hub.js`.

### Why
- Eliminates confusion between "running locally" vs "running via hub".
- Ensures all commands respect active project config and strict path resolution.
- Enforces isolation: target scripts no longer rely on `process.cwd()` and require an explicit `--project-path` (passed down by `hub.js`).

### Scope Split (must be explicit)
- **Project-scoped commands (dispatched via hub):** `ai`, `ai:light`, `ai:index`, `ai:pack`, `ai:init`, `ai:memory`, `ai:clean`, `ai:arch:check`.
- **Hub-scoped commands (stay in hub context):** `ai:start`, `ai:add`, `ai:list`, `ai:status`, `ai:doctor`, `ai:migrate`, `ai:gc`, `ai:stats`, `ai:lang:list`, `ai:lang:validate`, `ai:lang:scaffold`, `ai:lang:add`.

### CLI Surface Simplification (remove `ai:hub` prefix)
- Goal: remove user-facing `ai:hub` wrapper in Hub-only mode; keep one flat CLI surface.
- New public commands:
  - `ai:start`, `ai:add`, `ai:list`, `ai:status`, `ai:doctor`, `ai:migrate`, `ai:gc`, `ai:stats`
- Internally, `hub.js` remains dispatcher/router implementation detail.
- Status (2026-03-04): compatibility window closed; `ai:hub` legacy alias removed from `package.json`.

### Project Resolution Contract (single source of truth)
- Use one resolver module across all entry points with fixed precedence:
  `--project-path` > `AI_HUB_PROJECT_PATH` > `config/hub-config.json:activeProjectPath` > `config/projects.json:lastUsed`.
- Dispatcher must pass resolved `--project-path` explicitly to child commands.
- If no project can be resolved, fail with actionable help (`ai:start`, `ai:list`, `ai:add -- --path=...`).

### Implementation Steps (historical rollout, completed)
1. **Phase 1 — Dispatcher introduction (compat mode)**
   - Add command router in `hub.js` using `child_process.spawn()/spawnSync()` with `stdio: "inherit"`.
   - Keep legacy direct script entry points working; print deprecation warnings.
   - Ensure child exit code/signal passthrough is preserved.
2. **Phase 2 — Strict opt-in**
   - Introduce strict flag/env (`--strict` or `AI_HUB_STRICT=1`).
   - In strict mode, project-scoped scripts fail fast if launched directly without dispatcher-resolved `--project-path`.
3. **Phase 3 — Strict by default**
   - Migrate `package.json` scripts so project-scoped commands route through `hub.js`.
   - Migrate hub management commands from `ai:hub -- <cmd>` to flat `ai:<cmd>` surface.
   - Keep temporary compatibility window for legacy invocation with warnings.
4. **Phase 4 — Cleanup**
   - Remove legacy local-mode code paths after migration window.
   - Update docs/protocols to hub-only execution model.

### Review Comments (2026-03-04, Claude Opus 4.6)

**1. `require()` вместо `spawn()` для dispatcher.**
Все скрипты — Node.js. `child_process.spawn()` добавляет overhead и edge cases (signal forwarding, stream piping, exit code propagation), которые потом нужно тестировать. Проще: `require()` + вызов exported функции. Spawn оправдан только при необходимости изоляции процесса — здесь её нет. Рекомендация: dispatcher через `require()`, spawn только как fallback для внешних (не-Node) команд.

**2. Убрать Phase 2 (strict opt-in).**
Отдельный `--strict` / `AI_HUB_STRICT=1` — лишняя конфигурация, которую никто не включит добровольно. Достаточно 3 фаз:
- Phase 1: dispatcher + deprecation warnings (compat mode)
- Phase 2: strict by default + legacy alias window
- Phase 3: cleanup

**3. Начать с 2–3 команд, не с 10+.**
MVP dispatcher: только `ai` (main run) и `ai:light`. Остальные подключать итеративно. Scope creep risk высокий при попытке охватить все 10 project-scoped команд сразу.

**4. Описать миграцию `package.json`.**
Сейчас `npm run ai` → `node ai/scripts/generate-context.js`. В strict mode → `node ai/scripts/hub.js run`. Это breaking change для всех проектов. План упоминает это в Phase 3, но не описывает конкретный механизм (compat shim в generate-context.js? auto-migration? документация?). Нужен explicit migration path.

**5. Приоритет: поднять выше Jira Integration.**
Strict Dispatcher — prerequisite для jira-take, watch mode, и любой будущей фичи, которая должна идти через единую точку входа. Jira Integration без dispatcher будет дублировать project resolution логику. Рекомендация: Strict Dispatcher → Jira Integration, не наоборот.

### Codex Position (2026-03-03)

**1) Dispatcher transport (`require()` vs `spawn`)**
- Итог: **гибридный подход**.
- Краткосрочно: `spawn/spawnSync` safer-by-default для текущих entrypoint-скриптов (меньше риска из-за `process.argv`/`process.cwd`/`process.exit` side effects).
- Среднесрочно: перевод скриптов на `main(args, env, cwd)` и постепенный переход dispatcher на direct `require()` call.

**2) Strict opt-in phase**
- Итог: **не публичный, но сохранить rollback-клапан**.
- Пользовательский интерфейс можно упростить до 3 фаз, но оставить внутренний emergency override на короткий период после strict-by-default.

**3) MVP scope**
- Итог: **согласовано**.
- Начинать с `ai` и `ai:light`, затем подключать остальные команды итеративно по мере прохождения integration coverage.

**4) Migration path**
- Итог: **обязательно**.
- Нужен явный migration mechanism: compat aliases в `package.json`, deprecation warnings, дата/критерий удаления legacy paths.

**5) Priority order**
- Итог: **согласовано**.
- Очередность: Strict Dispatcher baseline -> Jira Integration -> Jira automation extensions.

### Consensus (2026-03-04, Claude Opus 4.6)

Разногласий нет. Ниже — конкретизация по пунктам 2 и 4, где Codex согласился но не описал механизм.
Note (2026-03-04 final cleanup): rollback valve section below is historical context; bypass env contract has been removed from active implementation.

**Пункт 2: Rollback Valve — конкретная реализация**

Внутренний env `_AI_DISPATCHER_BYPASS=1` (underscore prefix = не публичный контракт).

Механизм:
1. В начале каждого project-scoped скрипта (`generate-context.js`, etc.) добавить guard:
   ```javascript
   if (!process.env._AI_DISPATCHER_RESOLVED && !process.env._AI_DISPATCHER_BYPASS) {
     console.error('⚠️  Direct script invocation is deprecated. Use: npm run ai -- ...');
     console.error('    Emergency bypass: _AI_DISPATCHER_BYPASS=1 npm run ai:legacy ...');
     process.exit(1);
   }
   ```
2. Dispatcher (`hub.js`) при вызове скрипта устанавливает `_AI_DISPATCHER_RESOLVED=1` в env дочернего процесса.
3. `_AI_DISPATCHER_BYPASS` позволяет обойти guard без dispatcher — только для экстренных случаев.

TTL:
- Valve активен 2 недели после перехода на strict-by-default.
- После TTL — guard упрощается до hard fail без bypass, env удаляется.
- Критерий удаления: 0 использований bypass в логах за 2 недели (трекать через `console.warn` при каждом bypass использовании).

Тесты:
- `_AI_DISPATCHER_RESOLVED=1` → скрипт работает нормально.
- Без env → exit(1) с actionable error message.
- `_AI_DISPATCHER_BYPASS=1` → работает + печатает warning в stderr.
- После TTL: bypass перестаёт работать.

**Пункт 4: Migration Path — конкретная реализация**

Три слоя миграции:

**Слой 1: `package.json` compat aliases (Phase 1 — compat mode)**
```json
{
  "scripts": {
    "ai": "node ai/scripts/hub.js run",
    "ai:light": "node ai/scripts/hub.js run --light",
    "ai:legacy": "node ai/scripts/generate-context.js",
    "ai:legacy:light": "node ai/scripts/generate-context.js --light"
  }
}
```
- `npm run ai` → dispatcher (новый путь).
- `npm run ai:legacy` → прямой вызов (старый путь, с deprecation warning из guard).
- Legacy aliases существуют только на время migration window.

**Слой 2: Compat shim в `generate-context.js` (Phase 1)**
При прямом вызове без `_AI_DISPATCHER_RESOLVED`:
```javascript
// Top of generate-context.js main()
if (!process.env._AI_DISPATCHER_RESOLVED) {
  console.warn('⚠️  DEPRECATED: Direct invocation of generate-context.js.');
  console.warn('   Use: npm run ai -- --prompt="..."');
  console.warn('   This will stop working after <DATE>.');
  // Continue execution (compat mode — don't block yet)
}
```
Phase 2 (strict-by-default) меняет warn на exit(1) + bypass valve.

**Слой 3: Документация и timeline**
- В README и AI_WORKFLOW: секция "Migration to Hub Dispatcher" с before/after примерами.
- Конкретные даты:
  - Phase 1 launch: deprecation warnings начинают печататься.
  - Phase 1 + 4 недели: strict-by-default (warnings → errors).
  - Phase 1 + 6 недель: bypass valve удаляется, legacy aliases удаляются из package.json.
- Критерий перехода Phase 1→2: все project-scoped команды проходят dispatcher integration tests + 0 bug reports за 1 неделю compat mode.

### Required Test Coverage
- Dispatcher integration tests for each project-scoped command.
- Precedence tests for project resolution contract (all 4 levels).
- Non-interactive/CI tests (no TTY), including missing/invalid active project.
- Parity tests: legacy direct invocation vs dispatcher invocation (same behavior/exit code during compatibility window).

### Implementation Status (2026-03-04)
- [x] Dispatcher baseline in `hub.js`: `run --mode=default|light|index|pack|memory|init|clean|arch-check`.
- [x] Flat CLI surface for hub commands in `package.json`: `ai:add`, `ai:list`, `ai:start`, `ai:status`, `ai:doctor`, `ai:migrate`, `ai:stats`, `ai:gc`.
- [x] `ai`, `ai:light`, `ai:index`, `ai:pack`, `ai:memory`, `ai:init`, `ai:clean`, `ai:arch:check` routed through dispatcher.
- [x] Legacy alias removed: `ai:hub` wrapper deleted from `package.json`, `hub.js` no longer supports `legacy` command mode.
- [x] Strict direct-invocation guard enabled for project-scoped scripts (hard-fail without bypass).
- [x] Bypass valve removed from dispatcher guard (`_AI_DISPATCHER_BYPASS` / `AI_DISPATCHER_STRICT_SINCE` no longer supported).
- [x] Dispatcher run-mode integration coverage extended for `memory`, `init`, `clean`, `arch-check` (passthrough args and project scoping).
- [x] Project-resolution precedence coverage in `hub run` closed for all 4 levels: explicit `--project-path` > `AI_HUB_PROJECT_PATH` > `hub-config activeProjectPath` > `projects.json:lastUsed`.
- [x] `require()` transport enabled in `hub run` for project-safe Node modes (`memory`, `init`, `clean`, `arch-check`) with in-process `process.exit` capture and exit-code parity.
- [x] Unified `main(options)` contract adopted for require-transport modes (`memory`, `clean`, `arch-check`) using `{ argv, env, projectPath, hubRoot }` with backward-compatible legacy signatures.
- [x] `init-project` migrated to runtime-parsed `main(options)` contract (no module-load `argv/cwd` globals), enabling require-transport parity with CLI entrypoint behavior.
- [x] Claude r6 minor consistency follow-ups closed: shared `normalizeScriptMainInput` helper extracted and reused by `memory`/`architecture-check`/`cleanup` (including `projectRoot` alias mapping in cleanup).
- [x] `cleanup.js` now resolves archive dir via project AI layout detection (`.ai/` first, `ai/` fallback).
- [x] `generate-context.js` entrypoint normalized for require-readiness: explicit `if (require.main === module)` run path + exported `main`, bootstrap side effects gated to entrypoint mode.
- [x] `generate-context.js` non-entrypoint bootstrap now lazy: no hub-config auto-resolution I/O, no `.ai.env` load, no context validation exits on `require()`.
- [x] Final cleanup after TTL complete: bypass valve/env contract removed.

### Acceptance Criteria
- All project-scoped commands execute only against the resolved target project (no implicit `process.cwd()` dependence in strict mode).
- Dispatcher preserves stdout/stderr stream behavior and child exit codes.
- CI/non-interactive behavior is deterministic and does not require prompts.
- Migration completed; compatibility window closed and direct invocation is hard-fail with actionable dispatcher hint.
- Final CLI is flat (no mandatory user-facing `ai:hub` prefix).

---

## 🤖 Planned Feature: Stack-Aware Dynamic Skills (Project-Scoped Agents)

**Concept:**
On `ai:init`, auto-detect the project's tech stack and generate role-based skill/agent profiles tailored to that stack. Each target project gets its own set of specialized agents (developer, tester, reviewer, architect, task planner) with stack-specific expertise baked in.

### Why
- Generic "write code" prompts waste tokens on discovering what the project uses
- Stack-specific agents produce better first-pass results (correct patterns, frameworks, test tools)
- Role separation (dev vs tester vs reviewer) enforces different perspectives on the same code
- Skills are project-scoped — each project gets exactly what it needs

### How It Works

```
ai:init --path=/home/user/my-app
  │
  ├─ detectProjectType() → { python, fastapi, postgres, docker, pytest }
  │                         (already implemented in init-project.js)
  │
  ├─ generateProjectSkills(detectedStack)
  │     │
  │     ├─ Load base role templates (stack-agnostic structure)
  │     ├─ Fill stack-specific sections from expertise dictionary
  │     ├─ (Optional) LLM reads README/config for project-specific nuances
  │     │
  │     └─ Write to .ai/commands/
  │           ├─ dev.md
  │           ├─ test.md
  │           ├─ review.md
  │           ├─ architect.md
  │           └─ task.md
  │
  └─ Update .ai/context.json → { generatedSkills: ["dev","test","review","architect","task"] }
```

### Roles

| Role | Responsibility | Example (Python + FastAPI + Postgres) |
|------|---------------|---------------------------------------|
| `/dev` | Implementation patterns | async def, Pydantic models, dependency injection, SQLAlchemy ORM |
| `/test` | Test framework + practices | pytest, httpx.AsyncClient, factory_boy, testcontainers-postgres |
| `/review` | Code review checklist | type hints, N+1 queries, missing migrations, security headers |
| `/architect` | Architecture patterns | Repository pattern, CQRS, connection pooling, async task queues |
| `/task` | Task decomposition | Endpoint → schema → service → repository → migration → test → docs |

### Skill Generation Approach: Hybrid (template + dictionary)

| Layer | Source | Cost |
|-------|--------|------|
| Base template | 5 role templates (structure, response format, principles) | 0 tokens, static files |
| Stack expertise | Dictionary lookup: `{ "fastapi": { dev: "...", test: "..." } }` | 0 tokens, JSON |
| Project specifics | (Optional) LLM reads README/pyproject.toml/package.json | ~500-1000 tokens |

No combinatorial explosion: base templates are stack-agnostic, stack sections are additive (multiple stacks = concatenated expertise blocks).

### Storage & Injection

**For interactive Claude Code sessions:**
- Generate `.claude/commands/` in target project (native slash command path)
- Immediately available as `/dev`, `/test`, etc.

**For pipeline agents:**
- Source of truth: `.ai/commands/` (gitignored, hub-controlled)
- Injected into agent system prompt during context assembly:
  ```js
  const skills = loadProjectSkills(projectPath);
  const agentPrompt = baseSystemPrompt + '\n\n' + skills.forRole(agent.role);
  ```

### Example Generated Skill (dev.md for Python+FastAPI+Postgres)

```markdown
You are a senior Python developer specializing in this project's stack.

## Stack Expertise
- **Framework:** FastAPI (async, dependency injection, Pydantic v2)
- **ORM:** SQLAlchemy 2.0 (async sessions, mapped_column)
- **Database:** PostgreSQL (migrations via Alembic)
- **Testing:** pytest + httpx.AsyncClient
- **Package manager:** poetry

## Patterns to Follow
- Use `async def` for all endpoints
- Pydantic models for request/response schemas
- Repository pattern for DB access
- Dependency injection via `Depends()`
- Type hints on all function signatures

## Anti-patterns to Avoid
- Synchronous DB calls in async endpoints
- Business logic in route handlers (extract to services)
- Raw SQL without parameterized queries
- Missing Alembic migration for schema changes

{user question}
```

### Stack Expertise Dictionary Structure

```json
{
  "python": {
    "dev": "Type hints, virtual environments, async/await...",
    "test": "pytest, fixtures, parametrize, mock...",
    "review": "PEP 8, type coverage, import ordering..."
  },
  "fastapi": {
    "dev": "Depends(), Pydantic v2, async endpoints...",
    "test": "httpx.AsyncClient, TestClient, override_dependency...",
    "review": "Missing response_model, sync in async, N+1..."
  },
  "postgres": {
    "dev": "SQLAlchemy 2.0, Alembic migrations, connection pooling...",
    "test": "testcontainers, transaction rollback fixtures...",
    "review": "Missing indexes, N+1 queries, unparameterized SQL..."
  },
  "nextjs": { ... },
  "react": { ... },
  "node": { ... }
}
```

### Implementation Plan

1. **Phase 1: Templates + Dictionary**
   - 5 base role templates (`ai/skill-templates/{role}.md`)
   - Stack expertise dictionary (`ai/skill-templates/stacks.json`)
   - `generateProjectSkills(stack)` function in `init-project.js`
   - Write to `.ai/commands/` on init
   - Tests: generated skill content matches stack, all roles present

2. **Phase 2: Pipeline Integration**
   - `loadProjectSkills(projectPath)` in generate-context.js
   - Inject role-specific expertise into agent system prompts
   - Map agent roles (from `agents.json`) to skill files
   - Tests: agent prompt includes correct stack expertise

3. **Phase 3: Interactive Session Support**
   - Copy/symlink `.ai/commands/` → `.claude/commands/` in target project
   - `ai:init` offers to set up Claude Code commands
   - `ai:skills refresh` — regenerate after stack changes

4. **Phase 4: LLM Enhancement (optional)**
   - On init, LLM reads project README/configs
   - Appends project-specific conventions to generated skills
   - Cached — only regenerated on explicit `ai:skills refresh`

### Risks & Mitigations

- **Risk:** Generated skills become stale as project evolves.
  - **Mitigation:** `ai:skills refresh` command; optional auto-refresh on `ai:init --force`.
- **Risk:** Too many skills overwhelm the user.
  - **Mitigation:** Start with 5 core roles; additional roles opt-in via config.
- **Risk:** Stack detection misses frameworks (e.g., FastAPI not detected).
  - **Mitigation:** `detectProjectType` already handles this; add manual override in `.ai/context.json`.
- **Risk:** Skill content too generic to be useful.
  - **Mitigation:** Phase 4 LLM enhancement adds project-specific detail; dictionary entries should be opinionated and concrete.

### Discussion Log (2026-03-05)

**Claude Opus 4.6 position:**
- Hybrid approach (template + dictionary) preferred over pure LLM generation — predictable, zero-cost, stable
- Store in both `.ai/commands/` (pipeline) and `.claude/commands/` (interactive)
- 5 roles sufficient for MVP: dev, test, review, architect, task
- Stack dictionary should be opinionated (concrete tools/patterns), not generic advice

**Codex (GPT-5) detailed position (expanded):**

1. **Main concerns / doubts**
   - Scope creep risk is high if we try to deeply support many stacks and roles in one iteration.
   - Generated content drift is inevitable as projects evolve unless refresh policy is explicit and testable.
   - Dual storage (`.ai/commands` + `.claude/commands`) can diverge unless one source is canonical.
   - Stack detection quality will degrade on monorepos and mixed stacks without confidence/evidence output.
   - Prompt/token bloat is likely if role templates are verbose and stack blocks are blindly concatenated.

2. **Implementation constraints (must-have)**
   - Canonical source of truth: generated profiles live under `.ai/` only; interactive command folders are adapters/sync targets.
   - Deterministic generation by default (template + dictionary), no mandatory LLM synthesis on init.
   - Explicit profile artifact (for example `.ai/stack-profile.json`) with:
     - detected stacks
     - confidence
     - evidence (which files/signals triggered detection)
     - generated version/fingerprint
   - Merge chain must be stable and auditable:
     - base template -> stack snippets -> project override
   - Regeneration must be idempotent and safe for manual customizations.

3. **MVP boundary (recommended)**
   - Start with 3 stack domains:
     - `python+fastapi`
     - `js+next`
     - `postgres`
   - Start with 5 roles:
     - `developer`, `tester`, `reviewer`, `architect`, `task-planner`
   - Provide explicit manual override hook in project config/profile.
   - Add `ai:skills refresh` before any auto-refresh strategy.

4. **Non-goals for MVP**
   - No freeform per-project LLM prompt generation by default.
   - No automatic deep framework inference from arbitrary code semantics.
   - No dynamic role explosion beyond the 5 core roles.

5. **Acceptance criteria (Codex proposal)**
   - Generated output is deterministic for the same inputs.
   - Refresh is idempotent and does not overwrite manual overrides unexpectedly.
   - Stack detection output includes confidence + evidence.
   - Pipeline prompt injection uses generated role profile deterministically.
   - Full hub regression gate remains green after integration.

6. **Open questions before implementation**
   - Should `.claude/commands` sync be automatic or opt-in command?

### Consensus Draft (Claude + Codex, 2026-03-05)

**Agreed for MVP (Phase 1):**
- Deterministic generation only: `base templates + stack dictionary + project override`.
- No required LLM synthesis on `ai:init` (optional enrichment stays out of MVP).
- 5 fixed roles for MVP: `developer`, `tester`, `reviewer`, `architect`, `task-planner`.
- Initial stack coverage limited to:
  - `python+fastapi`
  - `js+next`
  - `postgres`
- Add refresh command before automation:
  - `ai:skills refresh`

**Canonical architecture decisions:**
- Source of truth is project `.ai/` generated artifacts.
- Interactive command folders (for example `.claude/commands`) are sync targets/adapters, not canonical config.
- Stack profile artifact is required and includes:
  - detected stack tags
  - confidence
  - evidence
  - generation fingerprint/version

**Out of scope for MVP:**
- Automatic deep semantic framework inference.
- Dynamic role expansion beyond 5 core roles.
- Always-on auto-refresh and auto-sync policy.

**Go/No-Go gates for implementation start:**
- Remaining open questions resolved (currently only sync mode decision pending).
- Acceptance criteria frozen in roadmap (determinism, idempotent refresh, regression gate green).
- Test plan defined before coding (unit + integration + full `ai:test` gate).

### Clarifications Locked (2026-03-05)

1. **Canonical artifact path (MVP):**
   - Canonical generated role profiles live in `.ai/commands/`.
   - `.claude/commands/` (or similar interactive folders) is adapter/sync target only.
   - No parallel canonical path (`.ai/skills/`) in MVP to avoid source drift.

2. **Override schema (MVP):**
   - Single override file: `.ai/commands/overrides.json`.
   - Structure is per-role inside one file (for deterministic merge and atomic updates), e.g.:
     - `{ "developer": "...", "tester": "...", "reviewer": "...", "architect": "...", "task-planner": "..." }`
   - Merge order remains:
     - base template -> stack snippets -> overrides.json[role]

3. **Confidence threshold (MVP):**
   - Use stack-specific generation only when `confidence >= 0.70`.
   - If `confidence < 0.70`, fallback to base templates and emit actionable warning with evidence summary.
   - Profile artifact stores exact score and trigger evidence for audit/debug.

4. **Knowledge model for generated stack skills (MVP):**
   - Use layered structure instead of flat prompts:
     - `Stack Knowledge Matrix` (technology-specific operational knowledge)
     - `Senior Expectations Layer` (level-based expectations and quality bar)
     - `Role Overlay` (developer/tester/reviewer/architect/task-planner perspective)
   - `Stack Knowledge Matrix` must include concrete framework/ORM/data-access knowledge for detected stack components.
     - Example for `.NET` domain: `asp.net`, `efcore`, `dapper`, `ado.net` each with patterns, anti-patterns, test guidance, perf/security checks.
     - Note: `.NET` example is illustrative for matrix format and is not part of MVP implementation scope.
   - `Senior Expectations Layer` in MVP targets one level only: `senior`.
     - Multi-level specialization (`junior`/`mid`) is post-MVP.
   - Keep two depth levels to control token budget:
     - `must-have` (always injected, short)
     - `extended` (references loaded on demand)
   - Goal is actionable depth per stack and role, not encyclopedic coverage.

5. **Role list decision (MVP):**
   - Role set is fixed for MVP: `developer`, `tester`, `reviewer`, `architect`, `task-planner`.
   - Dynamic role derivation from `agents.json` is post-MVP.

**Status:** Design consensus draft recorded. No implementation yet.

---

## 📋 Future (Non-urgent)

### Architecture & Infrastructure
- [x] **Hub-only Architecture (Strict Dispatcher)** — `hub.js` as sole entry point, strict `--project-path` resolution *(done 2026-03-04)*
- [ ] **Jira Integration + Auto-Branch/PR** — `jira-list`, `jira-take`, ticket→prompt, auto-commit/PR/status-update
- [ ] Hybrid Orchestration Mode (local + team shared deployment)
- [ ] Model Gateway with per-model budgets/rate limits
- [ ] Shared vector DB with project/thread namespaces
- [ ] Unified audit/event schema for logs
- [ ] `ai/context.json` JSON schema validation
- [ ] Lockfile for concurrent same-project access
- [ ] TUI interface (blessed/ink)
- [ ] Plugin registry for providers, roles, and capabilities

### Performance & Optimization
- [ ] Speculative parallel execution with early-cancel
- [ ] Impact-based test selection for changed file graph

### Quality & Reasoning
- [ ] Structured JSON schema contracts for planner/reviewer/synthesizer outputs
- [ ] Evidence-first RAG packet builder with citation binding
- [ ] Two-pass cloud reasoning (draft → verifier → final)
- [ ] Uncertainty/clarification gate for ambiguous tasks
- [ ] Hallucination guardrails for high-risk domains
- [ ] Self-consistency voting for hard tasks

### Observability & Metrics
- [ ] Visual dashboard for agent metrics
- [ ] Observability metrics and routing auto-tuning loop
- [ ] Golden evaluation set and weekly regression runner
- [ ] Cloud-answer quality telemetry (error rate, contradiction, re-ask)
- [ ] Adaptive SLA router (complexity/risk/budget aware)

### Removed (already covered or unnecessary)
- ~~Per-project `.ai-hub.yaml`~~ — covered by `config/projects.json` + `.ai/context.json`
- ~~SQLite for registry~~ — `config/projects.json` with atomic writes is sufficient for the scale
- ~~Two-level caching~~ — result cache covered by Task 6; prompt cache is provider-side (API-level)
- ~~Strict response contracts~~ — covered by Task 2 (Response Validation Pipeline)
- ~~Dynamic quality-based model routing~~ — duplicate of Adaptive SLA router
- ~~Unified tool gateway reliability~~ — retries/rate-limiting already implemented (`getRetrySettings`, `applyAgentRateLimit`)
- ~~Incremental code indexing~~ — already implemented (`buildCodeIndex` with `previousIndex` hash-based skip)
