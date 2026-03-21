const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', '..', '..', 'config', 'public-export-manifest.json');

function loadManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

test('public export manifest parses and declares allowlist mode', () => {
  const manifest = loadManifest();

  assert.equal(manifest.version, 1);
  assert.equal(manifest.mode, 'allowlist');
  assert.equal(typeof manifest.purpose, 'string');
  assert.ok(manifest.purpose.length > 0);
  assert.ok(Array.isArray(manifest.requiredPaths));
  assert.ok(Array.isArray(manifest.optionalPaths));
  assert.ok(Array.isArray(manifest.forbiddenPaths));
  assert.ok(manifest.requiredPaths.length > 0);
  assert.ok(manifest.forbiddenPaths.length > 0);
});

test('public export manifest paths are relative and non-overlapping', () => {
  const manifest = loadManifest();
  const buckets = [
    ...manifest.requiredPaths.map((entry) => ['required', entry]),
    ...manifest.optionalPaths.map((entry) => ['optional', entry]),
    ...manifest.forbiddenPaths.map((entry) => ['forbidden', entry]),
  ];

  const seen = new Map();

  for (const [bucket, entry] of buckets) {
    assert.equal(typeof entry, 'string');
    assert.ok(entry.length > 0, `${bucket} path must be non-empty`);
    assert.ok(!path.isAbsolute(entry), `${bucket} path must be relative: ${entry}`);
    assert.ok(!entry.startsWith('./'), `${bucket} path must not start with ./: ${entry}`);

    const prior = seen.get(entry);
    assert.equal(prior, undefined, `path appears in multiple buckets: ${entry}`);
    seen.set(entry, bucket);
  }
});

test('public export manifest protects private planning and local runtime state', () => {
  const manifest = loadManifest();

  assert.ok(manifest.forbiddenPaths.includes('docs/commercialization'));
  assert.ok(manifest.forbiddenPaths.includes('commercial-addons-local'));
  assert.ok(manifest.forbiddenPaths.includes('.ai'));
  assert.ok(manifest.forbiddenPaths.includes('PROJECT_PLANNED_CHANGES.md'));
  assert.ok(manifest.forbiddenPaths.includes('UNIFIED_MODEL_CHANGE_LOG.md'));
});

test('public export manifest includes core OSS surfaces', () => {
  const manifest = loadManifest();

  assert.ok(manifest.requiredPaths.includes('README.md'));
  assert.ok(manifest.requiredPaths.includes('package.json'));
  assert.ok(manifest.requiredPaths.includes('ai/scripts'));
  assert.ok(manifest.requiredPaths.includes('ai/specs'));
  assert.ok(manifest.requiredPaths.includes('examples'));
});
