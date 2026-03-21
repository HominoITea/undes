const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const TOOL_ROOT = path.resolve(__dirname, '..', '..');

function normalizeStructuralSearchBackend(value) {
  const raw = String(value || 'ast-grep').trim().toLowerCase();
  if (raw === 'ast-grep' || raw === 'sg') return 'ast-grep';
  return 'index';
}

function resolveStructuralSearchConfig(codeIndexCfg = {}) {
  const maxSnippets = Number(codeIndexCfg.maxSnippets || 24);
  return {
    enabled: codeIndexCfg.structuralSearchEnabled !== false,
    backendRequested: normalizeStructuralSearchBackend(codeIndexCfg.structuralSearchBackend || 'ast-grep'),
    maxCandidates: Number(codeIndexCfg.structuralSearchMaxCandidates || Math.max(48, maxSnippets * 3)),
    snippetContextLines: Math.max(0, Number(codeIndexCfg.snippetContextLines || 4)),
    maxQueryTokens: Math.max(1, Number(codeIndexCfg.structuralSearchMaxQueryTokens || 6)),
    commandTimeoutMs: Math.max(250, Number(codeIndexCfg.structuralSearchCommandTimeoutMs || 2000)),
  };
}

function normalizeToken(token) {
  return String(token || '').toLowerCase().replace(/^[^\p{L}\p{N}_$.-]+|[^\p{L}\p{N}_$.-]+$/gu, '');
}

function sanitizeStructuralPatternToken(token) {
  return String(token || '').replace(/^[^\p{L}\p{N}_$]+|[^\p{L}\p{N}_$]+$/gu, '');
}

function looksLikeFileToken(token) {
  return /\.[a-z]{1,4}$/.test(token) || /[-_/]/.test(token);
}

function looksLikeCodeIdentifierToken(token) {
  const raw = String(token || '');
  if (!raw) return false;
  return /[a-z][A-Z]/.test(raw)
    || /[_$]/.test(raw)
    || /(Handler|Service|Controller|Impl|Facade|Listener|Event|Repository|Manager|Factory|Config|Template)\b/.test(raw);
}

function readSymbolExcerpt(rootDir, symbol, snippetContextLines, redactSecrets, fileCache) {
  const cacheKey = symbol.file;
  let lines = fileCache.get(cacheKey);
  if (!lines) {
    const abs = path.join(rootDir, String(symbol.file || ''));
    if (!fs.existsSync(abs)) return '';
    lines = fs.readFileSync(abs, 'utf8').split('\n');
    fileCache.set(cacheKey, lines);
  }

  const from = Math.max(1, Number(symbol.startLine || 1) - snippetContextLines);
  const to = Math.min(lines.length, Number(symbol.endLine || symbol.startLine || 1) + snippetContextLines);
  const excerpt = lines.slice(from - 1, to).join('\n');
  return typeof redactSecrets === 'function' ? redactSecrets(excerpt) : excerpt;
}

function preScoreSymbol(promptTokens, symbol, fileBoostTokens) {
  const name = String(symbol.name || '').toLowerCase();
  const signature = String(symbol.signature || '').toLowerCase();
  const file = String(symbol.file || '').toLowerCase();

  let score = 0;
  for (const token of promptTokens || []) {
    const t = normalizeToken(token);
    if (!t) continue;

    if (name === t) score += 12;
    else if (name.includes(t)) score += 5;
    else if (signature.includes(t)) score += 3;
    else if (file.includes(t)) score += 1;
  }

  for (const token of fileBoostTokens) {
    if (file.includes(token)) score += 20;
  }

  return score;
}

function contentScoreSymbol(promptTokens, excerpt) {
  const lowered = String(excerpt || '').toLowerCase();
  let score = 0;
  for (const token of promptTokens || []) {
    const t = normalizeToken(token);
    if (!t) continue;
    if (lowered.includes(t)) score += 2;
  }
  return score;
}

function dedupeByFileLine(scoredSymbols) {
  const seen = new Set();
  const out = [];
  for (const item of scoredSymbols) {
    const symbol = item.sym || item.symbol || item;
    const key = `${symbol.file}:${symbol.startLine}:${symbol.endLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function collectStructuralQueryTokens(promptTokens, maxQueryTokens, options = {}) {
  const { promptText = '', index = null } = options;
  const rawPromptTokens = String(promptText || '').match(/[A-Za-z_$][A-Za-z0-9_$.:-]{1,}/g) || [];
  const candidateSymbols = Array.isArray(index?.symbols) ? index.symbols : [];
  const candidates = [];

  function scoreCandidate(rawToken, order, source) {
    const sanitized = sanitizeStructuralPatternToken(rawToken);
    const normalized = normalizeToken(sanitized);
    if (!normalized) return;
    if (looksLikeFileToken(normalized)) return;
    if (/^\d+$/.test(normalized)) return;
    if (normalized.length < 3) return;

    let exactSymbolMatch = false;
    let partialSymbolMatch = false;
    let fileMatch = false;
    for (const sym of candidateSymbols) {
      const name = String(sym?.name || '').toLowerCase();
      const file = String(sym?.file || '').toLowerCase();
      if (!exactSymbolMatch && name === normalized) exactSymbolMatch = true;
      else if (!partialSymbolMatch && name.includes(normalized)) partialSymbolMatch = true;
      if (!fileMatch && file.includes(normalized)) fileMatch = true;
      if (exactSymbolMatch && partialSymbolMatch && fileMatch) break;
    }

    let score = source === 'raw' ? 10 : 0;
    if (looksLikeCodeIdentifierToken(sanitized)) score += 40;
    if (exactSymbolMatch) score += 80;
    else if (partialSymbolMatch) score += 25;
    if (fileMatch) score += 10;

    candidates.push({
      raw: sanitized,
      normalized,
      order,
      score,
    });
  }

  rawPromptTokens.forEach((token, indexPosition) => scoreCandidate(token, indexPosition, 'raw'));
  (promptTokens || []).forEach((token, indexPosition) => scoreCandidate(token, rawPromptTokens.length + indexPosition, 'normalized'));

  candidates.sort((a, b) => b.score - a.score || a.order - b.order);

  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    if (!candidate.raw || seen.has(candidate.normalized)) continue;
    seen.add(candidate.normalized);
    out.push(candidate.raw);
    if (out.length >= maxQueryTokens) break;
  }

  return out;
}

function runCommand(commandRunner, command, args, opts) {
  const runner = typeof commandRunner === 'function' ? commandRunner : childProcess.spawnSync;
  return runner(command, args, opts);
}

function pushIfExists(out, candidatePath) {
  if (candidatePath && fs.existsSync(candidatePath)) out.push(candidatePath);
}

function resolveAstGrepCommandCandidates(options = {}) {
  const env = options.env || process.env;
  const toolRoot = path.resolve(String(options.toolRoot || TOOL_ROOT));
  const out = [];
  const override = String(env.AI_AST_GREP_BIN || '').trim();
  if (override) out.push(override);

  const binDir = path.join(toolRoot, 'node_modules', '.bin');
  const cliDir = path.join(toolRoot, 'node_modules', '@ast-grep', 'cli');
  const isWindows = process.platform === 'win32';
  const binNames = isWindows
    ? ['ast-grep.cmd', 'sg.cmd', 'ast-grep', 'sg']
    : ['ast-grep', 'sg'];

  for (const name of binNames) {
    pushIfExists(out, path.join(binDir, name));
  }
  // Direct package entrypoints are useful outside npm-run PATH injection.
  pushIfExists(out, path.join(cliDir, 'ast-grep'));
  pushIfExists(out, path.join(cliDir, 'sg'));

  for (const name of ['ast-grep', 'sg']) {
    out.push(name);
  }

  const seen = new Set();
  return out.filter((candidate) => {
    const key = String(candidate || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function runAstGrepSearchCommand(commandRunner, binary, token, rootDir, env, timeoutMs) {
  const commandVariants = [
    ['run', '--pattern', token, '--json=stream', rootDir],
    // Legacy fallback for older ast-grep CLI variants.
    ['scan', '--pattern', token, '--json=stream', rootDir],
  ];

  for (const args of commandVariants) {
    const result = runCommand(commandRunner, binary, args, {
      encoding: 'utf8',
      env,
      cwd: rootDir,
      timeout: timeoutMs,
    });
    if (result && result.status === 0) return result;
  }

  return null;
}

function isAstGrepVersionOutput(text) {
  return /\bast-?grep\b/i.test(String(text || ''));
}

function detectAstGrepBinary({ env = process.env, commandRunner, timeoutMs, toolRoot } = {}) {
  const candidates = resolveAstGrepCommandCandidates({
    env,
    toolRoot,
  });
  for (const candidate of candidates) {
    try {
      const probe = runCommand(commandRunner, candidate, ['--version'], {
        encoding: 'utf8',
        env,
        timeout: timeoutMs,
      });
      const output = `${probe?.stdout || ''}\n${probe?.stderr || ''}`;
      if (probe && probe.status === 0 && isAstGrepVersionOutput(output)) {
        return candidate;
      }
    } catch {
      // Ignore and continue to next candidate.
    }
  }
  return null;
}

function parseAstGrepLineRange(match) {
  const startLineRaw = match?.range?.start?.line;
  const endLineRaw = match?.range?.end?.line;

  if (Number.isInteger(startLineRaw) && Number.isInteger(endLineRaw)) {
    const startLine = Math.max(1, Number(startLineRaw) + 1);
    const endLine = Math.max(startLine, Number(endLineRaw) + 1);
    return { startLine, endLine };
  }

  if (Number.isInteger(match?.startLine) && Number.isInteger(match?.endLine)) {
    return {
      startLine: Math.max(1, Number(match.startLine)),
      endLine: Math.max(Math.max(1, Number(match.startLine)), Number(match.endLine)),
    };
  }

  return null;
}

function normalizeAstGrepFile(rootDir, match) {
  const raw = match?.file || match?.path || match?.source || '';
  if (!raw) return null;
  const abs = path.isAbsolute(raw) ? raw : path.join(rootDir, raw);
  const rel = path.relative(rootDir, abs);
  if (!rel || rel.startsWith('..')) return null;
  return rel.split(path.sep).join('/');
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

function parseAstGrepMatches(output, rootDir) {
  const lines = String(output || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const matches = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const file = normalizeAstGrepFile(rootDir, parsed);
      const range = parseAstGrepLineRange(parsed);
      if (!file || !range) continue;
      matches.push({
        file,
        startLine: range.startLine,
        endLine: range.endLine,
      });
    } catch {
      // Ignore malformed lines; backend falls back if no useful matches remain.
    }
  }
  return matches;
}

function mapAstGrepMatchesToSymbols(matches, index) {
  const scores = new Map();
  for (const match of matches || []) {
    for (const sym of index.symbols || []) {
      if (sym.file !== match.file) continue;
      if (!rangesOverlap(
        Number(sym.startLine || 1),
        Number(sym.endLine || sym.startLine || 1),
        match.startLine,
        match.endLine
      )) {
        continue;
      }
      scores.set(sym.id, (scores.get(sym.id) || 0) + 1);
    }
  }
  return scores;
}

function scoreSymbolsFromMap(promptTokens, symbols, scoreMap, fileBoostTokens) {
  const fileBoostSet = new Set(fileBoostTokens || []);
  return symbols
    .map((sym) => {
      const pre = preScoreSymbol(promptTokens, sym, fileBoostSet);
      const structural = scoreMap.get(sym.id) || 0;
      return { sym, score: pre + structural * 10 };
    })
    .filter((item) => item.score > 0);
}

function searchAstGrepStructuralSymbols({ rootDir, promptText, promptTokens, index, cfg, redactSecrets, env, commandRunner }) {
  const binary = detectAstGrepBinary({
    env,
    commandRunner,
    timeoutMs: cfg.commandTimeoutMs,
  });
  if (!binary) return null;

  const queryTokens = collectStructuralQueryTokens(promptTokens, cfg.maxQueryTokens, {
    promptText,
    index,
  });
  if (!queryTokens.length) return null;

  const matches = [];
  for (const token of queryTokens) {
    try {
      const result = runAstGrepSearchCommand(
        commandRunner,
        binary,
        token,
        rootDir,
        env,
        cfg.commandTimeoutMs
      );
      if (!result) continue;
      matches.push(...parseAstGrepMatches(result.stdout, rootDir));
    } catch {
      // Ignore token-level failures; backend falls back if no useful matches remain.
    }
  }

  if (!matches.length) return null;

  const fileBoostTokens = (promptTokens || [])
    .map((token) => normalizeToken(token))
    .filter((token) => token && looksLikeFileToken(token));
  const scoreMap = mapAstGrepMatchesToSymbols(matches, index);
  const preScored = scoreSymbolsFromMap(promptTokens, index.symbols || [], scoreMap, fileBoostTokens);
  if (!preScored.length) return null;

  preScored.sort((a, b) => b.score - a.score);
  const windowSize = Math.max(8, Number(cfg.maxCandidates || 48));
  const candidates = preScored.slice(0, windowSize);
  const fileCache = new Map();
  const rescored = candidates.map((item) => {
    const excerpt = readSymbolExcerpt(rootDir, item.sym, 0, redactSecrets, fileCache);
    return {
      sym: item.sym,
      score: item.score + contentScoreSymbol(promptTokens, excerpt),
    };
  });

  rescored.sort((a, b) => b.score - a.score);
  const deduped = dedupeByFileLine(rescored);
  return {
    backendRequested: cfg.backendRequested,
    backendUsed: 'ast-grep',
    fallback: false,
    symbols: deduped.slice(0, windowSize).map((item) => item.sym),
  };
}

function searchIndexStructuralSymbols({ rootDir, promptTokens, index, cfg, redactSecrets }) {
  const fileBoostTokens = new Set();
  for (const token of promptTokens || []) {
    const normalized = normalizeToken(token);
    if (!normalized) continue;
    if (looksLikeFileToken(normalized)) fileBoostTokens.add(normalized);
  }

  const preScored = [];
  for (const sym of index.symbols || []) {
    const score = preScoreSymbol(promptTokens, sym, fileBoostTokens);
    if (score > 0) preScored.push({ sym, score });
  }

  preScored.sort((a, b) => b.score - a.score);
  const windowSize = Math.max(8, Number(cfg.maxCandidates || 48));
  const candidates = preScored.slice(0, windowSize);

  const fileCache = new Map();
  const rescored = candidates.map((item) => {
    const excerpt = readSymbolExcerpt(
      rootDir,
      item.sym,
      0,
      redactSecrets,
      fileCache
    );
    return {
      sym: item.sym,
      score: item.score + contentScoreSymbol(promptTokens, excerpt),
    };
  });

  rescored.sort((a, b) => b.score - a.score);
  const deduped = dedupeByFileLine(rescored);

  return {
    backendRequested: cfg.backendRequested,
    backendUsed: 'index',
    fallback: cfg.backendRequested !== 'index',
    symbols: deduped.slice(0, windowSize).map((item) => item.sym),
  };
}

function searchStructuralSymbols(options = {}) {
  const { rootDir, promptText, promptTokens, index, codeIndexConfig, redactSecrets, env, commandRunner } = options;
  if (!rootDir || !index || !Array.isArray(index.symbols)) {
    return {
      backendRequested: 'ast-grep',
      backendUsed: 'index',
      fallback: false,
      symbols: [],
    };
  }

  const cfg = resolveStructuralSearchConfig(codeIndexConfig || {});
  if (!cfg.enabled) {
    return {
      backendRequested: cfg.backendRequested,
      backendUsed: 'disabled',
      fallback: false,
      symbols: [],
    };
  }

  if (cfg.backendRequested === 'ast-grep') {
    const astResult = searchAstGrepStructuralSymbols({
      rootDir,
      promptText,
      promptTokens,
      index,
      cfg,
      redactSecrets,
      env,
      commandRunner,
    });
    if (astResult) return astResult;
  }

  return searchIndexStructuralSymbols({
    rootDir,
    promptTokens,
    index,
    cfg,
    redactSecrets,
  });
}

module.exports = {
  collectStructuralQueryTokens,
  detectAstGrepBinary,
  normalizeStructuralSearchBackend,
  parseAstGrepMatches,
  resolveStructuralSearchConfig,
  resolveAstGrepCommandCandidates,
  runAstGrepSearchCommand,
  searchStructuralSymbols,
};
