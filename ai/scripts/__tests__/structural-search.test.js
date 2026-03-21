const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  collectStructuralQueryTokens,
  detectAstGrepBinary,
  normalizeStructuralSearchBackend,
  parseAstGrepMatches,
  resolveStructuralSearchConfig,
  resolveAstGrepCommandCandidates,
  runAstGrepSearchCommand,
  searchStructuralSymbols,
} = require('../structural-search');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root, relPath, content) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function makeSym(name, file, startLine = 1, endLine = 10, signature = '') {
  return {
    id: `${file}:${name}:${startLine}`,
    name,
    type: 'function',
    file,
    startLine,
    endLine,
    signature: signature || `function ${name}() {}`,
  };
}

test('normalizeStructuralSearchBackend maps ast-grep aliases', () => {
  assert.equal(normalizeStructuralSearchBackend('sg'), 'ast-grep');
  assert.equal(normalizeStructuralSearchBackend('ast-grep'), 'ast-grep');
  assert.equal(normalizeStructuralSearchBackend('index'), 'index');
});

test('resolveStructuralSearchConfig provides safe defaults', () => {
  const cfg = resolveStructuralSearchConfig({ maxSnippets: 12 });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.backendRequested, 'ast-grep');
  assert.equal(cfg.maxCandidates, 48);
});

test('detectAstGrepBinary ignores non-ast-grep sg command', () => {
  const detected = detectAstGrepBinary({
    commandRunner(command, args) {
      if (command === 'ast-grep' && args[0] === '--version') {
        return { status: 127, stdout: '', stderr: 'not found' };
      }
      if (command === 'sg' && args[0] === '--version') {
        return { status: 1, stdout: '', stderr: 'Cannot open audit interface - aborting.' };
      }
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    },
    timeoutMs: 1000,
    env: process.env,
  });

  assert.equal(detected, null);
});

test('resolveAstGrepCommandCandidates prefers env override and local bundled wrappers', () => {
  const root = mkTmpDir('structural-search-candidates-');
  const binDir = path.join(root, 'node_modules', '.bin');
  const cliDir = path.join(root, 'node_modules', '@ast-grep', 'cli');
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(cliDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'ast-grep'), '');
  fs.writeFileSync(path.join(cliDir, 'ast-grep'), '');

  const candidates = resolveAstGrepCommandCandidates({
    env: { ...process.env, AI_AST_GREP_BIN: '/custom/ast-grep' },
    toolRoot: root,
  });

  assert.deepEqual(candidates.slice(0, 4), [
    '/custom/ast-grep',
    path.join(binDir, 'ast-grep'),
    path.join(cliDir, 'ast-grep'),
    'ast-grep',
  ]);
});

test('detectAstGrepBinary can use bundled local binary path without PATH injection', () => {
  const root = mkTmpDir('structural-search-local-bin-');
  const binDir = path.join(root, 'node_modules', '.bin');
  const localBinary = path.join(binDir, 'ast-grep');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(localBinary, '');

  const detected = detectAstGrepBinary({
    toolRoot: root,
    timeoutMs: 1000,
    env: process.env,
    commandRunner(command, args) {
      if (command === localBinary && args[0] === '--version') {
        return { status: 0, stdout: 'ast-grep 0.41.1\n', stderr: '' };
      }
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    },
  });

  assert.equal(detected, localBinary);
});

test('parseAstGrepMatches parses JSON stream output', () => {
  const root = mkTmpDir('structural-search-parse-');
  const output = [
    JSON.stringify({
      file: 'src/service.ts',
      range: {
        start: { line: 4 },
        end: { line: 8 },
      },
    }),
    JSON.stringify({
      file: path.join(root, 'src/other.ts'),
      range: {
        start: { line: 0 },
        end: { line: 1 },
      },
    }),
  ].join('\n');

  assert.deepEqual(parseAstGrepMatches(output, root), [
    { file: 'src/service.ts', startLine: 5, endLine: 9 },
    { file: 'src/other.ts', startLine: 1, endLine: 2 },
  ]);
});

test('collectStructuralQueryTokens prefers code identifiers from raw prompt text', () => {
  const queryTokens = collectStructuralQueryTokens(
    ['сделай', 'test', 'plan', 'template', 'resolution', 'contract'],
    4,
    {
      promptText: 'Сделай test plan. Focus: AbstractDocumentHandler, orgId, templater.',
      index: {
        symbols: [
          makeSym('AbstractDocumentHandler', 'src/AbstractDocumentHandler.java', 1, 10),
          makeSym('findTemplateOrThrow', 'src/AbstractDocumentHandler.java', 12, 20),
          makeSym('templater', 'src/TemplaterClient.java', 1, 5),
        ],
      },
    }
  );

  assert.deepEqual(queryTokens, [
    'AbstractDocumentHandler',
    'templater',
    'orgId',
    'template',
  ]);
});

test('runAstGrepSearchCommand prefers modern run subcommand and falls back to legacy scan', () => {
  const calls = [];
  const result = runAstGrepSearchCommand(
    (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === 'run') {
        return { status: 2, stdout: '', stderr: 'legacy binary without run support' };
      }
      if (args[0] === 'scan') {
        return { status: 0, stdout: '{"file":"src/service.ts","range":{"start":{"line":0},"end":{"line":1}}}\n', stderr: '' };
      }
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    },
    'ast-grep',
    'approveDocument',
    '/tmp/project',
    process.env,
    1000
  );

  assert.equal(result.status, 0);
  assert.deepEqual(calls, [
    ['ast-grep', 'run', '--pattern', 'approveDocument', '--json=stream', '/tmp/project'],
    ['ast-grep', 'scan', '--pattern', 'approveDocument', '--json=stream', '/tmp/project'],
  ]);
});

test('searchStructuralSymbols falls back to index backend when ast-grep is requested', () => {
  const root = mkTmpDir('structural-search-backend-');
  writeFile(root, 'src/service.js', 'function handleApprovalQueue() { return true; }\n');

  const result = searchStructuralSymbols({
    rootDir: root,
    promptTokens: ['approval', 'queue'],
    index: {
      symbols: [makeSym('handleApprovalQueue', 'src/service.js', 1, 1)],
      edges: [],
    },
    codeIndexConfig: {
      structuralSearchBackend: 'ast-grep',
      maxSnippets: 8,
    },
  });

  assert.equal(result.backendRequested, 'ast-grep');
  assert.equal(result.backendUsed, 'index');
  assert.equal(result.fallback, true);
  assert.equal(result.symbols.length, 1);
});

test('searchStructuralSymbols uses excerpt content to rank symbols', () => {
  const root = mkTmpDir('structural-search-content-');
  writeFile(
    root,
    'src/approval.js',
    [
      'function helper() {',
      '  return true;',
      '}',
      '',
      'function runStep() {',
      '  // approval queue advancement logic',
      '  return moveQueueForward();',
      '}',
      '',
    ].join('\n')
  );

  const result = searchStructuralSymbols({
    rootDir: root,
    promptTokens: ['approval', 'queue', 'advancement'],
    index: {
      symbols: [
        makeSym('helper', 'src/approval.js', 1, 3),
        makeSym('runStep', 'src/approval.js', 5, 8),
      ],
      edges: [],
    },
    codeIndexConfig: {
      maxSnippets: 8,
      snippetContextLines: 0,
      structuralSearchMaxCandidates: 8,
    },
  });

  assert.equal(result.symbols[0].name, 'runStep');
});

test('searchStructuralSymbols uses ast-grep backend when available', () => {
  const root = mkTmpDir('structural-search-ast-grep-');
  writeFile(
    root,
    'src/approval.js',
    [
      'function helper() {',
      '  return true;',
      '}',
      '',
      'function runStep() {',
      '  // approval queue advancement logic',
      '  return moveQueueForward();',
      '}',
      '',
    ].join('\n')
  );

  const result = searchStructuralSymbols({
    rootDir: root,
    promptTokens: ['approval', 'queue', 'advancement'],
    index: {
      symbols: [
        makeSym('helper', 'src/approval.js', 1, 3),
        makeSym('runStep', 'src/approval.js', 5, 8),
      ],
      edges: [],
    },
    codeIndexConfig: {
      structuralSearchBackend: 'ast-grep',
      maxSnippets: 8,
      structuralSearchMaxCandidates: 8,
    },
    commandRunner(command, args) {
      if (command === 'ast-grep' && args[0] === '--version') {
        return { status: 0, stdout: 'ast-grep 0.39.0\n', stderr: '' };
      }
      if (command === 'ast-grep' && args[0] === 'run') {
        return {
          status: 0,
          stdout: `${JSON.stringify({
            file: 'src/approval.js',
            range: { start: { line: 4 }, end: { line: 7 } },
          })}\n`,
          stderr: '',
        };
      }
      if (command === 'sg' && args[0] === '--version') {
        return { status: 1, stdout: '', stderr: 'unexpected sg probe' };
      }
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    },
    env: process.env,
  });

  assert.equal(result.backendRequested, 'ast-grep');
  assert.equal(result.backendUsed, 'ast-grep');
  assert.equal(result.fallback, false);
  assert.equal(result.symbols[0].name, 'runStep');
});
