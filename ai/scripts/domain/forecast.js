const { getProviderName, getProviderLabel } = require('../infrastructure/providers');

const STAGE_BASE_OUTPUT_RECOMMENDATIONS = {
  'pre-process': 1200,
  proposal: 1800,
  critique: 2048,
  approval: 384,
  consensus: 1800,
  'devil-advocate': 1200,
  'post-process': 1600,
};
const FORECAST_CONTEXT_PRESSURE_THRESHOLDS = {
  medium: 0.65,
  high: 0.85,
};
const FORECAST_OUTPUT_PRESSURE_THRESHOLDS = {
  medium: 1,
  high: 0.75,
};
// These thresholds mirror the Anthropic tier pressure we observed in live pilot runs:
// warning early above ~10k input tokens and treating ~14k+ as a high-risk slice
// before the 30k ITPM ceiling is actually exhausted.
const FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS = {
  medium: 10000,
  high: 14000,
};
const FORECAST_TOOL_LOOP_PRESSURE = {
  minInputTokens: 8000,
  budgetRatio: 0.6,
};
const CALIBRATED_FORECAST_THRESHOLDS = {
  incompleteRuns: { medium: 1, high: 2 },
  preflightWaitMs: { medium: 15000, high: 30000 },
  preflightWaitRuns: { medium: 1, high: 2 },
  retryRuns: { medium: 1, high: 2 },
  rateLimitRetryRuns: { high: 1 },
  toolLoopRuns: { medium: 1, high: 2 },
  repairFailureRuns: { medium: 1, high: 2 },
};

function normalizeForecastStage(stage = 'unknown') {
  let normalized = String(stage || 'unknown').toLowerCase();
  if (normalized.startsWith('approval-')) return 'approval';
  normalized = normalized.replace(/-(retry|repair|tool-budget-final)$/, '');
  return normalized;
}

function buildForecastCalibration(signalRuns = [], { agentName = '', provider = 'other', stage = 'unknown' } = {}) {
  const stageKey = normalizeForecastStage(stage);
  const normalizedAgent = String(agentName || '').trim().toLowerCase();
  const normalizedProvider = String(provider || 'other').trim().toLowerCase() || 'other';
  const runs = Array.isArray(signalRuns) ? signalRuns : [];
  const summary = {
    runsAnalyzed: runs.length,
    incompleteRuns: 0,
    retryRuns: 0,
    rateLimitRetryRuns: 0,
    toolLoopRuns: 0,
    repairFailureRuns: 0,
    preflightWaitRuns: 0,
    maxHistoricalWaitMs: 0,
  };

  const matchesAgentStage = (event = {}, options = {}) => {
    const eventAgent = String(event.agent || '').trim().toLowerCase();
    const eventStage = normalizeForecastStage(event.stage || 'unknown');
    if (normalizedAgent && eventAgent !== normalizedAgent) return false;
    if (eventStage !== stageKey) return false;
    if (options.requireProvider !== false) {
      const eventProvider = String(event.provider || 'other').trim().toLowerCase() || 'other';
      if (eventProvider !== normalizedProvider) return false;
    }
    return true;
  };

  for (const flow of runs) {
    const signals = flow?.operationalSignals;
    if (!signals || typeof signals !== 'object') continue;

    const waits = Array.isArray(signals.preflightWaits?.events)
      ? signals.preflightWaits.events.filter((event) => matchesAgentStage(event))
      : [];
    if (waits.length > 0) {
      summary.preflightWaitRuns += 1;
      summary.maxHistoricalWaitMs = Math.max(
        summary.maxHistoricalWaitMs,
        ...waits.map((event) => Number(event.waitMs) || 0),
      );
    }

    const retries = Array.isArray(signals.retries?.events)
      ? signals.retries.events.filter((event) => matchesAgentStage(event))
      : [];
    if (retries.length > 0) {
      summary.retryRuns += 1;
      if (retries.some((event) => event.isRateLimit === true)) {
        summary.rateLimitRetryRuns += 1;
      }
    }

    const toolLoops = Array.isArray(signals.toolLoopExhaustions?.events)
      ? signals.toolLoopExhaustions.events.filter((event) => matchesAgentStage(event))
      : [];
    if (toolLoops.length > 0) {
      summary.toolLoopRuns += 1;
    }

    const incomplete = Array.isArray(signals.incompleteOutputs?.events)
      ? signals.incompleteOutputs.events.filter((event) => matchesAgentStage(event))
      : [];
    if (incomplete.length > 0) {
      summary.incompleteRuns += 1;
    }

    const repairs = Array.isArray(signals.repairs?.events)
      ? signals.repairs.events.filter((event) => matchesAgentStage(event, { requireProvider: false }))
      : [];
    if (repairs.some((event) => String(event.outcome || '').trim() === 'failed')) {
      summary.repairFailureRuns += 1;
    }
  }

  return summary;
}

function getRecommendedOutputTokensForStage(stage = 'unknown', estimatedInputTokens = 0) {
  const stageKey = normalizeForecastStage(stage);
  const base = STAGE_BASE_OUTPUT_RECOMMENDATIONS[stageKey] || 1600;
  if (stageKey === 'approval') {
    return base;
  }
  if (stageKey === 'critique') {
    if (estimatedInputTokens > FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS.high) return 8192;
    if (estimatedInputTokens > 8000) return 4096;
    return base;
  }
  if (stageKey === 'proposal') {
    if (estimatedInputTokens > FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS.high) return 8192;
    if (estimatedInputTokens > 9000) return 6144;
    return base;
  }
  if (stageKey === 'consensus' || stageKey === 'revision' || stageKey === 'da-revision') {
    if (estimatedInputTokens > 22000) return 8192;
    if (estimatedInputTokens > FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS.high) return 6144;
    if (estimatedInputTokens > 9000) return 4096;
    return base;
  }
  if (estimatedInputTokens > FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS.medium) return base + 600;
  return base;
}

function getRiskWeight(level) {
  if (level === 'high') return 3;
  if (level === 'medium') return 2;
  return 1;
}

function getRiskLabel(level) {
  if (level === 'high') return 'HIGH';
  if (level === 'medium') return 'MEDIUM';
  return 'LOW';
}

function computeAgentPhaseRiskForecast({
  agent,
  stage,
  estimatedInputTokens,
  contextBudget,
  maxOutputTokens,
  rateLimitSnapshot,
  contextPackActive,
  treeTruncated,
  treeLimit,
  calibration = null,
}) {
  const provider = getProviderName(agent);
  const providerLabel = getProviderLabel(provider);
  const stageKey = normalizeForecastStage(stage);
  const risks = [];
  const safeContextBudget = Number(contextBudget) || 0;
  const safeMaxOutputTokens = Number(maxOutputTokens) || 0;
  const recommendedOutputTokens = getRecommendedOutputTokensForStage(stageKey, estimatedInputTokens);

  const pushRisk = (level, label, detail) => {
    risks.push({ level, label, detail, weight: getRiskWeight(level) });
  };

  if (safeContextBudget > 0) {
    const ratio = estimatedInputTokens / safeContextBudget;
    if (ratio >= FORECAST_CONTEXT_PRESSURE_THRESHOLDS.high) {
      pushRisk('high', 'input pressure', `~${estimatedInputTokens}/${safeContextBudget} context tokens`);
    } else if (ratio >= FORECAST_CONTEXT_PRESSURE_THRESHOLDS.medium) {
      pushRisk('medium', 'input pressure', `~${estimatedInputTokens}/${safeContextBudget} context tokens`);
    }
  }

  if (safeMaxOutputTokens > 0 && recommendedOutputTokens > 0) {
    const outputRatio = safeMaxOutputTokens / recommendedOutputTokens;
    if (outputRatio < FORECAST_OUTPUT_PRESSURE_THRESHOLDS.high) {
      pushRisk('high', 'MAX_TOKENS risk', `cap ${safeMaxOutputTokens}, recommended ${recommendedOutputTokens}`);
    } else if (outputRatio < FORECAST_OUTPUT_PRESSURE_THRESHOLDS.medium) {
      pushRisk('medium', 'MAX_TOKENS risk', `cap ${safeMaxOutputTokens}, recommended ${recommendedOutputTokens}`);
    }
  }

  const preflight = computePreflightRateLimitDelayMs(rateLimitSnapshot, estimatedInputTokens);
  if (preflight.waitMs > 0) {
    pushRisk(
      'high',
      'rate-limit wait likely',
      `~${Math.max(1, Math.round(preflight.waitMs / 1000))}s (${preflight.reason || 'budget pressure'})`,
    );
  } else if (provider === 'anthropic') {
    if (estimatedInputTokens > FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS.high) {
      pushRisk('high', 'ITPM risk', `Anthropic input ~${estimatedInputTokens} tokens`);
    } else if (estimatedInputTokens > FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS.medium) {
      pushRisk('medium', 'ITPM risk', `Anthropic input ~${estimatedInputTokens} tokens`);
    }
  }

  if (stageKey === 'proposal' || stageKey === 'critique') {
    const isPrimaryReader = ['architect', 'reviewer'].includes(String(agent?.name || '').toLowerCase());
    if (treeTruncated) {
      pushRisk(
        isPrimaryReader ? 'high' : 'medium',
        'tool-loop risk',
        `tree capped at ${treeLimit} files${contextPackActive ? ', context pack active' : ''}`,
      );
    } else if (
      contextPackActive
      && estimatedInputTokens > Math.max(
        FORECAST_TOOL_LOOP_PRESSURE.minInputTokens,
        Math.floor(safeContextBudget * FORECAST_TOOL_LOOP_PRESSURE.budgetRatio),
      )
    ) {
      pushRisk('medium', 'tool-loop pressure', 'context pack active with high code-analysis load');
    }
  }

  const calibrated = calibration && Number(calibration.runsAnalyzed) > 0 ? calibration : null;
  if (calibrated) {
    const historyLabel = `${calibrated.runsAnalyzed} recent run${calibrated.runsAnalyzed === 1 ? '' : 's'}`;

    if (calibrated.incompleteRuns >= CALIBRATED_FORECAST_THRESHOLDS.incompleteRuns.high) {
      pushRisk('high', 'historical truncation', `${calibrated.incompleteRuns}/${historyLabel}`);
    } else if (calibrated.incompleteRuns >= CALIBRATED_FORECAST_THRESHOLDS.incompleteRuns.medium) {
      pushRisk('medium', 'historical truncation', `${calibrated.incompleteRuns}/${historyLabel}`);
    }

    if (
      calibrated.maxHistoricalWaitMs >= CALIBRATED_FORECAST_THRESHOLDS.preflightWaitMs.high
      || calibrated.preflightWaitRuns >= CALIBRATED_FORECAST_THRESHOLDS.preflightWaitRuns.high
    ) {
      pushRisk(
        'high',
        'historical wait pressure',
        `max ~${Math.max(1, Math.round(calibrated.maxHistoricalWaitMs / 1000))}s across ${historyLabel}`,
      );
    } else if (calibrated.preflightWaitRuns >= CALIBRATED_FORECAST_THRESHOLDS.preflightWaitRuns.medium) {
      pushRisk(
        'medium',
        'historical wait pressure',
        `max ~${Math.max(1, Math.round(calibrated.maxHistoricalWaitMs / 1000))}s across ${historyLabel}`,
      );
    }

    if (calibrated.rateLimitRetryRuns >= CALIBRATED_FORECAST_THRESHOLDS.rateLimitRetryRuns.high) {
      pushRisk('high', 'historical rate-limit retries', `${calibrated.rateLimitRetryRuns}/${historyLabel}`);
    } else if (calibrated.retryRuns >= CALIBRATED_FORECAST_THRESHOLDS.retryRuns.medium) {
      pushRisk('medium', 'historical retries', `${calibrated.retryRuns}/${historyLabel}`);
    }

    if (calibrated.toolLoopRuns >= CALIBRATED_FORECAST_THRESHOLDS.toolLoopRuns.high) {
      pushRisk('high', 'historical tool-loop pressure', `${calibrated.toolLoopRuns}/${historyLabel}`);
    } else if (calibrated.toolLoopRuns >= CALIBRATED_FORECAST_THRESHOLDS.toolLoopRuns.medium) {
      pushRisk('medium', 'historical tool-loop pressure', `${calibrated.toolLoopRuns}/${historyLabel}`);
    }

    if (calibrated.repairFailureRuns >= CALIBRATED_FORECAST_THRESHOLDS.repairFailureRuns.high) {
      pushRisk('high', 'historical repair failures', `${calibrated.repairFailureRuns}/${historyLabel}`);
    } else if (calibrated.repairFailureRuns >= CALIBRATED_FORECAST_THRESHOLDS.repairFailureRuns.medium) {
      pushRisk('medium', 'historical repair failures', `${calibrated.repairFailureRuns}/${historyLabel}`);
    }
  }

  risks.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
  const overall = risks[0]?.level || 'low';
  const details = risks.length > 0
    ? risks.slice(0, 3).map((risk) => `${risk.label} (${risk.detail})`)
    : ['no elevated risk signals'];

  return {
    agentName: agent?.name || 'agent',
    provider,
    providerLabel,
    stage,
    estimatedInputTokens,
    contextBudget: safeContextBudget,
    maxOutputTokens: safeMaxOutputTokens,
    recommendedOutputTokens,
    calibrationRunsAnalyzed: calibrated?.runsAnalyzed || 0,
    overall,
    details,
  };
}

function buildPhaseRiskForecastLines({
  phaseLabel,
  forecasts,
  treeTruncated,
  treeLimit,
  packedTreeLimit,
  contextPackActive,
}) {
  const lines = [`🔮 ${phaseLabel} risk forecast:`];
  const calibrationRuns = Array.isArray(forecasts)
    ? Math.max(0, ...forecasts.map((forecast) => Number(forecast.calibrationRunsAnalyzed) || 0))
    : 0;

  if (calibrationRuns > 0) {
    lines.push(`   calibrated with ${calibrationRuns} recent run${calibrationRuns === 1 ? '' : 's'}`);
  }

  if (treeTruncated) {
    lines.push(
      `   context tree: hard-capped at ${treeLimit} files`
      + (contextPackActive ? ` (packedTreeLimit=${packedTreeLimit}, context pack on)` : ''),
    );
  }

  if (!Array.isArray(forecasts) || forecasts.length === 0) {
    lines.push('   No active agents for this phase.');
    return lines;
  }

  for (const forecast of forecasts) {
    lines.push(
      `   ${forecast.agentName}: ${getRiskLabel(forecast.overall)}`
      + ` — ${forecast.details.join('; ')}`,
    );
  }

  return lines;
}

function computeTokenReserve(estimatedInputTokens) {
  if (!Number.isFinite(estimatedInputTokens) || estimatedInputTokens <= 0) return 64;
  return Math.max(64, Math.min(256, Math.ceil(estimatedInputTokens * 0.02)));
}

function computePreflightRateLimitDelayMs(snapshot, estimatedInputTokens, nowMs = Date.now()) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { waitMs: 0, reason: '', reserveTokens: computeTokenReserve(estimatedInputTokens) };
  }

  const reserveTokens = computeTokenReserve(estimatedInputTokens);
  let waitMs = 0;
  let reason = '';

  const inputTokens = snapshot.inputTokens;
  if (
    inputTokens
    && Number.isFinite(inputTokens.remaining)
    && Number.isFinite(inputTokens.resetAt)
    && inputTokens.resetAt > nowMs
    && estimatedInputTokens + reserveTokens > inputTokens.remaining
  ) {
    waitMs = Math.max(waitMs, inputTokens.resetAt - nowMs);
    reason = `input tokens remaining ${inputTokens.remaining}${Number.isFinite(inputTokens.limit) ? `/${inputTokens.limit}` : ''}`;
  }

  const requests = snapshot.requests;
  if (
    requests
    && Number.isFinite(requests.remaining)
    && Number.isFinite(requests.resetAt)
    && requests.resetAt > nowMs
    && requests.remaining <= 0
  ) {
    if (requests.resetAt - nowMs >= waitMs) {
      reason = `requests remaining ${requests.remaining}${Number.isFinite(requests.limit) ? `/${requests.limit}` : ''}`;
    }
    waitMs = Math.max(waitMs, requests.resetAt - nowMs);
  }

  return { waitMs: Math.max(0, waitMs), reason, reserveTokens };
}

module.exports = {
  STAGE_BASE_OUTPUT_RECOMMENDATIONS,
  FORECAST_CONTEXT_PRESSURE_THRESHOLDS,
  FORECAST_OUTPUT_PRESSURE_THRESHOLDS,
  FORECAST_ANTHROPIC_ITPM_INPUT_THRESHOLDS,
  FORECAST_TOOL_LOOP_PRESSURE,
  CALIBRATED_FORECAST_THRESHOLDS,
  normalizeForecastStage,
  buildForecastCalibration,
  getRecommendedOutputTokensForStage,
  getRiskWeight,
  getRiskLabel,
  computeAgentPhaseRiskForecast,
  buildPhaseRiskForecastLines,
  computeTokenReserve,
  computePreflightRateLimitDelayMs,
};
