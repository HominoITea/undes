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

function createProjectRoot(prefix) {
  return mkTmpDir(prefix);
}

function createValidProject(prefix) {
  const projectRoot = createProjectRoot(prefix);
  const aiDir = path.join(projectRoot, '.ai');
  fs.mkdirSync(path.join(aiDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'sample.js'), 'function sample() { return 1; }\n');
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
  return { projectRoot, aiDir };
}

test('generate-context fails for invalid --project-path', () => {
  const missingPath = path.join(os.tmpdir(), `genctx-missing-${Date.now()}-${Math.random()}`);
  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${missingPath}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /Invalid --project-path/);
});

test('generate-context fails on direct invocation without dispatcher guard env', () => {
  const project = createValidProject('genctx-direct-block-');
  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${project.projectRoot}`,
  ], {
    env: {
      _AI_DISPATCHER_RESOLVED: '',
      _AI_DISPATCHER_BYPASS: '',
    },
  });

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /Direct script invocation is disabled in Hub-only mode/);
  assert.match(output, /Use dispatcher: npm run undes -- --prompt/);
});

test('generate-context rejects bypass env and requires dispatcher', () => {
  const project = createValidProject('genctx-direct-bypass-rejected-');
  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${project.projectRoot}`,
  ], {
    env: {
      _AI_DISPATCHER_RESOLVED: '',
      _AI_DISPATCHER_BYPASS: '1',
    },
  });

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.equal(fs.existsSync(path.join(project.aiDir, '.code_index.json')), false);
  assert.match(output, /Dispatcher bypass mode is no longer supported/);
  assert.match(output, /Direct script invocation is disabled in Hub-only mode/);
});

test('generate-context fails when AI data directory is missing', () => {
  const projectRoot = createProjectRoot('genctx-missing-ai-dir-');
  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${projectRoot}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /AI data directory not found/);
  assert.match(output, /Run: npm run undes:doctor -- --project-path/);
});

test('generate-context fails when required context.json is missing', () => {
  const projectRoot = createProjectRoot('genctx-missing-context-');
  const aiDir = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });
  writeJson(path.join(aiDir, 'agents.json'), { agents: [] });

  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${projectRoot}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /Required file missing/);
  assert.match(output, /context\.json/);
});

test('generate-context fails when context.json has invalid JSON', () => {
  const projectRoot = createProjectRoot('genctx-invalid-context-json-');
  const aiDir = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });
  fs.writeFileSync(path.join(aiDir, 'context.json'), '{ invalid json');
  writeJson(path.join(aiDir, 'agents.json'), { agents: [] });

  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${projectRoot}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /Invalid JSON in ai\/context\.json/);
});

test('generate-context fails when agents.json schema is invalid', () => {
  const projectRoot = createProjectRoot('genctx-invalid-agents-schema-');
  const aiDir = path.join(projectRoot, '.ai');
  fs.mkdirSync(path.join(aiDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(aiDir, 'prompts'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'sample.js'), 'function f() { return 1; }\n');

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
  // Invalid: agent entry misses required apiUrl/model/key fields
  writeJson(path.join(aiDir, 'agents.json'), {
    agents: [{ name: 'broken-agent' }],
  });

  const run = runGenerateContext(REPO_ROOT, [
    '--light',
    '--prompt=test-invalid-agents',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${projectRoot}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /Invalid ai\/agents\.json/);
  assert.match(output, /apiUrl.*required and must be a string/);
});

test('generate-context fails for invalid --hub-root path', () => {
  const missingHubRoot = path.join(os.tmpdir(), `genctx-missing-hub-${Date.now()}-${Math.random()}`);
  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${missingHubRoot}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /Invalid hub root/);
});

test('generate-context fails when agents.json is missing (environment check)', () => {
  const projectRoot = createProjectRoot('genctx-missing-agents-file-');
  const aiDir = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });
  writeJson(path.join(aiDir, 'context.json'), {
    fullFiles: [],
    lightFiles: [],
    exclude: 'find . -maxdepth 2 -type f',
    codeIndex: { enabled: true, outputPath: '.code_index.json', indexMode: 'regex' },
  });

  const run = runGenerateContext(REPO_ROOT, [
    '--index-only',
    `--hub-root=${REPO_ROOT}`,
    `--project-path=${projectRoot}`,
  ]);

  const output = `${run.stdout}\n${run.stderr}`;
  assert.notEqual(run.status, 0);
  assert.match(output, /CRITICAL: Missing configuration file/);
  assert.match(output, /agents\.json/);
});
