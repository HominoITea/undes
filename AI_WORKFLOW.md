# AI Multi-Agent System - Complete Guide

This document provides complete instructions for setting up and using the multi-agent AI system for the your project.

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Installation & Setup](#installation--setup)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Advanced Features](#advanced-features)
6. [Troubleshooting](#troubleshooting)
7. [Architecture](#architecture)

---

## Quick Start

```bash
# 1. Set up API keys
cp .ai.env.example .ai.env
# Edit .ai.env and add your API keys
# Optional: configure provider execution/rate-limit/token settings in `.ai.env`
# using `AI_CFG__...` keys from `.ai.env.example`

# 2. Run with a question
npm run ai -- --prompt="How do I add a 'Like' button to the canvas?"

# Optional: bootstrap project AI config
npm run ai:init

# Optional: enable Prompt Engineer (pre-process)
npm run ai -- --prompt="Refactor the board toolbar" --prepost

# Optional: enable Tester (post-process validation)
npm run ai -- --prompt="Add export to PNG" --test

# 3. Check the result
cat .ai/prompts/result.txt
```

## Runtime Overrides

During a live run, temporary operator overrides can be placed in:

- `.ai/prompts/run/runtime-overrides.json`

Template:

- `ai/templates/runtime-overrides.example.json`

Live-safe keys:

- `agents.<name>.maxOutputTokens`
- `pauseBeforePhases.<phase>`

Tester phase aliases accepted in `pauseBeforePhases`:

- `test`
- `tests`
- `tester`

All three normalize to the internal phase name `post-process`.

Restart-required keys are intentionally ignored mid-run with a warning, including:

- `contextBudget`
- `contextMode`
- `maxFiles`
- `packedTreeLimit`

Reason:

- these change the actual provider input shape or checkpoint contract;
- live-safe overrides are intentionally limited to output budget and phase pause behavior.

### Hub Mode (Multiple Projects)

When this repository is used as a shared hub for several projects:

```bash
# Add projects once
npm run ai:add -- --path=/abs/path/to/project-a
npm run ai:add -- --path=/abs/path/to/project-b

# Select active project (writes config/hub-config.json -> activeProjectPath)
npm run ai:start

# Run against selected project without extra flags
npm run ai -- --prompt="Implement task"
```

Switch any time with `npm run ai:start` (or `npm run ai:start -- --select=N`).
For one-off runs, use `--project-path=/abs/path`.
Direct script runs are blocked in strict dispatcher mode (`node ai/scripts/...`); use npm scripts.
Detailed multi-project instructions are in `README.md` (`Workspace Hub Mode` section).

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- API keys for at least one provider (Anthropic, OpenAI, or Google)

### Step 1: Clone and Install
```bash
git clone <repository>
cd front
npm install
```

### Step 2: Configure API Keys
```bash
# Create the environment file from template
cp .ai.env.example .ai.env
```

Edit `.ai.env` and add your API keys:
```env
# AI API keys (do not commit real secrets)
CLAUDE_API_KEY=sk-ant-api03-xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
OPENAI_API_KEY=sk-proj-xxxxx
```

For provider rate limits/retries/token budgets, use `AI_CFG__...` keys from `.ai.env.example`
(detailed reference is in `README.md`).
You can also disable provider/agent without code edits (for example `AI_CFG__PROVIDER__GOOGLE__ENABLED=0`).
Ready presets are available in `examples/env-presets/` (`economy`, `balanced`, `max-quality`).

### Step 3: Verify Configuration
```bash
# Test that the script runs
npm run ai -- --help
```

---

## Layered Structure

Internal script architecture is split into layers:
- `application`: CLI orchestration and phase pipelines
- `domain`: pure logic (scoring/parsing/formatting)
- `infrastructure`: adapters for FS/provider/process

Reference map: `ai/ARCHITECTURE_LAYERS.md`.

---

## Configuration

### Agent Configuration (`ai/agents.json`)

```json
{
  "agents": [
    {
      "name": "prompt-engineer",
      "apiUrl": "https://api.anthropic.com/v1/messages",
      "model": "claude-sonnet-4-6",
      "key": "CLAUDE_API_KEY",
      "role": "Senior Prompt Engineer",
      "phase": "pre-process",
      "description": "Understands nuances, clarifies ambiguities, enhances prompts"
    },
    {
      "name": "architect",
      "apiUrl": "https://api.anthropic.com/v1/messages",
      "model": "claude-sonnet-4-6",
      "key": "CLAUDE_API_KEY",
      "role": "Architect",
      "description": "System design, trade-off analysis, big-picture thinking"
    },
    {
      "name": "reviewer",
      "apiUrl": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent",
      "model": "gemini-3.1-pro-preview",
      "key": "GEMINI_API_KEY",
      "role": "Reviewer",
      "description": "Critical analysis, finds problems and inconsistencies"
    },
    {
      "name": "developer",
      "apiUrl": "https://api.openai.com/v1/chat/completions",
      "model": "gpt-5.4",
      "key": "OPENAI_API_KEY",
      "role": "Implementer",
      "description": "Fast code generation, practical implementation"
    },
    {
      "name": "synthesizer",
      "apiUrl": "https://api.anthropic.com/v1/messages",
      "model": "claude-sonnet-4-6",
      "key": "CLAUDE_API_KEY",
      "role": "Consensus Synthesizer",
      "consensus": true,
      "description": "Balances viewpoints, produces nuanced final answer"
    },
    {
      "name": "devils-advocate",
      "apiUrl": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent",
      "model": "gemini-3.1-pro-preview",
      "key": "GEMINI_API_KEY",
      "role": "Devil's Advocate",
      "phase": "devil-advocate",
      "description": "Challenges solutions, finds weaknesses, edge cases, security issues"
    },
    {
      "name": "tester",
      "apiUrl": "https://api.openai.com/v1/chat/completions",
      "model": "gpt-5.4",
      "key": "OPENAI_API_KEY",
      "role": "Senior Tester",
      "phase": "post-process",
      "description": "Creates test cases, validates solutions, finds bugs"
    }
  ]
}
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier (used in logs and output files) |
| `apiUrl` | Yes | API endpoint URL |
| `model` | Yes | Model name for the provider |
| `key` | Yes | Name of environment variable containing the API key |
| `role` | No | Agent's role (Architect, Reviewer, Implementer, etc.) |
| `consensus` | No | If `true`, this agent synthesizes the final answer |
| `phase` | No | `"pre-process"`, `"devil-advocate"`, or `"post-process"` for special roles |
| `description` | No | Human-readable description of the agent's purpose |
| `includeFilesList` | No | If `true`, includes list of files in context |

### Special Phases

**Pre-process (`phase: "pre-process"`):**
- Runs BEFORE the main discussion
- Used for: Prompt Engineer, Requirements Analyst
- Enhances/clarifies the user's original prompt
- Output: Enhanced prompt used by all other agents

**Post-process (`phase: "post-process"`):**
- Runs AFTER consensus is reached
- Used for: Tester, Security Auditor, Documentation Writer
- Validates/reviews the final solution
- Output: Test report, validation results

### Prompt Authoring Tips / Советы По Формулировке Prompt-а

Use listed methods/files as **starting seams**, not as an accidental hard stop,
when you want a root-cause answer.

Recommended phrasing:
- `Start with ApproverFacadeImpl#approveDocument and #moveQueueForward, but trace any upstream/downstream code needed to ground route generation, currentStep/current queue synchronization, finalization, reset/rework, and EDS-path behavior.`
- `If the first seams are insufficient, continue into the minimal related code needed for a patch-safe answer.`

Hard scope should be explicit:
- `Analyze only these methods. Do not read beyond them.`

Why this matters:
- prompt-named seams are strongly prioritized by Context Pack / structural search;
- a narrow prompt can speed up the first pass, but also increase the chance of a
  shallow answer and extra reruns;
- Prompt Engineer (`--prepost`) helps clarify and structure the prompt, but it
  should not silently override an explicit hard scope from the user.

Короткое правило:
- если нужен root-cause разбор, явно разрешай читать связанные
  `upstream/downstream` seam-ы;
- если нужен только локальный hotfix, прямо пиши `анализируй только эти
  методы`.

### Context Configuration (`ai/context.json`)

```json
{
  "limits": {
    "maxFiles": 300,
    "maxFileSize": 30000,
    "maxTotalSize": 250000
  },
  "codeIndex": {
    "enabled": true,
    "outputPath": ".code_index.json",
    "maxDepth": 2,
    "maxPackBytes": 45000,
    "maxGraphEdges": 200,
    "maxSnippets": 40,
    "fallbackToFullContext": true
  },
  "logWindow": {
    "enabled": true,
    "maxEntries": 10,
    "maxBytes": 15000
  },
  "memoryWindow": {
    "maxEntries": 8,
    "maxBytes": 12000,
    "sectionMaxBytes": 4000
  },
  "fullFiles": [
    "ai/llms.md",
    "ai/PROTOCOL.md",
    "ai/PATTERNS.md",
    "ai/KNOWLEDGE_BASE.md",
    "package.json"
  ],
  "lightFiles": [
    "ai/llms.md",
    "ai/PATTERNS.md",
    "package.json"
  ],
  "exclude": "find . -maxdepth 4 -type f -not -path \"./node_modules/*\" -not -path \"./.git/*\" -not -path \"./bin/*\" -not -path \"./obj/*\""
}
```

---

## Usage

### Basic Commands

```bash
# Project bootstrap (active config files)
npm run ai:init

# Full run
npm run ai -- --prompt="Your question here"

# Light run
npm run ai:light -- --prompt="Your question here"

# Rebuild index only
npm run ai:index

# Build context pack only
npm run ai:pack -- --prompt="Your question here"

# Memory snapshot
npm run ai:memory

# Typed memory search
npm run ai:memory:search -- --query="jwt race"

# Manual typed memory save
npm run ai:memory:save -- --type=decision --title="Split-root layout" --content="Keep ai/ authored and .ai/ runtime"
```

For full command and flags reference (including `ai:clean`, `ai:arch:check`, `ai:lang:*`, and all CLI options), use `README.md`.

Testing policy for agents:
- For each behavior change, add/update tests (unit/integration/regression as applicable).
- Run relevant test commands when feasible; if not feasible, report the reason explicitly.

### Output Files

After running, check these files:

| File | Description |
|------|-------------|
| `.ai/prompts/result.txt` | Final consensus answer with trust header (`RESULT_MODE`, `COPYPASTE_READY`) |
| `.ai/prompts/patch-safe-result.md` | Strict apply-ready artifact, written only when the patch-safe gate passes |
| `.ai/prompts/result-warning.txt` | Warning details when the result is not patch-safe and/or consensus is weak |
| `.ai/prompts/devils-advocate-report.md` | Devil's Advocate challenge report |
| `.ai/prompts/test-report.md` | Test validation report (if Tester enabled) |
| `.ai/prompts/runs/` | Completed run artifacts and debate logs per agent |
| `.ai/prompts/discussions/<task-id>/<run-id>/` | Historical prompt/result discussion package for one task run |
| `.ai/prompts/runs/init-*.json` | Init bootstrap metadata and LLM output |
| `.ai/prompts/metrics/latest.json` | Latest run metrics (includes avgConfidence) |
| `.ai/memory/memory.db` | SQLite local memory store for typed recall |
| `.ai/memory/decisions/` | Human-readable decision memory sidecars |
| `.ai/memory/episodes/` | Human-readable episode memory sidecars |
| `.ai/logs/AI_PLAN_LOG.md` | Planned tasks and run lifecycle |
| `.ai/logs/AI_PROPOSAL_LOG.md` | Proposed solutions (by model + time) |
| `.ai/logs/AI_DISCUSSION_LOG.md` | Critiques/reviews/discussions (by model + time) |
| `.ai/logs/AI_CHANGE_LOG.md` | Applied/resulting changes and artifacts (by model + time) |
| `.ai/logs/AI_ERROR_LOG.md` | Runtime/provider errors, retries, and fatal failures |
| `.ai/logs/AI_LOG.md` | Global session log |

Important:
- root files in `.ai/prompts/` (`prompt.txt`, `result.txt`, `devils-advocate-report.md`, `test-report.md`) always represent the latest run only;
- previous runs should be inspected via `.ai/prompts/discussions/<task-id>/<run-id>/` for the human-facing package;
- full raw run artifacts live under `.ai/prompts/runs/`.
- trust the top-of-file header in `result.txt`: `COPYPASTE_READY: YES` means the heuristic patch-safe gate passed for that run; `COPYPASTE_READY: NO` means the answer stays diagnostic/operator-guidance only;
- when present, `.ai/prompts/patch-safe-result.md` is the strict apply-ready surface for that run;
- if `COPYPASTE_READY: NO`, manual review, project-specific validation, and testing are mandatory before using generated code or config;
- `result-warning.txt` is the required companion file for non-patch-safe output and for weak/disputed consensus.

## Advanced Features

### Extended Workflow (with all phases)

Enable with flags:
```bash
npm run ai -- --prompt="Your question" --prepost
npm run ai -- --prompt="Your question" --test
```

```
┌──────────────────────────────────────────────────────────────────┐
│  1. PRE-PROCESS PHASE (Prompt Engineer)                          │
│     - Analyzes user's original prompt                            │
│     - Clarifies ambiguities                                      │
│     - Adds missing context and acceptance criteria               │
│     - Output: Enhanced prompt for the team                       │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. MAIN DISCUSSION (Proposals → Critiques → Consensus)          │
│     - Uses ENHANCED prompt (not original)                        │
│     - Parallel execution for speed                               │
│     - Each agent provides CONFIDENCE SCORE (0-100%)              │
│     - Approval rounds until agreement                            │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. DEVIL'S ADVOCATE PHASE                                       │
│     - Actively CHALLENGES the consensus solution                 │
│     - Finds weaknesses, edge cases, security issues              │
│     - Questions assumptions                                      │
│     - Output: Risk assessment (APPROVED/CONCERNS/CRITICAL)       │
│     - If critical issues OR low confidence → triggers revision   │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. POST-PROCESS PHASE (Tester)                                  │
│     - Validates the final solution                               │
│     - Generates test cases                                       │
│     - Identifies edge cases, bugs, security issues               │
│     - Output: Test report with verdict (PASS/NEEDS_REVISION)     │
└──────────────────────────────────────────────────────────────────┘
```

### Confidence Scoring
Each agent provides a confidence score (0-100%) with their proposals and critiques.

**How it works:**
- 🟢 80%+ = High confidence (green)
- 🟡 60-79% = Medium confidence (yellow)
- 🔴 <60% = Low confidence (red) → triggers additional revision

Average confidence is tracked in metrics and displayed in console output.

### Devil's Advocate
After consensus is reached, a dedicated agent actively challenges the solution:
- Finds weaknesses and edge cases
- Challenges assumptions
- Identifies security and performance risks
- Suggests attack vectors

**Automatic Revision Triggers:**
- Average confidence < 60%
- Devil's Advocate verdict = CRITICAL_ISSUES
- Risk level = CRITICAL
- 2+ HIGH/CRITICAL severity weaknesses

**Output file:** `.ai/prompts/devils-advocate-report.md`

### Parallel Execution
Proposals, critiques, and approval rounds run in parallel for 2-3x speedup.

### Automatic Retry
Failed API calls are retried up to 3 times with exponential backoff:
- Handles: 429 (rate limit), 5xx errors, timeouts
- Rate limits: 65s delay (covers TPM windows)
- Other errors: 1s, 2s, 4s (exponential backoff)

### Incremental Caching
Context bundle is cached based on file hashes. If files haven't changed, cached version is used automatically.

```bash
# Force regeneration
npm run ai -- --no-cache --prompt="..."
```

### Metrics Tracking

Metrics are saved to `.ai/prompts/metrics/`:

```json
{
  "timestamp": "2026-01-14T16:00:00.000Z",
  "promptPreview": "How do I add a Like button...",
  "totalTimeSeconds": 45.32,
  "consensusRounds": 2,
  "agents": {
    "claude": {
      "calls": 4,
      "totalTimeSeconds": 18.5,
      "avgTimeSeconds": 4.63,
      "inputTokens": 12500,
      "outputTokens": 3200
    }
  },
  "totalTokens": 25000
}
```

### Consensus Process

1. **Proposals** (parallel): Each agent proposes a solution
2. **Critiques** (parallel): Each agent critiques all proposals
3. **Consensus**: Designated agent synthesizes final answer
4. **Approval Rounds** (up to 3): Agents vote; revisions if needed

---

## Troubleshooting

### "Missing API key for agent"
```bash
# Check that .ai.env exists and has keys
cat .ai.env

# Ensure key names match agents.json
# agents.json: "key": "CLAUDE_API_KEY"
# .ai.env: CLAUDE_API_KEY=sk-ant-...
```

### "Invalid JSON in ai/agents.json"
The config validation will show specific errors:
```
❌ Invalid ai/agents.json:
   - agents[0]: "apiUrl" is required and must be a string
```

### Rate Limits (429 errors)
The system automatically retries with exponential backoff. If persistent:
- Reduce parallel requests by using fewer agents
- Add delays between runs

### Context Too Large
```bash
# Use light mode
npm run ai:light -- --prompt="..."

# Or limit files
npm run ai -- --max-files=100 --prompt="..."
```

---

## Architecture

### File Structure

```
project/
├── ai/                          # Authored source & control (committed)
│   ├── scripts/                 # Hub orchestration scripts
│   │   └── generate-context.js  # Main orchestration script
│   ├── agents.json              # Agent configuration
│   ├── context.json             # Context file lists
│   ├── PATTERNS.md              # Code patterns/templates
│   ├── PROTOCOL.md              # AI behavior rules
│   ├── SYSTEM_PROMPT.md         # Critical instructions
│   ├── design/                  # Feature design docs
│   └── specs/                   # Language specs
├── .ai/                         # Runtime state (gitignored)
│   ├── logs/
│   │   ├── AI_LOG.md            # Shared history log
│   │   ├── AI_PLAN_LOG.md       # Planned changes + run status
│   │   ├── AI_PROPOSAL_LOG.md   # Proposal history
│   │   ├── AI_DISCUSSION_LOG.md # Critique/review history
│   │   ├── AI_CHANGE_LOG.md     # Applied/result history
│   │   └── AI_ERROR_LOG.md      # Runtime/provider errors
│   ├── prompts/
│   │   ├── prompt.txt           # Current/manual prompt
│   │   ├── result.txt           # Final answer
│   │   ├── runs/                # Completed run outputs
│   │   └── metrics/             # Performance metrics
│   ├── .code_index.json         # Generated code index
│   ├── .context_bundle.md       # Generated context bundle
│   └── .context_cache.json      # Context cache
├── .ai.env                      # API keys (gitignored)
├── CLAUDE.md                    # Claude-specific guide
└── AI_WORKFLOW.md               # This file
```

### Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         npm run ai                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Load Config (ai/context.json, ai/agents.json)               │
│  2. Validate JSON schemas                                        │
│  3. Check cache - use if files unchanged                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Generate Context Bundle (.context_bundle.md)                │
│     - System prompt                                              │
│     - Project files                                              │
│     - Directory structure                                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. PARALLEL: Proposals from all debate agents                  │
│     Architect ──┬── Reviewer ──┬── Implementer                  │
│                          │                                       │
│  6. PARALLEL: Critiques from all debate agents                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Consensus: designated synthesizer agent produces final      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. PARALLEL: Approval votes from debate agents                 │
│     - If all agree → Done                                        │
│     - If disagreement → Revision round (up to 3x)               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. Save Results                                                 │
│     - .ai/prompts/result.txt                                        │
│     - .ai/prompts/runs/                                             │
│     - .ai/prompts/metrics/                                          │
│     - .ai/logs/*.md (plan/proposals/discussions/changes/errors/global) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Logging Protocol

All AI agents must follow one-source logging (no duplicate summaries).

### Streams
1. `Hub manual changes`:
- `UNIFIED_MODEL_CHANGE_LOG.md` (primary)
- `PROJECT_PLANNED_CHANGES.md` (planning/status)

2. `Runtime multi-agent execution`:
- `.ai/logs/AI_LOG.md` (primary)
- `.ai/logs/AI_PLAN_LOG.md`
- `.ai/logs/AI_PROPOSAL_LOG.md`
- `.ai/logs/AI_DISCUSSION_LOG.md`
- `.ai/logs/AI_CHANGE_LOG.md`
- `.ai/logs/AI_ERROR_LOG.md`

### Before Working
Read recent entries from the stream that matches your action type.

### After Working
Write one primary entry and avoid copy-paste duplicates:

```markdown
## [YYYY-MM-DD HH:mm:ss UTC] - Agent: [Name]
Project: [Project name]
Task ID: [ABC-123 | run-... | <promptHash>]
Task Summary: [what this change/run is about]
Phase/Action: [proposal|discussion|change|plan]
Artifact(s): [file paths]
Status: [IN_PROGRESS|DONE|FAILED]
Summary: [What was discussed/proposed/changed]
```

Mandatory metadata:
- `timestamp_utc`
- `author_model`
- `task_id`
- `task_summary`

Secondary logs should only keep `Ref: <task_id>` if the full summary already exists in another primary log.

---

# Инструкция на русском

## Быстрый старт

```bash
# 1. Настройте API ключи
cp .ai.env.example .ai.env
# Отредактируйте .ai.env и добавьте ключи
# Опционально: задайте execution/rate-limit/token настройки через ключи `AI_CFG__...`

# 2. Опционально: bootstrap проекта (создает рабочие конфиги)
npm run ai:init

# 3. Запустите с вопросом
npm run ai -- --prompt="Как добавить кнопку лайка на холст?"

# Легкий режим (быстрее/дешевле)
npm run ai:light -- --prompt="Исправь опечатку в README"

# Обновить только индекс кода
npm run ai:index

# Собрать только context pack
npm run ai:pack -- --prompt="Опиши auth flow"

# Посмотреть snapshot памяти из typed-логов
npm run ai:memory -- --entries=5 --log=plan,change

# 4. Проверьте результат
cat .ai/prompts/result.txt
```

## Настройка API ключей

Создайте файл `.ai.env`:
```env
CLAUDE_API_KEY=sk-ant-api03-xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
OPENAI_API_KEY=sk-proj-xxxxx
```

Для лимитов/ретраев/токен-бюджетов используйте ключи `AI_CFG__...` из `.ai.env.example`
(подробно описано в `README.md`).
Также можно отключить провайдера/агента без правки кода (например, `AI_CFG__PROVIDER__GOOGLE__ENABLED=0`).
Готовые пресеты лежат в `examples/env-presets/` (`economy`, `balanced`, `max-quality`).

## Основные команды

```bash
# Bootstrap (рабочие конфиги)
npm run ai:init

# Полный режим
npm run ai -- --prompt="Ваш вопрос"

# Легкий режим (быстрее и дешевле)
npm run ai:light -- --prompt="Ваш вопрос"

# Только обновить индекс кода
npm run ai:index

# Только собрать context pack
npm run ai:pack -- --prompt="Ваш вопрос"

# Память проекта (план/предложения/обсуждения/изменения)
npm run ai:memory
```

Полный справочник по всем командам и флагам (`ai:clean`, `ai:arch:check`, `ai:lang:*` и все CLI-опции) находится в `README.md` (разделы EN/RU).

## Результаты

| Файл | Описание |
|------|----------|
| `.ai/prompts/result.txt` | Финальный ответ с trust-header (`RESULT_MODE`, `COPYPASTE_READY`) |
| `.ai/prompts/result-warning.txt` | Предупреждения, если ответ не patch-safe и/или consensus слабый |
| `.ai/prompts/devils-advocate-report.md` | Отчет Devil's Advocate |
| `.ai/prompts/test-report.md` | Отчет по тестам (если включен `--test`) |
| `.ai/prompts/runs/` | Полные артефакты завершенных прогонов |
| `.ai/prompts/discussions/<task-id>/<run-id>/` | Исторический пакет prompt/result для конкретного прогона задачи |
| `.ai/prompts/runs/init-*.json` | Метаданные bootstrap (`ai:init`) |
| `.ai/prompts/metrics/latest.json` | Метрики последнего запуска |
| `.ai/prompts/metrics/history.json` | История метрик (100 запусков) |

Важно:
- файлы в корне `.ai/prompts/` (`prompt.txt`, `result.txt`, `devils-advocate-report.md`, `test-report.md`) всегда относятся только к последнему запуску;
- предыдущие prompt/result и связанные обсуждения нужно смотреть в `.ai/prompts/discussions/<task-id>/<run-id>/`;
- полные сырые артефакты прогонов лежат в `.ai/prompts/runs/`.
- пока `Evidence-Grounded Patch Mode` не доведён до конца, `result.txt` надо считать operator guidance, а не гарантированно copy-paste-safe патчем;
- если `COPYPASTE_READY: NO`, ручная проверка, project-specific validation и тестирование обязательны перед использованием кода или конфигурации;
- `result-warning.txt` обязателен для не-patch-safe вывода и для слабого/оспоренного consensus.
| `.ai/logs/AI_PLAN_LOG.md` | Планируемые изменения и статусы |
| `.ai/logs/AI_PROPOSAL_LOG.md` | Предложения моделей |
| `.ai/logs/AI_DISCUSSION_LOG.md` | Обсуждения/критика/ревью |
| `.ai/logs/AI_CHANGE_LOG.md` | Внесенные изменения и артефакты |
| `.ai/logs/AI_ERROR_LOG.md` | Runtime/provider ошибки, ретраи и фатальные падения |
| `.ai/logs/AI_LOG.md` | Глобальная хронология |

## Когда использовать

- **Сложные фичи** — затрагивают БД, Auth и UI одновременно
- **Архитектурные решения** — выбор подхода, рефакторинг
- **Отладка** — сложные баги с несколькими системами
- **Code Review** — получить мнение нескольких "экспертов"
