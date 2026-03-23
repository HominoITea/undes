const test = require('node:test');
const assert = require('node:assert/strict');

const {
  trimContextForPhase,
  buildCompactContextPack,
} = require('../domain/context-bundle');

test('buildCompactContextPack keeps prompt/level and trims symbols for synthesis', () => {
  const bundle = [
    '## CONTEXT PACK',
    'Prompt: investigate reroute',
    'Level: L2',
    '',
    '### Symbols',
    '- A [function] src/a.ts:1-10',
    '- B [function] src/b.ts:1-10',
    '- C [function] src/c.ts:1-10',
    '- D [function] src/d.ts:1-10',
    '- E [function] src/e.ts:1-10',
    '- F [function] src/f.ts:1-10',
    '- G [function] src/g.ts:1-10',
    '- H [function] src/h.ts:1-10',
    '- I [function] src/i.ts:1-10',
    '',
    '### Graph (trimmed)',
    '- src/a.ts -> B (ref)',
    '',
    '### Relevant Code Fragments',
    '```ts',
    'const x = 1;',
    '```',
    '',
    '## DIRECTORY STRUCTURE',
    'src/a.ts',
  ].join('\n');

  const compact = buildCompactContextPack(bundle);

  assert.match(compact, /## CONTEXT PACK \(COMPACT\)/);
  assert.match(compact, /Prompt: investigate reroute/);
  assert.match(compact, /Level: L2/);
  assert.match(compact, /### Symbols/);
  assert.doesNotMatch(compact, /### Graph \(trimmed\)/);
  assert.doesNotMatch(compact, /```ts/);
  assert.match(compact, /Context pack compressed for synthesis\/revision/);
  assert.match(compact, /\.\.\. \(1 more symbols omitted\)/);
});

test('trimContextForPhase compresses consensus bundle beyond code-fragment trimming', () => {
  const bundle = [
    '## CONTEXT PACK',
    'Prompt: fix route',
    'Level: L2',
    '',
    '### Symbols',
    '- route [function] src/router.ts:10-90',
    '',
    '### Graph (trimmed)',
    '- src/router.ts -> other (call)',
    '',
    '### Relevant Code Fragments',
    '```ts',
    'const code = true;',
    '```',
    '',
    '## DIRECTORY STRUCTURE',
    'src/router.ts',
    'src/other.ts',
    '',
    '## NEXT',
    'payload',
  ].join('\n');

  const trimmed = trimContextForPhase(bundle, 'consensus');

  assert.match(trimmed, /## CONTEXT PACK \(COMPACT\)/);
  assert.match(trimmed, /### Code Context/);
  assert.doesNotMatch(trimmed, /### Graph \(trimmed\)/);
  assert.doesNotMatch(trimmed, /```ts/);
  assert.match(trimmed, /## DIRECTORY STRUCTURE\n_Context omitted for synthesis\/revision to reduce repeated bundle size\._/);
  assert.match(trimmed, /## NEXT/);
});

test('trimContextForPhase keeps critique behavior without compacting full context pack', () => {
  const bundle = [
    '## CONTEXT PACK',
    'Prompt: fix route',
    'Level: L2',
    '',
    '### Symbols',
    '- route [function] src/router.ts:10-90',
    '',
    '### Relevant Code Fragments',
    '```ts',
    'const code = true;',
    '```',
  ].join('\n');

  const trimmed = trimContextForPhase(bundle, 'critique');

  assert.match(trimmed, /## CONTEXT PACK/);
  assert.doesNotMatch(trimmed, /\(COMPACT\)/);
  assert.match(trimmed, /### Code Context/);
  assert.doesNotMatch(trimmed, /```ts/);
});
