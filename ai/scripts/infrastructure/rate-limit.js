const { parseRateLimitResetAt } = require('./retry');
const { getProviderName } = require('./providers');

function normalizeEnvToken(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeHeaders(headers = {}) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [key, value] of Object.entries(headers)) {
    out[String(key || '').toLowerCase()] = value;
  }
  return out;
}

function parseHeaderInt(headers, keys = []) {
  for (const key of keys) {
    const raw = headers[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return null;
}

function parseHeaderResetAt(headers, keys = [], nowMs = Date.now()) {
  for (const key of keys) {
    const raw = headers[key];
    const parsed = parseRateLimitResetAt(raw, nowMs);
    if (parsed !== null) return parsed;
  }
  return null;
}

function getRateLimitBudgetKey(agent = {}) {
  const provider = normalizeEnvToken(getProviderName(agent)) || 'OTHER';
  const model = normalizeEnvToken(agent.model || '');
  if (model) return `${provider}:${model}`;
  const agentKey = normalizeEnvToken(agent.name || '');
  return `${provider}:${agentKey || 'DEFAULT'}`;
}

function extractRateLimitSnapshotFromHeaders(headers, nowMs = Date.now()) {
  const normalized = normalizeHeaders(headers);
  const fallbackResetAt = parseHeaderResetAt(normalized, ['retry-after'], nowMs);

  const inputLimit = parseHeaderInt(normalized, [
    'anthropic-ratelimit-input-tokens-limit',
    'x-ratelimit-limit-input-tokens',
    'x-ratelimit-limit-tokens',
  ]);
  const inputRemaining = parseHeaderInt(normalized, [
    'anthropic-ratelimit-input-tokens-remaining',
    'x-ratelimit-remaining-input-tokens',
    'x-ratelimit-remaining-tokens',
  ]);
  const inputResetAt = parseHeaderResetAt(normalized, [
    'anthropic-ratelimit-input-tokens-reset',
    'x-ratelimit-reset-input-tokens',
    'x-ratelimit-reset-tokens',
  ], nowMs) || fallbackResetAt;

  const requestLimit = parseHeaderInt(normalized, [
    'anthropic-ratelimit-requests-limit',
    'x-ratelimit-limit-requests',
  ]);
  const requestRemaining = parseHeaderInt(normalized, [
    'anthropic-ratelimit-requests-remaining',
    'x-ratelimit-remaining-requests',
  ]);
  const requestResetAt = parseHeaderResetAt(normalized, [
    'anthropic-ratelimit-requests-reset',
    'x-ratelimit-reset-requests',
  ], nowMs) || fallbackResetAt;

  const snapshot = {
    observedAt: nowMs,
  };

  if (inputLimit !== null || inputRemaining !== null || inputResetAt !== null) {
    snapshot.inputTokens = {
      limit: inputLimit,
      remaining: inputRemaining,
      resetAt: inputResetAt,
    };
  }

  if (requestLimit !== null || requestRemaining !== null || requestResetAt !== null) {
    snapshot.requests = {
      limit: requestLimit,
      remaining: requestRemaining,
      resetAt: requestResetAt,
    };
  }

  const hasData = snapshot.inputTokens || snapshot.requests;
  return hasData ? snapshot : null;
}

function applyObservedUsageToRateLimitSnapshot(snapshot, observedInputTokens, nowMs = Date.now()) {
  if (!snapshot || !Number.isFinite(observedInputTokens) || observedInputTokens <= 0) return snapshot;
  const next = { ...snapshot };

  if (
    next.inputTokens
    && Number.isFinite(next.inputTokens.remaining)
    && (!Number.isFinite(next.inputTokens.resetAt) || next.inputTokens.resetAt > nowMs)
  ) {
    next.inputTokens = {
      ...next.inputTokens,
      remaining: Math.max(0, next.inputTokens.remaining - observedInputTokens),
    };
  }

  if (
    next.requests
    && Number.isFinite(next.requests.remaining)
    && (!Number.isFinite(next.requests.resetAt) || next.requests.resetAt > nowMs)
  ) {
    next.requests = {
      ...next.requests,
      remaining: Math.max(0, next.requests.remaining - 1),
    };
  }

  next.observedAt = nowMs;
  return next;
}

function estimateContentChars(content) {
  if (content === undefined || content === null) return 0;
  if (typeof content === 'string') return content.length;
  if (Array.isArray(content)) {
    return content.reduce((sum, item) => sum + estimateContentChars(item), 0);
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text.length;
    return JSON.stringify(content).length;
  }
  return String(content).length;
}

const DEFAULT_CHARS_PER_TOKEN_BY_PROVIDER = {
  anthropic: 3.5,
  google: 4,
  openai: 4,
  other: 4,
};

function estimateInputTokens(agent, contextBundle, messages = []) {
  const provider = getProviderName(agent);
  const charsPerToken = DEFAULT_CHARS_PER_TOKEN_BY_PROVIDER[provider] || DEFAULT_CHARS_PER_TOKEN_BY_PROVIDER.other;
  const messageChars = Array.isArray(messages)
    ? messages.reduce((sum, message) => sum + estimateContentChars(message?.content), 0)
    : 0;
  const totalChars = estimateContentChars(contextBundle) + messageChars;
  const structuralOverheadTokens = (Array.isArray(messages) ? messages.length : 0) * 16 + 32;
  return Math.max(1, Math.ceil(totalChars / charsPerToken) + structuralOverheadTokens);
}

module.exports = {
  normalizeEnvToken,
  normalizeHeaders,
  parseHeaderInt,
  parseHeaderResetAt,
  getRateLimitBudgetKey,
  extractRateLimitSnapshotFromHeaders,
  applyObservedUsageToRateLimitSnapshot,
  estimateContentChars,
  estimateInputTokens,
};
