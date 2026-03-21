const { isQuotaExhaustedProviderError } = require('./providers');

// ============ RETRY LOGIC ============
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (value === undefined || value === null || value === '') return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const seconds = Number.parseInt(raw, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
  }

  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, at - nowMs);
}

function parseRateLimitResetAt(value, nowMs = Date.now()) {
  const delayMs = parseRetryAfterMs(value, nowMs);
  return delayMs === null ? null : nowMs + delayMs;
}

function resolveRetryDelayMs({
  error,
  isRateLimit,
  rateLimitDelay,
  baseDelay,
  maxDelay,
  attempt,
}) {
  if (isRateLimit) {
    const headerDelay = parseRetryAfterMs(error?.retryAfter);
    if (headerDelay !== null) {
      return headerDelay;
    }
    return rateLimitDelay;
  }
  return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
}

function isQuotaExhaustedError(error) {
  return isQuotaExhaustedProviderError(error);
}

async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    rateLimitDelay = 65000,
    agentName = 'agent',
    onError = null,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Check both error.message and error.cause for network errors
      const errorText = `${error.message || ''} ${error.cause?.message || ''} ${error.cause?.code || ''}`;
      const isQuotaExhausted = isQuotaExhaustedError(error);
      const isRateLimit = !isQuotaExhausted && (errorText.includes('429') || errorText.includes('rate_limit'));
      const isRequestTimeout = error?.requestTimedOut === true || error?.code === 'PROVIDER_REQUEST_TIMEOUT';
      const isRetryable =
        error?.retryable === true || // Explicitly marked retryable by provider
        (!isQuotaExhausted && isRateLimit) || // Rate limit (HTTP 429 or rate_limit_error)
        isRequestTimeout ||
        errorText.includes('overloaded') || // Anthropic overloaded
        errorText.includes('500') || // Server error
        errorText.includes('502') || // Bad gateway
        errorText.includes('503') || // Service unavailable
        errorText.includes('504') || // Gateway timeout
        errorText.includes('ECONNRESET') ||
        errorText.includes('ETIMEDOUT') ||
        errorText.includes('ENOTFOUND') ||
        errorText.includes('fetch failed') || // Generic fetch failure
        errorText.includes('socket hang up');

      const willRetry = isRetryable && attempt < maxRetries;
      const delay = willRetry
        ? resolveRetryDelayMs({
          error,
          isRateLimit,
          rateLimitDelay,
          baseDelay,
          maxDelay,
          attempt,
        })
        : 0;

      if (typeof onError === 'function') {
        try {
          onError(error, {
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            isRateLimit,
            isRetryable,
            willRetry,
            delayMs: delay,
          });
        } catch (logError) {
          console.warn(`⚠️ Failed to log retry error for ${agentName}: ${logError.message}`);
        }
      }

      if (!willRetry) {
        if (isQuotaExhausted) {
          console.warn(`💸 ${agentName}: Provider quota exhausted. Aborting retries.`);
        }
        throw error;
      }

      if (isRateLimit) {
        const sourceLabel = error?.retryAfter ? 'retry-after' : 'fallback';
        console.log(
          `⏳ ${agentName}: Rate limit hit. Waiting ${Math.max(1, Math.round(delay / 1000))}s for quota reset (${sourceLabel})... (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
      } else {
        console.log(`⚠️ ${agentName}: Attempt ${attempt + 1} failed, retrying in ${Math.round(delay/1000)}s...`);
      }
      await sleep(delay);
    }
  }
}

module.exports = {
  sleep,
  parseRetryAfterMs,
  parseRateLimitResetAt,
  resolveRetryDelayMs,
  isQuotaExhaustedError,
  withRetry,
};
