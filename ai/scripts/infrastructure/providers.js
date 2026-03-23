const DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS = 120000;

function truncateText(value = '', maxLen = 4000) {
  const text = String(value || '');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

function headersToObject(headers) {
  if (!headers) return {};
  if (typeof headers.entries === 'function') {
    return Object.fromEntries(Array.from(headers.entries()));
  }
  if (typeof headers.forEach === 'function') {
    const out = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return {};
}

function parseProviderErrorPayload(bodyText = '') {
  const raw = String(bodyText || '').trim();
  if (!raw) {
    return {
      providerErrorType: '',
      providerErrorCode: '',
      providerErrorMessage: '',
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const nestedError = parsed?.error && typeof parsed.error === 'object'
      ? parsed.error
      : parsed;
    return {
      providerErrorType: String(nestedError?.type || parsed?.type || '').trim(),
      providerErrorCode: String(nestedError?.code || parsed?.code || '').trim(),
      providerErrorMessage: String(nestedError?.message || parsed?.message || '').trim(),
    };
  } catch {
    return {
      providerErrorType: '',
      providerErrorCode: '',
      providerErrorMessage: '',
    };
  }
}

function buildQuotaExhaustionFingerprint({
  bodyText = '',
  providerErrorType = '',
  providerErrorCode = '',
  providerErrorMessage = '',
  cause = null,
  error = null,
} = {}) {
  return [
    bodyText,
    providerErrorType,
    providerErrorCode,
    providerErrorMessage,
    error?.message || '',
    error?.responseBody || '',
    error?.providerErrorType || '',
    error?.providerErrorCode || '',
    error?.providerErrorMessage || '',
    cause?.message || '',
    cause?.code || '',
    error?.cause?.message || '',
    error?.cause?.code || '',
  ].join(' ').toLowerCase();
}

function detectQuotaExhaustion(input = {}) {
  const fingerprint = buildQuotaExhaustionFingerprint(input);
  return fingerprint.includes('insufficient_quota')
    || fingerprint.includes('exceeded your current quota')
    || fingerprint.includes('credit balance is too low')
    || fingerprint.includes('insufficient balance')
    || fingerprint.includes('billing details');
}

function isQuotaExhaustedProviderError(error) {
  if (!error) return false;
  if (error.quotaExhausted === true) return true;
  return detectQuotaExhaustion({ error });
}

function toPositiveInt(value, fallback) {
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) {
    return Math.floor(num);
  }
  return fallback;
}

function createProviderRequestTimeoutError(timeoutMs = DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS) {
  const normalizedTimeoutMs = toPositiveInt(timeoutMs, DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS);
  const error = new Error(`Request timed out after ${normalizedTimeoutMs}ms`);
  error.name = 'ProviderRequestTimeoutError';
  error.code = 'PROVIDER_REQUEST_TIMEOUT';
  error.requestTimedOut = true;
  error.timeoutMs = normalizedTimeoutMs;
  return error;
}

async function fetchWithTimeout(url, requestOptions = {}, timeoutMs = DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS) {
  const normalizedTimeoutMs = toPositiveInt(timeoutMs, DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS);
  const timeoutController = new AbortController();
  const externalSignal = requestOptions.signal;
  let timeoutTriggered = false;
  const onExternalAbort = () => timeoutController.abort(externalSignal.reason);

  if (externalSignal) {
    if (externalSignal.aborted) {
      timeoutController.abort(externalSignal.reason);
    } else if (typeof externalSignal.addEventListener === 'function') {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    timeoutController.abort(createProviderRequestTimeoutError(normalizedTimeoutMs));
  }, normalizedTimeoutMs);

  try {
    return await fetch(url, {
      ...requestOptions,
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (timeoutTriggered || error?.requestTimedOut === true || timeoutController.signal?.reason?.requestTimedOut === true) {
      throw createProviderRequestTimeoutError(normalizedTimeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal && typeof externalSignal.removeEventListener === 'function') {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

function createProviderClients(options = {}) {
  const {
    getMaxOutputTokens,
    aiLogContextHeader = '## FILE: .ai/logs/AI_LOG.md',
    providerRequestTimeoutMs = DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS,
  } = options;

  function maxTokens(agent) {
    if (typeof getMaxOutputTokens === 'function') {
      return getMaxOutputTokens(agent);
    }
    return 2048;
  }

  function requestTimeoutMs(agent) {
    return toPositiveInt(agent?.requestTimeoutMs, toPositiveInt(providerRequestTimeoutMs, DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS));
  }

  function createProviderError(provider, agent, opts = {}) {
    const {
      response = null,
      bodyText = '',
      cause = null,
      extra = {},
    } = opts;
    const headers = headersToObject(response?.headers);
    const status = response?.status;
    const parsedError = parseProviderErrorPayload(bodyText);
    const quotaExhausted = detectQuotaExhaustion({
      bodyText,
      providerErrorType: parsedError.providerErrorType,
      providerErrorCode: parsedError.providerErrorCode,
      providerErrorMessage: parsedError.providerErrorMessage,
      cause,
    });
    const prefix = provider.charAt(0).toUpperCase() + provider.slice(1);
    const error = new Error(`${prefix} API error${status ? ` (${status})` : ''}: ${truncateText(bodyText || cause?.message || 'Request failed')}`);
    error.name = status ? 'ProviderApiError' : 'ProviderRequestError';
    error.provider = provider;
    error.agentName = agent?.name || '';
    error.model = agent?.model || '';
    error.apiUrl = agent?.apiUrl || '';
    if (status) error.status = status;
    if (response?.statusText) error.statusText = response.statusText;
    if (Object.keys(headers).length > 0) error.headers = headers;
    if (headers['retry-after']) error.retryAfter = headers['retry-after'];
    if (headers['request-id']) error.requestId = headers['request-id'];
    if (headers['x-request-id']) error.requestId = headers['x-request-id'];
    if (headers['anthropic-request-id']) error.requestId = headers['anthropic-request-id'];
    if (bodyText) error.responseBody = truncateText(bodyText);
    if (parsedError.providerErrorType) error.providerErrorType = parsedError.providerErrorType;
    if (parsedError.providerErrorCode) error.providerErrorCode = parsedError.providerErrorCode;
    if (parsedError.providerErrorMessage) error.providerErrorMessage = parsedError.providerErrorMessage;
    error.quotaExhausted = quotaExhausted;
    if (cause?.requestTimedOut === true) {
      error.requestTimedOut = true;
      error.timeoutMs = cause.timeoutMs;
      error.code = cause.code || 'PROVIDER_REQUEST_TIMEOUT';
    }
    if (cause) error.cause = cause;
    Object.assign(error, extra);
    return error;
  }

  function toSafeInt(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
  }

  function buildProviderResult({
    text = '',
    inputTokens = 0,
    outputTokens = 0,
    headers = {},
    rawUsage = null,
    provider = '',
    model = '',
    stopReason = '',
    providerStopReason = '',
    extraMeta = {},
  }) {
    const safeHeaders = headers && typeof headers === 'object' ? headers : {};
    const safeInputTokens = toSafeInt(inputTokens);
    const safeOutputTokens = toSafeInt(outputTokens);
    const normalizedStopReason = String(stopReason || providerStopReason || '').trim();
    const normalizedProviderStopReason = String(providerStopReason || normalizedStopReason).trim();
    const meta = {
      provider: String(provider || '').trim(),
      model: String(model || '').trim(),
      stopReason: normalizedStopReason,
      providerStopReason: normalizedProviderStopReason,
      inputTokens: safeInputTokens,
      outputTokens: safeOutputTokens,
      headers: safeHeaders,
      rawUsage,
      ...extraMeta,
    };

    return {
      text,
      inputTokens: safeInputTokens,
      outputTokens: safeOutputTokens,
      headers: safeHeaders,
      rawUsage,
      meta,
    };
  }

  function annotateError(error, agent, extra = {}) {
    const out = error instanceof Error ? error : new Error(String(error));
    if (!out.provider) out.provider = extra.provider || '';
    if (!out.agentName) out.agentName = agent?.name || '';
    if (!out.model) out.model = agent?.model || '';
    if (!out.apiUrl) out.apiUrl = agent?.apiUrl || '';
    Object.assign(out, extra);
    return out;
  }

  async function callAnthropic(agent, contextBundle, messages) {
    const dirHeader = '## DIRECTORY STRUCTURE';
    let aiLogSection = '';
    let dirSection = '';
    let cachedContext = contextBundle.replace(/^Generated on:.*$/m, 'Generated on: [omitted]');

    const aiLogStart = cachedContext.indexOf(aiLogContextHeader);
    if (aiLogStart !== -1) {
      const remainder = cachedContext.slice(aiLogStart + aiLogContextHeader.length);
      const nextHeaderMatch = remainder.match(/\n## FILE: |\n## DIRECTORY STRUCTURE/);
      const aiLogEnd = nextHeaderMatch ? aiLogStart + aiLogContextHeader.length + nextHeaderMatch.index : cachedContext.length;
      aiLogSection = cachedContext.slice(aiLogStart, aiLogEnd).trim();
      cachedContext = (cachedContext.slice(0, aiLogStart) + cachedContext.slice(aiLogEnd)).trim();
    }

    const dirStart = cachedContext.indexOf(dirHeader);
    if (dirStart !== -1) {
      const dirRemainder = cachedContext.slice(dirStart + dirHeader.length);
      const dirNextHeaderMatch = dirRemainder.match(/\n## FILE: /);
      const dirEnd = dirNextHeaderMatch
        ? dirStart + dirHeader.length + dirNextHeaderMatch.index
        : cachedContext.length;
      dirSection = cachedContext.slice(dirStart, dirEnd).trim();
      cachedContext = (cachedContext.slice(0, dirStart) + cachedContext.slice(dirEnd)).trim();
    }

    let filesIncludedBlock = '';
    if (agent.includeFilesList === true) {
      const fileList = [];
      const fileHeaderRegex = /^## FILE: (.+)$/gm;
      let match = null;
      while ((match = fileHeaderRegex.exec(contextBundle)) !== null) {
        fileList.push(match[1]);
      }
      filesIncludedBlock = fileList.length
        ? ['# FILES INCLUDED', ...fileList.map((file) => `- ${file}`), ''].join('\n')
        : '';
    }

    const dynamicBlock = [
      filesIncludedBlock,
      aiLogSection ? `${aiLogSection}\n` : '',
      dirSection ? `${dirSection}\n` : '',
    ].join('\n').trim();

    const systemBlocks = [
      { type: 'text', text: cachedContext, cache_control: { type: 'ephemeral' } },
    ];

    const finalMessages = [];

    if (dynamicBlock) {
      finalMessages.push({ role: 'user', content: dynamicBlock });
    }

    finalMessages.push(...messages.map((m) => ({ role: m.role, content: m.content })));

    let response;
    try {
      response = await fetchWithTimeout(agent.apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': agent.key,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model: agent.model,
          max_tokens: maxTokens(agent),
          system: systemBlocks,
          messages: finalMessages,
        }),
      }, requestTimeoutMs(agent));
    } catch (error) {
      throw createProviderError('anthropic', agent, { cause: error });
    }

    if (!response.ok) {
      throw createProviderError('anthropic', agent, { response, bodyText: await response.text() });
    }

    const data = await response.json();
    const usage = data.usage || {};
    const stopReason = data.stop_reason || data.stopReason || '';
    const stopSequence = data.stop_sequence || data.stopSequence || null;
    const anthropicText = (data.content || []).map((i) => i.text).join('\n').trim();
    if (!anthropicText && (stopReason === 'max_tokens' || stopReason === 'end_turn')) {
      console.warn(`⚠️ Anthropic returned empty response (stop_reason: ${stopReason}) for ${agent.name || 'agent'} (model: ${agent.model})`);
    }
    return buildProviderResult({
      text: anthropicText,
      inputTokens: toSafeInt(usage.input_tokens) + toSafeInt(usage.cache_creation_input_tokens),
      outputTokens: toSafeInt(usage.output_tokens),
      headers: headersToObject(response.headers),
      rawUsage: usage,
      provider: 'anthropic',
      model: data.model || agent.model || '',
      stopReason,
      providerStopReason: stopReason,
      extraMeta: stopSequence ? { stopSequence } : {},
    });
  }

  async function callOpenAI(agent, contextBundle, messages) {
    const isO1 = agent.model.startsWith('o1');
    const usesCompletionTokens = isO1 || agent.model.startsWith('gpt-5');
    const finalMessages = [{ role: isO1 ? 'user' : 'system', content: contextBundle }, ...messages];

    const body = {
      model: agent.model,
      messages: finalMessages,
    };

    if (usesCompletionTokens) {
      body.max_completion_tokens = maxTokens(agent);
    } else {
      body.max_tokens = maxTokens(agent);
    }

    let response;
    try {
      response = await fetchWithTimeout(agent.apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${agent.key}`,
        },
        body: JSON.stringify(body),
      }, requestTimeoutMs(agent));
    } catch (error) {
      throw createProviderError('openai', agent, { cause: error });
    }

    if (!response.ok) {
      throw createProviderError('openai', agent, { response, bodyText: await response.text() });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    const finishReason = data.choices?.[0]?.finish_reason || 'unknown';

    if (!text) {
      if (finishReason === 'length') {
        console.warn(`⚠️ OpenAI returned empty response due to output length limit for ${agent.name || 'agent'} (model: ${agent.model})`);
        const usage = data.usage || {};
        return buildProviderResult({
          text: '',
          inputTokens: toSafeInt(usage.prompt_tokens ?? usage.input_tokens),
          outputTokens: 0,
          headers: headersToObject(response.headers),
          rawUsage: usage,
          provider: 'openai',
          model: data.model || agent.model || '',
          stopReason: 'length',
          providerStopReason: finishReason,
        });
      }
      throw annotateError(
        new Error(`OpenAI empty response. finish_reason: ${finishReason}, model: ${agent.model}`),
        agent,
        { provider: 'openai', finishReason },
      );
    }

    if (finishReason !== 'stop' && finishReason !== 'end_turn') {
      console.warn(`⚠️ OpenAI finish_reason: ${finishReason} for ${agent.name}`);
    }

    const usage = data.usage || {};
    return buildProviderResult({
      text,
      inputTokens: toSafeInt(usage.prompt_tokens ?? usage.input_tokens),
      outputTokens: toSafeInt(usage.completion_tokens ?? usage.output_tokens),
      headers: headersToObject(response.headers),
      rawUsage: usage,
      provider: 'openai',
      model: data.model || agent.model || '',
      stopReason: finishReason,
      providerStopReason: finishReason,
    });
  }

  async function callGoogle(agent, contextBundle, messages) {
    const contents = [
      { role: 'user', parts: [{ text: contextBundle }] },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    ];

    const url = agent.apiUrl.includes('key=') ? agent.apiUrl : `${agent.apiUrl}?key=${encodeURIComponent(agent.key)}`;
    let response;
    try {
      response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: maxTokens(agent) },
          toolConfig: { functionCallingConfig: { mode: 'NONE' } },
        }),
      }, requestTimeoutMs(agent));
    } catch (error) {
      throw createProviderError('google', agent, { cause: error });
    }

    if (!response.ok) {
      throw createProviderError('google', agent, { response, bodyText: await response.text() });
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      const blockReason = data.promptFeedback?.blockReason || 'UNKNOWN';
      const safetyRatings = data.promptFeedback?.safetyRatings || [];
      console.warn(`⚠️ Gemini returned no candidates. Block reason: ${blockReason}`);
      if (safetyRatings.length > 0) {
        console.warn(`   Safety ratings: ${JSON.stringify(safetyRatings)}`);
      }
      throw annotateError(new Error(`Gemini blocked response: ${blockReason}`), agent, {
        provider: 'google',
        blockReason,
        safetyRatings,
      });
    }

    const candidate = data.candidates[0];
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED') {
      const safetyRatings = candidate.safetyRatings || [];
      console.warn(`⚠️ Gemini candidate blocked. Reason: ${candidate.finishReason}`);
      console.warn(`   Safety ratings: ${JSON.stringify(safetyRatings)}`);
      const err = annotateError(new Error(`Gemini response blocked: ${candidate.finishReason}`), agent, {
        provider: 'google',
        finishReason: candidate.finishReason,
        safetyRatings,
      });
      err.retryable = false;
      throw err;
    }

    const text = candidate.content?.parts?.map((p) => p.text).join('\n').trim() || '';
    if (!text) {
      // MAX_TOKENS: graceful empty return (output limit hit, no point retrying)
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn(`⚠️ Gemini returned empty response (MAX_TOKENS) for ${agent.name || 'agent'} (model: ${agent.model})`);
        const usage = data.usageMetadata || {};
        return buildProviderResult({
          text: '',
          inputTokens: toSafeInt(usage.promptTokenCount),
          outputTokens: 0,
          headers: headersToObject(response.headers),
          rawUsage: usage,
          provider: 'google',
          model: agent.model || '',
          stopReason: 'length',
          providerStopReason: candidate.finishReason,
        });
      }
      // MALFORMED_FUNCTION_CALL: transient — throw retryable error so withRetry can handle it
      const retryableFinishReasons = ['MALFORMED_FUNCTION_CALL'];
      if (retryableFinishReasons.includes(candidate.finishReason)) {
        const err = annotateError(
          new Error(`Gemini returned ${candidate.finishReason} for ${agent.name || 'agent'} (model: ${agent.model}). Retryable.`),
          agent,
          { provider: 'google', finishReason: candidate.finishReason },
        );
        err.retryable = true;
        err.code = 'GEMINI_MALFORMED_FUNCTION_CALL';
        throw err;
      }
      throw annotateError(new Error(`Gemini returned empty text. Finish reason: ${candidate.finishReason}`), agent, {
        provider: 'google',
        finishReason: candidate.finishReason,
      });
    }

    const usage = data.usageMetadata || {};
    return buildProviderResult({
      text,
      inputTokens: toSafeInt(usage.promptTokenCount),
      outputTokens: toSafeInt(usage.candidatesTokenCount),
      headers: headersToObject(response.headers),
      rawUsage: usage,
      provider: 'google',
      model: data.modelVersion || agent.model || '',
      stopReason: candidate.finishReason || '',
      providerStopReason: candidate.finishReason || '',
    });
  }

  async function callProvider(agent, contextBundle, messages) {
    if (agent.apiUrl.includes('anthropic.com')) {
      return callAnthropic(agent, contextBundle, messages);
    }
    if (agent.apiUrl.includes('googleapis.com')) {
      return callGoogle(agent, contextBundle, messages);
    }
    if (agent.apiUrl.includes('openai.com')) {
      return callOpenAI(agent, contextBundle, messages);
    }
    throw new Error(`Unsupported API URL: ${agent.apiUrl}`);
  }

  return {
    callAnthropic,
    callOpenAI,
    callGoogle,
    callProvider,
  };
}

function getProviderName(agent = {}) {
  const url = String(agent.apiUrl || '').toLowerCase();
  if (url.includes('anthropic.com')) return 'anthropic';
  if (url.includes('googleapis.com')) return 'google';
  if (url.includes('openai.com')) return 'openai';
  return 'other';
}

function getProviderLabel(provider = 'other') {
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'google') return 'Google';
  if (provider === 'openai') return 'OpenAI';
  return provider;
}

module.exports = {
  createProviderClients,
  detectQuotaExhaustion,
  isQuotaExhaustedProviderError,
  getProviderName,
  getProviderLabel,
  DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS,
};
