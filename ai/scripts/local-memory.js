'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  DEFAULT_MEMORY_DECISION_HEADING_PATTERN,
  DEFAULT_STOP_WORDS,
  DEFAULT_WORD_SPLIT_PATTERN,
} = require('./domain/language-packs/registry');

const ENTRY_TYPES = new Set(['fact', 'decision', 'episode', 'openQuestion']);
const MARKDOWN_ENTRY_TYPES = new Set(['decision', 'episode']);
const DEFAULT_LIMIT = 8;
const DEFAULT_MAX_BYTES = 6000;
const DEFAULT_FACT_LIMIT = 3;
const AUTO_DECISION_LIMIT = 2;

let CachedDatabaseSync = null;

function suppressExperimentalSqliteWarning() {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function patchedEmitWarning(warning, ...args) {
    const message = typeof warning === 'string' ? warning : warning?.message || '';
    if (message.includes('SQLite is an experimental feature')) {
      return;
    }
    return originalEmitWarning.call(process, warning, ...args);
  };
  return () => {
    process.emitWarning = originalEmitWarning;
  };
}

function getDatabaseSync() {
  if (CachedDatabaseSync) return CachedDatabaseSync;
  const restoreWarning = suppressExperimentalSqliteWarning();
  try {
    ({ DatabaseSync: CachedDatabaseSync } = require('node:sqlite'));
  } finally {
    restoreWarning();
  }
  if (!CachedDatabaseSync) {
    throw new Error('node:sqlite DatabaseSync is unavailable in this Node runtime');
  }
  return CachedDatabaseSync;
}

function isSqliteAvailable() {
  try {
    return Boolean(getDatabaseSync());
  } catch {
    return false;
  }
}

function normalizeEntryType(type) {
  const normalized = String(type || '').trim();
  if (!ENTRY_TYPES.has(normalized)) {
    throw new Error(`Unsupported memory entry type: ${normalized || '(empty)'}`);
  }
  return normalized;
}

function normalizeTags(tags) {
  const raw = Array.isArray(tags)
    ? tags
    : String(tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const tag of raw) {
    const normalized = String(tag || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeEntry(entry = {}) {
  const entryType = normalizeEntryType(entry.type);
  const title = String(entry.title || '').trim();
  const content = String(entry.content || '').trim();
  const summary = String(entry.summary || '').trim();
  if (!title) {
    throw new Error('Memory entry title is required.');
  }
  if (!content) {
    throw new Error('Memory entry content is required.');
  }
  const createdAt = String(entry.createdAt || '').trim() || new Date().toISOString();
  const updatedAt = String(entry.updatedAt || '').trim() || createdAt;
  const confidenceValue = Number(entry.confidence);

  return {
    id: String(entry.id || crypto.randomUUID()),
    type: entryType,
    title,
    summary: summary || summarizeText(content, 240),
    content,
    tags: normalizeTags(entry.tags),
    sourceRef: String(entry.sourceRef || '').trim(),
    sidecarPath: String(entry.sidecarPath || '').trim(),
    runId: String(entry.runId || '').trim(),
    autoSaved: entry.autoSaved === true,
    createdAt,
    updatedAt,
    confidence: Number.isFinite(confidenceValue) ? confidenceValue : null,
  };
}

function ensureMemoryLayout(layout) {
  fs.mkdirSync(layout.memoryDir, { recursive: true });
  fs.mkdirSync(layout.memoryDecisionsDir, { recursive: true });
  fs.mkdirSync(layout.memoryEpisodesDir, { recursive: true });
}

function openMemoryDb(layout) {
  ensureMemoryLayout(layout);
  const DatabaseSync = getDatabaseSync();
  const db = new DatabaseSync(layout.memoryDbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      source_ref TEXT NOT NULL DEFAULT '',
      sidecar_path TEXT NOT NULL DEFAULT '',
      run_id TEXT NOT NULL DEFAULT '',
      auto_saved INTEGER NOT NULL DEFAULT 0,
      confidence REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memory_entries_type_updated
      ON memory_entries(type, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_memory_entries_run
      ON memory_entries(run_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_entries_fts
      USING fts5(
        entry_id UNINDEXED,
        title,
        summary,
        content,
        tags,
        tokenize = 'unicode61 remove_diacritics 2'
      );
  `);
  return db;
}

function withMemoryDb(layout, fn) {
  const db = openMemoryDb(layout);
  try {
    return fn(db);
  } finally {
    if (typeof db.close === 'function') db.close();
  }
}

function slugify(value, fallback = 'entry') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function toTimestampSlug(isoString) {
  return String(isoString || '')
    .replace(/[:.]/g, '-')
    .replace(/[^0-9TZ-]/g, '')
    .slice(0, 24) || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 24);
}

function makeRelativeProjectPath(layout, targetPath) {
  const absolute = path.resolve(String(targetPath || ''));
  return path.relative(layout.projectRoot, absolute).replace(/\\/g, '/');
}

function buildSidecarMarkdown(entry) {
  const lines = [
    `# ${entry.type.toUpperCase()}: ${entry.title}`,
    '',
    `- Type: ${entry.type}`,
    `- Created: ${entry.createdAt}`,
  ];
  if (entry.runId) lines.push(`- Run: ${entry.runId}`);
  if (entry.sourceRef) lines.push(`- Source: ${entry.sourceRef}`);
  if (entry.tags.length > 0) lines.push(`- Tags: ${entry.tags.join(', ')}`);
  if (entry.confidence !== null) lines.push(`- Confidence: ${entry.confidence}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(entry.summary);
  lines.push('');
  lines.push('## Content');
  lines.push(entry.content);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeMemorySidecar(layout, entry) {
  if (!MARKDOWN_ENTRY_TYPES.has(entry.type)) return '';
  const baseDir = entry.type === 'decision' ? layout.memoryDecisionsDir : layout.memoryEpisodesDir;
  fs.mkdirSync(baseDir, { recursive: true });
  const fileName = `${toTimestampSlug(entry.createdAt)}-${slugify(entry.title, entry.type)}.md`;
  const absolutePath = path.join(baseDir, fileName);
  fs.writeFileSync(absolutePath, buildSidecarMarkdown(entry));
  return makeRelativeProjectPath(layout, absolutePath);
}

function syncMemoryEntryFts(db, entry) {
  const deleteStmt = db.prepare('DELETE FROM memory_entries_fts WHERE entry_id = ?');
  deleteStmt.run(entry.id);
  const insertStmt = db.prepare(`
    INSERT INTO memory_entries_fts (entry_id, title, summary, content, tags)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertStmt.run(
    entry.id,
    entry.title,
    entry.summary,
    entry.content,
    entry.tags.join(' '),
  );
}

function saveMemoryEntry(layout, rawEntry) {
  const prepared = normalizeEntry(rawEntry);
  return withMemoryDb(layout, (db) => {
    let entry = prepared;
    if (!entry.sidecarPath) {
      entry = {
        ...entry,
        sidecarPath: writeMemorySidecar(layout, entry),
      };
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO memory_entries (
        id, type, title, summary, content, tags, source_ref, sidecar_path,
        run_id, auto_saved, confidence, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.id,
      entry.type,
      entry.title,
      entry.summary,
      entry.content,
      entry.tags.join(','),
      entry.sourceRef,
      entry.sidecarPath,
      entry.runId,
      entry.autoSaved ? 1 : 0,
      entry.confidence,
      entry.createdAt,
      entry.updatedAt,
    );
    syncMemoryEntryFts(db, entry);
    return entry;
  });
}

function deleteAutoSavedEntriesForRun(layout, runId, types = []) {
  const safeRunId = String(runId || '').trim();
  if (!safeRunId) return 0;
  const normalizedTypes = Array.isArray(types) ? types.filter((type) => ENTRY_TYPES.has(type)) : [];
  if (normalizedTypes.length === 0) return 0;
  return withMemoryDb(layout, (db) => {
    const selectStmt = db.prepare(`
      SELECT id, sidecar_path FROM memory_entries
      WHERE run_id = ? AND auto_saved = 1 AND type IN (${normalizedTypes.map(() => '?').join(', ')})
    `);
    const rows = selectStmt.all(safeRunId, ...normalizedTypes);
    const deleteFts = db.prepare('DELETE FROM memory_entries_fts WHERE entry_id = ?');
    const deleteEntry = db.prepare('DELETE FROM memory_entries WHERE id = ?');
    for (const row of rows) {
      deleteFts.run(row.id);
      deleteEntry.run(row.id);
      if (row.sidecar_path) {
        const sidecarAbs = path.resolve(layout.projectRoot, row.sidecar_path);
        if (fs.existsSync(sidecarAbs)) fs.rmSync(sidecarAbs, { force: true });
      }
    }
    return rows.length;
  });
}

function splitQueryTokens(text, maxTokens = 8) {
  const tokens = String(text || '')
    .toLowerCase()
    .split(DEFAULT_WORD_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !DEFAULT_STOP_WORDS.has(token));

  const unique = [];
  const seen = new Set();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
    if (unique.length >= maxTokens) break;
  }
  return unique;
}

function buildFtsQuery(text) {
  const tokens = Array.isArray(text) ? text : splitQueryTokens(text);
  if (!tokens.length) return '';
  return tokens.map((token) => `"${token.replace(/"/g, '')}"`).join(' OR ');
}

function rowToEntry(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    content: row.content,
    tags: normalizeTags(String(row.tags || '').split(',')),
    sourceRef: row.source_ref || '',
    sidecarPath: row.sidecar_path || '',
    runId: row.run_id || '',
    autoSaved: Number(row.auto_saved) === 1,
    confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    score: Number.isFinite(Number(row.rank)) ? Number(row.rank) : null,
  };
}

function searchMemoryEntries(layout, options = {}) {
  const limit = Math.max(1, Number(options.limit) || DEFAULT_LIMIT);
  const factLimit = Math.max(0, Number(options.factLimit) || DEFAULT_FACT_LIMIT);
  const filterTypes = Array.isArray(options.types)
    ? options.types.filter((type) => ENTRY_TYPES.has(type))
    : (String(options.type || '').trim() ? [normalizeEntryType(options.type)] : []);

  if (!fs.existsSync(layout.memoryDbPath) || !isSqliteAvailable()) {
    return [];
  }

  return withMemoryDb(layout, (db) => {
    const results = [];
    const seen = new Set();
    const allowFacts = filterTypes.length === 0 || filterTypes.includes('fact');

    if (allowFacts && factLimit > 0) {
      const factRows = db.prepare(`
        SELECT * FROM memory_entries
        WHERE type = 'fact'
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(factLimit);
      for (const row of factRows) {
        const entry = rowToEntry(row);
        seen.add(entry.id);
        results.push(entry);
      }
    }

    const ftsQuery = buildFtsQuery(options.query || '');
    let searchRows = [];
    if (ftsQuery) {
      const typeClause = filterTypes.length ? `AND e.type IN (${filterTypes.map(() => '?').join(', ')})` : '';
      const stmt = db.prepare(`
        SELECT e.*, bm25(memory_entries_fts, 8.0, 4.0, 1.5, 1.0) AS rank
        FROM memory_entries_fts
        JOIN memory_entries e ON e.id = memory_entries_fts.entry_id
        WHERE memory_entries_fts MATCH ?
        ${typeClause}
        ORDER BY rank, e.updated_at DESC
        LIMIT ?
      `);
      searchRows = stmt.all(ftsQuery, ...(filterTypes.length ? filterTypes : []), limit * 3);
    } else {
      const typeClause = filterTypes.length ? `WHERE type IN (${filterTypes.map(() => '?').join(', ')})` : `WHERE type != 'fact'`;
      const stmt = db.prepare(`
        SELECT * FROM memory_entries
        ${typeClause}
        ORDER BY updated_at DESC
        LIMIT ?
      `);
      searchRows = stmt.all(...(filterTypes.length ? filterTypes : []), limit * 2);
    }

    for (const row of searchRows) {
      const entry = rowToEntry(row);
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      results.push(entry);
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  });
}

function formatEntryForRecall(entry) {
  const lines = [`### ${entry.type.toUpperCase()}: ${entry.title}`];
  lines.push(`- Summary: ${entry.summary}`);
  if (entry.tags.length > 0) lines.push(`- Tags: ${entry.tags.join(', ')}`);
  if (entry.sourceRef) lines.push(`- Source: ${entry.sourceRef}`);
  if (entry.sidecarPath) lines.push(`- Artifact: ${entry.sidecarPath}`);
  const details = summarizeText(entry.content, 500);
  if (details && details !== entry.summary) {
    lines.push(`- Detail: ${details}`);
  }
  return `${lines.join('\n')}\n`;
}

function buildMemoryRecallSection(layout, promptText, memoryWindow = {}) {
  if (!isSqliteAvailable() || !fs.existsSync(layout.memoryDbPath)) return '';

  const maxEntries = Math.max(1, Number(memoryWindow.maxEntries) || DEFAULT_LIMIT);
  const maxBytes = Math.max(512, Number(memoryWindow.maxBytes) || DEFAULT_MAX_BYTES);
  const entries = searchMemoryEntries(layout, {
    query: promptText,
    limit: maxEntries,
    factLimit: Math.min(DEFAULT_FACT_LIMIT, maxEntries),
  });
  if (!entries.length) return '';

  const ftsQuery = buildFtsQuery(promptText);
  const blocks = ['## PROJECT MEMORY (RECALL)'];
  if (ftsQuery) {
    blocks.push(`Query: ${ftsQuery}`);
    blocks.push('');
  }

  let usedBytes = Buffer.byteLength(blocks.join('\n'), 'utf8');
  let included = 0;
  for (const entry of entries) {
    const block = formatEntryForRecall(entry).trimEnd();
    const nextBytes = usedBytes + Buffer.byteLength(`\n\n${block}`, 'utf8');
    if (included > 0 && nextBytes > maxBytes) break;
    blocks.push(block);
    blocks.push('');
    usedBytes = nextBytes;
    included += 1;
    if (included >= maxEntries) break;
  }

  return included > 0 ? `${blocks.join('\n').trim()}\n` : '';
}

function summarizeText(text, maxLen = 320) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function sanitizeResultText(text) {
  return String(text || '')
    .replace(/^DISCUSSION:\s.*$/gim, '')
    .replace(/^NOTE:\s.*$/gim, '')
    .replace(/^WARNING:\s.*$/gim, '')
    .replace(/^=== END OF DOCUMENT ===\s*$/gim, '')
    .trim();
}

function buildEpisodeEntry({ promptText, resultText, runId, taskId, sourceRef, createdAt }) {
  const cleanResult = sanitizeResultText(resultText);
  const tags = splitQueryTokens(promptText, 10);
  const preview = summarizeText(promptText, 80) || runId || 'run';
  return {
    type: 'episode',
    title: `${taskId || runId || 'run'}: ${preview}`,
    summary: summarizeText(cleanResult || promptText, 220),
    content: [
      `Prompt: ${summarizeText(promptText, 400)}`,
      '',
      `Result: ${summarizeText(cleanResult, 2200)}`,
    ].join('\n'),
    tags,
    sourceRef,
    runId,
    autoSaved: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function extractDecisionBullets(resultText) {
  const clean = sanitizeResultText(resultText);
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bulletPattern = /^([-*]|\d+\.)\s+(.+)$/;

  const bullets = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!DEFAULT_MEMORY_DECISION_HEADING_PATTERN.test(lines[index])) continue;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const match = lines[cursor].match(bulletPattern);
      if (!match) {
        if (DEFAULT_MEMORY_DECISION_HEADING_PATTERN.test(lines[cursor])) break;
        if (bullets.length > 0) break;
        continue;
      }
      const candidate = summarizeText(match[2], 240);
      if (candidate) bullets.push(candidate);
      if (bullets.length >= AUTO_DECISION_LIMIT) return bullets;
    }
  }
  return bullets.slice(0, AUTO_DECISION_LIMIT);
}

function buildAutoMemoryEntries({ promptText, resultText, runId, taskId, sourceRef, createdAt = new Date().toISOString() }) {
  const entries = [
    buildEpisodeEntry({
      promptText,
      resultText,
      runId,
      taskId,
      sourceRef,
      createdAt,
    }),
  ];

  const decisions = extractDecisionBullets(resultText);
  for (let index = 0; index < decisions.length; index += 1) {
    const candidate = decisions[index];
    entries.push({
      type: 'decision',
      title: `${taskId || runId || 'run'} decision ${index + 1}`,
      summary: candidate,
      content: candidate,
      tags: splitQueryTokens(`${promptText} ${candidate}`, 10),
      sourceRef,
      runId,
      autoSaved: true,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return entries;
}

function saveAutoMemoryEntries(layout, options = {}) {
  const entries = buildAutoMemoryEntries(options);
  deleteAutoSavedEntriesForRun(layout, options.runId, ['episode', 'decision']);
  return entries.map((entry) => saveMemoryEntry(layout, entry));
}

function computeMemoryStoreDigest(layout) {
  const hash = crypto.createHash('md5');
  const targets = [
    layout.memoryDbPath,
    layout.memoryDecisionsDir,
    layout.memoryEpisodesDir,
  ];

  for (const target of targets) {
    if (!target || !fs.existsSync(target)) {
      hash.update(`${target}:missing`);
      continue;
    }
    const stat = fs.statSync(target);
    hash.update(`${target}:${stat.mtimeMs}:${stat.size}`);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(target).sort();
      for (const entry of entries) {
        const fullPath = path.join(target, entry);
        const fullStat = fs.statSync(fullPath);
        hash.update(`${fullPath}:${fullStat.mtimeMs}:${fullStat.size}`);
      }
    }
  }

  return hash.digest('hex');
}

module.exports = {
  ENTRY_TYPES,
  DEFAULT_LIMIT,
  DEFAULT_MAX_BYTES,
  isSqliteAvailable,
  normalizeEntryType,
  normalizeTags,
  normalizeEntry,
  buildFtsQuery,
  splitQueryTokens,
  saveMemoryEntry,
  searchMemoryEntries,
  buildMemoryRecallSection,
  buildAutoMemoryEntries,
  saveAutoMemoryEntries,
  computeMemoryStoreDigest,
  summarizeText,
};
