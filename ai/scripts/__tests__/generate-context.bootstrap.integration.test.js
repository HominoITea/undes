const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runGenerateContext } = require('./helpers/generate-context-test-utils');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function createProjectFixture(prefix, { legacyLayout = false } = {}) {
  const projectRoot = mkTmpDir(prefix);
  const aiDirName = legacyLayout ? 'ai' : '.ai';
  const aiDir = path.join(projectRoot, aiDirName);
  fs.mkdirSync(path.join(aiDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'sample.js'),
    'function sample() { return 1; }\nmodule.exports = { sample };\n',
  );

  writeJson(path.join(aiDir, 'context.json'), {
    fullFiles: [],
    lightFiles: [],
    exclude: 'find . -maxdepth 2 -type f',
    codeIndex: {
      enabled: true,
      outputPath: '.code_index.json',
      indexMode: 'regex',
    },
  });
  writeJson(path.join(aiDir, 'agents.json'), { agents: [] });

  return { projectRoot, aiDir, aiDirName };
}

function createHubRootFixture() {
  const hubRoot = mkTmpDir('genctx-hub-');
  fs.mkdirSync(path.join(hubRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(hubRoot, 'ai'), { recursive: true });
  writeJson(path.join(hubRoot, 'ai', 'context.json'), {
    fullFiles: [],
    lightFiles: [],
    exclude: 'find . -maxdepth 2 -type f',
  });
  writeJson(path.join(hubRoot, 'ai', 'agents.json'), { agents: [] });
  return hubRoot;
}

test('generate-context: uses active project from config/hub-config.json', () => {
  const hubRoot = createHubRootFixture();
  const projectA = createProjectFixture('genctx-active-a-');
  const projectB = createProjectFixture('genctx-active-b-');

  writeJson(path.join(hubRoot, 'config', 'hub-config.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeProjectPath: projectB.projectRoot,
  });

  const run = runGenerateContext(hubRoot, ['--index-only', `--hub-root=${hubRoot}`]);
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(run.status, 0, output);
  assert.equal(fs.existsSync(path.join(projectB.aiDir, '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(projectA.aiDir, '.code_index.json')), false);
  assert.match(output, /Using hub active project from config\/hub-config\.json/);
});

test('generate-context: falls back to latest lastUsed project from projects.json registry', () => {
  const hubRoot = createHubRootFixture();
  const older = createProjectFixture('genctx-registry-old-');
  const newer = createProjectFixture('genctx-registry-new-');

  writeJson(path.join(hubRoot, 'config', 'projects.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    projects: [
      {
        projectId: 'old123',
        path: older.projectRoot,
        displayName: 'older',
        status: 'active',
        createdAt: '2026-03-01T10:00:00.000Z',
        lastUsed: '2026-03-01T10:00:00.000Z',
      },
      {
        projectId: 'new456',
        path: newer.projectRoot,
        displayName: 'newer',
        status: 'active',
        createdAt: '2026-03-02T10:00:00.000Z',
        lastUsed: '2026-03-03T10:00:00.000Z',
      },
    ],
  });

  const run = runGenerateContext(hubRoot, ['--index-only', `--hub-root=${hubRoot}`]);
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(run.status, 0, output);
  assert.equal(fs.existsSync(path.join(newer.aiDir, '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(older.aiDir, '.code_index.json')), false);
  assert.match(output, /Using last selected hub project/);
});

test('generate-context: explicit --project-path takes precedence over hub config and registry', () => {
  const hubRoot = createHubRootFixture();
  const configured = createProjectFixture('genctx-precedence-config-');
  const explicit = createProjectFixture('genctx-precedence-explicit-');

  writeJson(path.join(hubRoot, 'config', 'hub-config.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeProjectPath: configured.projectRoot,
  });
  writeJson(path.join(hubRoot, 'config', 'projects.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    projects: [
      {
        projectId: 'cfg123',
        path: configured.projectRoot,
        displayName: 'configured',
        status: 'active',
        createdAt: '2026-03-01T10:00:00.000Z',
        lastUsed: '2026-03-01T10:00:00.000Z',
      },
      {
        projectId: 'exp456',
        path: explicit.projectRoot,
        displayName: 'explicit',
        status: 'active',
        createdAt: '2026-03-02T10:00:00.000Z',
        lastUsed: '2026-03-03T10:00:00.000Z',
      },
    ],
  });

  const run = runGenerateContext(hubRoot, [
    '--index-only',
    `--hub-root=${hubRoot}`,
    `--project-path=${explicit.projectRoot}`,
  ]);
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(run.status, 0, output);
  assert.equal(fs.existsSync(path.join(explicit.aiDir, '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(configured.aiDir, '.code_index.json')), false);
  assert.doesNotMatch(output, /Using hub active project from config\/hub-config\.json/);
  assert.doesNotMatch(output, /Using last selected hub project/);
});

test('generate-context: legacy ai/ layout emits deprecation warning', () => {
  const hubRoot = createHubRootFixture();
  const legacy = createProjectFixture('genctx-legacy-ai-', { legacyLayout: true });

  writeJson(path.join(hubRoot, 'config', 'hub-config.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeProjectPath: legacy.projectRoot,
  });

  const run = runGenerateContext(hubRoot, ['--index-only', `--hub-root=${hubRoot}`]);
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(run.status, 0, output);
  assert.equal(fs.existsSync(path.join(legacy.aiDir, '.code_index.json')), true);
  assert.match(output, /Legacy ai\/ layout detected/);
});

test('generate-context: uses AI_HUB_PROJECT_PATH env over hub config/registry', () => {
  const hubRoot = createHubRootFixture();
  const fromEnv = createProjectFixture('genctx-env-path-');
  const fromConfig = createProjectFixture('genctx-env-config-');

  writeJson(path.join(hubRoot, 'config', 'hub-config.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeProjectPath: fromConfig.projectRoot,
  });
  writeJson(path.join(hubRoot, 'config', 'projects.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    projects: [
      {
        projectId: 'cfg',
        path: fromConfig.projectRoot,
        displayName: 'config',
        status: 'active',
        createdAt: '2026-03-01T10:00:00.000Z',
        lastUsed: '2026-03-01T10:00:00.000Z',
      },
      {
        projectId: 'env',
        path: fromEnv.projectRoot,
        displayName: 'env',
        status: 'active',
        createdAt: '2026-03-01T10:00:00.000Z',
        lastUsed: '2026-03-03T10:00:00.000Z',
      },
    ],
  });

  const run = runGenerateContext(
    hubRoot,
    ['--index-only', `--hub-root=${hubRoot}`],
    { env: { AI_HUB_PROJECT_PATH: fromEnv.projectRoot } },
  );
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(run.status, 0, output);
  assert.equal(fs.existsSync(path.join(fromEnv.aiDir, '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(fromConfig.aiDir, '.code_index.json')), false);
  assert.doesNotMatch(output, /Using hub active project from config\/hub-config\.json/);
  assert.doesNotMatch(output, /Using last selected hub project/);
});

test('generate-context: explicit --project-path overrides AI_HUB_PROJECT_PATH env', () => {
  const hubRoot = createHubRootFixture();
  const fromEnv = createProjectFixture('genctx-arg-over-env-env-');
  const fromArg = createProjectFixture('genctx-arg-over-env-arg-');

  const run = runGenerateContext(
    hubRoot,
    ['--index-only', `--hub-root=${hubRoot}`, `--project-path=${fromArg.projectRoot}`],
    { env: { AI_HUB_PROJECT_PATH: fromEnv.projectRoot } },
  );
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(run.status, 0, output);
  assert.equal(fs.existsSync(path.join(fromArg.aiDir, '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(fromEnv.aiDir, '.code_index.json')), false);
});

test('generate-context: prefers .ai when both .ai and legacy ai exist', () => {
  const project = createProjectFixture('genctx-both-layouts-');
  const legacyAi = path.join(project.projectRoot, 'ai');
  fs.cpSync(project.aiDir, legacyAi, { recursive: true });

  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${project.projectRoot}`,
  ]);
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(run.status, 0, output);
  assert.equal(fs.existsSync(path.join(project.aiDir, '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(legacyAi, '.code_index.json')), false);
  assert.doesNotMatch(output, /Legacy ai\/ layout detected/);
});
