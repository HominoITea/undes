const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Tree-sitter AST module (optional, graceful fallback to regex)
let treeSitter = null;
try {
  treeSitter = require('./context-index-treesitter');
} catch {
  // tree-sitter not installed or failed to load; regex mode only
}

// ============================================================
// Regex symbol patterns (P0 baseline + Rust/C/C++/Go/Ruby)
// ============================================================

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
  rs: [
    { type: 'function', re: /\bfn\s+([A-Za-z_][\w]*)\s*[<(]/g },
    { type: 'class', re: /\bstruct\s+([A-Za-z_][\w]*)\b/g },
    { type: 'class', re: /\benum\s+([A-Za-z_][\w]*)\b/g },
    { type: 'interface', re: /\btrait\s+([A-Za-z_][\w]*)\b/g },
    { type: 'type', re: /\btype\s+([A-Za-z_][\w]*)\s*=/g },
  ],
  c: [
    { type: 'function', re: /^[A-Za-z_][\w\s*]+\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*\{/gm },
    { type: 'class', re: /\bstruct\s+([A-Za-z_][\w]*)\b/g },
    { type: 'class', re: /\benum\s+([A-Za-z_][\w]*)\b/g },
    { type: 'type', re: /\btypedef\s+[^;]+\s+([A-Za-z_][\w]*)\s*;/g },
  ],
  cpp: [
    { type: 'class', re: /\bclass\s+([A-Za-z_][\w]*)\b/g },
    { type: 'class', re: /\bstruct\s+([A-Za-z_][\w]*)\b/g },
    { type: 'function', re: /^[A-Za-z_][\w\s*:&<>]+\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*(?:const\s*)?\{/gm },
  ],
  go: [
    { type: 'function', re: /\bfunc\s+([A-Za-z_][\w]*)\s*\(/g },
    { type: 'method', re: /\bfunc\s*\([^)]*\)\s*([A-Za-z_][\w]*)\s*\(/g },
    { type: 'class', re: /\btype\s+([A-Za-z_][\w]*)\s+struct\b/g },
    { type: 'interface', re: /\btype\s+([A-Za-z_][\w]*)\s+interface\b/g },
  ],
  php: [
    { type: 'function', re: /\bfunction\s+([A-Za-z_][\w]*)\s*\(/g },
    { type: 'class', re: /\bclass\s+([A-Za-z_][\w]*)\b/g },
    { type: 'method', re: /\b(?:public|private|protected)?\s*function\s+([A-Za-z_][\w]*)\s*\(/g },
  ],
  rb: [
    { type: 'class', re: /\bclass\s+([A-Za-z_][\w]*)\b/g },
    { type: 'function', re: /\bdef\s+([A-Za-z_][\w?!]*)\b/g },
    { type: 'class', re: /\bmodule\s+([A-Za-z_][\w]*)\b/g },
  ],
};

// ============================================================
// Config resolution
// ============================================================

function resolveIndexConfig(contextConfig = {}) {
  const cfg = contextConfig.codeIndex || {};
  return {
    enabled: cfg.enabled !== false,
    outputPath: cfg.outputPath || '.code_index.json',
    maxDepth: Number(cfg.maxDepth || 2),
    maxPackBytes: Number(cfg.maxPackBytes || 32000),
    maxGraphEdges: Number(cfg.maxGraphEdges || 80),
    maxSnippets: Number(cfg.maxSnippets || 24),
    maxListedSymbols: Number(cfg.maxListedSymbols || 18),
    snippetContextLines: Number(cfg.snippetContextLines || 4),
    structuralSearchEnabled: cfg.structuralSearchEnabled !== false,
    structuralSearchBackend: cfg.structuralSearchBackend || 'ast-grep',
    structuralSearchMaxCandidates: Number(cfg.structuralSearchMaxCandidates || 0),
    fallbackToFullContext: cfg.fallbackToFullContext !== false,
    indexMode: cfg.indexMode || 'auto',
    ignorePatterns: Array.isArray(cfg.ignorePatterns) ? cfg.ignorePatterns : [],
  };
}

function resolveMode(configMode) {
  const mode = (configMode || 'auto').toLowerCase();
  if (mode === 'ast') {
    if (treeSitter && treeSitter.isTreeSitterAvailable()) return 'ast';
    console.warn('⚠️ AST mode requested but tree-sitter not available; falling back to regex.');
    return 'regex';
  }
  if (mode === 'regex') return 'regex';
  // auto: prefer AST if available
  return (treeSitter && treeSitter.isTreeSitterAvailable()) ? 'ast' : 'regex';
}

// ============================================================
// Ignore patterns (REVIEW FIX #3: pre-compile once)
// ============================================================

function compileIgnorePatterns(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return [];
  return patterns.map(pat => {
    let re = '';
    for (const ch of pat) {
      if (ch === '*') re += '.*';
      else if (ch === '?') re += '.';
      else if ('.+^${}()|[]\\'.includes(ch)) re += '\\' + ch;
      else re += ch;
    }
    return new RegExp(re, 'i');
  });
}

function matchesIgnorePattern(filePath, compiledPatterns) {
  for (const re of compiledPatterns) {
    if (re.test(filePath)) return true;
  }
  return false;
}

// ============================================================
// ReDoS protection
// ============================================================

function safeRegexExec(regex, content, timeoutMs = 5000) {
  const MAX_SAFE_LENGTH = 500000;
  if (content.length > MAX_SAFE_LENGTH) {
    content = content.slice(0, MAX_SAFE_LENGTH);
  }

  const results = [];
  regex.lastIndex = 0;
  const deadline = Date.now() + timeoutMs;
  let m;
  while ((m = regex.exec(content)) !== null) {
    results.push(m);
    if (Date.now() > deadline) {
      console.warn(`⚠️ Regex timeout (${timeoutMs}ms) on pattern ${regex.source.slice(0, 50)}...`);
      break;
    }
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }
  return results;
}

// ============================================================
// Language detection & helpers
// ============================================================

function extToLang(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ts' || ext === '.tsx') return 'ts';
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'js';
  if (ext === '.py') return 'py';
  if (ext === '.java') return 'java';
  if (ext === '.cs') return 'cs';
  if (ext === '.rs') return 'rs';
  if (ext === '.c' || ext === '.h') return 'c';
  if (ext === '.cpp' || ext === '.cc' || ext === '.cxx' || ext === '.hpp') return 'cpp';
  if (ext === '.go') return 'go';
  if (ext === '.php') return 'php';
  if (ext === '.rb') return 'rb';
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

// ============================================================
// Symbol extraction (regex mode, with ReDoS protection)
// ============================================================

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

const MODULE_CONTAINER_NAME = '<module>';
const TRUST_REGEX_FALLBACK = 'regex-fallback';
const TRUST_EXACT_AST = 'exact-ast';

function createOutlineNode(symbol) {
  return {
    kind: symbol.type,
    name: symbol.name,
    range: [symbol.startLine, symbol.endLine],
    signature: symbol.signature,
    bodyLines: symbol.bodyLines,
    trust: symbol.trust,
    children: [],
  };
}

function buildFlatOutline(symbols) {
  return [...symbols]
    .sort((a, b) => {
      if (a.startLine !== b.startLine) return a.startLine - b.startLine;
      if (b.endLine !== a.endLine) return b.endLine - a.endLine;
      return String(a.name).localeCompare(String(b.name));
    })
    .map((symbol) => createOutlineNode(symbol));
}

function enrichRegexSymbols(symbols) {
  return (symbols || []).map((symbol) => ({
    ...symbol,
    params: Array.isArray(symbol.params) ? symbol.params : [],
    returnType: String(symbol.returnType || '').trim(),
    visibility: String(symbol.visibility || '').trim(),
    isAsync: symbol.isAsync === true,
    isStatic: symbol.isStatic === true,
    container: MODULE_CONTAINER_NAME,
    containerType: 'module',
    bodyLines: Math.max(0, symbol.endLine - symbol.startLine),
    trust: TRUST_REGEX_FALLBACK,
  }));
}

function buildRegexFileMetadata(symbols) {
  const enrichedSymbols = enrichRegexSymbols(symbols);
  return {
    symbols: enrichedSymbols,
    outline: buildFlatOutline(enrichedSymbols),
    trust: TRUST_REGEX_FALLBACK,
  };
}

function buildAstFileMetadata(relPath, content) {
  if (!treeSitter) return null;

  if (typeof treeSitter.extractAstMetadata === 'function') {
    return treeSitter.extractAstMetadata(relPath, content);
  }

  const astSymbols = treeSitter.extractSymbolsAst(relPath, content);
  if (astSymbols === null) return null;

  const enrichedSymbols = (astSymbols || []).map((symbol) => ({
    ...symbol,
    params: Array.isArray(symbol.params) ? symbol.params : [],
    returnType: String(symbol.returnType || '').trim(),
    visibility: String(symbol.visibility || '').trim(),
    isAsync: symbol.isAsync === true,
    isStatic: symbol.isStatic === true,
    bodyLines: Math.max(0, symbol.endLine - symbol.startLine),
    trust: TRUST_EXACT_AST,
    container: symbol.container || MODULE_CONTAINER_NAME,
    containerType: symbol.containerType || 'module',
  }));

  return {
    symbols: enrichedSymbols,
    outline: buildFlatOutline(enrichedSymbols),
    trust: TRUST_EXACT_AST,
  };
}

// ============================================================
// Edge extraction (regex mode)
// ============================================================

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

// ============================================================
// Build code index (dual-mode: AST or regex)
// ============================================================

function hashContent(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

// REVIEW FIX #4: one-time fallback warnings per extension
const _fallbackWarned = new Set();

function buildCodeIndex({ rootDir, files, previousIndex = null, maxFileSize = 30000, mode = 'regex', ignorePatterns = [] }) {
  const compiledIgnore = compileIgnorePatterns(ignorePatterns);
  const byFile = {};
  const allSymbols = [];
  const contentsByFile = new Map();

  for (const rel of files) {
    // Skip files matching ignore patterns
    if (compiledIgnore.length > 0 && matchesIgnorePattern(rel, compiledIgnore)) continue;

    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;

    const st = fs.statSync(abs);
    if (st.size > maxFileSize) continue;

    const content = fs.readFileSync(abs, 'utf8');
    contentsByFile.set(rel, content);

    const fileHash = hashContent(content);
    const prev = previousIndex?.byFile?.[rel];

    // Incremental: skip if hash matches AND mode matches
    if (
      previousIndex?.version >= 5
      && prev
      && prev.hash === fileHash
      && prev.mode === mode
      && Array.isArray(prev.symbols)
      && Array.isArray(prev.outline)
    ) {
      byFile[rel] = prev;
      allSymbols.push(...prev.symbols);
      continue;
    }

    let fileMetadata;
    if (mode === 'ast' && treeSitter) {
      fileMetadata = buildAstFileMetadata(rel, content);
      if (fileMetadata !== null) {
        // no-op
      } else {
        // No AST parser for this extension — fallback to regex
        const ext = path.extname(rel).toLowerCase();
        if (!_fallbackWarned.has(ext)) {
          _fallbackWarned.add(ext);
          console.warn(`⚠️ No AST parser for "${ext}" files; using regex fallback.`);
        }
        fileMetadata = buildRegexFileMetadata(extractSymbols(rel, content));
      }
    } else {
      fileMetadata = buildRegexFileMetadata(extractSymbols(rel, content));
    }

    byFile[rel] = {
      hash: fileHash,
      mode,
      symbols: fileMetadata.symbols,
      outline: fileMetadata.outline,
      trust: fileMetadata.trust,
      size: st.size,
    };
    allSymbols.push(...fileMetadata.symbols);
  }

  // --- Edge extraction ---
  const knownNames = new Set(allSymbols.map((s) => s.name));
  const symbolsByFile = new Map();
  for (const s of allSymbols) {
    if (!symbolsByFile.has(s.file)) symbolsByFile.set(s.file, new Set());
    symbolsByFile.get(s.file).add(s.name);
  }

  const allEdges = [];
  const allCallEdges = [];
  for (const rel of Object.keys(byFile)) {
    const content = contentsByFile.get(rel) || '';

    if (mode === 'ast' && treeSitter) {
      // AST mode: import edges (precise)
      const importEdges = treeSitter.extractEdgesAst(rel, content, knownNames);
      if (importEdges) {
        allEdges.push(...importEdges);
      }

      // Also add regex reference edges for broader coverage.
      const definedInFile = symbolsByFile.get(rel) || new Set();
      const refEdges = extractEdges(rel, content, knownNames, definedInFile);
      const existingKeys = new Set((importEdges || []).map((e) => `${e.fromFile}:${e.toSymbol}`));
      for (const edge of refEdges) {
        const key = `${edge.fromFile}:${edge.toSymbol}`;
        if (!existingKeys.has(key)) {
          allEdges.push(edge);
        }
      }

      if (typeof treeSitter.extractCallEdgesAst === 'function') {
        const callEdges = treeSitter.extractCallEdgesAst(rel, content, allSymbols);
        if (Array.isArray(callEdges) && callEdges.length) {
          allCallEdges.push(...callEdges);
        }
      }
    } else {
      // Regex mode: ref edges (P0 behavior)
      const definedInFile = symbolsByFile.get(rel) || new Set();
      allEdges.push(...extractEdges(rel, content, knownNames, definedInFile));
    }
  }

  const maxCallEdges = allEdges.length * 3;
  const dedupedCallEdges = [];
  const callEdgeKeys = new Set();
  for (const edge of allCallEdges) {
    if (!edge?.fromId || !edge?.toId) continue;
    const key = `${edge.fromId}:${edge.toId}`;
    if (callEdgeKeys.has(key)) continue;
    callEdgeKeys.add(key);
    dedupedCallEdges.push(edge);
    if (maxCallEdges > 0 && dedupedCallEdges.length >= maxCallEdges) break;
  }

  return {
    version: 5,
    mode,
    generatedAt: new Date().toISOString(),
    symbols: allSymbols,
    edges: allEdges,
    callEdges: dedupedCallEdges,
    byFile,
  };
}

// ============================================================
// Index I/O
// ============================================================

function loadCodeIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (!Array.isArray(parsed?.symbols) || !Array.isArray(parsed?.edges)) return null;
    return {
      ...parsed,
      callEdges: Array.isArray(parsed.callEdges) ? parsed.callEdges : [],
    };
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
  resolveMode,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
};
