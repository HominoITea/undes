'use strict';

const { normalizeEnvToken } = require('../infrastructure/rate-limit');
const { getProviderName } = require('../infrastructure/providers');
const {
  getRuntimeOverridesSafeConfig,
  getRuntimeOverrideMaxOutputTokens: getRuntimeOverrideMaxOutputTokensBase,
} = require('../runtime-overrides');
const {
  normalizeForecastStage,
  getRecommendedOutputTokensForStage,
} = require('./forecast');

// --- Constants ---

const DEFAULT_PROVIDER_EXECUTION_MODE = {
  anthropic: 'sequential',
  google: 'parallel',
  openai: 'parallel',
  other: 'parallel',
};

const DEFAULT_MAX_OUTPUT_TOKENS_BY_PROVIDER = {
  anthropic: 2048,
  google: 4096,
  openai: 4096,
  other: 2048,
};

const AUTO_MAX_OUTPUT_TOKENS_CEILING_BY_PROVIDER = {
  anthropic: 8192,
  google: 8192,
  openai: 8192,
  other: 4096,
};

const AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN = 256;

// --- Env parsing ---

function parseEnvInt(keys, fallback, options = {}) {
  const { min = 0 } = options;
  for (const key of keys) {
    if (!key) continue;
    if (process.env[key] === undefined || process.env[key] === '') continue;
    const parsed = Number(process.env[key]);
    if (!Number.isFinite(parsed)) continue;
    if (parsed < min) continue;
    return Math.floor(parsed);
  }
  return fallback;
}

function parseEnvString(keys, fallback = '') {
  for (const key of keys) {
    if (!key) continue;
    if (process.env[key] === undefined) continue;
    const value = String(process.env[key]).trim();
    if (!value) continue;
    return value;
  }
  return fallback;
}

function parseEnvBool(keys, fallback = false) {
  for (const key of keys) {
    if (!key) continue;
    if (process.env[key] === undefined) continue;
    const value = String(process.env[key]).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(value)) return true;
    if (['0', 'false', 'no', 'off'].includes(value)) return false;
  }
  return fallback;
}

// --- Scoped config helpers ---

function getScopedKeys(agent = {}, suffix = '') {
  const providerKey = normalizeEnvToken(getProviderName(agent));
  const modelKey = normalizeEnvToken(agent.model || '');
  const agentKey = normalizeEnvToken(agent.name || '');
  const scoped = [];

  if (agentKey) scoped.push(`AI_CFG__AGENT__${agentKey}__${suffix}`);
  if (modelKey) scoped.push(`AI_CFG__MODEL__${modelKey}__${suffix}`);
  if (providerKey) scoped.push(`AI_CFG__PROVIDER__${providerKey}__${suffix}`);
  scoped.push(`AI_CFG__DEFAULT__${suffix}`);

  return scoped;
}

function getScopedInt(agent, suffix, fallback, aliases = []) {
  return parseEnvInt([...getScopedKeys(agent, suffix), ...aliases], fallback);
}

// --- Agent config resolution ---

function getConfiguredMaxOutputTokens(agent, safeOverrides = getRuntimeOverridesSafeConfig()) {
  const runtimeOverride = getRuntimeOverrideMaxOutputTokensBase(agent, safeOverrides);
  if (Number.isFinite(runtimeOverride) && runtimeOverride > 0) {
    return Math.floor(runtimeOverride);
  }
  const directBudget = Number(agent?.maxOutputTokens);
  if (Number.isFinite(directBudget) && directBudget > 0) {
    return Math.floor(directBudget);
  }
  const provider = getProviderName(agent);
  const fallback = DEFAULT_MAX_OUTPUT_TOKENS_BY_PROVIDER[provider] || DEFAULT_MAX_OUTPUT_TOKENS_BY_PROVIDER.other;
  return getScopedInt(agent, 'MAX_OUTPUT_TOKENS', fallback, ['AI_MAX_OUTPUT_TOKENS']);
}

function getMaxOutputTokens(agent, safeOverrides = getRuntimeOverridesSafeConfig()) {
  return getConfiguredMaxOutputTokens(agent, safeOverrides);
}

function getRepairMaxOutputTokens(agent, stage = 'unknown', options = {}) {
  const stageKey = normalizeForecastStage(stage);
  const hintedTokens = Number(options.maxOutputTokens);
  const baseTokens = Number.isFinite(hintedTokens) && hintedTokens > 0
    ? Math.floor(hintedTokens)
    : getMaxOutputTokens(agent);
  const stageCap = ['consensus', 'revision', 'da-revision'].includes(stageKey) ? 6144 : 3072;
  return Math.max(256, Math.min(baseTokens, stageCap));
}

function getAutoMaxOutputTokensSettings(agent) {
  const provider = getProviderName(agent);
  const ceilingFallback = AUTO_MAX_OUTPUT_TOKENS_CEILING_BY_PROVIDER[provider]
    || AUTO_MAX_OUTPUT_TOKENS_CEILING_BY_PROVIDER.other;
  return {
    enabled: parseEnvBool(
      [...getScopedKeys(agent, 'AUTO_MAX_OUTPUT_TOKENS_ENABLED'), 'AI_AUTO_MAX_OUTPUT_TOKENS_ENABLED'],
      true,
    ),
    ceilingTokens: getScopedInt(
      agent,
      'AUTO_MAX_OUTPUT_TOKENS_CEILING',
      ceilingFallback,
      ['AI_AUTO_MAX_OUTPUT_TOKENS_CEILING'],
    ),
    minGainTokens: getScopedInt(
      agent,
      'AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN',
      AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN,
      ['AI_AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN'],
    ),
  };
}

function resolveEffectiveMaxOutputTokens({
  agent,
  stage = 'unknown',
  estimatedInputTokens = 0,
  safeOverrides = getRuntimeOverridesSafeConfig(),
} = {}) {
  const rawStage = String(stage || 'unknown').toLowerCase();
  const configuredTokens = getConfiguredMaxOutputTokens(agent, safeOverrides);
  const runtimeOverrideTokens = getRuntimeOverrideMaxOutputTokensBase(agent, safeOverrides);
  const recommendedTokens = getRecommendedOutputTokensForStage(stage, estimatedInputTokens);
  const settings = getAutoMaxOutputTokensSettings(agent);
  const normalizedStage = normalizeForecastStage(rawStage);

  if (Number.isFinite(runtimeOverrideTokens) && runtimeOverrideTokens > 0) {
    return {
      stage: normalizedStage,
      source: 'runtime-override',
      adjusted: false,
      configuredTokens,
      recommendedTokens,
      effectiveTokens: runtimeOverrideTokens,
      ceilingTokens: Math.max(runtimeOverrideTokens, settings.ceilingTokens),
    };
  }

  if (!settings.enabled) {
    return {
      stage: normalizedStage,
      source: 'configured',
      adjusted: false,
      configuredTokens,
      recommendedTokens,
      effectiveTokens: configuredTokens,
      ceilingTokens: Math.max(configuredTokens, settings.ceilingTokens),
    };
  }

  if (rawStage.endsWith('-repair')) {
    return {
      stage: normalizedStage,
      source: 'repair-budget',
      adjusted: false,
      configuredTokens,
      recommendedTokens,
      effectiveTokens: configuredTokens,
      ceilingTokens: Math.max(configuredTokens, settings.ceilingTokens),
    };
  }

  const ceilingTokens = Math.max(configuredTokens, settings.ceilingTokens);
  const nextTokens = Math.min(recommendedTokens, ceilingTokens);
  const adjusted = nextTokens > configuredTokens && (nextTokens - configuredTokens) >= settings.minGainTokens;

  return {
    stage: normalizedStage,
    source: adjusted ? 'auto' : 'configured',
    adjusted,
    configuredTokens,
    recommendedTokens,
    effectiveTokens: adjusted ? nextTokens : configuredTokens,
    ceilingTokens,
  };
}

function getProviderExecutionMode(provider) {
  const providerKey = normalizeEnvToken(provider);
  const rawMode = parseEnvString(
    [
      `AI_CFG__PROVIDER__${providerKey}__EXECUTION`,
      `AI_PROVIDER_${providerKey}_EXECUTION`,
      'AI_CFG__DEFAULT__PROVIDER_EXECUTION',
    ],
    DEFAULT_PROVIDER_EXECUTION_MODE[provider] || DEFAULT_PROVIDER_EXECUTION_MODE.other,
  ).toLowerCase();

  return rawMode === 'sequential' ? 'sequential' : 'parallel';
}

function isAgentEnabled(agent = {}) {
  const providerKey = normalizeEnvToken(getProviderName(agent));
  const agentKey = normalizeEnvToken(agent.name || '');

  const providerEnabled = parseEnvBool(
    [`AI_CFG__PROVIDER__${providerKey}__ENABLED`],
    true,
  );

  return parseEnvBool(
    [
      `AI_CFG__AGENT__${agentKey}__ENABLED`,
      `AI_AGENT_${agentKey}_ENABLED`,
    ],
    providerEnabled,
  );
}

function getRetrySettings(agent) {
  return {
    maxRetries: getScopedInt(agent, 'RETRY_MAX_RETRIES', 3, ['AI_RETRY_MAX_RETRIES']),
    baseDelayMs: getScopedInt(agent, 'RETRY_BASE_DELAY_MS', 1000, ['AI_RETRY_BASE_DELAY_MS']),
    maxDelayMs: getScopedInt(agent, 'RETRY_MAX_DELAY_MS', 30000, ['AI_RETRY_MAX_DELAY_MS']),
    rateLimitDelayMs: getScopedInt(agent, 'RETRY_RATE_LIMIT_DELAY_MS', 65000, ['AI_RETRY_RATE_LIMIT_DELAY_MS']),
  };
}

function getToolLoopSettings() {
  return {
    maxTurns: parseEnvInt(
      ['AI_CFG__DEFAULT__TOOL_MAX_TURNS', 'AI_TOOL_MAX_TURNS'],
      5,
      { min: 1 },
    ),
    maxTotalFileBytes: parseEnvInt(
      ['AI_CFG__DEFAULT__TOOL_MAX_TOTAL_FILE_BYTES', 'AI_TOOL_MAX_TOTAL_FILE_BYTES'],
      120 * 1024,
      { min: 1024 },
    ),
    maxFilesPerTurn: parseEnvInt(
      ['AI_CFG__DEFAULT__TOOL_MAX_FILES_PER_TURN', 'AI_TOOL_MAX_FILES_PER_TURN'],
      4,
      { min: 1 },
    ),
    maxFileBytes: parseEnvInt(
      ['AI_CFG__DEFAULT__TOOL_MAX_FILE_BYTES', 'AI_TOOL_MAX_FILE_BYTES'],
      60 * 1024,
      { min: 1024 },
    ),
  };
}

function getRateLimitBuckets(agent) {
  const provider = getProviderName(agent);
  const providerKey = normalizeEnvToken(provider);
  const modelKey = normalizeEnvToken(agent.model || '');
  const agentKey = normalizeEnvToken(agent.name || '');
  const buckets = [];

  const addBucket = (bucketKey, intervalMs, label) => {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    buckets.push({ key: bucketKey, intervalMs, label });
  };

  if (providerKey) {
    addBucket(
      `provider:${provider}`,
      parseEnvInt(
        [
          `AI_CFG__PROVIDER__${providerKey}__MIN_INTERVAL_MS`,
          `AI_RATE_LIMIT_PROVIDER_${providerKey}_MIN_INTERVAL_MS`,
        ],
        0,
      ),
      `provider:${provider}`,
    );
  }

  if (modelKey) {
    addBucket(
      `model:${modelKey}`,
      parseEnvInt(
        [
          `AI_CFG__MODEL__${modelKey}__MIN_INTERVAL_MS`,
          `AI_RATE_LIMIT_MODEL_${modelKey}_MIN_INTERVAL_MS`,
        ],
        0,
      ),
      `model:${agent.model}`,
    );
  }

  if (agentKey) {
    addBucket(
      `agent:${agentKey}`,
      parseEnvInt(
        [
          `AI_CFG__AGENT__${agentKey}__MIN_INTERVAL_MS`,
          `AI_RATE_LIMIT_AGENT_${agentKey}_MIN_INTERVAL_MS`,
        ],
        0,
      ),
      `agent:${agent.name}`,
    );
  }

  if (String(agent.model || '').toLowerCase().includes('claude')) {
    addBucket(
      'family:claude',
      parseEnvInt(
        ['AI_CFG__PROVIDER__CLAUDE__MIN_INTERVAL_MS', 'AI_RATE_LIMIT_CLAUDE_MIN_INTERVAL_MS'],
        65000,
      ),
      'family:claude',
    );
  }

  addBucket(
    'global:default',
    parseEnvInt(['AI_CFG__DEFAULT__MIN_INTERVAL_MS', 'AI_RATE_LIMIT_DEFAULT_MIN_INTERVAL_MS'], 0),
    'default',
  );

  return buckets;
}

module.exports = {
  // Constants
  DEFAULT_PROVIDER_EXECUTION_MODE,
  DEFAULT_MAX_OUTPUT_TOKENS_BY_PROVIDER,
  AUTO_MAX_OUTPUT_TOKENS_CEILING_BY_PROVIDER,
  AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN,
  // Env parsing
  parseEnvInt,
  parseEnvString,
  parseEnvBool,
  // Scoped config
  getScopedKeys,
  getScopedInt,
  // Agent config
  getConfiguredMaxOutputTokens,
  getMaxOutputTokens,
  getRepairMaxOutputTokens,
  getAutoMaxOutputTokensSettings,
  resolveEffectiveMaxOutputTokens,
  getProviderExecutionMode,
  isAgentEnabled,
  getRetrySettings,
  getToolLoopSettings,
  getRateLimitBuckets,
};
