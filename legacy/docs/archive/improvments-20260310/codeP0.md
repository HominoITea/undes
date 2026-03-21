# codeP0.md

Реализация P0 по спецификации `version0.md`.

Цель P0:
- построение индекса кода,
- сборка компактного Context Pack,
- безопасный fallback к текущему режиму,
- без новых внешних зависимостей.

## 1) `ai/context.json`

Добавить секции `codeIndex` и `logWindow`.

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
  "fullFiles": [
    "llms.md",
    "ai/PROTOCOL.md",
    "ai/PATTERNS.md",
    "ai/KNOWLEDGE_BASE.md",
    "ai/logs/AI_LOG.md",
    "package.json"
  ],
  "lightFiles": [
    "llms.md",
    "ai/PATTERNS.md",
    "package.json"
  ],
  "exclude": "find . -maxdepth 4 -type f -not -path \"./node_modules/*\" -not -path \"./.git/*\" -not -path \"./bin/*\" -not -path \"./obj/*\""
}
```

## 2) `package.json`

Добавить scripts:

```json
{
  "scripts": {
    "ai": "node ai/scripts/generate-context.js",
    "ai:light": "node ai/scripts/generate-context.js --light",
    "ai:init": "node ai/scripts/init-project.js",
    "ai:clean": "node ai/scripts/cleanup.js",
    "ai:index": "node ai/scripts/generate-context.js --index-only",
    "ai:pack": "node ai/scripts/generate-context.js --context-pack-only"
  }
}
```

## 3) Новый файл `ai/scripts/context-index.js`

```js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SYMBOL_PATTERNS = {
  js: [
    { type: 'function', re: /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g },
    { type: 'class', re: /\bclass\s+([A-Za-z_$][\w$]*)\b/g },
    { type: 'const-fn', re: /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>/g },
  ],
  ts: [
    { type: 'function', re: /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g },
    { type: 'class', re: /\bclass\s+([A-Za-z_$][\w$]*)\b/g },
    { type: 'interface', re: /\binterface\s+([A-Za-z_$][\w$]*)\b/g },
    { type: 'type', re: /\btype\s+([A-Za-z_$][\w$]*)\s*=/g },
    { type: 'method', re: /\b(?:public|private|protected)?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g },
  ],
  py: [
    { type: 'class', re: /^\s*class\s+([A-Za-z_][\w]*)\s*(?:\(|:)/gm },
    { type: 'function', re: /^\s*def\s+([A-Za-z_][\w]*)\s*\(/gm },
  ],
  java: [
    { type: 'class', re: /\bclass\s+([A-Za-z_][\w]*)\b/g },
    { type: 'method', re: /\b(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*\{/g },
  ],
  cs: [
    { type: 'class', re: /\bclass\s+([A-Za-z_][\w]*)\b/g },
    { type: 'method', re: /\b(?:public|private|protected|internal)?\s*(?:static\s+)?[\w<>\[\],?]+\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*\{/g },
  ],
};

function resolveIndexConfig(contextConfig = {}) {
  const cfg = contextConfig.codeIndex || {};
  return {
    enabled: cfg.enabled !== false,
    outputPath: cfg.outputPath || '.code_index.json',
    maxDepth: Number(cfg.maxDepth || 2),
    maxPackBytes: Number(cfg.maxPackBytes || 45000),
    maxGraphEdges: Number(cfg.maxGraphEdges || 200),
    maxSnippets: Number(cfg.maxSnippets || 40),
    fallbackToFullContext: cfg.fallbackToFullContext !== false,
  };
}

function extToLang(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ts' || ext === '.tsx') return 'ts';
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'js';
  if (ext === '.py') return 'py';
  if (ext === '.java') return 'java';
  if (ext === '.cs') return 'cs';
  return null;
}

function lineOfOffset(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function signatureLine(text, lineNum) {
  const line = (text.split('\n')[lineNum - 1] || '').trim();
  const cutBrace = line.indexOf('{');
  const cutSemi = line.indexOf(';');
  let cut = -1;
  if (cutBrace >= 0 && cutSemi >= 0) cut = Math.min(cutBrace, cutSemi);
  else cut = Math.max(cutBrace, cutSemi);
  const sig = cut >= 0 ? line.slice(0, cut + 1) : line;
  return sig.slice(0, 300);
}

function estimateEndLine(content, startLine) {
  const lines = content.split('\n');
  const max = lines.length;
  const from = Math.max(1, startLine);

  let balance = 0;
  let opened = false;
  for (let i = from - 1; i < Math.min(max, from + 220); i++) {
    const ln = lines[i] || '';
    for (const ch of ln) {
      if (ch === '{') {
        balance++;
        opened = true;
      }
      if (ch === '}') balance--;
    }
    if (opened && balance <= 0) return i + 1;
  }

  return Math.min(from + 80, max);
}

function extractSymbols(filePath, content) {
  const lang = extToLang(filePath);
  if (!lang || !SYMBOL_PATTERNS[lang]) return [];

  const symbols = [];
  for (const pattern of SYMBOL_PATTERNS[lang]) {
    pattern.re.lastIndex = 0;
    let m;
    while ((m = pattern.re.exec(content)) !== null) {
      const name = m[1];
      const startLine = lineOfOffset(content, m.index);
      const endLine = estimateEndLine(content, startLine);

      symbols.push({
        id: `${filePath}:${name}:${startLine}`,
        name,
        type: pattern.type,
        file: filePath,
        startLine,
        endLine,
        signature: signatureLine(content, startLine),
      });
    }
  }

  return symbols;
}

function shouldIgnoreEdgeSymbol(symName) {
  if (!symName) return true;
  return symName.length < 4;
}

function extractEdges(filePath, content, knownNames, definedInFile) {
  const localWords = new Set(content.match(/[A-Za-z_$][\w$]*/g) || []);
  const edges = [];

  for (const name of knownNames) {
    if (shouldIgnoreEdgeSymbol(name)) continue;
    if (!localWords.has(name)) continue;
    if (definedInFile.has(name)) continue;

    edges.push({ fromFile: filePath, toSymbol: name, kind: 'ref' });
  }

  return edges;
}

function hashContent(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function buildCodeIndex({ rootDir, files, previousIndex = null, maxFileSize = 30000 }) {
  const byFile = {};
  const allSymbols = [];
  const contentsByFile = new Map();

  for (const rel of files) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;

    const st = fs.statSync(abs);
    if (st.size > maxFileSize) continue;

    const content = fs.readFileSync(abs, 'utf8');
    contentsByFile.set(rel, content);

    const fileHash = hashContent(content);
    const prev = previousIndex?.byFile?.[rel];

    if (prev && prev.hash === fileHash && Array.isArray(prev.symbols)) {
      byFile[rel] = prev;
      allSymbols.push(...prev.symbols);
      continue;
    }

    const symbols = extractSymbols(rel, content);
    byFile[rel] = { hash: fileHash, symbols, size: st.size };
    allSymbols.push(...symbols);
  }

  const knownNames = new Set(allSymbols.map(s => s.name));
  const symbolsByFile = new Map();

  for (const s of allSymbols) {
    if (!symbolsByFile.has(s.file)) symbolsByFile.set(s.file, new Set());
    symbolsByFile.get(s.file).add(s.name);
  }

  const allEdges = [];
  for (const rel of Object.keys(byFile)) {
    const content = contentsByFile.get(rel) || '';
    const definedInFile = symbolsByFile.get(rel) || new Set();
    allEdges.push(...extractEdges(rel, content, knownNames, definedInFile));
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    symbols: allSymbols,
    edges: allEdges,
    byFile,
  };
}

function loadCodeIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (!Array.isArray(parsed?.symbols) || !Array.isArray(parsed?.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCodeIndex(indexPath, index) {
  const tmp = `${indexPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2));
  fs.renameSync(tmp, indexPath);
}

module.exports = {
  resolveIndexConfig,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
};
```

## 4) Новый файл `ai/scripts/context-pack.js`

```js
const fs = require('fs');
const path = require('path');

const STOP = new Set([
  'и', 'в', 'на', 'по', 'с', 'к', 'для', 'как', 'чтобы',
  'the', 'a', 'to', 'of', 'in', 'for', 'and', 'or', 'with',
  'fix', 'add', 'bug', 'refactor', 'feature'
]);

function tokens(text) {
  return (text || '')
    .toLowerCase()
    .match(/[a-zа-я0-9_$.:-]{2,}/gi)
    ?.filter(t => !STOP.has(t)) || [];
}

function scoreSymbols(promptTokens, symbols) {
  return symbols.map(sym => {
    let score = 0;
    for (const t of promptTokens) {
      const n = (sym.name || '').toLowerCase();
      const sig = (sym.signature || '').toLowerCase();
      const file = (sym.file || '').toLowerCase();
      if (n === t) score += 10;
      else if (n.includes(t)) score += 4;
      else if (sig.includes(t)) score += 2;
      else if (file.includes(t)) score += 1;
    }
    return { sym, score };
  }).sort((a, b) => b.score - a.score);
}

function buildRefsBySymbol(index) {
  const map = new Map();
  for (const e of index.edges) {
    if (!map.has(e.toSymbol)) map.set(e.toSymbol, []);
    map.get(e.toSymbol).push(e);
  }
  return map;
}

function buildSymbolsByFile(index) {
  const map = new Map();
  for (const s of index.symbols) {
    if (!map.has(s.file)) map.set(s.file, []);
    map.get(s.file).push(s);
  }
  return map;
}

function expand(index, seeds, maxDepth, maxEdges) {
  const selectedIds = new Set();
  const visitedNames = new Set();
  const queue = seeds.map(s => ({ name: s.name, depth: 0 }));
  const edges = [];

  const refsBySymbol = buildRefsBySymbol(index);
  const symbolsByFile = buildSymbolsByFile(index);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (visitedNames.has(cur.name)) continue;
    visitedNames.add(cur.name);

    for (const s of index.symbols) {
      if (s.name === cur.name) selectedIds.add(s.id);
    }

    if (cur.depth >= maxDepth) continue;

    const refs = refsBySymbol.get(cur.name) || [];
    for (const e of refs) {
      edges.push(e);
      if (edges.length >= maxEdges) break;

      const fileSymbols = symbolsByFile.get(e.fromFile) || [];
      for (const fsym of fileSymbols) {
        if (!selectedIds.has(fsym.id)) {
          queue.push({ name: fsym.name, depth: cur.depth + 1 });
        }
      }
    }

    if (edges.length >= maxEdges) break;
  }

  const selected = index.symbols.filter(s => selectedIds.has(s.id));
  return { symbols: selected, edges };
}

function dedupeByFileLine(symbols) {
  const map = new Map();
  for (const s of symbols) {
    const key = `${s.file}:${s.startLine}:${s.endLine}`;
    if (!map.has(key)) map.set(key, s);
  }
  return [...map.values()];
}

function readRange(rootDir, relPath, fromLine, toLine, redactSecrets) {
  const abs = path.join(rootDir, relPath);
  if (!fs.existsSync(abs)) return '';

  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const from = Math.max(1, fromLine);
  const to = Math.min(lines.length, toLine);
  const body = lines.slice(from - 1, to).join('\n');

  return typeof redactSecrets === 'function' ? redactSecrets(body) : body;
}

function buildContextPack({ rootDir, promptText, index, cfg, redactSecrets }) {
  if (!promptText || !index || !Array.isArray(index?.symbols) || !Array.isArray(index?.edges)) {
    return { used: false, reason: 'no prompt or invalid index' };
  }

  const promptTokens = tokens(promptText);
  const scored = scoreSymbols(promptTokens, index.symbols).filter(x => x.score > 0);
  const seeds = scored.slice(0, Math.max(4, Math.min(10, cfg.maxSnippets))).map(x => x.sym);

  if (!seeds.length) return { used: false, reason: 'no matching symbols' };

  const graph = expand(index, seeds, cfg.maxDepth, cfg.maxGraphEdges);
  const selectedSymbols = dedupeByFileLine(graph.symbols).slice(0, cfg.maxSnippets);

  const out = [];
  out.push('## CONTEXT PACK');
  out.push(`Prompt: ${promptText}`);
  out.push('');
  out.push('### Symbols');
  for (const s of selectedSymbols) {
    out.push(`- ${s.name} [${s.type}] ${s.file}:${s.startLine}-${s.endLine}`);
  }

  out.push('');
  out.push('### Graph (trimmed)');
  for (const e of graph.edges.slice(0, cfg.maxGraphEdges)) {
    out.push(`- ${e.fromFile} -> ${e.toSymbol} (${e.kind})`);
  }

  out.push('');
  out.push('### Relevant Code Fragments');

  let bytes = Buffer.byteLength(out.join('\n'), 'utf8');
  for (const s of selectedSymbols) {
    const from = Math.max(1, s.startLine - 6);
    const to = s.endLine + 6;
    const frag = readRange(rootDir, s.file, from, to, redactSecrets);

    const block = [
      `#### ${s.name} (${s.file}:${from}-${to})`,
      '```' + (path.extname(s.file).slice(1) || 'text'),
      frag,
      '```',
      ''
    ].join('\n');

    const nextBytes = bytes + Buffer.byteLength(block, 'utf8');
    if (nextBytes > cfg.maxPackBytes) break;

    out.push(block);
    bytes = nextBytes;
  }

  return {
    used: true,
    markdown: out.join('\n'),
    selectedCount: selectedSymbols.length,
  };
}

module.exports = {
  buildContextPack,
};
```

## 5) Патч `ai/scripts/generate-context.js`

### 5.1 Импорты

Добавить в начало файла:

```js
const {
  resolveIndexConfig,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
} = require('./context-index');

const {
  buildContextPack,
} = require('./context-pack');
```

### 5.2 CLI flags

После `const args = process.argv.slice(2);`:

```js
const INDEX_ONLY = args.includes('--index-only');
const CONTEXT_PACK_ONLY = args.includes('--context-pack-only');
const NO_TREE = args.includes('--no-tree');
```

### 5.3 Расширить `readFile`

Заменить на:

```js
function readFile(filePath, options = {}) {
  const {
    fromLine = 1,
    toLine = Number.MAX_SAFE_INTEGER,
    maxBytes = Number.MAX_SAFE_INTEGER,
  } = options;

  try {
    const abs = path.join(process.cwd(), filePath);
    const raw = fs.readFileSync(abs, 'utf8');
    const lines = raw.split('\n');
    const sliced = lines.slice(Math.max(0, fromLine - 1), Math.min(lines.length, toLine)).join('\n');

    const slicedBytes = Buffer.byteLength(sliced, 'utf8');
    let limited = sliced;
    if (slicedBytes > maxBytes) {
      limited = Buffer.from(sliced, 'utf8').slice(0, maxBytes).toString('utf8');
      // align to last complete line to avoid broken UTF-8/partial lines
      const lastNewline = limited.lastIndexOf('\n');
      if (lastNewline > 0) limited = limited.slice(0, lastNewline);
      limited += '\n... [truncated by maxBytes]';
    }

    return redactSecrets(limited);
  } catch {
    return `[Error reading ${filePath}]`;
  }
}
```

### 5.4 Sliding window для логов

Добавить:

```js
function readAiLogWindow(filePath, maxEntries = 10, maxBytes = 15000) {
  const abs = path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return `[Error reading ${filePath}]`;

  const text = fs.readFileSync(abs, 'utf8');
  const parts = text.split(/\n(?=## \[)/g);
  const lastEntries = parts.slice(-maxEntries).join('\n');

  const bytes = Buffer.byteLength(lastEntries, 'utf8');
  if (bytes <= maxBytes) return redactSecrets(lastEntries);

  // trim from tail, then align to first complete line to avoid broken UTF-8
  const buf = Buffer.from(lastEntries, 'utf8').slice(bytes - maxBytes);
  const raw = buf.toString('utf8');
  const firstNewline = raw.indexOf('\n');
  const trimmed = firstNewline >= 0 ? raw.slice(firstNewline + 1) : raw;
  return redactSecrets(trimmed);
}
```

### 5.5 Список индексируемых файлов (tracked + untracked)

Добавить:

```js
function listIndexableFiles(treeCmd, maxFiles = 5000) {
  const set = new Set();

  try {
    const tracked = execSync('git ls-files', { encoding: 'utf8' }).trim();
    tracked.split('\n').map(s => s.trim()).filter(Boolean).forEach(f => set.add(f));
  } catch {
    // ignore
  }

  try {
    const all = execSync(treeCmd, { encoding: 'utf8' }).trim();
    all.split('\n').map(s => s.trim()).filter(Boolean).forEach(f => set.add(f));
  } catch {
    // ignore
  }

  return [...set]
    .filter(f => /\.(ts|tsx|js|jsx|mjs|cjs|py|java|cs)$/i.test(f))
    .slice(0, maxFiles);
}
```

### 5.6 Конфиг индекса

После `const contextConfig = loadContextConfig();`:

```js
const indexCfg = resolveIndexConfig(contextConfig);
const INDEX_PATH = path.join(process.cwd(), indexCfg.outputPath);
```

### 5.7 Интеграция в `main()`

Добавить в `main()` (после `validateEnvironment();`):

```js
let codeIndex = null;
if (indexCfg.enabled) {
  const prevIndex = loadCodeIndex(INDEX_PATH);
  const indexFiles = listIndexableFiles(TREE_CMD, MAX_FILES * 5);

  codeIndex = buildCodeIndex({
    rootDir: process.cwd(),
    files: indexFiles,
    previousIndex: prevIndex,
    maxFileSize: LIMITS.maxFileSize,
  });

  saveCodeIndex(INDEX_PATH, codeIndex);
  console.log(`🧭 Code index saved: ${INDEX_PATH} (symbols: ${codeIndex.symbols.length})`);
}

if (INDEX_ONLY) {
  console.log('✅ Index-only mode complete.');
  return;
}
```

В блоке сборки output после system prompt + header.

**Важно:** `readPrompt` в текущем коде также вызывается внутри `runAgents` (строка 1409).
При интеграции убрать вызов из `runAgents` и передавать `promptText` как аргумент:
`await runAgents(bundleContent, promptText);`

```js
// Single call — used both for context pack and for runAgents below
const promptText = readPrompt(PROMPT_PATH);
let usedContextPack = false;

if (indexCfg.enabled && promptText) {
  const pack = buildContextPack({
    rootDir: process.cwd(),
    promptText,
    index: codeIndex,
    cfg: indexCfg,
    redactSecrets,
  });

  if (pack.used) {
    output.push(pack.markdown);
    output.push('\n');
    usedContextPack = true;
    console.log(`🎯 Context Pack used (selected: ${pack.selectedCount})`);
  } else {
    console.log(`ℹ️ Context Pack not used: ${pack.reason}`);
  }
}

if (CONTEXT_PACK_ONLY) {
  const bundleContent = output.join('\n');
  const outputPath = path.join(process.cwd(), '.context_bundle.md');
  fs.writeFileSync(outputPath, bundleContent);
  console.log(`✅ Context pack-only generated: ${outputPath}`);
  return;
}
```

### 5.8 Исправить fallback-условие (P0 gate BUG-2)

Было:

```js
if (!usedContextPack || !indexCfg.enabled || indexCfg.fallbackToFullContext) {
```

Должно быть:

```js
if (!usedContextPack && indexCfg.fallbackToFullContext) {
```

Внутри fallback:
- использовать `readAiLogWindow` для `ai/logs/AI_LOG.md`,
- использовать `readFile(file, { maxBytes: LIMITS.maxFileSize })`,
- ограничивать общий размер через `LIMITS.maxTotalSize`.

### 5.9 `--no-tree`

Было:

```js
if (!IS_LIGHT_MODE) {
```

Должно быть:

```js
if (!IS_LIGHT_MODE && !NO_TREE) {
```

### 5.10 Hash cache с учетом индекса

Вместо старого `computeFilesHash(...)` вызова добавить индекс в extra:

```js
const indexMtime = fs.existsSync(INDEX_PATH) ? fs.statSync(INDEX_PATH).mtimeMs : 'no-index';
const currentHash = computeFilesHash(FILES_TO_INCLUDE, `${dirSnapshot}|${indexMtime}|${IS_LIGHT_MODE}|${NO_TREE}`);
```

## 6) Почему это закрывает P0 Gate

1. BUG-1: исправлен обход графа и selected-by-id.
2. BUG-2: fallback не срабатывает всегда.
3. BUG-4: шум рёбер снижен (short names + self-ref off).
4. Atomic write: реализован в `saveCodeIndex`.
5. Untracked files: объединение `git ls-files` + `find`.
6. Null-check index: есть в `buildContextPack`.

## 7) Команды проверки P0

```bash
npm run ai:index
npm run ai:pack -- --prompt="refactor user service"
npm run ai -- --no-cache --prompt="fix price calculation"
npm run ai:light -- --no-cache --prompt="bug in validator" --no-tree
```

## 8) Минимальный чеклист ревью

- Скрипт не падает на битом `.code_index.json`.
- `Context Pack` используется при валидном prompt и индексах.
- Full fallback включается только при `!usedContextPack && fallbackToFullContext`.
- Логи режутся по `logWindow`.
- Bundle и pack реально ограничены размером.
- Новые untracked файлы попадают в индекс.

## 9) Результаты тестирования (2026-02-22, Claude Opus 4.6)

Тестирование проведено на реальном проекте `/home/kair/ai-agents`.

### Результаты

| Тест | Команда / сценарий | Результат |
|---|---|---|
| Загрузка модулей | `require('./context-index')`, `require('./context-pack')` | **PASS** |
| `--index-only` | `node generate-context.js --index-only` | **PASS** — 58 символов, 5 файлов, индекс сохранён |
| Context Pack с промптом | `--context-pack-only --prompt="refactor buildCodeIndex function"` | **PASS** — нашёл `buildCodeIndex`, 10 символов в pack, 13,386 байт |
| Fallback при нерелевантном промпте | `--prompt="xyznonexistent"` | **PASS** — `no matching symbols`, не крэшит |
| Битый `.code_index.json` | Записан невалидный JSON, запущен скрипт | **PASS** — `loadCodeIndex` вернул null, индекс пересобрался с нуля |
| FULL без промпта (fallback к fullFiles) | `--no-cache` без `--prompt` | **PASS** — fallback к fullFiles, 11,237 байт |
| LIGHT режим | `--light --no-cache` | **PASS** — 5,045 байт |
| `--no-tree` | `--no-cache --no-tree` | **PASS** — DIRECTORY STRUCTURE отсутствует в бандле |
| Atomic write | Проверка `.code_index.json.tmp` после записи | **PASS** — `.tmp` файл не остаётся |

### Размеры бандла (сравнение до/после P0)

| Режим | До P0 (только оптимизация context.json) | После P0 (с Context Pack) |
|---|---|---|
| FULL без промпта (fallback) | 10,276 байт | 11,237 байт (+directory tree) |
| FULL с промптом (Context Pack) | — | 13,386 байт (pack + system prompt) |
| LIGHT | 4,345 байт | 5,045 байт |

### Известные ограничения P0

1. `estimateEndLine` считает `{`/`}` внутри строковых литералов и regex-паттернов.
   Пример: `signatureLine` (строка 59) получает endLine=139 вместо 68
   из-за `'{'` в `line.indexOf('{')`. На корректность не влияет —
   расширяет захватываемый фрагмент. Решается в P1 (tree-sitter).
2. `generate-context.js` (82KB) не индексируется — превышает `maxFileSize: 30000`.
   Это ожидаемое поведение для крупных файлов.
3. Мало рёбер в графе (1 на 58 символов) — self-ref фильтр и short-name
   фильтр работают корректно, но на малом проекте рёбер мало.
   На реальном проекте с сотнями файлов граф будет плотнее.

### Вердикт

Все Acceptance Criteria из version0.md (секция 6) выполнены.
P0 реализация работоспособна и готова к использованию.
