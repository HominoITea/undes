'use strict';

const path = require('path');

// ============================================================
// Tree-Sitter AST Module (P1)
//
// Provides precise symbol extraction and import-aware edge
// detection via tree-sitter AST parsing. Supports 11 languages.
//
// NOTE: AST mode detects only import/require edges, NOT
// reference-by-name edges (which regex mode provides).
// This is a deliberate tradeoff: AST imports are precise
// but cover fewer connections than grep-based ref matching.
// ============================================================

// --- Lazy-loaded parsers (one per language variant) ---

let Parser = null;
const _grammars = {};   // { ext: grammar_module }
const _parsers = {};    // { ext: Parser_instance }
let _available = false;
let _initDone = false;

// Extension -> { pkg, langAccessor? } mapping for all supported languages
const LANG_MAP = {
  '.js':   { pkg: 'tree-sitter-javascript' },
  '.jsx':  { pkg: 'tree-sitter-javascript' },
  '.mjs':  { pkg: 'tree-sitter-javascript' },
  '.cjs':  { pkg: 'tree-sitter-javascript' },
  '.ts':   { pkg: 'tree-sitter-typescript', accessor: 'typescript' },
  '.tsx':  { pkg: 'tree-sitter-typescript', accessor: 'tsx' },
  '.py':   { pkg: 'tree-sitter-python' },
  '.rs':   { pkg: 'tree-sitter-rust' },
  '.c':    { pkg: 'tree-sitter-c' },
  '.h':    { pkg: 'tree-sitter-c' },
  '.cpp':  { pkg: 'tree-sitter-cpp' },
  '.cc':   { pkg: 'tree-sitter-cpp' },
  '.cxx':  { pkg: 'tree-sitter-cpp' },
  '.hpp':  { pkg: 'tree-sitter-cpp' },
  '.go':   { pkg: 'tree-sitter-go' },
  '.php':  { pkg: 'tree-sitter-php', accessor: 'php' },
  '.java': { pkg: 'tree-sitter-java' },
  '.cs':   { pkg: 'tree-sitter-c-sharp' },
  '.rb':   { pkg: 'tree-sitter-ruby' },
};

function isTreeSitterAvailable() {
  if (!_initDone) _init();
  return _available;
}

function _init() {
  _initDone = true;
  try {
    Parser = require('tree-sitter');
    _available = true;
  } catch {
    _available = false;
  }
}

function _getParser(ext) {
  if (!_available) return null;
  if (_parsers[ext]) return _parsers[ext];

  const entry = LANG_MAP[ext];
  if (!entry) return null;

  // Cache grammar per package+accessor
  const cacheKey = entry.pkg + (entry.accessor || '');
  if (!_grammars[cacheKey]) {
    try {
      const mod = require(entry.pkg);
      _grammars[cacheKey] = entry.accessor ? mod[entry.accessor] : mod;
    } catch {
      _grammars[cacheKey] = null;
    }
  }

  if (!_grammars[cacheKey]) return null;

  const parser = new Parser();
  parser.setLanguage(_grammars[cacheKey]);
  _parsers[ext] = parser;
  return parser;
}

// ============================================================
// Signature extraction (REVIEW FIX #2: cut at { AND ;)
// Mirrors P0 signatureLine logic from context-index.js:59-68
// ============================================================

function signatureFromNode(node, content) {
  const startLine = node.startPosition.row;
  const line = (content.split('\n')[startLine] || '').trim();
  const cutBrace = line.indexOf('{');
  const cutSemi = line.indexOf(';');
  let cut = -1;
  if (cutBrace >= 0 && cutSemi >= 0) cut = Math.min(cutBrace, cutSemi);
  else cut = Math.max(cutBrace, cutSemi);
  const sig = cut >= 0 ? line.slice(0, cut + 1) : line;
  return sig.slice(0, 300);
}

function getNodeFieldText(node, fieldName) {
  const fieldNode = node?.childForFieldName?.(fieldName);
  return String(fieldNode?.text || '').trim();
}

function splitTopLevelCommaSeparated(text = '') {
  const source = String(text || '').trim();
  if (!source) return [];

  const out = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let angleDepth = 0;

  for (const char of source) {
    if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && angleDepth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }

    current += char;

    if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === '{') braceDepth += 1;
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (char === '<') angleDepth += 1;
    else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);
  }

  if (current.trim()) out.push(current.trim());
  return out;
}

function extractParameterSegment(signature = '', langExt = '') {
  const source = String(signature || '');
  if (!source) return '';

  if (langExt === '.py') {
    const match = source.match(/def\s+[A-Za-z_][A-Za-z0-9_]*\s*\((.*)\)\s*(?:->|:|$)/);
    return match ? match[1] : '';
  }

  const firstParen = source.indexOf('(');
  if (firstParen < 0) return '';

  let depth = 0;
  for (let index = firstParen; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(firstParen + 1, index);
      }
    }
  }

  return '';
}

function stripDefaultValue(text = '') {
  return String(text || '').replace(/\s*=\s*.+$/g, '').trim();
}

function parseJsLikeParam(rawParam = '') {
  const cleaned = stripDefaultValue(String(rawParam || ''))
    .replace(/^[.]{3}/, '')
    .replace(/^(?:public|private|protected|readonly)\s+/g, '')
    .trim();
  if (!cleaned || cleaned === 'this') return null;

  const colonIndex = cleaned.indexOf(':');
  if (colonIndex >= 0) {
    return {
      name: cleaned.slice(0, colonIndex).trim(),
      type: cleaned.slice(colonIndex + 1).trim(),
    };
  }

  return { name: cleaned, type: '' };
}

function parseJavaLikeParam(rawParam = '') {
  const cleaned = stripDefaultValue(String(rawParam || ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { name: parts[0], type: '' };
  }

  return {
    name: parts[parts.length - 1].trim(),
    type: parts.slice(0, -1).join(' ').trim(),
  };
}

function parseGoParam(rawParam = '') {
  const cleaned = stripDefaultValue(String(rawParam || ''))
    .replace(/^[.]{3}/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { name: parts[0], type: '' };
  }

  return {
    name: parts[0].trim(),
    type: parts.slice(1).join(' ').trim(),
  };
}

function parseParameterList(signature = '', langExt = '') {
  const segment = extractParameterSegment(signature, langExt);
  if (!segment) return [];

  const rawParams = splitTopLevelCommaSeparated(segment);
  const out = [];

  for (const rawParam of rawParams) {
    let parsed = null;
    if (langExt === '.js' || langExt === '.ts' || langExt === '.tsx' || langExt === '.jsx' || langExt === '.py') {
      parsed = parseJsLikeParam(rawParam);
    } else if (langExt === '.java' || langExt === '.cs') {
      parsed = parseJavaLikeParam(rawParam);
    } else if (langExt === '.go') {
      parsed = parseGoParam(rawParam);
    } else {
      parsed = parseJsLikeParam(rawParam);
    }

    if (!parsed?.name) continue;
    out.push({
      name: parsed.name,
      type: parsed.type || '',
    });
  }

  return out;
}

function extractReturnType(signature = '', name = '', langExt = '') {
  const source = String(signature || '').trim();
  if (!source) return '';

  if (langExt === '.py') {
    return source.match(/->\s*([^:]+)\s*:?$/)?.[1]?.trim() || '';
  }

  if (langExt === '.js' || langExt === '.ts' || langExt === '.tsx' || langExt === '.jsx') {
    return source.match(/\)\s*:\s*([^={]+?)(?:\s*=>|\s*\{|$)/)?.[1]?.trim() || '';
  }

  if (langExt === '.go') {
    const match = source.match(/\)\s+([^{]+?)\s*\{$/);
    return match ? match[1].trim() : '';
  }

  if (langExt === '.java' || langExt === '.cs') {
    const escapedName = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`^(?:public|private|protected|internal|static|final|abstract|async|sealed|virtual|override|synchronized|\\s)+(.+?)\\s+${escapedName}\\s*\\(`));
    return match ? match[1].trim() : '';
  }

  return '';
}

function extractVisibility(signature = '') {
  const source = String(signature || '');
  const match = source.match(/\b(public|private|protected|internal)\b/);
  return match ? match[1] : '';
}

function extractSignatureDetail(node, filePath, type, content) {
  const signature = signatureFromNode(node, content);
  const langExt = path.extname(filePath).toLowerCase();
  const defaults = {
    signature,
    params: [],
    returnType: '',
    visibility: '',
    isAsync: false,
    isStatic: false,
  };

  if (!['function', 'method', 'const-fn'].includes(type)) {
    return defaults;
  }

  const parameterText = getNodeFieldText(node, 'parameters');
  const returnTypeText = getNodeFieldText(node, 'return_type') || getNodeFieldText(node, 'returnType');

  return {
    ...defaults,
    params: parameterText ? parseParameterList(`fn(${parameterText})`, langExt) : parseParameterList(signature, langExt),
    returnType: returnTypeText || extractReturnType(signature, node?.childForFieldName?.('name')?.text || '', langExt),
    visibility: extractVisibility(signature),
    isAsync: /\basync\b/.test(signature),
    isStatic: /\bstatic\b/.test(signature),
  };
}

const MODULE_CONTAINER_NAME = '<module>';
const TRUST_EXACT_AST = 'exact-ast';
const TRUST_APPROX_AST = 'approx-ast';

function pushSymbol(symbols, filePath, node, name, type, content, extra = {}) {
  if (!name || !node) return;
  const detail = extractSignatureDetail(node, filePath, type, content);
  symbols.push({
    id: `${filePath}:${name}:${node.startPosition.row + 1}`,
    name,
    type,
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    ...detail,
    ...extra,
  });
}

function normalizeContainerType(symbolType) {
  if (symbolType === 'class') return 'class';
  if (symbolType === 'interface') return 'interface';
  if (symbolType === 'type') return 'namespace';
  return 'module';
}

function isAncestorSymbol(parent, child) {
  if (!parent || !child || parent === child) return false;
  if (parent.startLine > child.startLine) return false;
  if (parent.endLine < child.endLine) return false;
  return parent.startLine < child.startLine || parent.endLine > child.endLine;
}

function buildOutlineNode(symbol) {
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

function buildAstMetadata(rawSymbols) {
  const sortedSymbols = [...(rawSymbols || [])].sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    if (b.endLine !== a.endLine) return b.endLine - a.endLine;
    return String(a.name).localeCompare(String(b.name));
  });

  const containerCandidatesByName = new Map();
  const symbols = sortedSymbols.map((symbol) => {
    const next = {
      ...symbol,
      bodyLines: Math.max(0, symbol.endLine - symbol.startLine),
      trust: TRUST_EXACT_AST,
    };
    if (!containerCandidatesByName.has(next.name)) {
      containerCandidatesByName.set(next.name, []);
    }
    containerCandidatesByName.get(next.name).push(next);
    return next;
  });

  const parentBySymbol = new Map();

  for (const symbol of symbols) {
    let parent = null;

    if (symbol.containerHint) {
      const hintedCandidates = containerCandidatesByName.get(symbol.containerHint) || [];
      parent = hintedCandidates.find((candidate) =>
        candidate !== symbol && (candidate.type === 'class' || candidate.type === 'interface' || candidate.type === 'type')
      ) || null;
    }

    if (!parent) {
      for (const candidate of symbols) {
        if (!isAncestorSymbol(candidate, symbol)) continue;
        if (!parent) {
          parent = candidate;
          continue;
        }
        const currentSpan = parent.endLine - parent.startLine;
        const nextSpan = candidate.endLine - candidate.startLine;
        if (nextSpan < currentSpan) {
          parent = candidate;
        }
      }
    }

    parentBySymbol.set(symbol, parent);
    symbol.container = parent ? parent.name : MODULE_CONTAINER_NAME;
    symbol.containerType = parent ? normalizeContainerType(parent.type) : 'module';
    delete symbol.containerHint;
  }

  const outlineRoots = [];
  const outlineBySymbol = new Map();
  for (const symbol of symbols) {
    outlineBySymbol.set(symbol, buildOutlineNode(symbol));
  }

  for (const symbol of symbols) {
    const parent = parentBySymbol.get(symbol);
    const outlineNode = outlineBySymbol.get(symbol);
    if (parent) {
      outlineBySymbol.get(parent).children.push(outlineNode);
    } else {
      outlineRoots.push(outlineNode);
    }
  }

  return {
    symbols,
    outline: outlineRoots,
    trust: TRUST_EXACT_AST,
  };
}

function isFunctionLikeSymbol(symbol) {
  return ['function', 'method', 'const-fn'].includes(symbol?.type);
}

function findEnclosingCallableSymbol(fileSymbols, lineNumber) {
  const candidates = (fileSymbols || []).filter((symbol) =>
    isFunctionLikeSymbol(symbol)
    && Number(symbol.startLine || 0) <= lineNumber
    && Number(symbol.endLine || 0) >= lineNumber
  );

  if (!candidates.length) return null;

  return candidates.sort((left, right) => {
    const leftSpan = Number(left.endLine || 0) - Number(left.startLine || 0);
    const rightSpan = Number(right.endLine || 0) - Number(right.startLine || 0);
    if (leftSpan !== rightSpan) return leftSpan - rightSpan;
    return Number(left.startLine || 0) - Number(right.startLine || 0);
  })[0];
}

function cutInvocationTarget(expressionText = '') {
  const source = String(expressionText || '').trim();
  if (!source) return '';

  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let angleDepth = 0;
  let out = '';

  for (const char of source) {
    if (char === '(' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && angleDepth === 0) {
      break;
    }

    out += char;

    if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === '{') braceDepth += 1;
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (char === '<') angleDepth += 1;
    else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);
  }

  return out.trim().replace(/^new\s+/, '');
}

function normalizeReceiverHint(receiverText = '') {
  const trimmed = String(receiverText || '').trim();
  if (!trimmed) return '';

  const normalized = trimmed
    .replace(/<[^>]+>/g, ' ')
    .replace(/[()[\]{}*&]/g, ' ')
    .trim();
  if (!normalized) return '';

  const parts = normalized.split(/::|\./).filter(Boolean);
  const receiver = parts.length ? parts[parts.length - 1] : normalized;
  const match = receiver.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  return match ? match[0] : '';
}

function parseCallDescriptor(expressionText = '') {
  const target = cutInvocationTarget(expressionText);
  if (!target) return null;

  const parts = target.split(/::|\./).filter(Boolean);
  const calleeRaw = parts.length ? parts[parts.length - 1] : target;
  const calleeMatch = calleeRaw.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  if (!calleeMatch) return null;

  return {
    calleeName: calleeMatch[0],
    receiverHint: parts.length > 1 ? normalizeReceiverHint(parts[parts.length - 2]) : '',
  };
}

function extractJavaCallDescriptor(node) {
  if (node.type !== 'method_invocation') return null;
  const objectText = getNodeFieldText(node, 'object');
  const nameText = getNodeFieldText(node, 'name');
  return parseCallDescriptor(objectText && nameText ? `${objectText}.${nameText}` : nameText || node.text);
}

function extractCSharpCallDescriptor(node) {
  if (node.type !== 'invocation_expression') return null;
  return parseCallDescriptor(
    getNodeFieldText(node, 'function')
    || getNodeFieldText(node, 'expression')
    || node.text
  );
}

function extractGoCallDescriptor(node) {
  if (node.type !== 'call_expression') return null;
  return parseCallDescriptor(getNodeFieldText(node, 'function') || node.text);
}

function extractRustCallDescriptor(node) {
  if (node.type === 'method_call_expression') {
    const receiverText = getNodeFieldText(node, 'receiver') || getNodeFieldText(node, 'value');
    const methodText = getNodeFieldText(node, 'method') || getNodeFieldText(node, 'name');
    return parseCallDescriptor(receiverText && methodText ? `${receiverText}.${methodText}` : methodText || node.text);
  }
  if (node.type === 'call_expression') {
    return parseCallDescriptor(getNodeFieldText(node, 'function') || node.text);
  }
  return null;
}

const CALL_DESCRIPTOR_EXTRACTORS = {
  '.java': extractJavaCallDescriptor,
  '.cs': extractCSharpCallDescriptor,
  '.go': extractGoCallDescriptor,
  '.rs': extractRustCallDescriptor,
};

function collectCallDescriptors(rootNode, ext) {
  const extractor = CALL_DESCRIPTOR_EXTRACTORS[ext];
  if (!extractor) return null;

  const descriptors = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const descriptor = extractor(node);
    if (descriptor?.calleeName) {
      descriptors.push({
        ...descriptor,
        line: Number(node.startPosition?.row || 0) + 1,
      });
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return descriptors;
}

function resolveCallTarget(callerSymbol, descriptor, symbolsByName) {
  const allCandidates = (symbolsByName.get(descriptor?.calleeName) || []).filter((candidate) =>
    isFunctionLikeSymbol(candidate) && candidate.id !== callerSymbol?.id
  );
  if (!allCandidates.length) return null;

  const receiverHint = normalizeReceiverHint(descriptor?.receiverHint);
  if (receiverHint) {
    let filtered = [];

    if (['this', 'self', 'super'].includes(receiverHint)) {
      if (!callerSymbol?.container || callerSymbol.container === MODULE_CONTAINER_NAME) {
        return null;
      }
      filtered = allCandidates.filter((candidate) => candidate.container === callerSymbol.container);
    } else {
      filtered = allCandidates.filter((candidate) => candidate.container === receiverHint);
    }

    return filtered.length === 1 ? filtered[0] : null;
  }

  if (callerSymbol?.container && callerSymbol.container !== MODULE_CONTAINER_NAME) {
    const sameContainerCandidates = allCandidates.filter((candidate) =>
      candidate.file === callerSymbol.file && candidate.container === callerSymbol.container
    );
    if (sameContainerCandidates.length === 1) return sameContainerCandidates[0];
    if (sameContainerCandidates.length > 1) return null;
  }

  if (callerSymbol?.file) {
    const sameFileCandidates = allCandidates.filter((candidate) => candidate.file === callerSymbol.file);
    if (sameFileCandidates.length === 1) return sameFileCandidates[0];
    if (sameFileCandidates.length > 1) return null;
  }

  return allCandidates.length === 1 ? allCandidates[0] : null;
}

function extractCallEdgesAst(filePath, content, symbols) {
  if (!_initDone) _init();
  const ext = path.extname(filePath).toLowerCase();
  const parser = _getParser(ext);
  if (!parser) return null;

  if (!CALL_DESCRIPTOR_EXTRACTORS[ext]) return null;

  let tree;
  try {
    tree = parser.parse(content);
  } catch {
    return null;
  }

  const descriptors = collectCallDescriptors(tree.rootNode, ext);
  if (!descriptors) return null;

  const fileSymbols = (symbols || []).filter((symbol) => symbol.file === filePath);
  const symbolsByName = new Map();
  for (const symbol of symbols || []) {
    if (!symbolsByName.has(symbol.name)) symbolsByName.set(symbol.name, []);
    symbolsByName.get(symbol.name).push(symbol);
  }

  const seen = new Set();
  const edges = [];

  for (const descriptor of descriptors) {
    const callerSymbol = findEnclosingCallableSymbol(fileSymbols, descriptor.line);
    if (!callerSymbol) continue;

    const calleeSymbol = resolveCallTarget(callerSymbol, descriptor, symbolsByName);
    if (!calleeSymbol) continue;

    const key = `${callerSymbol.id}:${calleeSymbol.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      fromId: callerSymbol.id,
      fromSymbol: callerSymbol.name,
      fromFile: callerSymbol.file,
      toId: calleeSymbol.id,
      toSymbol: calleeSymbol.name,
      toFile: calleeSymbol.file,
      kind: 'call',
      trust: TRUST_APPROX_AST,
    });
  }

  return edges;
}

// ============================================================
// Symbol Walkers — language-specific AST traversal
// ============================================================

// --- JS / TS / TSX ---

const JS_TS_SYMBOL_TYPES = {
  function_declaration: 'function',
  generator_function_declaration: 'function',
  class_declaration: 'class',
  method_definition: 'method',
  interface_declaration: 'interface',
  type_alias_declaration: 'type',
};

function _walkJsTs(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const type = node.type;
    let sym = null;

    if (JS_TS_SYMBOL_TYPES[type]) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        sym = { name: nameNode.text, type: JS_TS_SYMBOL_TYPES[type], node };
      }
    } else if (type === 'lexical_declaration' || type === 'variable_declaration') {
      // const foo = (...) => ...
      for (let i = 0; i < node.namedChildCount; i++) {
        const decl = node.namedChild(i);
        if (decl.type === 'variable_declarator') {
          const nameNode = decl.childForFieldName('name');
          const valueNode = decl.childForFieldName('value');
          if (nameNode && valueNode && valueNode.type === 'arrow_function') {
            sym = { name: nameNode.text, type: 'const-fn', node };
          }
        }
      }
    }

    if (sym) {
      pushSymbol(symbols, filePath, sym.node, sym.name, sym.type, content);
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- Python ---

const PY_SYMBOL_TYPES = {
  function_definition: 'function',
  class_definition: 'class',
};

function _walkPython(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    if (PY_SYMBOL_TYPES[node.type]) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, PY_SYMBOL_TYPES[node.type], content);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- Rust ---

const RUST_SYMBOL_TYPES = {
  function_item: 'function',
  struct_item: 'class',
  enum_item: 'class',
  trait_item: 'interface',
  impl_item: 'class',
  type_item: 'type',
};

function _walkRust(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    if (RUST_SYMBOL_TYPES[node.type]) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, RUST_SYMBOL_TYPES[node.type], content);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- C / C++ ---

const C_CPP_SYMBOL_TYPES = {
  function_definition: 'function',
  function_declarator: null, // handled specially
  struct_specifier: 'class',
  class_specifier: 'class',
  enum_specifier: 'class',
};

function _walkCCpp(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const type = node.type;

    if (type === 'function_definition') {
      const declarator = node.childForFieldName('declarator');
      if (declarator) {
        // function_declarator -> name is the identifier child
        const nameNode = declarator.type === 'function_declarator'
          ? declarator.childForFieldName('declarator')
          : declarator;
        const name = nameNode?.text;
        if (name && /^[A-Za-z_]/.test(name)) {
          pushSymbol(symbols, filePath, node, name, 'function', content);
        }
      }
    } else if (type === 'struct_specifier' || type === 'class_specifier' || type === 'enum_specifier') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'class', content);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- Go ---

function _walkGo(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const type = node.type;

    if (type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'function', content);
      }
    } else if (type === 'method_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const receiverNode = node.childForFieldName('receiver');
          const receiverText = receiverNode ? receiverNode.text : '';
          const receiverMatch = receiverText.match(/([A-Za-z_][\w]*)[^A-Za-z0-9_]*$/);
          pushSymbol(symbols, filePath, node, nameNode.text, 'method', content, {
            containerHint: receiverMatch ? receiverMatch[1] : undefined,
          });
        }
    } else if (type === 'type_declaration') {
      // type Foo struct { ... }
      for (let i = 0; i < node.namedChildCount; i++) {
        const spec = node.namedChild(i);
        if (spec.type === 'type_spec') {
          const nameNode = spec.childForFieldName('name');
          const typeNode = spec.childForFieldName('type');
          if (nameNode) {
            const symType = typeNode?.type === 'interface_type' ? 'interface' : 'class';
            pushSymbol(symbols, filePath, spec, nameNode.text, symType, content);
          }
        }
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- PHP ---

function _walkPhp(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const type = node.type;

    if (type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'function', content);
      }
    } else if (type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'class', content);
      }
    } else if (type === 'method_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'method', content);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- Java ---

function _walkJava(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const type = node.type;

    if (type === 'class_declaration' || type === 'interface_declaration' || type === 'enum_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const symType = type === 'interface_declaration' ? 'interface' : 'class';
        pushSymbol(symbols, filePath, node, nameNode.text, symType, content);
      }
    } else if (type === 'method_declaration' || type === 'constructor_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'method', content);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- C# ---

function _walkCSharp(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const type = node.type;

    if (type === 'class_declaration' || type === 'interface_declaration' ||
        type === 'struct_declaration' || type === 'enum_declaration' || type === 'record_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const symType = type === 'interface_declaration' ? 'interface' : 'class';
        pushSymbol(symbols, filePath, node, nameNode.text, symType, content);
      }
    } else if (type === 'method_declaration' || type === 'constructor_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'method', content);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// --- Ruby ---

function _walkRuby(rootNode, filePath, content) {
  const symbols = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    const type = node.type;

    if (type === 'class') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'class', content);
      }
    } else if (type === 'module') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'class', content);
      }
    } else if (type === 'method') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        pushSymbol(symbols, filePath, node, nameNode.text, 'method', content);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return symbols;
}

// ============================================================
// Dispatcher: extension -> walker
// ============================================================

const WALKER_MAP = {
  '.js': _walkJsTs, '.jsx': _walkJsTs, '.mjs': _walkJsTs, '.cjs': _walkJsTs,
  '.ts': _walkJsTs, '.tsx': _walkJsTs,
  '.py': _walkPython,
  '.rs': _walkRust,
  '.c': _walkCCpp, '.h': _walkCCpp,
  '.cpp': _walkCCpp, '.cc': _walkCCpp, '.cxx': _walkCCpp, '.hpp': _walkCCpp,
  '.go': _walkGo,
  '.php': _walkPhp,
  '.java': _walkJava,
  '.cs': _walkCSharp,
  '.rb': _walkRuby,
};

// ============================================================
// Import extractors (for import-aware edge detection)
// ============================================================

function _extractImportsJsTs(rootNode) {
  const names = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;

    // import { foo, bar } from './module'
    // import foo from './module'
    if (node.type === 'import_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'import_clause') {
          _collectImportClauseNames(child, names);
        }
      }
    }
    // const { foo } = require('./module')
    else if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const decl = node.namedChild(i);
        if (decl.type !== 'variable_declarator') continue;
        const valueNode = decl.childForFieldName('value');
        if (valueNode?.type === 'call_expression') {
          const callee = valueNode.childForFieldName('function');
          if (callee?.text === 'require') {
            const nameNode = decl.childForFieldName('name');
            if (nameNode) {
              if (nameNode.type === 'object_pattern') {
                _collectObjectPatternNames(nameNode, names);
              } else {
                names.push(nameNode.text);
              }
            }
          }
        }
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return names;
}

function _collectImportClauseNames(importClause, out) {
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

function _collectObjectPatternNames(objectPattern, out) {
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

function _extractImportsPython(rootNode) {
  const names = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;

    // import foo, bar
    if (node.type === 'import_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'dotted_name') {
          const parts = child.text.split('.');
          names.push(parts[parts.length - 1]);
        } else if (child.type === 'aliased_import') {
          const alias = child.childForFieldName('alias');
          const name = child.childForFieldName('name');
          names.push(alias ? alias.text : name?.text?.split('.').pop());
        }
      }
    }
    // from foo import bar, baz  /  from . import bar
    else if (node.type === 'import_from_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'dotted_name' && i > 0) {
          names.push(child.text);
        } else if (child.type === 'aliased_import') {
          const alias = child.childForFieldName('alias');
          const name = child.childForFieldName('name');
          names.push(alias ? alias.text : name?.text);
        }
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return names;
}

function _extractImportsGo(rootNode) {
  const names = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    if (node.type === 'import_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'import_spec') {
          const pathNode = child.childForFieldName('path');
          if (pathNode) {
            const p = pathNode.text.replace(/"/g, '');
            const parts = p.split('/');
            names.push(parts[parts.length - 1]);
          }
        } else if (child.type === 'import_spec_list') {
          for (let j = 0; j < child.namedChildCount; j++) {
            const spec = child.namedChild(j);
            if (spec.type === 'import_spec') {
              const pathNode = spec.childForFieldName('path');
              if (pathNode) {
                const p = pathNode.text.replace(/"/g, '');
                const parts = p.split('/');
                names.push(parts[parts.length - 1]);
              }
            }
          }
        }
      }
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return names;
}

function _extractImportsRust(rootNode) {
  const names = [];
  const cursor = rootNode.walk();
  let reachedRoot = false;

  do {
    const node = cursor.currentNode;
    if (node.type === 'use_declaration') {
      // Extract last identifier from use path
      _collectUseNames(node, names);
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
    }
  } while (!reachedRoot);

  return names;
}

function _collectUseNames(node, out) {
  // Recursively find identifiers in use declarations
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child.type === 'identifier') {
      out.push(child.text);
    } else if (child.type === 'use_list') {
      _collectUseNames(child, out);
    } else if (child.type === 'scoped_identifier' || child.type === 'use_as_clause') {
      // For `use foo::bar as baz`, take 'baz'; otherwise last segment
      const alias = child.childForFieldName('alias');
      if (alias) {
        out.push(alias.text);
      } else {
        const nameNode = child.childForFieldName('name');
        if (nameNode) out.push(nameNode.text);
      }
    } else if (child.type === 'scoped_use_list') {
      _collectUseNames(child, out);
    }
  }
}

// Import extractor dispatch
const IMPORT_EXTRACTOR = {
  '.js': _extractImportsJsTs, '.jsx': _extractImportsJsTs,
  '.mjs': _extractImportsJsTs, '.cjs': _extractImportsJsTs,
  '.ts': _extractImportsJsTs, '.tsx': _extractImportsJsTs,
  '.py': _extractImportsPython,
  '.go': _extractImportsGo,
  '.rs': _extractImportsRust,
  // C/C++/PHP/Java/C#/Ruby: no import extractor — will use regex ref edges as fallback
};

// ============================================================
// Public API
// ============================================================

/**
 * Extract symbols from a file using AST parsing.
 * @returns {Array|null} symbols array, or null if no parser for this language
 */
function extractSymbolsAst(filePath, content) {
  const metadata = extractAstMetadata(filePath, content);
  return metadata ? metadata.symbols : null;
}

function extractAstMetadata(filePath, content) {
  if (!_initDone) _init();
  const ext = path.extname(filePath).toLowerCase();
  const parser = _getParser(ext);
  if (!parser) return null;

  const walker = WALKER_MAP[ext];
  if (!walker) return null;

  try {
    const tree = parser.parse(content);
    return buildAstMetadata(walker(tree.rootNode, filePath, content));
  } catch {
    // tree-sitter may fail on very large files; fall back to regex
    return null;
  }
}

/**
 * Extract import-aware edges from a file using AST parsing.
 * Matches imported names against knownNames set.
 * @returns {Array|null} edges array, or null if no parser/extractor
 */
function extractEdgesAst(filePath, content, knownNames) {
  if (!_initDone) _init();
  const ext = path.extname(filePath).toLowerCase();
  const parser = _getParser(ext);
  if (!parser) return null;

  const extractor = IMPORT_EXTRACTOR[ext];
  if (!extractor) return null;

  let tree;
  try {
    tree = parser.parse(content);
  } catch {
    return null;
  }
  const importedNames = extractor(tree.rootNode);
  const edges = [];

  const seen = new Set();
  for (const name of importedNames) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (knownNames.has(name)) {
      edges.push({ fromFile: filePath, toSymbol: name, kind: 'import' });
    }
  }

  return edges;
}

module.exports = {
  isTreeSitterAvailable,
  extractAstMetadata,
  extractSymbolsAst,
  extractEdgesAst,
  extractCallEdgesAst,
};
