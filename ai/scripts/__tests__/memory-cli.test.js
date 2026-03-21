const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const memory = require('../memory');
const { isSqliteAvailable } = require('../local-memory');

const TMP_BASE = path.join(__dirname, '..', '..', '..', '.tmp-test-work');

function mkTmpDir(prefix) {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(TMP_BASE, prefix));
}

function withExitCapture(run) {
  const originalExit = process.exit;
  process.exit = (code) => {
    const error = new Error(`EXIT:${code}`);
    error.exitCode = code;
    throw error;
  };

  try {
    return run();
  } finally {
    process.exit = originalExit;
  }
}

test('memory main: invalid --project-path exits with error', () => {
  const root = mkTmpDir('memory-invalid-root-');
  const errors = [];
  const originalError = console.error;
  console.error = (line) => errors.push(String(line));

  try {
    assert.throws(
      () => withExitCapture(() => memory.main(['node', 'memory.js', '--project-path=missing-project'], process.env, root)),
      (error) => error && error.exitCode === 1,
    );
  } finally {
    console.error = originalError;
  }

  assert.ok(errors.some((line) => line.includes('Invalid --project-path')));
});

test('memory: uses memoryWindow fallback for entries and bytes', () => {
  const opts = { entries: null, bytes: null };
  const context = {
    memoryWindow: {
      maxEntries: 2,
      sectionMaxBytes: 120,
    },
  };

  const window = memory.resolveWindowOptions(opts, context);
  assert.equal(window.entries, 2);
  assert.equal(window.bytes, 120);
});

test('memory: invalid --log selection resolves to empty key list', () => {
  const selected = memory.selectLogKeys(['unknown'], {
    plan: { path: 'x' },
    change: { path: 'y' },
  });
  assert.deepEqual(selected, []);
});

test('memory: prefers .ai over ai and respects --ai-dir override', () => {
  const project = mkTmpDir('memory-layout-');
  fs.mkdirSync(path.join(project, '.ai', 'logs'), { recursive: true });
  fs.mkdirSync(path.join(project, 'ai', 'logs'), { recursive: true });

  const defaultRuntime = memory.resolveRuntime([], process.env, project);
  assert.equal(defaultRuntime.aiDirName, '.ai');
  assert.ok(defaultRuntime.aiRoot.endsWith(path.join(project, '.ai')));

  const overrideRuntime = memory.resolveRuntime(['--ai-dir=ai'], process.env, project);
  assert.equal(overrideRuntime.aiDirName, 'ai');
  assert.ok(overrideRuntime.aiRoot.endsWith(path.join(project, 'ai')));
});

test('memory main: accepts unified options object contract', () => {
  const project = mkTmpDir('memory-main-options-');
  fs.mkdirSync(path.join(project, '.ai', 'logs'), { recursive: true });

  assert.doesNotThrow(() => {
    memory.main({
      argv: ['node', 'memory.js', '--help'],
      env: process.env,
      projectPath: project,
      hubRoot: project,
    });
  });
});

test('memory: parseArgs supports search and save actions', () => {
  const search = memory.parseArgs(['node', 'memory.js', '--action=search', '--query=jwt race', '--type=episode']);
  assert.equal(search.action, 'search');
  assert.equal(search.query, 'jwt race');
  assert.equal(search.type, 'episode');

  const save = memory.parseArgs(['node', 'memory.js', '--save', '--type=decision', '--title=Split root', '--content=test', '--tags=layout,paths']);
  assert.equal(save.action, 'save');
  assert.equal(save.type, 'decision');
  assert.equal(save.title, 'Split root');
  assert.deepEqual(save.tags, ['layout', 'paths']);
});

(isSqliteAvailable() ? test : test.skip)('memory main: search action prints typed recall results', () => {
  const project = mkTmpDir('memory-search-action-');
  fs.mkdirSync(path.join(project, '.ai', 'logs'), { recursive: true });

  memory.saveManualMemoryEntry(memory.resolveRuntime([], process.env, project), {
    type: 'fact',
    title: 'Framework',
    content: 'Project uses Next.js 15 with App Router.',
    summary: '',
    tags: ['nextjs'],
    sourceRef: '',
    confidence: null,
  });

  const lines = [];
  const originalLog = console.log;
  console.log = (line = '') => lines.push(String(line));

  try {
    memory.main(['node', 'memory.js', '--action=search', '--query=nextjs', `--project-path=${project}`], process.env, project);
  } finally {
    console.log = originalLog;
  }

  assert.ok(lines.some((line) => line.includes('AI Memory Search')));
  assert.ok(lines.some((line) => line.includes('FACT: Framework')));
});
