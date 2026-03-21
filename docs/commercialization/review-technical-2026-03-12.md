<!-- Generated: 2026-03-12 | Reviewer: Claude Opus 4.6 (Technical Architect) | Status: review -->

# Technical Review: OSS-Core Launch Memo

Reviewed document: `oss-core-launch-memo-2026-03-22.md`
Date: 2026-03-12

---

## 1. Technical Readiness Gap -- теперь уже не в отсутствии pilot, а в коммерческой упаковке

На момент этого review internal pilot baseline уже собран:
- есть completed runs на реальных проектах;
- есть quality ratings;
- базовые runtime-блокеры выявлены и частично закрыты.

Это снимает главный первоначальный риск "клиент увидит первый в истории проекта реальный прогон".
Но paid pilot всё ещё нельзя считать продуктово безопасным по умолчанию, потому что:

- internal validation не равна paid-client validation;
- demo path и launch packaging ещё не доведены до устойчивого sales-ready состояния;
- operational сложности всё ещё есть, особенно вокруг budgets, misleading warnings и runtime steering.

**Рекомендация:** Не задерживать публикацию 22 марта из-за старого pilot-blocker, но не продавать первый paid pilot как mature integration product. Первый коммерческий scope должен оставаться узким: CLI/hub pipeline, fixed SOW, без параллельных интеграционных обещаний.

---

## 2. API Cost Ceiling $500 -- вероятно достаточен, но хрупок

Стоимость одного полного pipeline run (proposal + critique + consensus + approval + devil-advocate + tester):

- Базовый run: ~$2-5 (зависит от context size и моделей)
- С refinement (1-3 consensus revision), retry на truncation, 2-3 approval rounds: $5-15 за задачу
- 10 задач x $10 avg = **~$100**

$500 ceiling достаточен при контролируемом scope. Но без change request policy scope creep может удвоить количество задач.

**Позитив:** Недавние оптимизации снижают cost per run:
- `debatePhases` исключает architect из approval rounds (~15-20% экономия на Claude)
- Pipeline Hardening с bounded repair снижает waste на truncated outputs
- Per-run runs/discussions grouping упрощает debugging (меньше founder time на диагностику)

---

## 3. Что реально работает vs что обещано

### Работает и протестировано (324 pass):
- Multi-agent pipeline (proposal → critique → consensus → approval → revision)
- Context pack + code indexing
- Checkpoint resume
- Prompt gate + validation
- Truncation detection + bounded repair (Pipeline Hardening Batches 1-4)
- Phase-level agent filtering (debatePhases)
- Per-run archive grouping
- Structured error logging

### Работает и уже обкатано на реальных проектах, но ещё не доказано в paid-client режиме:
- Весь pipeline на real codebase прошёл internal pilot baseline
- Multi-provider reliability уже наблюдалась под реальной нагрузкой, но требует дальнейшего runtime control hardening
- Checkpoint resume и restart-paths работают, но ещё не прошли "клиентский" operational pressure test

### Не существует:
- **GitLab integration** -- memo уже честнее фиксирует его как post-pilot add-on, но кода и design doc всё ещё нет. Это пока коммерческое направление, а не deliverable.
- **Jira integration** -- design doc есть (`JIRA_TAKE.md`), кода нет.
- **Quick-start guide** для нового пользователя.

**Red flag:** Если клиент покупает "Paid Pilot + GitLab integration", мы обещаем delivery за 14 дней продукта + интеграции, которой не существует. Это не pilot, а custom development с высоким delivery risk.

**Рекомендация:** Первый paid pilot -- **только CLI/hub pipeline** без интеграций. GitLab add-on продавать только как отдельную post-pilot phase.

---

## 4. OSS Core Readiness -- что нужно до публикации

### Блокирующее:
- **Секреты/ключи в git history.** `.ai.env` упоминается в коде -- нужен full history audit на утёкшие API keys.
- **`docs/commercialization/`** не должна попасть в публичный репо (стратегия, цены, KPI).
- **Internal paths** (`/home/kair/...`) есть в логах, тестах, некоторых md файлах -- убрать или абстрагировать.
- **architecture-check.js** -- dead feature для JS проектов (Rust-only internals). Публиковать мёртвую фичу -- плохой сигнал для developer audience.

### Важное, но не блокирующее:
- README: нужен полный rewrite под новое позиционирование.
- Quick-start guide: сейчас нет.
- `.env.example` для демонстрации конфигурации без реальных ключей.
- `CHANGELOG.md` для первого релиза.

---

## 5. Позиционирование -- уточнение

Memo: "repo-centric orchestration and quality layer for coding workflows". Правильно, но абстрактно для outreach.

**Предложение для одного предложения:**
"Multi-agent code review и generation pipeline, который снижает количество итераций на review за счёт встроенного debate → critique → consensus цикла."

Это то, что реально работает и демонстрируемо сегодня.

---

## 6. Связь с текущим roadmap

| Feature | Влияние на pilot | Рекомендация |
|---|---|---|
| Adaptive Runtime Control (Batch 1-2) | **Критично.** Без honest limits summary оператор тратит время на debugging misleading warnings | Приоритизировать до paid pilot |
| Phase Contract Normalization | Не блокирует | Отложить |
| Language-Aware Arch Check | Не блокирует, но полезно для demo | Опционально |
| Local Memory MVP | Не блокирует первый pilot | Отложить |

---

## 7. Demo Path

Для первого outreach нужен воспроизводимый demo flow. Сейчас его нет.

**Минимальный demo (30 минут):**
1. Показать config (`agents.json`, `context.json`)
2. Запустить `npm run ai -- --prompt="..."` на небольшом реальном задании
3. Показать multi-agent debate в реальном времени (proposals → critiques → consensus)
4. Показать approval rounds и final output
5. Показать runs/discussions/logs structure

**Что нужно подготовить:**
- Demo repo (clean, небольшой, с понятным контекстом)
- 2-3 заготовленных промпта, которые стабильно дают хороший результат
- Fallback plan если demo fails (pre-recorded output)

---

## Итоговая позиция

Документ -- сильный strategic memo. CFO и юрист нашли реальные финансовые и правовые пробелы.

**Моё главное добавление:** Технический risk теперь не в отсутствии internal pilot, а в том, чтобы не переоценить его. Internal pilot baseline уже собран, но коммерческий pilot всё ещё требует узкого scope, честного positioning и безинтеграционного первого контракта.

**Второе:** GitLab integration не существует. Не продавать его как параллельный deliverable с первым pilot.
