# undes

Evidence-aware multi-agent engineering workflows for real codebases.

It is designed for work that needs more than a single-shot chat answer:
- root-cause investigation across multiple files
- proposal/critique/consensus loops with explicit approval
- narrow seam expansion when evidence is still missing
- patch-safe vs diagnostic output separation
- repeatable runs with logs, checkpoints, memory, and metrics

## Features
- Multi-agent workflow with explicit stages: proposal, critique, consensus, approval, seam expansion, post-process.
- Context assembly for real repositories with code index, Context Pack, structural search fallback, and bounded file/range reads.
- Evidence-grounded output contract with `Grounded Fixes`, `Assumptions / Unverified Seams`, `Assumed Implementation`, and patch-safe gating.
- Runtime controls for checkpoint/resume, conservative output-budget auto-raise, prompt preprocessing reuse, complexity routing, and typed operational signals.
- Local memory with SQLite + FTS5 recall plus typed project logs in `.ai/logs/`.
- Hub mode for working across multiple repositories from one control repo.
- Bootstrap and scaffold sync for project configs (`stack-profile.json`, `llms.md`, context/agents sync).
- Run metrics with per-model and per-phase token breakdowns.

## What It Gives You
- Better grounding: the system separates proven fixes from assumptions instead of mixing everything into one narrative answer.
- Lower waste: repeated runs can reuse preprocess output, route by complexity, and fetch only the missing seams.
- Safer operator workflow: result warnings, approval artifacts, typed logs, and checkpoints make failures inspectable.
- Cross-stack support: works on Node.js, TypeScript, Python, Java, .NET, Go, Rust, and mixed repositories.

## Layered Structure
- Architecture map and migration rules: `ai/ARCHITECTURE_LAYERS.md`.
- Active design and research docs: `ai/design/README.md`.
- New code should follow `application` -> `domain` -> `infrastructure` boundaries.

## Repository Layout
- Keep root minimal: entry docs (`README.md`, `AI_WORKFLOW.md`), package/runtime files, `config/`, and `ai/`.
- Hub registry/config lives in `config/`:
  - `config/projects.json`
  - `config/hub-config.json`
- Keep `.ai.env` in root (standard dotenv location for CLI tools).

---

## Installation
1. Copy this kit into your project root.
2. Install Node.js 18+.
3. Install dependencies:
```bash
npm install
```
4. Create env file:
```bash
cp .ai.env.example .ai.env
# then edit .ai.env and add API keys
```

---

## Tree-sitter (Optional AST Parsing)

The kit includes optional [tree-sitter](https://tree-sitter.github.io/) integration for precise code indexing. It is **not required** — without it, the indexer falls back to built-in regex patterns automatically.

### With vs Without tree-sitter

| Aspect | With tree-sitter (`npm install`) | Without tree-sitter (no install) |
|---|---|---|
| Symbol extraction | Precise AST parsing | Regex patterns |
| Import/edge detection | AST-based `import`/`require` | Grep-based name matching |
| Accuracy | Higher (understands syntax) | Lower (regex may miss edge cases) |
| Supported languages | 11 (JS/TS, Python, Rust, C/C++, Go, PHP, Java, C#, Ruby) | Same languages, regex mode |
| Setup | `npm install` in project root | Nothing — works out of the box |

### How to enable

```bash
# Run in the kit root (where package.json is)
npm install
```

This installs the optional packages listed in `optionalDependencies`, including:
- `tree-sitter` and language grammars for more accurate code indexing
- `@ast-grep/cli` for structural search and targeted method/class extraction

If a grammar fails to compile (for example missing build tools), it is silently skipped and the indexer uses regex for that language. If `@ast-grep/cli` is unavailable, runtime still works and safely falls back to the index-backed structural-search path.

### ast-grep (Optional Structural Search CLI)

`ast-grep` improves Context Pack precision by matching structural code blocks instead of relying only on index rescoring.

- Default behavior after `npm install`: the kit will try the bundled local `ast-grep` first.
- Safe fallback: if `ast-grep` is missing or unsupported, runtime falls back to index-backed structural search automatically.
- Manual override: set `AI_AST_GREP_BIN=/abs/path/to/ast-grep` if you want to pin a custom binary.
- Health check: `npm run undes:doctor -- --project-path=/abs/project/path` reports whether `ast-grep` is currently detected.

### How it works

`ai/scripts/context-index.js` loads tree-sitter via `try/catch`:

```js
let treeSitter = null;
try {
  treeSitter = require('./context-index-treesitter');
} catch {
  // tree-sitter not installed; regex mode only
}
```

If tree-sitter is available, it is used for AST-based symbol and import extraction. Otherwise, `SYMBOL_PATTERNS` regex table handles all languages. Both modes produce the same `.code_index.json` format — AST mode is simply more accurate.

### Supported extensions (AST mode)

| Extension | Grammar package |
|---|---|
| `.js` `.jsx` `.mjs` `.cjs` | `tree-sitter-javascript` |
| `.ts` `.tsx` | `tree-sitter-typescript` |
| `.py` | `tree-sitter-python` |
| `.rs` | `tree-sitter-rust` |
| `.c` `.h` | `tree-sitter-c` |
| `.cpp` `.cc` `.cxx` `.hpp` | `tree-sitter-cpp` |
| `.go` | `tree-sitter-go` |
| `.php` | `tree-sitter-php` |
| `.java` | `tree-sitter-java` |
| `.cs` | `tree-sitter-c-sharp` |
| `.rb` | `tree-sitter-ruby` |

---

## Configuration
- Main config file: `ai/context.json`.
- Keep critical files in `fullFiles`, minimal docs/core in `lightFiles`.
- Exclude heavy/build/system folders in `exclude`.
- For full cross-language examples (`.NET`, `Python`, `Java`) see `AI_WORKFLOW.md`.
- Detailed real-world `Next.js + React + TypeScript` templates are available in `examples/nextjs-typescript/`.

### Runtime Tuning via `.ai.env` (EN)
You can tune provider behavior without code edits.

Priority for scoped settings: `agent` -> `model` -> `provider` -> `default`.

Examples:
- `AI_CFG__PROVIDER__ANTHROPIC__EXECUTION=sequential`
- `AI_CFG__PROVIDER__GOOGLE__ENABLED=0` (disable all Google-based agents)
- `AI_CFG__AGENT__SYNTHESIZER__MIN_INTERVAL_MS=65000`
- `AI_CFG__MODEL__CLAUDE_SONNET_4_5_20250929__MAX_OUTPUT_TOKENS=1536`
- `AI_CFG__DEFAULT__AUTO_MAX_OUTPUT_TOKENS_ENABLED=0` (disable conservative auto-raise)
- `AI_CFG__AGENT__REVIEWER__AUTO_MAX_OUTPUT_TOKENS_CEILING=8192`
- `AI_CFG__DEFAULT__AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN=256`
- `AI_CFG__DEFAULT__RETRY_RATE_LIMIT_DELAY_MS=65000`
- `AI_CFG__DEFAULT__TOOL_MAX_TOTAL_FILE_BYTES=204800`

Auto output-budget behavior:
- the runtime may conservatively raise `maxOutputTokens` for heavy phases such as `proposal`, `critique`, `consensus`, and `revision`;
- it never auto-lowers a configured budget;
- live runtime overrides still win over auto-adjust;
- every real auto-raise is printed as `🛠️ Auto maxOutputTokens: ...` and saved to `operationalSignals.outputTokenAdjustments`.

Fast Claude-wide throttle:
- `AI_RATE_LIMIT_CLAUDE_MIN_INTERVAL_MS=65000`

Preset profiles:
- `examples/env-presets/economy.env`
- `examples/env-presets/balanced.env` (recommended)
- `examples/env-presets/max-quality.env`

Apply preset (Linux/macOS/Git Bash):
```bash
cp .ai.env.example .ai.env
cat examples/env-presets/balanced.env >> .ai.env
```

### Runtime Overrides Between Phases

For a live run you can apply narrow temporary overrides via:

- `.ai/prompts/run/runtime-overrides.json`

Example template:

- `ai/templates/runtime-overrides.example.json`

Current live-safe overrides:

- `agents.<name>.maxOutputTokens`
- `pauseBeforePhases.<phase>`

Helpful phase aliases:

- `test`
- `tests`
- `tester`

These all map to the internal tester phase `post-process`.

Restart-required keys are warned and ignored mid-run. Important examples:

- `contextBudget`
- `contextMode`
- `maxFiles`
- `packedTreeLimit`
- `phaseToggles`

Why `contextBudget` is restart-required:

- it changes what the provider receives;
- allowing it live would make checkpoint/resume semantics ambiguous;
- for safe mid-run steering, use `maxOutputTokens` and `pauseBeforePhases` only.

## Windows / no npm helper
Use `ai.bat`:
```cmd
.\ai.bat --prompt="Add a new API endpoint"
```

---

## Quick Start (EN)
```bash
# 1) Optional bootstrap for new projects
npm run undes:init

# 2) Main run
npm run undes -- --prompt="Refactor login controller"

# 3) Light mode (faster/cheaper)
npm run undes:light -- --prompt="Fix typo in README"

# 4) Rebuild code index only
npm run undes:index

# 5) Build context pack only
npm run undes:pack -- --prompt="Summarize auth flow"

# 6) Show memory snapshot from typed logs
npm run undes:memory -- --entries=5 --log=plan,change

# 7) Search saved local memory
npm run undes:memory:search -- --query="jwt race"

# 8) Save explicit fact/decision to local memory
npm run undes:memory:save -- --type=decision --title="Split-root layout" --content="Keep ai/ authored and .ai/ runtime"
```

Primary CLI family is `undes*`.

---

## Commands (EN)

| npm script | What it does | Example |
|---|---|---|
| `npm run undes -- ...` | Full multi-agent run with context generation | `npm run undes -- --prompt="Add rate limiting"` |
| `npm run undes:light -- ...` | Same engine, but with light context set | `npm run undes:light -- --prompt="Update docs"` |
| `npm run undes:index` | Build/update `.code_index.json` and exit | `npm run undes:index` |
| `npm run undes:pack -- ...` | Build `.context_bundle.md` using Context Pack mode and exit | `npm run undes:pack -- --prompt="Describe payment module"` |
| `npm run undes:memory -- ...` | Print snapshot from plan/proposal/discussion/change/global logs | `npm run undes:memory -- --entries=3 --log=discussion,change` |
| `npm run undes:memory:search -- ...` | Search typed local memory entries (`fact`, `decision`, `episode`) | `npm run undes:memory:search -- --query="templater diagnostics"` |
| `npm run undes:memory:save -- ...` | Save an explicit typed local memory entry | `npm run undes:memory:save -- --type=fact --title="Framework" --content="Project uses Next.js 15"` |
| `npm run undes:<hub-cmd> -- ...` | Hub registry and maintenance (`undes:add`, `undes:list`, `undes:start`, `undes:status`, `undes:doctor`, `undes:stats`, `undes:gc`) | `npm run undes:stats` |
| `npm run undes:init -- ...` | Bootstrap active config files from project scan | `npm run undes:init -- --audit` |
| `npm run undes:clean` | Keep only latest files in `.ai/prompts/runs` | `npm run undes:clean` |
| `npm run undes:arch:check -- ...` | Run architecture complexity checks | `npm run undes:arch:check -- --target=src --max-lines=250` |
| `npm run undes:lang:list` | List registered language specs | `npm run undes:lang:list` |
| `npm run undes:lang:validate` | Validate `ai/specs/languages.json` | `npm run undes:lang:validate` |
| `npm run undes:lang:scaffold -- ...` | Print scaffold JSON for a new language spec | `npm run undes:lang:scaffold -- --id=rust --label=Rust --ext=.rs` |
| `npm run undes:lang:add -- ...` | Add a new language spec with TODO regex patterns | `npm run undes:lang:add -- --id=rust --label=Rust --ext=.rs` |

Verification policy for hub changes:
- After changing hub code/config/docs, run `npm run undes:test` before finalizing.
- For feature/fix changes, add/update tests in the target project and run relevant tests when possible.

### Flags for `npm run undes -- ...`

| Flag | Effect |
|---|---|
| `--prompt="..."` | Use inline prompt text. |
| `--prompt-file=PATH` | Read prompt from file. |
| `--task-id=ID` | Stable task identifier for discussion packaging (`.ai/prompts/discussions/<task-id>/<run-id>/`). |
| `<positional text>` | First non-flag arg is also accepted as prompt text. |
| `--project-path=/abs/path` | Force target project root for this run. |
| `--hub-root=/abs/hub` | Force hub root (where `config/projects.json` / `config/hub-config.json` live). |
| `--light` | Use `lightFiles` from `ai/context.json`. |
| `--max-files=N` | Limit collected files in directory snapshot/index candidate set. |
| `--full` | Lift file-count cap for snapshot (very large context). |
| `--no-tree` | Skip directory tree section in context bundle. |
| `--no-cache` | Ignore `.context_cache.json` and rebuild context. |
| `--no-redact` | Disable secret redaction in context output. |
| `--index-only` | Build index and exit (used by `undes:index`). |
| `--context-pack-only` | Build context pack bundle and exit (used by `undes:pack`). |
| `--prepost` | Enable pre-process phase agents (`phase: "pre-process"`). |
| `--test` | Enable post-process phase agents (`phase: "post-process"`). |
| `--restart` | Ignore any interrupted checkpoint run and start fresh. |
| `--non-interactive` | Auto-resume interrupted run without prompt (CI/script mode). |
| `--refine` | Refinement mode: re-run only the consensus agent with user feedback on the last completed run. |
| `--feedback="..."` | Feedback text for `--refine` (prompted interactively if omitted). |

Hub behavior:
- `npm run undes:start` saves selected project into `config/hub-config.json` (`activeProjectPath`).
- Next `npm run undes` from hub root auto-uses this project even without `AI_HUB_PROJECT_PATH`.
- CLI/env still override config (`--project-path` > `AI_HUB_PROJECT_PATH` > `config/hub-config.json` > last-used registry hint).
- Direct script invocation is blocked in strict dispatcher mode (for example `node ai/scripts/generate-context.js`); use `npm run undes ...`.

### Writing Better Investigation Prompts (EN)

If you want a root-cause answer instead of a narrow local patch, write the prompt
so the listed files/methods are treated as **starting seams**, not the full
allowed scope.

Recommended:
- `Start with ApproverFacadeImpl#approveDocument and #moveQueueForward, but trace any upstream/downstream code needed to ground route generation, currentStep/current queue synchronization, finalization, reset/rework, and EDS-path behavior.`
- `If the first seams are insufficient, continue into the minimal related code needed for a patch-safe answer.`

Use a hard scope only when you really mean it:
- `Analyze only these methods. Do not read beyond them.`

Prompt tips:
- For root-cause mode, explicitly allow related upstream/downstream reads.
- For narrow patch mode, state the hard boundary literally.
- Listing a few suspect methods without extra wording can bias retrieval toward
  those seams and make the first answer shallower.
- `--prepost` helps clarify and structure the prompt, but it does not silently
  override an explicit hard scope from the user.

### Workspace Hub Mode: Multi-Project Workflow (EN)

Use these steps when one hub instance serves multiple repositories.

1. Add each project once:
```bash
npm run undes:add -- --path=/abs/path/to/project-a
npm run undes:add -- --path=/abs/path/to/project-b
```

2. Verify registry:
```bash
npm run undes:list
```

3. Switch active project:
```bash
# Interactive menu
npm run undes:start

# Or non-interactive selection by list index
npm run undes:start -- --select=2
```
This writes selected path to `config/hub-config.json` as `activeProjectPath`.

4. Run AI for the active project (from hub root):
```bash
npm run undes -- --prompt="Implement feature X"
```
No `--project-path` and no `AI_HUB_PROJECT_PATH` are required after `start`.

5. One-off override for current command only:
```bash
npm run undes -- --project-path=/abs/path/to/another-project --prompt="Quick check"
```
or:
```bash
AI_HUB_PROJECT_PATH=/abs/path/to/another-project npm run undes -- --prompt="Quick check"
```
Override priority: `--project-path` > `AI_HUB_PROJECT_PATH` > `config/hub-config.json` > `config/projects.json:lastUsed`.

6. Check current target project details:
```bash
npm run undes:status
```

7. If run fails with `EACCES`, fix write permissions in target project `.ai/` directory.

### Flags for `npm run undes:init -- ...`

| Flag | Effect |
|---|---|
| `--dry-run` | Preview generated config files without writing them. |
| `--force` | Overwrite existing config files and create `.bak-*` backups. |
| `--yes` | Suppress overwrite reminder message when files are skipped. |
| `--audit` | Print project scan analysis and exit (no file generation). |
| `--sync` | Sync project scaffold to the current hub contract. Safe derived files are refreshed; merge-aware config files are updated with backups. |
| `--depth=N` | Max directory scan depth (default `3`). |
| `--max-files=N` | Max number of files scanned during bootstrap. |
| `--max-bytes=N` | Total read budget (bytes) for key file extraction. |
| `--provider=...` | Parsed but currently not applied in runtime bootstrap logic. |
| `--model=...` | Parsed but currently not applied in runtime bootstrap logic. |
| `--api-key-env=...` | Parsed but currently not applied in runtime bootstrap logic. |

Runtime note:
- on `npm run undes`, the hub now checks a project scaffold contract in `.ai/hub-contract.json`;
- if safe derived surfaces drift (`.ai/stack-profile.json`, `ai/llms.md`, context references), they are auto-synced before the run starts;
- if merge-aware drift remains in `ai/context.json` / `ai/agents.json`, runtime warns and recommends `npm run undes:init -- --sync`.

### Flags for `npm run undes:memory -- ...`

The default `undes:memory` command is still a typed-log snapshot view.

Additional Local Memory commands:

- `npm run undes:memory:search -- --query="..."`
- `npm run undes:memory:save -- --type=decision --title="..." --content="..."`

Local Memory storage lives in:

- `.ai/memory/memory.db`
- `.ai/memory/decisions/`
- `.ai/memory/episodes/`

| Flag | Effect |
|---|---|
| `--entries=N` | Number of recent entries per selected log. |
| `--bytes=N` | Max bytes per selected log section. |
| `--log=plan,proposal,discussion,change,global` | Comma-separated list of logs to print. |
| `--help`, `-h` | Print usage help. |

### Flags for `npm run undes:arch:check -- ...`

| Flag | Effect |
|---|---|
| `--target=PATH` | Add target directory to scan (repeatable). |
| `--max-lines=N` | Max lines per file before violation. |
| `--max-functions=N` | Max functions per file before violation. |
| `--max-exports=N` | Max exports per file before violation. |
| `--max-impl-blocks=N` | Max impl blocks (Rust) before violation. |
| `--max-concerns=N` | Max concern buckets before god-module signal. |
| `--god-fns=N` | Minimum functions required before god-module rule triggers. |
| `--help`, `-h` | Print usage help. |

### Options for `npm run undes:lang:scaffold` and `npm run undes:lang:add`

| Option | Effect |
|---|---|
| `--id=slug` | Language id (`^[a-z0-9-]+$`). |
| `--label=Name` | Human-readable language name. |
| `--ext=.ext` | Extension; repeatable (`--ext=.ts --ext=.tsx`). |

---

## Быстрый старт (RU)
```bash
# 1) Опционально: bootstrap для нового проекта
npm run undes:init

# 2) Основной запуск
npm run undes -- --prompt="Рефакторинг контроллера логина"

# 3) Легкий режим (быстрее/дешевле)
npm run undes:light -- --prompt="Исправь опечатку в README"

# 4) Только обновить индекс кода
npm run undes:index

# 5) Только собрать context pack
npm run undes:pack -- --prompt="Опиши auth flow"

# 6) Показать снимок памяти по логам
npm run undes:memory -- --entries=5 --log=plan,change
```

## Tree-sitter (Опциональный AST-парсинг)

Кит включает опциональную интеграцию с [tree-sitter](https://tree-sitter.github.io/) для точной индексации кода. Он **не обязателен** — без него индексер автоматически переключается на встроенные regex-паттерны.

### Сравнение: с tree-sitter и без

| Аспект | С tree-sitter (`npm install`) | Без tree-sitter (без установки) |
|---|---|---|
| Извлечение символов | Точный AST-парсинг | Regex-паттерны |
| Обнаружение связей | AST: `import`/`require` | Grep по именам |
| Точность | Выше (понимает синтаксис) | Ниже (regex может промахнуться) |
| Языки | 11 (JS/TS, Python, Rust, C/C++, Go, PHP, Java, C#, Ruby) | Те же языки, но regex |
| Настройка | `npm install` в корне проекта | Ничего — работает сразу |

### Как подключить

```bash
# Выполнить в корне кита (где лежит package.json)
npm install
```

Устанавливает опциональные пакеты из `optionalDependencies`, включая:
- `tree-sitter` и языковые грамматики для более точной индексации кода
- `@ast-grep/cli` для structural search и targeted method/class extraction

Если какая-то грамматика не компилируется (нет build-инструментов), она тихо пропускается, и индексер использует regex для этого языка. Если `@ast-grep/cli` недоступен, рантайм всё равно работает и безопасно откатывается на index-backed structural search.

### ast-grep (Опциональный CLI для structural search)

`ast-grep` повышает точность Context Pack, потому что позволяет матчить структурные блоки кода, а не опираться только на rescoring по индексу.

- Поведение по умолчанию после `npm install`: кит сначала пытается использовать локально установленный bundled `ast-grep`.
- Безопасный fallback: если `ast-grep` отсутствует или не поддерживается, рантайм автоматически откатывается на index-backed structural search.
- Ручной override: можно задать `AI_AST_GREP_BIN=/abs/path/to/ast-grep`, если нужен конкретный бинарник.
- Проверка состояния: `npm run undes:doctor -- --project-path=/abs/project/path` покажет, обнаружен ли сейчас `ast-grep`.

### Как это работает

`ai/scripts/context-index.js` загружает tree-sitter через `try/catch`:

```js
let treeSitter = null;
try {
  treeSitter = require('./context-index-treesitter');
} catch {
  // tree-sitter не установлен; только regex-режим
}
```

Если tree-sitter доступен — используется AST-парсинг символов и импортов. Иначе — таблица `SYMBOL_PATTERNS` на regex. Оба режима создают одинаковый `.code_index.json` — AST просто точнее.

### Поддерживаемые расширения (AST-режим)

| Расширение | Пакет грамматики |
|---|---|
| `.js` `.jsx` `.mjs` `.cjs` | `tree-sitter-javascript` |
| `.ts` `.tsx` | `tree-sitter-typescript` |
| `.py` | `tree-sitter-python` |
| `.rs` | `tree-sitter-rust` |
| `.c` `.h` | `tree-sitter-c` |
| `.cpp` `.cc` `.cxx` `.hpp` | `tree-sitter-cpp` |
| `.go` | `tree-sitter-go` |
| `.php` | `tree-sitter-php` |
| `.java` | `tree-sitter-java` |
| `.cs` | `tree-sitter-c-sharp` |
| `.rb` | `tree-sitter-ruby` |

---

### Runtime-настройка через `.ai.env` (RU)
Можно менять поведение провайдеров без правки кода.

Приоритет scoped-настроек: `agent` -> `model` -> `provider` -> `default`.

Примеры:
- `AI_CFG__PROVIDER__ANTHROPIC__EXECUTION=sequential`
- `AI_CFG__PROVIDER__GOOGLE__ENABLED=0` (отключить всех Google-агентов)
- `AI_CFG__AGENT__SYNTHESIZER__MIN_INTERVAL_MS=65000`
- `AI_CFG__MODEL__CLAUDE_SONNET_4_5_20250929__MAX_OUTPUT_TOKENS=1536`
- `AI_CFG__DEFAULT__RETRY_RATE_LIMIT_DELAY_MS=65000`
- `AI_CFG__DEFAULT__TOOL_MAX_TOTAL_FILE_BYTES=204800`

Быстрый throttling для всех Claude-моделей:
- `AI_RATE_LIMIT_CLAUDE_MIN_INTERVAL_MS=65000`

Готовые профили:
- `examples/env-presets/economy.env`
- `examples/env-presets/balanced.env` (рекомендуется)
- `examples/env-presets/max-quality.env`

Применение профиля (Linux/macOS/Git Bash):
```bash
cp .ai.env.example .ai.env
cat examples/env-presets/balanced.env >> .ai.env
```

## Команды (RU)

| npm script | Что делает | Пример |
|---|---|---|
| `npm run undes -- ...` | Полный multi-agent запуск с генерацией контекста | `npm run undes -- --prompt="Добавь rate limiting"` |
| `npm run undes:light -- ...` | Тот же движок, но с `lightFiles` | `npm run undes:light -- --prompt="Обнови документацию"` |
| `npm run undes:index` | Собирает/обновляет `.code_index.json` и завершает работу | `npm run undes:index` |
| `npm run undes:pack -- ...` | Собирает `.context_bundle.md` в режиме Context Pack и завершает работу | `npm run undes:pack -- --prompt="Опиши платежный модуль"` |
| `npm run undes:memory -- ...` | Печатает snapshot по логам plan/proposal/discussion/change/global | `npm run undes:memory -- --entries=3 --log=discussion,change` |
| `npm run undes:<hub-cmd> -- ...` | Управление реестром и обслуживанием хаба (`undes:add`, `undes:list`, `undes:start`, `undes:status`, `undes:doctor`, `undes:stats`, `undes:gc`) | `npm run undes:stats` |
| `npm run undes:init -- ...` | Генерирует bootstrap рабочих конфиг-файлов из скана проекта | `npm run undes:init -- --audit` |
| `npm run undes:clean` | Оставляет только последние файлы в `.ai/prompts/runs` | `npm run undes:clean` |
| `npm run undes:arch:check -- ...` | Проверяет архитектурные ограничения по коду | `npm run undes:arch:check -- --target=src --max-lines=250` |
| `npm run undes:lang:list` | Показывает список языковых спецификаций | `npm run undes:lang:list` |
| `npm run undes:lang:validate` | Валидирует `ai/specs/languages.json` | `npm run undes:lang:validate` |
| `npm run undes:lang:scaffold -- ...` | Печатает JSON-шаблон новой языковой спецификации | `npm run undes:lang:scaffold -- --id=rust --label=Rust --ext=.rs` |
| `npm run undes:lang:add -- ...` | Добавляет новую языковую спецификацию с TODO regex | `npm run undes:lang:add -- --id=rust --label=Rust --ext=.rs` |

Политика верификации для изменений в хабе:
- После изменений в коде/конфигах/документации хаба обязательно запускай `npm run undes:test` перед завершением задачи.

### Флаги для `npm run undes -- ...`

| Флаг | Что делает |
|---|---|
| `--prompt="..."` | Задача/вопрос прямо в командной строке. |
| `--prompt-file=PATH` | Берет задачу из файла. |
| `--task-id=ID` | Стабильный идентификатор задачи для discussion package (`.ai/prompts/discussions/<task-id>/<run-id>/`). |
| `<текст без флага>` | Первый positional-аргумент тоже читается как prompt. |
| `--project-path=/abs/path` | Явно задает корень целевого проекта для текущего запуска. |
| `--hub-root=/abs/hub` | Явно задает корень хаба (`config/projects.json` / `config/hub-config.json`). |
| `--light` | Использует `lightFiles` из `ai/context.json`. |
| `--max-files=N` | Ограничивает число файлов в snapshot/index-кандидатах. |
| `--full` | Снимает лимит количества файлов в snapshot. |
| `--no-tree` | Не добавляет дерево файлов в bundle. |
| `--no-cache` | Игнорирует `.context_cache.json` и пересобирает контекст. |
| `--no-redact` | Отключает редактирование секретов в выводе контекста. |
| `--index-only` | Только индекс и выход (использует `undes:index`). |
| `--context-pack-only` | Только context pack bundle и выход (использует `undes:pack`). |
| `--prepost` | Включает pre-process агентов (`phase: "pre-process"`). |
| `--test` | Включает post-process агентов (`phase: "post-process"`). |
| `--restart` | Игнорирует прерванный checkpoint-run и запускает новый с нуля. |
| `--non-interactive` | Автовосстановление прерванного run без запроса (режим CI/скриптов). |

Поведение хаба:
- `npm run undes:start` сохраняет выбранный проект в `config/hub-config.json` (`activeProjectPath`).
- Следующий `npm run undes` из корня хаба автоматически берет этот проект даже без `AI_HUB_PROJECT_PATH`.
- Приоритет источников: `--project-path` > `AI_HUB_PROJECT_PATH` > `config/hub-config.json` > last-used из `config/projects.json`.
- В strict dispatcher режиме прямой запуск скриптов (`node ai/scripts/generate-context.js`) блокируется; используйте `npm run undes ...`.

### Как Писать Prompt Для Исследования (RU)

Если нужен root-cause ответ, а не локальный hotfix, формулируй prompt так,
чтобы перечисленные файлы/методы считались **стартовыми seam-ами**, а не всей
разрешенной областью анализа.

Рекомендуемый стиль:
- `Начни с ApproverFacadeImpl#approveDocument и #moveQueueForward, но при необходимости дочитай связанные upstream/downstream участки, которые реально влияют на генерацию маршрута, синхронизацию currentStep/current queue, финализацию, reset/rework и EDS-path.`
- `Если стартовых seam-ов недостаточно, дочитай минимально нужный связанный код для patch-safe ответа.`

Жесткие рамки задавай только буквально:
- `Анализируй только эти методы. Глубже не ходи.`

Практические правила:
- Для root-cause режима явно разрешай читать связанные upstream/downstream seam-ы.
- Для narrow patch режима явно пиши, что область анализа жестко ограничена.
- Простое перечисление подозрительных методов без такого уточнения может
  сместить retrieval в их сторону и сделать первый ответ более поверхностным.
- `--prepost` помогает прояснить и структурировать prompt, но не должен молча
  отменять явно заданный пользователем hard scope.

### Workspace Hub Mode: Работа с несколькими проектами (RU)

Используй этот сценарий, когда один хаб обслуживает несколько репозиториев.

1. Один раз добавь проекты в реестр:
```bash
npm run undes:add -- --path=/abs/path/to/project-a
npm run undes:add -- --path=/abs/path/to/project-b
```

2. Проверь список:
```bash
npm run undes:list
```

3. Переключи активный проект:
```bash
# Интерактивное меню
npm run undes:start

# Или без меню по номеру из list
npm run undes:start -- --select=2
```
Выбранный путь сохраняется в `config/hub-config.json` в поле `activeProjectPath`.

4. Запускай AI для активного проекта (из корня хаба):
```bash
npm run undes -- --prompt="Реализуй фичу X"
```
После `start` не нужно каждый раз передавать `--project-path` или `AI_HUB_PROJECT_PATH`.

5. Разовый override только для одного запуска:
```bash
npm run undes -- --project-path=/abs/path/to/another-project --prompt="Быстрая проверка"
```
или:
```bash
AI_HUB_PROJECT_PATH=/abs/path/to/another-project npm run undes -- --prompt="Быстрая проверка"
```
Приоритет: `--project-path` > `AI_HUB_PROJECT_PATH` > `config/hub-config.json` > `config/projects.json:lastUsed`.

6. Проверка текущего целевого проекта:
```bash
npm run undes:status
```

7. Если видишь `EACCES`, проверь права на запись в `.ai/` целевого проекта.

### Флаги для `npm run undes:init -- ...`

| Флаг | Что делает |
|---|---|
| `--dry-run` | Показывает результат генерации конфигов, но не записывает файлы. |
| `--force` | Перезаписывает существующие конфиги и делает `.bak-*` бэкапы. |
| `--yes` | Убирает предупреждение о пропуске файлов без `--force`. |
| `--audit` | Печатает анализ проекта и завершает работу. |
| `--depth=N` | Глубина сканирования директорий (по умолчанию `3`). |
| `--max-files=N` | Максимум файлов для сканирования в bootstrap. |
| `--max-bytes=N` | Общий лимит байт при чтении ключевых файлов. |
| `--provider=...` | Парсится, но в текущей версии не влияет на bootstrap-логику. |
| `--model=...` | Парсится, но в текущей версии не влияет на bootstrap-логику. |
| `--api-key-env=...` | Парсится, но в текущей версии не влияет на bootstrap-логику. |

### Флаги для `npm run undes:memory -- ...`

| Флаг | Что делает |
|---|---|
| `--entries=N` | Количество последних записей на каждый выбранный лог. |
| `--bytes=N` | Лимит байт на секцию каждого выбранного лога. |
| `--log=plan,proposal,discussion,change,global` | Список логов через запятую. |
| `--help`, `-h` | Печатает справку по команде. |

### Флаги для `npm run undes:arch:check -- ...`

| Флаг | Что делает |
|---|---|
| `--target=PATH` | Добавляет каталог для проверки (можно указывать несколько раз). |
| `--max-lines=N` | Лимит строк в файле до нарушения. |
| `--max-functions=N` | Лимит функций в файле до нарушения. |
| `--max-exports=N` | Лимит экспортов в файле до нарушения. |
| `--max-impl-blocks=N` | Лимит `impl`-блоков (Rust) до нарушения. |
| `--max-concerns=N` | Лимит concern buckets до сигнала god-module. |
| `--god-fns=N` | Порог числа функций для активации правила god-module. |
| `--help`, `-h` | Печатает справку по команде. |

### Опции для `npm run undes:lang:scaffold` и `npm run undes:lang:add`

| Опция | Что делает |
|---|---|
| `--id=slug` | Идентификатор языка (`^[a-z0-9-]+$`). |
| `--label=Name` | Человекочитаемое имя языка. |
| `--ext=.ext` | Расширение файла; повторяемый флаг (`--ext=.ts --ext=.tsx`). |

Подробные шаблоны `Next.js + React + TypeScript` для `*.example` файлов находятся в `examples/nextjs-typescript/`.

---

## Logs and Outputs
- `.ai/prompts/prompt.txt`: latest active/manual prompt only.
- `.ai/prompts/result.txt`: final consensus answer with top-of-file trust header (`RESULT_MODE`, `COPYPASTE_READY`).
  Proposed implementation items in `Grounded Fixes` are expected to include concrete code blocks or diff-style snippets; prose-only implementation advice is treated as a contract gap.
- `.ai/prompts/patch-safe-result.md`: strict apply-ready artifact, created only when the patch-safe gate passes.
- `.ai/prompts/result-warning.txt`: warning details when the result is not patch-safe and/or consensus is weak.
- `.ai/prompts/devils-advocate-report.md`: latest Devil's Advocate report only.
- `.ai/prompts/test-report.md`: latest test validation report only.
- `.ai/prompts/runs/`: completed run artifacts.
- `.ai/prompts/discussions/<task-id>/<run-id>/`: prompt/result/Devil's Advocate discussion package for a specific task run.
- `.ai/prompts/metrics/latest.json`: latest run metrics plus `operationalSignals` such as runtime settings, structural-search diagnostics, output-token auto-adjustments, and final trust / patch-safe gap summary.
- `ai/PILOT_RUNBOOK.md`: real-project pilot checklist before enabling SLA Router.

### Runtime Logs
- `.ai/logs/AI_PLAN_LOG.md`: plans and execution lifecycle.
- `.ai/logs/AI_PROPOSAL_LOG.md`: model proposals.
- `.ai/logs/AI_DISCUSSION_LOG.md`: critiques/discussions.
- `.ai/logs/AI_CHANGE_LOG.md`: applied/resulting changes.
- `.ai/logs/AI_ERROR_LOG.md`: runtime/provider errors, retries, and fatal failures.
- `.ai/logs/AI_LOG.md`: global timeline.

Important:
- files in the root `.ai/prompts/` folder are the latest working copies for the most recent run;
- older prompt/result/Devil's Advocate outputs should be read from `.ai/prompts/discussions/<task-id>/<run-id>/`;
- full per-run artifacts should be read from `.ai/prompts/runs/`.
- trust the top-of-file header in `result.txt`: `COPYPASTE_READY: YES` means the heuristic patch-safe gate passed for that run; `COPYPASTE_READY: NO` means the answer stays diagnostic/operator-guidance only;
- when present, `.ai/prompts/patch-safe-result.md` is the strict apply-ready surface for that run;
- if `COPYPASTE_READY: NO`, manual review, project-specific validation, and testing are mandatory before using generated code or config;
- user-facing free-text outputs are expected to stay in the same natural language as the original user prompt unless the user explicitly requests another language;
- see [docs/USER_AGREEMENT.md](docs/USER_AGREEMENT.md) for the current user-facing disclaimer and responsibility boundary.

### Git Workflow Rule

For all new feature work:
- start from a dedicated feature branch, not directly on `main`
- complete implementation and local verification in that feature branch
- get review before merge
- merge only through a PR after review

Direct commits to `main` are allowed only for exceptional repository-maintenance
or explicitly approved emergency fixes.

## Roadmap
See `ai/ROADMAP.md` for the short priority/status view.
Detailed future-feature design docs live in `ai/design/features/README.md`.
