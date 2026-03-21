'use strict';

const END_MARKER = '=== END OF DOCUMENT ===';

const REFUSAL_PATTERNS = [
  /^\s*I (?:cannot|can't)\s+(?:help|assist|comply|continue|provide|complete|perform|do that|do this)\b/i,
  /^\s*I'm unable to\b/i,
  /\bI do not have access\b/i,
  /^\s*As an AI\b/i,
  /^\s*I'm not able to\b/i,
  /^\s*I apologize, but I\b/i,
  /\bsorry,?\s+(?:but\s+)?I (?:can't|cannot|am unable)\b/i,
];

const TRUNCATION_STOP_REASONS = new Set([
  'length',
  'max_tokens',
  'max_output_tokens',
  'output_token_limit',
  'model_length',
  'token_limit',
]);

function normalizeStopReason(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function looksSyntacticallyIncomplete(responseText) {
  const text = String(responseText || '').replace(END_MARKER, '').trimEnd();
  if (!text) return false;

  const codeFenceCount = (text.match(/```/g) || []).length;
  if (codeFenceCount % 2 === 1) return true;

  const lastLine = text.split('\n').pop().trim();
  if (!lastLine) return false;

  if (/[([{,:;/\\-]$/.test(lastLine)) return true;
  if (/[\p{L}\p{N}_]$/u.test(lastLine) && !/[.!?`)\]}>"']$/.test(lastLine)) return true;
  return false;
}

function validateResponse(responseText, opts = {}) {
  const text = String(responseText || '');
  const minLength = opts.minLength ?? 100;
  const requireEndMarker = opts.requireEndMarker ?? true;
  const checkRefusal = opts.checkRefusal ?? true;
  const checkFileRefs = opts.checkFileRefs ?? false;
  const minConfidence = opts.minConfidence ?? null;

  const warnings = [];
  const errors = [];

  const stripped = text.replace(END_MARKER, '').trim();
  if (stripped.length < minLength) {
    errors.push(`Response too short (${stripped.length} chars, minimum: ${minLength})`);
  }

  if (requireEndMarker && !text.includes(END_MARKER)) {
    warnings.push('Missing END_MARKER - response may be truncated');
  }

  if (checkRefusal) {
    for (const pattern of REFUSAL_PATTERNS) {
      if (pattern.test(text)) {
        const match = text.match(pattern);
        errors.push(`Refusal detected: "${match ? match[0] : 'pattern matched'}"`);
        break;
      }
    }
  }

  if (checkFileRefs) {
    const hasFileRef = /[\w/.-]+\.(js|ts|py|go|rs|java|cs|rb|php|c|cpp|h)[:]\d+/i.test(text);
    const hasCodeBlock = /```[\s\S]{20,}```/.test(text);
    if (!hasFileRef && !hasCodeBlock) {
      warnings.push('No file:line references or code blocks found in response');
    }
  }

  if (minConfidence !== null) {
    const match = text.match(/\[CONFIDENCE:\s*(\d+)%?\]/i);
    if (match) {
      const confidence = Number.parseInt(match[1], 10);
      if (confidence < minConfidence) {
        warnings.push(`Low confidence: ${confidence}% (threshold: ${minConfidence}%)`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

function classifyCompletion(responseText, validationResult, opts = {}) {
  const text = String(responseText || '');
  const requireEndMarker = opts.requireEndMarker ?? true;
  const stopReason = normalizeStopReason(opts.meta?.stopReason || opts.meta?.providerStopReason || '');
  const missingEndMarker = requireEndMarker && !text.includes(END_MARKER);
  const providerIndicatesTruncation = missingEndMarker && stopReason !== '' && TRUNCATION_STOP_REASONS.has(stopReason);
  const heuristicIndicatesTruncation = missingEndMarker && stopReason === '' && looksSyntacticallyIncomplete(text);
  const validationErrors = Array.isArray(validationResult?.errors) ? validationResult.errors : [];

  let completionStatus = 'complete';
  if (missingEndMarker && (providerIndicatesTruncation || heuristicIndicatesTruncation)) {
    completionStatus = 'truncated';
  } else if (validationErrors.length > 0 || missingEndMarker) {
    completionStatus = 'invalid';
  }

  return {
    completionStatus,
    missingEndMarker,
    stopReason,
    providerIndicatesTruncation,
    heuristicIndicatesTruncation,
  };
}

function formatValidation(result, agentName) {
  const lines = [];
  if (result.errors.length > 0) {
    lines.push(`   ❌ ${agentName}: INVALID response`);
    for (const err of result.errors) {
      lines.push(`      - ${err}`);
    }
  }
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      lines.push(`   ⚠️  ${agentName}: ${warning}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  validateResponse,
  classifyCompletion,
  formatValidation,
  REFUSAL_PATTERNS,
  TRUNCATION_STOP_REASONS,
  normalizeStopReason,
  looksSyntacticallyIncomplete,
};
