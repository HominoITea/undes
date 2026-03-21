const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseRetryAfterMs,
  parseRateLimitResetAt,
  resolveRetryDelayMs,
  estimateInputTokens,
  extractRateLimitSnapshotFromHeaders,
  computePreflightRateLimitDelayMs,
} = require('../generate-context');

test('parseRetryAfterMs parses delta-seconds retry-after', () => {
  assert.equal(parseRetryAfterMs('59'), 59000);
  assert.equal(parseRetryAfterMs(0), 0);
});

test('parseRetryAfterMs parses HTTP-date retry-after', () => {
  const now = Date.parse('2026-03-10T17:18:23Z');
  const retryAt = 'Tue, 10 Mar 2026 17:19:23 GMT';
  assert.equal(parseRetryAfterMs(retryAt, now), 60000);
});

test('parseRetryAfterMs returns null for invalid values', () => {
  assert.equal(parseRetryAfterMs(''), null);
  assert.equal(parseRetryAfterMs('not-a-date'), null);
  assert.equal(parseRetryAfterMs(null), null);
});

test('parseRateLimitResetAt converts retry-style values to absolute timestamps', () => {
  const now = Date.parse('2026-03-10T17:18:23Z');
  assert.equal(parseRateLimitResetAt('60', now), now + 60000);
});

test('resolveRetryDelayMs prefers retry-after for rate limit errors', () => {
  const delay = resolveRetryDelayMs({
    error: { retryAfter: '59' },
    isRateLimit: true,
    rateLimitDelay: 65000,
    baseDelay: 1000,
    maxDelay: 30000,
    attempt: 0,
  });

  assert.equal(delay, 59000);
});

test('resolveRetryDelayMs falls back to configured rate-limit delay when retry-after is absent', () => {
  const delay = resolveRetryDelayMs({
    error: {},
    isRateLimit: true,
    rateLimitDelay: 65000,
    baseDelay: 1000,
    maxDelay: 30000,
    attempt: 0,
  });

  assert.equal(delay, 65000);
});

test('resolveRetryDelayMs uses exponential backoff for non-rate-limit errors', () => {
  const delay = resolveRetryDelayMs({
    error: {},
    isRateLimit: false,
    rateLimitDelay: 65000,
    baseDelay: 1000,
    maxDelay: 30000,
    attempt: 3,
  });

  assert.equal(delay, 8000);
});

test('estimateInputTokens scales with context and messages', () => {
  const estimate = estimateInputTokens(
    { apiUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-6' },
    'A'.repeat(3500),
    [{ role: 'user', content: 'B'.repeat(700) }],
  );

  assert.ok(estimate >= 1200);
  assert.ok(estimate <= 1300);
});

test('extractRateLimitSnapshotFromHeaders reads anthropic token budget headers', () => {
  const now = Date.parse('2026-03-10T17:18:23Z');
  const snapshot = extractRateLimitSnapshotFromHeaders({
    'anthropic-ratelimit-input-tokens-limit': '30000',
    'anthropic-ratelimit-input-tokens-remaining': '4000',
    'anthropic-ratelimit-input-tokens-reset': '2026-03-10T17:19:23Z',
    'anthropic-ratelimit-requests-limit': '50',
    'anthropic-ratelimit-requests-remaining': '12',
    'anthropic-ratelimit-requests-reset': '2026-03-10T17:18:53Z',
  }, now);

  assert.equal(snapshot.inputTokens.limit, 30000);
  assert.equal(snapshot.inputTokens.remaining, 4000);
  assert.equal(snapshot.inputTokens.resetAt, Date.parse('2026-03-10T17:19:23Z'));
  assert.equal(snapshot.requests.remaining, 12);
});

test('computePreflightRateLimitDelayMs waits when next request exceeds remaining token budget', () => {
  const now = Date.parse('2026-03-10T17:18:23Z');
  const wait = computePreflightRateLimitDelayMs({
    inputTokens: {
      limit: 30000,
      remaining: 1500,
      resetAt: now + 45000,
    },
  }, 1600, now);

  assert.equal(wait.waitMs, 45000);
  assert.match(wait.reason, /input tokens remaining/);
});

test('computePreflightRateLimitDelayMs does not wait when remaining budget is enough', () => {
  const now = Date.parse('2026-03-10T17:18:23Z');
  const wait = computePreflightRateLimitDelayMs({
    inputTokens: {
      limit: 30000,
      remaining: 5000,
      resetAt: now + 45000,
    },
  }, 1600, now);

  assert.equal(wait.waitMs, 0);
});
