# codeP1.md

Реализация P1 по итогам обсуждений и спецификации `version0.md`.

Статус (2026-02-23):
- Документ архивный и описывает целевую P1-ветку.
- Флаги `--index-mode` и `--profile` в текущей `main`-реализации `ai/scripts/generate-context.js` не поддерживаются.
- Для актуальных команд используйте `package.json` (`npm run ai`, `npm run ai:light`, `npm run ai:index`, `npm run ai:pack`).

Цель P1:
- заменить regex-парсинг на tree-sitter AST для точных символов/рёбер,
- добавить import-aware edge detection,
- добавить ignore patterns (`*.test.*`, `*.spec.*`),
- ввести профили контекста (coding/debug/docs),
- добавить ReDoS-защиту для regex-режима.

## 1) `package.json`

Добавить зависимости:

```json
{
  "dependencies": {
    "tree-sitter": "^0.22.4",
    "tree-sitter-javascript": "^0.23.1",
    "tree-sitter-typescript": "^0.23.2",
    "tree-sitter-python": "^0.23.6"
  }
}
```

> tree-sitter — native addon (node-gyp). Если установка не проходит, система откатывается на regex-режим (graceful degradation).

Опциональные (при необходимости Java/C#):
```bash
npm install tree-sitter-java tree-sitter-c-sharp
```

## 2) `ai/context.json`

Расширить `codeIndex` и добавить секцию `profiles`:

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
    "indexMode": "auto",
    "maxDepth": 2,
    "maxPackBytes": 45000,
    "maxGraphEdges": 200,
    "maxSnippets": 40,
    "fallbackToFullContext": true,
    "ignorePatterns": ["*.test.*", "*.spec.*", "*.stories.*"]
  },
  "logWindow": {
    "enabled": true,
    "maxEntries": 10,
    "maxBytes": 15000
  },
  "profiles": {
    "coding": {
      "fullFiles": ["llms.md", "ai/PROTOCOL.md", "ai/PATTERNS.md", "ai/KNOWLEDGE_BASE.md", "ai/logs/AI_LOG.md", "package.json"],
      "maxSnippets": 40,
      "maxPackBytes": 45000
    },
    "debug": {
      "fullFiles": ["llms.md", "ai/PROTOCOL.md", "ai/PATTERNS.md", "ai/KNOWLEDGE_BASE.md", "ai/logs/AI_LOG.md", "package.json"],
      "maxSnippets": 60,
      "maxPackBytes": 65000,
      "maxDepth": 3
    },
    "docs": {
      "fullFiles": ["llms.md", "ai/PATTERNS.md", "package.json"],
      "maxSnippets": 20,
      "maxPackBytes": 25000
    }
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

Новые поля:
- `indexMode`: `"auto"` | `"regex"` | `"ast"` — режим индексации
- `ignorePatterns`: glob-паттерны файлов, исключаемых из индекса
- `profiles`: именованные профили контекста с переопределением настроек

## 3) Новый файл `ai/scripts/context-index-treesitter.js`

```js
const path = require('path');

let _parsers = null;

function isTreeSitterAvailable() {
  try {
    require('tree-sitter');
    return true;
  } catch {
    return false;
  }
}

function initParsers() {
  if (_parsers) return _parsers;
  if (!isTreeSitterAvailable()) return null;

  try {
    const Parser = require('tree-sitter');

    const parsers = {};

    try {
      const JavaScript = require('tree-sitter-javascript');
      const jsParser = new Parser();
      jsParser.setLanguage(JavaScript);
      parsers.js = jsParser;
    } catch { /* grammar not installed */ }

    try {
      const TypeScript = require('tree-sitter-typescript');
      const tsParser = new Parser();
      tsParser.setLanguage(TypeScript.typescript);
      parsers.ts = tsParser;

      const tsxParser = new Parser();
      tsxParser.setLanguage(TypeScript.tsx);
      parsers.tsx = tsxParser;
    } catch { /* grammar not installed */ }

    try {
      const Python = require('tree-sitter-python');
      const pyParser = new Parser();
      pyParser.setLanguage(Python);
      parsers.py = pyParser;
    } catch { /* grammar not installed */ }

    if (Object.keys(parsers).length === 0) return null;

    _parsers = parsers;
    return _parsers;
  } catch {
    return null;
  }
}

function extToParserKey(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ts') return 'ts';
  if (ext === '.tsx') return 'tsx';
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'js';
  if (ext === '.py') return 'py';
  return null;
}

function signatureFromNode(node, content) {
  const startLine = node.startPosition.row;
  const line = (content.split('\n')[startLine] || '').trim();
  const cutBrace = line.indexOf('{');
  const cutColon = line.indexOf(':');
  let cut = -1;
  if (cutBrace >= 0) cut = cutBrace;
  const sig = cut >= 0 ? line.slice(0, cut + 1) : line;
  return sig.slice(0, 300);
}

// --- JS/TS AST node types to symbol types ---
const JS_TS_NODE_MAP = {
  function_declaration: 'function',
  generator_function_declaration: 'function',
  class_declaration: 'class',
  method_definition: 'method',
  interface_declaration: 'interface',
  type_alias_declaration: 'type',
};

function getSymbolName(node) {
  // function_declaration, class_declaration, interface_declaration, type_alias_declaration
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nameNode.text;

  // method_definition
  if (node.type === 'method_definition') {
    const n = node.childForFieldName('name');
    return n ? n.text : null;
  }

  return null;
}

function walkJsTs(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();

  function visit() {
    const node = cursor.currentNode;

    // Check direct node type
    if (JS_TS_NODE_MAP[node.type]) {
      const name = getSymbolName(node);
      if (name) {
        symbols.push({
          id: `${filePath}:${name}:${node.startPosition.row + 1}`,
          name,
          type: JS_TS_NODE_MAP[node.type],
          file: filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          signature: signatureFromNode(node, content),
        });
      }
    }

    // const foo = (...) => { ... }
    if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const declarator = node.namedChild(i);
        if (declarator.type === 'variable_declarator') {
          const nameNode = declarator.childForFieldName('name');
          const valueNode = declarator.childForFieldName('value');
          if (nameNode && valueNode && valueNode.type === 'arrow_function') {
            symbols.push({
              id: `${filePath}:${nameNode.text}:${node.startPosition.row + 1}`,
              name: nameNode.text,
              type: 'const-fn',
              file: filePath,
              startLine: node.startPosition.row + 1,
              endLine: valueNode.endPosition.row + 1,
              signature: signatureFromNode(node, content),
            });
          }
        }
      }
    }

    // Recurse into children
    if (cursor.gotoFirstChild()) {
      do {
        visit();
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  }

  visit();
  return symbols;
}

const PY_NODE_MAP = {
  function_definition: 'function',
  class_definition: 'class',
};

function walkPython(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();

  function visit() {
    const node = cursor.currentNode;

    if (PY_NODE_MAP[node.type]) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          id: `${filePath}:${nameNode.text}:${node.startPosition.row + 1}`,
          name: nameNode.text,
          type: PY_NODE_MAP[node.type],
          file: filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          signature: signatureFromNode(node, content),
        });
      }
    }

    if (cursor.gotoFirstChild()) {
      do {
        visit();
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  }

  visit();
  return symbols;
}

function extractSymbolsAst(filePath, content, parser) {
  const tree = parser.parse(content);
  const key = extToParserKey(filePath);

  if (key === 'py') {
    return walkPython(tree.rootNode, filePath, content);
  }
  // js, ts, tsx
  return walkJsTs(tree.rootNode, filePath, content);
}

// --- Import-aware edge detection ---

function extractImportsJsTs(rootNode) {
  const imports = [];
  const cursor = rootNode.walk();

  function visit() {
    const node = cursor.currentNode;

    // import { foo, bar } from './module'
    // import foo from './module'
    // import * as foo from './module'
    if (node.type === 'import_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'import_clause') {
          extractImportNames(child, imports);
        }
      }
    }

    // const foo = require('./module')
    // const { foo } = require('./module')
    if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const declarator = node.namedChild(i);
        if (declarator.type === 'variable_declarator') {
          const valueNode = declarator.childForFieldName('value');
          if (valueNode?.type === 'call_expression') {
            const callee = valueNode.childForFieldName('function');
            if (callee?.text === 'require') {
              const nameNode = declarator.childForFieldName('name');
              if (nameNode) {
                if (nameNode.type === 'object_pattern') {
                  extractObjectPatternNames(nameNode, imports);
                } else {
                  imports.push(nameNode.text);
                }
              }
            }
          }
        }
      }
    }

    if (cursor.gotoFirstChild()) {
      do {
        visit();
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  }

  visit();
  return imports;
}

function extractImportNames(importClause, out) {
  for (let i = 0; i < importClause.namedChildCount; i++) {
    const child = importClause.namedChild(i);
    if (child.type === 'identifier') {
      out.push(child.text);
    } else if (child.type === 'named_imports') {
      for (let j = 0; j < child.namedChildCount; j++) {
        const spec = child.namedChild(j);
        if (spec.type === 'import_specifier') {
          const alias = spec.childForFieldName('alias');
          const name = spec.childForFieldName('name');
          out.push(alias ? alias.text : name?.text);
        }
      }
    } else if (child.type === 'namespace_import') {
      const name = child.childForFieldName('name');
      if (name) out.push(name.text);
    }
  }
}

function extractObjectPatternNames(objectPattern, out) {
  for (let i = 0; i < objectPattern.namedChildCount; i++) {
    const prop = objectPattern.namedChild(i);
    if (prop.type === 'shorthand_property_identifier_pattern') {
      out.push(prop.text);
    } else if (prop.type === 'pair_pattern') {
      const value = prop.childForFieldName('value');
      if (value) out.push(value.text);
    }
  }
}

function extractImportsPython(rootNode) {
  const imports = [];
  const cursor = rootNode.walk();

  function visit() {
    const node = cursor.currentNode;

    // import foo, bar
    if (node.type === 'import_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'dotted_name') {
          const parts = child.text.split('.');
          imports.push(parts[parts.length - 1]);
        } else if (child.type === 'aliased_import') {
          const alias = child.childForFieldName('alias');
          const name = child.childForFieldName('name');
          imports.push(alias ? alias.text : name?.text?.split('.').pop());
        }
      }
    }

    // from module import foo, bar
    if (node.type === 'import_from_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'dotted_name' && i > 0) {
          imports.push(child.text);
        } else if (child.type === 'aliased_import') {
          const alias = child.childForFieldName('alias');
          const name = child.childForFieldName('name');
          imports.push(alias ? alias.text : name?.text);
        }
      }
    }

    if (cursor.gotoFirstChild()) {
      do {
        visit();
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  }

  visit();
  return imports;
}

function extractEdgesAst(filePath, content, parser, knownNames) {
  const tree = parser.parse(content);
  const key = extToParserKey(filePath);
  const edges = [];

  let importedNames;
  if (key === 'py') {
    importedNames = extractImportsPython(tree.rootNode);
  } else {
    importedNames = extractImportsJsTs(tree.rootNode);
  }

  const importSet = new Set(importedNames.filter(Boolean));

  for (const name of importSet) {
    if (knownNames.has(name)) {
      edges.push({ fromFile: filePath, toSymbol: name, kind: 'import' });
    }
  }

  return edges;
}

module.exports = {
  isTreeSitterAvailable,
  initParsers,
  extToParserKey,
  extractSymbolsAst,
  extractEdgesAst,
};
```

## 4) Патч `ai/scripts/context-index.js`

### 4.1 Добавить conditional import (начало файла)

После существующих `require`:

```js
let treeSitter = null;
try {
  treeSitter = require('./context-index-treesitter');
} catch { /* tree-sitter not installed, regex mode only */ }
```

### 4.2 Расширить `resolveIndexConfig`

Было:
```js
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
```

Должно быть:
```js
function resolveIndexConfig(contextConfig = {}) {
  const cfg = contextConfig.codeIndex || {};
  return {
    enabled: cfg.enabled !== false,
    outputPath: cfg.outputPath || '.code_index.json',
    indexMode: cfg.indexMode || 'auto',
    maxDepth: Number(cfg.maxDepth || 2),
    maxPackBytes: Number(cfg.maxPackBytes || 45000),
    maxGraphEdges: Number(cfg.maxGraphEdges || 200),
    maxSnippets: Number(cfg.maxSnippets || 40),
    fallbackToFullContext: cfg.fallbackToFullContext !== false,
    ignorePatterns: Array.isArray(cfg.ignorePatterns)
      ? cfg.ignorePatterns
      : ['*.test.*', '*.spec.*', '*.stories.*'],
  };
}
```

### 4.3 Добавить `resolveMode`

```js
function resolveMode(configMode) {
  if (configMode === 'ast') {
    if (treeSitter?.isTreeSitterAvailable()) return 'ast';
    console.warn('⚠️ tree-sitter not available, falling back to regex');
    return 'regex';
  }
  if (configMode === 'regex') return 'regex';
  // auto: prefer AST if available
  return treeSitter?.isTreeSitterAvailable() ? 'ast' : 'regex';
}
```

### 4.4 Добавить `matchesIgnorePattern`

```js
function matchesIgnorePattern(filePath, patterns) {
  for (const pattern of patterns) {
    // Convert glob *.test.* → regex /\.test\./i
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    if (new RegExp(escaped, 'i').test(filePath)) return true;
  }
  return false;
}
```

### 4.5 Добавить ReDoS-защиту

```js
function safeRegexExec(regex, content, timeoutMs = 5000) {
  const start = Date.now();
  const results = [];
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(content)) !== null) {
    results.push(m);
    if (Date.now() - start > timeoutMs) {
      console.warn(`⚠️ Regex timeout on ${regex.source.slice(0, 40)}...`);
      break;
    }
  }
  return results;
}
```

### 4.6 Обновить `extractSymbols` для использования `safeRegexExec`

Было:
```js
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
```

Должно быть:
```js
function extractSymbols(filePath, content) {
  const lang = extToLang(filePath);
  if (!lang || !SYMBOL_PATTERNS[lang]) return [];

  const symbols = [];
  for (const pattern of SYMBOL_PATTERNS[lang]) {
    const matches = safeRegexExec(pattern.re, content);
    for (const m of matches) {
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
```

### 4.7 Обновить `buildCodeIndex` — добавить `mode` и `ignorePatterns`

Было:
```js
function buildCodeIndex({ rootDir, files, previousIndex = null, maxFileSize = 30000 }) {
```

Должно быть:
```js
function buildCodeIndex({ rootDir, files, previousIndex = null, maxFileSize = 30000, mode = 'regex', ignorePatterns = [] }) {
  const filteredFiles = ignorePatterns.length > 0
    ? files.filter(f => !matchesIgnorePattern(f, ignorePatterns))
    : files;

  let parsers = null;
  if (mode === 'ast' && treeSitter) {
    parsers = treeSitter.initParsers();
    if (!parsers) {
      console.warn('⚠️ tree-sitter parsers failed to init, falling back to regex');
      mode = 'regex';
    }
  }

  const byFile = {};
  const allSymbols = [];
  const contentsByFile = new Map();

  for (const rel of filteredFiles) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;

    const st = fs.statSync(abs);
    if (st.size > maxFileSize) continue;

    const content = fs.readFileSync(abs, 'utf8');
    contentsByFile.set(rel, content);

    const fileHash = hashContent(content);
    const prev = previousIndex?.byFile?.[rel];

    // Incremental: skip if hash matches AND mode matches
    if (prev && prev.hash === fileHash && prev.mode === mode && Array.isArray(prev.symbols)) {
      byFile[rel] = prev;
      allSymbols.push(...prev.symbols);
      continue;
    }

    let symbols;
    if (mode === 'ast' && parsers) {
      const parserKey = treeSitter.extToParserKey(rel);
      const parser = parserKey ? parsers[parserKey] : null;
      if (parser) {
        symbols = treeSitter.extractSymbolsAst(rel, content, parser);
      } else {
        symbols = extractSymbols(rel, content); // fallback for unsupported lang
      }
    } else {
      symbols = extractSymbols(rel, content);
    }

    byFile[rel] = { hash: fileHash, mode, symbols, size: st.size };
    allSymbols.push(...symbols);
  }

  const knownNames = new Set(allSymbols.map((s) => s.name));
  const symbolsByFile = new Map();

  for (const s of allSymbols) {
    if (!symbolsByFile.has(s.file)) symbolsByFile.set(s.file, new Set());
    symbolsByFile.get(s.file).add(s.name);
  }

  const allEdges = [];
  for (const rel of Object.keys(byFile)) {
    const content = contentsByFile.get(rel) || '';

    let edges;
    if (mode === 'ast' && parsers) {
      const parserKey = treeSitter.extToParserKey(rel);
      const parser = parserKey ? parsers[parserKey] : null;
      if (parser) {
        edges = treeSitter.extractEdgesAst(rel, content, parser, knownNames);
      } else {
        const definedInFile = symbolsByFile.get(rel) || new Set();
        edges = extractEdges(rel, content, knownNames, definedInFile);
      }
    } else {
      const definedInFile = symbolsByFile.get(rel) || new Set();
      edges = extractEdges(rel, content, knownNames, definedInFile);
    }

    allEdges.push(...edges);
  }

  return {
    version: 2,
    mode,
    generatedAt: new Date().toISOString(),
    symbols: allSymbols,
    edges: allEdges,
    byFile,
  };
}
```

### 4.8 Обновить exports

Было:
```js
module.exports = {
  resolveIndexConfig,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
};
```

Должно быть:
```js
module.exports = {
  resolveIndexConfig,
  resolveMode,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
};
```

## 5) Патч `ai/scripts/generate-context.js`

### 5.1 Добавить импорт `resolveMode`

Было:
```js
const {
  resolveIndexConfig,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
} = require('./context-index');
```

Должно быть:
```js
const {
  resolveIndexConfig,
  resolveMode,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
} = require('./context-index');
```

### 5.2 Новые CLI-флаги

После существующих флагов (`INDEX_ONLY`, `CONTEXT_PACK_ONLY`, `NO_TREE`):

```js
const INDEX_MODE_ARG = args.find(a => a.startsWith('--index-mode='));
const INDEX_MODE = INDEX_MODE_ARG ? INDEX_MODE_ARG.split('=')[1] : null;

const PROFILE_ARG = args.find(a => a.startsWith('--profile='));
const PROFILE = PROFILE_ARG ? PROFILE_ARG.split('=')[1] : null;
```

### 5.3 Функция `applyProfile`

Добавить перед `main()`:

```js
function applyProfile(contextConfig, profileName) {
  if (!profileName) return contextConfig;
  const profiles = contextConfig.profiles || {};
  const p = profiles[profileName];
  if (!p) {
    console.warn(`⚠️ Profile "${profileName}" not found, using defaults`);
    return contextConfig;
  }
  const merged = { ...contextConfig };
  if (p.fullFiles) merged.fullFiles = p.fullFiles;
  const ci = { ...(merged.codeIndex || {}) };
  if (p.maxSnippets != null) ci.maxSnippets = p.maxSnippets;
  if (p.maxPackBytes != null) ci.maxPackBytes = p.maxPackBytes;
  if (p.maxDepth != null) ci.maxDepth = p.maxDepth;
  merged.codeIndex = ci;
  return merged;
}
```

### 5.4 Интеграция в `main()`

В начале `main()`, после `let contextConfig = loadContextConfig();`:

```js
if (PROFILE) contextConfig = applyProfile(contextConfig, PROFILE);
```

### 5.5 Передать `mode` и `ignorePatterns` в `buildCodeIndex`

Было:
```js
codeIndex = buildCodeIndex({
  rootDir: process.cwd(),
  files: indexFiles,
  previousIndex: prevIndex,
  maxFileSize: LIMITS.maxFileSize,
});
```

Должно быть:
```js
const resolvedMode = resolveMode(INDEX_MODE || indexCfg.indexMode);

codeIndex = buildCodeIndex({
  rootDir: process.cwd(),
  files: indexFiles,
  previousIndex: prevIndex,
  maxFileSize: LIMITS.maxFileSize,
  mode: resolvedMode,
  ignorePatterns: indexCfg.ignorePatterns,
});

console.log(`🧭 Code index saved (mode: ${resolvedMode}, symbols: ${codeIndex.symbols.length}, edges: ${codeIndex.edges.length})`);
```

## 6) Почему это закрывает P1

| Требование P1 | Решение |
|---|---|
| Точный endLine (без подсчета `{` в строках) | AST: `node.endPosition.row` |
| Import-aware edges | `extractEdgesAst` парсит `import`/`require`/`from...import` |
| Ignore `*.test.*`, `*.spec.*` | `matchesIgnorePattern` + `ignorePatterns` в конфиге |
| Профили контекста | `profiles` в `context.json` + `--profile=` CLI + `applyProfile()` |
| ReDoS-защита | `safeRegexExec` с таймаутом 5 секунд |
| Graceful degradation | `resolveMode('auto')` → ast если есть, regex если нет |
| Backward compat | Формат `.code_index.json` совместим (version: 2, добавлено поле `mode`) |
| `context-pack.js` без изменений | ✅ pack потребляет `{symbols, edges}` — формат не изменился |

## 7) Команды проверки P1 (после реализации P1-ветки)

```bash
# 1. Установить зависимости
npm install

# 2. AST-режим явно
node ai/scripts/generate-context.js --index-only --index-mode=ast
# Ожидание: "Code index saved (mode: ast, symbols: N, edges: M)"

# 3. Auto-detect
node ai/scripts/generate-context.js --index-only
# Ожидание: mode=ast если tree-sitter установлен

# 4. Regex fallback
node ai/scripts/generate-context.js --index-only --index-mode=regex
# Ожидание: "Code index saved (mode: regex, symbols: N)"

# 5. Ignore patterns (тестовые файлы исключены)
# Проверить .code_index.json — нет *.test.* / *.spec.* в byFile

# 6. Профили
node ai/scripts/generate-context.js --no-cache --profile=debug --prompt="fix auth bug"
# Ожидание: больший pack (maxSnippets=60, maxPackBytes=65000)

node ai/scripts/generate-context.js --no-cache --profile=docs --prompt="document API"
# Ожидание: меньший pack (maxSnippets=20, maxPackBytes=25000)

# 7. Сравнить точность endLine: AST vs regex
# Запустить --index-mode=ast и --index-mode=regex, сравнить .code_index.json
# AST должен дать точный endLine для signatureLine (P0 issue: 139 вместо 68)

# 8. Backward compat без tree-sitter
# Удалить node_modules/tree-sitter, запустить --index-mode=auto
# Должен откатиться на regex с warning, не упасть

# 9. Import-aware edges
# Проверить .code_index.json edges — должны быть записи с kind: 'import'
```

## 8) Минимальный чеклист ревью

- [ ] `npm install` проходит без ошибок (tree-sitter собирается)
- [ ] `--index-mode=ast` находит все символы, что находил regex
- [ ] AST endLine точнее, чем regex (проверить на signatureLine)
- [ ] Import-aware edges появляются в `.code_index.json`
- [ ] `*.test.*` файлы не попадают в индекс
- [ ] `--profile=debug` увеличивает maxSnippets/maxPackBytes
- [ ] `--profile=docs` уменьшает выходной bundle
- [ ] Без tree-sitter (auto mode) → regex без краша
- [ ] `context-pack.js` работает без изменений с новым индексом
- [ ] ReDoS-таймаут срабатывает на больших файлах (если есть)

---

## 9) Code Review от Claude Opus 4.6 (8.5/10)

Дата: 2026-02-23
Контекст ревью: `final.txt`, `version0.md`, `codeP0.md`, `draft_code.txt`, `tasks.txt`

### Вердикт: согласен с реализацией при 4 замечаниях (не блокеры)

Ядро P1 соответствует согласованному плану из цепочки обсуждений.

### Что реализовано корректно

1. **Ядро P1 соответствует scope:**
   - tree-sitter AST для точного `endLine` (решает P0 ограничение #1 из codeP0.md:762-765).
   - Import-aware edge detection через парсинг `import`/`require`/`from...import` (семантическое решение BUG-4 из draft_code.txt:676).
   - Ignore patterns `*.test.*`, `*.spec.*`, `*.stories.*` (RISK-3 от Gemini, draft_code.txt:733).
   - ReDoS-защита `safeRegexExec` с таймаутом 5 сек (RISK-1 от Gemini, draft_code.txt:726).

2. **Graceful degradation (10/10):**
   - `resolveMode('auto')` — AST если доступен, regex если нет.
   - Каждый `try { require('tree-sitter-xxx') } catch {}` изолирован.
   - Per-file fallback на regex для языков без AST-парсера.

3. **Обратная совместимость (10/10):**
   - `context-pack.js` без изменений — формат `{symbols, edges}` сохранён.
   - Инкрементальный кэш учитывает `mode` — смена режима = пересборка.
   - Version bump до 2 корректен.

### Замечание 1 [MEDIUM]: Scope creep — профили не были в согласованном P1

В `final.txt`, `version0.md` и `draft_code.txt` P1 определён как:
> tree-sitter AST, import-aware edges, ignore patterns, ReDoS-защита.

Секция `profiles` (coding/debug/docs) с `--profile=` и `applyProfile()` **нигде не обсуждалась**.
Нарушает принцип из version0.md:171:
> Расширение (P1/P2) допускается только после получения метрик качества и стоимости.

Рекомендация: вынести профили в P1.1 или отдельный PR. Либо провести мини-обсуждение с участниками по формату `ai/design/DISCUSSION_PATTERN.md`.

### Замечание 2 [MEDIUM]: AST-режим производит меньше рёбер, чем regex

P0 `extractEdges` (context-index.js:125-138) ищет **все упоминания** известных символов (kind: `ref`).
P1 `extractEdgesAst` (секция 3, строки 455-476) ищет **только import/require** (kind: `import`).

Это изменение семантики: файл использующий символ через re-export или глобальный scope — P0 найдёт ребро, P1 нет.
Import-only рёбра точнее и чище, но coverage графа сужается.

Рекомендация (одно из двух):
- **(A)** Гибрид: после import-рёбер добавить ref-проход для символов длиной 6+.
- **(B)** Оставить как есть, но задокументировать: "AST mode detects only import/require edges. For broader reference detection, use regex mode."

### Замечание 3 [LOW]: Неполное покрытие языков

AST-модуль поддерживает JS, TS, TSX, Python.
В `ai/specs/languages.json` — 7 языков (+ Java, C#, Go, PHP).
Go и PHP **не упомянуты** даже как опциональные. Файлы `.go`/`.php` тихо откатятся на regex.

Рекомендация: добавить в `buildCodeIndex` однократное предупреждение:
```js
if (mode === 'ast' && !parser && !warnedLangs.has(ext)) {
  console.warn(`⚠️ No AST parser for ${ext}, using regex fallback`);
  warnedLangs.add(ext);
}
```

### Замечание 4 [LOW]: Мелкие баги

**4.1** `signatureFromNode` (секция 3, строка 177) режет только по `{`. P0 `signatureLine` режет по `{` и `;`.
Фикс: добавить `cutSemi` для consistency.

**4.2** `matchesIgnorePattern` (секция 4.4, строка 556) создаёт `new RegExp()` на каждый вызов файла. На 1000+ файлов — 3000 компиляций.
Фикс: предкомпилировать regex один раз до цикла.

**4.3** Python `extractImportsPython`: проверка `i > 0` для `dotted_name` в `import_from_statement` может пропустить relative imports (`from . import foo`).
Рекомендация: добавить тест.

### Сводная таблица

| Критерий | Оценка |
|---|---|
| Соответствие P1 scope | 8/10 (профили — scope creep) |
| Качество кода | 8.5/10 (мелкие баги) |
| Graceful degradation | 10/10 |
| Обратная совместимость | 10/10 |
| Документация и чеклист | 9/10 |

### Рекомендуемый порядок реализации

1. Ядро P1 без профилей (tree-sitter, import-aware edges, ignore patterns, ReDoS).
2. Фиксы из замечания 4 (signatureFromNode, matchesIgnorePattern, Python relative imports).
3. Лог-предупреждения для языков без AST-парсера (замечание 3).
4. Документировать разницу edge coverage AST vs regex (замечание 2).
5. Профили — отдельным PR после согласования (замечание 1).
