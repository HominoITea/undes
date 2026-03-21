const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeScriptMainInput } = require('../infrastructure/main-input');

test('normalizeScriptMainInput: keeps legacy array contract with fallback env/projectPath', () => {
  const env = { TEST_ENV: '1' };
  const input = normalizeScriptMainInput(
    ['node', 'script.js', '--help'],
    {
      env,
      projectPath: '/tmp/project-root',
      hubRoot: '/tmp/hub-root',
    },
  );

  assert.deepEqual(input, {
    argv: ['node', 'script.js', '--help'],
    env,
    projectPath: '/tmp/project-root',
    hubRoot: '/tmp/hub-root',
  });
});

test('normalizeScriptMainInput: supports unified object and projectRoot alias while preserving extra fields', () => {
  const input = normalizeScriptMainInput({
    projectRoot: '/tmp/project-root',
    logger: () => {},
  }, {
    argv: ['node', 'script.js'],
    env: { LEGACY: '1' },
  });

  assert.deepEqual(input.argv, ['node', 'script.js']);
  assert.deepEqual(input.env, { LEGACY: '1' });
  assert.equal(input.projectPath, '/tmp/project-root');
  assert.equal(typeof input.logger, 'function');
  assert.equal(input.hubRoot, '');
});
