# Project Planned Changes

Track intended work before implementation starts.

## Entry Template

## [YYYY-MM-DD HH:mm:ss UTC] - Project: <name>
Planned Change: <what should be changed>
Owner Model: <name>
Priority: <P0|P1|P2|P3>
Status: <PLANNED|IN_PROGRESS|DONE|CANCELLED>
Target Files:
- <file/path>
- <file/path>
Notes: <optional>

---

## Plan Items
## [2026-03-21 02:58:14 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 4 — seam expansion consumption of enriched ownership in critique-expansion.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/critique-expansion.js
- ai/scripts/__tests__/critique-expansion.test.js
- ai/ROADMAP.md
Notes: Landed the Batch 4 MVP boundary from the design doc: `Class#method` resolution now prefers enriched `container` ownership, can resolve method symbols even when the owner class/module symbol is absent, and uses container metadata to disambiguate duplicate method names inside one file before older owner/range/token fallbacks. Signature detail and call graph remain deferred.

## [2026-03-21 02:10:21 UTC] - Project: ai-hub-coding
Planned Change: Спроектировать explicit language-pack activation/config для runtime, чтобы управлять активными языками без merged-default поведения.
Owner Model: Codex (GPT-5)
Priority: P1
Status: PLANNED
Target Files:
- ai/scripts/domain/language-packs/registry.js
- ai/scripts/context-pack.js
- ai/scripts/local-memory.js
- ai/scripts/domain/prompt-content.js
- ai/scripts/domain/output-artifacts.js
- ai/scripts/init-project.js
- ai/scripts/domain/stack-profile.js
- ai/scripts/__tests__/language-packs.test.js
- ai/scripts/__tests__/context-pack.test.js
- ai/scripts/__tests__/local-memory.test.js
- ai/scripts/__tests__/prompt-content.test.js
Notes: Discussion scope only for now. Proposed decision points: 1) canonical config source (`.ai/stack-profile.json` vs dedicated language-runtime config), 2) default policy (`en` only vs `en+detected` vs `all installed`), 3) detection inputs (stack profile, user prompt language, explicit init overrides), 4) fallback behavior when project is empty or language is unknown, 5) whether prompts/sanitizers/memory/tokenization should consume the same active-pack set or a split policy. Preferred rollout for discussion: Batch A - config contract + resolver, Batch B - wire active packs into context-pack/local-memory/prompt-content/output-artifacts, Batch C - init/bootstrap integration and docs.

## [2026-03-21 02:07:53 UTC] - Project: ai-hub-coding
Planned Change: Закрыть remaining language-specific regex в response-validator и завершить cleanup active scripts до модели “core English-only, multilingual data in language packs”.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/response-validator.js
- ai/scripts/__tests__/response-validator.test.js
Notes: Trailing-text truncation heuristic now uses Unicode property classes instead of explicit Cyrillic ranges. This completes the current cleanup pass: active scripts keep multilingual behavior, but language-specific literals now live only in language-pack data.

## [2026-03-21 02:02:17 UTC] - Project: ai-hub-coding
Planned Change: Продолжить language-pack migration для prompt-content и output-artifacts, чтобы multilingual phrase tables не жили в core runtime.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/domain/language-packs/en.js
- ai/scripts/domain/language-packs/ru.js
- ai/scripts/domain/language-packs/registry.js
- ai/scripts/domain/prompt-content.js
- ai/scripts/domain/output-artifacts.js
- ai/scripts/__tests__/language-packs.test.js
Notes: Language-pack registry now also owns evidence-path connector labels, hard-scope examples, log section headings, and meta-tail phrases. `prompt-content.js` and `output-artifacts.js` no longer embed Russian literals directly; they consume generated labels/patterns from the registry.

## [2026-03-21 01:53:02 UTC] - Project: ai-hub-coding
Planned Change: Вынести multilingual runtime lexicon в отдельные language packs и очистить core runtime от встроенных language-specific stop-words/aliases.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/domain/language-packs/en.js
- ai/scripts/domain/language-packs/ru.js
- ai/scripts/domain/language-packs/registry.js
- ai/scripts/context-pack.js
- ai/scripts/local-memory.js
- ai/scripts/prompt-gate.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/language-packs.test.js
- ai/scripts/__tests__/context-pack.test.js
- ai/scripts/__tests__/local-memory.test.js
- ai/scripts/__tests__/prompt-gate.test.js
- ai/scripts/__tests__/quality-pipeline.test.js
Notes: Delivered the foundation slice only: shared language-pack registry now owns stop-words, canonical token translations, and memory decision headings for `context-pack` and `local-memory`; runtime output labels became language-agnostic; comments in `generate-context.js` were normalized to English. Deferred follow-up: move remaining phrase tables from `prompt-content` and `output-artifacts` onto the same registry.

## [2026-03-01 12:26:38 UTC] - Project: node-ai
Planned Change: Изучить контекст проекта мультиагентного помощника и зафиксировать актуальное состояние архитектуры/процессов.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- README.md
- ai/scripts/generate-context.js
- ai/context.json
Notes: Выполнен обзор структуры, конфигурации агентов, пайплайна индексирования/контекст-пака, логов и roadmap.

## [2026-03-01 13:17:45 UTC] - Project: node-ai
Planned Change: Прочитать обновлённый roadmap по Workspace Hub Mode и выделить актуальный план внедрения.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
Notes: Подтверждена новая архитектура split storage (hub code + project .ai data), обновлены фазы внедрения и критерии.

## [2026-03-01 13:40:23 UTC] - Project: node-ai
Planned Change: Добавить предложения по устранению минусов обновленного Workspace Hub Mode (disk growth, path safety, migration compatibility, secrets).
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
Notes: Добавлены обязательный path sandbox, compat-window ai/.ai, doctor-команда, усиленные требования к секретам и опциональная dedup-стратегия.

## [2026-03-01 13:46:21 UTC] - Project: ai-hub-coding
Planned Change: Начать первичную реализацию Workspace Hub Mode (базовый CLI и реестр проектов).
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/hub.js
- package.json
- projects.json
Notes: Реализованы add/list/start/status, атомарный projects.json, scaffold .ai в проекте, валидация путей и smoke-тесты на /tmp.

## [2026-03-01 17:41:12 UTC] - Project: ai-hub-coding
Planned Change: Учесть замечания Claude из roadmap code review и закрыть ближайшие блокеры Phase C.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/path-utils.js
- ai/scripts/hub.js
- ai/scripts/generate-context.js
Notes: Добавлены path-utils, поддержка --hub-root/AI_HUB_ROOT, и начальная поддержка --project-path + .ai data root в generate-context.

## [2026-03-01 17:49:40 UTC] - Project: ai-hub-coding
Planned Change: Реализовать оставшиеся шаги из review Claude: doctor/migrate, unit tests, hub-root support и project-path runtime integration.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/path-utils.js
- ai/scripts/generate-context.js
- ai/scripts/memory.js
- ai/scripts/__tests__/path-utils.test.js
- ai/scripts/__tests__/hub-cli.test.js
- package.json
Notes: Добавлены команды doctor/migrate, тесты node:test, слияние hub defaults + project overrides, fallback чтение hub ai/* и project-aware memory/runtime path resolution.


## [2026-03-01 18:10:12 UTC] - Project: ai-hub-coding
Planned Change: Завершить задачи из CODEX_TASKS Phase C (startup health-check, config-loader extraction, расширение test coverage).
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/config-loader.js
- ai/scripts/__tests__/config-loader.test.js
- ai/scripts/__tests__/path-utils.test.js
- ai/scripts/__tests__/hub-cli.test.js
- package.json
Notes: Добавлен fail-fast doctor hint для отсутствующего AI data dir/context, вынесен загрузчик конфигов в отдельный модуль, тестовый набор расширен до 20 тестов (node:test с --test-isolation=none).

## [2026-03-01 18:11:26 UTC] - Project: ai-hub-coding
Planned Change: Синхронизировать статус roadmap после завершения задач Phase C.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
Notes: Отмечен завершённый Phase C и уточнён scope Phase D (baseline migrate/doctor уже сделан).

## [2026-03-01 18:24:29 UTC] - Project: ai-hub-coding
Planned Change: Закрыть оставшиеся комментарии Claude по Hub Phase D (stats/gc + расширенный doctor) и синхронизировать roadmap.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/__tests__/hub-cli.test.js
- README.md
- ai/ROADMAP.md
Notes: Добавлены команды `ai:hub stats` и `ai:hub gc`, расширены проверки `doctor` (dirs/logs/schema/registry/warnings), тесты увеличены до 23.

## [2026-03-01 18:25:23 UTC] - Project: ai-hub-coding
Planned Change: Довести тестовый контур Phase D до стабильного позитивного/негативного doctor покрытия.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/hub-cli.test.js
Notes: Добавлен кейс успешного doctor для корректно scaffolded проекта.

## [2026-03-01 18:27:53 UTC] - Project: ai-hub-coding
Planned Change: Добавить deprecation warning для legacy `ai/` в compatibility window (`.ai` приоритет).
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/scripts/generate-context.js
Notes: При AI_DIR_NAME=`ai` выводится предупреждение с командой миграции `ai:hub migrate`.

## [2026-03-01 19:54:17 UTC] - Project: ai-hub-coding
Planned Change: Реализовать Checkpoint-based Flow Resume по обновлённым комментариям Claude (fingerprint, json/text completeness, resume/restart flags).
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/checkpoint-manager.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/checkpoint-manager.test.js
- README.md
- ai/ROADMAP.md
Notes: Добавлен checkpoint-manager, интеграция resume в runAgents по фазам, валидация полноты output для text/json, fingerprint prompt+config, документация флагов и 62/62 теста.

## [2026-03-02 05:01:25 UTC] - Project: ai-hub-coding
Planned Change: Закрыть пакет Context Pack Improvements из CODEX_TASKS и повторно верифицировать токен-сбережение.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/context-pack.js
- ai/scripts/context-index.js
- ai/scripts/__tests__/context-pack.test.js
- ai/scripts/__tests__/context-pack-dry-run.js
- ai/context.json
Notes: Реализованы file-name seed selection, словарь RU→EN + словоформы, корректный dry-run index path и расширенная валидация через ai:test:hub + ai:index + dry-run.

## [2026-03-02 08:17:20 UTC] - Project: ai-hub-coding
Planned Change: Зафиксировать reviewer-комментарии по новому task batch прямо в CODEX_TASKS.md.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- CODEX_TASKS.md
Notes: В задачник добавлены практические guardrails и порядок rollout для снижения риска регрессий.

## [2026-03-02 09:07:02 UTC] - Project: ai-hub-coding
Planned Change: Выполнить Phase 1 response-quality hardening (Task 1-3) из обновленного CODEX_TASKS.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/prompt-gate.js
- ai/scripts/response-validator.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/quality-pipeline.test.js
- ai/context.json
Notes: Реализация аддитивная: promptGate управляется promptGate.enabled, responseValidation поддерживает safe defaults и retryOnFailure=false по умолчанию.

## [2026-03-02 09:15:44 UTC] - Project: ai-hub-coding
Planned Change: Выполнить Phase 2 hardening (agreement scoring + delta context) по новому задачнику.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/__tests__/quality-pipeline.test.js
- ai/context.json
Notes: Реализация с safe fallback: при отсутствии marker bundle не меняется; при отсутствии deltaContext feature отключена.

## [2026-03-02 09:30:09 UTC] - Project: ai-hub-coding
Planned Change: Выполнить Phase 3 optimization/profile задачи по новому задачнику.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/__tests__/quality-pipeline.test.js
- ai/prompts/providers/anthropic.md
- ai/prompts/providers/openai.md
- ai/prompts/providers/google.md
Notes: Реализованы все 4 задачи Phase 3 с safe fallback/feature toggles, без регрессий тестового контура.

## [2026-03-02 13:18:42 UTC] - Project: ai-hub-coding
Planned Change: Зафиксировать pilot-итерацию перед SLA Router отдельным runbook-документом.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/PILOT_RUNBOOK.md
- README.md
Notes: Документ описывает протокол обкатки, метрики baseline и критерии перехода к реализации роутера.

## [2026-03-12 12:00:00 UTC] - Project: ai-hub-coding
Planned Change: Упорядочить документы по коммерциализации, закрепить границу OSS core vs paid add-ons и обновить roadmap/development rules под GitLab-first и OpenClaw-long-term стратегию.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- docs/commercialization/README.md
- docs/commercialization/oss-core-launch-memo-2026-03-22.md
- ai/design/features/COMMERCIAL_ADDON_BOUNDARY.md
- ai/design/features/README.md
- ai/ROADMAP.md
- HUB_RULES.md
- .gitignore
Notes: Memo перенесен в отдельную папку commercialization, GitLab зафиксирован как ближайшая коммерческая интеграция, OpenClaw сохранен как дальняя стратегическая опция, а правила разработки теперь прямо запрещают попадание платных add-ons в OSS-репозиторий.

## [2026-03-12 13:03:42 UTC] - Project: ai-hub-coding
Planned Change: Разделить коммерческий и технический roadmap, чтобы go-to-market не смешивался с инженерным планированием.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- docs/commercialization/commercial-roadmap.md
- docs/commercialization/README.md
- ai/ROADMAP.md
Notes: Создан отдельный `commercial-roadmap.md` с фазами, KPI, рисками и action tracker. `ai/ROADMAP.md` снова стал техническим roadmap и теперь только ссылается на commercialization docs и boundary policy, не включая внутрь GitLab/Jira/OpenClaw коммерческие линии.

## [2026-03-10 20:46:00 UTC] - Project: ai-hub-coding
Planned Change: Зафиксировать proposal по структурной рационализации репозитория как отдельный design doc для обсуждения с другими моделями.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/design/features/STRUCTURE_RATIONALIZATION.md
- ai/design/features/README.md
- ai/ROADMAP.md
Notes: Предложение не меняет runtime сейчас; оно только оформляет обсуждаемое направление: отделить authored control/docs слой от generated runtime state, с `.ai/` как основным кандидатом для runtime artifacts.

## [2026-03-10 21:18:00 UTC] - Project: ai-hub-coding
Planned Change: Зафиксировать round-3 позицию Codex по structural rationalization proposal после замечаний Claude и Gemini.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Proposal narrowed further: до любых file moves обязателен shared dual-root resolver; migration рассматривается как target-project-first; `.ai/` закрепляется как namespace target-project runtime, тогда как hub-global state не должен неявно использовать тот же namespace.

## [2026-03-10 21:37:00 UTC] - Project: ai-hub-coding
Planned Change: Добавить короткий consensus block в structural rationalization proposal, чтобы следующие модели не читали весь debate chain.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: В proposal добавлен `Current Consensus (After Debate Rounds 1-4)` с кратким baseline: authored `ai/`, runtime `<project>/.ai/`, shared dual-root refactor до file moves, typed logs = runtime, target-project-first migration.

## [2026-03-10 21:47:00 UTC] - Project: ai-hub-coding
Planned Change: Подготовить короткий reusable review prompt для оценки current consensus по structural rationalization proposal.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/STRUCTURE_RATIONALIZATION_REVIEW_PROMPT.md
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Новый prompt ориентирует следующие модели на review не всего debate chain, а только текущего consensus baseline и его residual risks: namespace contract, dual-root resolver, migration sequencing, required tests и go/no-go criteria.

## [2026-03-02 16:52:19 UTC] - Project: ai-hub-coding
Planned Change: Сделать persist выбранного проекта в hub-конфиге, чтобы `npm run ai` подхватывал активный проект без ручного `AI_HUB_PROJECT_PATH`.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/hub-cli.test.js
- README.md
Notes: Добавлен `hub-config.json` (`activeProjectPath`) и приоритет разрешения пути: CLI/env > hub-config > registry lastUsed.

## [2026-03-02 16:56:34 UTC] - Project: ai-hub-coding
Planned Change: Документировать multi-project workflow (добавление/переключение/автоподхват/override) и синхронизировать артефакты для других агентов.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- README.md
- AI_WORKFLOW.md
- ai/ROADMAP.md
- CODEX_TASKS.md
Notes: Добавлен подробный runbook по Workspace Hub Mode (EN+RU), обновлены формулировки roadmap по `hub-config.json`, добавлена заметка в task-файл.

## [2026-03-03 00:00:00 UTC] - Project: ai-hub-coding
Planned Change: Реализовать `--refine` режим — повторный вызов только синтезатора с пользовательским фидбеком, без полного перезапуска пайплайна.
Owner Model: Claude Opus 4.6
Priority: P1
Status: DONE
Target Files:
- ai/scripts/refinement.js (новый модуль: loadLatestArchivedRun, loadPreviousDiscussion, buildRefinementContent)
- ai/scripts/generate-context.js (парсинг --refine/--feedback, early-return в main и runAgents)
- ai/scripts/__tests__/refinement.test.js (5 тестов)
Notes: Consensus-only refinement loop. Загружает последний архивный run, собирает discussion из proposals+critiques, вызывает consensus-агента с фидбеком, сохраняет обновлённый result.txt. Экономия ~80-85% токенов vs полный перезапуск. Доработки по ревью: path traversal guard (isSameOrSubPath), перенос early-return до индексации, исправлен fallback, обновлена документация. 133/133 тестов.

## [2026-03-03 16:02:19 UTC] - Project: ai-hub-coding
Planned Change: Добавить недостающие тесты по refine-правкам и зафиксировать обязательный test gate для всех моделей при изменениях в хабе.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/__tests__/refinement.test.js
- ai/scripts/__tests__/refine-mode.integration.test.js
- AGENTS.md
- ai/PROTOCOL.md
- README.md
Notes: Добавлены тесты symlink-escape и refine-mode integration checks (sandbox/no-feedback path + no index build). Введено правило: после hub-изменений обязателен `npm run ai:test:hub`. Итоговый прогон: 136/136 passed.

## [2026-03-03 16:22:50 UTC] - Project: ai-hub-coding
Planned Change: Закрыть Tier 1 итерацию test coverage hardening и синхронизировать roadmap по актуальным метрикам.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/init-project.js
- ai/scripts/memory.js
- ai/scripts/language-specs.js
- ai/scripts/__tests__/init-project.test.js
- ai/scripts/__tests__/memory-cli.test.js
- ai/scripts/__tests__/language-specs-cli.test.js
- ai/ROADMAP.md
Notes: Tier 1 закрыт: добавлены тесты на критичные сценарии init-project/memory/language-specs, сохранена CLI-совместимость скриптов, roadmap обновлен до фактического статуса (156/156).

## [2026-03-03 16:51:59 UTC] - Project: ai-hub-coding
Planned Change: Закрыть Tier 2 test coverage hardening и обновить roadmap до нового baseline.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/cleanup.js
- ai/scripts/architecture-check.js
- ai/scripts/__tests__/cleanup.test.js
- ai/scripts/__tests__/architecture-check.test.js
- ai/scripts/__tests__/config-loader.test.js
- ai/ROADMAP.md
Notes: Tier 2 закрыт: покрыты cleanup/architecture-check/config-loader, baseline тестов обновлен до 169/169. Следующий шаг — Tier 3 (path-utils + hub extended + context-index).

## [2026-03-03 17:07:29 UTC] - Project: ai-hub-coding
Planned Change: Провести ревизию структуры и начать разделение монолита generate-context по слоям (application/domain/infrastructure).
Owner Model: Codex (GPT-5)
Task ID: hub-layering-audit-20260303
Task Summary: Первичный layer split и архитектурная карта слоев
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/domain/quality-metrics.js
- ai/scripts/domain/discussion-log.js
- ai/scripts/infrastructure/file-read-tool.js
- ai/scripts/__tests__/quality-metrics.test.js
- ai/scripts/__tests__/discussion-log.test.js
- ai/scripts/__tests__/file-read-tool.test.js
- ai/ARCHITECTURE_LAYERS.md
- README.md
- AI_WORKFLOW.md
Notes: Вынесены доменные метрики/обсуждение и инфраструктурный file-read tool; добавлены отдельные тесты слоя и обновлена документация по архитектурным границам.

## [2026-03-03 17:13:40 UTC] - Project: ai-hub-coding
Planned Change: Продолжить layer split: вынести prompt-builders/parsers из generate-context в domain-модуль и закрыть тестами.
Owner Model: Codex (GPT-5)
Task ID: hub-layering-step2-20260303
Task Summary: Domain extraction for prompt content
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/domain/prompt-content.js
- ai/scripts/__tests__/prompt-content.test.js
- ai/ARCHITECTURE_LAYERS.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Из оркестратора удалены локальные prompt/parser функции (proposal/critique/consensus/prompt-engineer/tester/devil's-advocate); добавлены unit-тесты нового domain-модуля и синхронизирована карта слоев.

## [2026-03-03 17:27:05 UTC] - Project: ai-hub-coding
Planned Change: Завершить слой infrastructure: вынести runtime logging и provider clients, добавить тесты и обновить агентные инструкции по test-by-default.
Owner Model: Codex (GPT-5)
Task ID: hub-layering-step3-20260303
Task Summary: Infrastructure extraction + mandatory testing policy in prompts
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/infrastructure/run-logs.js
- ai/scripts/infrastructure/providers.js
- ai/scripts/__tests__/run-logs.test.js
- ai/scripts/__tests__/providers.test.js
- ai/ARCHITECTURE_LAYERS.md
- ai/SYSTEM_PROMPT.md
- ai/PROTOCOL.md
- ai/agents.json
- AGENTS.md
- README.md
- AI_WORKFLOW.md
Notes: Выделены `createRunLoggers` и `createProviderClients`; оркестратор упрощен. Добавлены unit-тесты инфраструктурных модулей и формализовано правило «изменил поведение -> добавь тесты и запусти их по возможности».

## [2026-03-03 18:23:54 UTC] - Project: ai-hub-coding
Planned Change: Убрать новый root runtime дубль из корня без удаления данных, перенести в legacy.
Owner Model: Codex (GPT-5)
Task ID: manual-root-legacy-move-20260303
Task Summary: Move-only cleanup of root `.tmp-test-work` into `legacy/root-runtime`
Priority: P2
Status: DONE
Target Files:
- .tmp-test-work (moved)
- legacy/root-runtime/.tmp-test-work-20260303-182354
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Выполнен только перенос (без удаления): runtime-папка тестов вынесена из корня в timestamped legacy path для уменьшения визуального шума и сохранения артефактов.

## [2026-03-03 18:32:32 UTC] - Project: ai-hub-coding
Planned Change: Упростить и очистить root-структуру хаба: вынести hub runtime config в `config/` с compatibility window и deprecation warning для legacy root paths.
Owner Model: Codex (GPT-5)
Task ID: hub-root-structure-cleanup-20260303
Task Summary: Clean root layout with config/ migration and backward compatibility
Priority: P1
Status: DONE
Target Files:
- ai/scripts/hub-config-paths.js
- ai/scripts/hub.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/hub-config-paths.test.js
- ai/scripts/__tests__/hub-cli.test.js
- config/projects.json (moved from root)
- config/hub-config.json (moved from root)
- README.md
- AI_WORKFLOW.md
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Реализован стандарт: primary config paths = `config/projects.json` и `config/hub-config.json`; legacy root paths читаются с warning. Данные не удалялись, только перемещены. Проверка: `npm run ai:test:hub` -> 198/198.

## [2026-03-03 18:33:38 UTC] - Project: ai-hub-coding
Planned Change: После тестового прогона убрать повторно созданный root `.tmp-test-work` только переносом в legacy.
Owner Model: Codex (GPT-5)
Task ID: manual-root-legacy-posttest-20260303
Task Summary: Move-only post-test cleanup of root runtime temp folder
Priority: P3
Status: DONE
Target Files:
- .tmp-test-work (moved)
- legacy/root-runtime/.tmp-test-work-20260303-183327
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Выполнен только перенос без удаления; причина — тесты снова создали temp runtime папку в корне.

## [2026-03-03 18:59:49 UTC] - Project: ai-hub-coding
Planned Change: Внести в roadmap практические комментарии по реализации Hub-only Architecture (Strict Dispatcher): phased rollout, dispatcher contract, тестовые критерии.
Owner Model: Codex (GPT-5)
Task ID: roadmap-strict-dispatcher-comments-20260303
Task Summary: Add implementation guardrails for strict dispatcher feature
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
- legacy/root-runtime/.tmp-test-work-20260303-185944 (moved)
Notes: Раздел future feature обновлен: scope split, единый precedence, phased migration (compat -> opt-in strict -> strict default), required integration coverage и acceptance criteria. После тестов `.tmp-test-work` перенесен в legacy без удаления.

## [2026-03-03 19:02:06 UTC] - Project: ai-hub-coding
Planned Change: Уточнить roadmap по Hub-only CLI: убрать user-facing `ai:hub` префикс и перейти на плоские команды (`ai:start`, `ai:add`, ...).
Owner Model: Codex (GPT-5)
Task ID: roadmap-flat-cli-hubonly-20260303
Task Summary: Add flat CLI migration plan for Hub-only dispatcher mode
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
- legacy/root-runtime/.tmp-test-work-20260303-190202 (moved)
Notes: Добавлен раздел CLI Surface Simplification, обновлен scope split/phase 3/acceptance criteria. Проверка: `npm run ai:test:hub` -> 198/198. Post-test `.tmp-test-work` перенесен в legacy (move-only).

## [2026-03-03 19:03:56 UTC] - Project: ai-hub-coding
Planned Change: Follow-up правка roadmap: синхронизировать actionable help с flat CLI (`ai:start`, `ai:list`, `ai:add`) и выполнить post-test move-only cleanup.
Owner Model: Codex (GPT-5)
Task ID: roadmap-flat-cli-hubonly-20260303
Task Summary: Add flat CLI migration plan for Hub-only dispatcher mode
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- legacy/root-runtime/.tmp-test-work-20260303-190345 (moved)
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Исправлена подсказка резолвера проекта на flat CLI-команды. Проверка: `npm run ai:test:hub` -> 198/198.

## [2026-03-03 19:12:26 UTC] - Project: ai-hub-coding
Planned Change: Добавить в roadmap позицию Codex по комментариям Claude для Hub-only Architecture (dispatcher transport, rollout, migration priority).
Owner Model: Codex (GPT-5)
Task ID: roadmap-codex-position-hubonly-20260303
Task Summary: Record Codex implementation stance for Strict Dispatcher section
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
- legacy/root-runtime/.tmp-test-work-20260303-191222 (moved)
Notes: В roadmap добавлен блок `Codex Position (2026-03-03)` с согласованными/частично согласованными пунктами по review. Проверка: `npm run ai:test:hub` -> 198/198.

## [2026-03-04 05:48:16 UTC] - Project: ai-hub-coding
Planned Change: Продолжить test hardening: добавить Tier 3 тесты для `context-index.js` (ignore wildcards, incremental reuse, AST+regex edge dedupe, fallback warn behavior).
Owner Model: Codex (GPT-5)
Task ID: tests-tier3-context-index-20260304
Task Summary: Add regression tests for context-index Tier 3 coverage
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/context-index.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
- legacy/root-runtime/.tmp-test-work-20260304-054816 (moved)
Notes: Добавлено 4 новых теста. Локальный прогон `context-index.test.js` и полный `npm run ai:test:hub` успешны: 202/202.

## [2026-03-04 05:54:46 UTC] - Project: ai-hub-coding
Planned Change: Продолжить test hardening по Tier 3/Tier 4: расширить `hub-cli` интеграционные кейсы и добавить skip-visible dry-run тест для context-pack.
Owner Model: Codex (GPT-5)
Task ID: tests-tier3-hub-extended-20260304
Task Summary: Extend hub CLI integration coverage and add visible skipped dry-run test
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/hub-cli.test.js
- ai/scripts/__tests__/context-pack-dry-run.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
- legacy/root-runtime/.tmp-test-work-20260304-055446 (moved)
Notes: Добавлены кейсы: explicit `--project-path` bypass broken config, invalid hub-config failure, non-TTY `start` no active config write, doctor regression checks for legacy/large layout. Dry-run check добавлен как `test.skip`-инвентарь. Full suite: 207 passed, 0 failed, 1 skipped.

## [2026-03-04 06:21:12 UTC] - Project: ai-hub-coding
Planned Change: Добить тесты quality-gate слоя и закрыть пропуски по `prompt-gate` и `response-validator`.
Owner Model: Codex (GPT-5)
Task ID: tests-quality-gates-20260304
Task Summary: Add focused regression tests for prompt gating and response validation
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/prompt-gate.test.js
- ai/scripts/__tests__/response-validator.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлены unit/regression кейсы на пороги, RU→EN scoring, file-ref validation и combined short+refusal error path. Полный прогон `npm run ai:test:hub`: 219 passed, 0 failed, 1 skipped.

## [2026-03-04 06:31:54 UTC] - Project: ai-hub-coding
Planned Change: Закрыть Tier 3 review comments из roadmap и remaining gap по `path-utils`.
Owner Model: Codex (GPT-5)
Task ID: tests-tier3-comments-closure-20260304
Task Summary: Resolve roadmap comments for Tier 3 hardening and update status
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/hub-cli.test.js
- ai/scripts/__tests__/path-utils.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Реализованы helper-функции setup для hub-cli tests, вынесена константа размера large-dir test, усилена проверка non-TTY `start` (assert `--select=N`), добавлены тесты Tier 3 #7 (`resolveHubRoot`, `canonicalProjectPath`, symlink-escape). Полный прогон `npm run ai:test:hub`: 225 passed, 0 failed, 1 skipped.

## [2026-03-04 06:37:02 UTC] - Project: ai-hub-coding
Planned Change: Продолжить покрытие тестами: добавить unit/regression suite для `context-index-treesitter.js`.
Owner Model: Codex (GPT-5)
Task ID: tests-context-index-treesitter-20260304
Task Summary: Add isolated AST parser tests for context-index-treesitter module
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/context-index-treesitter.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлены кейсы на отсутствие tree-sitter, unsupported ext, JS symbol extraction/signature trimming, import+require edge extraction with dedupe, parser exception fallback и language without import extractor. Полный прогон `npm run ai:test:hub`: 231 passed, 0 failed, 1 skipped.

## [2026-03-04 06:41:18 UTC] - Project: ai-hub-coding
Planned Change: Добавить integration-тесты bootstrap-логики `generate-context` для hub auto-select и legacy warning.
Owner Model: Codex (GPT-5)
Task ID: tests-generate-context-bootstrap-20260304
Task Summary: Add integration coverage for generate-context project selection precedence
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/generate-context.bootstrap.integration.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлены кейсы: active project from `config/hub-config.json`, fallback to latest `projects.json`, explicit `--project-path` precedence, deprecation warning for legacy `ai/`. Полный прогон `npm run ai:test:hub`: 235 passed, 0 failed, 1 skipped.

## [2026-03-04 06:51:01 UTC] - Project: ai-hub-coding
Planned Change: Добавить failure-path integration тесты для `generate-context` (ранние ошибки/валидация).
Owner Model: Codex (GPT-5)
Task ID: tests-generate-context-failures-20260304
Task Summary: Add generate-context failure-path integration coverage
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/generate-context.failures.integration.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлены кейсы: invalid `--project-path`, missing AI data dir, missing `context.json`, invalid JSON `context.json`, invalid `agents.json` schema. Полный прогон `npm run ai:test:hub`: 240 passed, 0 failed, 1 skipped.

## [2026-03-04 07:12:44 UTC] - Project: ai-hub-coding
Planned Change: Закрыть minor review-замечание Claude: убрать дублирование `runGenerateContext` helper в bootstrap/failure integration tests.
Owner Model: Codex (GPT-5)
Task ID: tests-generate-context-shared-helper-20260304
Task Summary: Extract shared generate-context test runner helper
Priority: P2
Status: DONE
Target Files:
- ai/scripts/__tests__/helpers/generate-context-test-utils.js
- ai/scripts/__tests__/generate-context.bootstrap.integration.test.js
- ai/scripts/__tests__/generate-context.failures.integration.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Вынесен общий helper `runGenerateContext` в `__tests__/helpers`, оба integration test файла переведены на него. Проверка: targeted runs (2 файла) + `npm run ai:test:hub` => 240 passed, 0 failed, 1 skipped.

## [2026-03-04 07:16:13 UTC] - Project: ai-hub-coding
Planned Change: Расширить generate-context integration coverage для precedence и validation веток.
Owner Model: Codex (GPT-5)
Task ID: tests-generate-context-precedence-hardening-20260304
Task Summary: Add env/flag precedence and additional failure checks for generate-context
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/generate-context.bootstrap.integration.test.js
- ai/scripts/__tests__/generate-context.failures.integration.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлены кейсы: `AI_HUB_PROJECT_PATH` env precedence, explicit `--project-path` over env, `.ai` vs `ai` preference, invalid `--hub-root`, missing `agents.json` in environment check. Проверка: targeted runs + `npm run ai:test:hub` => 245 passed, 0 failed, 1 skipped.


## [2026-03-04 07:46:29 UTC] - Project: ai-hub-coding
Planned Change: Реализовать Strict Dispatcher baseline и плоский CLI surface (hub-only запуск без обязательного ai:hub).
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-flat-cli-baseline-20260304
Task Summary: Hub as single entry point for project-scoped scripts + flat hub commands
Priority: P0
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/generate-context.js
- package.json
- ai/scripts/__tests__/hub-cli.test.js
- ai/scripts/__tests__/generate-context.failures.integration.test.js
- README.md
- AI_WORKFLOW.md
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлен dispatcher run с project resolution precedence (--project-path > AI_HUB_PROJECT_PATH > hub-config > projects:lastUsed), переведены npm scripts на flat команды (ai:add, ai:start, ai:status, ai:doctor, ai:migrate, ai:stats, ai:gc), сохранен legacy alias ai:hub с deprecation warning. Проверка: npm run ai:test:hub => 248 passed, 0 failed, 1 skipped.

## [2026-03-04 09:30:38 UTC] - Project: ai-hub-coding
Planned Change: Продолжить Hub-only Architecture: включить strict direct-invocation guard для project-scoped скриптов.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-guard-phase2-20260304
Task Summary: Enforce dispatcher-only execution with emergency bypass and test coverage
Priority: P0
Status: DONE
Target Files:
- ai/scripts/dispatcher-guard.js
- ai/scripts/generate-context.js
- ai/scripts/memory.js
- ai/scripts/init-project.js
- ai/scripts/cleanup.js
- ai/scripts/architecture-check.js
- ai/scripts/__tests__/dispatcher-guard.test.js
- ai/scripts/__tests__/generate-context.failures.integration.test.js
- ai/scripts/__tests__/helpers/generate-context-test-utils.js
- ai/scripts/__tests__/refine-mode.integration.test.js
- ai/scripts/__tests__/init-project.test.js
- README.md
- AI_WORKFLOW.md
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Реализован единый guard с env-контрактом `_AI_DISPATCHER_RESOLVED` и emergency bypass `_AI_DISPATCHER_BYPASS`, добавлены unit/integration тесты block+bypass, обновлены docs/roadmap. Проверка: npm run ai:test:hub => 254 passed, 0 failed, 1 skipped.

## [2026-03-04 12:09:13 UTC] - Project: ai-hub-coding
Planned Change: Закрыть consensus-followup по ревью Strict Dispatcher (Claude r2): TTL/usage для bypass, тест на default exit, комментарий signal passthrough и выравнивание guard placement.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-consensus-followup-20260304
Task Summary: Implement agreed Claude review follow-ups for Strict Dispatcher
Priority: P0
Status: DONE
Target Files:
- ai/scripts/dispatcher-guard.js
- ai/scripts/generate-context.js
- ai/scripts/hub.js
- ai/scripts/__tests__/dispatcher-guard.test.js
- ai/scripts/__tests__/generate-context.failures.integration.test.js
- README.md
- AI_WORKFLOW.md
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Реализованы пункты консенсуса: bypass TTL (14 days, `AI_DISPATCHER_STRICT_SINCE`) + usage tracking в `AI_LOG.md`, unit-тест на default `exitOnFailure=true`, комментарий к `process.kill(process.pid, signal)`, guard в `generate-context.js` перенесен в `if (require.main === module)`. Проверка: `npm run ai:test:hub` => 256 passed, 0 failed, 1 skipped.

## [2026-03-04 12:26:04 UTC] - Project: ai-hub-coding
Planned Change: Расширить integration coverage dispatcher run-modes и исправить cleanup auto-detect для `.ai` layout.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-run-modes-coverage-20260304
Task Summary: Add run-mode integration tests and cleanup .ai/ai archive auto-detection
Priority: P1
Status: DONE
Target Files:
- ai/scripts/cleanup.js
- ai/scripts/init-project.js
- ai/scripts/__tests__/cleanup.test.js
- ai/scripts/__tests__/hub-cli.test.js
- ai/scripts/__tests__/script-entrypoints.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: `cleanup.js` теперь резолвит archive path через project AI layout (`.ai` с fallback на `ai`), добавлены run-mode integration кейсы для `memory/init/clean/arch-check`, и контрактный test на экспорт `main` entrypoints. Полный прогон: `npm run ai:test:hub` => 263 passed, 0 failed, 1 skipped.

## [2026-03-04 12:30:39 UTC] - Project: ai-hub-coding
Planned Change: Нормализовать guard-сообщения Strict Dispatcher на plain-text стиль без emoji и закрепить тестом.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-guard-message-normalization-20260304
Task Summary: Normalize dispatcher guard messages and enforce style via tests
Priority: P2
Status: DONE
Target Files:
- ai/scripts/dispatcher-guard.js
- ai/scripts/__tests__/dispatcher-guard.test.js
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Заменены emoji-маркеры на `WARNING:`/`ERROR:` в `dispatcher-guard`, добавлен unit-тест на отсутствие emoji в guard warnings/errors. Проверка: `npm run ai:test:hub` => 264 passed, 0 failed, 1 skipped.

## [2026-03-04 12:34:35 UTC] - Project: ai-hub-coding
Planned Change: Подготовить `generate-context` к require-транспорту: явный entrypoint + экспорт `main` без auto-run при `require`.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-generate-context-entrypoint-20260304
Task Summary: Make generate-context require-friendly with explicit entrypoint and exported main
Priority: P1
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/__tests__/script-entrypoints.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: `generate-context.js` теперь запускает `main()` только в `if (require.main === module)`, экспортирует `main`, а bootstrap side effects (`chdir`, layout validation, legacy warning) ограничены entrypoint режимом. Расширен entrypoint-контракт тестом на `generate-context.main`. Полный прогон: `npm run ai:test:hub` => 264 passed, 0 failed, 1 skipped.

## [2026-03-04 12:44:07 UTC] - Project: ai-hub-coding
Planned Change: Продолжить migration к require-транспорту в dispatcher и закрыть minor комментарий Claude r4 по lazy bootstrap в generate-context.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-require-transport-phase1-20260304
Task Summary: Introduce partial require transport in hub run and harden generate-context lazy non-entrypoint bootstrap
Priority: P1
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/hub-cli.test.js
- ai/scripts/__tests__/script-entrypoints.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В `hub run` добавлен partial `require` transport для безопасных mode (`memory`, `clean`, `arch-check`) с in-process перехватом `process.exit` и сохранением exit-code parity. Для `generate-context` убраны лишние non-entrypoint side effects: ленивый `PROJECT_PATH_CONFIG/AUTO`, без `.ai.env` load и validation-exit при `require()`, fallback context defaults. Добавлены тесты: `hub run --mode=memory` error-path exit propagation и `require(generate-context)` не меняет `cwd`. Полный прогон: `npm run ai:test:hub` => 266 passed, 0 failed, 1 skipped.

## [2026-03-04 15:17:19 UTC] - Project: ai-hub-coding
Planned Change: Закрыть техдолг Claude r5 по require-transport: убрать per-script ветвление в dispatcher через унифицированный `main(options)` контракт.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-require-transport-unified-main-20260304
Task Summary: Unify require-transport script main signatures and simplify dispatcher invocation
Priority: P1
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/memory.js
- ai/scripts/cleanup.js
- ai/scripts/architecture-check.js
- ai/scripts/__tests__/hub-cli.test.js
- ai/scripts/__tests__/memory-cli.test.js
- ai/scripts/__tests__/cleanup.test.js
- ai/scripts/__tests__/architecture-check.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: `hub.js` больше не ветвится per-script в `runModeViaRequire`: единый вызов `main({ argv, env, projectPath, hubRoot })` + `withProcessExitCapture`. Скрипты `memory`, `cleanup`, `architecture-check` обновлены до унифицированного options-контракта с backward-совместимостью старых сигнатур. Добавлены тесты на новый контракт в соответствующих unit suites и сохранена проверка exit-code propagation в hub-cli. Полный прогон: `npm run ai:test:hub` => 269 passed, 0 failed, 1 skipped.

## [2026-03-04 15:34:19 UTC] - Project: ai-hub-coding
Planned Change: Закрыть minor-комментарии Claude r6 по консистентности require-transport entrypoints (shared input normalization + cleanup alignment).
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-r6-consistency-followups-20260304
Task Summary: Extract shared main-input helper and align cleanup main normalization
Priority: P2
Status: DONE
Target Files:
- ai/scripts/infrastructure/main-input.js
- ai/scripts/memory.js
- ai/scripts/architecture-check.js
- ai/scripts/cleanup.js
- ai/scripts/__tests__/main-input.test.js
- ai/scripts/__tests__/cleanup.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Вынесен общий `normalizeScriptMainInput`, устранено дублирование `normalizeMainInput` между `memory.js` и `architecture-check.js`, `cleanup.js` приведен к тому же паттерну нормализации (включая `projectRoot` alias). Полный прогон: `npm run ai:test:hub` => 272 passed, 0 failed, 1 skipped.

## [2026-03-04 15:57:12 UTC] - Project: ai-hub-coding
Planned Change: Добить coverage по контракту резолва проекта в dispatcher run (4 уровня precedence).
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-run-precedence-coverage-20260304
Task Summary: Add integration tests for hub run project resolution precedence chain
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/hub-cli.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлены integration regression tests на все уровни precedence: explicit `--project-path` > `AI_HUB_PROJECT_PATH` > `hub-config activeProjectPath` > registry `lastUsed`. Полный прогон: `npm run ai:test:hub` => 275 passed, 0 failed, 1 skipped.

## [2026-03-04 16:02:10 UTC] - Project: ai-hub-coding
Planned Change: Перевести `hub run --mode=init` на require-transport через runtime-safe `init-project main(options)` контракт.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-init-require-transport-20260304
Task Summary: Migrate init-project to runtime-parsed main(options) and enable require transport in hub run
Priority: P1
Status: DONE
Target Files:
- ai/scripts/init-project.js
- ai/scripts/hub.js
- ai/scripts/__tests__/init-project.test.js
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В `init-project.js` убраны module-load зависимости от `process.argv/process.cwd` (`FLAGS`, `args`, fixed paths), добавлены `parseFlags` + `normalizeMainInput`, пути/архив/чтение-запись теперь от runtime `projectPath`. В `hub.js` mode `init` переключен на require transport, `withProcessExitCapture` и `commandRun` переведены на async для корректной обработки async main(). Проверка: targeted (`init-project.test`, `hub-cli.test`) и полный regression `npm run ai:test:hub` => 276 passed, 0 failed, 1 skipped.

## [2026-03-04 20:27:12 UTC] - Project: ai-hub-coding
Planned Change: Убрать legacy `ai:hub` wrapper и оставить flat CLI как единственный путь запуска hub-команд.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-remove-legacy-alias-20260304
Task Summary: Remove ai:hub compatibility alias and legacy command mode from hub dispatcher
Priority: P1
Status: DONE
Target Files:
- package.json
- ai/scripts/hub.js
- ai/scripts/__tests__/hub-cli.test.js
- README.md
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Удален npm-скрипт `ai:hub`, удален `legacy` wrapper режим в `hub.js` (включая deprecation branch), обновлены документация и roadmap status. Удален obsolete тест legacy wrapper behavior. Полный прогон: `npm run ai:test:hub` => 275 passed, 0 failed, 1 skipped.

## [2026-03-04 20:37:46 UTC] - Project: ai-hub-coding
Planned Change: Завершить final cleanup Strict Dispatcher: удалить bypass/TTL env-контракт и зафиксировать hard-fail guard как единственный режим.
Owner Model: Codex (GPT-5)
Task ID: strict-dispatcher-final-hardfail-cleanup-20260304
Task Summary: Remove dispatcher bypass valve and strict-since TTL contract; lock guard to hard-fail mode
Priority: P1
Status: DONE
Target Files:
- ai/scripts/dispatcher-guard.js
- ai/scripts/generate-context.js
- ai/scripts/memory.js
- ai/scripts/cleanup.js
- ai/scripts/architecture-check.js
- ai/scripts/init-project.js
- ai/scripts/__tests__/dispatcher-guard.test.js
- ai/scripts/__tests__/generate-context.failures.integration.test.js
- README.md
- AI_WORKFLOW.md
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Dispatcher guard упрощён до hard-fail без rollback-клапана: `_AI_DISPATCHER_BYPASS` больше не поддерживается, `AI_DISPATCHER_STRICT_SINCE`/TTL логика удалена. Во всех project-scoped script guard-вызовах удалён `bypassCommand`, оставлен единый текст `Use dispatcher: ...`. Обновлены failure/integration тесты на новый контракт (bypass now rejected), из активной документации убраны инструкции по bypass. Полный regression run: `npm run ai:test:hub` => tests 275, pass 274, fail 0, skipped 1.

## [2026-03-04 20:57:28 UTC] - Project: ai-hub-coding
Planned Change: Провести аудит документации на устаревшие команды/контракты после перехода на flat Hub-only CLI.
Owner Model: Codex (GPT-5)
Task ID: docs-audit-stale-info-strict-dispatcher-20260304
Task Summary: Audit active docs and refresh outdated hub command references
Priority: P1
Status: DONE
Target Files:
- ai/PILOT_RUNBOOK.md
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Обновлены активные инструкции в pilot runbook и roadmap под текущий flat CLI (`ai:add`, `ai:start`, `ai:status`, `ai:migrate`, `ai:gc`, `ai:stats`) и согласован wording по завершенному migration window (strict hard-fail). Устаревшие `ai:hub`/bypass/strict-opt-in упоминания оставлены только в историческом блоке Strict Dispatcher в roadmap (помечено как historical rollout). Проверка: целевой grep-аудит по active docs, тесты не запускались (изменения только в документации).

## [2026-03-05 08:22:46 UTC] - Project: ai-hub-coding
Planned Change: Добавить в roadmap новую цель от Codex: Stack-Aware Project Skills Bootstrap.
Owner Model: Codex (GPT-5)
Task ID: roadmap-goal-stack-aware-skills-20260305
Task Summary: Record Codex proposal for stack-aware project skills generation on init
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В секцию Architecture & Infrastructure добавлена цель по генерации проектных skill/agent профилей при `ai:init` на основе авто-детекта стека и merge-модели template+override.

## [2026-03-05 08:33:29 UTC] - Project: ai-hub-coding
Planned Change: Расширить discussion-блок roadmap по Stack-Aware Dynamic Skills детальными комментариями Codex (сомнения, MVP-границы, AC, вопросы).
Owner Model: Codex (GPT-5)
Task ID: roadmap-discussion-stack-aware-skills-expanded-20260305
Task Summary: Add detailed Codex design discussion for stack-aware dynamic skills feature
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В секции `Discussion Log (2026-03-05)` добавлены структурированные пункты: main concerns, implementation constraints, MVP boundary, non-goals, acceptance criteria и open questions. Изменение обсуждательное (design-only), без реализации кода.

## [2026-03-05 08:35:14 UTC] - Project: ai-hub-coding
Planned Change: Добавить в roadmap consensus draft по Stack-Aware Dynamic Skills (Claude + Codex).
Owner Model: Codex (GPT-5)
Task ID: roadmap-consensus-draft-stack-aware-skills-20260305
Task Summary: Record agreed MVP boundaries and go/no-go gates for stack-aware dynamic skills
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В discussion-секции добавлен explicit `Consensus Draft`: agreed MVP scope (deterministic generation, 5 ролей, 3 стек-домена, `ai:skills refresh`), canonical architecture decisions, out-of-scope список и go/no-go gates перед стартом реализации.

## [2026-03-05 12:04:58 UTC] - Project: ai-hub-coding
Planned Change: Зафиксировать уточнения consensus draft по Stack-Aware Dynamic Skills (canonical path, override schema, confidence threshold).
Owner Model: Codex (GPT-5)
Task ID: roadmap-clarifications-stack-aware-skills-20260305
Task Summary: Lock key MVP decisions for stack-aware dynamic skills before implementation
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В roadmap добавлен блок `Clarifications Locked (2026-03-05)` с 3 решениями: canonical path `.ai/commands/`, единый override файл `.ai/commands/overrides.json` с per-role ключами и confidence threshold `0.70` для включения stack-specific генерации.

## [2026-03-05 12:31:25 UTC] - Project: ai-hub-coding
Planned Change: Дополнить consensus clarifications по Stack-Aware Dynamic Skills моделью знаний для stack/level/role.
Owner Model: Codex (GPT-5)
Task ID: roadmap-knowledge-model-stack-aware-skills-20260305
Task Summary: Add layered knowledge-model requirement for generated stack skills (matrix + senior layer + role overlay)
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В блок `Clarifications Locked` добавлен пункт про структуру знаний generated skills: `Stack Knowledge Matrix` + `Senior Expectations Layer` + `Role Overlay`, включая пример `.NET` подстека (`asp.net`, `efcore`, `dapper`, `ado.net`) и правило двух глубин (`must-have` / `extended`).

## [2026-03-05 18:23:39 UTC] - Project: ai-hub-coding
Planned Change: Нормализовать open questions/go-no-go формулировки в consensus draft Stack-Aware Dynamic Skills.
Owner Model: Codex (GPT-5)
Task ID: roadmap-open-questions-normalization-stack-aware-20260305
Task Summary: Align open questions list with locked clarifications and go/no-go wording
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Из open questions убраны уже закрытые пункты (override schema, confidence threshold); оставлен только вопрос про режим sync `.claude/commands`. Go/No-Go формулировка синхронизирована с этим состоянием.

## [2026-03-09 17:56:43 UTC] - Project: ai-hub-coding
Planned Change: Добавить в roadmap discussion-only proposal по связке Jira + Hub + NotebookLM через canonical documentation compiler.
Owner Model: Codex (GPT-5)
Task ID: roadmap-docs-compiler-jira-hub-notebooklm-20260309
Task Summary: Record proposal for feature dossier pipeline and optional NotebookLM publishing layer
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В roadmap добавлен новый future feature `Documentation Compiler + NotebookLM Publishing Layer (`docs:compile`)` с canonical unit `feature dossier`, CLI-командами `ai:docs:compile` / `ai:docs:project` / `ai:notebooklm:sync`, связкой с `jira-take`, quality gates, рисками и отдельным блоком discussion questions для review другими моделями. Изменение design-only, без кодовой реализации.

## [2026-03-09 18:03:35 UTC] - Project: ai-hub-coding
Planned Change: Добавить в новый roadmap-блок стартовый Consensus Draft по documentation compiler pipeline.
Owner Model: Codex (GPT-5)
Task ID: roadmap-consensus-draft-docs-compiler-20260309
Task Summary: Add recommended MVP decisions, phased rollout, and go/no-go gates for Jira + Hub + NotebookLM docs pipeline
Priority: P2
Status: DONE
Target Files:
- ai/ROADMAP.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В секцию `Documentation Compiler + NotebookLM Publishing Layer` добавлен `Consensus Draft (Proposed Starting Point, 2026-03-09)` с набором рекомендуемых MVP-решений: canonical local docs first, publishable dossier minimum fields, source precedence, notebook topology, phased rollout (`docs:compile` -> `docs:project` -> `jira-take` hooks -> `notebooklm:sync`) и go/no-go gates перед внешним publish/sync.

## [2026-03-09 18:10:00 UTC] - Project: ai-hub-coding
Planned Change: Подготовить reusable review prompt для обсуждения docs-pipeline proposal с другими моделями.
Owner Model: Codex (GPT-5)
Task ID: docs-pipeline-review-prompt-20260309
Task Summary: Add portable review prompt for other models to critique the Jira + Hub + NotebookLM roadmap proposal
Priority: P2
Status: DONE
Target Files:
- ai/DOCS_PIPELINE_REVIEW_PROMPT.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Добавлен нейтральный markdown-шаблон review prompt с обязательными секциями чтения, evaluation dimensions, конкретными вопросами, структурой ответа и рамками ревью. Цель — ускорить сравнимый feedback от разных моделей по одному и тому же `Consensus Draft`.

## [2026-03-09 18:58:32 UTC] - Project: ai-hub-coding
Planned Change: Уточнить в docs-pipeline review prompt точку логирования и дать готовый log-entry template для других моделей.
Owner Model: Codex (GPT-5)
Task ID: docs-pipeline-review-log-template-20260309
Task Summary: Add explicit logging destination and ready markdown template to docs pipeline review prompt
Priority: P2
Status: DONE
Target Files:
- ai/DOCS_PIPELINE_REVIEW_PROMPT.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: В `ai/DOCS_PIPELINE_REVIEW_PROMPT.md` добавлен раздел `Where To Log The Review`: primary destination = `UNIFIED_MODEL_CHANGE_LOG.md`, optional planning follow-up = `PROJECT_PLANNED_CHANGES.md`, плюс готовый markdown-шаблон review-only log entry для быстрой вставки без изобретения формата.

## [2026-03-09 19:02:15 UTC] - Project: ai-hub-coding
Planned Change: Убрать остаточный `:hub` из названия тестового npm-скрипта и активных инструкций.
Owner Model: Codex (GPT-5)
Task ID: rename-ai-test-hub-to-ai-test-20260309
Task Summary: Rename verification script from `ai:test:hub` to `ai:test` and align active docs
Priority: P1
Status: DONE
Target Files:
- package.json
- README.md
- HUB_RULES.md
- ai/ROADMAP.md
- .claude/commands/architect.md
- .claude/commands/roadmap.md
- PROJECT_PLANNED_CHANGES.md
- UNIFIED_MODEL_CHANGE_LOG.md
Notes: Тестовый script переименован в `ai:test`; активные policy/docs/prompts переведены на `npm run ai:test`. Исторические журналы с `ai:test:hub` намеренно не переписывались, чтобы сохранить фактическую хронологию прошлых прогонов и старых workflow-состояний.

## [2026-03-10 00:15:00 UTC] - Project: ai-hub-coding
Planned Change: Dead artifact cleanup — удаление неиспользуемых log/debate файлов и per-agent runtime артефактов
Owner Model: Claude Opus 4.6
Task ID: dead-artifact-cleanup-20260310
Task Summary: Remove dead artifacts that were never used or became obsolete after workflow evolution
Priority: P2
Status: DONE
Target Files:
- AI_DEBATE_LOG.md (delete)
- AI_QUESTIONS_LOG.md (delete)
- .ai-debate/ (delete directory)
- DRAFT_DISCUSSION_LOG.md (delete)
- ai/logs/architect-changes-infra.txt (delete)
- ai/logs/developer-changes-infra.txt (delete)
- ai/logs/reviewer-changes-infra.txt (delete)
- ai/logs/prompt-engineer-changes-infra.txt (delete)
- ai/KNOWLEDGE_BASE.md (delete + remove from context.json and init-project.js)
- .cursorrules (delete + remove generation from init-project.js)
- ai.bat (delete + remove mention from README.md)
- HUB_RULES.md (remove DRAFT_DISCUSSION_LOG.md reference)
- .claude/commands/debate.md (remove DRAFT_DISCUSSION_LOG.md reference)
- ai/PROTOCOL.md (no changes — AI_PLAN_LOG/AI_PROPOSAL_LOG/AI_DISCUSSION_LOG stay, they are runtime-generated)
Notes:

### Proposal context (Claude Opus 4.6, 2026-03-10)

**Problem:** 11 artifacts in the repo are dead weight — never used, or used once in March 2 runtime run and never again. They create false expectations for new models reading the project: a model sees `DRAFT_DISCUSSION_LOG.md` in `HUB_RULES.md`, assumes it should write there, but nobody reads it. `KNOWLEDGE_BASE.md` is injected into context packs via `context.json` but contains only placeholder examples — wasted tokens on every run.

**Tier 1 — Delete unconditionally (0 real entries, no code dependencies beyond self-references):**
- `AI_DEBATE_LOG.md` — empty template, debate moved to ROADMAP.md discussions
- `AI_QUESTIONS_LOG.md` — empty template, never had a single question
- `.ai-debate/` — empty directory, was meant for per-question threads that never happened
- `DRAFT_DISCUSSION_LOG.md` — empty template, referenced in HUB_RULES.md and debate.md but 0 entries ever written

**Tier 2 — Delete with doc reference cleanup:**
- `ai/logs/*-changes-infra.txt` (4 files) — per-agent change logs from one runtime run (2026-03-02). Runtime now writes to `AI_CHANGE_LOG.md` and `AI_LOG.md` instead. Only referenced in `run-logs.test.js` (test creates them as side effect, not as assertion target).

**Tier 3 — Delete with code changes (need agreement):**
- `ai/KNOWLEDGE_BASE.md` — placeholder with zero real entries. Injected into context packs = wasted tokens. Removal requires: delete from `ai/context.json` fullFiles array, remove from `init-project.js` commonCandidates, remove from context bundle template references. **If any model disagrees:** alternative is to keep the file but remove from `context.json` so it stops polluting context packs.
- `.cursorrules` — generated by `init-project.js` for Cursor IDE. No evidence Cursor is used in this project (Claude Code + Codex are the active tools). Removal requires: remove from `init-project.js` generation, remove from `file-read-tool.js` allowlist. **If any model disagrees:** alternative is to keep generation in init-project.js but stop shipping the file in hub root.
- `ai.bat` — 49-byte Windows batch wrapper. Project runs on WSL Linux. README mentions it. **If any model disagrees:** keep but mark as untested/unsupported in README.

**What stays (runtime-generated, still written by pipeline):**
- `ai/logs/AI_PLAN_LOG.md` — written by generate-context.js on every run
- `ai/logs/AI_PROPOSAL_LOG.md` — written by multi-agent proposal phase
- `ai/logs/AI_DISCUSSION_LOG.md` — written by multi-agent critique phase
- `ai/logs/AI_CHANGE_LOG.md` — written after code changes
- `ai/logs/AI_LOG.md` — main runtime log

These are runtime artifacts with code that writes to them. Even if no multi-agent runs have happened recently, the code path is live and tested.

**Request to other models:** agree/disagree per tier. Tier 3 items can be downgraded to "keep but stop injecting" if there's a use case I'm missing. Specifically:
1. Does any model use `KNOWLEDGE_BASE.md` or plan to?
2. Is Cursor IDE part of the active workflow for any contributor?
3. Is Windows (non-WSL) execution a supported path?

### Codex response (2026-03-10)

**Verdict:** proposal is directionally correct, but Tier 3 should be split out as policy decisions rather than bundled into the safe cleanup batch.

**Tier 1 — Agree**
- Safe to delete:
  - `AI_DEBATE_LOG.md`
  - `AI_QUESTIONS_LOG.md`
  - `.ai-debate/`
  - `DRAFT_DISCUSSION_LOG.md`
- Rationale: these look genuinely dead and do not appear to be part of any active runtime contract.

**Tier 2 — Agree with contract cleanup**
- Safe to delete `ai/logs/*-changes-infra.txt`, but only together with protocol/doc cleanup.
- Rationale: per-agent infra logs are still described as active writable targets in:
  - `ai/PROTOCOL.md`
  - `ai/SYSTEM_PROMPT.md`
  - `AI_WORKFLOW.md`
- Recommended implementation rule: remove files and references in one change-set, keeping only canonical runtime logs:
  - `AI_LOG.md`
  - `AI_PLAN_LOG.md`
  - `AI_PROPOSAL_LOG.md`
  - `AI_DISCUSSION_LOG.md`
  - `AI_CHANGE_LOG.md`

**Tier 3 — Partial disagreement as cleanup batch**
- `ai/KNOWLEDGE_BASE.md`
  - Agree it is currently placeholder-only and should stop polluting context packs.
  - Safer first step: remove it from `ai/context.json` and bootstrap references before deleting the file itself.
- `.cursorrules`
  - No evidence Cursor is an active workflow, but it is still wired into `init-project.js`, examples, and allowlists.
  - This is a support-policy decision, not just dead-file cleanup.
- `ai.bat`
  - Same conclusion: while small, it still represents a declared Windows path in `README.md`.
  - Removing it changes support posture, so it should be handled as an explicit policy decision.

**Answers to Claude's questions**
1. `KNOWLEDGE_BASE.md`
   - No current evidence of real use.
   - Support removing it from context injection now.
   - Full deletion can be deferred one step if we want the lowest-risk cleanup path.
2. Cursor IDE workflow
   - No clear evidence it is actively used here.
   - But current bootstrap/examples still acknowledge it, so removal should be explicit policy, not opportunistic cleanup.
3. Windows (non-WSL) support
   - Current repo still soft-signals support through `ai.bat` and README mention.
   - Remove only if we are willing to state that non-WSL Windows is no longer a supported path.

**Recommended rollout**
1. Execute Tier 1 as a safe cleanup batch.
2. Execute Tier 2 together with protocol/prompt/workflow contract cleanup.
3. Open a separate policy decision for:
   - `ai/KNOWLEDGE_BASE.md` delete vs keep-but-stop-injecting
   - `.cursorrules` optional support vs removal
   - `ai.bat` soft Windows support vs removal

## [2026-03-10 10:59:16 UTC] - Project: ai-hub-coding
Planned Change: Implement Structure Rationalization Step 0 via shared dual-root path resolution without moving runtime files yet.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/scripts/path-utils.js
- ai/scripts/generate-context.js
- ai/scripts/memory.js
- ai/scripts/cleanup.js
- ai/scripts/hub.js
- ai/scripts/architecture-check.js
- ai/scripts/__tests__/path-utils.test.js
- ai/design/features/STRUCTURE_RATIONALIZATION.md
- ai/ROADMAP.md
Notes: Added `resolveProjectLayout(projectPath)` as the shared layout contract. Core scripts now resolve `sourceRoot` and `runtimeRoot` through one API, while current `.ai`-first / legacy `ai` fallback behavior remains unchanged. No file moves were performed; Step 1 stays pending.

## [2026-03-10 11:40:48 UTC] - Project: ai-hub-coding
Planned Change: Separate article review instructions from shared reading-progress logs in `ai/design/article-reviews/`.
Owner Model: Codex (GPT-5)
Priority: P3
Status: DONE
Target Files:
- ai/design/article-reviews/links.txt
- ai/design/article-reviews/READING_LOG.md
Notes: `links.txt` now contains only task instructions and the raw link list. Shared per-link progress for all models was moved into `READING_LOG.md` with explicit status values, entry template, and migrated Codex history.

## [2026-03-10 12:02:42 UTC] - Project: ai-hub-coding
Planned Change: Step 1.1 Hotfix — Fix new project bootstrap trap
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- ai/scripts/path-utils.js
- ai/scripts/init-project.js
- ai/scripts/__tests__/path-utils.test.js
- ai/scripts/__tests__/init-project.test.js
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Closed Gemini's Devil's Advocate findings for Step 1. 1) `resolveProjectLayout()` now defaults to `split-root` when neither `ai/` nor `.ai/` exists. 2) `init-project.js` now resolves `archiveDir` and `agentsConfigPath` through the shared layout contract. 3) `ai:init` now scaffolds runtime directories under `.ai/` so a brand-new project no longer looks like `legacy-single-root` immediately after bootstrap.

## [2026-03-10 12:06:24 UTC] - Project: ai-hub-coding
Planned Change: Record post-Step-1.1 structural proposals for multi-model discussion.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Added a new discussion addendum after Step 1.1 with Codex's proposed next sequence: explicitly lock the `ai:init` contract boundary, run a mechanical path-consistency pass, add one end-to-end bootstrap smoke test, deprecate compatibility APIs later rather than removing them now, and avoid expanding into a larger refactor batch before those items are reviewed.

## [2026-03-10 12:13:38 UTC] - Project: ai-hub-coding
Planned Change: Record post-review synthesis for the structure rationalization discussion after Claude and Gemini responses.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Added Codex synthesis after Claude and Gemini responses. New stated baseline: proposals 1, 3, 4, and 5 are effectively accepted; the only real open discussion item is the exact checklist boundary for the path consistency pass.

## [2026-03-10 12:28:43 UTC] - Project: ai-hub-coding
Planned Change: Execute the bounded path-consistency pass for split-root runtime wording.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/infrastructure/providers.js
- ai/scripts/infrastructure/run-logs.js
- ai/scripts/generate-context.js
- ai/scripts/domain/prompt-content.js
- ai/scripts/__tests__/providers.test.js
- README.md
- ai/PROTOCOL.md
- ai/SYSTEM_PROMPT.md
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Completed the smaller, explicitly enumerated path-consistency pass rather than Gemini's broader checklist. Updated runtime-facing string references from `ai/logs` and `ai/prompts` to `.ai/logs` and `.ai/prompts` in the agreed code/doc surfaces, recorded the exact execution boundary in `STRUCTURE_RATIONALIZATION.md`, and intentionally left `AI_WORKFLOW.md` for a separate follow-up. Verification passed: `npm run ai:test` -> `278 passed, 0 failed, 1 skipped`.

## [2026-03-10 12:40:14 UTC] - Project: ai-hub-coding
Planned Change: Harden Step 1 prerequisites before runtime file moves.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- AI_WORKFLOW.md
- ai/scripts/checkpoint-manager.js
- ai/scripts/generate-context.js
- ai/scripts/path-utils.js
- ai/scripts/__tests__/checkpoint-manager.test.js
- ai/scripts/__tests__/path-utils.test.js
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Closed the remaining pre-Step-1 hardening package except for the dedicated smoke test. `AI_WORKFLOW.md` runtime wording now uses `.ai/*`, `checkpoint-manager.js` now accepts layout objects and `generate-context.js` passes `PROJECT_LAYOUT` into checkpoint operations, `resolveProjectPaths()` is marked deprecated, and split-root coverage was expanded in tests. Verification passed: `npm run ai:test` -> `280 passed, 0 failed, 1 skipped`.

## [2026-03-10 12:54:20 UTC] - Project: ai-hub-coding
Planned Change: Close the dedicated bootstrap smoke-test gap and start Step 1 execution for brand-new projects.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/__tests__/bootstrap.e2e.test.js
- ai/scripts/init-project.js
- ai/scripts/__tests__/init-project.test.js
- ai/scripts/hub.js
- ai/scripts/__tests__/hub-cli.test.js
- ai/design/features/STRUCTURE_RATIONALIZATION.md
- ai/ROADMAP.md
Notes: Added a dedicated `brand-new project -> ai:init -> hub index` smoke test, taught `ai:init` to write authored `ai/agents.json` from the bundled template, and changed `hub add` to scaffold brand-new projects as split-root by default (`ai/` for authored config/rules, `.ai/` for runtime). This starts Step 1 for new projects while leaving legacy/single-root migration as the next remaining structural task. Verification passed: `npm run ai:test` -> `281 passed, 0 failed, 1 skipped`.

## [2026-03-10 14:57:37 UTC] - Project: ai-hub-coding
Planned Change: Land safe copy-mode migration for existing single-root projects as the next Step 1 chunk.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/__tests__/hub-cli.test.js
- ai/design/features/STRUCTURE_RATIONALIZATION.md
- ai/ROADMAP.md
Notes: Reworked `hub migrate` from a legacy `ai -> .ai` whole-copy command into split-root normalization logic. It now creates missing `ai/` or `.ai/` roots as needed, copies only authored source files or runtime artifacts toward the correct side, then re-runs `commandAdd()` on the normalized split-root layout. Added regression coverage for both legacy `ai`-only and `.ai`-only projects. Remaining work is now cleanup/dedup policy for transitional duplicate files, not migration enablement. Verification passed: `npm run ai:test` -> `283 passed, 0 failed, 1 skipped`.

## [2026-03-10 15:09:33 UTC] - Project: ai-hub-coding
Planned Change: Add an explicit, safe dedup step for mirrored split-root transitional files.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/hub.js
- ai/scripts/__tests__/hub-cli.test.js
- package.json
- README.md
- ai/design/features/STRUCTURE_RATIONALIZATION.md
- ai/ROADMAP.md
Notes: Added `ai:dedup` / `hub dedup` as an explicit cleanup command for split-root projects. The command only deletes mirrored duplicate files from the wrong side when an identical canonical twin already exists; mismatches are reported and skipped. This keeps `migrate` non-destructive by default while still providing a built-in dedup path. Verification passed: `npm run ai:test` -> `285 passed, 0 failed, 1 skipped`.

## [2026-03-10 15:44:51 UTC] - Project: ai-hub-coding
Planned Change: Demote `dedup` from public feature surface to internal transitional migration tooling.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- package.json
- ai/scripts/hub.js
- README.md
- ai/design/features/STRUCTURE_RATIONALIZATION.md
- ai/ROADMAP.md
Notes: Removed the flat npm alias `ai:dedup`, took `dedup` out of the main README command surface, and re-labeled it as an internal transitional maintainer command used only for one-off split-root cleanup after migration. `hub dedup` remains available in the raw hub CLI and is still explicitly opt-in. Verification passed: `npm run ai:test` -> `285 passed, 0 failed, 1 skipped`.

## [2026-03-10 15:56:34 UTC] - Project: ai-hub-coding
Planned Change: Demote `migrate` from normal user-facing workflow to internal transitional migration tooling.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- README.md
- ai/scripts/hub.js
- ai/ROADMAP.md
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Reframed `migrate` as a one-off internal maintainer utility for legacy project normalization instead of a normal daily CLI capability. Removed it from the main README hub command surface, moved it into the internal transitional section in help/docs, and aligned roadmap/design wording so both `migrate` and `dedup` are now treated as temporary migration-window utilities. Verification passed: `npm run ai:test` -> `285 passed, 0 failed, 1 skipped`.

## [2026-03-10 15:59:39 UTC] - Project: ai-hub-coding
Planned Change: Close the currently known migration window and freeze transitional migration utilities.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Recorded that the two currently known real legacy targets (`/home/kair/wattman/front` and `/home/kair/nornickel/nornickel-master-ref`) have already been normalized to split-root. From this point, `hub migrate` and `hub dedup` are treated as frozen internal maintainer utilities pending later removal or archival, not as active roadmap features. Tests not run because this step only updated design/planning docs.

## [2026-03-10 16:11:01 UTC] - Project: ai-hub-coding
Planned Change: Fully retire the built-in migration layer now that the known migration window is closed.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- package.json
- README.md
- ai/scripts/hub.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/hub-cli.test.js
- ai/ROADMAP.md
- ai/design/features/STRUCTURE_RATIONALIZATION.md
Notes: Removed the remaining transitional commands `ai:migrate` / `hub migrate` and `hub dedup` from the active CLI/codebase, removed their hub CLI tests, removed user-facing migration instructions from README/help, and converted legacy warnings/suggested fixes to neutral split-root guidance without built-in migration commands. Updated roadmap/design docs to reflect that the migration window is closed and the transitional tooling is gone. Verification passed: `npm run ai:test` -> `280 passed, 0 failed, 1 skipped`.

## [2026-03-10 17:03:13 UTC] - Project: ai-hub-coding
Planned Change: Align active model configs and OpenAI GPT-5 token semantics across the hub and the two active target projects.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/agents.json
- AI_WORKFLOW.md
- ai/scripts/infrastructure/providers.js
- ai/scripts/init-project.js
- ai/scripts/__tests__/providers.test.js
Notes: Updated the hub's active model ids to the current validated set used in this session: `gpt-5.4`, `claude-sonnet-4-6`, and `gemini-3.1-pro-preview`. Updated OpenAI request construction so `gpt-5*` models use `max_completion_tokens` instead of `max_tokens`. Propagated the same runtime/config update to the active external projects `/home/kair/wattman/front` and `/home/kair/nornickel/nornickel-master-ref`, including a follow-up syntax fix in `nornickel`'s copied `init-project.js`. Verification passed: `npm run ai:test` -> `280 passed, 0 failed, 1 skipped`; `node --check /home/kair/nornickel/nornickel-master-ref/ai/scripts/init-project.js` passed. Pilot rerun for `wattman/front` now reaches architect/proposal stage and is blocked by Anthropic TPM rate limiting on `claude-sonnet-4-6`, not by stale model ids or GPT-5 request incompatibility.

## [2026-03-10 17:17:28 UTC] - Project: ai-hub-coding
Planned Change: Add structured runtime error logging for provider failures, retries, and fatal run failures.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/infrastructure/run-logs.js
- ai/scripts/infrastructure/providers.js
- ai/scripts/generate-context.js
- ai/scripts/hub.js
- ai/scripts/memory.js
- ai/scripts/__tests__/providers.test.js
- ai/scripts/__tests__/run-logs.test.js
- README.md
- AI_WORKFLOW.md
- ai/PROTOCOL.md
- ai/SYSTEM_PROMPT.md
Notes: Added a new typed runtime log `.ai/logs/AI_ERROR_LOG.md`. Provider errors now preserve structured metadata such as provider, model, status code, retry-after/request-id, response headers, and truncated response body. The generate-context runtime now logs retry attempts (`RETRYING`), final agent-stage failures (`FAILED`), and top-level fatal run failures into `AI_ERROR_LOG.md`. Hub scaffolding and `ai:memory` were updated to recognize the new typed log. Verification passed: `node --test ai/scripts/__tests__/providers.test.js ai/scripts/__tests__/run-logs.test.js` and `npm run ai:test` -> `282 passed, 0 failed, 1 skipped`.

## [2026-03-10 17:23:29 UTC] - Project: ai-hub-coding
Planned Change: Use provider `retry-after` headers for rate-limit retry timing instead of a fixed 65-second wait.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/__tests__/retry-delay.test.js
Notes: Added `parseRetryAfterMs()` and `resolveRetryDelayMs()` so retry logic now prefers provider-supplied `retry-after` delays for 429/rate-limit responses, with the old fixed `65s` window kept only as a fallback when no header is available. Added unit coverage for delta-seconds, HTTP-date, invalid values, and fallback behavior. Verification passed: `node --test ai/scripts/__tests__/retry-delay.test.js ai/scripts/__tests__/script-entrypoints.test.js` and `npm run ai:test` -> `288 passed, 0 failed, 1 skipped`. Live verification on `/home/kair/wattman/front` showed `Rate limit hit. Waiting 65s for quota reset (retry-after)...`, confirming the delay source is now the response header rather than the previous hardcoded fallback.

## [2026-03-10 17:43:36 UTC] - Project: ai-hub-coding
Planned Change: Compact runtime context/input flow and add explicit token-economy guidance for all agents.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- ai/scripts/infrastructure/file-read-tool.js
- ai/scripts/context-index.js
- ai/scripts/context-pack.js
- ai/scripts/domain/prompt-content.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/file-read-tool.test.js
- ai/scripts/__tests__/context-pack.test.js
- ai/scripts/__tests__/prompt-content.test.js
- ai/scripts/__tests__/quality-pipeline.test.js
- ai/prompts/providers/anthropic.md
- ai/prompts/providers/openai.md
- ai/prompts/providers/google.md
- ai/context.json
- ai/agents.json
- ai/PROTOCOL.md
- ai/SYSTEM_PROMPT.md
Notes: Implemented a bounded compression pass across both input and output surfaces. Context Pack defaults were reduced (`maxPackBytes 32000`, `maxGraphEdges 80`, `maxSnippets 24`), symbol listing was capped, snippet context lines were reduced, tree output is now capped more aggressively when Context Pack is active, and memory/log windows were tightened. The file reader now supports ranged requests like `path/to/file.ts#L120-L260`, per-turn file-count limits, and lower total/default file budgets. Added explicit token-economy instructions to prompt builders, provider profiles, `SYSTEM_PROMPT`, and `PROTOCOL`. Added optional per-agent `contextBudget` and `maxOutputTokens`, then propagated them to the active project configs for `/home/kair/wattman/front` and `/home/kair/nornickel/nornickel-master-ref`. Verification passed: `npm run ai:test` -> `291 passed, 0 failed, 1 skipped`. Live pilot smoke on `/home/kair/wattman/front` showed bundle size reduction from `68235` bytes to `45375` bytes, and `architect` switched from whole-file requests to ranged requests (`canvas.tsx#L1-L100`, `#L400-L600`, etc.). Anthropic ITPM rate limiting still exists on long multi-turn analysis, but it now occurs later and with smaller `retry-after` windows.

## [2026-03-10 17:54:26 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: proactive-rate-limit-gating
Task Summary: Add pre-send rate-limit estimation and waiting based on provider headers
Priority: P1
Status: DONE
Target Files:
- ai/scripts/infrastructure/providers.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/providers.test.js
- ai/scripts/__tests__/retry-delay.test.js
Notes: Added provider metadata return objects so runtime now receives successful response headers plus token usage when providers expose them. Implemented an in-memory rate-limit snapshot keyed by provider/model, approximate input-token estimation for each next request, and a preflight wait gate that delays the next send until reset when the estimated next input would exceed the remaining budget. The first implementation is header-driven and works best when providers return ratelimit headers; it currently covers the live Anthropic failure mode directly. Live pilot verification on `/home/kair/wattman/front` showed the new behavior: after two successful `architect` file-read turns, runtime emitted `preflight wait 31s before proposal (input tokens remaining 14000/30000, estimated next input: ~15400 tokens)` instead of blindly sending the next request and only learning from a later `429`. Verification passed: `node --test ai/scripts/__tests__/providers.test.js ai/scripts/__tests__/retry-delay.test.js` and `npm run ai:test` -> `296 passed, 0 failed, 1 skipped`.

## [2026-03-10 18:02:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: tool-loop-finalization
Task Summary: Prevent proposal/critique artifacts from collapsing to "Error: Max tool loops reached."
Priority: P1
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/__tests__/generate-context.tool-loop.test.js
Notes: Changed the file-reader tool-loop fallback so that exhausting `AI_TOOL_MAX_TURNS` no longer returns a raw error artifact. Runtime now appends a final system instruction that the file-reader budget is exhausted, forbids any further `READ_FILE` markers, and asks the agent for its best final answer using only the context already loaded in the conversation. If the model still emits `READ_FILE` markers on that forced final turn, they are stripped instead of being archived verbatim. Added a focused regression test for this path plus full verification: `npm run ai:test` -> `298 passed, 0 failed, 1 skipped`.

## [2026-03-10 18:16:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pipeline-hardening-discussion-20260310
Task Summary: Promote truncated successful outputs into a dedicated design discussion
Priority: P0
Status: DONE
Target Files:
- ai/design/features/PIPELINE_HARDENING.md
- ai/design/features/README.md
- ai/ROADMAP.md
Notes: Added a dedicated design doc for `Pipeline Hardening` and linked it from the short roadmap. The discussion is based on a real pilot defect from `/home/kair/wattman/front`: `architect` and `reviewer` produced partial successful outputs with no `END_MARKER`, and runtime still archived/logged them as completed. Claude's recent roadmap update was directionally correct: the new roadmap item already named `truncation detection + auto-retry`. This new design doc turns that short bullet into a concrete review surface with MVP scope, recommended baseline, and open questions for other models.

## [2026-03-10 18:44:21 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pipeline-hardening-review-prompt-20260310
Task Summary: Add reusable review prompt and record likely causes of truncated outputs
Priority: P0
Status: DONE
Target Files:
- ai/PIPELINE_HARDENING_REVIEW_PROMPT.md
- ai/design/features/PIPELINE_HARDENING.md
Notes: Added a reusable review prompt for other models and expanded the design doc with a `Likely Causes Of Partial Successful Outputs` section. The new analysis records that: (1) `architect`/`reviewer`/`synthesizer` text artifacts in `wattman` were accepted without `END_MARKER`; (2) approval artifacts were complete; (3) Devil's Advocate archives parsed JSON rather than raw model text, which weakens truncation forensics; and (4) the strongest current hypotheses are output-budget exhaustion plus missing success-side `stop_reason` / `finishReason` visibility. No tests run because this change is design-only.

## [2026-03-10 18:53:51 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pipeline-hardening-consensus-and-plan-20260310
Task Summary: Fix current consensus and phased implementation plan after Claude + Gemini reviews
Priority: P0
Status: DONE
Target Files:
- ai/design/features/PIPELINE_HARDENING.md
- ai/ROADMAP.md
Notes: The discussion phase is now closed enough for implementation. Added a `Current Consensus (After Claude + Gemini Reviews)` section plus a four-batch implementation plan. Accepted baseline: one repair-pass max, same-model-only, no tool access during repair, `PARTIAL/TRUNCATED` semantics, and no silent completed status for missing-marker text outputs. Required implementation changes fixed in the plan: success-side finish metadata plumbing, structured runtime return contract, two-signal truncation detection, and raw `.raw.txt` sidecars for JSON phases. Roadmap status for `Pipeline Hardening` moved from `discussion` to `ready`.

## [2026-03-10 19:35:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pipeline-hardening-batch1-20260310
Task Summary: Land Batch 1 provider metadata plumbing and structured runtime return contract
Priority: P0
Status: DONE
Target Files:
- ai/design/features/PIPELINE_HARDENING.md
- ai/ROADMAP.md
- ai/scripts/infrastructure/providers.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/providers.test.js
- ai/scripts/__tests__/generate-context.contract.test.js
Notes: Implemented Batch 1 from the Pipeline Hardening plan. Provider success results now carry normalized `meta` with provider/model identity, `stopReason`, token usage, headers, and raw usage. Runtime no longer collapses successful agent calls to plain strings too early: `callAgent(...)` now returns `{ text, meta }`, and `callAgentWithValidation(...)` now returns `{ text, completionStatus, meta }` with `completionStatus: unclassified` as the pre-Batch-2 placeholder. Internal pipeline call sites were translated to use `.text`, preserving current behavior while fixing the contract before truncation classification work begins. Design/roadmap status was updated to show Pipeline Hardening as `in progress` with Batch 1 complete. Verification passed: `node --test ai/scripts/__tests__/providers.test.js ai/scripts/__tests__/generate-context.contract.test.js ai/scripts/__tests__/generate-context.tool-loop.test.js` and `npm run ai:test` -> `301 passed, 0 failed, 1 skipped`.

## [2026-03-11 01:45:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pipeline-hardening-batch2-20260311
Task Summary: Land Batch 2 completion classification and stop silent Completed statuses for incomplete text outputs
Priority: P0
Status: DONE
Target Files:
- ai/design/features/PIPELINE_HARDENING.md
- ai/ROADMAP.md
- ai/scripts/response-validator.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/response-validator.test.js
- ai/scripts/__tests__/generate-context.contract.test.js
Notes: Read the latest logs first: Claude's newest Pipeline Hardening input was review/contract guidance, not additional runtime code, so Batch 2 could proceed directly on top of the existing Batch 1 contract. Implemented completion classification for text responses: `complete`, `truncated`, and `invalid`. The truncation rule is now two-signal as agreed in review: missing `END_MARKER` plus provider `stopReason` when available, otherwise a narrow fallback heuristic for clearly unfinished endings. `callAgentWithValidation(...)` now returns real completion statuses instead of the old placeholder, and text-phase save/log/checkpoint paths for proposals, critiques, consensus, approval rounds, and consensus revisions no longer mark incomplete outputs as plain `Completed`. Incomplete text outputs now stop the pipeline instead of silently continuing into later phases. Verification passed: `node --test ai/scripts/__tests__/response-validator.test.js ai/scripts/__tests__/generate-context.contract.test.js` and `npm run ai:test` -> `305 passed, 0 failed, 1 skipped`.

## [2026-03-11 02:10:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pipeline-hardening-batch3-20260311
Task Summary: Land one bounded continuation repair pass for truncated text outputs
Priority: P0
Status: DONE
Target Files:
- ai/design/features/PIPELINE_HARDENING.md
- ai/ROADMAP.md
- ai/scripts/domain/prompt-content.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/generate-context.contract.test.js
- ai/scripts/__tests__/generate-context.tool-loop.test.js
- ai/scripts/__tests__/response-validator.test.js
Notes: Implemented Batch 3 exactly on the MVP boundary agreed in review. Truncated text outputs now get one same-model continuation repair attempt before final status is set. The repair call uses the original partial output as an assistant message, a short continuation prompt, no tool/file access, and a temporary output cap of `min(originalBudget, 1024)`. If repair completes successfully, the merged text continues through normal validation/classification; if it still ends incomplete, the non-complete status remains visible and the pipeline stops. JSON-returning phases were explicitly excluded from this repair path and still wait for Batch 4 raw-output forensics. Verification passed: `node --test ai/scripts/__tests__/generate-context.contract.test.js ai/scripts/__tests__/generate-context.tool-loop.test.js ai/scripts/__tests__/response-validator.test.js` and `npm run ai:test` -> `306 passed, 0 failed, 1 skipped`.

## [2026-03-11 02:25:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pipeline-hardening-batch4-20260311
Task Summary: Preserve raw `.raw.txt` sidecars for JSON phases and close the 4-batch hardening MVP
Priority: P0
Status: DONE
Target Files:
- ai/design/features/PIPELINE_HARDENING.md
- ai/ROADMAP.md
- ai/scripts/generate-context.js
- ai/scripts/__tests__/generate-context.json-sidecar.test.js
Notes: Implemented Batch 4 with the narrow contract agreed in review: Prompt Engineer, Devil's Advocate, and Tester now save both the parsed `.json` artifact and a sibling `.raw.txt` file containing the raw provider response text. This closes the forensic gap that was visible in Wattman, where parsed fallback objects could hide whether the original JSON/text payload was truncated. No new archive hierarchy or checkpoint schema was introduced; the parsed `.json` file remains the canonical structured artifact, and the raw sidecar is a diagnostic companion only. Design/roadmap status now records the 4-batch Pipeline Hardening MVP as complete, while leaving the previously mentioned heuristic critique scoring as an optional separate follow-up rather than a blocker. Verification passed: `node --test ai/scripts/__tests__/generate-context.json-sidecar.test.js ai/scripts/__tests__/generate-context.contract.test.js` and `npm run ai:test` -> `308 passed, 0 failed, 1 skipped`.

## [2026-03-11 02:40:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: wattman-debate-phases-sync-20260311
Task Summary: Sync Wattman pilot config with new debatePhases filtering contract
Priority: P1
Status: DONE
Target Files:
- /home/kair/wattman/front/ai/agents.json
- /home/kair/wattman/front/.ai/agents.json
Notes: Synced the Wattman pilot project to the new phase-level filtering feature by adding `debatePhases: ["proposal", "critique"]` to the `architect` agent in both `ai/agents.json` and `.ai/agents.json`. This keeps the pilot aligned with the hub's current debate-flow contract and avoids paying for architect participation in approval rounds. Scope was intentionally minimal: no broader agent normalization was done in this step. Remaining drift still exists between Wattman's `ai/agents.json` and `.ai/agents.json` for the `synthesizer` model/provider and should be treated as a separate cleanup decision.

## [2026-03-11 13:35:44 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: phase-contract-normalization-discussion-20260311
Task Summary: Add a discussion-only proposal for explicit phase families and normalized phase artifact contracts
Priority: P1
Status: DONE
Target Files:
- ai/design/features/PHASE_CONTRACT_NORMALIZATION.md
- ai/design/features/README.md
- ai/ROADMAP.md
Notes: Added a dedicated design discussion surface for the current text-vs-JSON phase inconsistency. The proposal keeps both output families, but recommends explicit phase taxonomy plus unified `raw / canonical / meta` artifact semantics. The first concrete cleanup target is `approval`, which already behaves like a structured decision phase but is still treated and archived more like text. No implementation work started in this step.

## [2026-03-11 13:48:55 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: phase-contract-normalization-consensus-tightening-20260311
Task Summary: Tighten the phase contract proposal after Gemini and Claude review
Priority: P1
Status: DONE
Target Files:
- ai/design/features/PHASE_CONTRACT_NORMALIZATION.md
- ai/ROADMAP.md
Notes: Updated the proposal to reflect the actual review consensus. Clarified that text phases do not need separate raw artifacts, structured phases keep `.json` + `.raw.txt`, and shared `meta` should live in checkpoint/runtime state rather than `.meta.json` files. Added an explicit distinction between `debatePhases` and phase family so user participation filters are not confused with engine-owned output contracts. Roadmap wording now also records the sequencing decision: design direction is mostly settled, but implementation should wait until after the active pilot and stay hard-scoped to `approval` only.

## [2026-03-11 13:55:11 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: phase-contract-normalization-approval-mvp-20260311
Task Summary: Implement the approval-only MVP for phase contract normalization
Priority: P1
Status: DONE
Target Files:
- ai/scripts/domain/prompt-content.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/prompt-content.test.js
- ai/scripts/__tests__/generate-context.contract.test.js
- ai/design/features/PHASE_CONTRACT_NORMALIZATION.md
- ai/design/features/PIPELINE_HARDENING.md
- ai/ROADMAP.md
Notes: Landed the narrow `approval` slice without widening scope to other phases. Approval responses are now treated as structured artifacts: canonical output is archived as `.json`, raw provider output is preserved as `.raw.txt`, and checkpoint entries now record approval metadata as structured phase data. Non-JSON approval payloads no longer survive as false `complete` results; they are downgraded to `invalid`, which stops the pipeline through a structured-output error path. The broader phase-family declaration/refactor remains deferred. Verification passed: `node --test ai/scripts/__tests__/prompt-content.test.js ai/scripts/__tests__/generate-context.contract.test.js ai/scripts/__tests__/generate-context.json-sidecar.test.js` and `npm run ai:test` -> `310 passed, 0 failed, 1 skipped`.

## [2026-03-11 14:55:29 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: adaptive-runtime-control-proposal-20260311
Task Summary: Add a high-priority proposal for predictive runtime control and more honest operational limits
Priority: P0
Status: DONE
Target Files:
- ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md
- ai/design/features/README.md
- ai/ROADMAP.md
Notes: Added a new high-priority design proposal focused on real-run operational pain: misleading limit hints, checkpoint resume that ignores runtime flags, weak phase-level forecasting, lack of live runtime steering, and poor project-type-aware warnings. The proposed MVP starts narrowly with honest effective-limits reporting plus runtime-setting-aware checkpoint fingerprints, then expands into risk forecasting and runtime overrides. This was explicitly raised in response to real project runs where the current runtime behavior is technically correct but operationally hard to predict and control.

## [2026-03-11 15:45:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: task-discussion-packaging-20260311
Task Summary: Add task-scoped discussion packaging with stable task IDs and result links
Priority: P1
Status: DONE
Target Files:
- ai/scripts/path-utils.js
- ai/scripts/checkpoint-manager.js
- ai/scripts/generate-context.js
- ai/scripts/__tests__/path-utils.test.js
- ai/scripts/__tests__/checkpoint-manager.test.js
- ai/scripts/__tests__/generate-context.contract.test.js
- README.md
Notes: Added an optional `--task-id=...` runtime flag and a new `.ai/prompts/discussions/<task-id>/<run-id>/` package alongside the canonical `archive/run-*` artifacts. Each completed run now creates a task discussion package with `prompt.txt`, `result.txt`, optional `devils-advocate-report.md`, optional `test-report.md`, optional `result-warning.txt`, and a `README.md` index that points back to the canonical run archive. `result.txt` now includes a discussion-folder pointer so the final artifact can navigate directly to the corresponding discussion package. If no explicit task id is provided, runtime falls back to `manual-<promptHash>`. Verification passed: targeted tests and `npm run ai:test` -> `313 passed, 0 failed, 1 skipped`.

## [2026-03-12 01:45:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: adaptive-runtime-control-review-tightening-20260312
Task Summary: Fold Claude review into Adaptive Runtime Control proposal and clarify relationship to Language-Aware Arch Check
Priority: P0
Status: DONE
Target Files:
- ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md
- ai/design/features/LANGUAGE_AWARE_ARCH_CHECK.md
- ai/ROADMAP.md
Notes: Added a Codex response after Claude's review. Accepted Claude's key points on Batch 1-2 priority, warn-only MVP behavior for high-risk phases, and the need for a safety contract around runtime overrides. Kept one explicit disagreement: heuristic risk forecasting should not be delayed until post-run signal collection exists. The proposal now distinguishes `heuristic forecast` (current-state only) from `calibrated forecast` (history-backed), and recommends sequencing them separately. Also added an explicit boundary with `Language-Aware Architecture Check`: Adaptive Runtime Control can start with minimal project-type heuristics for runtime warnings and later converge on shared detection logic if the arch-check feature lands reusable language/profile resolution. No code changes or tests in this step.

## [2026-03-12 01:55:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: language-aware-arch-check-codex-review-20260312
Task Summary: Add Codex design comments to the Language-Aware Architecture Check proposal
Priority: P2
Status: DONE
Target Files:
- ai/design/features/LANGUAGE_AWARE_ARCH_CHECK.md
Notes: Added a standalone Codex response to the proposal itself. Main points: keep the direction, but narrow the MVP to a Rust profile extraction plus one JavaScript-family profile; do not call TypeScript a trivial follow-up; use hybrid profile selection (explicit `language` override with extension-based fallback); move profiles into a separate `arch-profiles.js` module immediately; and explicitly position JS metrics as heuristic smell detection rather than parser-grade truth. Also recommended conservative thresholds and keeping mixed-language support out of MVP. No code changes or tests in this step.

## [2026-03-12 02:35:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: prompts-runs-rename-20260312
Task Summary: Rename the target-project run artifact folder from prompts/archive to prompts/runs with backward compatibility for legacy archives
Priority: P1
Status: DONE
Target Files:
- ai/scripts/path-utils.js
- ai/scripts/checkpoint-manager.js
- ai/scripts/refinement.js
- ai/scripts/cleanup.js
- ai/scripts/hub.js
- ai/scripts/generate-context.js
- ai/scripts/domain/prompt-content.js
- ai/scripts/__tests__/path-utils.test.js
- ai/scripts/__tests__/checkpoint-manager.test.js
- ai/scripts/__tests__/cleanup.test.js
- ai/scripts/__tests__/refinement.test.js
- ai/scripts/__tests__/hub-cli.test.js
- ai/scripts/__tests__/init-project.test.js
- README.md
- AI_WORKFLOW.md
- ai/PROTOCOL.md
- ai/SYSTEM_PROMPT.md
Notes: Canonical completed-run storage is now `.ai/prompts/runs/` instead of `.ai/prompts/archive/`, because `archive` was too vague for real project work. `resolveProjectLayout()` now exposes `runsDir` and `legacyArchiveDir`, while `archiveDir` remains as a backward-compatible alias to the new canonical `runsDir`. New writes and scaffolding go to `runs/`; refinement, cleanup, and hub maintenance now read `runs/` first and fall back to legacy `archive/` when present. Active docs/help text were updated to point at `.ai/prompts/runs/`. Verification passed: targeted path/checkpoint/refinement/cleanup/hub/init tests and `npm run ai:test` -> `314 passed, 0 failed, 1 skipped`.

## [2026-03-12 02:45:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: prompts-runs-project-migration-20260312
Task Summary: Physically migrate existing target projects from .ai/prompts/archive to .ai/prompts/runs
Priority: P1
Status: DONE
Target Files:
- /home/kair/wattman/front/.ai/prompts/runs
- /home/kair/nornickel/nornickel-master-ref/.ai/prompts/runs
- /home/kair/platonus/academy/plta-document-flow/.ai/prompts/runs
Notes: Executed a one-off migration for all three active target projects registered in `config/projects.json`. Moved the contents of `.ai/prompts/archive/` into `.ai/prompts/runs/` for `wattman/front`, `nornickel-master-ref`, and `plta-document-flow`, then removed the old `archive/` directories once empty. Result: all three projects now have `.ai/prompts/runs/` as the physical canonical location and no remaining `.ai/prompts/archive/` directory. No code changes in this step; verification was done by checking resulting directory presence and confirming the legacy archive directory was gone.

## [2026-03-12 09:10:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: adaptive-runtime-control-batch1-20260312
Task Summary: Implement Adaptive Runtime Control Batch 1 with honest effective-limits summary and honest truncation warnings
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/__tests__/generate-context.contract.test.js
- ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md
- ai/ROADMAP.md
Notes: Landed Batch 1 of Adaptive Runtime Control. The runtime now prints a compact effective-limits summary before provider phases start, including effective maxFiles, packed-tree cap, context-pack on/off, light/full mode, checkpoint mode, and per-agent budgets. Truncation warnings were also upgraded to name the real active limiter instead of always suggesting `--max-files` or `--full`; when context pack is on and the tree is hard-capped by `maxTreeFilesWhenPacked`, the warning now says so explicitly. Added focused unit tests for the new summary/warning helpers. Verification passed: targeted tests and `npm run ai:test` -> `318 passed, 0 failed, 1 skipped`.

## [2026-03-12 09:20:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: prompts-latest-vs-history-doc-clarification-20260312
Task Summary: Clarify in docs that root .ai/prompts files are always the latest run and historical outputs live in discussions/runs
Priority: P1
Status: DONE
Target Files:
- README.md
- AI_WORKFLOW.md
Notes: Added an explicit runtime-layout clarification to user-facing docs. The root `.ai/prompts/` files (`prompt.txt`, `result.txt`, `devils-advocate-report.md`, `test-report.md`) are now documented as latest-run working copies only. Historical prompt/result discussion packages are documented under `.ai/prompts/discussions/<task-id>/<run-id>/`, and full raw run artifacts under `.ai/prompts/runs/`. No code changes or tests in this step.

## [2026-03-12 10:05:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: consensus-output-log-leak-guard-20260312
Task Summary: Prevent internal log templates and meta chatter from leaking into user-facing final results
Priority: P0
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/domain/prompt-content.js
- ai/scripts/__tests__/generate-context.contract.test.js
- ai/scripts/__tests__/prompt-content.test.js
Notes: Added a narrow guard for final user-facing consensus text. `generate-context.js` now sanitizes consensus/revision/da-revision output before it is reused downstream or written to `result.txt`, stripping leaked internal `.ai/logs/*` templates, `### Логи/### Logs` appendices, and trailing meta chatter like `Если хотите, следующим сообщением могу...` while preserving the actual answer and `END_MARKER`. Consensus and revision prompts were also hardened so the model is explicitly told not to include internal log-writing instructions or meta offers. Verification passed: targeted tests and `npm run ai:test` -> `321 passed, 0 failed, 1 skipped`.

## [2026-03-12 10:18:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: discussion-taskid-fallback-simplification-20260312
Task Summary: Remove redundant manual-* prefix from discussion task-id fallback
Priority: P1
Status: DONE
Target Files:
- ai/scripts/generate-context.js
- ai/scripts/__tests__/generate-context.contract.test.js
- AI_WORKFLOW.md
- ai/PROTOCOL.md
Notes: Simplified discussion folder naming for ad-hoc runs. When `--task-id` is not provided, the fallback task group is now just the prompt hash instead of `manual-<hash>`. This keeps the useful grouping behavior without the redundant `manual-` prefix. Documentation was updated accordingly, and a regression test was added for the new fallback contract. Verification passed: targeted test and `npm run ai:test` -> `322 passed, 0 failed, 1 skipped`.

## [2026-03-12 10:42:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: move-llms-into-authored-ai-surface-20260312
Task Summary: Make `ai/llms.md` the canonical authored architecture file and remove root-level `llms.md`
Priority: P1
Status: DONE
Target Files:
- ai/llms.md
- ai/scripts/init-project.js
- CLAUDE.md
- ai/PROTOCOL.md
- ai/SYSTEM_PROMPT.md
- AI_WORKFLOW.md
- ai/context.json
- examples/nextjs-typescript/README.md
- examples/nextjs-typescript/ai/context.json.example
- examples/nextjs-typescript/ai/llms.md.example
- ai/scripts/__tests__/config-loader.test.js
- ai/scripts/__tests__/init-project.test.js
- ai/scripts/__tests__/hub-cli.test.js
Notes: Moved the canonical architecture summary template from root `llms.md` to `ai/llms.md` to reduce target-project root clutter while preserving the split-root contract (`ai/` = authored, `.ai/` = runtime). Added compatibility aliasing in `config-loader.js` so old projects with root `llms.md` still resolve correctly, updated init scaffolding to generate `ai/llms.md`, refreshed docs/examples/context defaults, and renamed the example template accordingly. Verification passed: targeted tests and `npm run ai:test` -> `324 passed, 0 failed, 1 skipped`.

## [2026-03-12 11:05:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: finalize-llms-path-cutover-20260312
Task Summary: Clean active target projects and remove transitional `llms.md` compatibility
Priority: P1
Status: DONE
Target Files:
- ai/scripts/config-loader.js
- ai/scripts/init-project.js
- ai/scripts/__tests__/config-loader.test.js
Notes: Cleaned the three active target projects (`/home/kair/wattman/front`, `/home/kair/nornickel/nornickel-master-ref`, `/home/kair/platonus/academy/plta-document-flow`) so they now reference canonical `ai/llms.md`, moved remaining root `llms.md` files into `ai/llms.md`, and added the missing authored file to `wattman/front`. With live projects migrated, the temporary alias between root `llms.md` and `ai/llms.md` was removed from `config-loader.js`, and init fallback logic now recognizes only canonical `ai/llms.md`. Verification passed: targeted tests and `npm run ai:test` -> `323 passed, 0 failed, 1 skipped`.

## [2026-03-12 13:05:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: pilot-closeout-aggregate-baseline-20260312
Task Summary: Close the real-project pilot with an honest aggregate baseline and blocker note
Priority: P0
Status: DONE
Target Files:
- ai/ROADMAP.md
Notes: Executed three additional interactive rated runs on `/home/kair/platonus/academy/plta-document-flow` (`DOCFLOW-DOCS-001`, `DOCFLOW-DOCS-002`, `DOCFLOW-TEST-001`) and attempted further follow-up prompts. Aggregate pilot baseline now meets runbook thresholds across real projects: `8` completed runs and `6` saved ratings. Current breakdown: `wattman/front` = `1` run, `0` ratings; `nornickel-master-ref` = `1` run, `0` ratings; `plta-document-flow` = `6` runs, `6` ratings, avg rating `3.5`. Attempted extension beyond that on `plta-document-flow` hit an external Anthropic billing blocker (`credit balance is too low`) during `architect` critique/proposal, which is operationally distinct from a hub runtime defect. Roadmap updated to reflect that baseline is met globally and the next execution priority should shift to Adaptive Runtime Control Batch 2.

## [2026-03-11 15:30:00 UTC] - Project: ai-hub-coding
Planned Change: Create split Commercial Roadmap and implement Plugin/Hook architecture to support the OSS boundary
Owner Model: Unassigned
Priority: P1
Status: TODO
Target Files:
- docs/commercialization/ROADMAP.md (new)
- ai/ROADMAP.md (update links)
- ai/scripts/hub.js (Plugin injection points)
- ai/scripts/generate-context.js (Plugin injection points)
Notes: As proposed in docs/commercialization/COMMERCIAL_STRATEGY_REVIEW.md, we need to split the roadmap into Technical (OSS) and Commercial to keep the repository focused. Additionally, to enforce the OSS/Commercial boundary in code, we need to introduce a generic plugin/hook architecture so that closed-source proprietary integrations (Jira, GitLab Enterprise) can be injected without modifying the open-source core scripts.

## [2026-03-12 18:35:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: commercialization-docs-consistency-pass-20260312
Task Summary: Bring `docs/commercialization` to one current baseline after pilot closure and GitLab scope decisions
Priority: P1
Status: DONE
Target Files:
- docs/commercialization/oss-core-launch-memo-2026-03-22.md
- docs/commercialization/commercial-roadmap.md
- docs/commercialization/review-technical-2026-03-12.md
- docs/commercialization/review-legal-2026-03-12.md
- docs/commercialization/COMMERCIAL_STRATEGY_REVIEW.md
Notes: Updated commercialization docs so they no longer describe the project as pre-pilot. The memo now records the completed internal pilot baseline (`8` runs / `6` ratings aggregate), the commercial roadmap explicitly states that the first paid pilot does not include GitLab delivery, and GitLab pricing/status were aligned to `post-pilot only` with a `3000 USD` placeholder instead of the stale `1500 USD` add-on line. Fixed stale path references to the commercial boundary doc and to the commercial roadmap, and updated the technical review to treat the remaining risk as commercial packaging and scope control rather than lack of internal validation. No code changes; tests not rerun.

## [2026-03-12 18:45:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: roadmap-track-separation-commercial-boundary-20260312
Task Summary: Separate OSS roadmap from paid-feature planning and define how shared architecture enablers are tracked
Priority: P1
Status: DONE
Target Files:
- ai/ROADMAP.md
- docs/commercialization/COMMERCIAL_ADDON_BOUNDARY.md
- docs/commercialization/commercial-roadmap.md
- docs/commercialization/README.md
Notes: Added an explicit planning-track contract: `ai/ROADMAP.md` is for OSS core and shared architecture enablers only, while detailed paid-feature planning stays in commercialization docs and must move to a private planning surface before the public OSS release. Also clarified that shared plugin/hook/adapter infrastructure may remain in the OSS roadmap only when it has standalone public value, and added launch-gate/action items to move internal commercialization docs out of the public release package.

## [2026-03-12 19:00:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: public-release-leak-guard-20260312
Task Summary: Add a release-blocking guard so internal commercialization planning cannot accidentally ship in a public OSS release
Priority: P0
Status: DONE
Target Files:
- ai/scripts/check-public-release.js
- ai/scripts/__tests__/check-public-release.test.js
- ai/scripts/__tests__/script-entrypoints.test.js
- package.json
- docs/commercialization/COMMERCIAL_ADDON_BOUNDARY.md
- docs/commercialization/README.md
Notes: Added `npm run ai:release:check`, a release-blocking guard that fails when forbidden private-planning paths remain in the repository. The first enforced paths are `docs/commercialization/` and `commercial-addons-local/`, intentionally narrow to catch the current accidental-leak risk without drowning in unrelated historical warnings. Added tests for clean/failing roots and documented the command in commercialization policy docs. Verification passed: targeted tests and `npm run ai:test` -> `329 passed, 0 failed, 1 skipped`. Live command validation also passed in the expected-fail sense: `npm run ai:release:check` exits non-zero on the current private repo because `docs/commercialization/` still exists.

## [2026-03-12 19:15:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: public-release-change-management-20260312
Task Summary: Define an official change-management contract for future OSS publication with private canonical repo, public mirror, allowlist export, and no-manual-push policy
Priority: P0
Status: DONE
Target Files:
- docs/commercialization/PUBLIC_RELEASE_CHANGE_MANAGEMENT.md
- docs/commercialization/README.md
- docs/commercialization/COMMERCIAL_ADDON_BOUNDARY.md
- docs/commercialization/commercial-roadmap.md
Notes: Added a dedicated public-release change-management document. It fixes the target operating model as `private canonical repository -> public mirror repository -> allowlist export -> bot-mediated promotion`, explicitly forbids direct human push to future public protected branches, and states that public release remains blocked until git-host controls can actually enforce that policy. Also linked the new contract from the commercialization README, the OSS/commercial boundary policy, and the commercial roadmap launch gate.

## [2026-03-13 00:10:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: public-export-manifest-20260313
Task Summary: Add a machine-readable allowlist manifest for future public mirror export and verify its integrity in tests
Priority: P0
Status: DONE
Target Files:
- config/public-export-manifest.json
- ai/scripts/__tests__/public-export-manifest.test.js
- docs/commercialization/PUBLIC_RELEASE_CHANGE_MANAGEMENT.md
- docs/commercialization/README.md
- docs/commercialization/commercial-roadmap.md
Notes: Added `config/public-export-manifest.json` as the current internal source of truth for public-safe export paths. The manifest uses an explicit allowlist with required, optional, and forbidden buckets and intentionally keeps runtime state, commercialization docs, local registries, and hub engineering logs out of the future public mirror. Added tests to validate manifest parsing, relative-path hygiene, non-overlapping buckets, and key OSS/private boundaries. Also linked the manifest from the change-management docs and the commercial launch tracker.

## [2026-03-13 00:35:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: commercialization-docs-drift-cleanup-20260313
Task Summary: Clean duplicate commercialization roadmap surface, align launch checklist with real release-check behavior, and tighten the release gate
Priority: P0
Status: DONE
Target Files:
- ai/scripts/check-public-release.js
- ai/scripts/__tests__/check-public-release.test.js
- docs/commercialization/ROADMAP.md
- docs/commercialization/LAUNCH_CHECKLIST.md
- docs/commercialization/README.md
- docs/commercialization/PUBLIC_RELEASE_CHANGE_MANAGEMENT.md
Notes: Cleaned the drift introduced by newly added commercialization docs. `docs/commercialization/ROADMAP.md` is now an explicit superseded redirect instead of a second active roadmap. `LAUNCH_CHECKLIST.md` now reflects the real enforced scope of `npm run ai:release:check`, and the release-check script itself was tightened to require both `LICENSE` and `config/public-export-manifest.json` in addition to forbidden-path checks. Also clarified in docs that secrets/history scanning is still a separate release task and that `commercial-roadmap.md` remains the only canonical roadmap.

## [2026-03-13 00:55:00 UTC] - Model: Codex
Project: ai-hub-coding
Path: /home/kair/ai_agents_coding/ai-hub-coding
Task ID: devsecops-reviewer-proposal-20260313
Task Summary: Add a design proposal for a conditional DevSecOps reviewer role to cover infra, deployment, and security review gaps
Priority: P1
Status: DONE
Target Files:
- ai/design/features/DEVSECOPS_REVIEWER.md
- ai/design/features/README.md
- ai/ROADMAP.md
Notes: Added a new feature proposal for a conditional `devsecops` reviewer role. The recommended MVP is a structured JSON reviewer that joins only infra/security-triggered runs, primarily in the `critique` phase, to assess Docker/K8s/Terraform/CI/CD/secrets/rollback/observability risks without inflating every run. The proposal explicitly separates this role from `reviewer`, `devils-advocate`, and `tester`, and keeps stack-specific deepening as a later follow-up under `Stack-Aware Dynamic Skills`.

### [2026-03-13] DevSecOps Reviewer consensus after Gemini + Claude review

Planned Change: Collapse Gemini and Claude feedback into a single current-consensus baseline and align roadmap priority.

Reason:
- Gemini and Claude now agree on most of the MVP shape.
- The remaining real disagreement is only whether `block` should affect the pipeline immediately.
- The roadmap should reflect that the idea is mostly agreed, but not ahead of active pilot/runtime blockers.

Files:
- `ai/design/features/DEVSECOPS_REVIEWER.md`
- `ai/ROADMAP.md`

Notes:
- Added `Current Consensus (After Gemini + Claude Reviews)` to the design doc.
- Fixed agreed MVP baseline: conditional activation, mandatory file detection, critique-only participation, generic `devsecops` first, and deterministic `activationRules`.
- Recorded the current operating decision that `block` stays informational-only in MVP and should not stop the pipeline yet.
- Moved the roadmap priority from `P1` to `P2`, while keeping the feature active as a future technical enhancement.

### [2026-03-13] Clarify OSS roadmap tracks and immediate next steps

Planned Change: Tag roadmap items as `core` or `shared-enabler` and add a short `Next Steps` block so the near-term execution order is explicit.

Reason:
- The user asked to clearly separate OSS-core work from commercialization-related planning.
- Current priorities were already present, but the roadmap did not explicitly show which nearby items are standalone OSS features versus shared architecture layers.

Files:
- `ai/ROADMAP.md`

Notes:
- Added `Track Tags` section with `core` and `shared-enabler`.
- Added `Next Steps` section for the immediate execution order:
  1. Adaptive Runtime Control Batch 2
  2. pilot rerun on `plta-document-flow`
  3. Adaptive Runtime Control Batch 3a
- Expanded the active features table with a `Track` column so OSS-core and shared-enabler work are visibly separated.

### [2026-03-13] Adaptive Runtime Control Batch 2

Planned Change: Land Batch 2 so checkpoint resume becomes sensitive to effective runtime settings, not just prompt and config file mtimes.

Reason:
- Real runs were still falsely resumable after changing runtime shape via CLI flags or effective limits.
- Batch 2 was the next agreed step after the already landed honest limits summary / honest warning work.

Files:
- `ai/scripts/checkpoint-manager.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/checkpoint-manager.test.js`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/ROADMAP.md`

Notes:
- Checkpoint fingerprint now includes normalized effective runtime settings, not only prompt text plus config mtimes.
- `run-flow.json` now stores those runtime settings, so interrupted runs have an explainable runtime baseline.
- Resume mismatch warnings now say `Runtime settings changed since interrupted run` and list concrete changed knobs when available.
- Landed scope includes effective limits / mode / context-pack active state / index mode / no-tree / redact setting / prepost/test phase toggles.
- After landing Batch 2, the immediate roadmap next step is now pilot rerun first, then Adaptive Runtime Control Batch 3a.

### [2026-03-13] Adaptive Runtime Control Batch 3a

Planned Change: Land a console-only heuristic phase/agent risk forecast from current runtime state, without requiring post-run history or changing pipeline control flow.

Reason:
- Anthropic billing currently blocks a clean pilot rerun, but Batch 3a can still be implemented and verified locally.
- Claude and Codex already agreed on the 3a/3b split: heuristic forecast now, evidence-backed calibration later.
- Operators need to see likely `MAX_TOKENS`, ITPM, and tool-loop pressure before the next phase starts.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/ROADMAP.md`

Notes:
- Wired already-present heuristic helpers into live phase logging for pre-process, proposal, critique, consensus, devil's advocate, and post-process phases.
- Forecast is warn-only and console-only in MVP: it does not change routing or stop the run.
- Forecast uses current runtime state only: estimated input tokens, agent budgets, stored rate-limit snapshot, context-pack state, and tree truncation/tool-loop pressure.
- `main()` now passes tree/context-pack diagnostics into `runAgents(...)`, so the forecast can explain packed-tree pressure honestly.
- Roadmap `Next Steps` now move to Batch 3b first, then pilot rerun once provider balance/workaround is available.

### [2026-03-13] Adaptive Runtime Control Batch 3b

Planned Change: Start recording post-run operational signals in the checkpoint/runtime state so later forecast calibration uses evidence rather than only current-state heuristics.

Reason:
- Batch 3a is now landed, but Batch 4 needs real signals to calibrate forecast quality.
- The hub already produces useful runtime events (preflight waits, retries, repairs, tool-loop exhaustion, incomplete outputs), but they were not normalized into one machine-readable per-run surface.
- This can be implemented without waiting for new provider balance because it works on existing and future runs equally.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/ROADMAP.md`

Notes:
- Added `operationalSignals` capture to the active run state and persisted it into `run-flow.json`.
- Current captured signals include runtime baseline, preflight waits, retries, bounded repair attempts/outcomes, tool-loop exhaustion, and incomplete outputs.
- Signals are also included in saved metrics snapshots so post-run inspection does not require parsing multiple logs manually.
- On failed runs, the top-level catch now persists the collected signals before exiting.
- Roadmap `Next Steps` now move to pilot rerun first, then Batch 4 calibrated forecast.

### [2026-03-13] Rassvet naming clarification

Planned Change: Lock a temporary naming rule so commercialization docs do not accidentally rename the hub/OSS core.

Reason:
- The user explicitly clarified that `Рассвет` / `Rassvet` is only the commercialization subproject name.
- Without a written rule, commercialization documents can start treating it as the main product name by accident.

Files:
- `docs/commercialization/README.md`
- `docs/commercialization/PUBLIC_RELEASE_CHANGE_MANAGEMENT.md`
- `docs/commercialization/commercial-roadmap.md`

Notes:
- Added a short naming rule: `Rassvet` is the commercialization-track codename only.
- The hub/OSS core product name remains undecided and must be named separately later.

### [2026-03-13] Adaptive Runtime Control review polish

Planned Change: Apply the non-blocking review polish from Claude/Gemini before moving on to the next Adaptive Runtime Control batch.

Reason:
- Batch 3a/3b were accepted, but both reviews called out two worth-doing cleanup items:
  approval should not inherit a noisy generic output recommendation if forecasting ever expands there, and heuristic thresholds should stop living as unexplained inline literals.
- This is small enough to land now and keeps Batch 4 calibration work on a cleaner base.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`

Notes:
- Added named forecast constants for context pressure, output pressure, Anthropic ITPM warning bands, and tool-loop pressure.
- Normalized forecast stage handling so `approval` / `approval-*` resolve to a low fixed recommendation (`384`) instead of the generic default.
- Full regression still passes after the cleanup: `npm run ai:test` -> `343 pass, 0 fail, 1 skipped`.

### [2026-03-13] Adaptive Runtime Control Batch 4

Planned Change: Calibrate the phase risk forecast using the `operationalSignals` already collected from recent archived runs, instead of relying only on current-state heuristics.

Reason:
- Batches 3a and 3b are already landed, so the runtime now has enough evidence to upgrade from "heuristic only" warnings to a lightweight calibrated forecast.
- This does not require a fresh paid pilot run: the calibration can use existing `run-flow.json` snapshots from recent runs in `.ai/prompts/runs/`.
- The next operator need is not more raw telemetry, but better phase warnings that reflect repeated truncation, waits, retries, and tool-loop pressure seen in the same project.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/ROADMAP.md`

Notes:
- Added historical signal loading from recent archived runs (`runs/`, with legacy archive fallback only for backward compatibility).
- Added a calibrated forecast layer keyed by `agent + provider + normalized stage`, using recent incomplete outputs, waits, retries, tool-loop exhaustions, and repair failures.
- Phase risk output now explicitly says when it is calibrated with recent run history.
- Full regression passed after the change: `npm run ai:test` -> `346 pass, 0 fail, 1 skipped`.

### [2026-03-13] Adaptive Runtime Control review acceptance

Planned Change: Accept the completed code reviews for landed Adaptive Runtime Control batches and freeze them as the current baseline.

Reason:
- Claude and Gemini both accepted Batch 4 with only non-blocking observations.
- The project needs an explicit marker that Adaptive Runtime Control Batches 3a/3b/4 are review-clean, so the next engineering step can move to Batch 5 instead of re-litigating landed batches.

Files:
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`

Notes:
- Added a short `Current Review Status` block after the Batch 4 reviews.
- Captured that Batches 3a, 3b, and 4 are all accepted by Claude and Gemini.
- Left only three follow-up observations as optional later work: staleness filter, startup I/O optimization, richer signal aggregation.

### [2026-03-13] Adaptive Runtime Control Batch 5

Planned Change: Land runtime-scoped operator overrides between phases with an explicit safety contract.

Reason:
- Batches 1-4 already made the runtime observable and predictable; the next missing control layer is a narrow mid-run override seam.
- Live operator needs already surfaced in real pilot work: bumping an agent output budget or inserting a pause should not require patching code or restarting the whole run.
- The implementation must stay safe: only a tiny set of live overrides is allowed, and everything else must be warned as restart-required or ignored.

Files:
- `ai/scripts/path-utils.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/ROADMAP.md`

Notes:
- Added runtime-scoped override path `.ai/prompts/run/runtime-overrides.json`.
- Landed deterministic safety contract:
  - live-safe: `agents.<name>.maxOutputTokens`, `pauseBeforePhases.<phase>`
  - restart-required/ignored live: context mode, tree/file limit knobs, phase toggles, `contextBudget`, `debatePhases`
- Runtime reloads overrides between phases, warns on malformed/unsupported content, and keeps the last known safe live config instead of aborting.
- Phase wiring is now landed for pre-process, proposal, critique, consensus, approval, revision, devil's advocate, devil's advocate revision, and post-process.
- Successful runs clear the temporary runtime-overrides file before run archival.
- Full regression passed after the change: `npm run ai:test` -> `346 pass, 0 fail, 1 skipped`.

### [2026-03-13] Adaptive Runtime Control operator alias polish

Planned Change: Accept operator-friendly phase aliases for runtime overrides so `test` does not get silently ignored.

Reason:
- The internal tester phase is named `post-process`, but an operator naturally tries `pauseBeforePhases.test`.
- This is a small UX trap in the new Batch 5 override seam and should be fixed now rather than taught as tribal knowledge.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`

Notes:
- Added alias normalization `test` / `tests` / `tester` -> `post-process` for runtime overrides.
- This is a narrow operator-facing compatibility improvement only; the canonical internal phase name remains `post-process`.

### [2026-03-13] Adaptive Runtime Control review close-out polish

Planned Change: Close the remaining Batch 5 review gaps with operator-facing docs and a minimal template file instead of widening the runtime surface.

Reason:
- Claude and Gemini already accepted Batch 5, but two small operator-friction points remained:
  - no example `runtime-overrides.json`
  - no explicit rationale for why `contextBudget` is restart-required
- These are documentation and UX gaps, not pipeline logic gaps.

Files:
- `ai/templates/runtime-overrides.example.json`
- `README.md`
- `AI_WORKFLOW.md`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/ROADMAP.md`

Notes:
- Added a minimal override template file with one safe agent override and one phase pause example.
- Documented the live-safe override set and the reason `contextBudget` remains restart-required.
- Updated roadmap/design status so Batch 5 is explicitly accepted and no longer shows as a pending review step.

### [2026-03-13] Adaptive Runtime Control project-type warning polish

Planned Change: Make environment/context warnings aware of the project's real control surface so non-Node repos stop getting misleading `package.json` noise.

Reason:
- Real Java/Python/Rust/Go/.NET projects were still receiving a generic warning like `missing package.json`, even when a more relevant control file already existed.
- This is exactly the low-risk polish that was intentionally left after the 5-batch MVP: better operator trust without dragging in full language-profile machinery.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/ROADMAP.md`

Notes:
- Added a small control-surface detector for root-level project markers: `package.json`, `pom.xml`, `build.gradle`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, and root `.csproj` / `.sln`.
- `validateEnvironment()` now distinguishes `relevant missing` vs `optional generic defaults`.
- Example: in a Java repo with `pom.xml`, missing `package.json` is now downgraded from warning noise to informational output with a project-type-aware hint.

### [2026-03-13] Local Memory MVP

Planned Change: Land the Phase 1 Local Memory MVP as a real project runtime capability instead of a design-only roadmap item.

Reason:
- Article review identified cross-session memory as the strongest gap in the current hub.
- The runtime already had `memoryWindow`, typed logs, and run archives, but not durable typed recall.
- We needed a local-first implementation that works without cloud services or new external dependencies.

Files:
- `ai/scripts/local-memory.js`
- `ai/scripts/memory.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/path-utils.js`
- `ai/scripts/__tests__/local-memory.test.js`
- `ai/scripts/__tests__/memory-cli.test.js`
- `ai/scripts/__tests__/path-utils.test.js`
- `README.md`
- `AI_WORKFLOW.md`
- `ai/design/features/LOCAL_MEMORY_MVP.md`
- `ai/ROADMAP.md`

Notes:
- Added local SQLite + FTS5 storage in `.ai/memory/memory.db` using built-in `node:sqlite`.
- Added typed entries for `fact`, `decision`, and `episode`, with human-readable Markdown sidecars for `decision` / `episode`.
- Added manual commands:
  - `npm run ai:memory:search`
  - `npm run ai:memory:save`
- Added pre-run typed memory recall into the context bundle.
- Added post-run auto-save heuristics that always persist an episode and conservatively persist detected decision bullets.
- Extended the context cache fingerprint so memory-store changes invalidate stale bundles.

### [2026-03-13] MVP assumption tracking contract

Planned Change: Make MVP assumptions, simplifications, and deferred optimizations explicit in feature design docs, and backfill that structure into already-landed MVP documents.

Reason:
- Review on `Local Memory MVP` surfaced several acceptable shortcuts (`FTS-only`, no schema migration, weak short-token recall) that should not stay buried inside one review block.
- We need a stable way to remember which tradeoffs were accepted for MVP speed so later phases can revisit them systematically.
- The same problem exists in other landed MVPs like `Adaptive Runtime Control` and `Pipeline Hardening`.

Files:
- `ai/design/features/README.md`
- `ai/design/features/LOCAL_MEMORY_MVP.md`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/design/features/PIPELINE_HARDENING.md`

Notes:
- Added a shared design-doc rule: every MVP doc should carry an explicit assumptions/simplifications/deferred-optimizations section.
- Backfilled that section into the three currently landed MVP docs.
- The intent is historical continuity: later phases should mark assumptions as resolved or obsolete instead of silently dropping them.

### [2026-03-13] Pilot blocker fix: refusal false-positive in response validator

Planned Change: Narrow refusal detection so valid analytical answers are not rejected just because they contain phrases like `I cannot point to the exact file`.

Reason:
- A fresh `plta-document-flow` pilot run failed at `architect/proposal` with `completionStatus=invalid`, even though the saved proposal was substantively correct and complete.
- The root cause was a blanket refusal regex matching any `I cannot` anywhere in the answer body.
- This blocked the pilot on a validator false-positive instead of a real model or runtime failure.

Files:
- `ai/scripts/response-validator.js`
- `ai/scripts/__tests__/response-validator.test.js`
- `ai/scripts/__tests__/quality-pipeline.test.js`

Notes:
- Tightened refusal detection to actual refusal-style phrasing instead of arbitrary analytical wording.
- Added regression tests proving that real refusals still fail while valid reasoning with embedded `I cannot` no longer fails.
- After the fix, a fresh `plta-document-flow` pilot run progressed through proposal, critique, consensus, approval, Devil's Advocate, and revised consensus successfully.

### [2026-03-13] Evidence-Grounded Patch Mode

Planned Change: Add a patch-safe final-answer contract so `result.txt` can eventually be trusted as direct implementation output, not only as a strong diagnostic answer.

Reason:
- The latest `plta-document-flow` pilot completed successfully, but it also showed that final answers still mix grounded fixes with hypotheses and unverified seams.
- Current hub quality is now high enough operationally; the next gap is final-answer trust.
- Product goal: if a run emits implementation code, it must either be explicitly patch-safe and evidence-grounded or be downgraded to diagnostic mode.

Files:
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/design/features/README.md`
- `ai/ROADMAP.md`

Notes:
- Added a new P0 core feature focused on patch-safe output.
- The proposed MVP includes explicit `RESULT_MODE`, evidence binding for patch sections, heuristic symbol/seam validation, assumption segregation, and an optional `patch-safe-result.md` artifact.
- This is now the main core follow-up after the successful pilot rerun.

### [2026-03-13] Evidence-Grounded Patch Mode review consensus

Planned Change: Tighten the `Evidence-Grounded Patch Mode` proposal after Claude and Gemini reviews and lock the agreed MVP sequence before implementation starts.

Reason:
- Both review models accepted the feature and confirmed the `P0 core` priority.
- Their main useful change was not scope reduction, but sequencing: start with prompt/format-driven trust contracts before heuristic seam validation.
- We need a stable consensus block so later implementation does not re-open already closed open questions.

Files:
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/ROADMAP.md`

Notes:
- Closed the open questions in favor of: `result.txt` stays narrative, `patch-safe-result.md` is the strict artifact, heuristic validation is sufficient for MVP, and approval / Devil's Advocate may auto-downgrade to `DIAGNOSTIC`.
- Locked the accepted MVP order to `Batch 1 + Batch 2 + Batch 4`, then `Batch 3`, then `Batch 5`.
- Added a `Current Consensus` block to the design doc so future reviewers can read the synthesis directly instead of reconstructing it from separate discussion responses.

### [2026-03-13] Result trust header and user warning baseline

Planned Change: Add an explicit trust header to every `result.txt`, require `result-warning.txt` for non-patch-safe output, and document the current legal/operational responsibility boundary for generated code.

Reason:
- The user-facing contract must warn operators before `Evidence-Grounded Patch Mode` is fully implemented.
- Non-patch-safe answers need a visible runtime warning, not only a design-level future promise.
- We also need a clear product-facing disclaimer that generated outputs must be reviewed and tested before use.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `README.md`
- `AI_WORKFLOW.md`
- `docs/USER_AGREEMENT.md`
- `config/public-export-manifest.json`
- `docs/commercialization/LAUNCH_CHECKLIST.md`
- `docs/commercialization/oss-core-launch-memo-2026-03-22.md`
- `docs/commercialization/review-legal-2026-03-12.md`

Notes:
- `result.txt` now always starts with `RESULT_MODE` and `COPYPASTE_READY`.
- Current baseline is conservative: final operator results default to `RESULT_MODE: DIAGNOSTIC` until patch-safe gating is actually implemented.
- `result-warning.txt` is now the required companion file for non-patch-safe output, not only for weak consensus.
- Added `docs/USER_AGREEMENT.md` as the current responsibility/disclaimer baseline and linked it from runtime docs.
- Synchronized commercialization docs so the release package points to `docs/USER_AGREEMENT.md` instead of an undefined generic `DISCLAIMER`.

### [2026-03-13] Evidence-Grounded Patch Mode implementation start

Planned Change: Start implementation of `Evidence-Grounded Patch Mode` with the agreed prompt/format-first slice before seam validation.

Reason:
- Review consensus explicitly recommended landing `Batch 1 + Batch 2 + Batch 4` first, then moving to heuristic validation.
- We need to stop smooth-looking final answers from mixing grounded fixes and speculative implementation suggestions without an explicit structure.
- This first implementation slice should improve operator trust immediately, even before patch-safe gating is fully available.

Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/prompt-content.test.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/ROADMAP.md`

Notes:
- Consensus and revision prompts now require `Grounded Fixes`, `Assumptions / Unverified Seams`, and `Deferred Checks`.
- Grounded implementation claims now explicitly require `Evidence:` anchors in the prompt contract.
- Runtime now performs a basic format-level check and writes patch-safe contract gaps into `result-warning.txt`.
- This is intentionally not full seam validation yet; that remains the next step (`Batch 3`).

### [2026-03-13] Evidence-Grounded Patch Mode Batch 3

Planned Change: Land heuristic symbol / seam validation and make `RESULT_MODE` depend on a real evidence-grounding gate instead of format warnings alone.

Reason:
- Prompt-level sectioning and `Evidence:` anchors are useful, but they do not yet stop grounded-looking code from drifting into unconfirmed seams.
- The next trust upgrade is to deny `PATCH_SAFE` when evidence anchors point to files not actually observed during the run or when likely project seams are not confirmed by the symbol index / anchored source.
- This closes the main product gap exposed by the `plta-document-flow` pilot: strong diagnosis mixed with patch-looking but weakly grounded code.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/ROADMAP.md`

Notes:
- Tool-loop file reads are now tracked as normalized project-relative evidence files, and run-level evidence also includes files explicitly observed in the context bundle.
- Final trust mode is now decided by a heuristic grounding gate: required sections, explicit evidence anchors, observed evidence files, indexed seam confirmation, and no substantive assumptions.
- `result-warning.txt` now includes both contract gaps and grounding-validation gaps; `PATCH_SAFE` is only granted when both are clean.
- `patch-safe-result.md` is still deferred as `Batch 5`.

### [2026-03-13] Evidence-Grounded Patch Mode Batch 5 and MVP closeout

Planned Change: Add the strict `patch-safe-result.md` artifact and close the MVP for `Evidence-Grounded Patch Mode`.

Reason:
- Once the heuristic trust gate is landed, operators still need a separate apply-ready surface instead of reusing the full narrative `result.txt`.
- The strict artifact must exist only when the gate passes; otherwise the runtime must not leave any misleading stale patch-safe file behind.
- This completes the reviewed MVP boundary and clears the next-slot blocker for the following OSS core feature.

Files:
- `ai/scripts/path-utils.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/scripts/__tests__/path-utils.test.js`
- `README.md`
- `AI_WORKFLOW.md`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/ROADMAP.md`

Notes:
- `.ai/prompts/patch-safe-result.md` is now canonical and written only for `PATCH_SAFE` runs.
- The discussion package also carries `patch-safe-result.md` when present.
- New runs proactively clear stale `patch-safe-result.md` and `result-warning.txt` before execution.
- `Evidence-Grounded Patch Mode` is now `mvp-complete`; richer language-specific validation remains a later follow-up, not part of this MVP.

### [2026-03-13] Tighten MVP assumption handling into explicit risk debt

Planned Change: Make MVP assumption tracking stricter across active design docs.

Reason:
- Claude raised a valid concern that some MVP assumption sections still read like soft notes instead of explicit engineering risk debt.
- For landed and near-landed MVPs we need assumptions to be auditable: why accepted, what risk they carry, and what should trigger reconsideration.
- This should become a standing design contract for all future MVP docs, not a one-off cleanup.

Files:
- `ai/design/features/README.md`
- `ai/design/features/LOCAL_MEMORY_MVP.md`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/design/features/PIPELINE_HARDENING.md`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`

Notes:
- The meta-policy now treats MVP assumptions as `risk debt`, not as vague later-phase ideas.
- Backfilled active MVP docs now record, per assumption: why it was accepted, operator/user risk, revisit trigger, and intended exit path.
- No code behavior changed; this is a design-discipline tightening so future review and pilot findings have a clearer place to land.

### [2026-03-13] Add grep-ast structural search proposal under Answer Depth Improvement

Planned Change: Split out a dedicated design proposal for replacing tree-sitter-centered targeted extraction with grep-ast-style structural search.

Reason:
- The new article review suggests that `tree-sitter` is better treated as a low-level indexing/parser helper than as the long-term answer-depth engine.
- We already landed tree-sitter-backed indexing and symbol snippets, but we did not turn that into real product-quality targeted extraction.
- `Answer Depth Improvement` needs a concrete implementation direction for Lever 1 + 2 instead of abstract "better extraction".

Files:
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/design/features/README.md`
- `ai/ROADMAP.md`
- `ai/design/article-reviews/READING_LOG.md`
- `ai/design/article-reviews/resume_Codex.txt`

Notes:
- The proposal does **not** delete tree-sitter immediately.
- New baseline: tree-sitter stays as optional indexing/helper infrastructure, while structural search becomes the candidate primary engine for targeted extraction and later critique-driven expansion.
- `Answer Depth Improvement` now has an explicit Codex position and `Current Consensus` reflecting this narrower technical direction.

### [2026-03-13] Land first production slice of structural search for Answer Depth Improvement

Planned Change: Move `Grep-AST Structural Search` from design-only status to an in-progress shared-enabler by landing the first adapter-backed production slice.

Reason:
- `Answer Depth Improvement` needed a concrete runtime seam, not just a retrospective on why tree-sitter stayed half-finished.
- The lowest-risk implementation path is additive: introduce a structural-search adapter, keep existing index behavior as fallback, and let Context Pack prefer structural symbol hits when available.
- This gives us real product movement on Lever 1 + Lever 2 without forcing an immediate hard dependency on `grep-ast`.

Files:
- `ai/scripts/structural-search.js`
- `ai/scripts/context-pack.js`
- `ai/scripts/context-index.js`
- `ai/scripts/__tests__/structural-search.test.js`
- `ai/scripts/__tests__/context-pack.test.js`
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/ROADMAP.md`

Notes:
- The first backend is intentionally index-backed; `ast-grep`/`grep-ast` remains the next backend behind the same adapter.
- Context Pack now seeds symbol selection from structural search before classic fallback ranking.
- Full regression passed after landing the slice: `374 pass, 0 fail, 1 skipped`.

### [2026-03-13] Add real ast-grep backend support behind structural-search adapter

Planned Change: Extend the landed structural-search slice with a real `ast-grep` backend path while keeping safe fallback to the existing index-backed backend.

Reason:
- The first slice proved the adapter and Context Pack integration, but we still needed to validate the core architectural claim: structural search should be able to use a real external engine, not only simulated index-backed ranking.
- A direct hard dependency would be too risky, so the backend must be conditional: only use `ast-grep` when a valid binary is present; otherwise fall back cleanly.
- This keeps the migration additive while moving the feature beyond "future backend" status.

Files:
- `ai/scripts/structural-search.js`
- `ai/scripts/__tests__/structural-search.test.js`
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/ROADMAP.md`

Notes:
- Detection explicitly rejects the system `sg -> newgrp` binary and only accepts a binary that identifies itself as `ast-grep`.
- `ast-grep` hits are mapped back to indexed symbols by file/range overlap; if no useful structural hits are produced, the adapter falls back to the index-backed backend.
- Full regression passed after this slice too: `377 pass, 0 fail, 1 skipped`.

### [2026-03-13] Clarify structural-search target direction vs landed default

Planned Change: Record the now-explicit clarification that the accepted
architectural direction (`ast-grep`/structural search as the primary targeted
extraction surface) is not yet identical to the current backend default in
code.

Reason:
- Recent review reading showed an ambiguity between design intent and shipped
  behavior: the review accepted structural search as the promoted direction, but
  the landed MVP intentionally kept `index` as the conservative default backend.
- Without this clarification, later readers can incorrectly infer that
  `ast-grep` is already the default runtime path, when current code still uses
  `index` unless the project explicitly requests `ast-grep` and a valid binary
  is available.
- We want the design doc to reflect the real implementation state precisely
  before any broader default-rollout decision is made.

Files:
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`

Notes:
- The intended end-state remains unchanged: structural search is still the
  primary direction for targeted extraction and for reducing whole-file
  bundling.
- The clarification is purely documentary; it does not yet flip the runtime
  default from `index` to `ast-grep`.

### [2026-03-13] Record pilot results and conclusions directly in the pilot runbook

Planned Change: Turn `ai/PILOT_RUNBOOK.md` from a pure procedure/checklist into
the canonical place for both pilot execution instructions and the resulting
baseline retrospective.

Reason:
- Pilot results and follow-up conclusions were already present across roadmap,
  metrics files, and changelog notes, but not collected in one canonical
  operator-facing document.
- This made it too easy to lose the actual findings after the baseline was met:
  what was proven, what the blocker really was, and which product decisions were
  justified by the pilot.
- The runbook should retain not only the checklist, but also the historical
  outcome of the completed pilot.

Files:
- `ai/PILOT_RUNBOOK.md`

Notes:
- Added a post-pilot section covering:
  - baseline-met date,
  - current stored metrics snapshot,
  - per-project breakdown,
  - validated findings,
  - remaining blockers,
  - decisions taken from the pilot.
- This is documentation-only; no runtime code or metrics files changed.

### [2026-03-13] Clarify in roadmap that a successful pilot rerun already happened

Planned Change: Update `ai/ROADMAP.md` so it does not read as if the only real
pilot rerun is still entirely pending.

Reason:
- The roadmap already recorded baseline closure, but some status lines still
  implied that the live rerun remained wholly ahead of us.
- In reality, a `plta-document-flow` rerun already completed successfully after
  the validator fix; what remains pending is a later post-MVP validation rerun
  after the newest trust/answer-depth changes.
- This distinction matters because operators reading the roadmap should be able
  to tell the difference between `no real rerun happened yet` and `one rerun
  already happened, but another validation pass is still desirable`.

Files:
- `ai/ROADMAP.md`

Notes:
- Updated the pilot status line, Adaptive Runtime Control status wording, the
  `Next Steps` label, and the `Real-project pilot` table row.
- This is documentation-only; no code, tests, or metrics files changed.

### [2026-03-13] Flip structural-search default to ast-grep and add runtime backend diagnostics

Planned Change: Align the landed runtime with the accepted structural-search
direction by preferring `ast-grep` by default while preserving safe fallback to
the index-backed backend, and make the actually used backend visible in runtime
signals.

Reason:
- Review/design consensus already treated structural search as the promoted
  extraction direction, but the landed runtime still defaulted to the
  index-backed backend.
- That mismatch made the code more conservative than the accepted target
  architecture and made live validation ambiguous because operators could not
  easily see which backend actually ran.
- The next safe step is not critique-driven expansion yet; it is to make the
  backend preference honest and observable.

Files:
- `ai/scripts/structural-search.js`
- `ai/scripts/context-index.js`
- `ai/scripts/context-pack.js`
- `ai/scripts/generate-context.js`
- `ai/context.json`
- `examples/nextjs-typescript/ai/context.json.example`
- `ai/scripts/__tests__/structural-search.test.js`
- `ai/scripts/__tests__/context-pack.test.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/ROADMAP.md`

Notes:
- `ast-grep` is now the preferred default backend request path; when no valid
  binary is available, runtime still falls back safely to `index`.
- Context Pack now returns structural-search diagnostics, and runtime records the
  requested/used backend plus fallback state in operational signals.
- Template/example config now explicitly reflects the same backend preference.
- Verification passed: `node --test --test-isolation=none ai/scripts/__tests__/structural-search.test.js ai/scripts/__tests__/context-pack.test.js ai/scripts/__tests__/generate-context.contract.test.js` -> `64 pass, 0 fail, 0 skipped`.

### [2026-03-13] Add archived-prompt structural-search A/B validation harness

Planned Change: Add an offline comparison tool that replays archived pilot
prompts through `Context Pack` with `structuralSearchBackend=index` versus
`structuralSearchBackend=ast-grep`, then records which backend actually ran,
whether fallback occurred, and how much context was packed.

Reason:
- After flipping the runtime preference to `ast-grep`, we still needed a cheap
  validation surface that does not depend on provider billing or a full live
  rerun.
- The key unanswered question was no longer only `did Context Pack work?`, but
  also `did requested ast-grep actually execute or silently fallback to index?`.
- An archived-prompt harness gives a reproducible intermediate validation layer
  for real pilot prompts and makes safe-fallback behavior explicit.

Files:
- `ai/scripts/structural-search-ab.js`
- `ai/scripts/__tests__/structural-search-ab.test.js`
- `package.json`
- `ai/ROADMAP.md`

Notes:
- New command: `npm run ai:structural:ab -- --project-path=/abs/project`.
- The harness compares unique archived prompts from `runs` and/or
  `discussions`, prints per-prompt `backendRequested/backendUsed/fallback`,
  pack usage, selected-symbol counts, pack size, and overlap diagnostics, and
  can emit JSON reports.
- Verification passed: `node --test --test-isolation=none ai/scripts/__tests__/structural-search-ab.test.js ai/scripts/__tests__/structural-search.test.js ai/scripts/__tests__/context-pack.test.js ai/scripts/__tests__/generate-context.contract.test.js` -> `67 pass, 0 fail, 0 skipped`.
- First offline validation run:
  `node ai/scripts/structural-search-ab.js --project-path=/home/kair/platonus/academy/plta-document-flow --limit=5 --symbols=3`
  showed `Context Pack` active and saving about `93.9%` vs full-files baseline,
  but `ast-grep` was not detected on this machine, so requested `ast-grep`
  fell back to `index` on `5/5` prompts with identical packed output.

### [2026-03-13] Fix real ast-grep CLI invocation and validate binary-backed search on pilot prompts

Planned Change: Correct the structural-search adapter to work with the current
`ast-grep` CLI and preserve/prioritize code-like identifiers from raw prompt
text so real `ast-grep` execution is observable on archived pilot prompts, not
just fallback to index.

Reason:
- Installing `ast-grep 0.41.1` proved the binary itself was fine, but the
  adapter still fell back because runtime was calling `ast-grep scan --pattern`
  while the current CLI expects one-off pattern search via
  `ast-grep run --pattern`.
- The first binary-backed rerun also exposed a second issue: query tokens were
  taken from lowercased prompt tokens, which erased `camelCase` / `PascalCase`
  identifiers such as `saveDraft` and `AbstractDocumentHandler`.
- Without fixing both seams, `backendRequested=ast-grep` would remain
  misleading on real long-form prompts even though the binary was installed.

Files:
- `ai/scripts/structural-search.js`
- `ai/scripts/context-pack.js`
- `ai/scripts/structural-search-ab.js`
- `ai/scripts/__tests__/structural-search.test.js`
- `ai/ROADMAP.md`

Notes:
- The adapter now prefers `ast-grep run --pattern ... --json=stream` and falls
  back to legacy `scan --pattern` only for older CLI variants.
- Structural query token selection now uses raw prompt text, preserves case for
  code identifiers, and prioritizes tokens that look like real symbols or match
  indexed names/files.
- Verification passed: `node --test --test-isolation=none ai/scripts/__tests__/structural-search.test.js ai/scripts/__tests__/context-pack.test.js ai/scripts/__tests__/structural-search-ab.test.js ai/scripts/__tests__/generate-context.contract.test.js` -> `69 pass, 0 fail, 0 skipped`.
- Binary-backed validation used local `ast-grep 0.41.1` in `PATH` and reran:
  `npm run ai:structural:ab -- --project-path=/home/kair/platonus/academy/plta-document-flow --limit=5 --symbols=3`
  Result:
  - `backendUsed=ast-grep` on `5/5` archived pilot prompts
  - `fallback=0/5`
  - average packed size `29.9 KB` vs index `30.3 KB`
  - average savings stayed about `94%` vs full-files baseline
  - `identicalPack=2/5`, meaning real `ast-grep` now changes packed context on
    a meaningful share of pilot prompts instead of silently matching the index
    fallback output every time.

### [2026-03-13] Productize ast-grep as an optional bundled dependency with release/compliance coverage

Planned Change: Move `ast-grep` from an ad-hoc external prerequisite to a
first-class optional bundled dependency of the kit, make runtime detect the
local bundled binary without manual `PATH` tweaks, surface availability in
`doctor`, and include explicit third-party notice coverage in release checks.

Reason:
- After proving that real `ast-grep` materially works on pilot prompts, the next
  problem was operational: users should not have to discover and wire the
  binary manually for the default runtime path to work as intended.
- Shipping it as an `optionalDependency` preserves the existing safe-fallback
  behavior for environments where install fails, while making the good path the
  easy path for normal installs.
- If we bundle a third-party binary in our standard install path, compliance and
  public-release controls must require an explicit notices file instead of
  leaving it as an informal side note.

Files:
- `package.json`
- `ai/scripts/structural-search.js`
- `ai/scripts/hub.js`
- `ai/scripts/check-public-release.js`
- `ai/scripts/__tests__/structural-search.test.js`
- `ai/scripts/__tests__/check-public-release.test.js`
- `README.md`
- `THIRD_PARTY_NOTICES.md`
- `docs/commercialization/LAUNCH_CHECKLIST.md`
- `docs/commercialization/PUBLIC_RELEASE_CHANGE_MANAGEMENT.md`
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`

Notes:
- Added `@ast-grep/cli` to `optionalDependencies`, so `npm install` now attempts
  to bring in the structural-search CLI together with the optional parser stack.
- Structural-search detection now checks, in order:
  - `AI_AST_GREP_BIN` override
  - locally bundled `node_modules/.bin/ast-grep`
  - direct `node_modules/@ast-grep/cli/ast-grep`
  - system `ast-grep` / `sg`
- `npm run ai:doctor -- --project-path=...` now reports whether `ast-grep` is
  detected and explains the fallback behavior when it is not.
- Public release check now requires `THIRD_PARTY_NOTICES.md` in addition to
  `LICENSE` and `config/public-export-manifest.json`.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/structural-search.test.js ai/scripts/__tests__/structural-search-ab.test.js ai/scripts/__tests__/context-pack.test.js ai/scripts/__tests__/generate-context.contract.test.js ai/scripts/__tests__/check-public-release.test.js ai/scripts/__tests__/hub-cli.test.js`
  -> `104 pass, 0 fail, 0 skipped`.

### [2026-03-13] Complete live post-MVP rerun with bundled ast-grep and record the real next gap

Planned Change: Execute a live `plta-document-flow` rerun after productizing the
bundled `ast-grep` path, verify that the full runtime uses `ast-grep` without
fallback, and record whether the remaining blocker is still structural-search
validation or has moved to evidence grounding.

Reason:
- Archived-prompt harnesses and offline validation were already enough to prove
  the backend technically worked, but they were still cheaper than the real
  runtime path.
- Once `npm install` made the bundled `node_modules/.bin/ast-grep` available, it
  became possible to validate the full runtime without external PATH hacks.
- We needed to know whether the next roadmap step was still `prove ast-grep`
  or already `improve patch-safe grounding`.

Files:
- `ai/PILOT_RUNBOOK.md`
- `ai/ROADMAP.md`
- `PROJECT_PLANNED_CHANGES.md`

Notes:
- Standard install path verified:
  - `npm install` completed successfully in the kit root
  - `node_modules/.bin/ast-grep --version` -> `ast-grep 0.41.1`
  - `npm run ai:doctor -- --project-path=/home/kair/platonus/academy/plta-document-flow`
    reported `Structural search binary detected: node_modules/.bin/ast-grep`
- Live rerun command:
  `set -a && source .ai.env && set +a && npm run ai -- --project-path=/home/kair/platonus/academy/plta-document-flow --prompt-file=/home/kair/platonus/academy/plta-document-flow/.ai/prompts/runs/run-1773308708834/prompt.txt --task-id=ast-grep-live-validation-20260313 --prepost --test --restart --non-interactive`
- Live runtime result:
  - run id: `run-1773423303550`
  - `structuralSearch.backendRequested=ast-grep`
  - `structuralSearch.backendUsed=ast-grep`
  - `structuralSearch.fallback=false`
  - `structuralSearch.symbolCount=72`
  - `contextPackActive=true`
  - total time `401.18s`
  - agreement `71%`, average confidence `95%`
- Product outcome:
  - structural-search validation is now complete enough for the current stage;
  - final output still landed in `RESULT_MODE: DIAGNOSTIC`, not `PATCH_SAFE`;
  - patch-safe denial was due to evidence-anchor / assumption gaps, so the next
    real work item is grounding precision rather than structural-search proof.

### [2026-03-13] Add structured final-trust telemetry, same-language guardrails, and queue the grounding follow-up discussion

Planned Change: Turn patch-safe trust outcomes into first-class operational
signals, enforce same-language behavior across user-facing agent phases, and
document the next evidence-grounding investigation as an explicit discussion
track rather than leaving it as an implicit TODO.

Reason:
- Operators could see warnings like `Patch-safe grounding gaps detected: 5` in
  the console, but the counts/categories were not normalized into
  `operationalSignals`, which limited analytics and future recommendations.
- Warning details existed in `result-warning.txt`, but that artifact was still a
  human-readable blob rather than a compact structured summary.
- The prompt builders had no hard same-language contract, so Russian prompts
  could still drift into English because the surrounding role instructions were
  written in English.
- After the live `ast-grep` rerun, the real next step is a focused discussion on
  false-negative patch-safe denials, not more structural-search proof work.

Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/prompt-content.test.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `README.md`
- `ai/ROADMAP.md`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`

Notes:
- Added a shared same-language instruction to proposal, critique, consensus,
  approval-review, revision, prompt-engineer, tester, Devil's Advocate, and
  continuation prompts.
- Added structured `finalTrust` telemetry with:
  - `resultMode`
  - `copyPasteReady`
  - `contractGapCount` / `groundingGapCount`
  - gap categories and sample messages
  - evidence-anchor / observed-file / candidate-seam counts
- `result-warning.txt` now includes machine-readable patch-safe gap counts and
  categories in addition to the full warning text.
- Roadmap/design docs now explicitly queue the next discussion:
  understand why the patch-safe gate undercounts evidence from actually read
  files and where DIAGNOSTIC downgrade happens too early.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/prompt-content.test.js ai/scripts/__tests__/generate-context.contract.test.js`
  -> `48 pass, 0 fail, 0 skipped`.

### [2026-03-13] Fix dotted message keys being misclassified as evidence file anchors

Planned Change: Apply the first small implementation slice from the
evidence-grounding investigation by preventing dotted message keys from being
treated as missing files in patch-safe validation, and tighten the consensus
prompt contract so agents stop citing unread files or dotted constants as
evidence anchors.

Reason:
- The live `ast-grep` validation rerun showed a mixed picture:
  - `TemplaterClient.java` / `TemplateListResponse.java` warnings were
    legitimate because those files were not observed in the run context;
  - `error.template.not.found` / `error.document.org.not.found` warnings were
    false positives caused by the evidence-anchor parser.
- This was the cleanest low-risk batch available before broader evidence
  propagation changes.
- It also clarified the next discussion track: under-reporting by
  `observedFiles` remains a hypothesis, while evidence overreach in final
  answers is already proven.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/scripts/__tests__/prompt-content.test.js`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`

Notes:
- Added heuristic filtering so unknown multi-dot constants like
  `error.template.not.found` no longer inflate `missing file` grounding gaps.
- Added a consensus/revision contract rule: do not cite unread files, message
  keys, enum values, or dotted constants as evidence anchors.
- Recorded the investigation outcome in the design doc:
  the inspected live run contained one real parser bug and two legitimate
  unread-file warnings.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/prompt-content.test.js ai/scripts/__tests__/generate-context.contract.test.js`
  -> `49 pass, 0 fail, 0 skipped`.

### [2026-03-13] Tighten grounded-evidence prompt contract against alternative file paths and invented seams

Planned Change: Further narrow `Grounded Fixes` so the synthesizer/revision
phase stops writing alternative file-path guesses and unobserved new
repository/service helper seams as if they were grounded evidence.

Reason:
- The next live run after the dotted-key fix still downgraded to `DIAGNOSTIC`
  for three reasons, two of which were evidence-overreach in the answer:
  - `src/main/java/kz/plta/documentflow/entity/BasicDocument.java` was cited as
    an alternative path even though the real file is under `model/entity`;
  - `approvalRepository.findAllByDocumentIdOrderBySequenceNumberAscForUpdate`
    was proposed as if it were grounded despite being a new seam not observed in
    the context/index.
- These are cheaper to reduce at the prompt-contract layer before adding more
  runtime validator complexity.

Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/__tests__/prompt-content.test.js`

Notes:
- Consensus and revision prompts now explicitly require:
  - one exact path per evidence anchor, no `or/или` alternatives;
  - no new repository/service/helper method names in `Grounded Fixes` unless
    the exact seam was observed in the supplied context.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/prompt-content.test.js`
  -> `9 pass, 0 fail, 0 skipped`.

### [2026-03-13] Add conservative auto-raise for per-stage maxOutputTokens

Planned Change: Land the next small Adaptive Runtime Control slice by applying
`maxOutputTokens` automatically on heavy turns using the existing stage
recommendation logic, but only as a conservative auto-raise layered on top of
current agent budgets.

Reason:
- We already compute per-stage recommended output budgets and warn about
  `MAX_TOKENS` risk, but the runtime still required manual operator action to
  recover from obvious under-budget phases.
- The repo's `agents.json` contains explicit budgets for every role, so the
  safe path is not to replace those budgets wholesale, but to add a narrow
  runtime layer that:
  - never auto-lowers a configured cap,
  - respects runtime overrides as the stronger control surface,
  - keeps bounded repair passes fixed.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `README.md`
- `ai/ROADMAP.md`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`

Notes:
- Added provider-aware conservative ceilings and `AI_CFG__...` knobs for:
  - `AUTO_MAX_OUTPUT_TOKENS_ENABLED`
  - `AUTO_MAX_OUTPUT_TOKENS_CEILING`
  - `AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN`
- Added live console visibility:
  `🛠️ Auto maxOutputTokens: reviewer critique 1536 -> 4096 ...`
- Added persisted telemetry bucket:
  `operationalSignals.outputTokenAdjustments`
- Normalized `*-retry` / `*-tool-budget-final` stages for recommendation
  purposes while keeping `*-repair` passes bounded.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/generate-context.contract.test.js`
  -> `44 pass, 0 fail, 0 skipped`.

### [2026-03-14] Tighten evidence parsing and reduce low-signal runtime pressure without blinding critique

Planned Change: Close the two concrete post-pilot gaps exposed by the latest
live run:
- accept markdown-styled `**Evidence:**` labels in patch-safe validation;
- reduce unnecessary tool churn in `pre-process` while keeping critique quality
  intact.

Reason:
- The latest live rerun produced a false contract gap because the final answer
  used `**Evidence:**` lines, while the validator only accepted plain
  `Evidence:`.
- The same run showed that `prompt-engineer` was burning tokens and tool-loop
  budget on code exploration despite the task already being specific enough for
  prompt enhancement without file reads.
- At the same time, a blunt “disable critique tools” change would likely trade
  cost for lower-quality reasoning. The safer path is to keep critique capable
  of narrow validation, but explicitly de-prioritize speculative concurrency
  advice unless the code directly supports it.

Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/scripts/__tests__/prompt-content.test.js`

Notes:
- `analyzeEvidenceGroundedResultStructure()` and `extractEvidenceAnchors()`
  now accept plain and markdown-styled evidence labels:
  `Evidence:` and `**Evidence:**`.
- `prompt-engineer` now runs with `allowTools: false`; the pre-process phase is
  limited to prompt analysis/enhancement and no longer invites file-reader
  expansion.
- Critique prompts now instruct agents to:
  - request only narrow file ranges for one concrete disagreement at a time;
  - avoid broad exploratory reading;
  - treat race conditions / pessimistic locking as secondary unless the code
    directly shows a concurrency seam.
- Consensus and revision prompts now explicitly require plain `Evidence:` lines
  and forbid promoting concurrency hardening into `Grounded Fixes` without
  direct evidence.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/prompt-content.test.js ai/scripts/__tests__/generate-context.contract.test.js`
  -> `56 pass, 0 fail, 0 skipped`.

### [2026-03-14] Record discussion proposal for evidence-backed debate contracts

Planned Change: Capture the next discussion idea in design docs: debate phases
should not operate on trust alone. Proposal claims and critique objections
should declare their evidence level so consensus can distinguish proven
contradictions from unsupported or merely plausible risks.

Reason:
- Final-answer trust is already evidence-aware, but proposal/critique rounds are
  still rhetorically asymmetrical: a cautious-sounding objection can outweigh a
  grounded claim even when the objection is itself unproven.
- The latest user feedback explicitly called out this failure mode through
  race-condition / pessimistic-locking advice that sounded strong but was not
  yet directly grounded in the inspected code path.
- This belongs under `Phase Contract Normalization`, because it is a phase-level
  output/argument contract question, not just a final-answer validator tweak.

Files:
- `ai/design/features/PHASE_CONTRACT_NORMALIZATION.md`
- `ai/ROADMAP.md`

Notes:
- Added a new discussion track: `Grounded claim` / `Contradiction` /
  `Unsupported claim` / `Risk hypothesis`.
- Explicitly rejected the idea of requiring "irrefutable proof" for every
  concern; the proposed taxonomy is:
  - `proven`
  - `contradicted`
  - `unsupported`
  - `possible-risk`
- Captured an optional future `rebuttal` micro-round for evidence-backed
  objections only.
- No code changes or tests in this step; documentation-only.

### [2026-03-14] Re-prioritize evidence-backed debate contracts as the next batch

Planned Change: Update the public roadmap so `Evidence-Backed Debate Contracts`
is no longer just a discussion note inside `Phase Contract Normalization`, but
the next implementation slice to take after the latest live trust findings.

Reason:
- Live reruns now show that the primary quality gap is no longer structural
  search viability or pilot readiness, but rhetorical downgrade pressure inside
  `proposal` / `critique` / `consensus`.
- Claude and Gemini both support the prompt-level taxonomy MVP and both advise
  postponing any rebuttal round; that makes the next batch both well-scoped and
  low-risk.
- The roadmap should reflect the real sequencing: keep the parent feature at
  `P1`, but move this slice to the top of `Next Steps` because it is the most
  direct path to improving patch-safe outcomes.

Files:
- `ai/ROADMAP.md`

Notes:
- `Phase Contract Normalization` remains a `P1` parent feature in the roadmap
  table.
- `Evidence-Backed Debate Contracts MVP` is now `Next Steps #1`.
- The previous evidence-grounding false-negative investigation remains active,
  but is explicitly positioned as the follow-up after the debate-contract MVP
  reduces rhetorical downgrade noise.
- No code changes or tests in this step; documentation-only.

### [2026-03-14] Expand roadmap sequencing with Claude's staged proposal

Planned Change: Update the roadmap so Claude's suggested expansion is reflected
explicitly as a staged rollout under `Phase Contract Normalization`:
1. `Evidence-Aware Approval Scoring`
2. `Evidence-Backed Debate Contracts`
3. optional `rebuttal` later if the first two slices validate well.

Reason:
- Claude's proposal is not a competing feature; it is a safer Step 1 that uses
  the existing approval/revision loop before asking three debate phases to
  follow a richer evidence taxonomy.
- The roadmap already started to mention approval scoring in `Next Steps`, but
  the parent feature status and roadmap table still described the older
  sequence, which made the plan inconsistent.
- Making the staged rollout explicit keeps the roadmap honest about near-term
  implementation order without inflating this into a separate top-level feature.

Files:
- `ai/ROADMAP.md`

Notes:
- `Evidence-Aware Approval Scoring` stays `Next Steps #1`.
- `Evidence-Backed Debate Contracts MVP` is now explicit `Next Steps #2`.
- `Phase Contract Normalization` remains a single `P1` parent feature in the
  roadmap table, now with the staged sequence spelled out.
- Optional `rebuttal` remains deferred and is not promoted into the near-term
  queue.
- No code changes or tests in this step; documentation-only.

### [2026-03-14] Land evidence-aware approval scoring prompt contract

Planned Change: Implement Step 1 of the staged `Phase Contract Normalization`
trust rollout by making approval review prompts explicitly score evidence
quality, while teaching Devil's Advocate to flag ungrounded grounded-fix claims
more precisely.

Reason:
- This is the lowest-risk way to make internal review less trusting without
  weakening answer quality: it reuses the existing approval -> revision loop
  instead of adding new phases or runtime logic.
- The current gap is not just final-result validation; it is that approval can
  still agree with a plausible draft even when `Grounded Fixes` is weakly
  evidenced.
- User feedback on speculative race-condition advice reinforced the need for a
  sharper distinction between grounded code facts and merely plausible risks.

Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/__tests__/prompt-content.test.js`
- `ai/design/features/PHASE_CONTRACT_NORMALIZATION.md`
- `ai/ROADMAP.md`

Notes:
- `buildConsensusReviewContent()` now instructs approval agents to apply
  evidence-quality penalties before setting the final score:
  - unanchored grounded claims -> `-3`
  - unresolved blocker objections without evidence -> `-2`
  - risk hypotheses treated as proven blockers -> `-2`
  - missing/guessed evidence anchors -> `-1`
- Approval prompts now explicitly say not to penalize items that are clearly
  kept under `Assumptions / Unverified Seams` or `Deferred Checks`.
- `buildDevilsAdvocateContent()` now asks for explicit evidence-discipline
  checking: unanchored grounded claims, guessed/unread anchors, and hypotheses
  overstated as facts.
- Roadmap status now reflects that approval scoring is landed; the next batch is
  typed debate contracts.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/prompt-content.test.js ai/scripts/__tests__/generate-context.contract.test.js`
  -> `58 pass, 0 fail, 0 skipped`.

### [2026-03-14] Land typed debate contracts for proposal/critique/consensus

Planned Change: Implement Step 2 of the staged `Phase Contract Normalization`
trust rollout by extending the evidence contract into `proposal`, `critique`,
`consensus`, and `revision` prompts.

Reason:
- Approval scoring can now penalize weak evidence, but upstream debate phases
  still needed a shared taxonomy so grounded claims are not displaced by vague
  caution or unsupported objections.
- The design discussion converged on a prompt-only MVP: require evidence for
  concrete proposal claims, type critique objections, and teach consensus to
  treat only evidence-backed contradictions as blockers.
- This directly targets the pilot failure mode where plausible but unproven
  critique caused grounded fixes to drift into `Assumptions` and triggered
  `DIAGNOSTIC`.

Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/__tests__/prompt-content.test.js`
- `ai/design/features/PHASE_CONTRACT_NORMALIZATION.md`
- `ai/ROADMAP.md`

Notes:
- `buildProposalContent()` now requires `Evidence:` lines for concrete
  implementation claims and explicit labeling for still-unproven hypotheses.
- `buildCritiqueContentWithProposals()` now requires material objections to be
  typed as `Contradiction`, `Unsupported claim`, or `Risk hypothesis`.
- `buildConsensusContent()` and `buildConsensusRevisionContent()` now instruct
  the synthesizer to trust only evidence-backed contradictions as blockers and
  keep unsupported/risk objections out of `Grounded Fixes` unless later
  confirmed.
- Roadmap status now reflects that typed debate contracts are landed and the
  next near-term step is live validation of remaining patch-safe denials.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/prompt-content.test.js ai/scripts/__tests__/generate-context.contract.test.js`
  -> `59 pass, 0 fail, 0 skipped`.

### [2026-03-14] Refactor shared grounded-output prompt rules

Planned Change: Record the prompt-layer refactor that extracted shared final
output rules into reusable helpers inside `prompt-content.js`.

Reason:
- The evidence/output contract for `consensus` and `revision` had started to
  repeat the same section structure, evidence-format rules, path restrictions,
  seam restrictions, and anti-meta instructions in multiple places.
- Centralizing these rules reduces drift risk: future updates to evidence
  anchors, unread-file restrictions, or no-meta chatter policy now require one
  edit instead of multiple duplicated prompt blocks.
- This is maintenance work supporting the new trust contract, not a new
  roadmap feature by itself.

Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/design/features/PHASE_CONTRACT_NORMALIZATION.md`

Notes:
- Added `buildGroundedFixesOutputContract()` for the shared three-section
  structure and grounded-output rules:
  - `Grounded Fixes` / `Assumptions / Unverified Seams` / `Deferred Checks`
  - plain `Evidence:` format
  - no unread files / dotted constants as anchors
  - no alternative paths / guessed paths
  - no invented seams
  - no unjustified race-condition escalation
- Added `buildNoMetaChatterRules()` for:
  - no `RESULT_MODE` / `COPYPASTE_READY`
  - no process notes or `.ai/logs/*` instructions
  - no meta chatter
- `buildConsensusContent()` and `buildConsensusRevisionContent()` now compose
  these helpers and keep only phase-specific rules locally.
- Roadmap priority/status did not change for this step; it is a maintainability
  refactor within the already-landed trust work.

### [2026-03-14] Pin explicit prompt-named seams in Context Pack

Planned Change: Improve answer-depth precision by making `Context Pack` treat
explicit prompt-named classes, files, and methods as pinned symbols instead of
just soft candidates.

Reason:
- A live rerun on `plta-document-flow` showed the exact failure mode: the prompt
  explicitly named `ApproverFacadeImpl`, `approveDocument`,
  `processApprovalAction`, and `moveQueueForward`, but the packed snippets were
  still dominated by earlier generic `ApprovalSettingController` symbols due to
  index order and snippet-budget truncation.
- Existing retrieval already had soft `fileNameSeeds()` and structural search,
  but explicit seams could still be crowded out before snippet selection.
- The right fix is to promote user-named seams to first-class pins in the final
  snippet list, not merely increase generic scoring further.

Files:
- `ai/scripts/context-pack.js`
- `ai/scripts/__tests__/context-pack.test.js`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/ROADMAP.md`

Notes:
- Added `promptNamedSymbolSeeds()` to extract explicit code identifiers from raw
  prompt text and match them against symbol names / file basenames.
- `buildContextPack()` now adds those named seams to the seed set first and
  pins them ahead of generic graph expansion results via
  `prioritizePinnedSymbols()`.
- This prevents exact prompt-named seams from falling out of `selectedSymbols`
  just because the code index orders other generic symbols earlier.
- Added regression coverage for:
  - explicit class/method extraction from raw prompt text;
  - a tight `maxSnippets` scenario where a named seam must survive generic
    approval/controller noise.
- Verification passed:
  `node --test --test-isolation=none ai/scripts/__tests__/context-pack.test.js`
  -> `21 pass, 0 fail` (test output completed before the shell timeout wrapper).

### [2026-03-14] Package the remaining partial-hotfix failure for cross-model review

Planned Change: Capture the latest `plta-document-flow` failure mode as an
explicit cross-model diagnosis packet so Claude / Gemini / other reviewer
models can evaluate the same evidence and help converge on the next roadmap
move.

Reason:
- The latest live reruns now show a much cleaner state:
  - no contract gaps;
  - named seams from the user prompt are present in the Context Pack;
  - the only remaining blocker is `substantive-assumptions`.
- At this point the problem is no longer obviously a parser bug or retrieval
  miss. It is worth asking external reviewers whether the next step should be
  compare-path logic, critique-driven expansion, or a deeper agentic read loop.
- Without packaging the same artifacts and questions, model feedback will drift
  and be hard to compare.

Files:
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/ROADMAP.md`

Notes:
- Added a new `Cross-Model Diagnosis Packet (2026-03-14)` section to
  `EVIDENCE_GROUNDED_PATCH_MODE.md`.
- The packet includes:
  - exact live-run symptoms
  - concrete reviewer questions
  - a checklist of artifacts to attach
  - a ready reviewer prompt
- Follow-up review feedback from Claude was incorporated:
  - include `*-critique.txt` artifacts (and proposals when available) so debate
    behavior can be evaluated from evidence instead of guessed;
  - prefer parallel single-agent diagnosis runs over one shared debate, to
    avoid cross-model anchoring before root-cause hypotheses are formed.
- `ROADMAP.md` now makes the next follow-up more specific: cross-model
  diagnosis of the remaining `substantive-assumptions` case before choosing the
  next implementation batch.
- No code changes or tests in this step; documentation-only.

### [2026-03-14] Sanitize cross-model diagnosis artifacts and prompt naming

Planned Change: Make the new diagnosis-review materials project-agnostic so
they can be reused with any pilot case without exposing the real project name
or absolute workspace paths in public-facing design docs.

Reason:
- The original diagnosis prompt filename and packet examples were tied to one
  concrete pilot case.
- That made the artifact less reusable and unnecessarily leaked real project
  naming/path details into docs.
- The diagnosis workflow itself is generic and should be expressed as a
  reusable pattern, not as a one-off prompt for a single codebase.

Files:
- `ai/DIAGNOSIS_REVIEW_PROMPT_CASE.md`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- Renamed the prompt artifact from a project-specific filename to the generic
  `ai/DIAGNOSIS_REVIEW_PROMPT_CASE.md`.
- Rewrote the prompt and the cross-model packet to use reusable placeholders:
  - `<PROJECT_ROOT>`
  - `<TASK_ID>`
  - `<RUN_ID>`
- Kept the diagnosis structure and reviewer questions intact, including the
  recommendation to use parallel single-agent reviews.
- Updated the unified model change log so it now points to the new generic
  prompt artifact and explicitly notes that it is project-agnostic.
- No code changes or tests in this step; documentation-only.

### [2026-03-14] Add model-specific follow-up prompts for diagnosis discussion

Planned Change: Create ready-to-paste follow-up discussion prompts for Claude
and Gemini so the next review round can move beyond first-pass diagnosis and
force a concrete choice of the next implementation batch.

Reason:
- The generic diagnosis review prompt is good for the first independent pass,
  but weaker for the second round where we want the models to react to the
  current hypothesis space and converge on one next step.
- Claude and Gemini are now reacting to a narrower question:
  what exactly should be built next after retrieval, trust contracts, and seam
  pinning are already in place.
- A dedicated follow-up prompt reduces drift and makes the second-round output
  easier to compare.

Files:
- `ai/DIAGNOSIS_DISCUSSION_PROMPT_CLAUDE.md`
- `ai/DIAGNOSIS_DISCUSSION_PROMPT_GEMINI.md`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`

Notes:
- Added a Claude-specific prompt that pressure-tests Gemini's
  `conservative bias` hypothesis and forces a single next-batch choice plus a
  falsifiable validation experiment.
- Added a Gemini-specific prompt that asks Gemini to refine its own earlier
  diagnosis into the smallest concrete MVP slice instead of repeating the same
  high-level argument.
- Linked both prompts from the cross-model diagnosis packet so they are
  discoverable where the packet is documented.
- No code changes or tests in this step; documentation-only.

### [2026-03-14] Normalize active docs away from target-project terminology

Planned Change: Clean active documentation so user-facing guidance no longer
describes runs through the old "target project" wording and instead uses
neutral repository/workspace language.

Reason:
- The remaining wording was inconsistent across README, workflow, protocol, and
  design docs.
- `target project` / `active project` phrasing leaked an older mental model
  into current user guidance.
- The runtime contract is still the same, but the documentation should describe
  it in terms of selected repositories and active workspaces rather than
  project-targeting language.

Files:
- `README.md`
- `AI_WORKFLOW.md`
- `HUB_RULES.md`
- `ai/PROTOCOL.md`
- `ai/SYSTEM_PROMPT.md`
- `ai/PILOT_RUNBOOK.md`
- `ai/ROADMAP.md`
- `ai/DOCS_PIPELINE_REVIEW_PROMPT.md`
- `ai/design/features/README.md`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/design/features/STACK_AWARE_DYNAMIC_SKILLS.md`
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `ai/design/features/LANGUAGE_AWARE_ARCH_CHECK.md`
- `ai/design/features/STRUCTURE_RATIONALIZATION.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- Replaced active `target project` / `целевой проект` wording with
  `selected repository` / `выбранный репозиторий` or equivalent repository
  phrasing in current docs.
- Removed the top-level roadmap note that called `ai-hub-coding` the "sole
  active project" and rewrote it as a repository-scoped note.
- Kept archive files and historical logs untouched; this pass is limited to
  active documentation surfaces.
- Verification passed:
  - focused grep over active markdown files returned no remaining matches for
    `target project`, `целевой проект`, `active project`, `sole active
    project`, `real project`, or `real-project`
  - `npm run ai:test` -> `399 pass, 0 fail, 1 skipped`
- No code changes in this step; documentation-only cleanup.


### [2026-03-14] Expand structural extraction window (conservative bias fix)

Planned Change: Widen ast-grep extraction keyhole to include parent class
fields, constructor, imports, and interface signatures alongside matched
methods. Addresses the "conservative bias" root cause identified by cross-model
diagnosis (Gemini CLI + Claude Opus 4.6).

Owner Model: Gemini CLI + Codex
Decision By: Claude Opus 4.6 + Gemini CLI (cross-model diagnosis), approved by operator
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/context-pack.js`
- `ai/scripts/__tests__/context-pack.test.js`

Validation:
- 2 live reruns completed on the same `<TARGET_PROJECT>` prompt
- Result: improved seam reach, but `substantive-assumptions` remained in both reruns

Notes:
- Cross-model diagnosis concluded that the remaining `substantive-assumptions`
  blocker is caused by conservative bias, not retrieval failure or debate
  behavior.
- Implementation landed via Context Pack skeleton extraction; local follow-up
  stabilized omitted-method placeholders and implemented-interface signature
  inclusion.
- Validation outcome: partial success only. The widened keyhole improved
  retrieval depth and reached broader approval-flow seams, but patch-safe
  grounding still failed in both reruns.
- Lever 3 (critique-driven expansion) is now the justified next step.
- Full decision record in `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`.

### [2026-03-14] Narrow docs cleanup to placeholder sanitization only

Planned Change: Revert the earlier broad terminology rewrite in active docs and
apply the intended narrow sanitization only: replace leaked real project names
and absolute project paths in documentation with placeholders such as
`<TARGET_PROJECT>`.

Reason:
- The requested cleanup scope was privacy-oriented, not terminology refactoring.
- The prior broad wording sweep was unnecessary and risked changing doc
  phrasing outside the actual requirement.
- The real objective is to remove public-facing references to concrete external
  project names and paths from documentation surfaces.

Files:
- `ai/PILOT_RUNBOOK.md`
- `ai/ROADMAP.md`
- `ai/design/features/EVIDENCE_GROUNDED_PATCH_MODE.md`
- `ai/design/features/GREP_AST_STRUCTURAL_SEARCH.md`
- `ai/design/features/PIPELINE_HARDENING.md`
- `ai/PIPELINE_HARDENING_REVIEW_PROMPT.md`
- `ai/design/features/STRUCTURE_RATIONALIZATION.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `README.md`
- `AI_WORKFLOW.md`
- `HUB_RULES.md`
- `ai/PROTOCOL.md`
- `ai/SYSTEM_PROMPT.md`
- `ai/DOCS_PIPELINE_REVIEW_PROMPT.md`
- `ai/design/features/README.md`
- `ai/design/features/STACK_AWARE_DYNAMIC_SKILLS.md`
- `ai/design/features/LANGUAGE_AWARE_ARCH_CHECK.md`
- `ai/design/features/ADAPTIVE_RUNTIME_CONTROL.md`
- `ai/DIAGNOSIS_REVIEW_PROMPT_CASE.md`
- `ai/design/features/JIRA_TAKE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- Reverted the earlier `selected repository` / `live repository` terminology
  sweep so active docs are back to their previous wording model.
- Sanitized documentation references to the leaked real target project and
  pilot paths:
  - `plta-document-flow` -> `<TARGET_PROJECT>`
  - `/home/kair/platonus/academy/plta-document-flow` ->
    `/abs/path/to/<TARGET_PROJECT>`
  - additional active doc examples for other external pilot repos were replaced
    with `/abs/path/to/<PILOT_PROJECT_A>` and `/abs/path/to/<PILOT_PROJECT_B>`
- Verification passed:
  - focused grep across documentation surfaces returned no remaining matches for
    `plta-document-flow`, `/home/kair/platonus/academy/plta-document-flow`,
    `/home/kair/wattman/front`, `/home/kair/nornickel/nornickel-master-ref`,
    `wattman/front`, or `nornickel-master-ref`
  - focused grep confirmed the temporary `selected repository` /
    `live-repository` wording was fully removed from active docs
  - `npm run ai:test` -> `399 pass, 0 fail, 1 skipped`



### [2026-03-15] Record Context Skeleton partial success and pivot to Critique-driven Context Expansion (Lever 3)

Planned Change: Document the test results of the Context Skeleton MVP. Acknowledge that the initial context cannot be expanded infinitely (it does not resolve `substantive-assumptions`). Pivot roadmap focus to Critique-driven context expansion (Lever 3).

Reason:
- The test experiment from Gemini (Context Skeleton) yielded only a partial win. The final result remained `patchSafeEligible=no` across two live runs.
- This indicates that "blind" pre-expansion is inherently limited by the single-file view. We need targeted retrieval based on critique concerns.

Files:
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- The roadmap files were already updated by another assistant/operator to reflect this pivot.
- The next implementation slice will be to implement Lever 3: Critique-driven context expansion.

### [2026-03-15] Define narrow Lever 3 MVP after live validation

Planned Change: Convert the post-validation Lever 3 direction into a concrete
MVP contract: structured missing-seam requests from critique/approval, one
bounded structural fetch round, then one focused revision round on the expanded
evidence set.

Reason:
- The live reruns showed that wider same-file context improves retrieval, but
  still leaves `substantive-assumptions` in patch-safe evaluation.
- The remaining blocker is no longer "missing local class context"; it is
  missing targeted contracts such as real approve-path bodies, repository seam
  details, exact mapping sites, and lock feasibility.
- A vague "implement Lever 3" entry is too underspecified to guide a safe
  runtime change.

Target Files:
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/ROADMAP.md`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`

Notes:
- Trigger Lever 3 only when `groundingGapCategories` still contains
  `substantive-assumptions` or critique artifacts explicitly name missing seams.
- MVP bounds: one expansion round, deterministic structural fetch only, no
  recursive dependency walk, no agentic tool loop.
- Success means the same `<TARGET_PROJECT>` case no longer ends with
  `substantive-assumptions`; strong success means `patchSafeEligible=yes`.

### [2026-03-15] Plan Lever 3 implementation batch at code level

Planned Change: Break Lever 3 into a concrete implementation batch for the
existing runtime: approval JSON contract extension, deterministic seam
resolver, one post-approval expansion path, telemetry, and contract tests.

Reason:
- The current docs already justify Lever 3 conceptually, but implementation
  work needs exact file ownership and a low-risk insertion point.
- Code inspection shows the narrowest seam is the existing approval JSON path,
  not a new parser for critique free text.

Target Files:
- `ai/scripts/domain/prompt-content.js`
- `ai/scripts/__tests__/prompt-content.test.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/scripts/structural-search.js` or a new helper for deterministic seam fetch
- matching structural-search tests

Notes:
- Extend approval JSON with optional `missingSeams`.
- Trigger expansion only after the first trust assessment reports
  `substantive-assumptions`.
- Run one bounded expansion round, then revised proposal/critique/synthesis/
  approval on the expanded evidence set.
- Keep old approval payloads backward-compatible.
- Keep `missingSeams` as the single canonical request schema. MVP emitter is
  `approval` only; if `critique` or `devils-advocate` join later, they must use
  the same schema and shared parser/resolver path.


### [2026-03-15] Approve Lever 3 implementation batch

Planned Change: Record approval of the operator's specific runtime batch for Lever 3.

Reason:
- The operator proposed a concrete sequence: extend Approval JSON with \`missingSeams\`, use a deterministic seam resolver, trigger only on \`substantive-assumptions\`, and perform exactly one bounded expansion round.
- This is safer and more robust than parsing free-form critique and perfectly aligns with the safety bounds we established.

Files:
- \`UNIFIED_MODEL_CHANGE_LOG.md\`

Notes:
- The next step is to implement this batch in code: start with \`prompt-content.js\` and its tests.

### [2026-03-15] Pipeline Cost & Efficiency Optimization — design doc for discussion

Planned Change: Create a design document with 7 concrete optimization
proposals identified during a full pipeline efficiency audit by Claude Opus.
Proposals: prompt caching (P0), complexity-based routing (P1), conditional
DA skip (P2), conditional tester skip (P2), skip prompt-enhance on reruns (P2),
reduce maxApprovalRounds to 2 (P2), decompose generate-context.js (P1).

Owner Model: Claude Opus 4.6 (author), open for cross-model discussion
Priority: P1
Status: DISCUSSION
Target Files:
- `ai/design/features/PIPELINE_COST_OPTIMIZATION.md` (new)
- `ai/ROADMAP.md` (added to Active Future Features table)
- `ai/design/features/README.md` (added to index)

Notes:
- Estimated total savings: -20-63% per run depending on scenario.
- Prompt caching (P0) is the cheapest to implement with highest ROI.
- Complexity routing (P1) gives biggest savings but needs a classifier.
- No changes to pipeline code — design doc only, open for discussion.


### [2026-03-15] Future Workflow & Hub Optimization (Discussion)

Planned Change: Propose and track future Hub-level optimizations: Semantic Ranking, Log Compaction, Agentic Tool Loop (Lever 4), and a Unified Logging Utility.

Reason:
- To bridge the "Junior-Developer" behavior (blind patching) with Senior-level architectural verification.
- To reduce "Context Drift" in long-running sessions and improve retrieval precision beyond simple token matching.

Files:
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md` (Proposals recorded)

Notes:
- This is a placeholder for future discussion. Immediate priority remains Lever 3 (Critique-driven context expansion).

### [2026-03-15] Tighten Lever 3 after live MVP validation

Planned Change: Record the post-validation outcome of Lever 3 MVP and narrow
the next batch to seam-request precision plus approval structured-output
hardening.

Reason:
- The runtime trigger bug is now fixed, and a successful live rerun proved that
  the post-approval expansion path actually executes.
- However, the expanded round still ended with `patchSafeEligible=no` and the
  tester still returned `NEEDS_REVISION (4/10)`.
- The fetched seams were too coarse: approval requested class/file-level seams
  such as `ApproverFacadeImpl` and `ApprovalInstanceRepository`, and the
  resolver legally returned class/header-heavy slices instead of the still-
  missing approval-chain generation seam in `AbstractDocumentHandler`.
- A separate live rerun also failed earlier because approval JSON degraded into
  markdown, which exposed a structured-output fragility that should be hardened
  before more live validation.

Target Files:
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- Next implementation batch:
  - method-first `missingSeams` requests (`Class#method`, exact symbol, or
    narrow line-range hint)
  - no fallback from method-shaped requests to class headers; unresolved
    requests should be skipped and logged
  - one bounded retry/repair path for invalid approval JSON before the run
    aborts
- Keep unchanged:
  - `approval` remains the only MVP emitter
  - `missingSeams` remains the only schema
  - no wider default keyhole
  - no critique/devils-advocate emitter yet
  - no recursive fetch and no agentic tool loop
- Reviewed colleague proposals:
  - Gemini's broader workflow ideas (semantic ranking, context compaction,
    Lever 4) remain future discussion
  - Claude's pipeline cost optimizations remain valuable but orthogonal; they
    should not preempt Lever 3 precision


### [2026-03-15] Add user-facing prompt authoring rules and plan prompt-scope awareness

Planned Change: Document how operators should write investigation prompts so
listed methods/files are treated as starting seams rather than accidental hard
scope, and record the next UX/runtime batch for Prompt Engineer scope-risk
warnings.

Reason:
- Live answer-depth validation showed that explicitly named methods in the user
  prompt are strongly prioritized by structural search and Context Pack.
- This improves focus, but can also bias the initial retrieval window toward a
  too-local slice and increase the chance of shallow diagnosis.
- The right operator guidance is now clear: distinguish `starting seams` from
  `hard scope`, and make root-cause prompts explicitly allow minimal
  upstream/downstream tracing.

Target Files:
- `README.md`
- `AI_WORKFLOW.md`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- User-facing guidance added now:
  - how to write root-cause prompts
  - how to write intentionally narrow patch prompts
  - why over-constrained prompts can degrade answer depth
- Next planned implementation batch:
  - Prompt Engineer emits an explicit scope-risk signal when the prompt names
    narrow seams in a way that may accidentally suppress related code paths
  - runtime surfaces a warning instead of silently relying on implicit bias
  - optional broadened prompt suggestion may be offered, but explicit hard scope
    from the user must remain authoritative


### [2026-03-15] Strategic Priority Confirmation: Precision over Width

Planned Change: Record the confirmed strategic priority: **Lever 3 Precision**. Focus on method-first requests, no header fallback, and approval JSON hardening.

Reason:
- Live validation on \`<TARGET_PROJECT>\` shows that "blind" or coarse context expansion is insufficient to clear \`substantive-assumptions\`.
- The current primary blocker is fetch precision (getting class headers instead of specific methods) and structured-output fragility.
- High-level cost optimizations and broader workflow changes are valuable but must not preempt the grounding precision required for \`patchSafeEligible=yes\`.

Files:
- \`ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md\` (Strategic Synthesis recorded)
- \`UNIFIED_MODEL_CHANGE_LOG.md\` (Confirmation logged)

Notes:
- The next coding batch is to harden the approval stage and implement method-first seam resolution.
- Evaluation status: 9/10 efficiency (solving high-complexity grounding problems).


### [2026-03-15] Offline answer-depth follow-up while pilot quotas are exhausted

Planned Change: Keep answer-depth validation moving without fresh pilot runs by
building a local golden-case regression harness and by preparing the next
partial-run salvage batch.

Reason:
- Current live validation is blocked by exhausted provider balances on the
  active pilots.
- We already have enough historical artifacts (`narrow`, `broadened`,
  `targeted`) to regression-check prompt-scope warnings, tester scores, and
  patch-safe warning shape offline.
- The next operator pain point is not diagnosis, but losing too much signal
  when a live run aborts mid-flight on provider quota.

Target Files:
- `ai/scripts/run-artifact-summary.js`
- `ai/scripts/run-artifact-regression.js`
- `ai/scripts/__tests__/fixtures/run-artifacts/`
- `ai/ROADMAP.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`

Notes:
- Landed now:
  - golden-case local fixtures for `narrow`, `broadened`, and `targeted`
  - offline regression report over those fixtures
  - provider quota exhaustion detection with early retry abort
  - partial-run salvage via `run-flow.json` autodiscovery and failure-shape classification (`provider_length`, `quota_exhausted`)
- Next offline batch:
  - keep a second validation case prepared for when balances return


### [2026-03-15] Reprioritize next window: tech debt first, second validation case second

Planned Change: Reorder the immediate roadmap now that the narrow provider-hardening batch is landed.

Reason:
- The quality stack has enough direct features for now; the main risk is adding
  more logic on top of a swollen orchestrator.
- Claude's offline-harness review correctly identifies `generate-context.js`
  size as the next maintainability blocker.
- Answer-depth still needs a second validation case, but preparing that case is
  safer after at least the first decomposition slice is underway.

Target Files:
- `ai/ROADMAP.md`
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- New order:
  1. orchestrator tech debt reduction
  2. second validation case preparation
  3. only low-risk offline support tasks until balances return
- Explicitly not next:
  - new quality levers
  - wider context expansion
  - cost-optimization rollout ahead of decomposition

### [2026-03-16] Prepare second validation case dossier after two safe decomposition slices

Planned Change: Freeze a concrete second validation case for Answer Depth before balances return.

Reason:
- Two bounded decomposition slices are now landed, so the next useful offline
  step should become product-facing again rather than staying purely infra.
- One `<TARGET_PROJECT>` case still cannot prove generalization.
- The second case should be materially different in reasoning shape, not just
  another Java workflow bug.

Target Files:
- `ai/design/features/ANSWER_DEPTH_IMPROVEMENT.md`
- `ai/specs/answer-depth-validation-cases.json`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- Chosen case shape: another Java project, but with lifecycle/status
  synchronization reasoning on `<SECOND_VALIDATION_PROJECT>` instead of
  approval-route generation.
- The dossier should record:
  - prompt draft
  - starting seams
  - expected grounded seams
  - success criteria
  - failure signals
- No live run yet; this is preparation only while provider balances remain
  unavailable.


### [2026-03-16] First decomposition slice landed; next slice still belongs to tech debt track

Planned Change: Continue the `generate-context.js` decomposition after the first safe extraction moved final trust / result-artifact helpers into a separate module.

Reason:
- This starts paying down the main orchestrator tech debt without touching proposal/critique/approval sequencing yet.
- The extracted slice was already well covered by contract tests and had few runtime call sites, so it was the safest place to start.
- The next window should keep the same discipline: pull out cohesive helper clusters, not orchestration branches.

Target Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/domain/final-result-trust.js`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`

Notes:
- Landed now:
  - `final trust / result artifact` helpers extracted out of `generate-context.js`
  - backward-compatible re-export kept through `generate-context.js`
- Next slice candidates:
  1. discussion/package artifact writers
  2. operational signal helpers
  3. runtime summary / warning builders
- Still not next:
  - orchestration-core surgery inside `runAgents(...)`
  - new answer-depth levers before second validation case prep

## [2026-03-17 00:00:00 UTC] - Project: ai-hub-coding
Planned Change: User Outcome Feedback Loop — structured post-run rating (1-5) with optional git diff capture, trust calibration, and future ground truth for local model fine-tuning.
Owner Model: Claude Opus 4.6
Priority: P1
Status: PLANNED
Target Files:
- `ai/design/features/USER_OUTCOME_FEEDBACK.md` (design doc, created)
- `ai/scripts/feedback.js` (future: CLI command for deferred feedback)
- `ai/scripts/generate-context.js` (future: post-run interactive prompt integration)
- `.ai/feedback/{runId}/outcome.json` (future: per-run outcome storage)
Notes:
- MVP scope: structured 1-5 rating + `ai:feedback` CLI + diff capture + basic calibration report
- Phase 2: trust gate calibration using accumulated outcomes vs hub predictions
- Phase 3: ground truth pairs for local model fine-tuning (needs 50+ pairs)
- Dependencies: Local Memory MVP (landed), Evidence-Grounded Patch Mode (landed)

## [2026-03-17 16:19:15 UTC] - Project: ai-hub-coding
Planned Change: Approval Phase Resilience — Interactive Retry + Checkpoint Resume. Fix crash on provider timeout in approval rounds and add checkpoint resume so approval progress is not lost on restart.
Owner Model: Claude Opus 4.6
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/generate-context.js` (phaseOrder, approval resume, interactive retry, incomplete result handling, checkpoint completion)
- `ai/scripts/__tests__/checkpoint-manager.test.js` (6 new tests)
Notes:
- Root cause: Google reviewer timeout → Promise.all kills pipeline; no approval in phaseOrder → resume skips to DA
- Fix: try-catch with interactive retry/stop around approval round; approval added to phaseOrder; checkpoint resume for completed approval
- All 448 tests pass

## [2026-03-17 19:13:56 UTC] - Project: ai-hub-coding
Planned Change: Sanitize agent log/meta chatter from proposal and critique outputs. Apply sanitizeUserFacingFinalText to all 4 proposal/critique save points (main + Lever3) so internal log sections don't leak into artifacts.
Owner Model: Claude Opus 4.6
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/generate-context.js` (4 sanitization points + improved log-ref cut)
Notes:
- Problem: architect (Claude) leaks ### Логи sections and .ai/logs/ references into proposals/critiques
- Fix: same sanitizer already used for consensus/revision now applied to proposals/critiques
- All 448 tests pass

## [2026-03-17 19:13:56 UTC] - Project: ai-hub-coding
Planned Change: Log & Context Growth Management — strategy for managing indefinitely-growing log files (ai/logs/AI_*.md) and run archives (.ai/prompts/runs/). Context bundle already protected by windowed reads (10 entries, 9KB cap). Disk-side growth needs a plan.
Owner Model: Claude Opus 4.6
Priority: P2
Status: PLANNED
Target Files:
- `ai/scripts/cleanup.js` (future: auto-prune run archive)
- `ai/scripts/generate-context.js` (future: log rotation or archival)
- `ai/ROADMAP.md` (recorded)
Notes:
- Current state: context bundle ~23KB (well under 250KB cap), no token overload risk
- Disk-side: log files append forever, run archive prune is manual only (npm run ai:clean)
- Options: automatic log rotation (archive >30 days), auto-prune runs (keep last N), per-project disk budget
- Not urgent — deferred until disk growth becomes measurable problem on real projects

## [2026-03-17 19:21:04 UTC] - Project: ai-hub-coding
Planned Change: Revision Skip Gate — skip revision round when approval disagreements are purely evidence-gap (missingSeams > 0, no factual errors in Grounded Fixes). Go straight to Lever 3 fetch instead. Saves ~1 LLM call per evidence-gap run.
Owner Model: Claude Opus 4.6
Priority: P1
Status: PLANNED
Target Files:
- `ai/scripts/generate-context.js` (future: revision skip condition in approval loop)
- `ai/design/features/ROUND_ORCHESTRATION_RATIONALIZATION.md` (observation + proposal recorded)
Notes:
- Evidence: nornick run-1773773250415, synthesizer-consensus.txt vs synthesizer-revised.txt — revision produced zero grounded improvement, only cosmetic rephrasing + one speculative assumption block
- Phase 2 candidate for Round Orchestration Rationalization
- Depends on Phase 1 telemetry baseline (10+ runs)

## [2026-03-18 08:15:00 UTC] - Project: ai-hub-coding
Planned Change: Fix Lever 3 seam deduplication — dedup key should use symbolOrSeam only (ignore fetchHint). Currently same method requested by two agents with different fetchHint text creates two entries, wasting maxItems budget.
Owner Model: Claude Opus 4.6
Priority: P0
Status: COMPLETED (2026-03-18)
Target Files:
- `ai/scripts/critique-expansion.js` (normalizeMissingSeams: change dedup key from `symbolOrSeam|fetchHint` to `symbolOrSeam` only)
- `ai/scripts/__tests__/critique-expansion.test.js` (test: same symbol different fetchHint → single entry)
Notes:
- Root cause: nornick run-1773773250415 — reviewer and developer both requested clearReserves and validateForRevokePossibility but with different fetchHint text → 4 dedup slots consumed instead of 2 → developer's unique seams (getEditableOrder, MtfCalculationService#calculate) dropped by maxItems=4 cap
- Part of Lever 3 Precision Batch
- When two agents request the same symbolOrSeam, keep the one with higher-quality fetchHint (method-scoped > class-scoped > vague)
- COMPLETED: dedup key changed to symbolOrSeam only, priority-based winner selection implemented

## [2026-03-18 08:15:00 UTC] - Project: ai-hub-coding
Planned Change: Raise Lever 3 maxItems cap from 4 to 6-8 (or dynamic: unique symbolOrSeam count, capped at 8). Current hard cap of 4 is too small when multiple approval agents each request 3-4 unique seams.
Owner Model: Claude Opus 4.6
Priority: P0
Status: COMPLETED (2026-03-18)
Target Files:
- `ai/scripts/critique-expansion.js` (normalizeMissingSeams: raise DEFAULT_MAX_MISSING_SEAMS or make dynamic)
- `ai/context.json` (critiqueExpansionMaxRequests default value)
- `ai/scripts/__tests__/critique-expansion.test.js` (test: 6+ unique seams all preserved)
Notes:
- Even after dedup fix, 6 unique seams from 2 agents would be capped to 4
- Dynamic approach: min(unique_symbolOrSeam_count, 8) — never fetches more than 8 but doesn't artificially drop valid requests
- Part of Lever 3 Precision Batch
- COMPLETED: DEFAULT_MAX_MISSING_SEAMS raised from 4 to 6, generate-context.js fallbacks updated to match

## [2026-03-18 16:00:00 UTC] - Project: ai-hub-coding
Planned Change: Lever 3 Precision Batch — seam resolution improvements, pipeline crash resilience, output sanitization, DA-revision fallback, seam expansion checkpoint
Owner Model: Claude Opus 4.6
Priority: P0
Status: COMPLETED (2026-03-18)
Target Files:
- `ai/scripts/critique-expansion.js` (owner-body fallback, getter/setter token variants, readBoundedRangeAroundTokenVariants)
- `ai/scripts/generate-context.js` (Promise.allSettled for parallel agents, partial results guards, DA-revision graceful fallback, seam expansion checkpoint, output sanitization fixes)
- `ai/scripts/infrastructure/providers.js` (Gemini MALFORMED_FUNCTION_CALL retryable, safety block non-retryable)
- `ai/scripts/__tests__/critique-expansion.test.js` (owner-body fallback tests, getter/setter variant test)
- `ai/scripts/__tests__/generate-context.contract.test.js` (h2 Логи sanitization test, AI log block sanitization test)
- `ai/scripts/__tests__/checkpoint-manager.test.js` (seam expansion checkpoint test)
Notes:
- Owner-body fallback: when scoped method (Class#method) not in AST index and token search fails, reads entire owner class body
- buildTokenVariants: orderContainerId → getOrderContainerId/setOrderContainerId/isOrderContainerId
- readBoundedRangeAroundTokenVariants: reads file once for all token variants (was re-reading per variant)
- Promise.allSettled: one agent crash no longer kills all parallel agents
- Gemini MALFORMED_FUNCTION_CALL: marked retryable, withRetry handles it
- Cyrillic \b regex fix: \b after Логи never matched (Cyrillic is \W), moved \b to Logs only
- H2 sanitization: #{2,3} instead of ### to catch ## Логи
- DA-revision fallback: keeps pre-DA consensus result instead of crashing on empty synthesizer response
- Seam expansion checkpoint: post-expansion-N.txt saved after each round, consensus checkpoint updated
- Pilot result: 5/8 seams fetched, 3 skipped due to agent errors (wrong owner class), not resolution bugs
- All 448+ tests pass

## [2026-03-18 20:00:00 UTC] - Project: ai-hub-coding
Planned Change: Orchestrator Tech Debt — Batch 4 decomposition of generate-context.js (extract operational-signals, seam-decision, runtime-display modules)
Owner Model: Claude Opus 4.6
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/domain/operational-signals.js` (NEW)
- `ai/scripts/domain/seam-decision.js` (NEW)
- `ai/scripts/domain/runtime-display.js` (NEW)
- `ai/scripts/generate-context.js` (modified: -577 lines)
Notes:
- 6482 → 5905 lines; cumulative 7079 → 5905 across Batches 1-4
- 8 extraction modules total
- 455 tests pass

## [2026-03-18 21:00:00 UTC] - Project: ai-hub-coding
Planned Change: Orchestrator Tech Debt — Batch 5 decomposition (extract rate-limit + token estimation into infrastructure/rate-limit.js)
Owner Model: Claude Opus 4.6
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/infrastructure/rate-limit.js` (NEW)
- `ai/scripts/generate-context.js` (modified: -149 lines)
Notes:
- 5905 → 5756 lines; cumulative 7079 → 5756 across Batches 1-5
- 9 extraction modules total
- 455 tests pass

## [2026-03-18 21:30:00 UTC] - Project: ai-hub-coding
Planned Change: Discussion log windowing — cap discussion log at 120KB, drop oldest entries when exceeded
Owner Model: Claude Opus 4.6
Priority: P2
Status: DONE
Target Files:
- `ai/scripts/domain/discussion-log.js` (modified)
- `ai/scripts/__tests__/discussion-log.test.js` (5 new tests)
Notes:
- Previously unbounded (50-150KB+ in expansion-heavy runs)
- Backward compatible: default maxBytes=120KB
- 460 tests pass

## [2026-03-18 22:30:00 UTC] - Project: ai-hub-coding
Planned Change: loadRun() mtime-based caching — avoid redundant run-flow.json reads during pipeline execution
Owner Model: Claude Opus 4.6
Priority: P2
Status: DONE
Target Files:
- `ai/scripts/checkpoint-manager.js` (modified: cache logic added)
- `ai/scripts/__tests__/checkpoint-manager.test.js` (4 new tests)
Notes:
- Cache keyed by absolute path, validated by file mtime, deep-cloned on hit
- Invalidated by writeFlowAtomic, clearRun, archiveRun
- 464 tests pass

## [2026-03-18 22:00:00 UTC] - Project: ai-hub-coding
Planned Change: Approval repair checkpoint tracking — persist `repaired` flag in checkpoint metadata for approval agents
Owner Model: Claude Opus 4.6
Priority: P2
Status: DONE
Target Files:
- `ai/scripts/generate-context.js` (modified: 2 additions)
Notes:
- `repairAttempted: true` in `reviewResponse.meta` after JSON repair
- `repaired` boolean in `checkpoint.updatePhaseAgent` call
- 460 tests pass

## [2026-03-18 23:00:00 UTC] - Project: ai-hub-coding
Planned Change: Wire second validation case (backend-java-lifecycle-sync) into golden-manifest and regression harness
Owner Model: Claude Opus 4.6
Priority: P2
Status: DONE
Target Files:
- `ai/scripts/__tests__/fixtures/run-artifacts/golden-manifest.json` (added pending case)
- `ai/scripts/run-artifact-regression.js` (skip pending cases)
Notes:
- Case dossier already prepared in ANSWER_DEPTH_IMPROVEMENT.md and answer-depth-validation-cases.json
- Harness now supports `status: "pending"` entries — activated when live run artifacts are available
- 464 tests pass

## [2026-03-19 19:10:39 UTC] - Project: ai-hub-coding
Planned Change: Batch 11 decomposition of generate-context.js — extract context-bundle, memory-context, io-wrappers, bootstrap modules
Owner Model: Claude Opus 4.6
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/domain/context-bundle.js` (NEW)
- `ai/scripts/domain/memory-context.js` (NEW)
- `ai/scripts/infrastructure/io-wrappers.js` (NEW)
- `ai/scripts/domain/bootstrap.js` (NEW)
- `ai/scripts/generate-context.js` (modified)
Notes:
- 36 functions extracted across 4 slices
- generate-context.js: 4882 → 4636 lines
- Cumulative: 7079 → 4636 lines (-34.5%), 19 extraction modules
- 464 tests pass

## [2026-03-20 18:58:45 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge — enrich symbol index with outline/container/call graph, formalize context levels, auto-detect project stack
Owner Model: Claude Opus 4.6
Priority: P1
Status: PLANNED
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md` (design doc, created)
- `ai/scripts/context-index.js` (Phase 1: symbol enrichment, outline, call graph)
- `ai/scripts/context-index-treesitter.js` (Phase 1: AST extraction of container, params, returnType)
- `ai/scripts/context-pack.js` (Phase 3: L0/L1/L2 context levels)
- `ai/scripts/init-project.js` (Phase 2: auto stack detection, llms.md generation)
- `ai/scripts/critique-expansion.js` (Phase 4: seam precision with enriched index)
Notes:
- 5 phases: enriched index → auto stack detect → context levels → seam precision → optional LSP
- Phase 1 (tree-sitter enrichment) is P0, estimated 80% of token savings
- No IDE dependency — tree-sitter works universally for 40+ languages
- LSP (Phase 5) deferred until Phases 1-4 validated

## [2026-03-21 00:00:00 UTC] - Project: ai-hub-coding
Planned Change: Add Codex review comments to Semantic Context Bridge design proposal and narrow the MVP discussion boundary before implementation.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added Codex position directly in the design doc: keep CLI-first Level A as the main MVP, prefer `.ai/stack-profile.json` over `llms.md` as the canonical machine-readable stack artifact, split Phase 1 by risk, and delay approximate call graph until outline/container + context levels are proven
- Explicitly called out monorepo scope detection, brand-new project bootstrap, trust labels for bridge data, and bounded CLI contracts as pre-implementation requirements

## [2026-03-21 00:00:00 UTC] - Project: ai-hub-coding
Planned Change: Align Semantic Context Bridge Phase 2 wording with the accepted stack-profile consensus and clarify the retained role of `ai/llms.md`.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Fixed the remaining inconsistency where Phase 2 still described stack detection as writing directly to `llms.md`
- Clarified that `.ai/stack-profile.json` is canonical and `ai/llms.md` remains a derived human-readable and compatibility artifact

## [2026-03-21 00:00:00 UTC] - Project: ai-hub-coding
Planned Change: Add arbitration verdict to Semantic Context Bridge discussion after Gemini DA review and Claude response.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added a third-party arbitration section that keeps Claude's overall MVP corridor, accepts Gemini's strongest practical objections, and adds one explicit guard: call-graph-based expansion must not be enabled by default for dynamic languages in the MVP

## [2026-03-21 00:00:00 UTC] - Project: ai-hub-coding
Planned Change: Implement Semantic Context Bridge Batch 1 — generate canonical `.ai/stack-profile.json`, derive `ai/llms.md`, and expose the new artifact through bootstrap-generated context.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/domain/stack-profile.js`
- `ai/scripts/init-project.js`
- `ai/scripts/__tests__/init-project.test.js`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added a dedicated domain module for deterministic stack detection and human-readable summary generation
- `ai:init` now emits `.ai/stack-profile.json` as canonical source of truth while keeping `ai/llms.md` as derived output
- Generated `context.json` now includes the stack profile artifact so the runtime can see it without relying only on markdown
- Verification passed: targeted `init-project` tests and full `npm run ai:test` (`469 tests`, `468 pass`, `0 fail`, `1 skipped`)

## [2026-03-19 12:00:00 UTC] - Project: ai-hub-coding
Planned Change: Add Gemini CLI position and architectural alignment to Semantic Context Bridge design proposal.
Owner Model: Gemini CLI
Priority: P1
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added Gemini CLI position directly in the design doc: fully supported the IDE-less Level A feasibility using `tree-sitter`.
- Recommended using heuristics based on file extensions and dependency files for automatic stack and platform recognition, supporting Codex's `stack-profile.json` idea.
- Proposed updating agent prompts (`SYSTEM_PROMPT.md`) to force skeleton-first file reading workflows, aligning perfectly with `ai-hub-coding` token optimization and context-level controls.

## [2026-03-19 12:30:00 UTC] - Project: ai-hub-coding
Planned Change: Add Devil's Advocate review from Gemini CLI to Semantic Context Bridge design proposal.
Owner Model: Gemini CLI
Priority: P1
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Performed a Devil's Advocate critique highlighting 5 major flaws: Illusion of CLI limiting, Latency/Token Accumulation (Налог на раунд-трипы), OOP-centricity ignoring JS functional/closure patterns, Hallucination risks of Approximate Call Graphs (Phase 1C), and Monorepo Scope Blindness.
- Recommended concrete adjustments: implement smart Context Pack (bypass outline for small files), enforce "virtual containers" (arrow functions/React components) in Phase 1A, and freeze Phase 1C for tree-sitter.

## [2026-03-19 13:00:00 UTC] - Project: ai-hub-coding
Planned Change: Finalize design review for Semantic Context Bridge.
Owner Model: Gemini CLI
Priority: P1
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Accepted the Consolidated Arbitration Outcome by Codex.
- Fully supported the strict language-based guards for Call Graph expansion (Phase 1C).
- Countered Claude's statement on "No extra round-trips" by highlighting that omitting needed methods initially (L0 only) shifts the latency burden to the seam expansion phase. Confirmed that the small-file full-inclusion heuristic is a critical architectural requirement, not just an optimization.

## [2026-03-21 12:00:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge — design review complete, ready for implementation.
Owner Model: Claude Opus 4.6
Priority: P1
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
- `ai/ROADMAP.md`
Notes:
- Full 3-model debate completed: Claude (proposal + response to DA), Codex (review + arbitration), Gemini (review + DA + final acceptance)
- Consensus reached on 7 mandatory MVP items: stack-profile.json, derived llms.md, outline+container enrichment, L0/L1/L2 as orchestrator policy, small-file heuristic, virtual containers, call graph disabled for dynamic langs
- 3 items deferred: dynamic monorepo scope routing, LSP daemon, broad semantic references
- 6 implementation batches defined with acceptance criteria
- Status upgraded: design-proposal → design-complete

## [2026-03-21 16:00:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 1 follow-up — close review debt before Batch 2.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/domain/stack-profile.js`
- `ai/scripts/init-project.js`
- `ai/scripts/__tests__/init-project.test.js`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Batch 1 bootstrap now has one primary source of truth: `stackProfile`; legacy `detectProjectType` is retained only as a compatibility wrapper
- Added deterministic user-declared stack overrides plus interactive questionnaire fallback for weak-signal/empty projects, writing into the same `.ai/stack-profile.json` contract
- Expanded scope facts for monorepos to include per-scope language/framework/runtime/package-manager/database/test stack signals
- Refactored detection internals into distinct framework/database/test matchers and tightened manifest matching to reduce false positives
- Verification passed: targeted `init-project` suite and full `npm run ai:test` (`476 tests`, `475 pass`, `0 fail`, `1 skipped`)

## [2026-03-21 18:00:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 2 — enrich code index with outline, container ownership, and trust labels.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/context-index-treesitter.js`
- `ai/scripts/context-index.js`
- `ai/scripts/__tests__/context-index-treesitter.test.js`
- `ai/scripts/__tests__/context-index.test.js`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added `byFile.outline` plus enriched symbol metadata (`container`, `containerType`, `bodyLines`, `trust`) for AST mode and conservative regex fallback mode
- Landed virtual containers for functional TS/JS and receiver-based ownership for Go methods
- Bumped code index format to version `3` so old cached `byFile` entries without `outline` are not silently reused
- Verification passed: targeted `context-index` suites and full `npm run ai:test` (`482 tests`, `481 pass`, `0 fail`, `1 skipped`)

## [2026-03-21 20:00:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 3 — formalize L0/L1/L2 context levels in the context pack.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/context-pack.js`
- `ai/scripts/__tests__/context-pack.test.js`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added formal level selection (`L0`/`L1`/`L2`) from prompt analysis, file outline rendering, small-file full-body heuristic, and L2 dependency-body expansion
- Kept seed/graph selection stable and bounded the change to the pack-rendering layer
- Fixed `snippetContextLines: 0` so explicit zero no longer collapses back to the default
- Verification passed: targeted `context-pack` suite and full `npm run ai:test` (`487 tests`, `486 pass`, `0 fail`, `1 skipped`)

## [2026-03-21 21:10:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 3 review cleanup — remove the only minor duplicate noted in review.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- `ai/scripts/context-pack.js`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Removed the duplicated `'stack trace'` token from `deepAnalysisHints`
- No behavior change intended; cleanup only
- Verification passed: targeted `context-pack` suite (`28 tests`, `0 fail`)

## [2026-03-21 23:00:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 5 — add signature detail to the code index.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/context-index-treesitter.js`
- `ai/scripts/context-index.js`
- `ai/scripts/__tests__/context-index-treesitter.test.js`
- `ai/scripts/__tests__/context-index.test.js`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added bounded signature detail for function-like symbols: `params`, `returnType`, `visibility`, `isAsync`, and `isStatic`
- Landed first-pass extraction for TS/JS, Python, Java, C#, and Go without widening the Batch 5 scope into call-graph work
- Bumped code index format to version `4` so stale cached symbols without signature metadata are not silently reused
- Verification passed: targeted `context-index` suites and full `npm run ai:test` (`497 tests`, `496 pass`, `0 fail`, `1 skipped`)

## [2026-03-22 00:00:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 6 — guarded approximate call graph for L2 dependency expansion.
Owner Model: Codex (GPT-5)
Priority: P0
Status: DONE
Target Files:
- `ai/scripts/context-index-treesitter.js`
- `ai/scripts/context-index.js`
- `ai/scripts/context-pack.js`
- `ai/scripts/__tests__/context-index-treesitter.test.js`
- `ai/scripts/__tests__/context-index.test.js`
- `ai/scripts/__tests__/context-pack.test.js`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added bounded `callEdges` with trust `approx-ast`, extracted only for typed-friendly first-wave languages (`java`, `csharp`, `go`, `rust`)
- L2 expansion now consumes guarded call edges only when the target resolves to exactly one candidate; receiver-based ambiguous calls are skipped instead of falling back to broad name matching
- Bumped code index format to version `5` so stale caches without `callEdges` are not silently reused; JavaScript and Python call-graph expansion remain disabled by default in MVP
- Verification passed: targeted `context-index` + `context-pack` suites green (`48 tests`, `0 fail`) and full `npm run ai:test` green (`501 tests`, `500 pass`, `0 fail`, `1 skipped`)

## [2026-03-22 00:20:00 UTC] - Project: ai-hub-coding
Planned Change: Validate Semantic Context Bridge Batch 6 on real repositories before widening call-graph usage.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Rebuilt the local hub index and confirmed the new format on this repo: `.ai/.code_index.json` is now `version: 5`, `mode: ast`, `761` symbols, `169` edges, `0` callEdges (expected for a JS-first codebase because dynamic-language call-graph expansion stays disabled by default)
- Ran read-only in-memory validation on `/home/kair/nornickel/nornick`: `1155` typed files, `4597` symbols, `8809` file/ref edges, and `832` guarded Java `callEdges`, which stays well below the `<= 3x` budget cap (`26427`)
- Sampled `120` unique-caller L2 prompts on `nornick`; `6` showed byte-level pack deltas with `callEdges` enabled, proving the new layer affects real pack assembly, but the overall gain is still modest because the legacy file/ref graph often already covers the same dependencies
- Follow-up question for implementation discussion: should L2 prefer precise `callEdges` over broad name-based ref expansion when both exist, so Batch 6 yields clearer real-world precision gains?

## [2026-03-22 00:30:00 UTC] - Project: ai-hub-coding
Planned Change: Record Semantic Context Bridge Batch 6 validation findings directly in the design doc.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added a compact validation snapshot section with explicit results, conclusions, and proposals
- Recorded the current evidence as "Batch 6 technically works, but runtime gain is still modest"
- Captured the next decision point precisely: prefer exact `callEdges` over broad ref expansion before widening rollout

## [2026-03-22 01:10:00 UTC] - Project: ai-hub-coding
Planned Change: CLI naming migration plan — introduce `undes` commands while keeping `ai` as compatibility aliases.
Owner Model: Codex (GPT-5)
Priority: P2
Status: PLANNED
Target Files:
- `package.json`
- `README.md`
- `AI_WORKFLOW.md`
- `ai/PILOT_RUNBOOK.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Do not do a breaking rename now: current `npm run ai` is a stable operator contract and is already embedded in docs, tests, and user habits
- Preferred migration shape:
  - add `undes`, `undes:index`, `undes:test`, and other primary aliases
  - keep `ai*` commands as legacy compatibility aliases for at least one transition cycle
  - switch docs/examples gradually to `undes`
- Decision criteria before removing `ai` later:
  - docs and runbooks fully migrated
  - no critical internal/test surfaces still depending on `ai*`
  - at least one release cycle with both command families available

## [2026-03-22 01:30:00 UTC] - Project: ai-hub-coding
Planned Change: Semantic Context Bridge Batch 6.1 — prefer precise `callEdges` over broad ref expansion in L2.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/context-pack.js`
- `ai/scripts/__tests__/context-pack.test.js`
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Changed `collectDependencySymbols()` so selected symbols with `callEdges` use only precise `callEdges` for L2 dependency bodies; broad ref/import expansion remains the fallback for symbols without `callEdges`
- Added regression coverage proving noisy ref dependencies no longer override a precise `callEdge`
- Offline compare on `nornick` versus the pre-6.1 additive logic:
  - `120` sampled prompts
  - `10` smaller packs, `13` larger, `97` unchanged
  - average pack size moved from `45583` to `45565` bytes (`-18`)
  - biggest wins: `-4670`, `-4670`, `-3402` bytes
- Verification passed: targeted `context-pack` suite (`30` tests, `0` fail) and full `npm run ai:test` (`502` tests, `501` pass, `0` fail, `1` skipped)

## [2026-03-22 01:45:00 UTC] - Project: ai-hub-coding
Planned Change: Manual relevance sampling for Semantic Context Bridge Batch 6.1 biggest-win cases.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- `ai/design/features/SEMANTIC_CONTEXT_BRIDGE.md`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Manually checked the three largest byte-reduction cases on `nornick`: `createSession -> saveNewSession`, `clearSession -> parseRefreshToken`, `getUserRoles -> getTokenClaims`
- Expected callees remained present before and after Batch 6.1, so the reductions were not caused by dropping the obvious target symbol outright
- But the L2 dependency sections in those cases were still noisy, so the current evidence is enough to keep Batch 6.1 bounded as default, but not enough to justify any wider rollout

## [2026-03-22 01:50:00 UTC] - Project: ai-hub-coding
Planned Change: Decision plan for next steps after Semantic Context Bridge Batch 6.1.
Owner Model: Codex (GPT-5)
Priority: P2
Status: DONE
Target Files:
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Option A: freeze Semantic Context Bridge at the current bounded-default state and stop further work on this track for now
- Option B: run one more narrow L2 precision experiment without widening languages or touching L0/L1
- Option C: shift focus to higher-ROI tracks (`live validation`, `grep-ast precision tuning`, `pipeline cost optimization`)
- Current recommendation: Option C
- Rationale: Semantic Context Bridge is in a good engineering state, but recent validation shows diminishing returns relative to other open tracks
- Gemini CLI Review: Strongly agree with Option C. Recommend immediately pivoting to `Pipeline Cost & Efficiency Optimization` (specifically Anthropic Prompt Caching and Complexity-Based Routing) for massive and immediate ROI.

## [2026-03-21 21:30:00 UTC] - Project: ai-hub-coding
Planned Change: Pipeline Cost Optimization refinement — skip tester for DIAGNOSTIC results and reconcile docs with current runtime state.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/domain/seam-decision.js`
- `ai/scripts/domain/operational-signals.js`
- `ai/scripts/domain/operational-signals-snapshot.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/PIPELINE_COST_OPTIMIZATION.md`
- `ai/design/features/ROUND_ORCHESTRATION_RATIONALIZATION.md`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added a dedicated tester gate helper so DIAGNOSTIC results no longer run post-process validation; tester is now patch-validation-only for non-trivial tasks
- Updated operational signals to record `testerDiagnosticSkipped` while preserving legacy `testerDiagnosticMode` compatibility for older run snapshots
- Reconciled roadmap/design wording with reality: Anthropic prompt caching and bounded complexity routing are already landed, so the remaining cost track now centers on clean-run DA skip, rerun skip-enhance, and telemetry/doc cleanup
- Added a short reconciliation note in `ROUND_ORCHESTRATION_RATIONALIZATION.md` so the older accepted `diagnostic-review` proposal is clearly marked as historical, not current runtime behavior
- Verification passed: targeted `generate-context.contract` + `prompt-content` suites green, and full `npm run ai:test` green (`502` tests, `501` pass, `0` fail, `1` skipped)

## [2026-03-21 22:10:00 UTC] - Project: ai-hub-coding
Planned Change: Pipeline Cost Optimization refinement — skip Devil's Advocate for clean patch-safe high-approval consensus runs.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/domain/seam-decision.js`
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/PIPELINE_COST_OPTIMIZATION.md`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added `computeAverageApprovalScore()` and extended the DA gate so clean runs can skip DA only when all three conditions hold: unanimous approval, `avgApprovalScore >= 9`, and `patchSafeEligible = true`
- Kept the older diagnostic/no-fetchable-seams DA skip intact and higher-priority, so existing diagnostic routing behavior is unchanged
- This keeps the optimization bounded: score-only approval agreement is not enough to bypass DA when the evidence gate still sees unresolved patch-safety gaps
- Verification passed: targeted `generate-context.contract` and `prompt-content` suites green, and full `npm run ai:test` green (`502` tests, `501` pass, `0` fail, `1` skipped)

## [2026-03-21 22:40:00 UTC] - Project: ai-hub-coding
Planned Change: Pipeline Cost Optimization refinement — reuse preprocess results on same-prompt reruns and keep `--skip-enhance` as manual override.
Owner Model: Codex (GPT-5)
Priority: P1
Status: DONE
Target Files:
- `ai/scripts/generate-context.js`
- `ai/scripts/__tests__/generate-context.contract.test.js`
- `ai/design/features/PIPELINE_COST_OPTIMIZATION.md`
- `ai/ROADMAP.md`
- `UNIFIED_MODEL_CHANGE_LOG.md`
- `PROJECT_PLANNED_CHANGES.md`
Notes:
- Added bounded automatic preprocess reuse: when the latest archived run has the same prompt hash and a completed `preprocess` artifact, the current run skips a fresh prompt-engineer call and reuses the normalized result
- Kept the explicit `--skip-enhance` path intact; the new branch is a safe fallback-on-match, not a replacement for manual operator control
- Reused preprocess artifacts are copied into the current run archive and checkpointed as the current run's `preprocess` output, so resume semantics stay consistent
- Verification passed: targeted `generate-context.contract` and `prompt-content` suites green, and full `npm run ai:test` green (`504` tests, `503` pass, `0` fail, `1` skipped)
