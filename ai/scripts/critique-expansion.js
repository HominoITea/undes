'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_FIELD_LENGTH = 240;
const DEFAULT_SNIPPET_CONTEXT_LINES = 4;
const DEFAULT_MAX_SNIPPET_LINES = 120;
const DEFAULT_MAX_APPENDIX_BYTES = 16000;

function clampPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function sanitizeTextField(value, maxLength = DEFAULT_MAX_FIELD_LENGTH) {
  if (value === undefined || value === null) return '';
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function normalizeLookupKey(value = '') {
  return sanitizeTextField(value, DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[,:;.\s]+$/g, '')
    .toLowerCase();
}

function normalizeRelativePath(value = '') {
  const normalized = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^`+|`+$/g, '');
  if (!normalized || normalized.includes('..')) return '';
  return normalized;
}

function looksLikeRelativeFilePath(value = '') {
  const normalized = normalizeRelativePath(value);
  if (!normalized) return false;
  return normalized.includes('/') || /\.[A-Za-z0-9_]+$/.test(normalized);
}

function parseScopedMethodReference(value = '') {
  const source = sanitizeTextField(value, DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .trim();
  const hashIndex = source.indexOf('#');
  if (hashIndex <= 0 || hashIndex >= source.length - 1) return null;

  const owner = source.slice(0, hashIndex)
    .replace(/\([^)]*\)/g, '')
    .replace(/[,:;\s]+$/g, '')
    .trim();
  const member = source.slice(hashIndex + 1)
    .replace(/\([^)]*\)/g, '')
    .replace(/[,:;\s]+$/g, '')
    .trim();

  if (!owner || !member) return null;
  return { owner, member };
}

function normalizeScopedOwnerName(owner = '') {
  const source = sanitizeTextField(owner, DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .replace(/[,:;\s]+$/g, '')
    .trim();
  if (!source) return '';
  if (looksLikeRelativeFilePath(source)) return normalizeRelativePath(source);

  const parts = source.split(/\s+/).filter(Boolean);
  if (
    parts.length >= 2
    && /^[A-Z][A-Za-z0-9_]*$/.test(parts[0])
    && ['entity', 'class', 'interface', 'module', 'struct', 'trait'].includes(parts[1].toLowerCase())
  ) {
    return parts[0];
  }

  return source;
}

function normalizeContainerName(value = '') {
  const normalized = sanitizeTextField(value, DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .replace(/[,:;\s]+$/g, '')
    .trim();
  if (!normalized) return '';
  return normalizeLookupKey(normalized);
}

function splitScopedMembers(value = '') {
  const source = sanitizeTextField(value, DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .trim();
  if (!source) return [];

  const plusParts = source.split(/\s*\+\s*/).map((part) => part.trim()).filter(Boolean);
  if (plusParts.length > 1 && plusParts.every((part) => parseScopedMethodReference(part))) {
    return plusParts;
  }

  const scoped = parseScopedMethodReference(source);
  if (!scoped) return [source];

  const owner = normalizeScopedOwnerName(scoped.owner);
  const members = scoped.member
    .split(',')
    .map((part) => part.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean);
  if (members.length <= 1) return [`${owner}#${scoped.member}`];
  return members.map((member) => `${owner}#${member}`);
}

function extractOwnerToken(value = '') {
  const source = sanitizeTextField(value, DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .trim();
  if (!source) return '';
  const match = source.match(/\b[A-Z][A-Za-z0-9_]{2,}\b/);
  return match ? match[0] : '';
}

function parseLineRange(text = '') {
  const source = String(text || '').trim();
  let match = source.match(/^(.+?)#L(\d+)(?:-L?(\d+))?$/i);
  if (!match) {
    match = source.match(/^(.+?):(\d+)(?:-(\d+))?$/);
  }
  if (!match) return null;

  const file = normalizeRelativePath(match[1]);
  const startLine = clampPositiveInt(match[2], 1);
  const endLine = clampPositiveInt(match[3] || match[2], startLine);
  if (!file) return null;

  return {
    file,
    startLine,
    endLine: Math.max(startLine, endLine),
  };
}

function lineRangeSpan(range) {
  if (!range) return 0;
  return Math.max(1, Number(range.endLine || range.startLine || 0) - Number(range.startLine || 0) + 1);
}

function normalizeMissingSeamRequest(item, options = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const maxFieldLength = clampPositiveInt(options.maxFieldLength, DEFAULT_MAX_FIELD_LENGTH);
  const symbolOrSeam = sanitizeTextField(
    item.symbolOrSeam || item.symbol || item.seam || item.name,
    maxFieldLength,
  )
    .replace(/^`+|`+$/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[,:;\s]+$/g, '')
    .trim();

  if (!symbolOrSeam) return null;

  return {
    symbolOrSeam,
    reasonNeeded: sanitizeTextField(item.reasonNeeded || item.reason || item.why, maxFieldLength),
    expectedImpact: sanitizeTextField(item.expectedImpact || item.impact, maxFieldLength),
    fetchHint: sanitizeTextField(item.fetchHint || item.hint || item.fileHint, maxFieldLength),
  };
}

function inferMissingSeamOwner(request = {}) {
  const scoped = parseScopedMethodReference(request.symbolOrSeam || '');
  if (scoped) {
    const normalizedOwner = normalizeScopedOwnerName(scoped.owner);
    if (normalizedOwner) return normalizedOwner;
  }

  const directOwner = extractOwnerToken(request.symbolOrSeam || '');
  if (directOwner) return directOwner;

  const lineHint = parseLineRange(request.fetchHint || '');
  if (lineHint?.file) return path.basename(lineHint.file, path.extname(lineHint.file));

  const fileHint = looksLikeRelativeFilePath(request.fetchHint || '')
    ? normalizeRelativePath(request.fetchHint || '')
    : '';
  if (fileHint) return path.basename(fileHint, path.extname(fileHint));

  return '';
}

function normalizeExpandedFetchHint(fetchHint = '', options = {}) {
  const lineHint = parseLineRange(fetchHint);
  if (!lineHint) return sanitizeTextField(fetchHint, DEFAULT_MAX_FIELD_LENGTH);
  if (options.preferFileOnly) return lineHint.file;
  if (lineRangeSpan(lineHint) > clampPositiveInt(options.maxSnippetLines, DEFAULT_MAX_SNIPPET_LINES)) {
    return lineHint.file;
  }
  return sanitizeTextField(fetchHint, DEFAULT_MAX_FIELD_LENGTH);
}

function extractMethodHintsFromReason(text = '') {
  const source = sanitizeTextField(text, DEFAULT_MAX_FIELD_LENGTH);
  if (!source) return [];
  const matches = source.match(/\b[a-z][A-Za-z0-9_]{2,}\b/g) || [];
  const seen = new Set();
  const out = [];
  for (const token of matches) {
    if (!/[A-Z_]/.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function expandMethodScopedMissingSeamRequests(request) {
  if (!request || typeof request !== 'object') return [];
  const explicitScoped = splitScopedMembers(request.symbolOrSeam);
  if (explicitScoped.length > 1) {
    return explicitScoped.map((symbolOrSeam) => ({
      ...request,
      symbolOrSeam,
    }));
  }
  if (parseScopedMethodReference(request.symbolOrSeam) || isLikelyDirectMemberRequest(request)) {
    return explicitScoped.length === 1
      ? [{ ...request, symbolOrSeam: explicitScoped[0] }]
      : [request];
  }

  const owner = inferMissingSeamOwner(request);
  if (!owner) return [request];

  const methodHints = extractMethodHintsFromReason(request.reasonNeeded);
  if (methodHints.length === 0) return [request];

  return methodHints.map((methodName) => ({
    ...request,
    symbolOrSeam: `${owner}#${methodName}`,
    fetchHint: normalizeExpandedFetchHint(request.fetchHint, {
      preferFileOnly: true,
      maxSnippetLines: DEFAULT_MAX_SNIPPET_LINES,
    }),
  }));
}

function getMissingSeamPriority(request = {}) {
  if (parseScopedMethodReference(request.symbolOrSeam || '')) return 400;
  if (parseLineRange(request.fetchHint || '')) return 320;
  if (isLikelyDirectMemberRequest(request)) return 300;

  const target = sanitizeTextField(request.symbolOrSeam || '', DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .replace(/[,:;\s]+$/g, '')
    .trim();
  if (looksLikeRelativeFilePath(target)) return 240;
  if (/^[A-Z][A-Za-z0-9_]*$/.test(target)) return 220;
  if (extractOwnerToken(target)) return 180;
  return 120;
}

function normalizeMissingSeams(value, options = {}) {
  const maxItems = options.maxItems ? clampPositiveInt(options.maxItems, Infinity) : Infinity;
  const items = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  let sequence = 0;

  for (const item of items) {
    const normalized = normalizeMissingSeamRequest(item, options);
    if (!normalized) continue;
    const expandedRequests = expandMethodScopedMissingSeamRequests(normalized);
    for (const request of expandedRequests) {
      const key = normalizeLookupKey(request.symbolOrSeam);
      if (seen.has(key)) {
        const newPriority = getMissingSeamPriority(request);
        const existingIdx = out.findIndex(e => normalizeLookupKey(e.symbolOrSeam) === key);
        if (existingIdx >= 0 && newPriority > out[existingIdx]._priority) {
          out[existingIdx] = { ...request, _priority: newPriority, _sequence: out[existingIdx]._sequence };
        }
        continue;
      }
      seen.add(key);
      out.push({
        ...request,
        _priority: getMissingSeamPriority(request),
        _sequence: sequence++,
      });
    }
  }

  return out
    .sort((a, b) => {
      if (b._priority !== a._priority) return b._priority - a._priority;
      return a._sequence - b._sequence;
    })
    .slice(0, maxItems)
    .map(({ _priority, _sequence, ...request }) => request);
}

function collectMissingSeamsFromApprovalOutputs(outputs, options = {}) {
  const collected = [];
  for (const output of Array.isArray(outputs) ? outputs : []) {
    const seams = normalizeMissingSeams(output?.approval?.missingSeams, options);
    if (seams.length > 0) collected.push(...seams);
  }
  return normalizeMissingSeams(collected, options);
}

function readBoundedRange(rootDir, relPath, startLine, endLine, options = {}) {
  const file = normalizeRelativePath(relPath);
  if (!file) return null;
  const abs = path.join(rootDir, file);
  if (!fs.existsSync(abs)) return null;

  let lines;
  try {
    lines = fs.readFileSync(abs, 'utf8').split('\n');
  } catch {
    return null;
  }
  const safeStart = Math.max(1, clampPositiveInt(startLine, 1));
  const requestedEnd = Math.max(safeStart, clampPositiveInt(endLine, safeStart));
  const maxSnippetLines = clampPositiveInt(options.maxSnippetLines, DEFAULT_MAX_SNIPPET_LINES);
  const safeEnd = Math.min(lines.length, requestedEnd, safeStart + maxSnippetLines - 1);
  const content = lines.slice(safeStart - 1, safeEnd).join('\n');
  const redactSecrets = typeof options.redactSecrets === 'function' ? options.redactSecrets : null;

  return {
    file,
    startLine: safeStart,
    endLine: safeEnd,
    truncated: safeEnd < requestedEnd,
    content: redactSecrets ? redactSecrets(content) : content,
  };
}

function resolveSymbolRequest(request, index, fileHint = '') {
  const target = normalizeLookupKey(request?.symbolOrSeam || '');
  if (!target || !Array.isArray(index?.symbols)) return { symbol: null, reason: 'missing-symbol-name' };

  let candidates = index.symbols.filter((symbol) => normalizeLookupKey(symbol?.name || '') === target);
  if (fileHint) {
    candidates = candidates.filter((symbol) => normalizeRelativePath(symbol?.file || '') === fileHint);
  }

  if (candidates.length === 1) return { symbol: candidates[0], reason: '' };
  if (candidates.length > 1) return { symbol: null, reason: 'ambiguous-symbol-match' };
  return { symbol: null, reason: 'symbol-not-found' };
}

function isLikelyDirectMemberRequest(request) {
  const scoped = parseScopedMethodReference(request?.symbolOrSeam || '');
  if (scoped) return true;

  const target = sanitizeTextField(request?.symbolOrSeam || '', DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[,:;.\s]+$/g, '')
    .trim();
  if (!target) return false;
  if (looksLikeRelativeFilePath(target)) return false;
  return /^[a-z_$][A-Za-z0-9_$]*$/.test(target);
}

function resolveScopedMethodRequest(request, index, fileHint = '') {
  const scoped = parseScopedMethodReference(request?.symbolOrSeam || '');
  if (!scoped || !Array.isArray(index?.symbols)) {
    return { symbol: null, reason: 'not-scoped-method-request' };
  }

  const methodName = normalizeLookupKey(scoped.member);
  const normalizedOwner = normalizeScopedOwnerName(scoped.owner);
  const ownerPath = looksLikeRelativeFilePath(normalizedOwner) ? normalizeRelativePath(normalizedOwner) : '';
  const effectiveFileHint = looksLikeRelativeFilePath(fileHint || ownerPath)
    ? normalizeRelativePath(fileHint || ownerPath)
    : '';
  const ownerName = ownerPath ? '' : normalizeLookupKey(normalizedOwner);

  if (effectiveFileHint) {
    const fileMatches = index.symbols.filter((symbol) => (
      normalizeRelativePath(symbol?.file || '') === effectiveFileHint
      && normalizeLookupKey(symbol?.name || '') === methodName
    ));
    if (ownerName) {
      const ownedFileMatches = fileMatches.filter((symbol) => normalizeContainerName(symbol?.container || '') === ownerName);
      if (ownedFileMatches.length === 1) return { symbol: ownedFileMatches[0], reason: '' };
      if (ownedFileMatches.length > 1) return { symbol: null, reason: 'ambiguous-method-match-in-file-owner' };
    }
    if (fileMatches.length === 1) return { symbol: fileMatches[0], reason: '' };
    if (fileMatches.length > 1) return { symbol: null, reason: 'ambiguous-method-match-in-file' };
    return { symbol: null, reason: 'method-not-found-in-file' };
  }

  if (ownerName) {
    const containerMatches = index.symbols.filter((symbol) => (
      normalizeLookupKey(symbol?.name || '') === methodName
      && normalizeContainerName(symbol?.container || '') === ownerName
    ));
    if (containerMatches.length === 1) return { symbol: containerMatches[0], reason: '' };
    if (containerMatches.length > 1) return { symbol: null, reason: 'ambiguous-method-in-container' };
  }

  const ownerSymbols = index.symbols.filter((symbol) => {
    const type = String(symbol?.type || '').toLowerCase();
    return ['class', 'interface', 'trait', 'struct', 'module'].includes(type)
      && normalizeLookupKey(symbol?.name || '') === ownerName;
  });
  if (ownerSymbols.length === 0) return { symbol: null, reason: 'owner-type-not-found' };
  if (ownerSymbols.length > 1) return { symbol: null, reason: 'ambiguous-owner-type-match' };

  const ownerSymbol = ownerSymbols[0];
  const ownerFile = normalizeRelativePath(ownerSymbol.file || '');
  const ownerStart = clampPositiveInt(ownerSymbol.startLine, 1);
  const ownerEnd = clampPositiveInt(ownerSymbol.endLine || ownerStart, ownerStart);

  let methodMatches = index.symbols.filter((symbol) => (
    normalizeRelativePath(symbol?.file || '') === ownerFile
    && normalizeLookupKey(symbol?.name || '') === methodName
  ));

  const nestedMatches = methodMatches.filter((symbol) => {
    const startLine = clampPositiveInt(symbol?.startLine, ownerStart);
    const endLine = clampPositiveInt(symbol?.endLine || startLine, startLine);
    return startLine >= ownerStart && endLine <= ownerEnd;
  });
  if (nestedMatches.length > 0) methodMatches = nestedMatches;

  if (methodMatches.length === 1) return { symbol: methodMatches[0], reason: '' };
  if (methodMatches.length > 1) return { symbol: null, reason: 'ambiguous-method-in-owner-type' };
  return { symbol: null, reason: 'method-not-found-in-owner-type' };
}

function escapeRegExp(text = '') {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build token search variants for a member name.
 * If the token is a field name like "orderContainerId", also try "getOrderContainerId", "setOrderContainerId", "isOrderContainerId".
 * If the token already starts with get/set/is prefix, also try the stripped field name.
 * Returns [original, ...variants] — searched in order, first match wins.
 */
function buildTokenVariants(token) {
  if (!token) return [];
  const variants = [token];
  const prefixes = ['get', 'set', 'is'];

  // Check if token already has a prefix → add the stripped version
  for (const prefix of prefixes) {
    if (token.length > prefix.length && token.startsWith(prefix) && /^[A-Z]/.test(token[prefix.length])) {
      const stripped = token[prefix.length].toLowerCase() + token.slice(prefix.length + 1);
      if (!variants.includes(stripped)) variants.push(stripped);
      break;
    }
  }

  // Add prefixed versions for field-like tokens
  if (/^[a-z]/.test(token)) {
    const capitalized = token[0].toUpperCase() + token.slice(1);
    for (const prefix of prefixes) {
      const prefixed = prefix + capitalized;
      if (!variants.includes(prefixed)) variants.push(prefixed);
    }
  }

  return variants;
}

/**
 * Try multiple token variants against the same file, reading it once.
 * Returns the result for the first matching variant, or null.
 */
function readBoundedRangeAroundTokenVariants(rootDir, relPath, tokens, options = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  const file = normalizeRelativePath(relPath);
  if (!file) return null;
  const abs = path.join(rootDir, file);
  if (!fs.existsSync(abs)) return null;

  let lines;
  try {
    lines = fs.readFileSync(abs, 'utf8').split('\n');
  } catch {
    return null;
  }

  for (const token of tokens) {
    const safeToken = sanitizeTextField(token, DEFAULT_MAX_FIELD_LENGTH);
    if (!safeToken) continue;
    const tokenPattern = new RegExp(`\\b${escapeRegExp(safeToken)}\\b`);
    const lineIndex = lines.findIndex((line) => tokenPattern.test(line));
    if (lineIndex < 0) continue;

    const snippetContextLines = clampPositiveInt(options.snippetContextLines, DEFAULT_SNIPPET_CONTEXT_LINES);
    const maxSnippetLines = clampPositiveInt(options.maxSnippetLines, DEFAULT_MAX_SNIPPET_LINES);
    const startLine = Math.max(1, lineIndex + 1 - snippetContextLines);
    const requestedEnd = Math.min(lines.length, lineIndex + 1 + snippetContextLines);
    const endLine = Math.min(lines.length, requestedEnd, startLine + maxSnippetLines - 1);
    const content = lines.slice(startLine - 1, endLine).join('\n');
    const redactSecrets = typeof options.redactSecrets === 'function' ? options.redactSecrets : null;

    return {
      file,
      startLine,
      endLine,
      truncated: endLine < requestedEnd,
      content: redactSecrets ? redactSecrets(content) : content,
      matchedToken: safeToken,
    };
  }
  return null;
}

function readBoundedRangeAroundToken(rootDir, relPath, token, options = {}) {
  const file = normalizeRelativePath(relPath);
  const safeToken = sanitizeTextField(token, DEFAULT_MAX_FIELD_LENGTH);
  if (!file || !safeToken) return null;
  const abs = path.join(rootDir, file);
  if (!fs.existsSync(abs)) return null;

  let lines;
  try {
    lines = fs.readFileSync(abs, 'utf8').split('\n');
  } catch {
    return null;
  }
  const tokenPattern = new RegExp(`\\b${escapeRegExp(safeToken)}\\b`);
  const lineIndex = lines.findIndex((line) => tokenPattern.test(line));
  if (lineIndex < 0) return null;

  const snippetContextLines = clampPositiveInt(options.snippetContextLines, DEFAULT_SNIPPET_CONTEXT_LINES);
  const maxSnippetLines = clampPositiveInt(options.maxSnippetLines, DEFAULT_MAX_SNIPPET_LINES);
  const startLine = Math.max(1, lineIndex + 1 - snippetContextLines);
  const requestedEnd = Math.min(lines.length, lineIndex + 1 + snippetContextLines);
  const endLine = Math.min(lines.length, requestedEnd, startLine + maxSnippetLines - 1);
  const content = lines.slice(startLine - 1, endLine).join('\n');
  const redactSecrets = typeof options.redactSecrets === 'function' ? options.redactSecrets : null;

  return {
    file,
    startLine,
    endLine,
    truncated: endLine < requestedEnd,
    content: redactSecrets ? redactSecrets(content) : content,
  };
}

function resolveScopedOwnerFile(request, index, fileHint = '') {
  const scoped = parseScopedMethodReference(request?.symbolOrSeam || '');
  if (!scoped || !Array.isArray(index?.symbols)) return '';

  const normalizedOwner = normalizeScopedOwnerName(scoped.owner);
  if (looksLikeRelativeFilePath(fileHint)) return normalizeRelativePath(fileHint);
  if (looksLikeRelativeFilePath(normalizedOwner)) return normalizeRelativePath(normalizedOwner);

  const ownerName = normalizeLookupKey(normalizedOwner);
  const containerMatches = index.symbols.filter((symbol) => normalizeContainerName(symbol?.container || '') === ownerName);
  const uniqueContainerFiles = [...new Set(containerMatches.map((symbol) => normalizeRelativePath(symbol?.file || '')).filter(Boolean))];
  if (uniqueContainerFiles.length === 1) return uniqueContainerFiles[0];

  const ownerSymbols = index.symbols.filter((symbol) => {
    const type = String(symbol?.type || '').toLowerCase();
    return ['class', 'interface', 'trait', 'struct', 'module'].includes(type)
      && normalizeLookupKey(symbol?.name || '') === ownerName;
  });
  if (ownerSymbols.length !== 1) return '';
  return normalizeRelativePath(ownerSymbols[0].file || '');
}

function resolvePrimarySymbolInFile(request, index, fileHint = '') {
  const file = normalizeRelativePath(fileHint);
  if (!file || !Array.isArray(index?.symbols)) return { symbol: null, reason: 'file-hint-missing' };

  const fileSymbols = index.symbols.filter((symbol) => normalizeRelativePath(symbol?.file || '') === file);
  if (fileSymbols.length === 0) return { symbol: null, reason: 'hinted-file-not-indexed' };

  const requestedName = normalizeLookupKey(request?.symbolOrSeam || '');
  const basename = normalizeLookupKey(path.basename(file, path.extname(file)));
  const preferred = fileSymbols.filter((symbol) => {
    const type = String(symbol?.type || '').toLowerCase();
    if (!['class', 'interface', 'trait', 'struct', 'module'].includes(type)) return false;
    const symbolName = normalizeLookupKey(symbol?.name || '');
    return symbolName === requestedName || symbolName === basename;
  });

  if (preferred.length === 1) return { symbol: preferred[0], reason: '' };
  if (preferred.length > 1) return { symbol: null, reason: 'ambiguous-file-primary-symbol' };

  const containerSymbols = fileSymbols.filter((symbol) => {
    const type = String(symbol?.type || '').toLowerCase();
    return ['class', 'interface', 'trait', 'struct', 'module'].includes(type);
  });
  if (containerSymbols.length === 1) return { symbol: containerSymbols[0], reason: '' };
  return { symbol: null, reason: 'file-primary-symbol-not-found' };
}

function resolveSingleMissingSeam(request, options = {}) {
  const index = options.index;
  const rootDir = options.rootDir;
  if (!rootDir || !index || !Array.isArray(index.symbols)) {
    return { fetched: null, skipped: { request, reason: 'missing-root-or-index' } };
  }

  const lineHint = parseLineRange(request?.fetchHint || '');
  const fileHint = lineHint?.file || (
    looksLikeRelativeFilePath(request?.fetchHint || '')
      ? normalizeRelativePath(request?.fetchHint || '')
      : ''
  );
  const fileHintReason = lineHint ? 'hint-range-not-found' : 'file-hint-not-found';

  const scopedMethodResolution = resolveScopedMethodRequest(request, index, fileHint);
  if (scopedMethodResolution.reason !== 'not-scoped-method-request') {
    if (scopedMethodResolution.symbol) {
      const snippetContextLines = clampPositiveInt(options.snippetContextLines, DEFAULT_SNIPPET_CONTEXT_LINES);
      const ranged = readBoundedRange(
        rootDir,
        scopedMethodResolution.symbol.file,
        Math.max(1, Number(scopedMethodResolution.symbol.startLine || 1) - snippetContextLines),
        Math.max(
          Number(scopedMethodResolution.symbol.endLine || scopedMethodResolution.symbol.startLine || 1) + snippetContextLines,
          Number(scopedMethodResolution.symbol.startLine || 1),
        ),
        options,
      );
      if (!ranged) {
        return { fetched: null, skipped: { request, reason: 'resolved-scoped-method-content-missing' } };
      }
      return {
        fetched: {
          ...request,
          file: ranged.file,
          startLine: ranged.startLine,
          endLine: ranged.endLine,
          source: 'scoped-method',
          truncated: ranged.truncated,
          content: ranged.content,
          resolvedSymbol: scopedMethodResolution.symbol.name || '',
          resolvedType: scopedMethodResolution.symbol.type || '',
        },
        skipped: null,
      };
    }

    const scoped = parseScopedMethodReference(request?.symbolOrSeam || '');
    const ownerFile = scoped ? resolveScopedOwnerFile(request, index, fileHint) : '';
    const memberToken = ownerFile && scoped ? normalizeScopedOwnerName(scoped.member) : '';
    // Try the member token as-is, then common getter/setter variants (get/set/is prefix).
    // Uses single-read variant to avoid re-reading the file for each token.
    const tokenVariants = memberToken ? buildTokenVariants(memberToken) : [];
    const tokenRange = tokenVariants.length > 0
      ? readBoundedRangeAroundTokenVariants(rootDir, ownerFile, tokenVariants, options)
      : null;
    if (tokenRange) {
      return {
        fetched: {
          ...request,
          file: tokenRange.file,
          startLine: tokenRange.startLine,
          endLine: tokenRange.endLine,
          source: 'scoped-token',
          truncated: tokenRange.truncated,
          content: tokenRange.content,
          resolvedSymbol: scoped.member,
          resolvedType: 'token',
        },
        skipped: null,
      };
    }

    // Fallback: method not in index and token search failed, but owner class IS in index.
    // Read the owner class body — captures DTOs, small classes with getters/fields not individually indexed.
    if (ownerFile && scoped) {
      const ownerResolution = resolvePrimarySymbolInFile(
        { symbolOrSeam: scoped.owner },
        index,
        ownerFile,
      );
      if (ownerResolution.symbol) {
        const snippetContextLines = clampPositiveInt(options.snippetContextLines, DEFAULT_SNIPPET_CONTEXT_LINES);
        const ownerBodyRange = readBoundedRange(
          rootDir,
          ownerResolution.symbol.file,
          Math.max(1, Number(ownerResolution.symbol.startLine || 1) - snippetContextLines),
          Math.max(
            Number(ownerResolution.symbol.endLine || ownerResolution.symbol.startLine || 1) + snippetContextLines,
            Number(ownerResolution.symbol.startLine || 1),
          ),
          options,
        );
        if (ownerBodyRange) {
          return {
            fetched: {
              ...request,
              file: ownerBodyRange.file,
              startLine: ownerBodyRange.startLine,
              endLine: ownerBodyRange.endLine,
              source: 'owner-body-fallback',
              truncated: ownerBodyRange.truncated,
              content: ownerBodyRange.content,
              resolvedSymbol: scoped.owner,
              resolvedType: 'owner-class',
            },
            skipped: null,
          };
        }
      }
    }

    if (lineHint) {
      const ranged = readBoundedRange(rootDir, lineHint.file, lineHint.startLine, lineHint.endLine, options);
      if (ranged) {
        return {
          fetched: {
            ...request,
            file: ranged.file,
            startLine: ranged.startLine,
            endLine: ranged.endLine,
            source: 'hint-range-fallback',
            truncated: ranged.truncated,
            content: ranged.content,
          },
          skipped: null,
        };
      }
      return { fetched: null, skipped: { request, reason: fileHintReason } };
    }

    return {
      fetched: null,
      skipped: { request, reason: scopedMethodResolution.reason || 'scoped-method-not-found' },
    };
  }

  if (lineHint) {
    const ranged = readBoundedRange(rootDir, lineHint.file, lineHint.startLine, lineHint.endLine, options);
    if (ranged) {
      return {
        fetched: {
          ...request,
          file: ranged.file,
          startLine: ranged.startLine,
          endLine: ranged.endLine,
          source: 'hint-range',
          truncated: ranged.truncated,
          content: ranged.content,
        },
        skipped: null,
      };
    }
    return { fetched: null, skipped: { request, reason: fileHintReason } };
  }

  // Guard: reject bare PascalCase class-name requests — they resolve to class bodies, not method bodies.
  // Method-shaped requests and direct member requests are handled above.
  const bareTarget = sanitizeTextField(request?.symbolOrSeam || '', DEFAULT_MAX_FIELD_LENGTH)
    .replace(/^`+|`+$/g, '').replace(/[,:;\s]+$/g, '').trim();
  if (/^[A-Z][A-Za-z0-9_]*$/.test(bareTarget) && !isLikelyDirectMemberRequest(request)) {
    return {
      fetched: null,
      skipped: { request, reason: 'bare-class-request-rejected' },
    };
  }

  const normalizedFileHint = looksLikeRelativeFilePath(request?.fetchHint || '')
    ? normalizeRelativePath(request?.fetchHint || '')
    : '';

  const symbolResolution = resolveSymbolRequest(request, index, normalizedFileHint);
  let symbol = symbolResolution.symbol;
  let source = 'symbol';

  if (!symbol && normalizedFileHint && !isLikelyDirectMemberRequest(request)) {
    const hinted = resolvePrimarySymbolInFile(request, index, normalizedFileHint);
    symbol = hinted.symbol;
    source = 'hint-file-primary-symbol';
    if (!symbol && symbolResolution.reason && hinted.reason) {
      return {
        fetched: null,
        skipped: { request, reason: `${symbolResolution.reason}; ${hinted.reason}` },
      };
    }
  }

  if (!symbol) {
    return {
      fetched: null,
      skipped: { request, reason: symbolResolution.reason || 'symbol-not-found' },
    };
  }

  const snippetContextLines = clampPositiveInt(options.snippetContextLines, DEFAULT_SNIPPET_CONTEXT_LINES);
  const ranged = readBoundedRange(
    rootDir,
    symbol.file,
    Math.max(1, Number(symbol.startLine || 1) - snippetContextLines),
    Math.max(Number(symbol.endLine || symbol.startLine || 1) + snippetContextLines, Number(symbol.startLine || 1)),
    options,
  );
  if (!ranged) {
    return { fetched: null, skipped: { request, reason: 'resolved-symbol-content-missing' } };
  }

  return {
    fetched: {
      ...request,
      file: ranged.file,
      startLine: ranged.startLine,
      endLine: ranged.endLine,
      source,
      truncated: ranged.truncated,
      content: ranged.content,
      resolvedSymbol: symbol.name || '',
      resolvedType: symbol.type || '',
    },
    skipped: null,
  };
}

function resolveMissingSeams(requests, options = {}) {
  const normalizedRequests = normalizeMissingSeams(requests, options);
  const fetchedSeams = [];
  const skippedSeams = [];

  for (const request of normalizedRequests) {
    const resolved = resolveSingleMissingSeam(request, options);
    if (resolved.fetched) fetchedSeams.push(resolved.fetched);
    else if (resolved.skipped) skippedSeams.push(resolved.skipped);
  }

  const expansionBytes = fetchedSeams.reduce((sum, item) => sum + Buffer.byteLength(String(item.content || ''), 'utf8'), 0);
  return {
    requestedSeams: normalizedRequests,
    fetchedSeams,
    skippedSeams,
    expansionBytes,
  };
}

function buildCritiqueExpansionAppendix(result, options = {}) {
  const fetched = Array.isArray(result?.fetchedSeams) ? result.fetchedSeams : [];
  if (fetched.length === 0) return '';

  const maxAppendixBytes = clampPositiveInt(options.maxAppendixBytes, DEFAULT_MAX_APPENDIX_BYTES);
  const lines = [
    '## SEAM EXPANSION — EXPANDED EVIDENCE',
    'Approval reported unresolved missing seams while `substantive-assumptions` still remained after the first pass.',
    '',
    '### Requested Seams',
  ];

  for (const request of result.requestedSeams || []) {
    const notes = [];
    if (request.reasonNeeded) notes.push(`reason=${request.reasonNeeded}`);
    if (request.expectedImpact) notes.push(`impact=${request.expectedImpact}`);
    if (request.fetchHint) notes.push(`hint=${request.fetchHint}`);
    lines.push(`- ${request.symbolOrSeam}${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`);
  }

  lines.push('', '### Fetched Evidence');

  let bytes = Buffer.byteLength(lines.join('\n'), 'utf8');
  const omittedFetched = [];
  for (const item of fetched) {
    const block = [
      `#### ${item.symbolOrSeam} -> ${item.file}:${item.startLine}-${item.endLine}`,
      `Source: ${item.source}`,
      item.reasonNeeded ? `Why needed: ${item.reasonNeeded}` : '',
      item.expectedImpact ? `Expected impact: ${item.expectedImpact}` : '',
      '```' + (path.extname(item.file).slice(1) || 'text'),
      item.content || '',
      '```',
      '',
    ].filter(Boolean).join('\n');
    const nextBytes = bytes + Buffer.byteLength(block, 'utf8');
    if (nextBytes > maxAppendixBytes) {
      omittedFetched.push(item);
      continue;
    }
    lines.push(block);
    bytes = nextBytes;
  }

  if (omittedFetched.length > 0) {
    lines.push(
      `> Appendix byte cap reached (${maxAppendixBytes} bytes). `
      + `Included ${fetched.length - omittedFetched.length}/${fetched.length} fetched seams; `
      + `omitted evidence remains fetched in telemetry but was not injected into this prompt appendix.`,
    );
    for (const item of omittedFetched) {
      lines.push(`- Omitted fetched seam: ${item.symbolOrSeam} -> ${item.file}:${item.startLine}-${item.endLine}`);
    }
  }

  if (Array.isArray(result?.skippedSeams) && result.skippedSeams.length > 0) {
    lines.push('### Skipped Requests');
    for (const skipped of result.skippedSeams) {
      lines.push(`- ${skipped.request?.symbolOrSeam || 'unknown'}: ${skipped.reason}`);
    }
  }

  return lines.join('\n');
}

function hasSubstantiveAssumptionGap(trust = {}) {
  const categories = Array.isArray(trust?.groundingGapCategories)
    ? trust.groundingGapCategories.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  if (categories.includes('substantive-assumptions')) return true;

  if (trust?.groundingValidation?.hasSubstantiveAssumptions === true) {
    return true;
  }

  const validationWarnings = Array.isArray(trust?.groundingValidation?.validationWarnings)
    ? trust.groundingValidation.validationWarnings.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return validationWarnings.some((warning) => /substantive items|assumptions\s*\/\s*unverified seams/i.test(warning));
}

function shouldTriggerCritiqueExpansion(options = {}) {
  if (options.alreadyTriggered) {
    return { trigger: false, reason: 'already-triggered', missingSeams: [] };
  }

  if (!hasSubstantiveAssumptionGap(options.trust || {})) {
    return { trigger: false, reason: 'no-substantive-assumptions', missingSeams: [] };
  }

  const missingSeams = collectMissingSeamsFromApprovalOutputs(options.approvalOutputs, options);
  if (missingSeams.length === 0) {
    return { trigger: false, reason: 'no-missing-seams-requested', missingSeams: [] };
  }

  return { trigger: true, reason: 'approval-requested-missing-seams', missingSeams };
}

module.exports = {
  buildCritiqueExpansionAppendix,
  collectMissingSeamsFromApprovalOutputs,
  normalizeMissingSeams,
  parseLineRange,
  resolveMissingSeams,
  shouldTriggerCritiqueExpansion,
};
