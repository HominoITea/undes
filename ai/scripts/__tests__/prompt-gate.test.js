const test = require('node:test');
const assert = require('node:assert/strict');

const { scorePrompt, formatGateResult } = require('../prompt-gate');

function makeIndex(symbols) {
  return { symbols };
}

test('scorePrompt returns pass for invalid index shape', () => {
  const result = scorePrompt('fix auth bug', null);
  assert.equal(result.verdict, 'pass');
  assert.equal(result.score, 0);
  assert.equal(result.matchedSymbols, 0);
  assert.equal(result.matchedFiles, 0);
});

test('scorePrompt classifies block/warn/pass by thresholds', () => {
  const index = makeIndex([
    { name: 'foo', signature: 'export function foo()', file: 'src/app.js' },
  ]);

  const blocked = scorePrompt('foo', index, { blockThreshold: 4, warnThreshold: 6 });
  assert.equal(blocked.score, 4);
  assert.equal(blocked.verdict, 'block');

  const warned = scorePrompt('foo', index, { blockThreshold: 2, warnThreshold: 6 });
  assert.equal(warned.score, 4);
  assert.equal(warned.verdict, 'warn');

  const passed = scorePrompt('foo app.js', index, { blockThreshold: 2, warnThreshold: 6 });
  assert.equal(passed.score, 7);
  assert.equal(passed.verdict, 'pass');
  assert.equal(passed.matchedFiles, 1);
});

test('scorePrompt applies RU->EN token translations', () => {
  const index = makeIndex([
    { name: 'addItem', signature: 'function addItem()', file: 'src/items.js' },
  ]);

  const result = scorePrompt('добавь', index, { blockThreshold: 0, warnThreshold: 3 });

  assert.equal(result.translatedCount, 1);
  assert.equal(result.matchedSymbols, 1);
  assert.equal(result.score, 5);
  assert.equal(result.verdict, 'pass');
});

test('formatGateResult includes translation line when present', () => {
  const formatted = formatGateResult({
    score: 8,
    matchedSymbols: 2,
    matchedFiles: 1,
    tokenCount: 3,
    translatedCount: 1,
  });
  assert.match(formatted, /Score: 8/);
  assert.match(formatted, /symbols: 2, files: 1, tokens: 3/);
  assert.match(formatted, /Canonical translations: 1/);
});

test('formatGateResult omits translation line when absent', () => {
  const formatted = formatGateResult({
    score: 4,
    matchedSymbols: 0,
    matchedFiles: 0,
    tokenCount: 2,
    translatedCount: 0,
  });
  assert.match(formatted, /Score: 4/);
  assert.doesNotMatch(formatted, /Canonical translations/);
});
