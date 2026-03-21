const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateSpecShape,
  ensureExtList,
  validateLanguageInput,
  buildLanguage,
  addLanguageSpec,
} = require('../language-specs');

function makeLang(id, label, ext, regex = '^ok$') {
  return {
    id,
    label,
    extensions: [ext],
    symbolPatterns: [
      {
        type: 'function',
        regex,
        flags: 'g',
      },
    ],
    ignorePatterns: [],
  };
}

test('language-specs validate: reports invalid regex', () => {
  const errors = validateSpecShape({
    languages: [makeLang('js', 'JavaScript', '.js', '[')],
  });

  assert.ok(errors.some((item) => item.includes('invalid regex')));
});

test('language-specs validate: reports duplicate id and extension', () => {
  const errors = validateSpecShape({
    languages: [
      makeLang('dup', 'Dup A', '.dup'),
      makeLang('dup', 'Dup B', '.other'),
      makeLang('another', 'Another', '.dup'),
    ],
  });

  assert.ok(errors.some((item) => item.includes('duplicated')));
  assert.ok(errors.some((item) => item.includes('duplicates extension')));
});

test('language-specs ensureExtList: normalizes and deduplicates extension list', () => {
  const ext = ensureExtList({ ext: ['rs', '.rs', '  .go  ', ''] });
  assert.deepEqual(ext, ['.rs', '.go']);
});

test('language-specs validateLanguageInput: rejects missing required fields', () => {
  assert.throws(() => validateLanguageInput('', 'Rust', ['.rs']), /--id is required/);
  assert.throws(() => validateLanguageInput('rust', '', ['.rs']), /--label is required/);
  assert.throws(() => validateLanguageInput('rust', 'Rust', []), /At least one --ext=.ext is required/);
});

test('language-specs addLanguageSpec: rejects extension conflict', () => {
  const specs = {
    languages: [makeLang('js', 'JavaScript', '.js')],
  };

  assert.throws(
    () => addLanguageSpec(specs, buildLanguage('ts', 'TypeScript', ['.js'])),
    /already owned by/,
  );
});

test('language-specs addLanguageSpec: writes sorted languages by id', () => {
  const specs = {
    languages: [makeLang('python', 'Python', '.py')],
  };

  addLanguageSpec(specs, buildLanguage('go', 'Go', ['.go']));
  assert.deepEqual(specs.languages.map((lang) => lang.id), ['go', 'python']);
});
