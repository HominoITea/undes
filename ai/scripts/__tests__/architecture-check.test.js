const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const arch = require('../architecture-check');

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

test('architecture-check: loadRules exits on invalid architecture-rules.json', () => {
  const project = mkTmpDir('arch-invalid-rules-');
  const rulesPath = path.join(project, 'ai', 'architecture-rules.json');
  fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
  fs.writeFileSync(rulesPath, '{not-json');

  const errors = [];
  const originalError = console.error;
  console.error = (line) => errors.push(String(line));

  try {
    assert.throws(
      () => withExitCapture(() => arch.loadRules({ targets: [], overrides: {} }, rulesPath)),
      (error) => error && error.exitCode === 1,
    );
  } finally {
    console.error = originalError;
  }

  assert.ok(errors.some((line) => line.includes('Failed to parse')));
});

test('architecture-check: max-lines override is applied and reported by analyze', () => {
  const project = mkTmpDir('arch-max-lines-');
  const filePath = path.join(project, 'mod.rs');
  fs.writeFileSync(filePath, ['fn first() {}', 'fn second() {}', 'fn third() {}'].join('\n'));

  const options = arch.parseArgs(['node', 'arch', '--max-lines=1']);
  const rules = arch.loadRules(options, path.join(project, 'missing-rules.json'));
  const result = arch.analyze({ absPath: filePath, relPath: 'mod.rs' }, rules);

  assert.equal(rules.maxLines, 1);
  assert.ok(result.violations.some((line) => line.includes('line count')));
});

test('architecture-check: detects god-module signal from concerns and function threshold', () => {
  const project = mkTmpDir('arch-god-module-');
  const filePath = path.join(project, 'god.rs');
  fs.writeFileSync(
    filePath,
    [
      'use std::fs;',
      'use reqwest;',
      'fn run() {',
      '  let _ = std::fs::read_to_string("a.txt");',
      '}',
    ].join('\n'),
  );

  const rules = {
    ...arch.DEFAULT_RULES,
    maxConcernBuckets: 1,
    godModuleFunctionThreshold: 1,
  };
  const result = arch.analyze({ absPath: filePath, relPath: 'god.rs' }, rules);

  assert.ok(result.violations.some((line) => line.includes('god-module signal')));
});

test('architecture-check: collectFiles ignores paths from ignorePathParts', () => {
  const project = mkTmpDir('arch-ignore-path-');
  const rulesPath = path.join(project, 'ai', 'architecture-rules.json');
  fs.mkdirSync(path.join(project, 'ai'), { recursive: true });
  fs.mkdirSync(path.join(project, 'src', 'generated'), { recursive: true });

  fs.writeFileSync(
    rulesPath,
    JSON.stringify({
      targets: ['src'],
      extensions: ['.rs'],
      ignoreDirNames: ['.git', 'node_modules', 'target'],
      ignorePathParts: ['/generated/'],
      maxLines: 10,
      maxFunctions: 12,
      maxExports: 8,
      maxImplBlocks: 8,
      maxConcernBuckets: 3,
      godModuleFunctionThreshold: 8,
    }),
  );

  fs.writeFileSync(path.join(project, 'src', 'ok.rs'), 'fn ok() {}\n');
  fs.writeFileSync(path.join(project, 'src', 'generated', 'ignored.rs'), 'fn ignored() {}\n');

  const rules = arch.loadRules({ targets: [], overrides: {} }, rulesPath);
  const files = arch.collectFiles(rules, project);
  const relPaths = files.map((item) => item.relPath);

  assert.deepEqual(relPaths, ['src/ok.rs']);
});

test('architecture-check: main accepts unified options object contract', () => {
  const project = mkTmpDir('arch-main-options-');
  assert.doesNotThrow(() => {
    arch.main({
      argv: ['node', 'architecture-check.js', '--help'],
      env: process.env,
      projectPath: project,
      hubRoot: project,
    });
  });
});
