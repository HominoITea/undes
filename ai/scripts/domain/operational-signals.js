const { normalizeForecastStage } = require('./forecast');

function createOperationalSignalsState() {
  return {
    runId: '',
    taskId: '',
    complexity: 'standard',
    status: 'not-started',
    startedAt: null,
    endedAt: null,
    runtime: {},
    finalTrust: null,
    preflightWaits: { count: 0, totalWaitMs: 0, events: [] },
    outputTokenAdjustments: { count: 0, byStage: {}, events: [] },
    retries: { count: 0, rateLimitCount: 0, events: [] },
    repairs: { attempted: 0, succeeded: 0, failed: 0, events: [] },
    toolLoopExhaustions: { count: 0, events: [] },
    incompleteOutputs: { count: 0, byStage: {}, events: [] },
    promptScope: {
      risk: 'none',
      warningIssued: false,
      suggestionAvailable: false,
      notes: [],
      warningPath: '',
      suggestedPromptPath: '',
      events: [],
    },
    critiqueExpansion: {
      triggered: false,
      count: 0,
      requestedSeams: [],
      fetchedSeams: [],
      skippedSeams: [],
      expansionRound: 0,
      expansionBytes: 0,
      events: [],
    },
    roundRationalization: {
      tokensBeforeFirstSeamFetch: null,
      approvalRoundsWithZeroNewSeams: 0,
      trustDeltaPerRound: [],
      callsAvoidedByGating: {
        devilsAdvocateSkipped: 0,
        testerDiagnosticSkipped: 0,
        testerDiagnosticMode: 0,
        testerPatchValidationMode: 0,
      },
      critiqueSeamOverlap: null,
      noMaterialProgressStops: 0,
      events: [],
    },
  };
}

function pushBoundedSignalEvent(bucket, event, limit = 25) {
  if (!bucket || !Array.isArray(bucket.events)) return;
  bucket.events.push(event);
  if (bucket.events.length > limit) {
    bucket.events = bucket.events.slice(-limit);
  }
}

function recordPreflightWaitSignal(state, details = {}) {
  if (!state || !state.preflightWaits) return;
  const waitMs = Number(details.waitMs) || 0;
  if (waitMs <= 0) return;
  state.preflightWaits.count += 1;
  state.preflightWaits.totalWaitMs += waitMs;
  pushBoundedSignalEvent(state.preflightWaits, {
    timestamp: new Date().toISOString(),
    agent: details.agent || 'agent',
    provider: details.provider || 'other',
    stage: details.stage || 'unknown',
    waitMs,
    estimatedInputTokens: Number(details.estimatedInputTokens) || 0,
    reason: String(details.reason || '').trim(),
  });
}

function recordOutputTokenAdjustmentSignal(state, details = {}) {
  if (!state || !state.outputTokenAdjustments) return;
  const stage = normalizeForecastStage(details.stage || 'unknown');
  state.outputTokenAdjustments.count += 1;
  state.outputTokenAdjustments.byStage[stage] = (state.outputTokenAdjustments.byStage[stage] || 0) + 1;
  pushBoundedSignalEvent(state.outputTokenAdjustments, {
    timestamp: new Date().toISOString(),
    agent: details.agent || 'agent',
    provider: details.provider || 'other',
    stage,
    estimatedInputTokens: Number(details.estimatedInputTokens) || 0,
    configuredTokens: Number(details.configuredTokens) || 0,
    recommendedTokens: Number(details.recommendedTokens) || 0,
    effectiveTokens: Number(details.effectiveTokens) || 0,
    ceilingTokens: Number(details.ceilingTokens) || 0,
    source: String(details.source || 'auto').trim() || 'auto',
  });
}

function recordRetrySignal(state, details = {}) {
  if (!state || !state.retries) return;
  state.retries.count += 1;
  if (details.isRateLimit) state.retries.rateLimitCount += 1;
  pushBoundedSignalEvent(state.retries, {
    timestamp: new Date().toISOString(),
    agent: details.agent || 'agent',
    provider: details.provider || 'other',
    stage: details.stage || 'unknown',
    attempt: Number(details.attempt) || 0,
    willRetry: Boolean(details.willRetry),
    isRateLimit: Boolean(details.isRateLimit),
    delayMs: Number(details.delayMs) || 0,
    errorName: String(details.errorName || '').trim(),
    message: String(details.message || '').slice(0, 200),
  });
}

function recordRepairSignal(state, details = {}) {
  if (!state || !state.repairs) return;
  const outcome = String(details.outcome || 'attempted').trim();
  if (outcome === 'attempted') state.repairs.attempted += 1;
  if (outcome === 'succeeded') state.repairs.succeeded += 1;
  if (outcome === 'failed') state.repairs.failed += 1;
  pushBoundedSignalEvent(state.repairs, {
    timestamp: new Date().toISOString(),
    agent: details.agent || 'agent',
    stage: details.stage || 'unknown',
    outcome,
    stopReason: String(details.stopReason || '').trim(),
    repairStopReason: String(details.repairStopReason || '').trim(),
    budgetTokens: Number(details.budgetTokens) || 0,
  });
}

function recordToolLoopSignal(state, details = {}) {
  if (!state || !state.toolLoopExhaustions) return;
  state.toolLoopExhaustions.count += 1;
  pushBoundedSignalEvent(state.toolLoopExhaustions, {
    timestamp: new Date().toISOString(),
    agent: details.agent || 'agent',
    provider: details.provider || 'other',
    stage: details.stage || 'unknown',
    turnCount: Number(details.turnCount) || 0,
    totalBytes: Number(details.totalBytes) || 0,
  });
}

function recordIncompleteOutputSignal(state, details = {}) {
  if (!state || !state.incompleteOutputs) return;
  const stage = String(details.stage || 'unknown').trim() || 'unknown';
  state.incompleteOutputs.count += 1;
  state.incompleteOutputs.byStage[stage] = (state.incompleteOutputs.byStage[stage] || 0) + 1;
  pushBoundedSignalEvent(state.incompleteOutputs, {
    timestamp: new Date().toISOString(),
    agent: details.agent || 'agent',
    provider: details.provider || 'other',
    stage,
    completionStatus: String(details.completionStatus || '').trim(),
    stopReason: String(details.stopReason || '').trim(),
    outputPath: String(details.outputPath || '').trim(),
  });
}

function recordPromptScopeSignal(state, details = {}) {
  if (!state || !state.promptScope) return;
  const risk = String(details.risk || 'none').trim() || 'none';
  state.promptScope.risk = risk;
  state.promptScope.warningIssued = Boolean(details.warningIssued);
  state.promptScope.suggestionAvailable = Boolean(details.suggestionAvailable);
  state.promptScope.notes = Array.isArray(details.notes)
    ? details.notes.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  state.promptScope.warningPath = String(details.warningPath || '').trim();
  state.promptScope.suggestedPromptPath = String(details.suggestedPromptPath || '').trim();
  pushBoundedSignalEvent(state.promptScope, {
    timestamp: new Date().toISOString(),
    risk,
    warningIssued: Boolean(details.warningIssued),
    suggestionAvailable: Boolean(details.suggestionAvailable),
    warningPath: String(details.warningPath || '').trim(),
    suggestedPromptPath: String(details.suggestedPromptPath || '').trim(),
  });
}

function recordCritiqueExpansionSignal(state, details = {}) {
  if (!state || !state.critiqueExpansion) return;
  const requestedSeams = Array.isArray(details.requestedSeams)
    ? details.requestedSeams.map((item) => String(item?.symbolOrSeam || '').trim()).filter(Boolean)
    : [];
  const fetchedSeams = Array.isArray(details.fetchedSeams)
    ? details.fetchedSeams.map((item) => ({
      symbolOrSeam: String(item?.symbolOrSeam || '').trim(),
      file: String(item?.file || '').trim(),
      startLine: Number(item?.startLine) || 0,
      endLine: Number(item?.endLine) || 0,
      source: String(item?.source || '').trim(),
    })).filter((item) => item.symbolOrSeam)
    : [];
  const skippedSeams = Array.isArray(details.skippedSeams)
    ? details.skippedSeams.map((item) => ({
      symbolOrSeam: String(item?.request?.symbolOrSeam || '').trim(),
      reason: String(item?.reason || '').trim(),
    })).filter((item) => item.symbolOrSeam || item.reason)
    : [];

  state.critiqueExpansion.triggered = state.critiqueExpansion.triggered || Boolean(details.triggered);
  state.critiqueExpansion.count += 1;
  state.critiqueExpansion.requestedSeams = requestedSeams;
  state.critiqueExpansion.fetchedSeams = fetchedSeams;
  state.critiqueExpansion.skippedSeams = skippedSeams;
  state.critiqueExpansion.expansionRound = Number(details.expansionRound) || state.critiqueExpansion.expansionRound || 0;
  state.critiqueExpansion.expansionBytes = Number(details.expansionBytes) || 0;
  pushBoundedSignalEvent(state.critiqueExpansion, {
    timestamp: new Date().toISOString(),
    triggered: Boolean(details.triggered),
    expansionRound: Number(details.expansionRound) || 0,
    reason: String(details.reason || '').trim(),
    requestedCount: requestedSeams.length,
    fetchedCount: fetchedSeams.length,
    skippedCount: skippedSeams.length,
    expansionBytes: Number(details.expansionBytes) || 0,
  });
}

function recordTokensBeforeFirstSeamFetchSignal(state, details = {}) {
  if (!state || !state.roundRationalization) return;
  if (state.roundRationalization.tokensBeforeFirstSeamFetch !== null) return;
  const tokens = Number(details.tokens);
  if (!Number.isFinite(tokens) || tokens < 0) return;
  state.roundRationalization.tokensBeforeFirstSeamFetch = tokens;
  pushBoundedSignalEvent(state.roundRationalization, {
    timestamp: new Date().toISOString(),
    type: 'tokens-before-first-seam-fetch',
    stage: String(details.stage || '').trim(),
    tokens,
  });
}

function recordApprovalZeroNewSeamsSignal(state, details = {}) {
  if (!state || !state.roundRationalization) return;
  state.roundRationalization.approvalRoundsWithZeroNewSeams += 1;
  pushBoundedSignalEvent(state.roundRationalization, {
    timestamp: new Date().toISOString(),
    type: 'approval-zero-new-seams',
    roundNumber: Number(details.roundNumber) || 0,
    seamCount: Number(details.seamCount) || 0,
  });
}

function recordTrustDeltaPerRoundSignal(state, details = {}) {
  if (!state || !state.roundRationalization) return;
  const event = {
    timestamp: new Date().toISOString(),
    type: 'trust-delta-per-round',
    label: String(details.label || '').trim(),
    roundNumber: Number(details.roundNumber) || 0,
    contractGapCount: Number(details.contractGapCount) || 0,
    groundingGapCount: Number(details.groundingGapCount) || 0,
    contractGapDelta: Number.isFinite(Number(details.contractGapDelta)) ? Number(details.contractGapDelta) : null,
    groundingGapDelta: Number.isFinite(Number(details.groundingGapDelta)) ? Number(details.groundingGapDelta) : null,
  };
  state.roundRationalization.trustDeltaPerRound.push(event);
  if (state.roundRationalization.trustDeltaPerRound.length > 12) {
    state.roundRationalization.trustDeltaPerRound = state.roundRationalization.trustDeltaPerRound.slice(-12);
  }
  pushBoundedSignalEvent(state.roundRationalization, event);
}

function recordCallGatingSignal(state, details = {}) {
  if (!state || !state.roundRationalization) return;
  const phase = String(details.phase || '').trim();
  const action = String(details.action || '').trim();
  if (phase === 'devils-advocate' && action === 'skipped') {
    state.roundRationalization.callsAvoidedByGating.devilsAdvocateSkipped += 1;
  }
  if (phase === 'tester' && action === 'skipped' && String(details.reason || '').trim() === 'diagnostic-result') {
    state.roundRationalization.callsAvoidedByGating.testerDiagnosticSkipped += 1;
  }
  if (phase === 'tester' && action === 'diagnostic-review') {
    state.roundRationalization.callsAvoidedByGating.testerDiagnosticMode += 1;
  }
  if (phase === 'tester' && action === 'patch-validation') {
    state.roundRationalization.callsAvoidedByGating.testerPatchValidationMode += 1;
  }
  pushBoundedSignalEvent(state.roundRationalization, {
    timestamp: new Date().toISOString(),
    type: 'call-gating',
    phase,
    action,
    reason: String(details.reason || '').trim(),
  });
}

function recordCritiqueSeamOverlapSignal(state, details = {}) {
  if (!state || !state.roundRationalization) return;
  const percent = Number(details.percent);
  const total = Number(details.total) || 0;
  const matched = Number(details.matched) || 0;
  state.roundRationalization.critiqueSeamOverlap = Number.isFinite(percent) ? percent : null;
  pushBoundedSignalEvent(state.roundRationalization, {
    timestamp: new Date().toISOString(),
    type: 'critique-seam-overlap',
    percent: Number.isFinite(percent) ? percent : null,
    matched,
    total,
  });
}

function recordNoMaterialProgressStopSignal(state, details = {}) {
  if (!state || !state.roundRationalization) return;
  state.roundRationalization.noMaterialProgressStops += 1;
  pushBoundedSignalEvent(state.roundRationalization, {
    timestamp: new Date().toISOString(),
    type: 'no-material-progress-stop',
    roundNumber: Number(details.roundNumber) || 0,
    reason: String(details.reason || '').trim(),
  });
}

module.exports = {
  createOperationalSignalsState,
  pushBoundedSignalEvent,
  recordPreflightWaitSignal,
  recordOutputTokenAdjustmentSignal,
  recordRetrySignal,
  recordRepairSignal,
  recordToolLoopSignal,
  recordIncompleteOutputSignal,
  recordPromptScopeSignal,
  recordCritiqueExpansionSignal,
  recordTokensBeforeFirstSeamFetchSignal,
  recordApprovalZeroNewSeamsSignal,
  recordTrustDeltaPerRoundSignal,
  recordCallGatingSignal,
  recordCritiqueSeamOverlapSignal,
  recordNoMaterialProgressStopSignal,
};
