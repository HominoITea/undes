const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const releaseCheck = require('../check-public-release');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runCheck(args = [], options = {}) {
  const scriptPath = path.join(__dirname, '..', 'check-public-release.js');
  return spawnSync('node', [scriptPath, ...args], {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
  });
}

test('check-public-release exports callable main entrypoint', () => {
  assert.equal(typeof releaseCheck.main, 'function');
});

test('findForbiddenPaths returns empty when forbidden paths are absent', () => {
  const repoRoot = mkTmpDir('public-release-clean-');
  const hits = releaseCheck.findForbiddenPaths(repoRoot);
  assert.deepEqual(hits, []);
});

test('findMissingRequiredPaths detects missing release artifacts', () => {
  const repoRoot = mkTmpDir('public-release-required-missing-');
  const missing = releaseCheck.findMissingRequiredPaths(repoRoot);

  assert.equal(missing.length, 3);
  assert.deepEqual(
    missing.map((entry) => entry.relativePath).sort(),
    ['LICENSE', 'THIRD_PARTY_NOTICES.md', path.join('config', 'public-export-manifest.json')].sort(),
  );
});

test('findMissingRequiredPaths returns empty when required release artifacts exist', () => {
  const repoRoot = mkTmpDir('public-release-required-ok-');
  fs.mkdirSync(path.join(repoRoot, 'config'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'LICENSE'), 'Apache License 2.0\n');
  fs.writeFileSync(path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'), '# Third-Party Notices\n');
  fs.writeFileSync(path.join(repoRoot, 'config', 'public-export-manifest.json'), '{}\n');

  const missing = releaseCheck.findMissingRequiredPaths(repoRoot);
  assert.deepEqual(missing, []);
});

test('findForbiddenPaths detects commercialization docs path', () => {
  const repoRoot = mkTmpDir('public-release-docs-');
  fs.mkdirSync(path.join(repoRoot, 'docs', 'commercialization'), { recursive: true });

  const hits = releaseCheck.findForbiddenPaths(repoRoot);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].relativePath, path.join('docs', 'commercialization'));
});

test('findForbiddenPaths detects commercial-addons-local scratch path', () => {
  const repoRoot = mkTmpDir('public-release-scratch-');
  fs.mkdirSync(path.join(repoRoot, 'commercial-addons-local'), { recursive: true });

  const hits = releaseCheck.findForbiddenPaths(repoRoot);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].relativePath, 'commercial-addons-local');
});

test('CLI passes for clean repo root', () => {
  const repoRoot = mkTmpDir('public-release-cli-clean-');
  fs.mkdirSync(path.join(repoRoot, 'config'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'LICENSE'), 'Apache License 2.0\n');
  fs.writeFileSync(path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'), '# Third-Party Notices\n');
  fs.writeFileSync(path.join(repoRoot, 'config', 'public-export-manifest.json'), '{}\n');
  const result = runCheck([`--root=${repoRoot}`]);
  assert.equal(result.status, 0, result.stderr);
});

test('CLI fails when forbidden paths exist', () => {
  const repoRoot = mkTmpDir('public-release-cli-fail-');
  fs.mkdirSync(path.join(repoRoot, 'config'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'LICENSE'), 'Apache License 2.0\n');
  fs.writeFileSync(path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'), '# Third-Party Notices\n');
  fs.writeFileSync(path.join(repoRoot, 'config', 'public-export-manifest.json'), '{}\n');
  fs.mkdirSync(path.join(repoRoot, 'docs', 'commercialization'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'commercial-addons-local'), { recursive: true });

  const result = runCheck([`--root=${repoRoot}`]);
  assert.equal(result.status, 1, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});

test('CLI fails when required release artifacts are missing', () => {
  const repoRoot = mkTmpDir('public-release-cli-missing-required-');
  const result = runCheck([`--root=${repoRoot}`]);
  assert.equal(result.status, 1, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
