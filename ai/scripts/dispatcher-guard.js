const DEFAULT_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isEnabled(value) {
  return DEFAULT_TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function enforceDispatcherGuard(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const useCommand = String(options.useCommand || 'npm run undes -- --prompt="..."');
  const exitOnFailure = options.exitOnFailure !== false;

  if (isEnabled(env._AI_DISPATCHER_RESOLVED)) {
    return { ok: true, bypassed: false };
  }

  if (isEnabled(env._AI_DISPATCHER_BYPASS)) {
    logger.error('ERROR: Dispatcher bypass mode is no longer supported.');
  }

  logger.error('ERROR: Direct script invocation is disabled in Hub-only mode.');
  logger.error(`   Use dispatcher: ${useCommand}`);

  if (exitOnFailure) {
    process.exit(1);
  }

  return { ok: false, bypassed: false };
}

module.exports = {
  isEnabled,
  enforceDispatcherGuard,
};
