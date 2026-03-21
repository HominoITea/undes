const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getJsonRawSidecarPath,
  writeJsonArtifactWithRaw,
} = require('../generate-context');

test('getJsonRawSidecarPath maps artifact.json to artifact.raw.txt', () => {
  assert.equal(
    getJsonRawSidecarPath('/tmp/agent-analysis.json'),
    '/tmp/agent-analysis.raw.txt',
  );
});

test('writeJsonArtifactWithRaw preserves both parsed json and raw response', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-sidecar-'));
  const outputPath = path.join(dir, 'tester-validation.json');
  const parsed = { success: false, summary: 'fallback parsed view' };
  const rawText = '{"summary":"raw model payload"}\n=== END OF DOCUMENT ===';

  try {
    const rawPath = writeJsonArtifactWithRaw(outputPath, parsed, rawText);
    assert.equal(rawPath, path.join(dir, 'tester-validation.raw.txt'));
    assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), parsed);
    assert.equal(fs.readFileSync(rawPath, 'utf8'), rawText);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
