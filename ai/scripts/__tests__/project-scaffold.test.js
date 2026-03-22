const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveProjectLayout } = require('../path-utils');
const {
  HUB_CONTRACT_VERSION,
  buildScaffoldSyncPlan,
  applyScaffoldSyncPlan,
  ensureProjectScaffoldUpToDate,
} = require('../domain/project-scaffold');

function mkHubRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-scaffold-'));
  const aiDir = path.join(root, 'ai');
  fs.mkdirSync(aiDir, { recursive: true });
  fs.writeFileSync(path.join(aiDir, 'context.json'), JSON.stringify({
    limits: { maxFiles: 300 },
    codeIndex: { enabled: true },
    fullFiles: ['ai/llms.md', 'package.json'],
    lightFiles: ['ai/llms.md'],
    exclude: 'find . -maxdepth 4 -type f',
  }, null, 2));
  fs.writeFileSync(path.join(aiDir, 'agents.json'), JSON.stringify({
    agents: [
      {
        name: 'architect',
        apiUrl: 'https://example.com/a',
        model: 'hub-architect',
        key: 'KEY',
        role: 'Architect',
      },
      {
        name: 'reviewer',
        apiUrl: 'https://example.com/r',
        model: 'hub-reviewer',
        key: 'KEY',
        role: 'Reviewer',
      },
    ],
  }, null, 2));
  return root;
}

function mkProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-scaffold-'));
  fs.mkdirSync(path.join(root, 'ai'), { recursive: true });
  fs.mkdirSync(path.join(root, '.ai', 'prompts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'demo-app',
    dependencies: { next: '^15.0.0', react: '^19.0.0' },
  }, null, 2));
  fs.writeFileSync(path.join(root, 'ai', 'context.json'), JSON.stringify({
    fullFiles: ['package.json'],
    lightFiles: ['README.md'],
    exclude: 'find . -type f',
  }, null, 2));
  fs.writeFileSync(path.join(root, 'ai', 'agents.json'), JSON.stringify({
    agents: [
      {
        name: 'architect',
        model: 'project-architect',
      },
    ],
  }, null, 2));
  fs.writeFileSync(path.join(root, '.ai', 'prompts', 'prompt.txt'), '');
  return root;
}

test('buildScaffoldSyncPlan detects missing contract and stale scaffold surfaces', () => {
  const hubRoot = mkHubRoot();
  const projectRoot = mkProjectRoot();
  const layout = resolveProjectLayout(projectRoot);

  const plan = buildScaffoldSyncPlan(projectRoot, layout, {
    hubRoot,
    includeMergeAware: true,
  });

  assert.equal(plan.contractVersion, HUB_CONTRACT_VERSION);
  assert.ok(plan.issues.some((issue) => issue.type === 'missing-contract'));
  assert.ok(plan.issues.some((issue) => issue.type === 'empty-prompt-surface'));
  assert.ok(plan.syncable.some((item) => item.path === '.ai/stack-profile.json'));
  assert.ok(plan.syncable.some((item) => item.path === 'ai/llms.md'));
  assert.ok(plan.syncable.some((item) => item.path === 'ai/context.json'));
  assert.ok(plan.syncable.some((item) => item.path === 'ai/agents.json'));
  assert.ok(plan.syncable.some((item) => item.path === '.ai/hub-contract.json'));
});

test('applyScaffoldSyncPlan generated-only sync updates derived files and context refs, but not agents', () => {
  const hubRoot = mkHubRoot();
  const projectRoot = mkProjectRoot();
  const layout = resolveProjectLayout(projectRoot);
  const plan = buildScaffoldSyncPlan(projectRoot, layout, {
    hubRoot,
    includeMergeAware: false,
  });

  const updated = applyScaffoldSyncPlan(projectRoot, plan, {
    mode: 'generated-only',
    backupMergeAware: false,
  });

  assert.ok(updated.includes('.ai/stack-profile.json'));
  assert.ok(updated.includes('ai/llms.md'));
  assert.ok(updated.includes('ai/context.json'));
  assert.ok(updated.includes('.ai/hub-contract.json'));
  assert.ok(!updated.includes('ai/agents.json'));

  const context = JSON.parse(fs.readFileSync(path.join(projectRoot, 'ai', 'context.json'), 'utf8'));
  assert.ok(context.fullFiles.includes('ai/llms.md'));
  assert.ok(context.fullFiles.includes('.ai/stack-profile.json'));
  assert.ok(context.lightFiles.includes('.ai/stack-profile.json'));

  const agents = JSON.parse(fs.readFileSync(path.join(projectRoot, 'ai', 'agents.json'), 'utf8'));
  assert.equal(agents.agents.length, 1);
  assert.equal(agents.agents[0].model, 'project-architect');
});

test('applyScaffoldSyncPlan full-sync preserves project overrides while merging hub defaults', () => {
  const hubRoot = mkHubRoot();
  const projectRoot = mkProjectRoot();
  const layout = resolveProjectLayout(projectRoot);
  const plan = buildScaffoldSyncPlan(projectRoot, layout, {
    hubRoot,
    includeMergeAware: true,
  });

  const updated = applyScaffoldSyncPlan(projectRoot, plan, {
    mode: 'full-sync',
    backupMergeAware: true,
  });

  assert.ok(updated.includes('ai/agents.json'));
  const agents = JSON.parse(fs.readFileSync(path.join(projectRoot, 'ai', 'agents.json'), 'utf8'));
  const architect = agents.agents.find((agent) => agent.name === 'architect');
  const reviewer = agents.agents.find((agent) => agent.name === 'reviewer');
  assert.equal(architect.model, 'project-architect');
  assert.equal(architect.role, 'Architect');
  assert.ok(reviewer);
  assert.equal(reviewer.model, 'hub-reviewer');
});

test('ensureProjectScaffoldUpToDate auto-syncs generated surfaces only', () => {
  const hubRoot = mkHubRoot();
  const projectRoot = mkProjectRoot();
  const layout = resolveProjectLayout(projectRoot);

  const state = ensureProjectScaffoldUpToDate(projectRoot, layout, {
    hubRoot,
    includeMergeAware: false,
  });

  assert.ok(state.updated.includes('.ai/stack-profile.json'));
  assert.ok(state.updated.includes('ai/llms.md'));
  assert.ok(state.updated.includes('ai/context.json'));
  assert.ok(!state.updated.includes('ai/agents.json'));
});
