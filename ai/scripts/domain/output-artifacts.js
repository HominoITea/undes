// ============ OUTPUT ARTIFACTS ============
const fs = require('fs');
const { stripEndMarker, END_MARKER, parseApproval } = require('./prompt-content');
const { normalizeTokenCount, toRelativePath } = require('./text-utilities');
const { getProviderName } = require('../infrastructure/providers');
const {
  DEFAULT_LOG_SECTION_HEADING_PATTERN,
  DEFAULT_META_TAIL_PATTERN,
} = require('./language-packs/registry');

function buildAgentCallResult(agent, text = '', baseResult = {}, overrides = {}, normalizeFilePath = (p) => p) {
  const baseMeta = baseResult?.meta && typeof baseResult.meta === 'object' ? baseResult.meta : {};
  const headers = overrides.headers ?? baseMeta.headers ?? baseResult?.headers ?? {};
  const rawUsage = overrides.rawUsage ?? baseMeta.rawUsage ?? baseResult?.rawUsage ?? null;
  const readFiles = Array.isArray(overrides.readFiles)
    ? overrides.readFiles
    : Array.isArray(baseMeta.readFiles)
      ? baseMeta.readFiles
      : [];
  const meta = {
    provider: String(overrides.provider || baseMeta.provider || getProviderName(agent)).trim(),
    model: String(overrides.model || baseMeta.model || agent?.model || '').trim(),
    stopReason: String(overrides.stopReason || baseMeta.stopReason || '').trim(),
    providerStopReason: String(
      overrides.providerStopReason
      || baseMeta.providerStopReason
      || overrides.stopReason
      || baseMeta.stopReason
      || '',
    ).trim(),
    inputTokens: normalizeTokenCount(
      overrides.inputTokens ?? baseMeta.inputTokens ?? baseResult?.inputTokens,
    ),
    outputTokens: normalizeTokenCount(
      overrides.outputTokens ?? baseMeta.outputTokens ?? baseResult?.outputTokens,
    ),
    headers: headers && typeof headers === 'object' ? headers : {},
    rawUsage,
    readFiles: readFiles
      .map((filePath) => normalizeFilePath(filePath))
      .filter(Boolean),
  };

  if (overrides.turnCount !== undefined) {
    meta.turnCount = normalizeTokenCount(overrides.turnCount);
  }
  if (overrides.toolLoopExhausted !== undefined) {
    meta.toolLoopExhausted = Boolean(overrides.toolLoopExhausted);
  }
  if (overrides.validation) {
    meta.validation = overrides.validation;
  }
  if (overrides.completion) {
    meta.completion = overrides.completion;
  }
  if (overrides.repaired !== undefined) {
    meta.repaired = Boolean(overrides.repaired);
  }
  if (overrides.repairStopReason !== undefined) {
    meta.repairStopReason = String(overrides.repairStopReason || '').trim();
  }
  if (overrides.repairBudgetTokens !== undefined) {
    meta.repairBudgetTokens = normalizeTokenCount(overrides.repairBudgetTokens);
  }
  if (overrides.maxOutputTokens !== undefined || baseMeta.maxOutputTokens !== undefined) {
    meta.maxOutputTokens = normalizeTokenCount(overrides.maxOutputTokens ?? baseMeta.maxOutputTokens);
  }
  if (overrides.configuredMaxOutputTokens !== undefined || baseMeta.configuredMaxOutputTokens !== undefined) {
    meta.configuredMaxOutputTokens = normalizeTokenCount(
      overrides.configuredMaxOutputTokens ?? baseMeta.configuredMaxOutputTokens,
    );
  }
  if (overrides.recommendedOutputTokens !== undefined || baseMeta.recommendedOutputTokens !== undefined) {
    meta.recommendedOutputTokens = normalizeTokenCount(
      overrides.recommendedOutputTokens ?? baseMeta.recommendedOutputTokens,
    );
  }
  if (overrides.autoAdjustedMaxOutputTokens !== undefined || baseMeta.autoAdjustedMaxOutputTokens !== undefined) {
    meta.autoAdjustedMaxOutputTokens = Boolean(
      overrides.autoAdjustedMaxOutputTokens ?? baseMeta.autoAdjustedMaxOutputTokens,
    );
  }
  if (overrides.originalStopReason !== undefined) {
    meta.originalStopReason = String(overrides.originalStopReason || '').trim();
  }
  if (overrides.originalCompletion !== undefined) {
    meta.originalCompletion = String(overrides.originalCompletion || '').trim();
  }

  return {
    text: String(text || ''),
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    headers: meta.headers,
    rawUsage: meta.rawUsage,
    meta,
  };
}

function mapCompletionStatusToLogStatus(status = 'complete') {
  if (status === 'complete') return 'Completed';
  if (status === 'truncated') return 'Truncated';
  if (status === 'invalid') return 'Invalid';
  if (status === 'provider_error') return 'Provider Error';
  return String(status || 'Partial')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function mapCompletionStatusToCheckpointStatus(status = 'complete') {
  return status === 'complete' ? 'done' : String(status || 'partial');
}

function getJsonRawSidecarPath(outputPath = '') {
  const target = String(outputPath || '');
  if (target.endsWith('.json')) return target.slice(0, -5) + '.raw.txt';
  return `${target}.raw.txt`;
}

function writeJsonArtifactWithRaw(outputPath, parsedValue, rawText) {
  const rawPath = getJsonRawSidecarPath(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(parsedValue, null, 2));
  fs.writeFileSync(rawPath, String(rawText || ''));
  return rawPath;
}

function createIncompleteTextOutputError(result, stage = 'unknown') {
  const agentName = result?.name || result?.agent?.name || 'agent';
  const completionStatus = String(result?.completionStatus || 'invalid');
  const stopReason = String(result?.meta?.stopReason || '').trim();
  const outputPath = result?.outputPath || '';
  const stopReasonNote = stopReason ? `, stopReason=${stopReason}` : '';
  const outputNote = outputPath ? `, output=${toRelativePath(outputPath)}` : '';
  const error = new Error(
    `${agentName} returned ${completionStatus} output during ${stage}${stopReasonNote}${outputNote}`,
  );
  error.code = 'AI_INCOMPLETE_TEXT_OUTPUT';
  error.completionStatus = completionStatus;
  error.stopReason = stopReason;
  if (outputPath) error.outputPath = outputPath;
  error.agentName = agentName;
  error.stage = stage;
  return error;
}

function createIncompleteStructuredOutputError(result, stage = 'unknown') {
  const agentName = result?.name || result?.agent?.name || 'agent';
  const completionStatus = String(result?.completionStatus || 'invalid');
  const stopReason = String(result?.meta?.stopReason || '').trim();
  const outputPath = result?.outputPath || '';
  const stopReasonNote = stopReason ? `, stopReason=${stopReason}` : '';
  const outputNote = outputPath ? `, output=${toRelativePath(outputPath)}` : '';
  const error = new Error(
    `${agentName} returned ${completionStatus} structured output during ${stage}${stopReasonNote}${outputNote}`,
  );
  error.code = 'AI_INCOMPLETE_STRUCTURED_OUTPUT';
  error.completionStatus = completionStatus;
  error.stopReason = stopReason;
  if (outputPath) error.outputPath = outputPath;
  error.agentName = agentName;
  error.stage = stage;
  return error;
}

function normalizeApprovalReview(reviewResponse) {
  const parsed = parseApproval(reviewResponse?.text || '');
  let completionStatus = String(reviewResponse?.completionStatus || 'invalid');

  if (completionStatus === 'complete' && !parsed.success) {
    completionStatus = 'invalid';
  }

  const approval = completionStatus === 'complete'
    ? {
        success: true,
        score: parsed.score,
        agreed: parsed.agreed,
        notes: parsed.notes,
        missingSeams: Array.isArray(parsed.missingSeams) ? parsed.missingSeams : [],
      }
    : {
        success: false,
        score: parsed.score,
        agreed: false,
        notes: parsed.notes || `Approval response ${completionStatus}`,
        missingSeams: Array.isArray(parsed.missingSeams) ? parsed.missingSeams : [],
      };

  return {
    completionStatus,
    approval,
  };
}

function sanitizeUserFacingFinalText(finalText = '') {
  const original = String(finalText || '');
  const hadEndMarker = original.includes(END_MARKER);
  let body = stripEndMarker(original).trimEnd();
  let sanitized = false;

  const logHeaderMatch = body.match(DEFAULT_LOG_SECTION_HEADING_PATTERN);
  if (logHeaderMatch) {
    const matchText = logHeaderMatch[0];
    const leadingNewline = matchText.startsWith('\n') ? 1 : 0;
    const cutAt = (logHeaderMatch.index ?? body.length) + leadingNewline;
    body = body.slice(0, cutAt).trimEnd();
    sanitized = true;
  }

  // Strip standalone AI log blocks (=== AI_PLAN_LOG ===, === AI_CHANGE_LOG ===, etc.)
  const aiLogBlockPattern = /(?:^|\n)```[\s\S]*?===\s*AI_(?:PLAN|CHANGE|SESSION)_LOG\b[\s\S]*?```[\s\S]*$/i;
  const aiLogBlockMatch = body.match(aiLogBlockPattern);
  if (aiLogBlockMatch) {
    const matchText = aiLogBlockMatch[0];
    const leadingNewline = matchText.startsWith('\n') ? 1 : 0;
    const cutAt = (aiLogBlockMatch.index ?? body.length) + leadingNewline;
    body = body.slice(0, cutAt).trimEnd();
    sanitized = true;
  }

  const logRefMatch = body.match(/(?:\.ai\/logs\/AI_[A-Z_]+\.md|runs[\\\/]run-\d+)/i);
  if (logRefMatch) {
    const logIndex = logRefMatch.index ?? body.length;
    const prefix = body.slice(0, logIndex);
    const headingCandidates = ['\n### ', '\n## ']
      .map((marker) => prefix.lastIndexOf(marker))
      .filter((index) => index >= 0);
    // Fall back to start of the line containing the log reference
    const lineStart = prefix.lastIndexOf('\n');
    const fallbackCut = lineStart >= 0 ? lineStart + 1 : logIndex;
    const cutAt = headingCandidates.length > 0 ? Math.max(...headingCandidates) + 1 : fallbackCut;
    body = body.slice(0, cutAt).trimEnd();
    sanitized = true;
  }

  const metaTailMatch = body.match(DEFAULT_META_TAIL_PATTERN);
  if (metaTailMatch) {
    const matchText = metaTailMatch[0];
    const leadingNewline = matchText.startsWith('\n') ? 1 : 0;
    const cutAt = (metaTailMatch.index ?? body.length) + leadingNewline;
    body = body.slice(0, cutAt).trimEnd();
    sanitized = true;
  }

  const normalizedBody = body.replace(/\n{3,}/g, '\n\n').trimEnd();
  return {
    text: hadEndMarker ? `${normalizedBody}\n${END_MARKER}` : normalizedBody,
    sanitized,
  };
}

module.exports = {
  buildAgentCallResult,
  mapCompletionStatusToLogStatus,
  mapCompletionStatusToCheckpointStatus,
  getJsonRawSidecarPath,
  writeJsonArtifactWithRaw,
  createIncompleteTextOutputError,
  createIncompleteStructuredOutputError,
  normalizeApprovalReview,
  sanitizeUserFacingFinalText,
};
