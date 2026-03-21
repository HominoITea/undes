'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  aggregateResults,
  compareVariants,
  extractListedSymbols,
} = require('../structural-search-ab');

test('extractListedSymbols parses listed symbols and ignores omitted marker', () => {
  const symbols = extractListedSymbols([
    '## CONTEXT PACK',
    '',
    '### Symbols',
    '- saveDraft [method] src/CourseApplicationServiceImpl.java:12-34',
    '- ContractHandler [class] src/handlers/ContractHandler.java:2-80',
    '- ... (5 more symbols omitted)',
    '',
    '### Graph (trimmed)',
  ].join('\n'));

  assert.deepEqual(symbols, [
    {
      label: 'saveDraft [method] src/CourseApplicationServiceImpl.java:12-34',
      key: 'src/CourseApplicationServiceImpl.java:12-34:saveDraft:method',
    },
    {
      label: 'ContractHandler [class] src/handlers/ContractHandler.java:2-80',
      key: 'src/handlers/ContractHandler.java:2-80:ContractHandler:class',
    },
  ]);
});

test('compareVariants reports overlap and delta across A/B variants', () => {
  const comparison = compareVariants(
    {
      backendUsed: 'index',
      fallback: false,
      packUsed: true,
      selectedCount: 2,
      packBytes: 1000,
      structuralSymbols: [
        { key: 'a' },
        { key: 'b' },
      ],
      packSymbols: [
        { key: 'p1' },
        { key: 'p2' },
      ],
    },
    {
      backendUsed: 'ast-grep',
      fallback: false,
      packUsed: true,
      selectedCount: 3,
      packBytes: 1200,
      structuralSymbols: [
        { key: 'a' },
        { key: 'c' },
      ],
      packSymbols: [
        { key: 'p2' },
        { key: 'p3' },
      ],
    }
  );

  assert.deepEqual(comparison, {
    bytesDelta: 200,
    selectedDelta: 1,
    structuralOverlapPct: 33.3,
    packOverlapPct: 33.3,
    sameBackendOutcome: false,
    identicalPackOutcome: false,
  });
});

test('aggregateResults summarizes variant usage and ast fallback rate', () => {
  const aggregate = aggregateResults([
    {
      variants: {
        index: {
          backendUsed: 'index',
          fallback: false,
          packUsed: true,
          selectedCount: 2,
          packBytes: 800,
        },
        'ast-grep': {
          backendUsed: 'index',
          fallback: true,
          packUsed: true,
          selectedCount: 2,
          packBytes: 800,
        },
      },
      comparison: {
        identicalPackOutcome: true,
        bytesDelta: 0,
        selectedDelta: 0,
        structuralOverlapPct: 100,
        packOverlapPct: 100,
      },
    },
    {
      variants: {
        index: {
          backendUsed: 'index',
          fallback: false,
          packUsed: false,
          selectedCount: 0,
          packBytes: 0,
        },
        'ast-grep': {
          backendUsed: 'ast-grep',
          fallback: false,
          packUsed: true,
          selectedCount: 3,
          packBytes: 1200,
        },
      },
      comparison: {
        identicalPackOutcome: false,
        bytesDelta: 1200,
        selectedDelta: 3,
        structuralOverlapPct: 25,
        packOverlapPct: 50,
      },
    },
  ], {
    files: 10,
    bytes: 4000,
    tokens: 1000,
  });

  assert.equal(aggregate.promptsCompared, 2);
  assert.equal(aggregate.variants.index.packUsedCount, 1);
  assert.equal(aggregate.variants['ast-grep'].packUsedCount, 2);
  assert.equal(aggregate.variants['ast-grep'].fallbackCount, 1);
  assert.deepEqual(aggregate.variants['ast-grep'].backendUsage, {
    index: 1,
    'ast-grep': 1,
  });
  assert.equal(aggregate.comparisons.astRequestedButFellBackCount, 1);
  assert.equal(aggregate.comparisons.astActuallyUsedCount, 1);
  assert.equal(aggregate.comparisons.identicalPackOutcomeCount, 1);
  assert.equal(aggregate.comparisons.averageStructuralOverlapPct, 62.5);
  assert.equal(aggregate.comparisons.averagePackOverlapPct, 75);
});
