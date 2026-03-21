const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { resolveProjectLayout } = require('../path-utils');
const {
  isSqliteAvailable,
  saveMemoryEntry,
  searchMemoryEntries,
  buildMemoryRecallSection,
  buildAutoMemoryEntries,
  saveAutoMemoryEntries,
  computeMemoryStoreDigest,
} = require('../local-memory');

const TMP_BASE = path.join(__dirname, '..', '..', '..', '.tmp-test-work');

function mkTmpDir(prefix) {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(TMP_BASE, prefix));
}

const sqliteTest = isSqliteAvailable() ? test : test.skip;

sqliteTest('local-memory saves searchable manual entries and writes decision sidecar', () => {
  const projectRoot = mkTmpDir('local-memory-save-');
  const layout = resolveProjectLayout(projectRoot);

  const entry = saveMemoryEntry(layout, {
    type: 'decision',
    title: 'Split-root layout',
    summary: 'Keep ai/ authored and .ai/ runtime.',
    content: 'Chose split-root layout to separate authored config from runtime state.',
    tags: ['layout', 'paths'],
    sourceRef: '.ai/prompts/discussions/DOC-42/run-123',
  });

  assert.equal(fs.existsSync(layout.memoryDbPath), true);
  assert.ok(entry.sidecarPath.endsWith('.md'));
  assert.equal(fs.existsSync(path.join(projectRoot, entry.sidecarPath)), true);

  const results = searchMemoryEntries(layout, { query: 'split root authored runtime', limit: 5 });
  assert.equal(results.some((item) => item.id === entry.id), true);
});

sqliteTest('buildMemoryRecallSection includes fact context and matched episode entries', () => {
  const projectRoot = mkTmpDir('local-memory-recall-');
  const layout = resolveProjectLayout(projectRoot);

  saveMemoryEntry(layout, {
    type: 'fact',
    title: 'Framework',
    content: 'Project uses Next.js 15 with App Router.',
    tags: ['nextjs', 'app-router'],
  });
  saveMemoryEntry(layout, {
    type: 'episode',
    title: 'JWT race condition',
    content: 'Run fixed a JWT refresh race in auth middleware.',
    tags: ['jwt', 'auth', 'race-condition'],
    sourceRef: '.ai/prompts/discussions/DOC-77/run-1',
  });

  const section = buildMemoryRecallSection(layout, 'Investigate JWT auth middleware race condition', {
    maxEntries: 4,
    maxBytes: 4000,
  });

  assert.match(section, /PROJECT MEMORY \(RECALL\)/);
  assert.match(section, /FACT: Framework/);
  assert.match(section, /EPISODE: JWT race condition/);
});

sqliteTest('saveAutoMemoryEntries stores one episode and detected decisions for a run', () => {
  const projectRoot = mkTmpDir('local-memory-auto-');
  const layout = resolveProjectLayout(projectRoot);

  const saved = saveAutoMemoryEntries(layout, {
    promptText: 'Надо устранить дубли при генерации документа',
    resultText: [
      '## What to do',
      '',
      '- Add an early guard for orgId == null before templater call.',
      '- Log templater response with explicit null-body/null-templateId diagnostics.',
      '',
      '=== END OF DOCUMENT ===',
    ].join('\n'),
    runId: 'run-123',
    taskId: 'DOCFLOW-1',
    sourceRef: '.ai/prompts/discussions/DOCFLOW-1/run-123',
  });

  assert.equal(saved.some((entry) => entry.type === 'episode'), true);
  assert.equal(saved.some((entry) => entry.type === 'decision'), true);

  const found = searchMemoryEntries(layout, { query: 'templater orgId diagnostics', limit: 8 });
  assert.equal(found.some((entry) => entry.runId === 'run-123' && entry.type === 'episode'), true);
  assert.equal(found.some((entry) => entry.runId === 'run-123' && entry.type === 'decision'), true);
});

sqliteTest('saveAutoMemoryEntries detects russian decision headings through language packs', () => {
  const projectRoot = mkTmpDir('local-memory-ru-headings-');
  const layout = resolveProjectLayout(projectRoot);

  const saved = saveAutoMemoryEntries(layout, {
    promptText: 'Надо починить экспорт отчета',
    resultText: [
      '## Что сделать',
      '',
      '- Add a null guard before report serialization.',
      '- Record serializer input shape for diagnostics.',
      '',
      '=== END OF DOCUMENT ===',
    ].join('\n'),
    runId: 'run-ru-1',
    taskId: 'REPORT-1',
    sourceRef: '.ai/prompts/discussions/REPORT-1/run-ru-1',
  });

  assert.equal(saved.some((entry) => entry.type === 'decision'), true);
});

sqliteTest('computeMemoryStoreDigest changes after saving entries', () => {
  const projectRoot = mkTmpDir('local-memory-digest-');
  const layout = resolveProjectLayout(projectRoot);

  const before = computeMemoryStoreDigest(layout);
  saveMemoryEntry(layout, {
    type: 'fact',
    title: 'Database',
    content: 'Project uses PostgreSQL 16.',
    tags: ['postgres'],
  });
  const after = computeMemoryStoreDigest(layout);

  assert.notEqual(before, after);
});
