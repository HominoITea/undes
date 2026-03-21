const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveHubFileForRead,
  resolveHubFileForWrite,
  getModernHubFilePath,
} = require('../hub-config-paths');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('resolveHubFileForRead prefers config/ path over legacy root path', () => {
  const hubRoot = mkTmpDir('hub-files-modern-');
  const modern = path.join(hubRoot, 'config', 'projects.json');
  const legacy = path.join(hubRoot, 'projects.json');
  fs.mkdirSync(path.dirname(modern), { recursive: true });
  fs.writeFileSync(modern, '{"version":1}');
  fs.writeFileSync(legacy, '{"version":0}');

  const resolved = resolveHubFileForRead(hubRoot, 'projects.json');
  assert.equal(resolved, modern);
});

test('resolveHubFileForRead falls back to legacy and warns once', () => {
  const hubRoot = mkTmpDir('hub-files-legacy-');
  const legacy = path.join(hubRoot, 'hub-config.json');
  fs.writeFileSync(legacy, '{"version":1}');

  const warnings = [];
  const logger = (msg) => warnings.push(String(msg));
  const first = resolveHubFileForRead(hubRoot, 'hub-config.json', { logger });
  const second = resolveHubFileForRead(hubRoot, 'hub-config.json', { logger });

  assert.equal(first, legacy);
  assert.equal(second, legacy);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Legacy hub config path detected/);
});

test('resolveHubFileForWrite always targets config/ and creates dir', () => {
  const hubRoot = mkTmpDir('hub-files-write-');
  const writePath = resolveHubFileForWrite(hubRoot, 'projects.json');

  assert.equal(writePath, getModernHubFilePath(hubRoot, 'projects.json'));
  assert.equal(fs.existsSync(path.join(hubRoot, 'config')), true);
});
