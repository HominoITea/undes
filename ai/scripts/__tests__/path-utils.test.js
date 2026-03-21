const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  isSameOrSubPath,
  safeJoinProjectData,
  makeProjectId,
  resolveProjectLayout,
  resolveProjectPaths,
  resolveHubRoot,
  canonicalProjectPath,
} = require('../path-utils');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('isSameOrSubPath handles same and nested paths', () => {
  assert.equal(isSameOrSubPath('/a/b', '/a/b'), true);
  assert.equal(isSameOrSubPath('/a/b', '/a/b/c'), true);
  assert.equal(isSameOrSubPath('/a/b', '/a/bc'), false);
});

test('safeJoinProjectData allows paths inside ai root', () => {
  const projectRoot = mkTmpDir('hub-path-');
  const aiRoot = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiRoot, { recursive: true });
  const out = safeJoinProjectData(projectRoot, aiRoot, 'logs/AI_LOG.md');
  assert.equal(out, path.join(aiRoot, 'logs/AI_LOG.md'));
});

test('safeJoinProjectData rejects traversal and absolute path', () => {
  const projectRoot = mkTmpDir('hub-path-');
  const aiRoot = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiRoot, { recursive: true });

  assert.throws(() => safeJoinProjectData(projectRoot, aiRoot, '../../etc/passwd'));
  assert.throws(() => safeJoinProjectData(projectRoot, aiRoot, '/tmp/evil'));
});

test('makeProjectId deterministic and 12 chars', () => {
  const id1 = makeProjectId('/tmp/my-project');
  const id2 = makeProjectId('/tmp/my-project');
  assert.equal(id1, id2);
  assert.equal(id1.length, 12);
});

test('resolveProjectPaths prefers .ai and falls back to ai', () => {
  const root1 = mkTmpDir('hub-path-');
  fs.mkdirSync(path.join(root1, '.ai'), { recursive: true });
  const p1 = resolveProjectPaths(root1);
  assert.equal(p1.aiDataRoot, path.join(root1, '.ai'));

  const root2 = mkTmpDir('hub-path-');
  fs.mkdirSync(path.join(root2, 'ai'), { recursive: true });
  const p2 = resolveProjectPaths(root2);
  assert.equal(p2.aiDataRoot, path.join(root2, 'ai'));
});

test('resolveProjectLayout exposes dual-root shape without changing current .ai behavior', () => {
  const root = mkTmpDir('hub-layout-dotai-');
  fs.mkdirSync(path.join(root, '.ai'), { recursive: true });

  const layout = resolveProjectLayout(root);
  assert.equal(layout.layoutMode, 'dotai-single-root');
  assert.equal(layout.sourceRoot, path.join(root, '.ai'));
  assert.equal(layout.runtimeRoot, path.join(root, '.ai'));
  assert.equal(layout.contextConfigPath, path.join(root, '.ai', 'context.json'));
  assert.equal(layout.logsDir, path.join(root, '.ai', 'logs'));
  assert.equal(layout.bundlePath, path.join(root, '.ai', '.context_bundle.md'));
  assert.equal(layout.resolveIndexPath('.code_index.json'), path.join(root, '.ai', '.code_index.json'));
});

test('resolveProjectLayout falls back to legacy ai/ and supports single-root override', () => {
  const root = mkTmpDir('hub-layout-legacy-');
  fs.mkdirSync(path.join(root, 'ai'), { recursive: true });

  const legacyLayout = resolveProjectLayout(root);
  assert.equal(legacyLayout.layoutMode, 'legacy-single-root');
  assert.equal(legacyLayout.sourceRoot, path.join(root, 'ai'));
  assert.equal(legacyLayout.runtimeRoot, path.join(root, 'ai'));
  assert.equal(legacyLayout.runtimeDirName, 'ai');

  const overrideLayout = resolveProjectLayout(root, { aiDir: 'custom-ai' });
  assert.equal(overrideLayout.layoutMode, 'override-single-root');
  assert.equal(overrideLayout.sourceRoot, path.join(root, 'custom-ai'));
  assert.equal(overrideLayout.runtimeRoot, path.join(root, 'custom-ai'));
  assert.equal(overrideLayout.runtimeDirName, 'custom-ai');
});

test('resolveProjectLayout defaults to split-root when neither ai/ nor .ai/ exists', () => {
  const root = mkTmpDir('hub-layout-empty-');
  const layout = resolveProjectLayout(root);

  assert.equal(layout.layoutMode, 'split-root');
  assert.equal(layout.sourceRoot, path.join(root, 'ai'));
  assert.equal(layout.runtimeRoot, path.join(root, '.ai'));
  assert.equal(layout.contextConfigPath, path.join(root, 'ai', 'context.json'));
  assert.equal(layout.runsDir, path.join(root, '.ai', 'prompts', 'runs'));
  assert.equal(layout.archiveDir, layout.runsDir);
  assert.equal(layout.legacyArchiveDir, path.join(root, '.ai', 'prompts', 'archive'));
  assert.equal(layout.aiDataRoot, path.join(root, '.ai'));
});

test('resolveProjectLayout uses ai/ as source and .ai/ as runtime when both roots exist', () => {
  const root = mkTmpDir('hub-layout-split-');
  fs.mkdirSync(path.join(root, 'ai'), { recursive: true });
  fs.mkdirSync(path.join(root, '.ai'), { recursive: true });

  const layout = resolveProjectLayout(root);

  assert.equal(layout.layoutMode, 'split-root');
  assert.equal(layout.sourceRoot, path.join(root, 'ai'));
  assert.equal(layout.runtimeRoot, path.join(root, '.ai'));
  assert.equal(layout.sourceDirName, 'ai');
  assert.equal(layout.runtimeDirName, '.ai');
  assert.equal(layout.promptPath, path.join(root, '.ai', 'prompts', 'prompt.txt'));
  assert.equal(layout.resultPath, path.join(root, '.ai', 'prompts', 'result.txt'));
  assert.equal(layout.patchSafeResultPath, path.join(root, '.ai', 'prompts', 'patch-safe-result.md'));
  assert.equal(layout.metricsDir, path.join(root, '.ai', 'prompts', 'metrics'));
  assert.equal(layout.runsDir, path.join(root, '.ai', 'prompts', 'runs'));
  assert.equal(layout.discussionsDir, path.join(root, '.ai', 'prompts', 'discussions'));
  assert.equal(layout.memoryDir, path.join(root, '.ai', 'memory'));
  assert.equal(layout.memoryDbPath, path.join(root, '.ai', 'memory', 'memory.db'));
  assert.equal(layout.memoryDecisionsDir, path.join(root, '.ai', 'memory', 'decisions'));
  assert.equal(layout.memoryEpisodesDir, path.join(root, '.ai', 'memory', 'episodes'));
  assert.equal(layout.qualityPath, path.join(root, '.ai', 'prompts', 'metrics', 'quality.json'));
  assert.equal(layout.lastResultHashPath, path.join(root, '.ai', 'prompts', 'metrics', 'last-result-hash.json'));
});

test('safeJoinProjectData rejects NUL byte in path', () => {
  const projectRoot = mkTmpDir('hub-path-');
  const aiRoot = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiRoot, { recursive: true });
  assert.throws(() => safeJoinProjectData(projectRoot, aiRoot, 'logs/evil\0.md'));
});

test('safeJoinProjectData rejects empty relative path', () => {
  const projectRoot = mkTmpDir('hub-path-');
  const aiRoot = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiRoot, { recursive: true });
  assert.throws(() => safeJoinProjectData(projectRoot, aiRoot, ''));
  assert.throws(() => safeJoinProjectData(projectRoot, aiRoot, '   '));
});

test('isSameOrSubPath rejects partial name match', () => {
  assert.equal(isSameOrSubPath('/a/bar', '/a/barbaz'), false);
  assert.equal(isSameOrSubPath('/a/bar', '/a/bar-extra'), false);
});

test('makeProjectId produces different IDs for different paths', () => {
  const id1 = makeProjectId('/tmp/project-a');
  const id2 = makeProjectId('/tmp/project-b');
  assert.notEqual(id1, id2);
});

test('resolveHubRoot prefers --hub-root flag over env and fallback cwd', () => {
  const fromFlag = mkTmpDir('hub-root-flag-');
  const fromEnv = mkTmpDir('hub-root-env-');
  const fallback = mkTmpDir('hub-root-fallback-');
  const prev = process.env.AI_HUB_ROOT;
  process.env.AI_HUB_ROOT = fromEnv;
  try {
    const resolved = resolveHubRoot([`--hub-root=${fromFlag}`], fallback);
    assert.equal(resolved, fs.realpathSync(fromFlag));
  } finally {
    if (prev === undefined) delete process.env.AI_HUB_ROOT;
    else process.env.AI_HUB_ROOT = prev;
  }
});

test('resolveHubRoot uses AI_HUB_ROOT env when flag is absent', () => {
  const fromEnv = mkTmpDir('hub-root-env-only-');
  const fallback = mkTmpDir('hub-root-fallback-only-');
  const prev = process.env.AI_HUB_ROOT;
  process.env.AI_HUB_ROOT = fromEnv;
  try {
    const resolved = resolveHubRoot([], fallback);
    assert.equal(resolved, fs.realpathSync(fromEnv));
  } finally {
    if (prev === undefined) delete process.env.AI_HUB_ROOT;
    else process.env.AI_HUB_ROOT = prev;
  }
});

test('resolveHubRoot throws when target path does not exist', () => {
  const missing = path.join(os.tmpdir(), `missing-hub-root-${Date.now()}-${Math.random()}`);
  assert.throws(() => resolveHubRoot([`--hub-root=${missing}`], '/tmp'), /does not exist/);
});

test('canonicalProjectPath returns canonical real path for valid directory', () => {
  const hubRoot = mkTmpDir('hub-canonical-');
  const projectDir = path.join(hubRoot, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  const resolved = canonicalProjectPath('./project', hubRoot);
  assert.equal(resolved, fs.realpathSync(projectDir));
});

test('canonicalProjectPath throws for missing and non-directory paths', () => {
  const hubRoot = mkTmpDir('hub-canonical-bad-');
  const missing = path.join(hubRoot, 'missing-project');
  const filePath = path.join(hubRoot, 'not-a-dir.txt');
  fs.writeFileSync(filePath, 'x');

  assert.throws(() => canonicalProjectPath(missing, hubRoot), /does not exist/);
  assert.throws(() => canonicalProjectPath(filePath, hubRoot), /not a directory/);
});

test('safeJoinProjectData rejects symlink escape via existing parent link', () => {
  const projectRoot = mkTmpDir('hub-path-symlink-');
  const aiRoot = path.join(projectRoot, '.ai');
  fs.mkdirSync(aiRoot, { recursive: true });

  const outside = mkTmpDir('hub-path-outside-');
  const linkPath = path.join(aiRoot, 'linked-outside');
  fs.symlinkSync(outside, linkPath);

  assert.throws(
    () => safeJoinProjectData(projectRoot, aiRoot, 'linked-outside/leak.txt'),
    /Symlink escape detected/,
  );
});
