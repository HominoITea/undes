const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDiscussionLog, formatDiscussionEntry, DEFAULT_MAX_DISCUSSION_LOG_BYTES } = require('../domain/discussion-log');

test('buildDiscussionLog formats role/stage blocks', () => {
  const text = buildDiscussionLog([
    { name: 'architect', role: 'Architect', stage: 'proposal', text: 'Use modular design.' },
    { name: 'reviewer', stage: 'critique', text: 'Need more tests.' },
  ]);

  assert.match(text, /## architect \(Architect\) \[proposal\]/);
  assert.match(text, /## reviewer \[critique\]/);
  assert.match(text, /Need more tests\./);
});

test('formatDiscussionEntry renders a single entry', () => {
  const entry = formatDiscussionEntry({ name: 'dev', role: 'Developer', stage: 'proposal', text: 'Hello' });
  assert.equal(entry, '## dev (Developer) [proposal]\nHello\n');
});

test('buildDiscussionLog returns full log when within byte budget', () => {
  const entries = [
    { name: 'a', text: 'short' },
    { name: 'b', text: 'also short' },
  ];
  const text = buildDiscussionLog(entries, { maxBytes: 100_000 });
  assert.ok(!text.includes('truncated'));
  assert.match(text, /## a/);
  assert.match(text, /## b/);
});

test('buildDiscussionLog truncates oldest entries when over byte budget', () => {
  const longText = 'x'.repeat(500);
  const entries = [
    { name: 'old-1', text: longText },
    { name: 'old-2', text: longText },
    { name: 'recent', text: 'important' },
  ];
  // Budget enough for ~1 entry + header
  const text = buildDiscussionLog(entries, { maxBytes: 600 });
  assert.match(text, /truncated/);
  assert.match(text, /## recent/);
  assert.match(text, /important/);
});

test('buildDiscussionLog always keeps at least the last entry', () => {
  const entries = [
    { name: 'only', text: 'x'.repeat(2000) },
  ];
  const text = buildDiscussionLog(entries, { maxBytes: 100 });
  assert.match(text, /## only/);
});

test('DEFAULT_MAX_DISCUSSION_LOG_BYTES is a reasonable default', () => {
  assert.equal(typeof DEFAULT_MAX_DISCUSSION_LOG_BYTES, 'number');
  assert.ok(DEFAULT_MAX_DISCUSSION_LOG_BYTES >= 50_000);
});
