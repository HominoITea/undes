const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const memory = require('../memory');
const cleanup = require('../cleanup');
const architectureCheck = require('../architecture-check');
const initProject = require('../init-project');
const generateContext = require('../generate-context');
const checkPublicRelease = require('../check-public-release');
const runArtifactSummary = require('../run-artifact-summary');
const runArtifactRegression = require('../run-artifact-regression');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('project-scoped scripts export callable main entrypoints', () => {
  assert.equal(typeof memory.main, 'function');
  assert.equal(typeof cleanup.main, 'function');
  assert.equal(typeof architectureCheck.main, 'function');
  assert.equal(typeof initProject.main, 'function');
  assert.equal(typeof generateContext.main, 'function');
  assert.equal(typeof checkPublicRelease.main, 'function');
  assert.equal(typeof runArtifactSummary.main, 'function');
  assert.equal(typeof runArtifactRegression.main, 'function');
});

test('requiring generate-context does not change cwd', () => {
  const originalCwd = process.cwd();
  const hubRoot = mkTmpDir('entrypoint-hub-root-');
  const projectRoot = mkTmpDir('entrypoint-project-root-');
  fs.mkdirSync(path.join(hubRoot, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(hubRoot, 'config', 'hub-config.json'),
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      activeProjectPath: projectRoot,
    }, null, 2),
  );

  try {
    process.chdir(hubRoot);
    const modulePath = path.join(__dirname, '..', 'generate-context.js');
    delete require.cache[require.resolve(modulePath)];
    require(modulePath);
    assert.equal(process.cwd(), hubRoot);
  } finally {
    process.chdir(originalCwd);
  }
});
