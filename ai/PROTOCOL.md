# AI Interaction Protocol (The "Constitution")

Rules for AI agents running the multi-agent pipeline on target projects.

## 1. Shared Memory (The Logs)

Use **one primary log stream per event** to avoid duplicate summaries.

**Files:**
- `.ai/logs/AI_LOG.md` (primary timeline)
- `.ai/logs/AI_PLAN_LOG.md`
- `.ai/logs/AI_PROPOSAL_LOG.md`
- `.ai/logs/AI_DISCUSSION_LOG.md`
- `.ai/logs/AI_CHANGE_LOG.md`
- `.ai/logs/AI_ERROR_LOG.md`

**Scope:** Agent pipeline execution against a target project (proposals, critiques, consensus, approvals).

### Rules (ZERO EXCEPTIONS):
1. **Read First:** Before starting a task, read recent entries from the logs to understand context/history.
2. **Write Last:** You **MUST** append structured entries to the relevant log.
3. **Missing Log = Task Failed:** If no relevant log entry is written, task is incomplete.
4. **No Duplication:** Do not copy full summaries to multiple logs; secondary logs should contain `Ref: <task_id>`.
5. **Token Economy:** Keep outputs compact, avoid repeating the prompt/context, and prefer narrow line-range file reads over whole large files whenever possible.
5. **No Approval:** Logging entries do NOT require user approval.

### Mandatory Metadata (all log entries):
- `timestamp_utc`
- `author_model`
- `task_id` (issue/run/manual id)
- `task_summary`

### Entry Format:
```markdown
## [YYYY-MM-DD HH:mm:ss UTC] - Agent/Model: [Name]
Project: [Project]
Task ID: [ABC-123 | run-... | <promptHash>]
Task Summary: [what task this entry belongs to]
Phase/Action: [plan|proposal|discussion|change|runtime]
Artifacts: [file paths]
Summary: [What was discussed/proposed/changed]
Status: [IN_PROGRESS|DONE|FAILED]
```

## 2. Coding Process (The Cycle)
1.  **Understand:** Read `ai/llms.md` (Architecture) and `ai/PATTERNS.md` (Code Style).
2.  **Plan:** State your plan briefly.
3.  **Act:** Make atomic changes. Use `npm run ai` for complex architectural decisions if unsure.
4.  **Test-by-Default:** For each feature/fix, add/update tests in the affected project (unit/integration/regression as applicable).
5.  **Verify:** Run relevant test commands when feasible (`npm test`, `npm run test:*`, `./scripts/verify.sh`, etc.). If not feasible, explicitly report why.

## 3. Safety & Secrets
- **Never** output API keys or secrets in logs or comments.
- **Redact** sensitive info if quoting files.
- **Do not** introduce new external dependencies without explicit user permission.

---

## 4. Multi-Agent Discussion (Critique Phase)

When working in Critique/Consensus mode, you **MUST** reference proposals from other agents.

### Reference Format:
```markdown
### Peer Proposal Analysis
| Agent | File:Line | Verdict | Comment |
|-------|-----------|---------|---------|
| claude | 2026-01-23T10-00-00-000Z-claude-proposal.txt:15 | ✅ Agree | Good approach |
| gemini | 2026-01-23T10-00-00-000Z-gemini-proposal.txt:42 | ❌ Disagree | Over-complicates the architecture |
```

### Rules:
1. **Read peer proposals** — they will appear in `=== PROPOSAL FROM {agent} ===` blocks
2. **Reference specific lines** — not "I generally agree", but "line 15: I agree because..."
3. **Justify your stance** — both agreement and disagreement must be reasoned

---

## 5. End of Document Marker

Every file you create **MUST** end with the marker:

```
=== END OF DOCUMENT ===
```

### Why this matters:
- Provider APIs may truncate responses due to token limits
- The marker allows the script to verify response completeness
- If the marker is missing — the script will print a warning

### Applies to:
- Proposals (`.ai/prompts/runs/*-proposal.txt`)
- Critiques (`.ai/prompts/runs/*-critique.txt`)
- Consensus (`.ai/prompts/runs/*-consensus.txt`)
- Log entries (`.ai/logs/*.md`)

---

## 6. Files Writable Without Approval

| File | Action |
|------|--------|
| `.ai/logs/AI_LOG.md` | Append |
| `.ai/logs/AI_PLAN_LOG.md` | Append |
| `.ai/logs/AI_PROPOSAL_LOG.md` | Append |
| `.ai/logs/AI_DISCUSSION_LOG.md` | Append |
| `.ai/logs/AI_CHANGE_LOG.md` | Append |
| `.ai/logs/AI_ERROR_LOG.md` | Append |

**Important:** These are the ONLY files you may modify without explicit user request. All other changes require approval.
