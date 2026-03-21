# VERSION 0 — P0 Спецификация реализации

Дата фиксации: 2026-02-22
Статус: Ready for implementation

Примечание (2026-02-23):
- Этот файл фиксирует рамки P0 и backlog P1/P2.
- Упоминания P1-флагов (например, `--index-mode=ast`) являются планом и могут отсутствовать в текущей рабочей ветке.

## 1. Контекст решения

Мы фиксируем минимально достаточную версию P0 для снижения токенов за счет
контекстного индексирования и точечной выборки фрагментов кода.

Согласование:
- GPT-5 Codex: подтверждено
- Claude Opus 4.6: подтверждено (с уточнениями)
- Gemini: ответ не получен (принято решение не блокировать P0)

## 2. Цель P0

Сделать рабочий поток:
`Index -> ResolveContext -> Context Pack -> (fallback при необходимости)`

Ключевая цель P0:
- передавать в LLM релевантные фрагменты, а не полные файлы,
- при этом не ломать текущий сценарий (graceful degradation).

## 3. P0 Gate (обязательные правки перед запуском)

Это обязательный минимум. Без этих пунктов P0 не считается готовым.

1. Исправить BUG-1 в `expand()`:
- устранить неправильную работу обхода графа,
- исправить ошибку ключа `selected.has(cur.name)` при хранении по `s.id`.

2. Исправить BUG-2 в fallback-логике:
- заменить условие на:
`if (!usedContextPack && indexCfg.fallbackToFullContext)`

3. Исправить BUG-4 (шум рёбер) минимальным способом для P0:
- исключить короткие имена символов (`len < 4`),
- исключить self-references (ссылка на символ, определенный в том же файле).

4. Добавить atomic write для индекса:
- писать в `.code_index.json.tmp`, затем `renameSync` в `.code_index.json`.

5. Включить untracked файлы в индексацию:
- `listIndexableFiles` должен использовать объединение `git ls-files` + `find`.

6. Добавить null-check для индекса в `buildContextPack`:
- `Array.isArray(index?.symbols)` и `Array.isArray(index?.edges)`.

## 4. Изменения по файлам (P0)

### 4.1 `ai/context.json`

Добавить/поддержать конфиг:
- `codeIndex`:
  - `enabled`
  - `outputPath`
  - `maxDepth`
  - `maxPackBytes`
  - `maxGraphEdges`
  - `maxSnippets`
  - `fallbackToFullContext`
- `logWindow`:
  - `enabled`
  - `maxEntries`
  - `maxBytes`

### 4.2 `package.json`

Добавить скрипты диагностики:
- `ai:index` -> `node ai/scripts/generate-context.js --index-only`
- `ai:pack` -> `node ai/scripts/generate-context.js --context-pack-only`

### 4.3 Новый файл `ai/scripts/context-index.js`

Импорты:
- `fs`, `path`, `crypto`

Методы:
- `resolveIndexConfig(contextConfig)`
- `loadCodeIndex(indexPath)`
- `saveCodeIndex(indexPath, index)` (с atomic write)
- `buildCodeIndex({ rootDir, files, previousIndex, maxFileSize })`

Требования к логике:
- regex-извлечение символов по языкам (TS/JS/PY/Java/C#),
- инкрементальность по hash файла,
- фильтрация шумных рёбер (P0-минимум: короткие имена + self-ref off),
- поддержка untracked файлов через объединенный список входных файлов.

### 4.4 Новый файл `ai/scripts/context-pack.js`

Импорты:
- `fs`, `path`

Метод:
- `buildContextPack({ rootDir, promptText, index, cfg, redactSecrets })`

Требования к логике:
- null-safe входа (не падать на битом/пустом индексе),
- scoring символов по prompt,
- BFS-расширение по графу до `maxDepth`,
- формирование markdown секций:
  - symbols,
  - graph (trimmed),
  - relevant code fragments,
- ограничение размера pack через `maxPackBytes`.

### 4.5 `ai/scripts/generate-context.js`

Добавить импорты:
- `context-index.js`
- `context-pack.js`

Добавить CLI-флаги:
- `--index-only`
- `--context-pack-only`
- `--no-tree`

Изменить/добавить методы:
- `readFile(filePath, options)` с лимитами диапазона/размера,
- `readAiLogWindow(filePath, maxEntries, maxBytes)`,
- `listIndexableFiles(treeCmd, maxFiles)` с объединением `git ls-files` + `find`.

Интеграция в `main()`:
1. построить/обновить индекс,
2. если `--index-only` -> завершить,
3. попытка собрать `Context Pack`,
4. fallback к обычному режиму только при `!usedContextPack && fallbackToFullContext`,
5. применить `maxTotalSize` при сборке полного контекста,
6. пропуск дерева, если `--no-tree`.

## 5. Что откладываем (не P0)

Следующие пункты не блокируют P0 и идут позже:

1. Улучшение `endLine` (brace-balance / AST).
2. Кэш содержимого файлов для исключения double-read.
3. Более сильная ReDoS-защита (сложные лимиты/таймауты regex).
4. Ignore patterns `*.test.*`, `*.spec.*` по умолчанию.
5. Import-aware ребра и семантический граф (P1).
6. Tree-sitter и режим `--index-mode=ast` (P1).
7. Intent/map-reduce/self-healing (P2, только по метрикам).

## 6. Acceptance Criteria (Definition of Done для P0)

P0 считается завершенным, если одновременно выполняются условия:

1. На валидном prompt формируется `Context Pack` и используется в bundle.
2. При пустом prompt, пустом индексе или битом индексе скрипт не падает.
3. Fallback включается только в предусмотренном условии.
4. Размер bundle ограничивается `maxTotalSize`, pack — `maxPackBytes`.
5. `ai/logs/AI_LOG.md` включается через окно `maxEntries/maxBytes`.
6. Индекс не повреждается при падении процесса во время записи.
7. Untracked кодовые файлы попадают в индекс.

## 7. Минимальные тесты для P0

1. `context-index.extractSymbols` (TS/JS/PY smoke).
2. `context-pack.buildContextPack` (явный prompt, неявный prompt, invalid index).
3. fallback-ветка `generate-context` при `usedContextPack=false`.
4. `readAiLogWindow` на большом логе.
5. atomic write сценарий (`.tmp` -> rename).

## 8. Итог

Спецификация P0 утверждена к реализации с фиксированным scope.
Расширение (P1/P2) допускается только после получения метрик качества и стоимости.

## HISTORY_MAP_2026_02_22

Ветвь A (оптимизация контекста):
- `optimizations_codex.md`
- `optimizations_claude.md`
- `optimizations_gemini.md`
- `optimizations.md`
- `version0.md` (текущая точка)

Ветвь B (задача по графу зависимостей):
- `prompt.txt`
- `tasks.txt`
- `final.txt`
- `draft_code.txt`
- `version0.md` (текущая точка)
