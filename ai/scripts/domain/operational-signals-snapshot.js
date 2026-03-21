'use strict';

const fs = require('fs');
const path = require('path');

const CALIBRATED_FORECAST_HISTORY_LIMIT = 6;

function buildOperationalSignalsSnapshot(state, overrides = {}, metricsSummary = {}) {
  const status = String(overrides.status || state.status || '').trim() || 'unknown';
  const endedAt = overrides.endedAt || new Date().toISOString();
  return {
    runId: String(state.runId || '').trim(),
    taskId: String(state.taskId || '').trim(),
    complexity: String(state.complexity || 'standard').trim(),
    status,
    startedAt: state.startedAt || null,
    endedAt,
    runtime: {
      ...(state.runtime || {}),
    },
    finalTrust: state.finalTrust && typeof state.finalTrust === 'object'
      ? {
        ...state.finalTrust,
        contractGapCategories: [...(state.finalTrust.contractGapCategories || [])],
        groundingGapCategories: [...(state.finalTrust.groundingGapCategories || [])],
        contractGapSamples: [...(state.finalTrust.contractGapSamples || [])],
        groundingGapSamples: [...(state.finalTrust.groundingGapSamples || [])],
      }
      : null,
    preflightWaits: {
      count: state.preflightWaits.count,
      totalWaitMs: state.preflightWaits.totalWaitMs,
      events: [...state.preflightWaits.events],
    },
    outputTokenAdjustments: {
      count: state.outputTokenAdjustments.count,
      byStage: { ...state.outputTokenAdjustments.byStage },
      events: [...state.outputTokenAdjustments.events],
    },
    retries: {
      count: state.retries.count,
      rateLimitCount: state.retries.rateLimitCount,
      events: [...state.retries.events],
    },
    repairs: {
      attempted: state.repairs.attempted,
      succeeded: state.repairs.succeeded,
      failed: state.repairs.failed,
      events: [...state.repairs.events],
    },
    toolLoopExhaustions: {
      count: state.toolLoopExhaustions.count,
      events: [...state.toolLoopExhaustions.events],
    },
    incompleteOutputs: {
      count: state.incompleteOutputs.count,
      byStage: { ...state.incompleteOutputs.byStage },
      events: [...state.incompleteOutputs.events],
    },
    promptScope: {
      risk: String(state.promptScope?.risk || 'none').trim() || 'none',
      warningIssued: Boolean(state.promptScope?.warningIssued),
      suggestionAvailable: Boolean(state.promptScope?.suggestionAvailable),
      notes: [...(state.promptScope?.notes || [])],
      warningPath: String(state.promptScope?.warningPath || '').trim(),
      suggestedPromptPath: String(state.promptScope?.suggestedPromptPath || '').trim(),
      events: [...(state.promptScope?.events || [])],
    },
    critiqueExpansion: {
      triggered: Boolean(state.critiqueExpansion.triggered),
      count: Number(state.critiqueExpansion.count) || 0,
      requestedSeams: [...(state.critiqueExpansion.requestedSeams || [])],
      fetchedSeams: [...(state.critiqueExpansion.fetchedSeams || [])],
      skippedSeams: [...(state.critiqueExpansion.skippedSeams || [])],
      expansionRound: Number(state.critiqueExpansion.expansionRound) || 0,
      expansionBytes: Number(state.critiqueExpansion.expansionBytes) || 0,
      events: [...(state.critiqueExpansion.events || [])],
    },
    roundRationalization: {
      tokensBeforeFirstSeamFetch: state.roundRationalization?.tokensBeforeFirstSeamFetch === null
        || state.roundRationalization?.tokensBeforeFirstSeamFetch === undefined
        ? null
        : Number(state.roundRationalization.tokensBeforeFirstSeamFetch),
      approvalRoundsWithZeroNewSeams: Number(state.roundRationalization?.approvalRoundsWithZeroNewSeams) || 0,
      trustDeltaPerRound: [...(state.roundRationalization?.trustDeltaPerRound || [])],
      callsAvoidedByGating: {
        devilsAdvocateSkipped: Number(state.roundRationalization?.callsAvoidedByGating?.devilsAdvocateSkipped) || 0,
        testerDiagnosticMode: Number(state.roundRationalization?.callsAvoidedByGating?.testerDiagnosticMode) || 0,
        testerPatchValidationMode: Number(state.roundRationalization?.callsAvoidedByGating?.testerPatchValidationMode) || 0,
      },
      critiqueSeamOverlap: state.roundRationalization?.critiqueSeamOverlap === null
        || state.roundRationalization?.critiqueSeamOverlap === undefined
        ? null
        : Number(state.roundRationalization.critiqueSeamOverlap),
      noMaterialProgressStops: Number(state.roundRationalization?.noMaterialProgressStops) || 0,
      events: [...(state.roundRationalization?.events || [])],
    },
    summary: {
      agentCount: Number(metricsSummary.agentCount) || 0,
      totalInputTokens: metricsSummary.totalInputTokens ?? null,
      totalOutputTokens: metricsSummary.totalOutputTokens ?? null,
      consensusRounds: Number(metricsSummary.consensusRounds) || 0,
      avgConfidence: metricsSummary.avgConfidence ?? null,
    },
  };
}

function findRecentRunFlowsWithSignals(baseDir, limit = CALIBRATED_FORECAST_HISTORY_LIMIT, seenRunIds = new Set()) {
  if (!baseDir || !fs.existsSync(baseDir)) return [];
  const entries = fs.readdirSync(baseDir).filter((name) => {
    const fullPath = path.join(baseDir, name);
    return name.startsWith('run-') && fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  }).sort((a, b) => b.localeCompare(a));

  const flows = [];
  for (const entry of entries) {
    if (flows.length >= limit) break;
    const flowPath = path.join(baseDir, entry, 'run-flow.json');
    if (!fs.existsSync(flowPath)) continue;
    try {
      const flow = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
      if (!flow || flow.version !== 1 || !flow.runId || seenRunIds.has(flow.runId)) continue;
      if (!flow.operationalSignals || typeof flow.operationalSignals !== 'object') continue;
      flows.push(flow);
      seenRunIds.add(flow.runId);
    } catch {
      // ignore malformed archived runs
    }
  }
  return flows;
}

function loadRecentOperationalSignalRuns(layout, limit = CALIBRATED_FORECAST_HISTORY_LIMIT) {
  const resolvedLimit = Math.max(1, Number(limit) || CALIBRATED_FORECAST_HISTORY_LIMIT);
  const seenRunIds = new Set();
  const fromRuns = findRecentRunFlowsWithSignals(layout.runsDir, resolvedLimit, seenRunIds);
  if (fromRuns.length >= resolvedLimit) return fromRuns.slice(0, resolvedLimit);
  const legacy = findRecentRunFlowsWithSignals(
    layout.legacyArchiveDir,
    resolvedLimit - fromRuns.length,
    seenRunIds,
  );
  return [...fromRuns, ...legacy].slice(0, resolvedLimit);
}

module.exports = {
  CALIBRATED_FORECAST_HISTORY_LIMIT,
  buildOperationalSignalsSnapshot,
  findRecentRunFlowsWithSignals,
  loadRecentOperationalSignalRuns,
};
