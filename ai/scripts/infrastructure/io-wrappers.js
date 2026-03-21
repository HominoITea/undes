/**
 * infrastructure/io-wrappers.js — I/O wrappers: context header, secrets redaction,
 * file reading, agents config, prompt reading, runtime args, task ID, result mode.
 * Extracted from generate-context.js (Batch 11, Slice C).
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ── Context header ─────────────────────────────────────────────────

function getContextHeader(projectPath) {
  let projectName = 'PROJECT';

  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) projectName = pkg.name.toUpperCase();
    } catch (e) {
      // Ignore JSON parse errors, use default
    }
  }

  return `# ${projectName} CONTEXT BUNDLE
# Generated: ${new Date().toISOString()}
# Root: ${projectPath}`;
}

// ── Secrets redaction ──────────────────────────────────────────────

/**
 * @param {string} contents
 * @param {object} options
 * @param {boolean} options.redactEnabled
 * @param {function} options.createRedactSecrets — (enabled) => (contents) => string
 */
function redactSecrets(contents, { redactEnabled, createRedactSecrets }) {
  if (!redactEnabled) return contents;
  return createRedactSecrets(true)(contents);
}

// ── File reading ───────────────────────────────────────────────────

/**
 * @param {string} filePath
 * @param {object} options
 * @param {function} options.resolveReadablePath
 * @param {function} options.redactSecrets
 * @param {function} options.readFileBase — core readFile from file-operations
 */
function readFile(filePath, options, { resolveReadablePath, redactSecrets: redact, readFileBase }) {
  return readFileBase(filePath, { ...options, resolveReadablePath, redactSecrets: redact });
}

/**
 * @param {string} filePath
 * @param {number} maxEntries
 * @param {number} maxBytes
 * @param {object} deps
 * @param {function} deps.resolveReadablePath
 * @param {function} deps.redactSecrets
 * @param {function} deps.readAiLogWindowBase — core readAiLogWindow from file-operations
 */
function readAiLogWindow(filePath, maxEntries, maxBytes, { resolveReadablePath, redactSecrets: redact, readAiLogWindowBase }) {
  return readAiLogWindowBase(filePath, maxEntries, maxBytes, { resolveReadablePath, redactSecrets: redact });
}

// ── Agents config ──────────────────────────────────────────────────

/**
 * @param {string} configPath
 * @param {object} deps
 * @param {string} deps.hubAgentsConfigPath
 * @param {function} deps.readJsonIfExists
 * @param {function} deps.mergeAgentsConfig
 * @param {function} deps.validateAgentsConfig
 */
function loadAgentsConfig(configPath, { hubAgentsConfigPath, readJsonIfExists, mergeAgentsConfig, validateAgentsConfig }) {
  try {
    const hubDefaults = readJsonIfExists(hubAgentsConfigPath);
    const projectOverrides = readJsonIfExists(configPath);
    const config = mergeAgentsConfig(hubDefaults, projectOverrides);
    if (!config) return null;
    const errors = validateAgentsConfig(config);
    if (errors.length > 0) {
      console.error('❌ Invalid ai/agents.json:');
      errors.forEach(err => console.error(`   - ${err}`));
      process.exit(1);
    }
    return config;
  } catch (error) {
    throw new Error(`Invalid JSON in ${configPath}: ${error.message}`);
  }
}

// ── Prompt reading ─────────────────────────────────────────────────

/**
 * @param {string} promptPath — default prompt file path
 * @param {string[]} args — CLI args
 */
function readPrompt(promptPath, args) {
  // 1. Try to get prompt from file via CLI arg
  const promptFileArg = args.find(arg => arg.startsWith('--prompt-file='));
  if (promptFileArg) {
    const filePath = promptFileArg.split('=')[1].trim();
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
    console.warn(`⚠️ Warning: Prompt file '${filePath}' not found. Falling back to other methods.`);
  }

  // 2. Try to get prompt from CLI text arg
  const promptArg = args.find(arg => arg.startsWith('--prompt='));
  if (promptArg) {
    return promptArg.split('=')[1].trim();
  }

  // 3. Try positional arg (if not starting with --)
  const positionalArg = args.find(arg => !arg.startsWith('--'));
  if (positionalArg) {
    return positionalArg.trim();
  }

  // 4. Fallback to default prompt file
  if (!fs.existsSync(promptPath)) return '';
  return fs.readFileSync(promptPath, 'utf8').trim();
}

// ── Runtime arg helpers ────────────────────────────────────────────

/**
 * @param {string} flagName — e.g. 'task-id'
 * @param {string[]} args — CLI args
 */
function readRuntimeArgValue(flagName, args) {
  const prefix = `--${flagName}=`;
  const entry = args.find((arg) => String(arg).startsWith(prefix));
  if (!entry) return '';
  return String(entry).slice(prefix.length).trim();
}

/**
 * @param {string} promptText
 * @param {object} deps
 * @param {string[]} deps.args
 * @param {function} deps.sanitizeTaskId
 * @param {function} deps.promptHash — checkpoint.promptHash
 */
function resolveTaskId(promptText, { args, sanitizeTaskId, promptHash }) {
  const explicit = readRuntimeArgValue('task-id', args) || String(process.env.AI_TASK_ID || '').trim();
  const sanitizedExplicit = sanitizeTaskId(explicit);
  if (sanitizedExplicit) return sanitizedExplicit;
  return promptHash(promptText);
}

/**
 * @param {string} discussionsDir
 * @param {string} taskId
 * @param {string} runId
 * @param {function} sanitizeTaskId
 */
function buildTaskDiscussionDir(discussionsDir, taskId, runId, sanitizeTaskId) {
  const safeTaskId = sanitizeTaskId(taskId) || String(runId || '').trim() || 'run';
  return path.join(discussionsDir, safeTaskId, runId);
}

// ── Result mode ────────────────────────────────────────────────────

/**
 * @param {string} resultMode
 * @param {function} normalizeResultModeBase — from final-result-trust
 */
function normalizeResultMode(resultMode, normalizeResultModeBase) {
  return normalizeResultModeBase(resultMode);
}

// ── Factory ────────────────────────────────────────────────────────

/**
 * Creates bound I/O wrappers with injected state.
 * @param {object} deps
 * @param {string[]} deps.args
 * @param {boolean} deps.redactEnabled
 * @param {string} deps.hubAgentsConfigPath
 * @param {function} deps.createRedactSecrets
 * @param {function} deps.readFileBase
 * @param {function} deps.readAiLogWindowBase
 * @param {function} deps.resolveReadablePath
 * @param {function} deps.readJsonIfExists
 * @param {function} deps.mergeAgentsConfig
 * @param {function} deps.validateAgentsConfig
 * @param {function} deps.sanitizeTaskId
 * @param {function} deps.promptHash
 * @param {function} deps.normalizeResultModeBase
 */
function createIOContext(deps) {
  const boundRedact = (contents) => redactSecrets(contents, {
    redactEnabled: deps.redactEnabled,
    createRedactSecrets: deps.createRedactSecrets,
  });

  const boundReadFile = (filePath, options = {}) => readFile(filePath, options, {
    resolveReadablePath: deps.resolveReadablePath,
    redactSecrets: boundRedact,
    readFileBase: deps.readFileBase,
  });

  const boundReadAiLogWindow = (filePath, maxEntries = 10, maxBytes = 15000) => readAiLogWindow(filePath, maxEntries, maxBytes, {
    resolveReadablePath: deps.resolveReadablePath,
    redactSecrets: boundRedact,
    readAiLogWindowBase: deps.readAiLogWindowBase,
  });

  const boundLoadAgentsConfig = (configPath) => loadAgentsConfig(configPath, {
    hubAgentsConfigPath: deps.hubAgentsConfigPath,
    readJsonIfExists: deps.readJsonIfExists,
    mergeAgentsConfig: deps.mergeAgentsConfig,
    validateAgentsConfig: deps.validateAgentsConfig,
  });

  const boundReadPrompt = (promptPath) => readPrompt(promptPath, deps.args);

  const boundReadRuntimeArgValue = (flagName) => readRuntimeArgValue(flagName, deps.args);

  const boundResolveTaskId = (promptText = '') => resolveTaskId(promptText, {
    args: deps.args,
    sanitizeTaskId: deps.sanitizeTaskId,
    promptHash: deps.promptHash,
  });

  const boundBuildTaskDiscussionDir = (discussionsDir, taskId, runId) =>
    buildTaskDiscussionDir(discussionsDir, taskId, runId, deps.sanitizeTaskId);

  const boundNormalizeResultMode = (resultMode = '') =>
    normalizeResultMode(resultMode, deps.normalizeResultModeBase);

  return {
    getContextHeader,
    redactSecrets: boundRedact,
    readFile: boundReadFile,
    readAiLogWindow: boundReadAiLogWindow,
    loadAgentsConfig: boundLoadAgentsConfig,
    readPrompt: boundReadPrompt,
    readRuntimeArgValue: boundReadRuntimeArgValue,
    resolveTaskId: boundResolveTaskId,
    buildTaskDiscussionDir: boundBuildTaskDiscussionDir,
    normalizeResultMode: boundNormalizeResultMode,
  };
}

module.exports = {
  getContextHeader,
  redactSecrets,
  readFile,
  readAiLogWindow,
  loadAgentsConfig,
  readPrompt,
  readRuntimeArgValue,
  resolveTaskId,
  buildTaskDiscussionDir,
  normalizeResultMode,
  createIOContext,
};
