const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  cleanup,
  main: cleanupMain,
  normalizeMainInput,
  KEEP_COUNT,
} = require('../cleanup');

const TMP_BASE = path.join(__dirname, '..', '..', '..', '.tmp-test-work');

function mkTmpDir(prefix) {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(TMP_BASE, prefix));
}

function writeArchiveFile(archiveDir, name, offsetSeconds) {
  const filePath = path.join(archiveDir, name);
  fs.writeFileSync(filePath, name);
  const ts = new Date(Date.now() + offsetSeconds * 1000);
  fs.utimesSync(filePath, ts, ts);
  return filePath;
}

test('cleanup: no archive directory -> no-op', () => {
  const project = mkTmpDir('cleanup-none-');
  const logs = [];
  const result = cleanup({
    archiveDir: path.join(project, 'ai', 'prompts', 'archive'),
    logger: (line) => logs.push(String(line)),
  });

  assert.equal(result.deleted, 0);
  assert.equal(result.skipped, true);
  assert.ok(logs.some((line) => line.includes('Nothing to clean')));
});

test('cleanup: archive under keep limit -> no deletion', () => {
  const project = mkTmpDir('cleanup-under-');
  const archiveDir = path.join(project, 'ai', 'prompts', 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  writeArchiveFile(archiveDir, 'a.txt', -3);
  writeArchiveFile(archiveDir, 'b.txt', -2);
  writeArchiveFile(archiveDir, 'c.txt', -1);

  const logs = [];
  const result = cleanup({ archiveDir, logger: (line) => logs.push(String(line)) });

  assert.equal(result.deleted, 0);
  assert.equal(result.total, 3);
  assert.ok(logs.some((line) => line.includes('No cleanup needed')));
  assert.equal(fs.existsSync(path.join(archiveDir, 'a.txt')), true);
  assert.equal(fs.existsSync(path.join(archiveDir, 'b.txt')), true);
  assert.equal(fs.existsSync(path.join(archiveDir, 'c.txt')), true);
});

test('cleanup: removes only oldest files above keep limit', () => {
  const project = mkTmpDir('cleanup-over-');
  const archiveDir = path.join(project, 'ai', 'prompts', 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });

  for (let i = 1; i <= KEEP_COUNT + 2; i += 1) {
    const name = `f-${String(i).padStart(2, '0')}.txt`;
    writeArchiveFile(archiveDir, name, i);
  }

  const logs = [];
  const result = cleanup({ archiveDir, logger: (line) => logs.push(String(line)) });

  assert.equal(result.deleted, 2);
  assert.ok(logs.some((line) => line.includes('Cleaning up 2 old files')));
  assert.equal(fs.existsSync(path.join(archiveDir, 'f-01.txt')), false);
  assert.equal(fs.existsSync(path.join(archiveDir, 'f-02.txt')), false);
  assert.equal(fs.existsSync(path.join(archiveDir, 'f-03.txt')), true);
  assert.equal(fs.existsSync(path.join(archiveDir, `f-${String(KEEP_COUNT + 2).padStart(2, '0')}.txt`)), true);
});

test('cleanup: auto-detect prefers .ai archive over legacy ai archive', () => {
  const project = mkTmpDir('cleanup-dot-ai-first-');
  const dotAiRunsDir = path.join(project, '.ai', 'prompts', 'runs');
  const legacyArchiveDir = path.join(project, 'ai', 'prompts', 'archive');
  fs.mkdirSync(dotAiRunsDir, { recursive: true });
  fs.mkdirSync(legacyArchiveDir, { recursive: true });

  for (let i = 1; i <= KEEP_COUNT + 1; i += 1) {
    writeArchiveFile(dotAiRunsDir, `dot-${String(i).padStart(2, '0')}.txt`, i);
    writeArchiveFile(legacyArchiveDir, `legacy-${String(i).padStart(2, '0')}.txt`, i);
  }

  const result = cleanup({ projectRoot: project, logger: () => {} });

  assert.equal(result.deleted, 1);
  assert.equal(fs.readdirSync(dotAiRunsDir).length, KEEP_COUNT);
  assert.equal(fs.readdirSync(legacyArchiveDir).length, KEEP_COUNT + 1);
});

test('cleanup: auto-detect falls back to legacy ai archive when .ai is missing', () => {
  const project = mkTmpDir('cleanup-legacy-fallback-');
  const legacyArchiveDir = path.join(project, 'ai', 'prompts', 'archive');
  fs.mkdirSync(legacyArchiveDir, { recursive: true });

  for (let i = 1; i <= KEEP_COUNT + 1; i += 1) {
    writeArchiveFile(legacyArchiveDir, `legacy-${String(i).padStart(2, '0')}.txt`, i);
  }

  const result = cleanup({ projectRoot: project, logger: () => {} });

  assert.equal(result.deleted, 1);
  assert.equal(fs.readdirSync(legacyArchiveDir).length, KEEP_COUNT);
});

test('cleanup: main accepts unified options object contract with projectPath', () => {
  const project = mkTmpDir('cleanup-main-options-');
  const legacyArchiveDir = path.join(project, 'ai', 'prompts', 'archive');
  fs.mkdirSync(legacyArchiveDir, { recursive: true });

  for (let i = 1; i <= KEEP_COUNT + 1; i += 1) {
    writeArchiveFile(legacyArchiveDir, `legacy-${String(i).padStart(2, '0')}.txt`, i);
  }

  const result = cleanupMain({
    projectPath: project,
    env: process.env,
    argv: ['node', 'cleanup.js'],
    hubRoot: project,
    logger: () => {},
  });

  assert.equal(result.deleted, 1);
  assert.equal(fs.readdirSync(legacyArchiveDir).length, KEEP_COUNT);
});

test('cleanup: normalizeMainInput maps projectRoot alias to projectPath', () => {
  const normalized = normalizeMainInput({
    projectRoot: '/tmp/project-root',
    argv: ['node', 'cleanup.js', '--help'],
  });

  assert.equal(normalized.projectPath, '/tmp/project-root');
  assert.deepEqual(normalized.argv, ['node', 'cleanup.js', '--help']);
});
