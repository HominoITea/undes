const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_EVIDENCE_ALTERNATIVE_PATH_LABEL,
  DEFAULT_HARD_SCOPE_EXAMPLES_LABEL,
  DEFAULT_LANGUAGE_PACKS,
  DEFAULT_LOG_SECTION_HEADING_PATTERN,
  DEFAULT_MEMORY_DECISION_HEADING_PATTERN,
  DEFAULT_META_CHATTER_EXAMPLES_LABEL,
  DEFAULT_META_TAIL_PATTERN,
  DEFAULT_STOP_WORDS,
  DEFAULT_TOKEN_PATTERN,
  DEFAULT_TOKEN_TRANSLATIONS,
  resolveLanguagePacks,
} = require('../domain/language-packs/registry');

test('default language packs include english and russian', () => {
  const codes = DEFAULT_LANGUAGE_PACKS.map((pack) => pack.code).sort();
  assert.deepEqual(codes, ['en', 'ru']);
});

test('token lexicon aggregates stop words and canonical translations', () => {
  assert.equal(DEFAULT_STOP_WORDS.has('the'), true);
  assert.equal(DEFAULT_STOP_WORDS.has('если'), true);
  assert.equal(DEFAULT_TOKEN_TRANSLATIONS.get('добавь'), 'add');
  assert.equal(DEFAULT_TOKEN_TRANSLATIONS.get('конфигурации'), 'config');
});

test('default token pattern supports mixed-script prompts and file names', () => {
  const matches = 'Добавь handler for hub.js'
    .toLowerCase()
    .match(DEFAULT_TOKEN_PATTERN);

  assert.ok(matches.includes('добавь'));
  assert.ok(matches.includes('handler'));
  assert.ok(matches.includes('hub.js'));
});

test('memory heading pattern matches english and russian sections', () => {
  assert.equal(DEFAULT_MEMORY_DECISION_HEADING_PATTERN.test('## What to do'), true);
  assert.equal(DEFAULT_MEMORY_DECISION_HEADING_PATTERN.test('Что сделать:'), true);
  assert.equal(DEFAULT_MEMORY_DECISION_HEADING_PATTERN.test('Summary'), false);
});

test('prompt and artifact language-pack helpers stay localized and reusable', () => {
  assert.equal(DEFAULT_EVIDENCE_ALTERNATIVE_PATH_LABEL, 'or/или');
  assert.match(DEFAULT_META_CHATTER_EXAMPLES_LABEL, /If you want, I can provide/);
  assert.match(DEFAULT_META_CHATTER_EXAMPLES_LABEL, /Следующим сообщением могу/);
  assert.match(DEFAULT_HARD_SCOPE_EXAMPLES_LABEL, /`only`, `strictly`, `do not go beyond`, `не лезь дальше`, `анализируй только`/);
  assert.equal(DEFAULT_LOG_SECTION_HEADING_PATTERN.test('\n## Logs\nbody'), true);
  assert.equal(DEFAULT_LOG_SECTION_HEADING_PATTERN.test('\n### Логи\nbody'), true);
  assert.equal(DEFAULT_META_TAIL_PATTERN.test('\nIf you want, I can provide diff.'), true);
  assert.equal(DEFAULT_META_TAIL_PATTERN.test('\nСледующим сообщением могу дать diff.'), true);
});

test('resolveLanguagePacks falls back to defaults for unknown codes', () => {
  const resolved = resolveLanguagePacks(['de']);
  assert.equal(resolved.length, DEFAULT_LANGUAGE_PACKS.length);
});
