const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createProviderClients,
  isQuotaExhaustedProviderError,
} = require('../infrastructure/providers');

function mockResponse({ ok = true, status = 200, statusText = 'OK', json = {}, text = '', headers = {} } = {}) {
  const headerEntries = Object.entries(headers);
  return {
    ok,
    status,
    statusText,
    headers: {
      entries() {
        return headerEntries[Symbol.iterator]();
      },
      forEach(callback) {
        headerEntries.forEach(([key, value]) => callback(value, key));
      },
    },
    async json() { return json; },
    async text() { return text; },
  };
}

test('callProvider routes OpenAI and returns text', async () => {
  const originalFetch = global.fetch;
  let requestBody = null;
  global.fetch = async () => mockResponse({
    ok: true,
    json: { choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }] },
  });

  try {
    global.fetch = async (_url, options = {}) => {
      requestBody = JSON.parse(options.body || '{}');
      return mockResponse({
        ok: true,
        json: { choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }] },
      });
    };
    const providers = createProviderClients({ getMaxOutputTokens: () => 256 });
    const result = await providers.callProvider(
      { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'dev' },
      'context',
      [{ role: 'user', content: 'prompt' }],
    );
    assert.equal(result.text, 'hello');
    assert.equal(result.inputTokens, 0);
    assert.equal(result.outputTokens, 0);
    assert.equal(result.meta.provider, 'openai');
    assert.equal(result.meta.stopReason, 'stop');
    assert.equal(requestBody.max_completion_tokens, 256);
    assert.equal('max_tokens' in requestBody, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('callProvider throws on unsupported provider', async () => {
  const providers = createProviderClients({ getMaxOutputTokens: () => 256 });
  await assert.rejects(
    providers.callProvider(
      { apiUrl: 'https://example.com', model: 'x', key: 'k' },
      'context',
      [{ role: 'user', content: 'prompt' }],
    ),
    /Unsupported API URL/,
  );
});

test('callGoogle throws when candidates missing', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => mockResponse({
    ok: true,
    json: { promptFeedback: { blockReason: 'SAFETY' } },
  });

  try {
    const providers = createProviderClients({ getMaxOutputTokens: () => 256 });
    await assert.rejects(
      providers.callGoogle(
        { apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/x:generateContent', model: 'x', key: 'k' },
        'context',
        [{ role: 'user', content: 'prompt' }],
      ),
      /Gemini blocked response/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('callAnthropic joins content blocks', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => mockResponse({
    ok: true,
    headers: {
      'anthropic-ratelimit-input-tokens-limit': '30000',
      'anthropic-ratelimit-input-tokens-remaining': '12000',
    },
    json: {
      content: [{ text: 'part1' }, { text: 'part2' }],
      usage: { input_tokens: 111, cache_creation_input_tokens: 22, output_tokens: 33 },
      stop_reason: 'end_turn',
      stop_sequence: null,
    },
  });

  try {
    const providers = createProviderClients({ getMaxOutputTokens: () => 256, aiLogContextHeader: '## FILE: .ai/logs/AI_LOG.md' });
    const result = await providers.callAnthropic(
      { apiUrl: 'https://api.anthropic.com/v1/messages', model: 'claude', key: 'k' },
      'Generated on: now\n## DIRECTORY STRUCTURE\nfiles',
      [{ role: 'user', content: 'prompt' }],
    );
    assert.equal(result.text, 'part1\npart2');
    assert.equal(result.inputTokens, 133);
    assert.equal(result.outputTokens, 33);
    assert.equal(result.headers['anthropic-ratelimit-input-tokens-limit'], '30000');
    assert.equal(result.meta.provider, 'anthropic');
    assert.equal(result.meta.stopReason, 'end_turn');
  } finally {
    global.fetch = originalFetch;
  }
});

test('callGoogle returns finish metadata on success', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => mockResponse({
    ok: true,
    json: {
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: 'google text' }] },
        },
      ],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 7 },
      modelVersion: 'gemini-3.1-pro-preview',
    },
  });

  try {
    const providers = createProviderClients({ getMaxOutputTokens: () => 256 });
    const result = await providers.callGoogle(
      { apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/x:generateContent', model: 'x', key: 'k' },
      'context',
      [{ role: 'user', content: 'prompt' }],
    );
    assert.equal(result.text, 'google text');
    assert.equal(result.inputTokens, 12);
    assert.equal(result.outputTokens, 7);
    assert.equal(result.meta.provider, 'google');
    assert.equal(result.meta.stopReason, 'STOP');
    assert.equal(result.meta.model, 'gemini-3.1-pro-preview');
  } finally {
    global.fetch = originalFetch;
  }
});

test('callAnthropic exposes rate-limit headers on provider error', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => mockResponse({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    text: '{"type":"error","error":{"type":"rate_limit_error","message":"limit"}}',
    headers: {
      'retry-after': '60',
      'anthropic-ratelimit-requests-limit': '50',
    },
  });

  try {
    const providers = createProviderClients({ getMaxOutputTokens: () => 256 });
    await assert.rejects(
      providers.callAnthropic(
        { apiUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-6', key: 'k', name: 'architect' },
        'context',
        [{ role: 'user', content: 'prompt' }],
      ),
      (error) => {
        assert.equal(error.provider, 'anthropic');
        assert.equal(error.status, 429);
        assert.equal(error.retryAfter, '60');
        assert.equal(error.headers['anthropic-ratelimit-requests-limit'], '50');
        assert.match(error.responseBody, /rate_limit_error/);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('callOpenAI marks insufficient_quota as quota exhaustion, not generic rate limit', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => mockResponse({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    text: JSON.stringify({
      error: {
        message: 'You exceeded your current quota, please check your plan and billing details.',
        type: 'insufficient_quota',
        code: 'insufficient_quota',
      },
    }),
  });

  try {
    const providers = createProviderClients({ getMaxOutputTokens: () => 256 });
    await assert.rejects(
      providers.callProvider(
        { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'developer' },
        'context',
        [{ role: 'user', content: 'prompt' }],
      ),
      (error) => {
        assert.equal(error.provider, 'openai');
        assert.equal(error.status, 429);
        assert.equal(error.providerErrorType, 'insufficient_quota');
        assert.equal(error.providerErrorCode, 'insufficient_quota');
        assert.equal(error.quotaExhausted, true);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('callProvider marks timed out fetches distinctly from quota exhaustion', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_url, options = {}) => new Promise((_, reject) => {
    const signal = options.signal;
    if (!signal || typeof signal.addEventListener !== 'function') return;
    signal.addEventListener('abort', () => {
      const reason = signal.reason;
      if (reason instanceof Error) {
        reject(reason);
        return;
      }
      const error = new Error('Request aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });

  try {
    const providers = createProviderClients({
      getMaxOutputTokens: () => 256,
      providerRequestTimeoutMs: 15,
    });
    await assert.rejects(
      providers.callProvider(
        { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'developer' },
        'context',
        [{ role: 'user', content: 'prompt' }],
      ),
      (error) => {
        assert.equal(error.provider, 'openai');
        assert.equal(error.requestTimedOut, true);
        assert.equal(error.code, 'PROVIDER_REQUEST_TIMEOUT');
        assert.equal(error.timeoutMs, 15);
        assert.equal(error.quotaExhausted, false);
        assert.equal(isQuotaExhaustedProviderError(error), false);
        assert.match(error.message, /timed out/i);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
