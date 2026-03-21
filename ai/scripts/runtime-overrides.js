const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SAFE_RUNTIME_OVERRIDE_AGENT_KEYS = new Set(['maxOutputTokens']);
const RESTART_REQUIRED_RUNTIME_OVERRIDE_KEYS = new Set([
  'contextMode',
  'contextPack',
  'noTree',
  'maxFiles',
  'packedTreeLimit',
  'phaseToggles',
  'modelRouting',
  'providerRouting',
]);
const SAFE_RUNTIME_OVERRIDE_PHASE_KEYS = new Set([
  'pre-process',
  'proposal',
  'critique',
  'consensus',
  'approval',
  'revision',
  'devil-advocate',
  'da-revision',
  'post-process',
]);

function createRuntimeOverridesState() {
  return {
    safe: {
      agents: {},
      pauseBeforePhases: {},
    },
    filePresent: false,
    sourcePath: '',
    signature: '',
    lastWarningSignature: '',
  };
}

const runtimeOverridesState = createRuntimeOverridesState();

function getRuntimeOverridesState() {
  return runtimeOverridesState;
}

function getRuntimeOverridesSafeConfig() {
  return runtimeOverridesState.safe;
}

function resetRuntimeOverridesState() {
  Object.assign(runtimeOverridesState, createRuntimeOverridesState());
}

function normalizeForecastStage(stage = 'unknown') {
  let normalized = String(stage || 'unknown').toLowerCase();
  if (normalized.startsWith('approval-')) return 'approval';
  normalized = normalized.replace(/-(retry|repair|tool-budget-final)$/, '');
  return normalized;
}

function normalizeRuntimeOverridePhase(phase = 'unknown') {
  const normalized = normalizeForecastStage(phase);
  if (normalized === 'devil-advocate') return 'devil-advocate';
  if (normalized === 'post-process') return 'post-process';
  if (normalized === 'pre-process') return 'pre-process';
  if (normalized === 'test' || normalized === 'tests' || normalized === 'tester') return 'post-process';
  return normalized;
}

function parseRuntimeOverridesDocument(rawDocument) {
  const doc = rawDocument && typeof rawDocument === 'object' ? rawDocument : {};
  const safe = {
    agents: {},
    pauseBeforePhases: {},
  };
  const restartRequired = [];
  const ignored = [];

  for (const key of Object.keys(doc)) {
    if (key === 'version' || key === 'agents' || key === 'pauseBeforePhases') continue;
    if (RESTART_REQUIRED_RUNTIME_OVERRIDE_KEYS.has(key)) {
      restartRequired.push(key);
    } else {
      ignored.push(key);
    }
  }

  const agentOverrides = doc.agents && typeof doc.agents === 'object' && !Array.isArray(doc.agents)
    ? doc.agents
    : {};
  for (const [agentName, agentConfig] of Object.entries(agentOverrides)) {
    if (!agentConfig || typeof agentConfig !== 'object' || Array.isArray(agentConfig)) {
      ignored.push(`agents.${agentName}`);
      continue;
    }
    const normalizedAgent = String(agentName || '').trim().toLowerCase();
    if (!normalizedAgent) continue;

    const safeAgent = {};
    for (const [key, value] of Object.entries(agentConfig)) {
      if (SAFE_RUNTIME_OVERRIDE_AGENT_KEYS.has(key)) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 128) {
          safeAgent.maxOutputTokens = Math.floor(parsed);
        } else {
          ignored.push(`agents.${agentName}.${key}`);
        }
        continue;
      }
      if (key === 'contextBudget' || key === 'debatePhases') {
        restartRequired.push(`agents.${agentName}.${key}`);
      } else {
        ignored.push(`agents.${agentName}.${key}`);
      }
    }

    if (Object.keys(safeAgent).length > 0) {
      safe.agents[normalizedAgent] = safeAgent;
    }
  }

  const pauseBeforePhases = doc.pauseBeforePhases && typeof doc.pauseBeforePhases === 'object' && !Array.isArray(doc.pauseBeforePhases)
    ? doc.pauseBeforePhases
    : {};
  for (const [phaseName, value] of Object.entries(pauseBeforePhases)) {
    const normalizedPhase = normalizeRuntimeOverridePhase(phaseName);
    if (!SAFE_RUNTIME_OVERRIDE_PHASE_KEYS.has(normalizedPhase)) {
      ignored.push(`pauseBeforePhases.${phaseName}`);
      continue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      ignored.push(`pauseBeforePhases.${phaseName}`);
      continue;
    }
    safe.pauseBeforePhases[normalizedPhase] = Math.floor(parsed);
  }

  return {
    version: doc.version === undefined ? 1 : doc.version,
    safe,
    restartRequired,
    ignored,
  };
}

function summarizeRuntimeOverridesSafeConfig(safeConfig = {}) {
  const parts = [];
  const agents = safeConfig.agents || {};
  for (const [agentName, config] of Object.entries(agents)) {
    if (Number.isFinite(config.maxOutputTokens)) {
      parts.push(`${agentName}.maxOutputTokens=${config.maxOutputTokens}`);
    }
  }
  const phases = safeConfig.pauseBeforePhases || {};
  for (const [phaseName, seconds] of Object.entries(phases)) {
    if (Number.isFinite(seconds) && seconds > 0) {
      parts.push(`pauseBeforePhases.${phaseName}=${seconds}s`);
    }
  }
  return parts;
}

function getRuntimeOverrideMaxOutputTokens(agent, safeConfig = runtimeOverridesState.safe) {
  const normalizedAgent = String(agent?.name || '').trim().toLowerCase();
  if (!normalizedAgent) return null;
  const override = safeConfig?.agents?.[normalizedAgent];
  const parsed = Number(override?.maxOutputTokens);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function toRelativePath(targetPath = '') {
  if (!targetPath) return '';
  return path.relative(process.cwd(), targetPath).replace(/\\/g, '/') || targetPath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reloadRuntimeOverrides(layout, logger = console) {
  const overridesPath = layout.runtimeOverridesPath;
  if (!overridesPath) return runtimeOverridesState;

  if (!fs.existsSync(overridesPath)) {
    if (runtimeOverridesState.filePresent) {
      resetRuntimeOverridesState();
      logger.log('ℹ️ Runtime overrides cleared.');
    }
    return runtimeOverridesState;
  }

  const rawText = fs.readFileSync(overridesPath, 'utf8');
  const signature = crypto.createHash('sha256').update(rawText).digest('hex').slice(0, 16);
  if (runtimeOverridesState.signature === signature) {
    return runtimeOverridesState;
  }

  try {
    const parsed = JSON.parse(rawText);
    const normalized = parseRuntimeOverridesDocument(parsed);
    runtimeOverridesState.safe = normalized.safe;
    runtimeOverridesState.filePresent = true;
    runtimeOverridesState.sourcePath = overridesPath;
    runtimeOverridesState.signature = signature;

    const summary = summarizeRuntimeOverridesSafeConfig(normalized.safe);
    if (summary.length > 0) {
      logger.log(`🛠️ Runtime overrides applied: ${summary.join(', ')}`);
    } else {
      logger.log('ℹ️ Runtime overrides file loaded with no live-safe overrides.');
    }
    if (normalized.restartRequired.length > 0) {
      logger.warn(`⚠️ Runtime overrides ignored (require restart): ${normalized.restartRequired.join(', ')}`);
    }
    if (normalized.ignored.length > 0) {
      logger.warn(`⚠️ Runtime overrides ignored (unsupported): ${normalized.ignored.join(', ')}`);
    }
  } catch (error) {
    if (runtimeOverridesState.lastWarningSignature !== signature) {
      logger.warn(`⚠️ Invalid runtime overrides file: ${error.message}. Keeping last known safe overrides.`);
      runtimeOverridesState.lastWarningSignature = signature;
    }
  }

  return runtimeOverridesState;
}

async function applyRuntimeOverridesForPhase(layout, phase, logger = console) {
  const normalizedPhase = normalizeRuntimeOverridePhase(phase);
  const state = reloadRuntimeOverrides(layout, logger);
  const pauseSeconds = Number(state.safe?.pauseBeforePhases?.[normalizedPhase]) || 0;
  if (pauseSeconds > 0) {
    logger.log(
      `⏸️ Runtime override: pausing ${pauseSeconds}s before ${normalizedPhase} `
      + `(${toRelativePath(layout.runtimeOverridesPath)})`,
    );
    await sleep(pauseSeconds * 1000);
  }
}

module.exports = {
  getRuntimeOverridesState,
  getRuntimeOverridesSafeConfig,
  resetRuntimeOverridesState,
  parseRuntimeOverridesDocument,
  getRuntimeOverrideMaxOutputTokens,
  applyRuntimeOverridesForPhase,
};
