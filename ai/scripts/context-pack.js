const fs = require('fs');
const path = require('path');
const { searchStructuralSymbols } = require('./structural-search');
const {
  DEFAULT_STOP_WORDS,
  DEFAULT_TOKEN_PATTERN,
  DEFAULT_TOKEN_TRANSLATIONS,
} = require('./domain/language-packs/registry');

function normalizeToken(token) {
  return String(token || '').toLowerCase().replace(/^[^\p{L}\p{N}_$.-]+|[^\p{L}\p{N}_$.-]+$/gu, '');
}

function tokens(text) {
  return (text || '')
    .toLowerCase()
    .match(DEFAULT_TOKEN_PATTERN)
    ?.filter((t) => !DEFAULT_STOP_WORDS.has(t)) || [];
}

function translateTokens(ruTokens) {
  const out = [];
  for (const token of ruTokens || []) {
    const mapped = DEFAULT_TOKEN_TRANSLATIONS.get(normalizeToken(token));
    if (mapped) out.push(mapped);
  }
  return out;
}

function scoreSymbols(promptTokens, symbols) {
  return symbols.map((sym) => {
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

function fileNameSeeds(promptTokens, symbols) {
  const byFile = new Map();
  const knownBaseNames = new Set();
  const knownBareModules = new Set();
  for (const sym of symbols || []) {
    if (!byFile.has(sym.file)) byFile.set(sym.file, []);
    byFile.get(sym.file).push(sym);
    const baseName = path.basename(String(sym.file || '')).toLowerCase();
    if (!baseName) continue;
    knownBaseNames.add(baseName);
    knownBareModules.add(baseName.replace(/\.[^.]+$/, ''));
  }

  const candidates = new Set();
  for (const token of promptTokens || []) {
    const t = normalizeToken(token);
    if (!t) continue;
    const looksLikeFileRef = /\.[a-z]{1,4}$/.test(t) || /[-_/]/.test(t);
    if (looksLikeFileRef || knownBaseNames.has(t) || knownBareModules.has(t)) {
      candidates.add(t);
    }
  }
  if (!candidates.size) return [];

  const out = [];
  for (const token of candidates) {
    for (const [filePath, fileSymbols] of byFile) {
      const baseName = path.basename(String(filePath || '')).toLowerCase();
      const bare = baseName.replace(/\.[^.]+$/, '');
      if (baseName === token || bare === token) {
        out.push(...fileSymbols);
      }
    }
  }
  return out;
}

function extractPromptIdentifierTokens(promptText = '') {
  return String(promptText || '').match(/[A-Za-z_$][A-Za-z0-9_$.:-]{1,}/g) || [];
}

function promptNamedSymbolSeeds(promptText, symbols) {
  const normalizedPromptIdentifiers = new Set(
    extractPromptIdentifierTokens(promptText)
      .map((token) => normalizeToken(token))
      .filter(Boolean)
  );

  if (!normalizedPromptIdentifiers.size) return [];

  const out = [];
  for (const sym of symbols || []) {
    const symbolName = normalizeToken(sym?.name || '');
    const baseName = normalizeToken(path.basename(String(sym?.file || '')));
    const bareModule = normalizeToken(baseName.replace(/\.[^.]+$/, ''));

    if (
      (symbolName && normalizedPromptIdentifiers.has(symbolName))
      || (baseName && normalizedPromptIdentifiers.has(baseName))
      || (bareModule && normalizedPromptIdentifiers.has(bareModule))
    ) {
      out.push(sym);
    }
  }

  return out;
}

function prioritizePinnedSymbols(pinnedSymbols, selectedSymbols, maxSnippets) {
  const out = [];
  const seen = new Set();

  for (const sym of [...(pinnedSymbols || []), ...(selectedSymbols || [])]) {
    if (!sym) continue;
    const key = `${sym.file}:${sym.startLine}:${sym.endLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sym);
    if (out.length >= maxSnippets) break;
  }

  return out;
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
  const queue = seeds.map((s) => ({ name: s.name, depth: 0 }));
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

  const selected = index.symbols.filter((s) => selectedIds.has(s.id));
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

function inferContextLevel(promptText = '') {
  const normalized = String(promptText || '').toLowerCase();

  const architectureHints = [
    'architecture',
    'architectural',
    'overview',
    'high level',
    'structure',
    'design',
  ];
  if (architectureHints.some((hint) => normalized.includes(hint))) {
    return 'L0';
  }

  const deepAnalysisHints = [
    'stack trace',
    'stacktrace',
    'exception',
    'crash',
    'debug',
    'root cause',
    'why does',
    'why is',
  ];
  if (deepAnalysisHints.some((hint) => normalized.includes(hint))) {
    return 'L2';
  }

  return 'L1';
}

function groupSymbolsByFile(symbols) {
  const map = new Map();
  for (const sym of symbols || []) {
    if (!sym?.file) continue;
    if (!map.has(sym.file)) map.set(sym.file, []);
    map.get(sym.file).push(sym);
  }
  return map;
}

function getRenderableTargetSymbols(fileSelectedSymbols) {
  const nonContainerSymbols = (fileSelectedSymbols || []).filter((sym) =>
    sym && sym.type !== 'class' && sym.type !== 'interface'
  );
  return nonContainerSymbols.length ? nonContainerSymbols : [...(fileSelectedSymbols || [])];
}

function buildFallbackOutline(fileSymbols) {
  return [...(fileSymbols || [])]
    .sort((a, b) => {
      if (a.startLine !== b.startLine) return a.startLine - b.startLine;
      if (b.endLine !== a.endLine) return b.endLine - a.endLine;
      return String(a.name).localeCompare(String(b.name));
    })
    .map((sym) => ({
      kind: sym.type,
      name: sym.name,
      range: [sym.startLine, sym.endLine],
      signature: sym.signature,
      bodyLines: typeof sym.bodyLines === 'number' ? sym.bodyLines : Math.max(0, Number(sym.endLine || 0) - Number(sym.startLine || 0)),
      trust: sym.trust || 'regex-fallback',
      children: [],
    }));
}

function getFileOutline(index, relPath, fileSymbols) {
  const outline = index?.byFile?.[relPath]?.outline;
  return Array.isArray(outline) && outline.length ? outline : buildFallbackOutline(fileSymbols);
}

function renderOutlineNodes(nodes, depth = 0, out = []) {
  for (const node of nodes || []) {
    const indent = '  '.repeat(depth);
    const range = Array.isArray(node.range) ? node.range.join('-') : '';
    const signature = String(node.signature || '').trim() || `${node.kind} ${node.name}`;
    out.push(`${indent}${signature}${range ? ` [lines ${range}]` : ''}`);
    if (Array.isArray(node.children) && node.children.length) {
      renderOutlineNodes(node.children, depth + 1, out);
    }
  }
  return out;
}

function readWholeFile(rootDir, relPath, redactSecrets) {
  const abs = path.join(rootDir, relPath);
  if (!fs.existsSync(abs)) return '';
  const body = fs.readFileSync(abs, 'utf8');
  return typeof redactSecrets === 'function' ? redactSecrets(body) : body;
}

function getFileLineCount(rootDir, relPath) {
  const abs = path.join(rootDir, relPath);
  if (!fs.existsSync(abs)) return 0;
  return fs.readFileSync(abs, 'utf8').split('\n').length;
}

function buildOutlineSection(relPath, outline, levelLabel) {
  const lines = renderOutlineNodes(outline);
  if (!lines.length) return '';
  return [
    `#### ${relPath} (${levelLabel} Outline)`,
    '```text',
    ...lines,
    '```',
    '',
  ].join('\n');
}

function buildTargetBodiesSection(rootDir, relPath, targetSymbols, snippetContextLines, redactSecrets) {
  if (!targetSymbols.length) return '';

  const blocks = [];
  for (const sym of [...targetSymbols].sort((a, b) => a.startLine - b.startLine)) {
    const from = Math.max(1, Number(sym.startLine || 1) - snippetContextLines);
    const to = Number(sym.endLine || sym.startLine || 1) + snippetContextLines;
    const frag = readRange(rootDir, relPath, from, to, redactSecrets);
    blocks.push([
      `// === TARGET: ${sym.name} ===`,
      '```' + (path.extname(relPath).slice(1) || 'text'),
      frag,
      '```',
    ].join('\n'));
  }

  return [
    `#### ${relPath} (L1 Context Skeleton & Target Methods)`,
    ...blocks,
    '',
  ].join('\n');
}

function buildDependencyBodiesSection(rootDir, dependencySymbols, snippetContextLines, redactSecrets, maxDependencySymbols = 6) {
  const limited = [...(dependencySymbols || [])]
    .sort((a, b) => {
      if (a.file !== b.file) return String(a.file).localeCompare(String(b.file));
      return Number(a.startLine || 0) - Number(b.startLine || 0);
    })
    .slice(0, Math.max(1, maxDependencySymbols));

  const blocks = [];
  for (const sym of limited) {
    const from = Math.max(1, Number(sym.startLine || 1) - snippetContextLines);
    const to = Number(sym.endLine || sym.startLine || 1) + snippetContextLines;
    const frag = readRange(rootDir, sym.file, from, to, redactSecrets);
    if (!frag) continue;
    blocks.push([
      `#### ${sym.file} (L2 Dependency Body: ${sym.name})`,
      '```' + (path.extname(sym.file).slice(1) || 'text'),
      frag,
      '```',
      '',
    ].join('\n'));
  }

  return blocks;
}

function choosePreferredL1Block(relPath, hasStructural, rootDir, fileSymbols, selectedIds, renderableTargets, snippetContextLines, redactSecrets) {
  const targetBodiesBlock = buildTargetBodiesSection(
    rootDir,
    relPath,
    renderableTargets,
    snippetContextLines,
    redactSecrets
  );

  if (!hasStructural) {
    return targetBodiesBlock;
  }

  const skeletonBlock = [
    `#### ${relPath} (L1 Context Skeleton & Selected Methods)`,
    '```' + (path.extname(relPath).slice(1) || 'text'),
    buildFileSkeleton(rootDir, relPath, fileSymbols, selectedIds, redactSecrets),
    '```',
    '',
  ].join('\n');

  return Buffer.byteLength(skeletonBlock, 'utf8') <= Buffer.byteLength(targetBodiesBlock, 'utf8')
    ? skeletonBlock
    : targetBodiesBlock;
}

function appendBlockWithinBudget(out, block, bytes, maxPackBytes) {
  if (!block) return { appended: false, bytes };
  const nextBytes = bytes + Buffer.byteLength(block, 'utf8');
  if (nextBytes > maxPackBytes) return { appended: false, bytes };
  out.push(block);
  return { appended: true, bytes: nextBytes };
}

function collectDependencySymbols(index, selectedSymbols, graph, selectedIds) {
  const selectedFiles = new Set((selectedSymbols || []).map((sym) => sym.file).filter(Boolean));
  const explicitDependencies = [];
  const callDependencyIds = new Set();

  for (const edge of index?.edges || []) {
    if (!edge || !selectedFiles.has(edge.fromFile)) continue;
    for (const sym of index?.symbols || []) {
      if (!sym || selectedIds.has(sym.id)) continue;
      if (sym.name === edge.toSymbol) {
        explicitDependencies.push(sym);
      }
    }
  }

  for (const edge of index?.callEdges || []) {
    if (!edge || !selectedIds.has(edge.fromId) || !edge.toId || selectedIds.has(edge.toId)) continue;
    callDependencyIds.add(edge.toId);
  }

  const callDependencies = (index?.symbols || []).filter((sym) =>
    sym && callDependencyIds.has(sym.id) && !selectedIds.has(sym.id)
  );

  return dedupeByFileLine([
    ...explicitDependencies,
    ...callDependencies,
    ...((graph?.symbols || []).filter((sym) => sym && !selectedIds.has(sym.id))),
  ]);
}

function buildFileSkeleton(rootDir, relPath, fileSymbols, selectedIds, redactSecrets) {
  const abs = path.join(rootDir, relPath);
  if (!fs.existsSync(abs)) return '';

  const lines = fs.readFileSync(abs, 'utf8').split('\n');

  const classes = fileSymbols.filter(s => s.type === 'class' || s.type === 'interface');
  const classNames = new Set(classes.map(c => c.name));
  
  const unselectedMethods = fileSymbols.filter(s => {
    if (s.type !== 'method' && s.type !== 'function') return false;
    if (selectedIds.has(s.id)) return false;
    if (s.name === 'constructor' || s.name === '__init__' || classNames.has(s.name)) return false;
    return true;
  });

  const methodStartLines = new Set(unselectedMethods.map((m) => Math.max(1, Number(m.startLine || 1))));
  const skipLines = new Set();
  for (const m of unselectedMethods) {
    for (let i = Math.max(1, Number(m.startLine || 1)); i <= Number(m.endLine || m.startLine || 1); i++) {
      skipLines.add(i);
    }
  }

  const out = [];
  for (let i = 1; i <= lines.length; i++) {
    if (skipLines.has(i)) {
      if (methodStartLines.has(i)) {
        out.push('  // ... unselected method body omitted ...');
      }
      continue;
    }
    out.push(lines[i - 1]);
  }

  const body = out.join('\n');
  return typeof redactSecrets === 'function' ? redactSecrets(body) : body;
}

function findRelevantStructuralClasses(fileSymbols, selectedIds) {
  const selectedSymbols = fileSymbols.filter((sym) => selectedIds.has(sym.id));
  const classes = fileSymbols.filter((sym) => sym.type === 'class');
  const relevant = new Map();

  for (const sym of selectedSymbols) {
    if (sym.type === 'class') {
      relevant.set(sym.id, sym);
      continue;
    }

    const symStart = Number(sym.startLine || 1);
    const symEnd = Number(sym.endLine || sym.startLine || 1);
    for (const cls of classes) {
      const clsStart = Number(cls.startLine || 1);
      const clsEnd = Number(cls.endLine || cls.startLine || 1);
      if (clsStart <= symStart && clsEnd >= symEnd) {
        relevant.set(cls.id, cls);
      }
    }
  }

  return [...relevant.values()];
}

function parseImplementedInterfaceNames(classHeaderText) {
  const out = new Set();
  const header = String(classHeaderText || '');

  for (const match of header.matchAll(/\bimplements\s+([A-Za-z0-9_$.,<>\s]+)/g)) {
    const rawList = String(match[1] || '').split(',');
    for (const rawName of rawList) {
      const cleaned = rawName
        .replace(/<[^>]+>/g, ' ')
        .trim()
        .split(/\s+/)
        .pop();
      if (cleaned) out.add(cleaned.replace(/^.*\./, ''));
    }
  }

  return [...out];
}

function collectImplementedInterfaceSymbols(rootDir, relPath, index, fileSymbols, selectedIds) {
  const abs = path.join(rootDir, relPath);
  if (!fs.existsSync(abs)) return [];

  const sourceLines = fs.readFileSync(abs, 'utf8').split('\n');
  const relevantClasses = findRelevantStructuralClasses(fileSymbols, selectedIds);
  if (!relevantClasses.length) return [];

  const symbolsByName = new Map();
  for (const sym of index.symbols || []) {
    if (sym.type !== 'interface') continue;
    if (!symbolsByName.has(sym.name)) symbolsByName.set(sym.name, []);
    symbolsByName.get(sym.name).push(sym);
  }

  const edgeTargets = new Set(
    (index.edges || [])
      .filter((edge) => edge && edge.fromFile === relPath)
      .map((edge) => edge.toSymbol)
  );

  const out = [];
  const seen = new Set();
  for (const cls of relevantClasses) {
    const headerWindow = sourceLines
      .slice(Math.max(0, Number(cls.startLine || 1) - 1), Math.min(sourceLines.length, Number(cls.startLine || 1) + 6))
      .join('\n');
    const interfaceNames = parseImplementedInterfaceNames(headerWindow);

    for (const name of interfaceNames) {
      const candidates = symbolsByName.get(name) || [];
      if (candidates.length !== 1) continue;
      if (!edgeTargets.has(name) && candidates[0].file !== relPath) continue;

      const candidate = candidates[0];
      const key = `${candidate.file}:${candidate.startLine}:${candidate.endLine}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
    }
  }

  return out;
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
    return {
      used: false,
      reason: 'no prompt or invalid index',
      structuralSearch: null,
    };
  }

  const promptTokens = tokens(promptText);
  const translated = translateTokens(promptTokens);
  if (translated.length) promptTokens.push(...translated);

  const structural = searchStructuralSymbols({
    rootDir,
    promptText,
    promptTokens,
    index,
    codeIndexConfig: cfg,
    redactSecrets,
  });
  const structuralSummary = {
    backendRequested: structural.backendRequested,
    backendUsed: structural.backendUsed,
    fallback: Boolean(structural.fallback),
    symbolCount: Array.isArray(structural.symbols) ? structural.symbols.length : 0,
  };

  const namedSymbolSeeds = promptNamedSymbolSeeds(promptText, index.symbols);
  const structuralSeeds = structural.symbols
    .slice(0, Math.max(4, Math.min(10, cfg.maxSnippets)));

  const scored = scoreSymbols(promptTokens, index.symbols).filter((x) => x.score > 0);
  const scoreSeeds = scored.slice(0, Math.max(4, Math.min(10, cfg.maxSnippets))).map((x) => x.sym);
  const fnSeeds = fileNameSeeds(promptTokens, index.symbols);

  const seedMap = new Map();
  for (const sym of [...namedSymbolSeeds, ...structuralSeeds, ...fnSeeds, ...scoreSeeds]) {
    if (!sym || !sym.id || seedMap.has(sym.id)) continue;
    seedMap.set(sym.id, sym);
  }
  const seeds = [...seedMap.values()];

  if (!seeds.length) {
    return {
      used: false,
      reason: 'no matching symbols',
      structuralSearch: structuralSummary,
    };
  }

  const graph = expand(index, seeds, cfg.maxDepth, cfg.maxGraphEdges);
  const selectedSymbols = prioritizePinnedSymbols(
    dedupeByFileLine(namedSymbolSeeds),
    dedupeByFileLine(graph.symbols),
    cfg.maxSnippets
  );
  const listedSymbols = selectedSymbols.slice(0, Math.max(1, Number(cfg.maxListedSymbols || selectedSymbols.length)));
  const snippetContextLines = Math.max(0, Number(cfg.snippetContextLines ?? 4));

  const out = [];
  out.push('## CONTEXT PACK');
  out.push(`Prompt: ${promptText}`);
  const levelUsed = inferContextLevel(promptText);
  out.push(`Level: ${levelUsed}`);
  out.push('');
  out.push('### Symbols');
  for (const s of listedSymbols) {
    out.push(`- ${s.name} [${s.type}] ${s.file}:${s.startLine}-${s.endLine}`);
  }
  if (selectedSymbols.length > listedSymbols.length) {
    out.push(`- ... (${selectedSymbols.length - listedSymbols.length} more symbols omitted)`);
  }

  out.push('');
  out.push('### Graph (trimmed)');
  for (const e of graph.edges.slice(0, cfg.maxGraphEdges)) {
    out.push(`- ${e.fromFile} -> ${e.toSymbol} (${e.kind})`);
  }

  out.push('');
  out.push('### Relevant Code Fragments');

  let bytes = Buffer.byteLength(out.join('\n'), 'utf8');
  const processedSkeletonFiles = new Set();
  const processedInterfaceSymbols = new Set();
  const selectedIds = new Set(selectedSymbols.map(s => s.id));
  const structuralIds = new Set(Array.isArray(structural.symbols) ? structural.symbols.map(s => s.id) : []);
  const dependencySymbols = collectDependencySymbols(index, selectedSymbols, graph, selectedIds);
  const fileGroups = groupSymbolsByFile(selectedSymbols);
  const smallFileLines = Math.max(1, Number(cfg.smallFileLines || 150));

  for (const [relPath, fileSelectedSymbols] of fileGroups) {
    if (processedSkeletonFiles.has(relPath)) continue;

    const fileSymbols = index.symbols.filter((x) => x.file === relPath);
    const outline = getFileOutline(index, relPath, fileSymbols);
    const lineCount = getFileLineCount(rootDir, relPath);
    const hasStructural = structuralIds.size > 0 && fileSymbols.some((x) => selectedIds.has(x.id) && structuralIds.has(x.id));
    const useSmallFileFullBody = lineCount > 0 && lineCount <= smallFileLines;

    const interfaceSymbols = collectImplementedInterfaceSymbols(rootDir, relPath, index, fileSymbols, selectedIds);

    if (useSmallFileFullBody) {
      const fullBody = readWholeFile(rootDir, relPath, redactSecrets);
      const block = [
        `#### ${relPath} (${levelUsed} full file; small-file heuristic)`,
        '```' + (path.extname(relPath).slice(1) || 'text'),
        fullBody,
        '```',
        '',
      ].join('\n');
      const appended = appendBlockWithinBudget(out, block, bytes, cfg.maxPackBytes);
      if (!appended.appended) break;
      bytes = appended.bytes;
    } else {
      const outlineBlock = buildOutlineSection(relPath, outline, levelUsed);
      const appendedOutline = appendBlockWithinBudget(out, outlineBlock, bytes, cfg.maxPackBytes);
      if (!appendedOutline.appended) break;
      bytes = appendedOutline.bytes;

      if (levelUsed !== 'L0') {
        const targetBlock = choosePreferredL1Block(
          relPath,
          hasStructural,
          rootDir,
          fileSymbols,
          selectedIds,
          getRenderableTargetSymbols(fileSelectedSymbols),
          snippetContextLines,
          redactSecrets
        );

        const appendedTarget = appendBlockWithinBudget(out, targetBlock, bytes, cfg.maxPackBytes);
        if (!appendedTarget.appended) break;
        bytes = appendedTarget.bytes;
      }
    }

    if (levelUsed === 'L1' || levelUsed === 'L2') {
      for (const iface of interfaceSymbols) {
        const ifaceKey = `${iface.file}:${iface.startLine}:${iface.endLine}`;
        if (processedInterfaceSymbols.has(ifaceKey)) continue;

        const ifaceFrag = readRange(rootDir, iface.file, iface.startLine, iface.endLine, redactSecrets);
        const ifaceBlock = [
          `#### ${iface.file} (Implemented Interface Signatures)`,
          '```' + (path.extname(iface.file).slice(1) || 'text'),
          ifaceFrag,
          '```',
          '',
        ].join('\n');
        const appendedIface = appendBlockWithinBudget(out, ifaceBlock, bytes, cfg.maxPackBytes);
        if (!appendedIface.appended) break;

        bytes = appendedIface.bytes;
        processedInterfaceSymbols.add(ifaceKey);
      }
    }

    processedSkeletonFiles.add(relPath);
  }

  if (levelUsed === 'L2') {
    const dependencyBlocks = buildDependencyBodiesSection(
      rootDir,
      dependencySymbols,
      snippetContextLines,
      redactSecrets,
      Number(cfg.maxDependencyBodies || 6)
    );
    for (const block of dependencyBlocks) {
      const appended = appendBlockWithinBudget(out, block, bytes, cfg.maxPackBytes);
      if (!appended.appended) break;
      bytes = appended.bytes;
    }
  }

  return {
    used: true,
    markdown: out.join('\n'),
    selectedCount: selectedSymbols.length,
    levelUsed,
    structuralSearch: structuralSummary,
  };
}

module.exports = {
  buildContextPack,
  inferContextLevel,
  tokens,
  scoreSymbols,
  fileNameSeeds,
  promptNamedSymbolSeeds,
  translateTokens,
  TOKEN_TRANSLATIONS: DEFAULT_TOKEN_TRANSLATIONS,
};
