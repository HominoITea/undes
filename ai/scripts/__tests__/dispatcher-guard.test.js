const test = require('node:test');
const assert = require('node:assert/strict');

const { isEnabled, enforceDispatcherGuard } = require('../dispatcher-guard');

function withExitCapture(run) {
  const originalExit = process.exit;
  process.exit = (code) => {
    const error = new Error(`EXIT:${code}`);
    error.exitCode = code;
    throw error;
  };

  try {
    return run();
  } finally {
    process.exit = originalExit;
  }
}

test('isEnabled recognizes supported truthy values', () => {
  assert.equal(isEnabled('1'), true);
  assert.equal(isEnabled('true'), true);
  assert.equal(isEnabled('YES'), true);
  assert.equal(isEnabled('on'), true);
  assert.equal(isEnabled('0'), false);
  assert.equal(isEnabled('false'), false);
  assert.equal(isEnabled(''), false);
});

test('enforceDispatcherGuard allows when dispatcher flag is set', () => {
  const messages = [];
  const result = enforceDispatcherGuard({
    env: { _AI_DISPATCHER_RESOLVED: '1' },
    exitOnFailure: false,
    logger: {
      warn: (line) => messages.push(`warn:${line}`),
      error: (line) => messages.push(`error:${line}`),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.bypassed, false);
  assert.deepEqual(messages, []);
});

test('enforceDispatcherGuard blocks direct invocation without dispatcher or bypass', () => {
  const errors = [];
  const result = enforceDispatcherGuard({
    env: {},
    exitOnFailure: false,
    useCommand: 'npm run undes -- --prompt="..."',
    logger: {
      warn: () => {},
      error: (line) => errors.push(String(line)),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.bypassed, false);
  assert.ok(errors.some((line) => line.includes('Direct script invocation is disabled')));
  assert.ok(errors.some((line) => line.includes('Use dispatcher')));
  assert.equal(errors.some((line) => line.includes('Emergency bypass')), false);
});

test('enforceDispatcherGuard blocks bypass flag (no longer supported)', () => {
  const errors = [];
  const result = enforceDispatcherGuard({
    env: { _AI_DISPATCHER_BYPASS: '1' },
    exitOnFailure: false,
    useCommand: 'npm run undes -- --prompt="..."',
    logger: {
      warn: () => {},
      error: (line) => errors.push(String(line)),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.bypassed, false);
  assert.ok(errors.some((line) => line.includes('bypass mode is no longer supported')));
  assert.ok(errors.some((line) => line.includes('Use dispatcher')));
  assert.ok(errors.some((line) => line.includes('Direct script invocation is disabled')));
});

test('enforceDispatcherGuard exits by default when blocked', () => {
  const errors = [];
  assert.throws(
    () => withExitCapture(() => enforceDispatcherGuard({
      env: {},
      logger: {
        warn: () => {},
        error: (line) => errors.push(String(line)),
      },
    })),
    (error) => error && error.exitCode === 1,
  );
  assert.ok(errors.some((line) => line.includes('Direct script invocation is disabled')));
});

test('enforceDispatcherGuard emits plain-text warnings/errors without emoji markers', () => {
  const warnings = [];
  const errors = [];

  enforceDispatcherGuard({
    env: {
      _AI_DISPATCHER_BYPASS: '1',
    },
    exitOnFailure: false,
    logger: {
      warn: (line) => warnings.push(String(line)),
      error: (line) => errors.push(String(line)),
    },
  });

  enforceDispatcherGuard({
    env: {},
    exitOnFailure: false,
    logger: {
      warn: (line) => warnings.push(String(line)),
      error: (line) => errors.push(String(line)),
    },
  });

  const combined = warnings.concat(errors).join('\n');
  assert.equal(/[⚠️❌✅]/.test(combined), false);
});
