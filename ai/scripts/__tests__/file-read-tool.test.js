const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  isBlockedFile,
  extractFileReadRequests,
  parseFileRequest,
  getFileContent,
} = require('../infrastructure/file-read-tool');

test('extractFileReadRequests parses multiple markers', () => {
  const text = 'A <<<READ_FILE: src/a.js>>> and <<<READ_FILE: docs/notes.md>>>';
  assert.deepEqual(extractFileReadRequests(text), ['src/a.js', 'docs/notes.md']);
});

test('parseFileRequest supports line ranges', () => {
  const parsed = parseFileRequest('src/app.ts#L120-L260');
  assert.equal(parsed.filePath, 'src/app.ts');
  assert.equal(parsed.fromLine, 120);
  assert.equal(parsed.toLine, 260);
});

test('isBlockedFile blocks hidden/env paths', () => {
  const hidden = isBlockedFile('.ssh/id_rsa');
  assert.equal(hidden.blocked, true);

  const env = isBlockedFile('config/.env.local');
  assert.equal(env.blocked, true);

  const safe = isBlockedFile('src/app.js');
  assert.equal(safe.blocked, false);
});

test('getFileContent reads file inside root', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-tool-'));
  const filePath = path.join(tmp, 'ok.txt');
  fs.writeFileSync(filePath, 'hello');

  const result = getFileContent('ok.txt', { rootDir: tmp });
  assert.equal(result.ok, true);
  assert.equal(result.content, 'hello');
  assert.equal(result.size, 5);
});

test('getFileContent rejects path traversal', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-tool-'));
  const result = getFileContent('../secret.txt', { rootDir: tmp });
  assert.equal(result.ok, false);
  assert.match(result.content, /Path traversal not allowed/);
});

test('getFileContent returns only requested line range', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-tool-'));
  const filePath = path.join(tmp, 'ok.txt');
  fs.writeFileSync(filePath, 'a\nb\nc\nd\ne\n');

  const result = getFileContent('ok.txt#L2-L4', { rootDir: tmp, maxFileBytes: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.content, 'b\nc\nd');
});

test('getFileContent suggests line range for oversized file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-tool-'));
  const filePath = path.join(tmp, 'big.txt');
  fs.writeFileSync(filePath, 'x'.repeat(64));

  const result = getFileContent('big.txt', { rootDir: tmp, maxFileBytes: 8 });
  assert.equal(result.ok, false);
  assert.match(result.content, /Request a narrower range like big\.txt#L120-L260/);
});
