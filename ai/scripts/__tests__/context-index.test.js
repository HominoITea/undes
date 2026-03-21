const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root, relPath, content) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function loadContextIndexWithTreeSitter(fakeTreeSitter) {
  const contextIndexPath = require.resolve('../context-index');
  const treeSitterPath = require.resolve('../context-index-treesitter');

  const prevContextIndex = require.cache[contextIndexPath];
  const prevTreeSitter = require.cache[treeSitterPath];

  delete require.cache[contextIndexPath];
  require.cache[treeSitterPath] = {
    id: treeSitterPath,
    filename: treeSitterPath,
    loaded: true,
    exports: fakeTreeSitter,
  };

  const mod = require('../context-index');

  function restore() {
    delete require.cache[contextIndexPath];
    delete require.cache[treeSitterPath];
    if (prevContextIndex) require.cache[contextIndexPath] = prevContextIndex;
    if (prevTreeSitter) require.cache[treeSitterPath] = prevTreeSitter;
  }

  return { mod, restore };
}

test('context-index: ignorePatterns support * and ? wildcards', () => {
  const { mod, restore } = loadContextIndexWithTreeSitter({
    isTreeSitterAvailable() { return false; },
    extractSymbolsAst() { return null; },
    extractEdgesAst() { return []; },
  });

  try {
    const root = mkTmpDir('ctx-index-ignore-');
    writeFile(root, 'src/keep.ts', 'export function keepFn() { return 1; }\n');
    writeFile(root, 'src/skip.test.ts', 'export function skipFn() { return 1; }\n');
    writeFile(root, 'docs/a.ts', 'export function docFn() { return 1; }\n');

    const index = mod.buildCodeIndex({
      rootDir: root,
      files: ['src/keep.ts', 'src/skip.test.ts', 'docs/a.ts'],
      mode: 'regex',
      ignorePatterns: ['*.test.ts', 'docs/?.ts'],
    });

    const names = new Set(index.symbols.map((s) => s.name));
    assert.equal(names.has('keepFn'), true);
    assert.equal(names.has('skipFn'), false);
    assert.equal(names.has('docFn'), false);
    assert.deepEqual(Object.keys(index.byFile).sort(), ['src/keep.ts']);
  } finally {
    restore();
  }
});

test('context-index: incremental reuse uses previous byFile entry when hash/mode match', () => {
  const { mod, restore } = loadContextIndexWithTreeSitter({
    isTreeSitterAvailable() { return false; },
    extractSymbolsAst() { return null; },
    extractEdgesAst() { return []; },
  });

  try {
    const root = mkTmpDir('ctx-index-incr-');
    writeFile(root, 'a.ts', 'export function alpha() { return 1; }\n');

    const first = mod.buildCodeIndex({
      rootDir: root,
      files: ['a.ts'],
      mode: 'regex',
    });

    const second = mod.buildCodeIndex({
      rootDir: root,
      files: ['a.ts'],
      previousIndex: first,
      mode: 'regex',
    });

    assert.equal(second.byFile['a.ts'], first.byFile['a.ts']);
    assert.equal(second.symbols.length, first.symbols.length);
  } finally {
    restore();
  }
});

test('context-index: ast mode de-duplicates import and regex ref edges', () => {
  const { mod, restore } = loadContextIndexWithTreeSitter({
    isTreeSitterAvailable() { return true; },
    extractSymbolsAst(relPath) {
      if (relPath === 'b.ts') {
        return [{
          id: 'b.ts:foo:1',
          name: 'foo',
          type: 'function',
          file: 'b.ts',
          startLine: 1,
          endLine: 1,
          signature: 'export function foo() {}',
        }];
      }
      return [];
    },
    extractEdgesAst(relPath) {
      if (relPath === 'a.ts') {
        return [{ fromFile: 'a.ts', toSymbol: 'foo', kind: 'import' }];
      }
      return [];
    },
  });

  try {
    const root = mkTmpDir('ctx-index-edges-');
    writeFile(root, 'a.ts', 'import { foo } from "./b";\nfoo();\n');
    writeFile(root, 'b.ts', 'export function foo() {}\n');

    const index = mod.buildCodeIndex({
      rootDir: root,
      files: ['a.ts', 'b.ts'],
      mode: 'ast',
    });

    const edges = index.edges.filter((e) => e.fromFile === 'a.ts' && e.toSymbol === 'foo');
    assert.equal(edges.length, 1);
    assert.equal(edges[0].kind, 'import');
  } finally {
    restore();
  }
});

test('context-index: ast mode stores enriched outline and trust metadata per file', () => {
  const { mod, restore } = loadContextIndexWithTreeSitter({
    isTreeSitterAvailable() { return true; },
    extractAstMetadata(relPath) {
      if (relPath !== 'service.ts') return { symbols: [], outline: [], trust: 'exact-ast' };
      return {
        trust: 'exact-ast',
        symbols: [
          {
            id: 'service.ts:OrderService:1',
            name: 'OrderService',
            type: 'class',
            file: 'service.ts',
            startLine: 1,
            endLine: 8,
            signature: 'export class OrderService {',
            container: '<module>',
            containerType: 'module',
            params: [],
            returnType: '',
            visibility: '',
            isAsync: false,
            isStatic: false,
            bodyLines: 7,
            trust: 'exact-ast',
          },
          {
            id: 'service.ts:placeOrder:2',
            name: 'placeOrder',
            type: 'method',
            file: 'service.ts',
            startLine: 2,
            endLine: 6,
            signature: 'async placeOrder() {',
            container: 'OrderService',
            containerType: 'class',
            params: [],
            returnType: '',
            visibility: '',
            isAsync: true,
            isStatic: false,
            bodyLines: 4,
            trust: 'exact-ast',
          },
        ],
        outline: [
          {
            kind: 'class',
            name: 'OrderService',
            range: [1, 8],
            signature: 'export class OrderService {',
            bodyLines: 7,
            trust: 'exact-ast',
            children: [
              {
                kind: 'method',
                name: 'placeOrder',
                range: [2, 6],
                signature: 'async placeOrder() {',
                bodyLines: 4,
                trust: 'exact-ast',
                children: [],
              },
            ],
          },
        ],
      };
    },
    extractSymbolsAst() { return null; },
    extractEdgesAst() { return []; },
    extractCallEdgesAst() { return []; },
  });

  try {
    const root = mkTmpDir('ctx-index-outline-');
    writeFile(root, 'service.ts', 'export class OrderService {}\n');

    const index = mod.buildCodeIndex({
      rootDir: root,
      files: ['service.ts'],
      mode: 'ast',
    });

    assert.equal(index.version, 5);
    assert.equal(index.byFile['service.ts'].trust, 'exact-ast');
    assert.equal(index.byFile['service.ts'].outline[0].name, 'OrderService');
    assert.equal(index.byFile['service.ts'].outline[0].children[0].name, 'placeOrder');
    const method = index.symbols.find((sym) => sym.name === 'placeOrder');
    assert.equal(method.container, 'OrderService');
    assert.equal(method.containerType, 'class');
    assert.deepEqual(method.params, []);
    assert.equal(method.returnType, '');
    assert.equal(method.isAsync, true);
  } finally {
    restore();
  }
});

test('context-index: regex mode still emits flat outline and regex trust labels', () => {
  const { mod, restore } = loadContextIndexWithTreeSitter({
    isTreeSitterAvailable() { return false; },
    extractSymbolsAst() { return null; },
    extractEdgesAst() { return []; },
  });

  try {
    const root = mkTmpDir('ctx-index-regex-outline-');
    writeFile(root, 'main.ts', [
      'export function alpha() {',
      '  return 1;',
      '}',
    ].join('\n'));

    const index = mod.buildCodeIndex({
      rootDir: root,
      files: ['main.ts'],
      mode: 'regex',
    });

    const alpha = index.symbols.find((sym) => sym.name === 'alpha');
    assert.equal(alpha.trust, 'regex-fallback');
    assert.equal(alpha.container, '<module>');
    assert.equal(index.byFile['main.ts'].trust, 'regex-fallback');
    assert.equal(index.byFile['main.ts'].outline[0].name, 'alpha');
    assert.deepEqual(index.byFile['main.ts'].outline[0].children, []);
  } finally {
    restore();
  }
});

test('context-index: ast mode persists bounded callEdges separately from ref/import edges', () => {
  const { mod, restore } = loadContextIndexWithTreeSitter({
    isTreeSitterAvailable() { return true; },
    extractAstMetadata(relPath) {
      if (relPath === 'service.java') {
        return {
          trust: 'exact-ast',
          symbols: [
            {
              id: 'service.java:OrderService:1',
              name: 'OrderService',
              type: 'class',
              file: 'service.java',
              startLine: 1,
              endLine: 9,
              signature: 'class OrderService {',
              container: '<module>',
              containerType: 'module',
              params: [],
              returnType: '',
              visibility: '',
              isAsync: false,
              isStatic: false,
              bodyLines: 8,
              trust: 'exact-ast',
            },
            {
              id: 'service.java:createOrder:2',
              name: 'createOrder',
              type: 'method',
              file: 'service.java',
              startLine: 2,
              endLine: 4,
              signature: 'void createOrder() {',
              container: 'OrderService',
              containerType: 'class',
              params: [],
              returnType: '',
              visibility: '',
              isAsync: false,
              isStatic: false,
              bodyLines: 2,
              trust: 'exact-ast',
            },
            {
              id: 'service.java:validateOrder:6',
              name: 'validateOrder',
              type: 'method',
              file: 'service.java',
              startLine: 6,
              endLine: 8,
              signature: 'void validateOrder() {',
              container: 'OrderService',
              containerType: 'class',
              params: [],
              returnType: '',
              visibility: '',
              isAsync: false,
              isStatic: false,
              bodyLines: 2,
              trust: 'exact-ast',
            },
          ],
          outline: [],
        };
      }
      return { trust: 'exact-ast', symbols: [], outline: [] };
    },
    extractEdgesAst() {
      return [{ fromFile: 'service.java', toSymbol: 'validateOrder', kind: 'ref' }];
    },
    extractCallEdgesAst(relPath) {
      if (relPath !== 'service.java') return [];
      return [
        {
          fromId: 'service.java:createOrder:2',
          fromSymbol: 'createOrder',
          fromFile: 'service.java',
          toId: 'service.java:validateOrder:6',
          toSymbol: 'validateOrder',
          toFile: 'service.java',
          kind: 'call',
          trust: 'approx-ast',
        },
      ];
    },
  });

  try {
    const root = mkTmpDir('ctx-index-call-edges-');
    writeFile(root, 'service.java', 'class OrderService {}\n');

    const index = mod.buildCodeIndex({
      rootDir: root,
      files: ['service.java'],
      mode: 'ast',
    });

    assert.equal(index.version, 5);
    assert.equal(Array.isArray(index.callEdges), true);
    assert.equal(index.callEdges.length, 1);
    assert.equal(index.callEdges[0].kind, 'call');
    assert.equal(index.callEdges[0].trust, 'approx-ast');
    assert.equal(index.edges.length, 1);
  } finally {
    restore();
  }
});

test('context-index: ast fallback warning is emitted once per extension', () => {
  const { mod, restore } = loadContextIndexWithTreeSitter({
    isTreeSitterAvailable() { return true; },
    extractSymbolsAst() { return null; },
    extractEdgesAst() { return []; },
  });

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnings.push(String(msg));

  try {
    const root = mkTmpDir('ctx-index-fallback-');
    writeFile(root, 'one.ts', 'export function one() { return 1; }\n');
    writeFile(root, 'two.ts', 'export function two() { return 2; }\n');

    mod.buildCodeIndex({
      rootDir: root,
      files: ['one.ts', 'two.ts'],
      mode: 'ast',
    });

    const tsWarnings = warnings.filter((line) => line.includes('No AST parser for ".ts" files'));
    assert.equal(tsWarnings.length, 1);
  } finally {
    console.warn = originalWarn;
    restore();
  }
});
