const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  readJsonIfExists,
  mergeContextConfig,
  mergeAgentsConfig,
  resolveReadablePath,
  loadContextConfig,
} = require('../config-loader');

const TMP_BASE = path.join(__dirname, '..', '..', '..', '.tmp-test-work');

function mkTmpDir(prefix) {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(TMP_BASE, prefix));
}

test('mergeContextConfig: project overrides hub defaults', () => {
  const hub = { limits: { maxFiles: 300 }, fullFiles: ['README.md'] };
  const project = { limits: { maxFiles: 100 } };
  const merged = mergeContextConfig(hub, project);
  assert.equal(merged.limits.maxFiles, 100);
  assert.deepEqual(merged.fullFiles, ['README.md']);
});

test('mergeContextConfig: project fullFiles replace hub fullFiles', () => {
  const hub = { fullFiles: ['README.md', 'package.json'] };
  const project = { fullFiles: ['ai/llms.md'] };
  const merged = mergeContextConfig(hub, project);
  assert.deepEqual(merged.fullFiles, ['ai/llms.md']);
});

test('mergeContextConfig: empty project config returns hub defaults', () => {
  const hub = { limits: { maxFiles: 300 }, exclude: 'find .' };
  const merged = mergeContextConfig(hub, {});
  assert.equal(merged.limits.maxFiles, 300);
  assert.equal(merged.exclude, 'find .');
});

test('mergeAgentsConfig: project agent overrides hub agent by name', () => {
  const hub = { agents: [{ name: 'architect', model: 'claude-sonnet' }] };
  const project = { agents: [{ name: 'architect', model: 'gpt-5' }] };
  const merged = mergeAgentsConfig(hub, project);
  assert.equal(merged.agents[0].model, 'gpt-5');
  assert.equal(merged.agents.length, 1);
});

test('mergeAgentsConfig: project adds new agents', () => {
  const hub = { agents: [{ name: 'architect', model: 'claude' }] };
  const project = { agents: [{ name: 'custom-agent', model: 'local' }] };
  const merged = mergeAgentsConfig(hub, project);
  assert.equal(merged.agents.length, 2);
});

test('mergeAgentsConfig: null inputs return gracefully', () => {
  assert.equal(mergeAgentsConfig(null, null), null);
  assert.deepEqual(mergeAgentsConfig({ agents: [] }, null).agents, []);
});

test('resolveReadablePath: prefers project file', () => {
  const projectRoot = mkTmpDir('cfg-project-');
  const hubRoot = mkTmpDir('cfg-hub-');
  const projectFile = path.join(projectRoot, 'ai', 'context.json');
  const hubFile = path.join(hubRoot, 'ai', 'context.json');
  fs.mkdirSync(path.dirname(projectFile), { recursive: true });
  fs.mkdirSync(path.dirname(hubFile), { recursive: true });
  fs.writeFileSync(projectFile, '{"scope":"project"}');
  fs.writeFileSync(hubFile, '{"scope":"hub"}');

  const resolved = resolveReadablePath('ai/context.json', { projectRoot, hubRoot });
  assert.equal(resolved, projectFile);
});

test('resolveReadablePath: falls back to hub for .ai path', () => {
  const projectRoot = mkTmpDir('cfg-project-');
  const hubRoot = mkTmpDir('cfg-hub-');
  const hubFile = path.join(hubRoot, 'ai', 'context.json');
  fs.mkdirSync(path.dirname(hubFile), { recursive: true });
  fs.writeFileSync(hubFile, '{"scope":"hub"}');

  const resolved = resolveReadablePath('.ai/context.json', { projectRoot, hubRoot });
  assert.equal(resolved, hubFile);
});

test('resolveReadablePath: returns null for non-ai paths without local file', () => {
  const projectRoot = mkTmpDir('cfg-project-');
  const hubRoot = mkTmpDir('cfg-hub-');
  fs.mkdirSync(hubRoot, { recursive: true });
  fs.writeFileSync(path.join(hubRoot, 'README.md'), 'hub readme');

  const resolved = resolveReadablePath('README.md', { projectRoot, hubRoot });
  assert.equal(resolved, null);
});

test('resolveReadablePath: resolves canonical ai/llms.md project file directly', () => {
  const projectRoot = mkTmpDir('cfg-project-');
  const canonicalFile = path.join(projectRoot, 'ai', 'llms.md');
  fs.mkdirSync(path.dirname(canonicalFile), { recursive: true });
  fs.writeFileSync(canonicalFile, '# canonical');

  const resolved = resolveReadablePath('ai/llms.md', { projectRoot, hubRoot: mkTmpDir('cfg-hub-') });
  assert.equal(resolved, canonicalFile);
});

test('readJsonIfExists: throws on invalid json', () => {
  const root = mkTmpDir('cfg-json-');
  const filePath = path.join(root, 'broken.json');
  fs.writeFileSync(filePath, '{not-json');
  assert.throws(() => readJsonIfExists(filePath), /Invalid JSON/);
});

test('loadContextConfig: bad exclude falls back to default and warns', () => {
  const root = mkTmpDir('cfg-load-');
  const hubConfigPath = path.join(root, 'hub-context.json');
  const projectConfigPath = path.join(root, 'project-context.json');
  fs.writeFileSync(hubConfigPath, JSON.stringify({ fullFiles: ['README.md'], lightFiles: ['README.md'], exclude: 123 }));
  fs.writeFileSync(projectConfigPath, JSON.stringify({}));

  const warns = [];
  const originalWarn = console.warn;
  console.warn = (line) => warns.push(String(line));
  try {
    const config = loadContextConfig(hubConfigPath, projectConfigPath, 'find .', () => []);
    assert.equal(config.exclude, 'find .');
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warns.some((line) => line.includes('"exclude" is not a string')));
});

test('loadContextConfig: throws INVALID_CONTEXT_CONFIG with validation errors', () => {
  const root = mkTmpDir('cfg-load-');
  const hubConfigPath = path.join(root, 'hub-context.json');
  const projectConfigPath = path.join(root, 'project-context.json');
  fs.writeFileSync(hubConfigPath, JSON.stringify({ fullFiles: ['README.md'], lightFiles: ['README.md'], exclude: 'find .' }));
  fs.writeFileSync(projectConfigPath, JSON.stringify({}));

  assert.throws(
    () => loadContextConfig(hubConfigPath, projectConfigPath, 'find .', () => ['broken shape']),
    (error) => error && error.code === 'INVALID_CONTEXT_CONFIG' && Array.isArray(error.validationErrors),
  );
});
