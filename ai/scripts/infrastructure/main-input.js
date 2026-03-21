function isObjectLike(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstDefined(valueA, valueB, valueC) {
  if (valueA !== undefined && valueA !== null && valueA !== '') return valueA;
  if (valueB !== undefined && valueB !== null && valueB !== '') return valueB;
  if (valueC !== undefined && valueC !== null && valueC !== '') return valueC;
  return '';
}

function normalizeScriptMainInput(optionsOrArgv = process.argv, legacy = {}) {
  const fallbackArgv = Array.isArray(legacy.argv) ? legacy.argv : process.argv;
  const fallbackEnv = isObjectLike(legacy.env) ? legacy.env : process.env;
  const fallbackProjectPath = firstDefined(legacy.projectPath, legacy.projectRoot, process.cwd());
  const fallbackHubRoot = firstDefined(legacy.hubRoot, '', '');

  if (Array.isArray(optionsOrArgv)) {
    return {
      argv: optionsOrArgv,
      env: fallbackEnv,
      projectPath: fallbackProjectPath,
      hubRoot: fallbackHubRoot,
    };
  }

  if (isObjectLike(optionsOrArgv)) {
    const input = optionsOrArgv;
    return {
      ...input,
      argv: Array.isArray(input.argv) ? input.argv : fallbackArgv,
      env: isObjectLike(input.env) ? input.env : fallbackEnv,
      projectPath: firstDefined(input.projectPath, input.projectRoot, fallbackProjectPath),
      hubRoot: firstDefined(input.hubRoot, fallbackHubRoot, ''),
    };
  }

  return {
    argv: fallbackArgv,
    env: fallbackEnv,
    projectPath: fallbackProjectPath,
    hubRoot: fallbackHubRoot,
  };
}

module.exports = {
  normalizeScriptMainInput,
};
