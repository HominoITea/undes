const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildContextPack,
  inferContextLevel,
  tokens,
  scoreSymbols,
  fileNameSeeds,
  promptNamedSymbolSeeds,
  translateTokens,
  TOKEN_TRANSLATIONS,
} = require('../context-pack');

function makeIndex(symbols, edges = [], callEdges = []) {
  return { version: 5, mode: 'test', symbols, edges, callEdges, byFile: {} };
}

function makeSym(name, file, startLine = 1, endLine = 10) {
  return {
    id: `${file}:${name}:${startLine}`,
    name,
    type: 'function',
    file,
    startLine,
    endLine,
    signature: `function ${name}() {}`,
  };
}

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root, relPath, content) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

const defaultCfg = {
  maxDepth: 2,
  maxPackBytes: 45000,
  maxGraphEdges: 200,
  maxSnippets: 40,
};

test('inferContextLevel classifies architecture, standard, and deep-analysis prompts', () => {
  assert.equal(inferContextLevel('Give me an architecture overview of the approval module'), 'L0');
  assert.equal(inferContextLevel('Refactor approveDocument method'), 'L1');
  assert.equal(inferContextLevel('Debug stack trace for approval crash in production'), 'L2');
});

test('tokens extracts English and removes stop-words', () => {
  const t = tokens('Fix bug in buildCodeIndex');
  assert.ok(t.includes('buildcodeindex'));
  assert.ok(!t.includes('fix'));
  assert.ok(!t.includes('bug'));
  assert.ok(!t.includes('in'));
});

test('tokens extracts Russian tokens', () => {
  const t = tokens('Добавь обработку ошибок');
  assert.ok(t.includes('добавь'));
  assert.ok(t.includes('обработку'));
  assert.ok(t.includes('ошибок'));
});

test('tokens keeps file names', () => {
  const t = tokens('Refactor hub.js and config-loader.ts');
  assert.ok(t.includes('hub.js'));
  assert.ok(t.includes('config-loader.ts'));
});

test('translateTokens maps Russian domain terms to English', () => {
  const out = translateTokens(['ошибок', 'конфигурации', 'загрузки']);
  assert.ok(out.includes('error'));
  assert.ok(out.includes('config'));
  assert.ok(out.includes('load'));
});

test('translateTokens ignores unknown tokens', () => {
  const out = translateTokens(['неизвестно', 'другое']);
  assert.deepEqual(out, []);
});

test('translateTokens returns [] for empty input', () => {
  assert.deepEqual(translateTokens([]), []);
});

test('TOKEN_TRANSLATIONS stays compact by unique canonical targets', () => {
  const uniqueTargets = new Set(TOKEN_TRANSLATIONS.values());
  assert.ok(uniqueTargets.size <= 60);
});

test('fileNameSeeds matches exact file name', () => {
  const symbols = [
    makeSym('hubList', './src/hub.js'),
    makeSym('utilsLog', './src/utils.js'),
  ];

  const seeds = fileNameSeeds(['hub.js'], symbols);
  assert.equal(seeds.length, 1);
  assert.equal(seeds[0].name, 'hubList');
});

test('fileNameSeeds matches bare module name', () => {
  const symbols = [
    makeSym('loadConfig', './ai/scripts/config-loader.js'),
    makeSym('parseArgs', './ai/scripts/cli.js'),
  ];

  const seeds = fileNameSeeds(['config-loader'], symbols);
  assert.equal(seeds.length, 1);
  assert.equal(seeds[0].name, 'loadConfig');
});

test('fileNameSeeds returns all symbols from matched file', () => {
  const symbols = [
    makeSym('cmdAdd', './hub.js', 1, 10),
    makeSym('cmdList', './hub.js', 20, 30),
    makeSym('other', './other.js', 1, 10),
  ];

  const seeds = fileNameSeeds(['hub.js'], symbols);
  assert.equal(seeds.length, 2);
  assert.ok(seeds.some((s) => s.name === 'cmdAdd'));
  assert.ok(seeds.some((s) => s.name === 'cmdList'));
});

test('fileNameSeeds returns empty when no file token matches', () => {
  const symbols = [makeSym('x', './a.js')];
  const seeds = fileNameSeeds(['nonexistent.py'], symbols);
  assert.equal(seeds.length, 0);
});

test('promptNamedSymbolSeeds matches explicit class and method names from raw prompt text', () => {
  const symbols = [
    makeSym('approveDocument', './src/ApproverFacadeImpl.java'),
    makeSym('moveQueueForward', './src/ApproverFacadeImpl.java'),
    makeSym('helper', './src/OtherService.java'),
  ];

  const seeds = promptNamedSymbolSeeds(
    'Проверь ApproverFacadeImpl и метод moveQueueForward в approve path',
    symbols
  );

  assert.ok(seeds.some((sym) => sym.name === 'approveDocument'));
  assert.ok(seeds.some((sym) => sym.name === 'moveQueueForward'));
  assert.equal(seeds.some((sym) => sym.name === 'helper'), false);
});

test('scoreSymbols scores exact match highest', () => {
  const symbols = [makeSym('buildCodeIndex', './context-index.js')];
  const scored = scoreSymbols(['buildcodeindex'], symbols);
  assert.equal(scored[0].score, 10);
});

test('scoreSymbols scores substring match', () => {
  const symbols = [makeSym('extractSymbols', './context-index.js')];
  const scored = scoreSymbols(['symbols'], symbols);
  assert.equal(scored[0].score, 4);
});

test('scoreSymbols scores file-path match', () => {
  const symbols = [makeSym('x', './context-pack.js')];
  const scored = scoreSymbols(['context-pack.js'], symbols);
  assert.equal(scored[0].score, 1);
});

test('scoreSymbols returns zero for no match', () => {
  const symbols = [makeSym('x', './a.js')];
  const scored = scoreSymbols(['zzzzz'], symbols);
  assert.equal(scored[0].score, 0);
});

test('integration: Russian prompt matches via translation', () => {
  const symbols = [
    makeSym('loadConfig', './config.js'),
    makeSym('handleError', './errors.js'),
    makeSym('validateInput', './validate.js'),
  ];

  const pack = buildContextPack({
    rootDir: '/tmp',
    promptText: 'Добавь обработку ошибок в модуль загрузки конфигурации',
    index: makeIndex(symbols),
    cfg: defaultCfg,
    redactSecrets: null,
  });

  assert.equal(pack.used, true);
  assert.ok(pack.selectedCount > 0);
});

test('integration: file reference selects all symbols from that file', () => {
  const symbols = [
    makeSym('commandList', './hub.js', 10, 20),
    makeSym('commandAdd', './hub.js', 30, 40),
    makeSym('commandGc', './hub.js', 50, 60),
    makeSym('unrelatedFn', './other.js', 1, 10),
  ];

  const pack = buildContextPack({
    rootDir: '/tmp',
    promptText: 'Add new command to hub.js for project archiving',
    index: makeIndex(symbols),
    cfg: defaultCfg,
    redactSecrets: null,
  });

  assert.equal(pack.used, true);
  assert.ok(pack.selectedCount >= 3);
});

test('integration: mixed RU prompt + file name resolves generate-context symbols', () => {
  const symbols = [
    makeSym('runAgents', './generate-context.js', 100, 180),
    makeSym('callAgent', './generate-context.js', 190, 240),
    makeSym('unrelated', './other.js', 1, 10),
  ];

  const pack = buildContextPack({
    rootDir: '/tmp',
    promptText: 'Исправь баг: generate-context падает если agents.json пустой',
    index: makeIndex(symbols),
    cfg: defaultCfg,
    redactSecrets: null,
  });

  assert.equal(pack.used, true);
  assert.ok(pack.selectedCount >= 2);
});

test('integration: structural search lifts content-relevant symbol into context pack', () => {
  const root = mkTmpDir('ctx-pack-structural-');
  writeFile(
    root,
    'src/approval.js',
    [
      'function helper() {',
      '  return true;',
      '}',
      '',
      'function processThing() {',
      '  // approval queue advancement logic',
      '  return moveQueueForward();',
      '}',
      '',
    ].join('\n')
  );

  const symbols = [
    makeSym('helper', 'src/approval.js', 1, 3),
    makeSym('processThing', 'src/approval.js', 5, 8),
  ];

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Найди проблему в approval queue advancement',
    index: makeIndex(symbols),
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchMaxCandidates: 8,
      smallFileLines: 1,
    },
    redactSecrets: null,
  });

  assert.equal(pack.used, true);
  assert.equal(pack.structuralSearch.backendRequested, 'ast-grep');
  assert.ok(['ast-grep', 'index'].includes(pack.structuralSearch.backendUsed));
  assert.match(pack.markdown, /Context Skeleton/);
  assert.match(pack.markdown, /function processThing/);
});

test('integration: context skeleton omits unselected method bodies including one-line methods', () => {
  const root = mkTmpDir('ctx-pack-skeleton-omit-');
  writeFile(
    root,
    'src/sample.js',
    [
      'function keep() {',
      '  return 1;',
      '}',
      '',
      'function leak() { return 2; }',
      '',
      'function selected() {',
      '  return doWork();',
      '}',
      '',
    ].join('\n')
  );

  const symbols = [
    makeSym('keep', 'src/sample.js', 1, 3),
    makeSym('leak', 'src/sample.js', 5, 5),
    makeSym('selected', 'src/sample.js', 7, 9),
  ];

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'selected doWork',
    index: makeIndex(symbols),
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
      smallFileLines: 1,
    },
    redactSecrets: null,
  });

  assert.equal(pack.used, true);
  assert.match(pack.markdown, /Context Skeleton/);
  assert.doesNotMatch(pack.markdown, /return 1;/);
  assert.doesNotMatch(pack.markdown, /return 2;/);
  assert.match(pack.markdown, /return doWork\(\);/);
});

test('integration: context skeleton auto-includes implemented interface signatures', () => {
  const root = mkTmpDir('ctx-pack-interface-signature-');
  writeFile(
    root,
    'src/Strategy.java',
    [
      'public interface Strategy {',
      '  ApprovalInstance create(ApprovalSetting setting);',
      '}',
    ].join('\n')
  );
  writeFile(
    root,
    'src/Impl.java',
    [
      'import x.y.Strategy;',
      'public class Impl implements Strategy {',
      '  private final Repo repo;',
      '  public Impl(Repo repo) { this.repo = repo; }',
      '  public ApprovalInstance approveDocument() {',
      '    return repo.load();',
      '  }',
      '}',
    ].join('\n')
  );

  const symbols = [
    { id: 's1', name: 'Strategy', type: 'interface', file: 'src/Strategy.java', startLine: 1, endLine: 3, signature: 'interface Strategy' },
    { id: 's2', name: 'Impl', type: 'class', file: 'src/Impl.java', startLine: 2, endLine: 8, signature: 'class Impl implements Strategy' },
    { id: 's3', name: 'approveDocument', type: 'method', file: 'src/Impl.java', startLine: 5, endLine: 7, signature: 'approveDocument' },
  ];
  const edges = [
    { fromFile: 'src/Impl.java', toSymbol: 'Strategy', kind: 'import' },
  ];

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'approveDocument mapping',
    index: makeIndex(symbols, edges),
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
      smallFileLines: 1,
    },
    redactSecrets: null,
  });

  assert.equal(pack.used, true);
  assert.match(pack.markdown, /Implemented Interface Signatures/);
  assert.match(pack.markdown, /ApprovalInstance create\(ApprovalSetting setting\);/);
});

test('integration: explicit prompt-named seam is pinned into context pack despite index-order noise', () => {
  const root = mkTmpDir('ctx-pack-prompt-pin-');
  writeFile(root, 'src/approval-setting.js', 'function create() {}\nfunction update() {}\nfunction deleteSetting() {}\n');
  writeFile(root, 'src/ApproverFacadeImpl.java', 'void moveQueueForward() {}\n');

  const symbols = [
    makeSym('approvalSettingController', 'src/approval-setting.js', 1, 1),
    makeSym('create', 'src/approval-setting.js', 1, 1),
    makeSym('update', 'src/approval-setting.js', 2, 2),
    makeSym('deleteSetting', 'src/approval-setting.js', 3, 3),
    makeSym('moveQueueForward', 'src/ApproverFacadeImpl.java', 1, 1),
  ];

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Проверь approval create update delete и метод moveQueueForward в ApproverFacadeImpl',
    index: makeIndex(symbols),
    cfg: {
      ...defaultCfg,
      maxSnippets: 2,
      maxListedSymbols: 2,
      snippetContextLines: 0,
    },
    redactSecrets: null,
  });

  assert.equal(pack.used, true);
  assert.match(pack.markdown, /moveQueueForward/);
});

test('integration: L0 uses outline-only rendering for large files and stays compact', () => {
  const root = mkTmpDir('ctx-pack-l0-outline-');
  const largeLines = [];
  largeLines.push('export class ApprovalFlow {');
  for (let i = 1; i <= 210; i += 1) {
    largeLines.push(`  // line ${i}`);
  }
  largeLines.push('  approve() {');
  largeLines.push('    return this.repo.save();');
  largeLines.push('  }');
  largeLines.push('}');
  writeFile(root, 'src/approval-flow.ts', largeLines.join('\n'));

  const symbols = [
    {
      id: 'cls',
      name: 'ApprovalFlow',
      type: 'class',
      file: 'src/approval-flow.ts',
      startLine: 1,
      endLine: 215,
      signature: 'export class ApprovalFlow {',
      container: '<module>',
      containerType: 'module',
      bodyLines: 214,
      trust: 'exact-ast',
    },
    {
      id: 'm1',
      name: 'approve',
      type: 'method',
      file: 'src/approval-flow.ts',
      startLine: 212,
      endLine: 214,
      signature: 'approve() {',
      container: 'ApprovalFlow',
      containerType: 'class',
      bodyLines: 2,
      trust: 'exact-ast',
    },
  ];
  const index = makeIndex(symbols);
  index.byFile['src/approval-flow.ts'] = {
    outline: [
      {
        kind: 'class',
        name: 'ApprovalFlow',
        range: [1, 215],
        signature: 'export class ApprovalFlow {',
        bodyLines: 214,
        trust: 'exact-ast',
        children: [
          {
            kind: 'method',
            name: 'approve',
            range: [212, 214],
            signature: 'approve() {',
            bodyLines: 2,
            trust: 'exact-ast',
            children: [],
          },
        ],
      },
    ],
  };

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Architecture overview for approval flow',
    index,
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
    },
    redactSecrets: null,
  });

  const fullBytes = Buffer.byteLength(fs.readFileSync(path.join(root, 'src/approval-flow.ts'), 'utf8'), 'utf8');
  const packBytes = Buffer.byteLength(pack.markdown, 'utf8');

  assert.equal(pack.levelUsed, 'L0');
  assert.match(pack.markdown, /L0 Outline/);
  assert.doesNotMatch(pack.markdown, /return this\.repo\.save/);
  assert.ok(packBytes <= fullBytes * 0.15);
});

test('integration: L1 includes target bodies but remains well below full-file size for large files', () => {
  const root = mkTmpDir('ctx-pack-l1-target-');
  const lines = [];
  for (let i = 1; i <= 220; i += 1) {
    if (i === 1) lines.push('export class ApprovalFlow {');
    else if (i === 80) lines.push('  approveDocument() {');
    else if (i === 81) lines.push('    return moveQueueForward();');
    else if (i === 82) lines.push('  }');
    else if (i === 120) lines.push('  helper() {');
    else if (i === 121) lines.push('    return 1;');
    else if (i === 122) lines.push('  }');
    else if (i === 220) lines.push('}');
    else lines.push(`  // filler ${i}`);
  }
  writeFile(root, 'src/approval-flow.ts', lines.join('\n'));

  const symbols = [
    {
      id: 'cls',
      name: 'ApprovalFlow',
      type: 'class',
      file: 'src/approval-flow.ts',
      startLine: 1,
      endLine: 220,
      signature: 'export class ApprovalFlow {',
      container: '<module>',
      containerType: 'module',
      bodyLines: 219,
      trust: 'exact-ast',
    },
    {
      id: 'approve',
      name: 'approveDocument',
      type: 'method',
      file: 'src/approval-flow.ts',
      startLine: 80,
      endLine: 82,
      signature: 'approveDocument() {',
      container: 'ApprovalFlow',
      containerType: 'class',
      bodyLines: 2,
      trust: 'exact-ast',
    },
    {
      id: 'helper',
      name: 'helper',
      type: 'method',
      file: 'src/approval-flow.ts',
      startLine: 120,
      endLine: 122,
      signature: 'helper() {',
      container: 'ApprovalFlow',
      containerType: 'class',
      bodyLines: 2,
      trust: 'exact-ast',
    },
  ];
  const index = makeIndex(symbols);
  index.byFile['src/approval-flow.ts'] = {
    outline: [
      {
        kind: 'class',
        name: 'ApprovalFlow',
        range: [1, 220],
        signature: 'export class ApprovalFlow {',
        bodyLines: 219,
        trust: 'exact-ast',
        children: [
          { kind: 'method', name: 'approveDocument', range: [80, 82], signature: 'approveDocument() {', bodyLines: 2, trust: 'exact-ast', children: [] },
          { kind: 'method', name: 'helper', range: [120, 122], signature: 'helper() {', bodyLines: 2, trust: 'exact-ast', children: [] },
        ],
      },
    ],
  };

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Refactor approveDocument and approval flow',
    index,
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
    },
    redactSecrets: null,
  });

  const fullBytes = Buffer.byteLength(fs.readFileSync(path.join(root, 'src/approval-flow.ts'), 'utf8'), 'utf8');
  const packBytes = Buffer.byteLength(pack.markdown, 'utf8');

  assert.equal(pack.levelUsed, 'L1');
  assert.match(pack.markdown, /L1 Context Skeleton/);
  assert.match(pack.markdown, /moveQueueForward/);
  assert.ok(packBytes <= fullBytes * 0.4);
});

test('integration: L2 adds dependency bodies for deep-analysis prompts', () => {
  const root = mkTmpDir('ctx-pack-l2-deps-');
  writeFile(
    root,
    'src/service.ts',
    [
      'export function failingFlow() {',
      '  return validateOrder();',
      '}',
    ].join('\n')
  );
  writeFile(
    root,
    'src/validators.ts',
    [
      'export function validateOrder() {',
      '  throw new Error("boom");',
      '}',
    ].join('\n')
  );

  const symbols = [
    {
      id: 's1',
      name: 'failingFlow',
      type: 'function',
      file: 'src/service.ts',
      startLine: 1,
      endLine: 3,
      signature: 'export function failingFlow() {',
      container: '<module>',
      containerType: 'module',
      bodyLines: 2,
      trust: 'exact-ast',
    },
    {
      id: 's2',
      name: 'validateOrder',
      type: 'function',
      file: 'src/validators.ts',
      startLine: 1,
      endLine: 3,
      signature: 'export function validateOrder() {',
      container: '<module>',
      containerType: 'module',
      bodyLines: 2,
      trust: 'exact-ast',
    },
  ];
  const edges = [
    { fromFile: 'src/service.ts', toSymbol: 'validateOrder', kind: 'ref' },
  ];
  const index = makeIndex(symbols, edges);

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Debug stack trace for failingFlow crash in service',
    index,
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
      smallFileLines: 2,
    },
    redactSecrets: null,
  });

  assert.equal(pack.levelUsed, 'L2');
  assert.match(pack.markdown, /L2 Dependency Body: validateOrder/);
  assert.match(pack.markdown, /throw new Error/);
});

test('integration: L2 adds dependency bodies from guarded callEdges when the target resolves uniquely', () => {
  const root = mkTmpDir('ctx-pack-l2-call-edges-');
  writeFile(
    root,
    'src/Service.java',
    [
      'class Service {',
      '  void process() {',
      '    validateOrder();',
      '  }',
      '',
      '  void validateOrder() {',
      '    throw new IllegalStateException("boom");',
      '  }',
      '}',
    ].join('\n')
  );

  const symbols = [
    {
      id: 'svc',
      name: 'Service',
      type: 'class',
      file: 'src/Service.java',
      startLine: 1,
      endLine: 8,
      signature: 'class Service {',
      container: '<module>',
      containerType: 'module',
      bodyLines: 7,
      trust: 'exact-ast',
    },
    {
      id: 'process',
      name: 'process',
      type: 'method',
      file: 'src/Service.java',
      startLine: 2,
      endLine: 4,
      signature: 'void process() {',
      container: 'Service',
      containerType: 'class',
      bodyLines: 2,
      trust: 'exact-ast',
    },
    {
      id: 'validate',
      name: 'validateOrder',
      type: 'method',
      file: 'src/Service.java',
      startLine: 6,
      endLine: 8,
      signature: 'void validateOrder() {',
      container: 'Service',
      containerType: 'class',
      bodyLines: 2,
      trust: 'exact-ast',
    },
  ];
  const callEdges = [
    {
      fromId: 'process',
      fromSymbol: 'process',
      fromFile: 'src/Service.java',
      toId: 'validate',
      toSymbol: 'validateOrder',
      toFile: 'src/Service.java',
      kind: 'call',
      trust: 'approx-ast',
    },
  ];

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Debug stack trace for process failure',
    index: makeIndex(symbols, [], callEdges),
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
      smallFileLines: 2,
    },
    redactSecrets: null,
  });

  assert.equal(pack.levelUsed, 'L2');
  assert.match(pack.markdown, /L2 Dependency Body: validateOrder/);
  assert.match(pack.markdown, /IllegalStateException/);
});

test('integration: L2 prefers precise callEdges over broad ref dependencies when both exist', () => {
  const root = mkTmpDir('ctx-pack-l2-call-priority-');
  writeFile(
    root,
    'src/Service.java',
    [
      'class Service {',
      '  void process() {',
      '    validateOrder();',
      '    helperRef();',
      '  }',
      '',
      '  void validateOrder() {',
      '    throw new IllegalStateException("boom");',
      '  }',
      '}',
    ].join('\n')
  );
  writeFile(
    root,
    'src/Noise.java',
    [
      'class Noise {',
      '  void helperRef() {',
      '    throw new RuntimeException("noise");',
      '  }',
      '}',
    ].join('\n')
  );

  const symbols = [
    {
      id: 'svc',
      name: 'Service',
      type: 'class',
      file: 'src/Service.java',
      startLine: 1,
      endLine: 10,
      signature: 'class Service {',
      container: '<module>',
      containerType: 'module',
      bodyLines: 9,
      trust: 'exact-ast',
    },
    {
      id: 'process',
      name: 'process',
      type: 'method',
      file: 'src/Service.java',
      startLine: 2,
      endLine: 5,
      signature: 'void process() {',
      container: 'Service',
      containerType: 'class',
      bodyLines: 3,
      trust: 'exact-ast',
    },
    {
      id: 'validate',
      name: 'validateOrder',
      type: 'method',
      file: 'src/Service.java',
      startLine: 7,
      endLine: 9,
      signature: 'void validateOrder() {',
      container: 'Service',
      containerType: 'class',
      bodyLines: 2,
      trust: 'exact-ast',
    },
    {
      id: 'noise',
      name: 'helperRef',
      type: 'method',
      file: 'src/Noise.java',
      startLine: 2,
      endLine: 4,
      signature: 'void helperRef() {',
      container: 'Noise',
      containerType: 'class',
      bodyLines: 2,
      trust: 'exact-ast',
    },
  ];
  const edges = [
    { fromFile: 'src/Service.java', toSymbol: 'helperRef', kind: 'ref' },
  ];
  const callEdges = [
    {
      fromId: 'process',
      fromSymbol: 'process',
      fromFile: 'src/Service.java',
      toId: 'validate',
      toSymbol: 'validateOrder',
      toFile: 'src/Service.java',
      kind: 'call',
      trust: 'approx-ast',
    },
  ];

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Debug stack trace for process failure',
    index: makeIndex(symbols, edges, callEdges),
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
      smallFileLines: 2,
    },
    redactSecrets: null,
  });

  assert.equal(pack.levelUsed, 'L2');
  assert.match(pack.markdown, /L2 Dependency Body: validateOrder/);
  assert.doesNotMatch(pack.markdown, /L2 Dependency Body: helperRef/);
  assert.doesNotMatch(pack.markdown, /RuntimeException\("noise"\)/);
});

test('integration: small-file heuristic includes full file even for non-L2 packs', () => {
  const root = mkTmpDir('ctx-pack-small-file-');
  writeFile(
    root,
    'src/small.ts',
    [
      'export function quickFix() {',
      '  return 42;',
      '}',
    ].join('\n')
  );

  const symbols = [
    {
      id: 'q1',
      name: 'quickFix',
      type: 'function',
      file: 'src/small.ts',
      startLine: 1,
      endLine: 3,
      signature: 'export function quickFix() {',
      container: '<module>',
      containerType: 'module',
      bodyLines: 2,
      trust: 'exact-ast',
    },
  ];

  const pack = buildContextPack({
    rootDir: root,
    promptText: 'Refactor quickFix',
    index: makeIndex(symbols),
    cfg: {
      ...defaultCfg,
      snippetContextLines: 0,
      structuralSearchBackend: 'index',
    },
    redactSecrets: null,
  });

  assert.equal(pack.levelUsed, 'L1');
  assert.match(pack.markdown, /small-file heuristic/);
  assert.match(pack.markdown, /return 42/);
});
