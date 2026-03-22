# Hub Development Rules

Rules for AI models/agents working on hub code, tests, config, and documentation.

## 1. Mandatory Verification

1. After any code or config change in the hub repository, run:
   - `npm run undes:test`
2. For behavior changes, include matching tests in the same change-set whenever feasible.
3. A task is not complete until this test suite passes.
4. In the final report, include the test result summary (`passed/failed` and test count).

## 2. Hub Change Scope

Treat the following as "hub changes" that require the verification step:
- `ai/scripts/**`
- `ai/context.json`
- `ai/agents.json`
- `ai/specs/**`
- `package.json`
- `README.md`
- `AI_WORKFLOW.md`
- `ai/ROADMAP.md`

If only log files are changed, test run is optional.

## 3. Logging (Stream A — Hub Change Tracking)

Use one primary log stream per event to avoid duplicates.

**Files:**
- `UNIFIED_MODEL_CHANGE_LOG.md` (primary)
- `PROJECT_PLANNED_CHANGES.md` (planning/status)

**Scope:** Any change to hub source code, scripts, architecture, tests, documentation, ROADMAP.

**NEVER write hub engineering changes to `.ai/logs/`.** Those logs are exclusively for agent pipeline runs on target projects.

### Mandatory Metadata (all log entries):
- `timestamp_utc` (exact UTC timestamp)
- `author_model` (who made the change)
- `task_id` (ticket/issue/run id; use `manual-...` if no tracker id)
- `task_summary` (what task the change belongs to)

### No-Duplicate Rule:
- Do not copy the same full summary into multiple logs.
- Secondary logs should reference the primary entry (`Ref: <task_id>`).

### Entry Format:
```markdown
## [YYYY-MM-DD HH:mm:ss UTC] - Agent/Model: [Name]
Project: [Project]
Task ID: [ABC-123 | run-... | manual-...]
Task Summary: [what task this entry belongs to]
Phase/Action: [plan|proposal|discussion|change]
Artifacts: [file paths]
Summary: [What was discussed/proposed/changed]
Status: [IN_PROGRESS|DONE|FAILED]
```

## 4. Files Writable Without Approval

| File | Action |
|------|--------|
| `UNIFIED_MODEL_CHANGE_LOG.md` | Append |
| `PROJECT_PLANNED_CHANGES.md` | Append |

**Important:** These are the ONLY files you may modify without explicit user request. All other changes require approval.

## 5. Safety & Secrets
- **Never** output API keys or secrets in logs or comments.
- **Redact** sensitive info if quoting files.
- **Do not** introduce new external dependencies without explicit user permission.

## 6. OSS Core / Commercial Boundary

This repository is the OSS core only.

- Do not add paid add-on implementations to this repository.
- Do not add customer-specific workflow logic to this repository.
- Do not add hosted control-plane code for commercial offerings to this repository.
- Near-term commercial integration work such as `GitLab` must live in a separate private repo or package.
- `Jira` commercial automation must live outside this repository.
- `OpenClaw` integration, if pursued later, must also live outside this repository.
- In this repo, only merge generic public extension points, public docs, and OSS-safe interfaces.
- If a change has value only together with private code, do not commit it here.
