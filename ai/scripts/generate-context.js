const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const execSync = require('child_process').execSync;
const {
  resolveIndexConfig,
  resolveMode,
  loadCodeIndex,
  saveCodeIndex,
  buildCodeIndex,
} = require('./context-index');
const { buildContextPack } = require('./context-pack');
const {
  buildCritiqueExpansionAppendix,
  collectMissingSeamsFromApprovalOutputs,
  normalizeMissingSeams,
  resolveMissingSeams,
  shouldTriggerCritiqueExpansion,
} = require('./critique-expansion');
const promptGate = require('./prompt-gate');
const responseValidator = require('./response-validator');
const {
  readJsonIfExists,
  mergeAgentsConfig,
  resolveReadablePath: resolveReadablePathWithFallbacks,
  loadContextConfig,
} = require('./config-loader');
const checkpoint = require('./checkpoint-manager');
const { loadLatestArchivedRun, loadPreviousDiscussion, buildRefinementContent } = require('./refinement');
const { isSameOrSubPath, resolveProjectLayout } = require('./path-utils');
const { resolveHubFileForRead } = require('./hub-config-paths');
const {
  parseConfidence,
  calculateAverageConfidence,
  computeAgreementScore,
  shouldTriggerRevision,
} = require('./domain/quality-metrics');
const {
  RESULT_MODE_PATCH_SAFE,
  normalizeProjectRelativeFilePath: normalizeTrustProjectRelativeFilePath,
  normalizeResultMode: normalizeResultModeBase,
  analyzeEvidenceGroundedResultStructure: analyzeEvidenceGroundedResultStructureBase,
  extractEvidenceAnchors: extractEvidenceAnchorsBase,
  buildEvidenceGroundingValidation: buildEvidenceGroundingValidationBase,
  assessFinalResultTrust: assessFinalResultTrustBase,
  buildFinalTrustSignal: buildFinalTrustSignalBase,
  buildResultWarningFileContent: buildResultWarningFileContentBase,
  buildPromptScopeWarningFileContent: buildPromptScopeWarningFileContentBase,
  buildResultFileContent: buildResultFileContentBase,
  buildPatchSafeResultContent: buildPatchSafeResultContentBase,
} = require('./domain/final-result-trust');
const {
  getRuntimeOverridesSafeConfig,
  resetRuntimeOverridesState,
  parseRuntimeOverridesDocument: parseRuntimeOverridesDocumentBase,
  getRuntimeOverrideMaxOutputTokens: getRuntimeOverrideMaxOutputTokensBase,
  applyRuntimeOverridesForPhase: applyRuntimeOverridesForPhaseBase,
} = require('./runtime-overrides');
const { buildDiscussionLog } = require('./domain/discussion-log');
const {
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
} = require('./domain/forecast');
const {
  validateAgentsConfig,
  validateContextConfig,
} = require('./domain/config-validation');
const {
  createMetricsState,
  trackAgentCall: trackAgentCallBase,
  buildMetricsReport,
  printMetricsToConsole,
  saveMetricsFiles,
} = require('./domain/metrics-tracking');
const {
  buildOperationalSignalsSnapshot: buildOperationalSignalsSnapshotBase,
  findRecentRunFlowsWithSignals,
  loadRecentOperationalSignalRuns,
} = require('./domain/operational-signals-snapshot');
const {
  DEFAULT_PROVIDER_EXECUTION_MODE,
  DEFAULT_MAX_OUTPUT_TOKENS_BY_PROVIDER,
  AUTO_MAX_OUTPUT_TOKENS_CEILING_BY_PROVIDER,
  AUTO_MAX_OUTPUT_TOKENS_MIN_GAIN,
  parseEnvInt,
  parseEnvString,
  parseEnvBool,
  getScopedKeys,
  getScopedInt,
  getConfiguredMaxOutputTokens,
  getMaxOutputTokens,
  getRepairMaxOutputTokens,
  getAutoMaxOutputTokensSettings,
  resolveEffectiveMaxOutputTokens,
  getProviderExecutionMode,
  isAgentEnabled,
  getRetrySettings,
  getToolLoopSettings,
  getRateLimitBuckets,
} = require('./domain/agent-config');
const {
  utcTimestamp,
  projectName,
  toRelativePath,
  summarizeText,
  normalizeTokenCount,
  buildToolLoopExhaustedPrompt,
  stripReadFileMarkers,
  sanitizeForcedFinalAnswer,
  mergeContinuationText,
  sanitizeTaskId,
} = require('./domain/text-utilities');
const {
  buildAgentCallResult,
  mapCompletionStatusToLogStatus,
  mapCompletionStatusToCheckpointStatus,
  getJsonRawSidecarPath,
  writeJsonArtifactWithRaw,
  createIncompleteTextOutputError,
  createIncompleteStructuredOutputError,
  normalizeApprovalReview,
  sanitizeUserFacingFinalText,
} = require('./domain/output-artifacts');
const {
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
} = require('./domain/operational-signals');
const {
  hasStructuredFetchHint,
  deriveApprovalOutcomeType,
  buildApprovalSeamKey,
  extractApprovalMissingSeams,
  computeNewApprovalSeamKeys,
  computeCritiqueSeamOverlap,
  shouldTriggerSeamExpansion,
  buildTrustGapSnapshot,
  computeAverageApprovalScore,
  shouldSkipDevilsAdvocate,
  resolveTesterMode,
  resolveTesterGate,
} = require('./domain/seam-decision');
const {
  hasContextPackSection,
  buildCheckpointRuntimeSettings,
  buildEffectiveRuntimeSummaryLines,
  buildTreeTruncationWarningLines,
  detectProjectControlSurface,
  buildMissingContextWarningState,
} = require('./domain/runtime-display');
const {
  normalizeEnvToken,
  normalizeHeaders,
  parseHeaderInt,
  parseHeaderResetAt,
  getRateLimitBudgetKey,
  extractRateLimitSnapshotFromHeaders,
  applyObservedUsageToRateLimitSnapshot,
  estimateContentChars,
  estimateInputTokens,
} = require('./infrastructure/rate-limit');
const { extractFileReadRequests, parseFileRequest, getFileContent } = require('./infrastructure/file-read-tool');
const {
  detectLanguage,
  createRedactSecrets,
  loadAiEnv,
  readFile: readFileBase,
  readAiLogWindow: readAiLogWindowBase,
  runGitLsFiles,
  runTreeCommand,
  walkProjectFiles,
  splitLines,
  listIndexableFiles,
} = require('./infrastructure/file-operations');
const {
  stripEndMarker,
  validateEndMarker,
  buildProposalContent,
  buildCritiqueContentWithProposals,
  buildConsensusContent,
  buildConsensusReviewContent,
  buildConsensusRevisionContent,
  buildTextRepairPrompt,
  buildApprovalRepairPrompt,
  buildPromptEngineerContent,
  normalizePromptEngineerResult,
  parsePromptEngineerResponse,
  buildTesterContent,
  parseTesterResponse,
  parseApproval,
  buildDevilsAdvocateContent,
  parseDevilsAdvocateResponse,
} = require('./domain/prompt-content');
const {
  trimContextForPhase: trimContextForPhaseBase,
  replaceContextPackSection: replaceContextPackSectionBase,
  buildAgentContextBundle: buildAgentContextBundleBase,
  loadProviderProfile: loadProviderProfileBase,
  applyProviderProfile: applyProviderProfileBase,
  computeResultHash: computeResultHashBase,
  loadResultCache: loadResultCacheBase,
  saveResultCache: saveResultCacheBase,
} = require('./domain/context-bundle');
const {
  computeMemoryLogsDigest: computeMemoryLogsDigestBase,
  buildProjectMemoryLogSnapshotSection: buildProjectMemoryLogSnapshotSectionBase,
  buildProjectMemorySection: buildProjectMemorySectionBase,
  computeFilesHash: computeFilesHashBase,
  loadContextCache: loadContextCacheBase,
  saveContextCache: saveContextCacheBase,
  getLimits: getLimitsBase,
} = require('./domain/memory-context');
const {
  getContextHeader: getContextHeaderBase,
  readPrompt: readPromptBase,
  readRuntimeArgValue: readRuntimeArgValueBase,
  resolveTaskId: resolveTaskIdBase,
  buildTaskDiscussionDir: buildTaskDiscussionDirBase,
  loadAgentsConfig: loadAgentsConfigBase,
} = require('./infrastructure/io-wrappers');
const { createRunLoggers } = require('./infrastructure/run-logs');
const {
  createProviderClients,
  isQuotaExhaustedProviderError,
  getProviderName,
  getProviderLabel,
} = require('./infrastructure/providers');
const { enforceDispatcherGuard } = require('./dispatcher-guard');
const {
  sleep,
  parseRetryAfterMs,
  parseRateLimitResetAt,
  resolveRetryDelayMs,
  isQuotaExhaustedError,
  withRetry,
} = require('./infrastructure/retry');
const {
  readBootstrapArg: readBootstrapArgBase,
  resolveAutoProjectPathFromRegistry: resolveAutoProjectPathFromRegistryBase,
  resolveProjectPathFromHubConfig: resolveProjectPathFromHubConfigBase,
  validateProjectLayout: validateProjectLayoutBase,
  resolveReadablePath: resolveReadablePathBase,
  createEvidenceGroundingState: createEvidenceGroundingStateBase,
  createAutoOutputBudgetState: createAutoOutputBudgetStateBase,
  resetOperationalSignals: resetOperationalSignalsBase,
  resetEvidenceGroundingState: resetEvidenceGroundingStateBase,
  resetAutoOutputBudgetState: resetAutoOutputBudgetStateBase,
  normalizeProjectRelativeFilePath: normalizeProjectRelativeFilePathBase,
} = require('./domain/bootstrap');
const {
  buildMemoryRecallSection,
  saveAutoMemoryEntries,
  computeMemoryStoreDigest,
} = require('./local-memory');

const IS_ENTRYPOINT = require.main === module;
const BOOT_ARGS = process.argv.slice(2);
if (IS_ENTRYPOINT) {
  enforceDispatcherGuard({
    useCommand: 'npm run ai -- --prompt="..."',
  });
}
const INITIAL_CWD = process.cwd();

function readBootstrapArg(prefix) {
  return readBootstrapArgBase(prefix, BOOT_ARGS);
}

function resolveAutoProjectPathFromRegistry(hubRootPath) {
  return resolveAutoProjectPathFromRegistryBase(hubRootPath, { initialCwd: INITIAL_CWD, resolveHubFileForRead });
}

function resolveProjectPathFromHubConfig(hubRootPath) {
  return resolveProjectPathFromHubConfigBase(hubRootPath, { initialCwd: INITIAL_CWD, resolveHubFileForRead });
}

const HUB_ROOT_ARG = readBootstrapArg('--hub-root=');
const HUB_ROOT_ENV = String(process.env.AI_HUB_ROOT || '').trim();
const HUB_ROOT_RAW = HUB_ROOT_ARG || HUB_ROOT_ENV || INITIAL_CWD;
const HUB_ROOT_RESOLVED = path.resolve(INITIAL_CWD, HUB_ROOT_RAW);

const PROJECT_PATH_ARG = readBootstrapArg('--project-path=');
const PROJECT_PATH_ENV = String(process.env.AI_HUB_PROJECT_PATH || '').trim();
const PROJECT_PATH_CONFIG = IS_ENTRYPOINT ? resolveProjectPathFromHubConfig(HUB_ROOT_RESOLVED) : '';
const PROJECT_PATH_AUTO = IS_ENTRYPOINT ? resolveAutoProjectPathFromRegistry(HUB_ROOT_RESOLVED) : '';
const PROJECT_PATH_RAW = IS_ENTRYPOINT
  ? PROJECT_PATH_ARG || PROJECT_PATH_ENV || PROJECT_PATH_CONFIG || PROJECT_PATH_AUTO
  : '';
if (PROJECT_PATH_RAW) {
  const resolvedProjectPath = path.resolve(INITIAL_CWD, PROJECT_PATH_RAW);
  if (!fs.existsSync(resolvedProjectPath) || !fs.statSync(resolvedProjectPath).isDirectory()) {
    throw new Error(`Invalid --project-path: ${resolvedProjectPath}`);
  }
  process.chdir(fs.realpathSync(resolvedProjectPath));
  if (!PROJECT_PATH_ARG && !PROJECT_PATH_ENV) {
    if (PROJECT_PATH_CONFIG) {
      console.log(`ℹ️ Using hub active project from config/hub-config.json: ${process.cwd()}`);
    } else if (PROJECT_PATH_AUTO) {
      console.log(`ℹ️ Using last selected hub project: ${process.cwd()}`);
    }
  }
}

const PROJECT_ROOT = process.cwd();
if (!fs.existsSync(HUB_ROOT_RESOLVED) || !fs.statSync(HUB_ROOT_RESOLVED).isDirectory()) {
  throw new Error(`Invalid hub root: ${HUB_ROOT_RESOLVED}`);
}
const HUB_ROOT = fs.realpathSync(HUB_ROOT_RESOLVED);
const HUB_AI_DIR = path.join(HUB_ROOT, 'ai');
const AI_DIR_ARG = readBootstrapArg('--ai-dir=');
const AI_DIR_ENV = String(process.env.AI_PROJECT_DATA_DIR || '').trim();
const PROJECT_LAYOUT = resolveProjectLayout(PROJECT_ROOT, {
  aiDir: AI_DIR_ARG || AI_DIR_ENV,
});
const AI_SOURCE_DIR = PROJECT_LAYOUT.sourceRoot;
const AI_DATA_DIR = PROJECT_LAYOUT.runtimeRoot;
const AI_DIR_NAME = PROJECT_LAYOUT.runtimeDirName;
const AI_SOURCE_DIR_NAME = PROJECT_LAYOUT.sourceDirName;
if (IS_ENTRYPOINT && PROJECT_LAYOUT.layoutMode === 'legacy-single-root') {
  console.warn(`⚠️ Legacy ai/ layout detected. Split-root (.ai runtime + ai source) is canonical.`);
}

// --- Startup health check ---
function validateProjectLayout() {
  return validateProjectLayoutBase({ aiDataDir: AI_DATA_DIR, aiSourceDir: AI_SOURCE_DIR, projectRoot: PROJECT_ROOT });
}

if (IS_ENTRYPOINT) {
  validateProjectLayout();
}

const CONTEXT_CONFIG_PATH = PROJECT_LAYOUT.contextConfigPath;
const HUB_CONTEXT_CONFIG_PATH = path.join(HUB_AI_DIR, 'context.json');
const CONTEXT_CACHE_PATH = PROJECT_LAYOUT.cachePath;
const METRICS_DIR = PROJECT_LAYOUT.metricsDir;
const METRICS_LATEST_PATH = path.join(METRICS_DIR, 'latest.json');
const METRICS_HISTORY_PATH = path.join(METRICS_DIR, 'history.json');
const AI_ENV_PATH = path.join(PROJECT_ROOT, '.ai.env');
const END_MARKER = '=== END OF DOCUMENT ===';
const DEFAULT_TREE_CMD = 'find . -maxdepth 4 -type f -not -path "./node_modules/*" -not -path "./.git/*"';

const AI_LOG_DIR = PROJECT_LAYOUT.logsDir;
const GLOBAL_AI_LOG_PATH = path.join(AI_LOG_DIR, 'AI_LOG.md');
const CHANGE_LOG_PATH = path.join(AI_LOG_DIR, 'AI_CHANGE_LOG.md');
const PLAN_LOG_PATH = path.join(AI_LOG_DIR, 'AI_PLAN_LOG.md');
const PROPOSAL_LOG_PATH = path.join(AI_LOG_DIR, 'AI_PROPOSAL_LOG.md');
const DISCUSSION_LOG_PATH = path.join(AI_LOG_DIR, 'AI_DISCUSSION_LOG.md');
const ERROR_LOG_PATH = path.join(AI_LOG_DIR, 'AI_ERROR_LOG.md');
const AI_LOG_CONTEXT_HEADER = `## FILE: ${AI_DIR_NAME}/logs/AI_LOG.md`;
const HUB_AGENTS_CONFIG_PATH = path.join(HUB_AI_DIR, 'agents.json');
const MEMORY_LOG_FILES = [
  GLOBAL_AI_LOG_PATH,
  CHANGE_LOG_PATH,
  PLAN_LOG_PATH,
  PROPOSAL_LOG_PATH,
  DISCUSSION_LOG_PATH,
  ERROR_LOG_PATH,
];

const RATE_LIMIT_STATE = new Map();
const RATE_LIMIT_BUDGET_STATE = new Map();
// Agent config constants and functions extracted to ./domain/agent-config.js
// Forecast constants and functions extracted to ./domain/forecast.js
// CALIBRATED_FORECAST_HISTORY_LIMIT extracted to ./domain/operational-signals-snapshot.js

function resolveReadablePath(filePath, options = {}) {
  return resolveReadablePathBase(filePath, options, { projectRoot: PROJECT_ROOT, hubRoot: HUB_ROOT, resolveReadablePathWithFallbacks });
}

// ============ METRICS TRACKING ============
// createMetricsState, trackAgentCall, buildMetricsReport, printMetricsToConsole, saveMetricsFiles
// extracted to ./domain/metrics-tracking.js
const metrics = createMetricsState();

const operationalSignals = createOperationalSignalsState();

function resetOperationalSignals() {
  return resetOperationalSignalsBase(operationalSignals, createOperationalSignalsState);
}

function createEvidenceGroundingState() {
  return createEvidenceGroundingStateBase();
}

function createAutoOutputBudgetState() {
  return createAutoOutputBudgetStateBase();
}

const evidenceGroundingState = createEvidenceGroundingState();
const autoOutputBudgetState = createAutoOutputBudgetState();

function resetEvidenceGroundingState() {
  return resetEvidenceGroundingStateBase(evidenceGroundingState);
}

function resetAutoOutputBudgetState() {
  return resetAutoOutputBudgetStateBase(autoOutputBudgetState);
}

function normalizeProjectRelativeFilePath(filePath = '') {
  return normalizeProjectRelativeFilePathBase(filePath, PROJECT_ROOT, normalizeTrustProjectRelativeFilePath);
}

function extractIndexedFilesMentionedInText(text = '', codeIndex = null) {
  const source = String(text || '');
  const files = codeIndex?.byFile ? Object.keys(codeIndex.byFile) : [];
  if (!source || files.length === 0) return [];
  return files.filter((filePath) => source.includes(filePath)).sort();
}

function beginEvidenceGrounding(contextBundle = '', codeIndex = null) {
  resetEvidenceGroundingState();
  for (const filePath of extractIndexedFilesMentionedInText(contextBundle, codeIndex)) {
    evidenceGroundingState.contextFiles.add(filePath);
  }
}

function recordEvidenceReadFilesFromResult(result = {}) {
  const readFiles = Array.isArray(result?.meta?.readFiles) ? result.meta.readFiles : [];
  for (const filePath of readFiles) {
    const normalized = normalizeProjectRelativeFilePath(filePath);
    if (normalized) evidenceGroundingState.readFiles.add(normalized);
  }
}

function recordEvidenceReadFiles(filePaths = []) {
  for (const filePath of Array.isArray(filePaths) ? filePaths : []) {
    const normalized = normalizeProjectRelativeFilePath(filePath);
    if (normalized) evidenceGroundingState.readFiles.add(normalized);
  }
}

function getObservedEvidenceFiles() {
  return Array.from(new Set([
    ...evidenceGroundingState.contextFiles,
    ...evidenceGroundingState.readFiles,
  ])).sort();
}

function beginOperationalSignals(runContext = {}) {
  resetOperationalSignals();
  resetRuntimeOverridesState();
  resetAutoOutputBudgetState();
  operationalSignals.runId = String(runContext.runId || '').trim();
  operationalSignals.taskId = String(runContext.taskId || '').trim();
  operationalSignals.status = 'in-progress';
  operationalSignals.startedAt = new Date().toISOString();
  operationalSignals.runtime = {
    checkpointStatus: String(runContext.checkpointStatus || '').trim(),
    runtimeSettings: checkpoint.normalizeRuntimeSettings(runContext.runtimeSettings) || null,
    contextPackActive: Boolean(runContext.contextPackActive),
    treeTruncated: Boolean(runContext.treeTruncated),
    treeLimit: Number(runContext.treeLimit) || 0,
    totalTreeFiles: Number(runContext.totalTreeFiles) || 0,
    packedTreeLimit: Number(runContext.packedTreeLimit) || 0,
    structuralSearch: runContext.structuralSearch && typeof runContext.structuralSearch === 'object'
      ? {
        backendRequested: String(runContext.structuralSearch.backendRequested || '').trim(),
        backendUsed: String(runContext.structuralSearch.backendUsed || '').trim(),
        fallback: Boolean(runContext.structuralSearch.fallback),
        symbolCount: Number(runContext.structuralSearch.symbolCount) || 0,
      }
      : null,
  };
}

function getCurrentTotalTrackedTokens() {
  return (Number(metrics.totalInputTokens) || 0) + (Number(metrics.totalOutputTokens) || 0);
}

// buildOperationalSignalsSnapshot, findRecentRunFlowsWithSignals, loadRecentOperationalSignalRuns
// extracted to ./domain/operational-signals-snapshot.js

function getMetricsSummary() {
  return {
    agentCount: Object.keys(metrics.agents).length,
    totalInputTokens: metrics.hasUsage ? metrics.totalInputTokens : null,
    totalOutputTokens: metrics.hasUsage ? metrics.totalOutputTokens : null,
    consensusRounds: metrics.consensusRounds,
    avgConfidence: metrics.avgConfidence ?? null,
  };
}

function buildOperationalSignalsSnapshot(state = operationalSignals, overrides = {}) {
  return buildOperationalSignalsSnapshotBase(state, overrides, getMetricsSummary());
}

function parseRuntimeOverridesDocument(rawDocument) {
  return parseRuntimeOverridesDocumentBase(rawDocument);
}

function getRuntimeOverrideMaxOutputTokens(agent, safeConfig = getRuntimeOverridesSafeConfig()) {
  return getRuntimeOverrideMaxOutputTokensBase(agent, safeConfig);
}

// findRecentRunFlowsWithSignals, loadRecentOperationalSignalRuns extracted to ./domain/operational-signals-snapshot.js

function persistOperationalSignals(layout, overrides = {}) {
  const flow = checkpoint.loadRun(layout);
  if (!flow) return;
  flow.operationalSignals = buildOperationalSignalsSnapshot(operationalSignals, overrides);
  checkpoint.writeFlowAtomic(layout, flow);
}

function trackAgentCall(agentName, stage, duration, inputTokens = 0, outputTokens = 0) {
  trackAgentCallBase(metrics, agentName, stage, duration, inputTokens, outputTokens);
}

function printMetrics(promptText = '') {
  const safePrompt = redactSecrets(promptText);
  const signalsSnapshot = buildOperationalSignalsSnapshot(operationalSignals, { status: operationalSignals.status || 'completed' });
  const report = buildMetricsReport(metrics, {
    promptPreview: safePrompt,
    operationalSignalsSnapshot: signalsSnapshot,
  });
  printMetricsToConsole(metrics, report);
  saveMetricsFiles(report, {
    metricsDir: METRICS_DIR,
    latestPath: METRICS_LATEST_PATH,
    historyPath: METRICS_HISTORY_PATH,
  });
  return report;
}

// Retry logic extracted to ./infrastructure/retry.js

// parseEnvInt, parseEnvString, parseEnvBool, getRepairMaxOutputTokens extracted to ./domain/agent-config.js
// buildToolLoopExhaustedPrompt, stripReadFileMarkers, sanitizeForcedFinalAnswer extracted to ./domain/text-utilities.js
// mergeContinuationText extracted to ./domain/text-utilities.js

function getStoredRateLimitSnapshot(agent) {
  return RATE_LIMIT_BUDGET_STATE.get(getRateLimitBudgetKey(agent)) || null;
}

function writeStoredRateLimitSnapshot(agent, snapshot) {
  const key = getRateLimitBudgetKey(agent);
  if (!snapshot) {
    RATE_LIMIT_BUDGET_STATE.delete(key);
    return;
  }
  RATE_LIMIT_BUDGET_STATE.set(key, snapshot);
}

function updateRateLimitSnapshot(agent, options = {}) {
  const {
    headers = null,
    inputTokens = 0,
  } = options;
  const nowMs = Date.now();
  const extracted = extractRateLimitSnapshotFromHeaders(headers, nowMs);

  if (extracted) {
    writeStoredRateLimitSnapshot(agent, extracted);
    return extracted;
  }

  const current = getStoredRateLimitSnapshot(agent);
  if (!current) return null;

  const updated = applyObservedUsageToRateLimitSnapshot(current, inputTokens, nowMs);
  writeStoredRateLimitSnapshot(agent, updated);
  return updated;
}

async function applyPreflightRateLimitBudget(agent, contextBundle, messages, stage = 'unknown') {
  const snapshot = getStoredRateLimitSnapshot(agent);
  if (!snapshot) return;

  const estimatedInputTokens = estimateInputTokens(agent, contextBundle, messages);
  const preflight = computePreflightRateLimitDelayMs(snapshot, estimatedInputTokens);
  if (preflight.waitMs <= 0) return;

  console.log(
    `⏳ ${agent.name || 'agent'}: preflight wait ${Math.max(1, Math.round(preflight.waitMs / 1000))}s before ${stage} `
    + `(${preflight.reason || 'rate-limit budget'}, estimated next input: ~${estimatedInputTokens} tokens)`,
  );
  recordPreflightWaitSignal(operationalSignals, {
    agent: agent.name || 'agent',
    provider: getProviderName(agent),
    stage,
    waitMs: preflight.waitMs,
    estimatedInputTokens,
    reason: preflight.reason,
  });
  await sleep(preflight.waitMs);
}

async function executeProviderTurn(agent, contextBundle, messages, stage, providerCall) {
  const estimatedInputTokens = estimateInputTokens(agent, contextBundle, messages);
  const budgeted = applyAutoMaxOutputTokensForTurn(agent, stage, estimatedInputTokens);
  const effectiveAgent = budgeted.effectiveAgent;
  await applyPreflightRateLimitBudget(agent, contextBundle, messages, stage);

  let providerResult;
  try {
    providerResult = await providerCall(effectiveAgent, contextBundle, messages);
  } catch (error) {
    updateRateLimitSnapshot(agent, {
      headers: error?.headers || null,
      inputTokens: error?.headers ? estimatedInputTokens : 0,
    });
    throw error;
  }

  updateRateLimitSnapshot(agent, {
    headers: providerResult?.headers || null,
    inputTokens: providerResult?.inputTokens || estimatedInputTokens,
  });

  if (providerResult && typeof providerResult === 'object') {
    providerResult.meta = {
      ...(providerResult.meta && typeof providerResult.meta === 'object' ? providerResult.meta : {}),
      maxOutputTokens: budgeted.budget.effectiveTokens,
      configuredMaxOutputTokens: budgeted.budget.configuredTokens,
      recommendedOutputTokens: budgeted.budget.recommendedTokens,
      autoAdjustedMaxOutputTokens: budgeted.budget.adjusted,
    };
  }

  return {
    providerResult,
    estimatedInputTokens,
  };
}

// getScopedKeys, getScopedInt, getConfiguredMaxOutputTokens, getAutoMaxOutputTokensSettings,
// resolveEffectiveMaxOutputTokens extracted to ./domain/agent-config.js

function applyAutoMaxOutputTokensForTurn(agent, stage, estimatedInputTokens, logger = console) {
  const budget = resolveEffectiveMaxOutputTokens({
    agent,
    stage,
    estimatedInputTokens,
  });
  if (!budget.adjusted) {
    return {
      adjusted: false,
      budget,
      effectiveAgent: agent,
    };
  }

  const normalizedAgent = String(agent?.name || 'agent').trim().toLowerCase() || 'agent';
  const dedupeKey = `${normalizedAgent}:${budget.stage}`;
  const signature = `${budget.effectiveTokens}:${budget.recommendedTokens}:${budget.ceilingTokens}`;
  if (autoOutputBudgetState.lastApplied.get(dedupeKey) !== signature) {
    autoOutputBudgetState.lastApplied.set(dedupeKey, signature);
    logger.log(
      `🛠️ Auto maxOutputTokens: ${agent?.name || 'agent'} ${budget.stage} `
      + `${budget.configuredTokens} -> ${budget.effectiveTokens} `
      + `(recommended ${budget.recommendedTokens}, estInput ~${estimatedInputTokens})`,
    );
    recordOutputTokenAdjustmentSignal(operationalSignals, {
      agent: agent?.name || 'agent',
      provider: getProviderName(agent),
      stage: budget.stage,
      estimatedInputTokens,
      configuredTokens: budget.configuredTokens,
      recommendedTokens: budget.recommendedTokens,
      effectiveTokens: budget.effectiveTokens,
      ceilingTokens: budget.ceilingTokens,
      source: budget.source,
    });
  }

  return {
    adjusted: true,
    budget,
    effectiveAgent: {
      ...agent,
      maxOutputTokens: budget.effectiveTokens,
    },
  };
}

// getProviderExecutionMode, isAgentEnabled, getRetrySettings, getMaxOutputTokens,
// getToolLoopSettings, getRateLimitBuckets extracted to ./domain/agent-config.js

async function applyAgentRateLimit(agent, stage = 'unknown') {
  const buckets = getRateLimitBuckets(agent);
  if (!buckets.length) return;

  const now = Date.now();
  let waitMs = 0;
  for (const bucket of buckets) {
    const lastAt = RATE_LIMIT_STATE.get(bucket.key) || 0;
    const remaining = bucket.intervalMs - (now - lastAt);
    if (remaining > waitMs) waitMs = remaining;
  }

  if (waitMs > 0) {
    const labels = buckets.map((b) => b.label).join(', ');
    console.log(
      `⏳ ${agent.name || 'agent'}: throttled ${Math.max(1, Math.round(waitMs / 1000))}s before ${stage} (${labels})`,
    );
    await sleep(waitMs);
  }

  const stampedAt = Date.now();
  buckets.forEach((bucket) => RATE_LIMIT_STATE.set(bucket.key, stampedAt));
}

async function applyRuntimeOverridesForPhase(layout, phase, logger = console) {
  return applyRuntimeOverridesForPhaseBase(layout, phase, logger);
}

// Config validation extracted to ./domain/config-validation.js
// utcTimestamp, projectName, toRelativePath, summarizeText, normalizeTokenCount extracted to ./domain/text-utilities.js
// buildAgentCallResult, mapCompletionStatusToLogStatus, mapCompletionStatusToCheckpointStatus,
// getJsonRawSidecarPath, writeJsonArtifactWithRaw, createIncompleteTextOutputError,
// createIncompleteStructuredOutputError, normalizeApprovalReview, sanitizeUserFacingFinalText
// extracted to ./domain/output-artifacts.js

const {
  ensureUnifiedLogs,
  appendPlanLog,
  appendProposalLog,
  appendDiscussionLog,
  appendChangeLog,
  appendErrorLog,
  appendToGlobalLog,
  autoLogAgent,
} = createRunLoggers({
  globalLogPath: GLOBAL_AI_LOG_PATH,
  changeLogPath: CHANGE_LOG_PATH,
  planLogPath: PLAN_LOG_PATH,
  proposalLogPath: PROPOSAL_LOG_PATH,
  discussionLogPath: DISCUSSION_LOG_PATH,
  errorLogPath: ERROR_LOG_PATH,
  aiLogDir: AI_LOG_DIR,
  endMarker: END_MARKER,
  utcTimestamp,
  projectName,
  toRelativePath,
  summarizeText,
  sanitizeText: redactSecrets,
});

function computeMemoryLogsDigest() {
  return computeMemoryLogsDigestBase(MEMORY_LOG_FILES);
}

function buildProjectMemoryLogSnapshotSection() {
  return buildProjectMemoryLogSnapshotSectionBase({
    contextConfig,
    planLogPath: PLAN_LOG_PATH,
    changeLogPath: CHANGE_LOG_PATH,
    proposalLogPath: PROPOSAL_LOG_PATH,
    discussionLogPath: DISCUSSION_LOG_PATH,
    globalAiLogPath: GLOBAL_AI_LOG_PATH,
    readAiLogWindow,
    toRelativePath,
  });
}

function buildProjectMemorySection(promptText = '') {
  return buildProjectMemorySectionBase(promptText, {
    contextConfig,
    projectLayout: PROJECT_LAYOUT,
    buildMemoryRecallSection,
    buildProjectMemoryLogSnapshotSection,
  });
}

// ============ INCREMENTAL CONTEXT CACHE ============
function computeFilesHash(files, extra = '') {
  return computeFilesHashBase(files, extra, { resolveReadablePath });
}

function loadContextCache() {
  return loadContextCacheBase(CONTEXT_CACHE_PATH);
}

function saveContextCache(hash, bundle) {
  return saveContextCacheBase(CONTEXT_CACHE_PATH, hash, bundle);
}

// Load .ai.env before reading limits/runtime flags derived from environment variables.
if (IS_ENTRYPOINT) {
  loadAiEnv(AI_ENV_PATH);
}

let contextConfig;
try {
  contextConfig = loadContextConfig(
    HUB_CONTEXT_CONFIG_PATH,
    CONTEXT_CONFIG_PATH,
    DEFAULT_TREE_CMD,
    IS_ENTRYPOINT ? validateContextConfig : null,
  );
} catch (error) {
  if (!IS_ENTRYPOINT) {
    contextConfig = {
      fullFiles: [],
      lightFiles: [],
      exclude: DEFAULT_TREE_CMD,
    };
  } else {
    if (error.code === 'INVALID_CONTEXT_CONFIG') {
      console.error('❌ Invalid ai/context.json:');
      for (const item of error.validationErrors || []) {
        console.error(`   - ${item}`);
      }
    } else {
      console.error('❌ Invalid JSON in ai/context.json:', error.message);
    }
    process.exit(1);
  }
}

if (!Array.isArray(contextConfig.fullFiles)) contextConfig.fullFiles = [];
if (!Array.isArray(contextConfig.lightFiles)) contextConfig.lightFiles = [];
if (typeof contextConfig.exclude !== 'string' || !contextConfig.exclude.trim()) {
  contextConfig.exclude = DEFAULT_TREE_CMD;
}

const indexCfg = resolveIndexConfig(contextConfig);

// Configurable constants
const FULL_FILES = contextConfig.fullFiles;
const LIGHT_FILES = contextConfig.lightFiles;
const TREE_CMD = contextConfig.exclude || DEFAULT_TREE_CMD;

const args = process.argv.slice(2);
const INDEX_ONLY = args.includes('--index-only');
const CONTEXT_PACK_ONLY = args.includes('--context-pack-only');
const NO_TREE = args.includes('--no-tree');
const FORCE_RESTART = args.includes('--restart');
const NON_INTERACTIVE = args.includes('--non-interactive');
const REFINE_MODE = args.includes('--refine');
const ENABLE_PREPOST = args.includes('--prepost');
const SKIP_ENHANCE = args.includes('--skip-enhance');
const FULL_PANEL = args.includes('--full-panel');
const ENABLE_TEST = args.includes('--test');
const FEEDBACK_ARG = args.find(a => a.startsWith('--feedback='));
const FEEDBACK_TEXT = FEEDBACK_ARG ? FEEDBACK_ARG.slice('--feedback='.length).replace(/^["']|["']$/g, '') : '';
const INDEX_MODE_ARG = args.find(a => a.startsWith('--index-mode='));
const INDEX_MODE_CLI = INDEX_MODE_ARG ? INDEX_MODE_ARG.split('=')[1] : null;
const effectiveIndexMode = resolveMode(INDEX_MODE_CLI || indexCfg.indexMode);

// ============ CONFIGURABLE LIMITS ============
// Priority: CLI args > env vars > context.json > defaults
const DEFAULT_LIMITS = {
  maxFiles: 200,
  maxFileSize: 50000,
  maxTotalSize: 500000
};

function getLimits(config) {
  return getLimitsBase(config, { args, defaultLimits: DEFAULT_LIMITS });
}

const LIMITS = getLimits(contextConfig);
const MAX_FILES = LIMITS.maxFiles;
const REDACT_SECRETS = !(args.includes('--no-redact') || process.env.CONTEXT_REDACT === '0');
const IS_LIGHT_MODE = args.includes('--light');
const IS_FULL_MODE = args.includes('--full');
const PACKED_TREE_LIMIT = Number(contextConfig.limits?.maxTreeFilesWhenPacked || 120);

const FILES_TO_INCLUDE = IS_LIGHT_MODE ? LIGHT_FILES : FULL_FILES;

// ============ DYNAMIC PROJECT HEADER ============
function getContextHeader(projectPath) {
  return getContextHeaderBase(projectPath);
}

const AGENTS_CONFIG_PATH = PROJECT_LAYOUT.agentsConfigPath;
const PROMPT_PATH = PROJECT_LAYOUT.promptPath;
const INDEX_PATH = PROJECT_LAYOUT.resolveIndexPath(indexCfg.outputPath);
const ARCHIVE_DIR = PROJECT_LAYOUT.archiveDir;
const RESULT_PATH = PROJECT_LAYOUT.resultPath;
const PATCH_SAFE_RESULT_PATH = PROJECT_LAYOUT.patchSafeResultPath;
const RESULT_WARNING_PATH = PROJECT_LAYOUT.resultWarningPath;

// detectLanguage, loadAiEnv, runGitLsFiles, runTreeCommand, walkProjectFiles,
// splitLines, listIndexableFiles extracted to ./infrastructure/file-operations.js
// redactSecrets, readFile, readAiLogWindow: extracted core logic to file-operations.js,
// bound wrappers kept here for module-level state (REDACT_SECRETS, resolveReadablePath).

function redactSecrets(contents) {
  if (!REDACT_SECRETS) return contents;
  return createRedactSecrets(true)(contents);
}

function readFile(filePath, options = {}) {
  return readFileBase(filePath, { ...options, resolveReadablePath, redactSecrets });
}

function readAiLogWindow(filePath, maxEntries = 10, maxBytes = 15000) {
  return readAiLogWindowBase(filePath, maxEntries, maxBytes, { resolveReadablePath, redactSecrets });
}

function loadAgentsConfig(configPath) {
  return loadAgentsConfigBase(configPath, {
    hubAgentsConfigPath: HUB_AGENTS_CONFIG_PATH,
    readJsonIfExists,
    mergeAgentsConfig,
    validateAgentsConfig,
  });
}



function readPrompt(promptPath) {
  return readPromptBase(promptPath, args);
}

function readRuntimeArgValue(flagName) {
  return readRuntimeArgValueBase(flagName, args);
}

// sanitizeTaskId extracted to ./domain/text-utilities.js

function resolveTaskId(promptText = '') {
  return resolveTaskIdBase(promptText, { args, sanitizeTaskId, promptHash: checkpoint.promptHash });
}

function buildTaskDiscussionDir(discussionsDir, taskId, runId) {
  return buildTaskDiscussionDirBase(discussionsDir, taskId, runId, sanitizeTaskId);
}

// sanitizeUserFacingFinalText extracted to ./domain/output-artifacts.js

function normalizeResultMode(resultMode = '') {
  return normalizeResultModeBase(resultMode);
}

function buildFinalTrustSignal(trust = {}, options = {}) {
  return buildFinalTrustSignalBase(trust, options);
}

function recordFinalTrustSignal(state, trust = {}, options = {}) {
  if (!state || typeof state !== 'object') return;
  state.finalTrust = buildFinalTrustSignal(trust, options);
}

function logFinalTrustSignal(signal = {}, options = {}) {
  if (!signal || typeof signal !== 'object') return;
  const label = String(options.label || 'Final trust').trim() || 'Final trust';
  console.log(
    `🧾 ${label}: mode=${normalizeResultMode(signal.resultMode)}, `
    + `agreed=${signal.allAgreed ? 'yes' : 'no'}, `
    + `patchSafeEligible=${signal.patchSafeEligible ? 'yes' : 'no'}, `
    + `contractGaps=${Number(signal.contractGapCount) || 0}, `
    + `groundingGaps=${Number(signal.groundingGapCount) || 0}, `
    + `evidenceAnchors=${Number(signal.evidenceAnchorCount) || 0}, `
    + `observedFiles=${Number(signal.observedFileCount) || 0}`
  );
  if (Array.isArray(signal.contractGapCategories) && signal.contractGapCategories.length > 0) {
    console.log(`   Contract gap categories: ${signal.contractGapCategories.join(', ')}`);
  }
  if (Array.isArray(signal.groundingGapCategories) && signal.groundingGapCategories.length > 0) {
    console.log(`   Grounding gap categories: ${signal.groundingGapCategories.join(', ')}`);
  }
}

function analyzeEvidenceGroundedResultStructure(finalText = '') {
  return analyzeEvidenceGroundedResultStructureBase(finalText);
}

function extractEvidenceAnchors(groundedBody = '') {
  return extractEvidenceAnchorsBase(groundedBody, {
    projectRoot: PROJECT_ROOT,
  });
}

function buildEvidenceGroundingValidation(finalText = '', options = {}) {
  return buildEvidenceGroundingValidationBase(finalText, {
    ...options,
    projectRoot: PROJECT_ROOT,
  });
}

function assessFinalResultTrust(finalText = '', options = {}) {
  return assessFinalResultTrustBase(finalText, {
    ...options,
    projectRoot: PROJECT_ROOT,
  });
}

function buildResultWarningFileContent(options = {}) {
  return buildResultWarningFileContentBase(options);
}

function buildPromptScopeWarningFileContent(options = {}) {
  return buildPromptScopeWarningFileContentBase(options);
}

function buildResultFileContent(finalText, options = {}) {
  return buildResultFileContentBase(finalText, options);
}

function buildPatchSafeResultContent(finalText, options = {}) {
  return buildPatchSafeResultContentBase(finalText, options);
}

function copyIfExists(sourcePath, targetPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return false;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function writeTaskDiscussionIndex({
  discussionDir,
  taskId,
  runId,
  runArchiveDir,
  promptPath,
  resultPath,
  patchSafeResultPath = '',
  devilsAdvocateReportPath = '',
  testReportPath = '',
  warningPath = '',
  promptScopeWarningPath = '',
  suggestedPromptPath = '',
}) {
  const lines = [
    '# Task Discussion Package',
    '',
    `- Task ID: ${taskId}`,
    `- Run ID: ${runId}`,
    `- Canonical run archive: ${toRelativePath(runArchiveDir)}`,
    `- Prompt snapshot: ${toRelativePath(promptPath)}`,
    `- Final result snapshot: ${toRelativePath(resultPath)}`,
  ];

  if (devilsAdvocateReportPath) {
    lines.push(`- Devil's Advocate report: ${toRelativePath(devilsAdvocateReportPath)}`);
  }
  if (patchSafeResultPath) {
    lines.push(`- Patch-safe result: ${toRelativePath(patchSafeResultPath)}`);
  }
  if (testReportPath) {
    lines.push(`- Test report: ${toRelativePath(testReportPath)}`);
  }
  if (warningPath) {
    lines.push(`- Warning details: ${toRelativePath(warningPath)}`);
  }
  if (promptScopeWarningPath) {
    lines.push(`- Prompt scope warning: ${toRelativePath(promptScopeWarningPath)}`);
  }
  if (suggestedPromptPath) {
    lines.push(`- Suggested broadened prompt: ${toRelativePath(suggestedPromptPath)}`);
  }

  lines.push('');
  fs.mkdirSync(discussionDir, { recursive: true });
  fs.writeFileSync(path.join(discussionDir, 'README.md'), `${lines.join('\n')}\n`);
}

function persistPromptScopeArtifacts(promptEngineerResult = {}, options = {}) {
  const assessment = normalizePromptEngineerResult(promptEngineerResult);
  const risk = String(assessment.scopeRisk || 'none').trim() || 'none';
  const notes = Array.isArray(assessment.scopeNotes) ? assessment.scopeNotes : [];
  const runArchiveDir = String(options.runArchiveDir || '').trim();
  let warningPath = '';
  let suggestedPromptPath = '';

  if (risk !== 'none' && runArchiveDir && assessment.broadenedPrompt) {
    suggestedPromptPath = path.join(runArchiveDir, 'suggested-broadened-prompt.txt');
    fs.writeFileSync(suggestedPromptPath, `${assessment.broadenedPrompt.trim()}\n`);
  }
  if (risk !== 'none' && runArchiveDir) {
    warningPath = path.join(runArchiveDir, 'prompt-scope-warning.txt');
    fs.writeFileSync(warningPath, buildPromptScopeWarningFileContent({
      risk,
      notes,
      suggestedPromptPath: suggestedPromptPath ? toRelativePath(suggestedPromptPath) : '',
    }));
  }

  recordPromptScopeSignal(operationalSignals, {
    risk,
    warningIssued: risk !== 'none',
    suggestionAvailable: Boolean(suggestedPromptPath),
    notes,
    warningPath: warningPath ? toRelativePath(warningPath) : '',
    suggestedPromptPath: suggestedPromptPath ? toRelativePath(suggestedPromptPath) : '',
  });

  return {
    risk,
    notes,
    warningPath,
    suggestedPromptPath,
  };
}

function loadReusablePreprocessResult(options = {}) {
  const aiDataDir = String(options.aiDataDir || '').trim();
  const promptText = String(options.promptText || '');
  const currentRunId = String(options.currentRunId || '').trim();
  if (!aiDataDir || !promptText) return null;

  const archivedFlow = loadLatestArchivedRun(aiDataDir);
  if (!archivedFlow || archivedFlow.runId === currentRunId) return null;
  if (archivedFlow.promptHash !== checkpoint.promptHash(promptText)) return null;

  const preprocessPhase = archivedFlow?.phases?.preprocess;
  const outputFile = String(preprocessPhase?.outputFile || '').trim();
  if (preprocessPhase?.status !== 'done' || !outputFile || !fs.existsSync(outputFile)) return null;

  let resolvedAiDataDir = '';
  let resolvedOutputPath = '';
  try {
    resolvedAiDataDir = fs.realpathSync(aiDataDir);
    resolvedOutputPath = fs.realpathSync(outputFile);
  } catch {
    return null;
  }
  if (!isSameOrSubPath(resolvedAiDataDir, resolvedOutputPath)) return null;

  try {
    const payload = JSON.parse(fs.readFileSync(resolvedOutputPath, 'utf8'));
    return {
      runId: String(archivedFlow.runId || '').trim(),
      agent: String(preprocessPhase?.agent || '').trim(),
      outputFile: resolvedOutputPath,
      promptEngineerResult: normalizePromptEngineerResult(payload, promptText),
    };
  } catch {
    return null;
  }
}



// Prompt builders/parsers are in ./domain/prompt-content.js.
// ============ CONFIDENCE SCORING ============
/**
 * Strip heavy code fragment section for later phases.
 * Safe fallback: if markers are not found, returns the original bundle.
 */
function trimContextForPhase(contextBundle, phase) {
  return trimContextForPhaseBase(contextBundle, phase);
}

function replaceContextPackSection(bundleContent, newPackMarkdown) {
  return replaceContextPackSectionBase(bundleContent, newPackMarkdown);
}

function buildAgentContextBundle(agent, baseBundle, contextPrompt, codeIndex, indexConfig) {
  return buildAgentContextBundleBase(agent, baseBundle, contextPrompt, codeIndex, indexConfig, { redactSecrets });
}

function loadProviderProfile(agent) {
  return loadProviderProfileBase(agent);
}

function applyProviderProfile(bundleContent, agent) {
  return applyProviderProfileBase(bundleContent, agent);
}

function computeResultHash(promptText, codeIndex) {
  return computeResultHashBase(promptText, codeIndex);
}

function loadResultCache(cachePath) {
  return loadResultCacheBase(cachePath);
}

function saveResultCache(cachePath, hash, resultPath) {
  return saveResultCacheBase(cachePath, hash, resultPath);
}

// ============ PROVIDER-AWARE EXECUTION ============
async function runAgentsWithProviderLimit(agents, taskFn) {
  const grouped = new Map();
  for (const agent of agents) {
    const provider = getProviderName(agent);
    if (!grouped.has(provider)) grouped.set(provider, []);
    grouped.get(provider).push(agent);
  }

  const results = [];
  const parallelGroups = [];

  for (const [provider, providerAgents] of grouped.entries()) {
    const mode = getProviderExecutionMode(provider);
    if (mode === 'sequential') {
      console.log(
        `   ⏳ Running ${providerAgents.length} ${getProviderLabel(provider)} agent(s) sequentially (mode from env/config)...`,
      );
      for (const agent of providerAgents) {
        const result = await taskFn(agent);
        results.push(result);
      }
      continue;
    }

    parallelGroups.push({ provider, agents: providerAgents });
  }

  if (parallelGroups.length > 0) {
    const totalParallel = parallelGroups.reduce((sum, group) => sum + group.agents.length, 0);
    const providerList = parallelGroups.map((group) => getProviderLabel(group.provider)).join(', ');
    console.log(`   🚀 Running ${totalParallel} agent(s) in parallel (${providerList})...`);

    const groupSettled = await Promise.allSettled(
      parallelGroups.map((group) =>
        Promise.allSettled(group.agents.map(taskFn)).then((agentResults) => {
          const fulfilled = [];
          for (const r of agentResults) {
            if (r.status === 'fulfilled') {
              fulfilled.push(r.value);
            } else {
              const agentErr = r.reason;
              const agentName = agentErr?.agentName || 'unknown';
              console.error(`❌ Agent ${agentName} failed: ${agentErr?.message || agentErr}`);
            }
          }
          return fulfilled;
        }),
      ),
    );
    for (const groupResult of groupSettled) {
      if (groupResult.status === 'fulfilled') {
        results.push(...groupResult.value);
      }
    }
  }

  return results;
}

// Provider clients moved to ./infrastructure/providers.js.
const providerClients = createProviderClients({
  getMaxOutputTokens,
  aiLogContextHeader: AI_LOG_CONTEXT_HEADER,
});

async function callAgentRaw(agent, contextBundle, promptText, stage = 'unknown', runtimeOptions = {}) {
  const toolInstruction = `
\n\n---
\n\n# TOOL: FILE READER
\nIf you need to read a file that is NOT in the context, output:
\n<<<READ_FILE: path/to/file.ts>>>
\nFor large files, request only the needed range:
\n<<<READ_FILE: path/to/file.ts#L120-L260>>>
\nBe economical: prefer narrow ranges, avoid giant files unless necessary, and keep requests to 1-4 files per turn.
\nThe system will pause, read them, and show you the content.
`;
  const allowTools = runtimeOptions.allowTools !== false;
  const initialMessages = Array.isArray(runtimeOptions.initialMessages) && runtimeOptions.initialMessages.length > 0
    ? runtimeOptions.initialMessages.map((message) => ({
      role: message.role,
      content: String(message.content || ''),
    }))
    : null;

  let messages = initialMessages || [{ role: 'user', content: promptText + (allowTools ? toolInstruction : '') }];
  let turn = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const providerCall = typeof runtimeOptions.callProvider === 'function'
    ? runtimeOptions.callProvider
    : providerClients.callProvider.bind(providerClients);
  const readFileContent = typeof runtimeOptions.getFileContent === 'function'
    ? runtimeOptions.getFileContent
    : getFileContent;
  const rootDir = runtimeOptions.rootDir || process.cwd();
  const toolLoop = getToolLoopSettings();
  const MAX_TURNS = toolLoop.maxTurns;
  const MAX_TOTAL_FILE_BYTES = toolLoop.maxTotalFileBytes;
  const MAX_FILES_PER_TURN = toolLoop.maxFilesPerTurn;
  const MAX_FILE_BYTES = toolLoop.maxFileBytes;
  const loadedFiles = new Set();
  const observedReadFiles = new Set();
  let totalBytes = 0;
  let lastProviderResult = null;

  while (turn < MAX_TURNS) {
    const { providerResult } = await executeProviderTurn(agent, contextBundle, messages, stage, providerCall);
    lastProviderResult = providerResult;

    totalInputTokens += Number(providerResult?.inputTokens || 0);
    totalOutputTokens += Number(providerResult?.outputTokens || 0);

    const text = providerResult.text;

    const fileRequests = extractFileReadRequests(text);
    if (fileRequests.length === 0 || !allowTools) {
      const finalText = !allowTools && fileRequests.length > 0 ? stripReadFileMarkers(text) : text;
      return buildAgentCallResult(agent, finalText, providerResult, {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        turnCount: turn + 1,
        toolLoopExhausted: false,
        readFiles: Array.from(observedReadFiles),
      }, normalizeProjectRelativeFilePath);
    }

    const boundedRequests = fileRequests.slice(0, MAX_FILES_PER_TURN);
    const skippedByCount = fileRequests.slice(MAX_FILES_PER_TURN);
    console.log(`📂 Agent ${agent.name} requested files: ${boundedRequests.join(', ')}`);
    messages.push({ role: 'assistant', content: text });
    
    const newFilesContent = [];
    const alreadyLoaded = [];
    const skippedFiles = [];

    boundedRequests.forEach(f => {
      const parsedRequest = parseFileRequest(f);
      const normalizedObservedFile = normalizeProjectRelativeFilePath(parsedRequest.filePath);
      if (loadedFiles.has(f)) {
        if (normalizedObservedFile) observedReadFiles.add(normalizedObservedFile);
        alreadyLoaded.push(f);
      } else {
        const result = readFileContent(f, { rootDir, maxFileBytes: MAX_FILE_BYTES });
        if (result.size && totalBytes + result.size > MAX_TOTAL_FILE_BYTES) {
          skippedFiles.push(`${f} (size limit exceeded)`);
          return;
        }
        totalBytes += result.size || 0;
        newFilesContent.push(`## FILE: ${f}\n\`\`\`\n${result.content}\n\`\`\``);
        if (result.ok && normalizedObservedFile) observedReadFiles.add(normalizedObservedFile);
        loadedFiles.add(f);
      }
    });

    let userResponse = '';
    if (newFilesContent.length > 0) {
      userResponse += `Here are the requested files:\n\n${newFilesContent.join('\n\n')}\n\n`;
    }
    if (alreadyLoaded.length > 0) {
      userResponse += `[System Note: The following files were already provided in previous turns, please check history: ${alreadyLoaded.join(', ')}]\n\n`;
    }
    if (skippedFiles.length > 0) {
      userResponse += `[System Note: Skipped files due to total size limit (${MAX_TOTAL_FILE_BYTES} bytes): ${skippedFiles.join(', ')}]\n\n`;
    }
    if (skippedByCount.length > 0) {
      userResponse += `[System Note: Skipped additional file requests due to per-turn limit (${MAX_FILES_PER_TURN}): ${skippedByCount.join(', ')}]\n\n`;
    }
    userResponse += 'Continue your analysis.';
    
    messages.push({ role: 'user', content: userResponse });
    
    turn++;
  }

  console.warn(`⚠️ ${agent.name || 'agent'} exhausted file-reader turns. Requesting final answer with loaded context only.`);
  recordToolLoopSignal(operationalSignals, {
    agent: agent.name || 'agent',
    provider: getProviderName(agent),
    stage,
    turnCount: turn,
    totalBytes,
  });
  messages.push({ role: 'user', content: buildToolLoopExhaustedPrompt() });

  const { providerResult: finalProviderResult } = await executeProviderTurn(
    agent,
    contextBundle,
    messages,
    `${stage}-tool-budget-final`,
    providerCall,
  );

  totalInputTokens += Number(finalProviderResult?.inputTokens || 0);
  totalOutputTokens += Number(finalProviderResult?.outputTokens || 0);

  const finalText = finalProviderResult?.text || '';
  if (extractFileReadRequests(finalText).length > 0) {
    return buildAgentCallResult(agent, sanitizeForcedFinalAnswer(finalText), finalProviderResult || lastProviderResult, {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      turnCount: turn + 1,
      toolLoopExhausted: true,
      readFiles: Array.from(observedReadFiles),
    }, normalizeProjectRelativeFilePath);
  }

  return buildAgentCallResult(agent, finalText, finalProviderResult || lastProviderResult, {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    turnCount: turn + 1,
    toolLoopExhausted: true,
    readFiles: Array.from(observedReadFiles),
  }, normalizeProjectRelativeFilePath);
}

async function callAgent(agent, contextBundle, promptText, stage = 'unknown', runtimeOptions = {}) {
  const agentName = agent.name || 'agent';
  const startTime = Date.now();
  const retrySettings = getRetrySettings(agent);

  const result = await withRetry(
    async () => {
      await applyAgentRateLimit(agent, stage);
      return callAgentRaw(agent, contextBundle, promptText, stage, runtimeOptions);
    },
    {
      maxRetries: retrySettings.maxRetries,
      baseDelay: retrySettings.baseDelayMs,
      maxDelay: retrySettings.maxDelayMs,
      rateLimitDelay: retrySettings.rateLimitDelayMs,
      agentName,
      onError: (error, retryMeta) => {
        recordRetrySignal(operationalSignals, {
          agent: agentName,
          provider: getProviderName(agent),
          stage,
          attempt: retryMeta.attempt,
          willRetry: retryMeta.willRetry,
          isRateLimit: retryMeta.isRateLimit,
          delayMs: retryMeta.delayMs,
          errorName: error?.name || '',
          message: summarizeText(error?.message || String(error || ''), 160),
        });
        appendErrorLog({
          model: agentName,
          phase: stage || 'runtime',
          status: retryMeta.willRetry ? 'RETRYING' : 'FAILED',
          summary: summarizeText(error?.message || String(error || 'Unknown error')),
          error,
          details: {
            stage: stage || 'runtime',
            provider: getProviderName(agent),
            agentName,
            model: agent.model || '',
            apiUrl: agent.apiUrl || '',
            attempt: retryMeta.attempt,
            maxAttempts: retryMeta.maxAttempts,
            isRateLimit: retryMeta.isRateLimit,
            isRetryable: retryMeta.isRetryable,
            willRetry: retryMeta.willRetry,
            delayMs: retryMeta.delayMs,
          },
        });
      },
    }
  );

  const duration = Date.now() - startTime;
  trackAgentCall(agentName, stage, duration, result.meta?.inputTokens, result.meta?.outputTokens);

  return buildAgentCallResult(agent, result.text, result, {
    inputTokens: result.meta?.inputTokens,
    outputTokens: result.meta?.outputTokens,
    stopReason: result.meta?.stopReason,
    providerStopReason: result.meta?.providerStopReason,
    headers: result.meta?.headers,
    rawUsage: result.meta?.rawUsage,
    turnCount: result.meta?.turnCount,
    toolLoopExhausted: result.meta?.toolLoopExhausted,
  }, normalizeProjectRelativeFilePath);
}

async function runLoggedAgentStep(agent, stage, fn) {
  try {
    const result = await fn();
    recordEvidenceReadFilesFromResult(result);
    return result;
  } catch (error) {
    appendErrorLog({
      model: agent?.name || 'agent',
      phase: stage || 'runtime',
      status: 'FAILED',
      summary: summarizeText(error?.message || String(error || 'Unknown error')),
      error,
      details: {
        stage: stage || 'runtime',
        scope: 'agent-step',
        provider: getProviderName(agent),
        agentName: agent?.name || 'agent',
        model: agent?.model || '',
        apiUrl: agent?.apiUrl || '',
      },
    });
    throw error;
  }
}

async function attemptTextRepair(agent, contextBundle, promptText, stage, response, opts = {}) {
  const repairAgent = {
    ...agent,
    maxOutputTokens: getRepairMaxOutputTokens(agent),
  };
  const repairPrompt = buildTextRepairPrompt(stage, response?.meta?.stopReason || response?.meta?.providerStopReason || '');
  const repairResponse = await callAgent(
    repairAgent,
    contextBundle,
    '',
    `${stage}-repair`,
    {
      allowTools: false,
      initialMessages: [
        { role: 'user', content: promptText },
        { role: 'assistant', content: response.text },
        { role: 'user', content: repairPrompt },
      ],
    },
  );

  const mergedText = mergeContinuationText(response.text, stripReadFileMarkers(repairResponse.text));
  return {
    text: mergedText,
    meta: {
      ...repairResponse.meta,
      repaired: true,
      repairStopReason: repairResponse.meta?.stopReason || '',
      repairOutputTokens: repairResponse.meta?.outputTokens || 0,
      repairInputTokens: repairResponse.meta?.inputTokens || 0,
      repairBudgetTokens: repairAgent.maxOutputTokens,
      originalStopReason: response?.meta?.stopReason || '',
      originalCompletion: response?.completionStatus || '',
    },
  };
}

async function attemptApprovalRepair(agent, contextBundle, reviewContent, stage, response) {
  const repairAgent = {
    ...agent,
    maxOutputTokens: getRepairMaxOutputTokens(agent),
  };
  const repairPrompt = buildApprovalRepairPrompt(
    stage,
    response?.meta?.stopReason || response?.meta?.providerStopReason || '',
  );

  const repaired = await callAgentWithValidation(
    repairAgent,
    contextBundle,
    '',
    `${stage}-repair`,
    {
      responseFormat: 'json',
      enableRepair: false,
      allowTools: false,
      initialMessages: [
        { role: 'user', content: reviewContent },
        { role: 'assistant', content: response.text },
        { role: 'user', content: repairPrompt },
      ],
      _repairAttempt: true,
    },
  );
  const normalizedApproval = normalizeApprovalReview(repaired);

  return {
    text: repaired.text,
    completionStatus: normalizedApproval.completionStatus,
    approval: normalizedApproval.approval,
    meta: buildAgentCallResult(agent, repaired.text, repaired, {
      inputTokens: (response.meta?.inputTokens || 0) + (repaired.meta?.inputTokens || 0),
      outputTokens: (response.meta?.outputTokens || 0) + (repaired.meta?.outputTokens || 0),
      stopReason: repaired.meta?.stopReason,
      providerStopReason: repaired.meta?.providerStopReason,
      headers: repaired.meta?.headers,
      rawUsage: repaired.meta?.rawUsage,
      turnCount: repaired.meta?.turnCount,
      toolLoopExhausted: repaired.meta?.toolLoopExhausted,
      validation: repaired.meta?.validation,
      completion: repaired.meta?.completion,
      repaired: true,
      repairStopReason: repaired.meta?.stopReason || repaired.meta?.providerStopReason || '',
      repairBudgetTokens: repairAgent.maxOutputTokens,
      originalStopReason: response.meta?.stopReason || response.meta?.providerStopReason || '',
      originalCompletion: response.completionStatus || '',
    }, normalizeProjectRelativeFilePath).meta,
  };
}

async function callApprovalReviewWithRepair(agent, contextBundle, reviewContent, stage) {
  const agentName = agent.name || 'agent';
  let reviewResponse = await callAgentWithValidation(
    agent,
    contextBundle,
    reviewContent,
    stage,
    { responseFormat: 'json', enableRepair: false },
  );
  let normalizedApproval = normalizeApprovalReview(reviewResponse);

  if (normalizedApproval.completionStatus === 'invalid') {
    console.log(`   🔧 Attempting bounded approval JSON repair for ${agentName} (${stage})...`);
    recordRepairSignal(operationalSignals, {
      agent: agentName,
      stage,
      outcome: 'attempted',
      stopReason: reviewResponse.meta?.stopReason || reviewResponse.meta?.providerStopReason || '',
      budgetTokens: getRepairMaxOutputTokens(agent),
    });

    const repaired = await attemptApprovalRepair(
      agent,
      contextBundle,
      reviewContent,
      stage,
      {
        ...reviewResponse,
        completionStatus: normalizedApproval.completionStatus,
      },
    );

    reviewResponse = repaired;
    reviewResponse.meta = { ...(reviewResponse.meta || {}), repairAttempted: true };
    normalizedApproval = {
      completionStatus: repaired.completionStatus,
      approval: repaired.approval,
    };

    recordRepairSignal(operationalSignals, {
      agent: agentName,
      stage,
      outcome: normalizedApproval.completionStatus === 'complete' ? 'succeeded' : 'failed',
      stopReason: reviewResponse.meta?.originalStopReason || '',
      repairStopReason: reviewResponse.meta?.repairStopReason || reviewResponse.meta?.stopReason || '',
      budgetTokens: reviewResponse.meta?.repairBudgetTokens || getRepairMaxOutputTokens(agent),
    });
  }

  return {
    text: reviewResponse.text,
    completionStatus: normalizedApproval.completionStatus,
    meta: reviewResponse.meta,
    approval: normalizedApproval.approval,
  };
}

async function callAgentWithValidation(agent, contextBundle, promptText, stage = 'unknown', opts = {}) {
  const runtimeOptions = {};
  if (opts.allowTools !== undefined) {
    runtimeOptions.allowTools = opts.allowTools !== false;
  }
  if (Array.isArray(opts.initialMessages) && opts.initialMessages.length > 0) {
    runtimeOptions.initialMessages = opts.initialMessages;
  }
  const response = await callAgent(agent, contextBundle, promptText, stage, runtimeOptions);
  const validationCfg = contextConfig.responseValidation || {};
  const responseFormat = opts.responseFormat || 'text';
  if (validationCfg.enabled === false) {
    return {
      text: response.text,
      completionStatus: 'complete',
      meta: response.meta,
    };
  }

  const minConfidenceRaw = validationCfg.minConfidence;
  const minConfidence = minConfidenceRaw === null || minConfidenceRaw === undefined
    ? null
    : Number(minConfidenceRaw);
  const validationOpts = {
    minLength: Number(validationCfg.minLength ?? 100),
    requireEndMarker: opts.requireEndMarker ?? true,
    checkRefusal: validationCfg.checkRefusal !== false,
    checkFileRefs: opts.checkFileRefs ?? (validationCfg.checkFileRefs === true),
    minConfidence: Number.isFinite(minConfidence) ? minConfidence : null,
  };

  const agentName = agent.name || 'agent';
  const vResult = responseValidator.validateResponse(response.text, validationOpts);
  const message = responseValidator.formatValidation(vResult, agentName);
  if (message) console.log(message);
  const completion = responseValidator.classifyCompletion(response.text, vResult, {
    requireEndMarker: validationOpts.requireEndMarker,
    meta: response.meta,
  });

  if (!vResult.valid && validationCfg.retryOnFailure === true) {
    console.log(`   🔄 Retrying ${agentName} (1 attempt max)...`);
    const retryResponse = await callAgent(agent, contextBundle, promptText, `${stage}-retry`, runtimeOptions);
    const retryResult = responseValidator.validateResponse(retryResponse.text, validationOpts);
    const retryMessage = responseValidator.formatValidation(retryResult, `${agentName} (retry)`);
    if (retryMessage) console.log(retryMessage);
    const retryCompletion = responseValidator.classifyCompletion(retryResponse.text, retryResult, {
      requireEndMarker: validationOpts.requireEndMarker,
      meta: retryResponse.meta,
    });
    return {
      text: retryResponse.text,
      completionStatus: retryCompletion.completionStatus,
      meta: buildAgentCallResult(agent, retryResponse.text, retryResponse, {
        inputTokens: retryResponse.meta?.inputTokens,
        outputTokens: retryResponse.meta?.outputTokens,
        stopReason: retryResponse.meta?.stopReason,
        providerStopReason: retryResponse.meta?.providerStopReason,
        headers: retryResponse.meta?.headers,
        rawUsage: retryResponse.meta?.rawUsage,
        turnCount: retryResponse.meta?.turnCount,
        toolLoopExhausted: retryResponse.meta?.toolLoopExhausted,
        validation: retryResult,
        completion: retryCompletion,
      }, normalizeProjectRelativeFilePath).meta,
    };
  }

  if (
    responseFormat === 'text'
    && completion.completionStatus === 'truncated'
    && opts.enableRepair !== false
    && !opts._repairAttempt
  ) {
    console.log(`   🔧 Attempting bounded repair for ${agentName} (${stage})...`);
    recordRepairSignal(operationalSignals, {
      agent: agentName,
      stage,
      outcome: 'attempted',
      stopReason: response.meta?.stopReason || response.meta?.providerStopReason || '',
      budgetTokens: getRepairMaxOutputTokens(agent),
    });
    const repaired = await attemptTextRepair(agent, contextBundle, promptText, stage, {
      ...response,
      completionStatus: completion.completionStatus,
    }, opts);
    const repairedValidation = responseValidator.validateResponse(repaired.text, validationOpts);
    const repairedCompletion = responseValidator.classifyCompletion(repaired.text, repairedValidation, {
      requireEndMarker: validationOpts.requireEndMarker,
      meta: repaired.meta,
    });
    const repairedMessage = responseValidator.formatValidation(repairedValidation, `${agentName} (repair)`);
    if (repairedMessage) console.log(repairedMessage);
    recordRepairSignal(operationalSignals, {
      agent: agentName,
      stage,
      outcome: repairedCompletion.completionStatus === 'complete' ? 'succeeded' : 'failed',
      stopReason: response.meta?.stopReason || response.meta?.providerStopReason || '',
      repairStopReason: repaired.meta?.stopReason || repaired.meta?.providerStopReason || '',
      budgetTokens: repaired.meta?.repairBudgetTokens || getRepairMaxOutputTokens(agent),
    });

    return {
      text: repaired.text,
      completionStatus: repairedCompletion.completionStatus,
      meta: buildAgentCallResult(agent, repaired.text, repaired, {
        inputTokens: (response.meta?.inputTokens || 0) + (repaired.meta?.repairInputTokens || 0),
        outputTokens: (response.meta?.outputTokens || 0) + (repaired.meta?.repairOutputTokens || 0),
        stopReason: repaired.meta?.stopReason,
        providerStopReason: repaired.meta?.providerStopReason,
        headers: repaired.meta?.headers,
        rawUsage: repaired.meta?.rawUsage,
        turnCount: repaired.meta?.turnCount,
        toolLoopExhausted: repaired.meta?.toolLoopExhausted,
        validation: repairedValidation,
        completion: repairedCompletion,
        repaired: true,
        repairStopReason: repaired.meta?.repairStopReason,
        repairBudgetTokens: repaired.meta?.repairBudgetTokens,
        originalStopReason: repaired.meta?.originalStopReason,
        originalCompletion: repaired.meta?.originalCompletion,
      }, normalizeProjectRelativeFilePath).meta,
    };
  }

  return {
    text: response.text,
    completionStatus: completion.completionStatus,
    meta: buildAgentCallResult(agent, response.text, response, {
      inputTokens: response.meta?.inputTokens,
      outputTokens: response.meta?.outputTokens,
      stopReason: response.meta?.stopReason,
      providerStopReason: response.meta?.providerStopReason,
      headers: response.meta?.headers,
      rawUsage: response.meta?.rawUsage,
      turnCount: response.meta?.turnCount,
      toolLoopExhausted: response.meta?.toolLoopExhausted,
      validation: vResult,
      completion,
    }, normalizeProjectRelativeFilePath).meta,
  };
}

async function runAgents(contextBundle, promptText = '', codeIndex = null, runtimeDiagnostics = {}) {
  loadAiEnv(AI_ENV_PATH);

  // ===== REFINEMENT MODE (--refine) =====
  if (REFINE_MODE) {
    console.log('\n🔄 ===== REFINEMENT MODE =====');

    const archivedFlow = loadLatestArchivedRun(AI_DATA_DIR);
    if (!archivedFlow) {
      console.error('❌ No archived run found. Run a full pipeline first.');
      process.exit(1);
    }

    const consensusPhase = (archivedFlow.phases || {}).consensus;
    if (!consensusPhase || !consensusPhase.outputFile || !fs.existsSync(consensusPhase.outputFile)) {
      console.error('❌ Archived run has no consensus output. Run a full pipeline first.');
      process.exit(1);
    }

    const consensusFilePath = fs.realpathSync(consensusPhase.outputFile);
    if (!isSameOrSubPath(fs.realpathSync(AI_DATA_DIR), consensusFilePath)) {
      console.error('❌ Consensus output file is outside the AI data directory. Aborting.');
      process.exit(1);
    }

    const previousConsensus = fs.readFileSync(consensusFilePath, 'utf8');
    const originalPrompt = archivedFlow.prompt || promptText || '';
    const discussion = loadPreviousDiscussion(archivedFlow, AI_DATA_DIR);

    // Collect feedback
    let feedback = FEEDBACK_TEXT;
    if (!feedback) {
      if (NON_INTERACTIVE || !process.stdin.isTTY) {
        console.error('❌ No feedback provided. Use --feedback="..." in non-interactive mode.');
        process.exit(1);
      }
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      feedback = await new Promise((resolve) => {
        rl.question('📝 Enter your feedback for refinement: ', resolve);
      });
      rl.close();
      if (!feedback || !feedback.trim()) {
        console.error('❌ No feedback provided. Aborting refinement.');
        process.exit(1);
      }
    }

    console.log(`   Archived run: ${archivedFlow.runId}`);
    console.log(`   Feedback: ${feedback.slice(0, 100)}${feedback.length > 100 ? '...' : ''}`);

    // Resolve consensus agent
    const agentsConfig = loadAgentsConfig(AGENTS_CONFIG_PATH);
    if (!agentsConfig || !Array.isArray(agentsConfig.agents)) {
      console.error('❌ No agents configured.');
      process.exit(1);
    }

    let consensusAgent = null;
    for (const agent of agentsConfig.agents) {
      if (!agent || !agent.apiUrl || !agent.model || !agent.key) continue;
      if (!isAgentEnabled(agent)) continue;
      const apiKey = process.env[agent.key];
      if (!apiKey) continue;
      const resolved = { ...agent, key: apiKey };
      if (agent.consensus) {
        consensusAgent = resolved;
        break;
      }
      consensusAgent = resolved; // fallback: last valid agent
    }

    if (!consensusAgent) {
      console.error('❌ No valid consensus agent found.');
      process.exit(1);
    }

    console.log(`   Consensus agent: ${consensusAgent.name || 'agent'}`);

    // Build refinement content and call agent
    const refinementContent = buildRefinementContent(originalPrompt, discussion, previousConsensus, feedback);
    const refinedResponse = await runLoggedAgentStep(consensusAgent, 'refinement', () => callAgentWithValidation(
      consensusAgent,
      contextBundle,
      refinementContent,
      'refinement',
    ));
    const refinedText = refinedResponse.text;

    // Save results into the completed run's directory, preserving legacy archive fallback.
    const refinementArchiveDir = archivedFlow._archiveDir || path.join(ARCHIVE_DIR, archivedFlow.runId);
    fs.mkdirSync(refinementArchiveDir, { recursive: true });

    fs.writeFileSync(RESULT_PATH, refinedText);
    console.log(`✅ Refined result saved: ${RESULT_PATH}`);

    const refinedArchivePath = path.join(refinementArchiveDir, 'refinement-consensus.txt');
    fs.writeFileSync(refinedArchivePath, refinedText + '\n');
    console.log(`📦 Refinement archived: ${refinedArchivePath}`);

    const feedbackArchivePath = path.join(refinementArchiveDir, 'refinement-feedback.txt');
    fs.writeFileSync(feedbackArchivePath, feedback + '\n');
    console.log(`📦 Feedback archived: ${feedbackArchivePath}`);

    appendPlanLog({
      model: 'AI Panel (Automated)',
      runId: archivedFlow.runId,
      request: `[REFINEMENT] ${feedback.slice(0, 200)}`,
      status: 'DONE',
      notes: `Refinement of ${archivedFlow.runId}. Result: ${toRelativePath(RESULT_PATH)}`,
    });

    console.log('✅ Refinement complete.');
    return;
  }

  if (!promptText) {
    console.log('ℹ️ No prompt found (args or file). Skipping agent run.');
    return;
  }

  // Ensure prompt file exists for archiving purposes if it came from CLI
  if (!fs.existsSync(PROMPT_PATH) || fs.readFileSync(PROMPT_PATH, 'utf8').trim() !== promptText) {
    fs.writeFileSync(PROMPT_PATH, promptText);
  }

  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultCachePath = PROJECT_LAYOUT.lastResultHashPath;
  const currentResultHash = computeResultHash(promptText, codeIndex);

  // --- Result cache: identical prompt + index fingerprint ---
  const cachedResult = loadResultCache(resultCachePath);
  if (
    cachedResult &&
    cachedResult.hash === currentResultHash &&
    cachedResult.resultPath &&
    fs.existsSync(cachedResult.resultPath)
  ) {
    const createdAt = new Date(cachedResult.createdAt || 0).getTime();
    const ageMs = Number.isFinite(createdAt) && createdAt > 0 ? Math.max(0, Date.now() - createdAt) : 0;
    const ageLabel = ageMs < 3600000
      ? `${Math.max(1, Math.round(ageMs / 60000))}m ago`
      : `${Math.max(1, Math.round(ageMs / 3600000))}h ago`;

    console.log(`\n💾 Identical run completed ${ageLabel}.`);
    console.log(`   Result: ${cachedResult.resultPath}`);

    if (NON_INTERACTIVE || !process.stdin.isTTY) {
      console.log('   Skipping cache in non-interactive mode.');
    } else {
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question('   Use cached result? [Y/n] ', resolve);
      });
      rl.close();
      const normalized = String(answer || '').trim().toLowerCase();
      if (!normalized || normalized === 'y' || normalized === 'yes') {
        console.log('   ✅ Using cached result.');
        appendPlanLog({
          model: 'AI Panel (Automated)',
          runId: timestamp,
          request: promptText,
          status: 'DONE',
          notes: `Used cached result: ${toRelativePath(cachedResult.resultPath)}`,
        });
        return;
      }
    }
  }

  // --- Checkpoint: detect interrupted run ---
  const contextPackActiveForRuntime = hasContextPackSection(contextBundle);
  const currentRuntimeSettings = buildCheckpointRuntimeSettings({
    maxFiles: MAX_FILES,
    maxFileSize: LIMITS.maxFileSize,
    maxTotalSize: LIMITS.maxTotalSize,
    packedTreeLimit: PACKED_TREE_LIMIT,
    contextPackActive: contextPackActiveForRuntime,
    isLightMode: IS_LIGHT_MODE,
    noTree: NO_TREE,
    effectiveIndexMode,
    redactSecrets: REDACT_SECRETS,
    enablePrepost: ENABLE_PREPOST,
    enableTest: ENABLE_TEST,
  });

  const existingRun = checkpoint.loadRun(PROJECT_LAYOUT);
  const currentFingerprint = checkpoint.runFingerprint(promptText, PROJECT_LAYOUT, currentRuntimeSettings);
  let resumeMode = false;
  let checkpointStatus = FORCE_RESTART ? 'fresh run (--restart)' : 'fresh run';

  if (existingRun && !FORCE_RESTART) {
    const runAge = checkpoint.formatRunAge(existingRun.startedAt);
    const previousPrompt = String(existingRun.prompt || '');
    const promptPreview = previousPrompt.slice(0, 80);
    const samePrompt = existingRun.promptHash === checkpoint.promptHash(promptText);
    const sameConfig = existingRun.fingerprint === currentFingerprint;
    const runtimeSettingDiff = checkpoint.describeRuntimeSettingDiff(existingRun.runtimeSettings, currentRuntimeSettings);

    if (samePrompt) {
      const phaseOrder = ['preprocess', 'proposals', 'critiques', 'consensus', 'approval', 'devils-advocate', 'postprocess'];
      const resumePoint = checkpoint.getResumePoint(existingRun, phaseOrder);

      if (resumePoint) {
        if (!sameConfig) {
          console.warn('⚠️ Runtime settings changed since interrupted run. Results may be inconsistent.');
          if (runtimeSettingDiff.length > 0) {
            console.warn(`   Changed: ${runtimeSettingDiff.join(', ')}`);
          }
          console.warn('   Use --restart to discard and start fresh.');
        }

        if (NON_INTERACTIVE || !process.stdin.isTTY) {
          console.log(`🔄 Auto-resuming interrupted run (${runAge}) from phase: ${resumePoint}`);
          resumeMode = true;
          checkpointStatus = sameConfig
            ? `resume from ${resumePoint}`
            : `resume from ${resumePoint} (runtime settings changed)`;
        } else {
          console.log(`\n🔄 Interrupted run detected (${runAge})`);
          console.log(`   Prompt: "${promptPreview}${previousPrompt.length > 80 ? '...' : ''}"`);
          console.log(`   Resume from: ${resumePoint}`);
          const readline = require('readline');
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise((resolve) => {
            rl.question('   Continue from last checkpoint? [Y/n] ', resolve);
          });
          rl.close();
          const normalized = String(answer || 'y').trim().toLowerCase();
          if (normalized === 'y' || normalized === 'yes' || normalized === '') {
            resumeMode = true;
            checkpointStatus = sameConfig
              ? `resume from ${resumePoint}`
              : `resume from ${resumePoint} (runtime settings changed)`;
          } else {
            checkpoint.archiveRun(PROJECT_LAYOUT);
            console.log('   Previous run archived. Starting fresh.');
            checkpointStatus = 'fresh run (previous checkpoint archived)';
          }
        }
      } else {
        checkpoint.archiveRun(PROJECT_LAYOUT);
        checkpointStatus = 'fresh run (previous run already complete)';
      }
    } else {
      console.log(`⚠️ Previous run had a different prompt (${runAge}).`);
      checkpoint.archiveRun(PROJECT_LAYOUT);
      console.log('   Previous run archived. Starting fresh.');
      checkpointStatus = 'fresh run (previous prompt archived)';
    }
  } else if (existingRun && FORCE_RESTART) {
    checkpoint.archiveRun(PROJECT_LAYOUT);
    console.log('ℹ️ Previous run archived due to --restart flag.');
    checkpointStatus = 'fresh run (--restart archived previous run)';
  }

  const agentsConfig = loadAgentsConfig(AGENTS_CONFIG_PATH);
  if (!agentsConfig || !Array.isArray(agentsConfig.agents)) {
    console.log('ℹ️ No agents configured. Skipping agent run.');
    return;
  }

  const resolvedAgents = [];

  for (const agent of agentsConfig.agents) {

    if (!agent || !agent.apiUrl || !agent.model || !agent.key) {

      console.log('⚠️ Skipping agent with missing apiUrl/model/key.');

      continue;

    }

    if (!isAgentEnabled(agent)) {
      console.log(`ℹ️ Agent ${agent.name || 'agent'} disabled by runtime config.`);
      continue;
    }

    const apiKey = process.env[agent.key];

    if (!apiKey) {

      console.log(`⚠️ Missing API key for ${agent.name || 'agent'} (${agent.key}).`);

      continue;

    }



    resolvedAgents.push({ ...agent, key: apiKey });

  }



  if (!resolvedAgents.length) {
    console.log('ℹ️ No valid agents with API keys. Skipping agent run.');
    appendPlanLog({
      model: 'AI Panel (Automated)',
      runId: timestamp,
      request: promptText,
      status: 'FAILED',
      notes: 'Skipped: no valid agents with API keys.',
    });
    return;
  }

  const deltaContextEnabled = (contextConfig.deltaContext || {}).enabled === true;
  const getPhaseBundle = (phase) => (deltaContextEnabled ? trimContextForPhase(contextBundle, phase) : contextBundle);
  const requestedTaskId = resolveTaskId(promptText);
  const forecastDiagnostics = {
    contextPackActive: Boolean(runtimeDiagnostics.contextPackActive || hasContextPackSection(contextBundle)),
    structuralSearch: runtimeDiagnostics.structuralSearch || null,
    treeTruncated: Boolean(runtimeDiagnostics.treeTruncated),
    treeLimit: Number(runtimeDiagnostics.treeLimit) || 0,
    packedTreeLimit: Number(runtimeDiagnostics.packedTreeLimit) || PACKED_TREE_LIMIT,
  };
  const historicalSignalRuns = loadRecentOperationalSignalRuns(PROJECT_LAYOUT, CALIBRATED_FORECAST_HISTORY_LIMIT);

  // --- Checkpoint: create or load run flow ---
  let runFlow = null;
  if (resumeMode) {
    runFlow = checkpoint.loadRun(PROJECT_LAYOUT);
    if (!runFlow) {
      resumeMode = false;
    }
  }
  if (!runFlow) {
    const activeFlags = [];
    if (ENABLE_PREPOST) activeFlags.push('--prepost');
    if (ENABLE_TEST) activeFlags.push('--test');
    const agentNames = resolvedAgents.map((item) => item.name || 'agent');
    runFlow = checkpoint.createRun(PROJECT_LAYOUT, promptText, activeFlags, agentNames, {
      taskId: requestedTaskId,
      runtimeSettings: currentRuntimeSettings,
    });
  }

  const effectiveTaskId = sanitizeTaskId(runFlow.taskId || requestedTaskId) || String(runFlow.runId || '').trim() || 'run';
  beginOperationalSignals({
    runId: runFlow.runId,
    taskId: effectiveTaskId,
    checkpointStatus,
    runtimeSettings: currentRuntimeSettings,
    contextPackActive: forecastDiagnostics.contextPackActive,
    structuralSearch: forecastDiagnostics.structuralSearch,
    treeTruncated: forecastDiagnostics.treeTruncated,
    treeLimit: forecastDiagnostics.treeLimit,
    totalTreeFiles: Number(runtimeDiagnostics.totalFiles) || 0,
    packedTreeLimit: forecastDiagnostics.packedTreeLimit,
  });
  beginEvidenceGrounding(contextBundle, codeIndex);
  persistOperationalSignals(PROJECT_LAYOUT, { status: 'in-progress' });

  // Per-run archive directory — all artifacts go here instead of flat ARCHIVE_DIR
  const RUN_ARCHIVE_DIR = path.join(ARCHIVE_DIR, runFlow.runId);
  const TASK_DISCUSSION_DIR = buildTaskDiscussionDir(PROJECT_LAYOUT.discussionsDir, effectiveTaskId, runFlow.runId);
  fs.mkdirSync(RUN_ARCHIVE_DIR, { recursive: true });
  fs.mkdirSync(TASK_DISCUSSION_DIR, { recursive: true });
  for (const transientPath of [PATCH_SAFE_RESULT_PATH, RESULT_WARNING_PATH]) {
    if (fs.existsSync(transientPath)) {
      fs.unlinkSync(transientPath);
    }
  }

  console.log(`🗂️ Task ID: ${effectiveTaskId}`);
  console.log(`🗂️ Discussion folder: ${toRelativePath(TASK_DISCUSSION_DIR)}`);
  const runtimeSummaryLines = buildEffectiveRuntimeSummaryLines({
    maxFiles: MAX_FILES,
    packedTreeLimit: PACKED_TREE_LIMIT,
    contextPackActive: contextPackActiveForRuntime,
    isLightMode: IS_LIGHT_MODE,
    checkpointStatus,
    agents: resolvedAgents,
  });
  for (const line of runtimeSummaryLines) {
    console.log(line);
  }

  appendPlanLog({
    model: 'AI Panel (Automated)',
    runId: runFlow.runId || timestamp,
    request: promptText,
    status: 'IN_PROGRESS',
    notes: 'Multi-agent run started.',
  });

  // Separate agents by phase
  const preProcessAgents = resolvedAgents.filter((a) => a.phase === 'pre-process');
  const postProcessAgents = resolvedAgents.filter((a) => a.phase === 'post-process');
  const devilsAdvocateAgents = resolvedAgents.filter((a) => a.phase === 'devil-advocate');
  const mainAgents = resolvedAgents.filter((a) => !a.phase || a.phase === '');

  const consensusIndex = mainAgents.findIndex((agent) => agent.consensus);
  const consensusAgent =
    consensusIndex >= 0 ? mainAgents[consensusIndex] : mainAgents[mainAgents.length - 1];
  const debateAgents =
    consensusIndex >= 0
      ? mainAgents.filter((_, index) => index !== consensusIndex)
      : mainAgents;
  const reusedPreprocessResult = ENABLE_PREPOST && preProcessAgents.length > 0 && !resumeMode && !SKIP_ENHANCE
    ? loadReusablePreprocessResult({
      aiDataDir: AI_DATA_DIR,
      promptText,
      currentRunId: runFlow.runId,
    })
    : null;

  function filterByDebatePhase(agents, phase) {
    return agents.filter((a) => {
      const phases = Array.isArray(a.debatePhases) && a.debatePhases.length > 0
        ? a.debatePhases
        : ['proposal', 'critique', 'approval'];
      return phases.includes(phase);
    });
  }

  // Complexity-aware agent tier limits per phase
  const COMPLEXITY_AGENT_LIMITS = {
    trivial: { proposal: 1, critique: 1, approval: 2 },
    standard: { proposal: 2, critique: 2, approval: 3 },
    complex: { proposal: Infinity, critique: Infinity, approval: Infinity },
  };

  // Agent priority for tier selection: developer first for implementation, reviewer for quality
  const AGENT_ROLE_PRIORITY = {
    proposal: ['developer', 'architect', 'reviewer'],
    critique: ['reviewer', 'architect', 'developer'],
    approval: ['architect', 'reviewer', 'developer'],
  };

  function filterByComplexityAndPhase(agents, phase, complexity) {
    const phaseFiltered = filterByDebatePhase(agents, phase);
    const limits = COMPLEXITY_AGENT_LIMITS[complexity] || COMPLEXITY_AGENT_LIMITS.standard;
    const limit = limits[phase] || Infinity;
    if (phaseFiltered.length <= limit) return phaseFiltered;

    // Sort by role priority for this phase, then slice
    const priorities = AGENT_ROLE_PRIORITY[phase] || [];
    const sorted = [...phaseFiltered].sort((a, b) => {
      const roleA = String(a.role || a.name || '').toLowerCase();
      const roleB = String(b.role || b.name || '').toLowerCase();
      const idxA = priorities.findIndex((p) => roleA.includes(p));
      const idxB = priorities.findIndex((p) => roleB.includes(p));
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
    return sorted.slice(0, limit);
  }

  // Store original prompt
  const originalPrompt = promptText;
  let workingPrompt = promptText;
  let promptEngineerResult = null;
  let promptScopeWarningPath = '';
  let promptScopeSuggestedPromptPath = '';
  const getAgentBundle = (agent, phase, contextPrompt = workingPrompt) => {
    const phaseBundle = getPhaseBundle(phase);
    const budgetBundle = buildAgentContextBundle(agent, phaseBundle, contextPrompt, codeIndex, indexCfg);
    return applyProviderProfile(budgetBundle, agent);
  };

  function getActivePhaseAgents(stage, agents, checkpointPhase = '') {
    const source = Array.isArray(agents) ? agents : [];
    if (!resumeMode || !checkpointPhase) return source;
    return source.filter((agent) => !checkpoint.isAgentDone(PROJECT_LAYOUT, checkpointPhase, agent.name || 'agent'));
  }

  function logPhaseRiskForecast({ phaseLabel, stage, agents, checkpointPhase = '', buildContent, contextPrompt = workingPrompt }) {
    const activeAgents = getActivePhaseAgents(stage, agents, checkpointPhase);
    if (!activeAgents.length) return;

    const forecasts = activeAgents.map((agent) => {
      const content = typeof buildContent === 'function' ? buildContent(agent) : '';
      const bundle = getAgentBundle(agent, stage, contextPrompt);
      const estimatedInputTokens = estimateInputTokens(agent, bundle, [{ role: 'user', content }]);
      const provider = getProviderName(agent);
      const calibration = buildForecastCalibration(historicalSignalRuns, {
        agentName: agent.name || 'agent',
        provider,
        stage,
      });
      return computeAgentPhaseRiskForecast({
        agent,
        stage,
        estimatedInputTokens,
        contextBudget: agent.contextBudget,
        maxOutputTokens: getMaxOutputTokens(agent),
        rateLimitSnapshot: getStoredRateLimitSnapshot(agent),
        contextPackActive: forecastDiagnostics.contextPackActive,
        treeTruncated: forecastDiagnostics.treeTruncated,
        treeLimit: forecastDiagnostics.treeLimit,
        calibration,
      });
    });

    const lines = buildPhaseRiskForecastLines({
      phaseLabel,
      forecasts,
      treeTruncated: forecastDiagnostics.treeTruncated,
      treeLimit: forecastDiagnostics.treeLimit,
      packedTreeLimit: forecastDiagnostics.packedTreeLimit,
      contextPackActive: forecastDiagnostics.contextPackActive,
    });
    for (const line of lines) {
      console.log(line);
    }
  }

  const MAX_SEAM_EXPANSION_ROUNDS = 4;
  let seamExpansionRounds = 0;
  const exhaustedSeamKeys = new Set();
  let seamExpansionPromptBroadened = false;

  function toSeamKey(request = {}) {
    const normalized = normalizeMissingSeams([request], { maxItems: 1 });
    if (!normalized.length) return '';
    return String(normalized[0].symbolOrSeam || '').trim().toLowerCase();
  }

  function filterPendingSeams(requests = []) {
    const normalized = normalizeMissingSeams(requests, {
      ...(indexCfg.critiqueExpansionMaxRequests ? { maxItems: Number(indexCfg.critiqueExpansionMaxRequests) } : {}),
    });
    return normalized.filter((request) => {
      const key = toSeamKey(request);
      return key && !exhaustedSeamKeys.has(key);
    });
  }

  function getSeamExpansionBasePrompt() {
    const broadenedPrompt = String(promptEngineerResult?.broadenedPrompt || '').trim();
    const scopeRisk = String(promptEngineerResult?.scopeRisk || 'none').trim();
    if (scopeRisk === 'narrow-starting-seams' && broadenedPrompt) {
      if (!seamExpansionPromptBroadened) {
        seamExpansionPromptBroadened = true;
        console.log('🧭 Seam expansion switched to Prompt Engineer broadened prompt due to unresolved narrow-scope seams.');
      }
      return broadenedPrompt;
    }
    return workingPrompt;
  }

  function buildSeamExpandedPrompt(basePrompt, appendix) {
    if (!appendix) return basePrompt;
    return `${String(basePrompt || '').trim()}\n\n---\n\n${appendix}`;
  }

  async function runSeamExpansionRound({ trustSignal, approvalOutputs, currentDiscussion }) {
    const expansionRound = seamExpansionRounds + 1;
    const triggerDecision = shouldTriggerSeamExpansion({
      trust: trustSignal,
      approvalOutputs,
      alreadyTriggered: seamExpansionRounds >= MAX_SEAM_EXPANSION_ROUNDS,
      ...(indexCfg.critiqueExpansionMaxRequests ? { maxItems: Number(indexCfg.critiqueExpansionMaxRequests) } : {}),
    });

    if (!triggerDecision.trigger) return null;

    const pendingSeams = filterPendingSeams(triggerDecision.missingSeams);
    if (pendingSeams.length === 0) {
      recordCritiqueExpansionSignal(operationalSignals, {
        triggered: false,
        reason: 'no-new-missing-seams-after-dedupe',
        expansionRound,
      });
      return null;
    }

    const expansionResult = resolveMissingSeams(pendingSeams, {
      rootDir: PROJECT_ROOT,
      index: codeIndex,
      redactSecrets,
      ...(indexCfg.critiqueExpansionMaxRequests ? { maxItems: Number(indexCfg.critiqueExpansionMaxRequests) } : {}),
      snippetContextLines: Number(indexCfg.critiqueExpansionContextLines || indexCfg.snippetContextLines || 4),
      maxSnippetLines: Number(indexCfg.critiqueExpansionMaxSnippetLines || 120),
    });
    for (const request of pendingSeams) {
      const key = toSeamKey(request);
      if (key) exhaustedSeamKeys.add(key);
    }
    const appendix = buildCritiqueExpansionAppendix(expansionResult, {
      maxAppendixBytes: Number(indexCfg.critiqueExpansionMaxAppendixBytes || 16000),
    });
    const appendixPath = path.join(RUN_ARCHIVE_DIR, `critique-expansion-${expansionRound}.md`);

    recordCritiqueExpansionSignal(operationalSignals, {
      triggered: true,
      reason: triggerDecision.reason,
      expansionRound,
      requestedSeams: expansionResult.requestedSeams,
      fetchedSeams: expansionResult.fetchedSeams,
      skippedSeams: expansionResult.skippedSeams,
      expansionBytes: expansionResult.expansionBytes,
    });
    checkpoint.updatePhase(PROJECT_LAYOUT, 'critique-expansion', {
      status: 'done',
      finishedAt: new Date().toISOString(),
      agent: 'system',
      expansionRound,
      requestedCount: expansionResult.requestedSeams.length,
      fetchedCount: expansionResult.fetchedSeams.length,
      skippedCount: expansionResult.skippedSeams.length,
      appendixFile: appendix ? appendixPath : '',
    });
    seamExpansionRounds = expansionRound;

    if (!appendix || expansionResult.fetchedSeams.length === 0) {
      console.warn('⚠️ Seam expansion was requested, but no deterministic seam fetch succeeded.');
      return null;
    }

    fs.writeFileSync(appendixPath, appendix + '\n');
    recordEvidenceReadFiles(expansionResult.fetchedSeams.map((item) => item.file));

    const seamBasePrompt = getSeamExpansionBasePrompt();
    const expandedPrompt = buildSeamExpandedPrompt(seamBasePrompt, appendix);
    const expansionSuffix = `lever3-${expansionRound}`;
    const proposalStage = `proposal-${expansionSuffix}`;
    const critiqueStage = `critique-${expansionSuffix}`;
    const consensusStage = `consensus-${expansionSuffix}`;
    const revisionStage = `revision-${expansionSuffix}`;
    const phaseOutputs = [];

    console.log('\n🔄 ===== SEAM EXPANSION =====');
    console.log(`📎 Expansion appendix: ${appendixPath}`);
    console.log(`📎 Requested seams: ${expansionResult.requestedSeams.length}, fetched: ${expansionResult.fetchedSeams.length}, skipped: ${expansionResult.skippedSeams.length}`);

    await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'proposal');
    logPhaseRiskForecast({
      phaseLabel: 'Seam Expansion Proposals',
      stage: 'proposal',
      agents: filterByDebatePhase(debateAgents, 'proposal'),
      buildContent: (agent) => buildProposalContent(
        expandedPrompt,
        currentDiscussion,
        agent.role || agent.name || 'agent',
      ),
      contextPrompt: expandedPrompt,
    });

    const expansionProposalResults = await runAgentsWithProviderLimit(filterByDebatePhase(debateAgents, 'proposal'), async (agent) => runLoggedAgentStep(agent, proposalStage, async () => {
      const response = await callAgentWithValidation(
        agent,
        getAgentBundle(agent, 'proposal', expandedPrompt),
        buildProposalContent(expandedPrompt, currentDiscussion, agent.role || agent.name || 'agent'),
        'proposal',
      );
      return {
        agent,
        name: agent.name || 'agent',
        role: agent.role,
        stage: proposalStage,
        text: response.text,
        completionStatus: response.completionStatus,
        meta: response.meta,
        confidence: parseConfidence(response.text),
      };
    }));

    const incompleteExpansionProposalResults = [];
    for (const result of expansionProposalResults) {
      const sanitizedExpProposal = sanitizeUserFacingFinalText(result.text);
      if (sanitizedExpProposal.sanitized) {
        console.warn(`⚠️ Sanitized internal log/meta chatter from ${result.name} ${proposalStage} output.`);
        result.text = sanitizedExpProposal.text;
      }
      const outputPath = path.join(RUN_ARCHIVE_DIR, `${result.name}-${proposalStage}.txt`);
      result.outputPath = outputPath;
      fs.writeFileSync(outputPath, result.text + '\n');
      console.log(`✅ Agent output saved: ${outputPath}`);
      validateEndMarker(result.text, outputPath);
      autoLogAgent(result.name, proposalStage, outputPath, mapCompletionStatusToLogStatus(result.completionStatus), result.text);
      if (result.confidence !== null) confidenceScores.push(result.confidence);
      phaseOutputs.push({ name: result.name, role: result.role, stage: proposalStage, text: result.text });
      if (result.completionStatus !== 'complete') {
        recordIncompleteOutputSignal(operationalSignals, {
          agent: result.name,
          provider: getProviderName(result.agent),
          stage: proposalStage,
          completionStatus: result.completionStatus,
          stopReason: result.meta?.stopReason || result.meta?.providerStopReason || '',
          outputPath,
        });
        incompleteExpansionProposalResults.push(result);
      }
    }
    if (incompleteExpansionProposalResults.length > 0) {
      throw createIncompleteTextOutputError(incompleteExpansionProposalResults[0], proposalStage);
    }

    await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'critique');
    logPhaseRiskForecast({
      phaseLabel: 'Seam Expansion Critiques',
      stage: 'critique',
      agents: filterByDebatePhase(debateAgents, 'critique'),
      buildContent: (agent) => buildCritiqueContentWithProposals(
        expandedPrompt,
        expansionProposalResults,
        runFlow.runId,
        agent.role || agent.name || 'agent',
        agent.name || 'agent',
      ),
      contextPrompt: expandedPrompt,
    });

    const expansionCritiqueResults = await runAgentsWithProviderLimit(filterByDebatePhase(debateAgents, 'critique'), async (agent) => runLoggedAgentStep(agent, critiqueStage, async () => {
      const response = await callAgentWithValidation(
        agent,
        getAgentBundle(agent, 'critique', expandedPrompt),
        buildCritiqueContentWithProposals(
          expandedPrompt,
          expansionProposalResults,
          runFlow.runId,
          agent.role || agent.name || 'agent',
          agent.name || 'agent',
        ),
        'critique',
      );
      return {
        agent,
        name: agent.name || 'agent',
        role: agent.role,
        stage: critiqueStage,
        text: response.text,
        completionStatus: response.completionStatus,
        meta: response.meta,
        confidence: parseConfidence(response.text),
      };
    }));

    const incompleteExpansionCritiqueResults = [];
    for (const result of expansionCritiqueResults) {
      const sanitizedExpCritique = sanitizeUserFacingFinalText(result.text);
      if (sanitizedExpCritique.sanitized) {
        console.warn(`⚠️ Sanitized internal log/meta chatter from ${result.name} ${critiqueStage} output.`);
        result.text = sanitizedExpCritique.text;
      }
      const outputPath = path.join(RUN_ARCHIVE_DIR, `${result.name}-${critiqueStage}.txt`);
      result.outputPath = outputPath;
      fs.writeFileSync(outputPath, result.text + '\n');
      console.log(`✅ Agent output saved: ${outputPath}`);
      validateEndMarker(result.text, outputPath);
      autoLogAgent(result.name, critiqueStage, outputPath, mapCompletionStatusToLogStatus(result.completionStatus), result.text);
      if (result.confidence !== null) confidenceScores.push(result.confidence);
      phaseOutputs.push({ name: result.name, role: result.role, stage: critiqueStage, text: result.text });
      if (result.completionStatus !== 'complete') {
        recordIncompleteOutputSignal(operationalSignals, {
          agent: result.name,
          provider: getProviderName(result.agent),
          stage: critiqueStage,
          completionStatus: result.completionStatus,
          stopReason: result.meta?.stopReason || result.meta?.providerStopReason || '',
          outputPath,
        });
        incompleteExpansionCritiqueResults.push(result);
      }
    }
    if (incompleteExpansionCritiqueResults.length > 0) {
      throw createIncompleteTextOutputError(incompleteExpansionCritiqueResults[0], critiqueStage);
    }

    let expansionDiscussionSoFar = buildDiscussionLog([...agentsOutputs, ...phaseOutputs]);
    const expandedConsensusContent = buildConsensusContent(
      expandedPrompt,
      expansionDiscussionSoFar,
      consensusAgent.role || consensusAgent.name || 'consensus',
    );
    const expansionConsensusResponse = await runLoggedAgentStep(consensusAgent, consensusStage, () => callAgentWithValidation(
      consensusAgent,
      getAgentBundle(consensusAgent, 'consensus', expandedPrompt),
      expandedConsensusContent,
      'consensus',
    ));
    const sanitizedExpansionConsensus = sanitizeUserFacingFinalText(expansionConsensusResponse.text);
    if (sanitizedExpansionConsensus.sanitized) {
      console.warn('⚠️ Sanitized internal log/meta chatter from seam expansion consensus output.');
    }
    let expandedConsensusText = sanitizedExpansionConsensus.text;
    if (expansionConsensusResponse.completionStatus !== 'complete') {
      const outputPath = path.join(RUN_ARCHIVE_DIR, `${consensusAgent.name || 'consensus'}-${consensusStage}.txt`);
      fs.writeFileSync(outputPath, expandedConsensusText + '\n');
      validateEndMarker(expandedConsensusText, outputPath);
      autoLogAgent(consensusAgent.name || 'consensus', consensusStage, outputPath, mapCompletionStatusToLogStatus(expansionConsensusResponse.completionStatus), expandedConsensusText);
      throw createIncompleteTextOutputError({
        agent: consensusAgent,
        name: consensusAgent.name || 'consensus',
        completionStatus: expansionConsensusResponse.completionStatus,
        meta: expansionConsensusResponse.meta,
        outputPath,
      }, consensusStage);
    }

    const approvalAgents = filterByDebatePhase(debateAgents, 'approval');
    const MAX_APPROVAL_ROUNDS = 2;
    let expandedAllAgreed = approvalAgents.length === 0;
    let expandedApprovalRound = 0;
    let expandedLatestApprovalOutputs = [];
    let expandedLastDisagreements = [];

    while (!expandedAllAgreed && expandedApprovalRound < MAX_APPROVAL_ROUNDS) {
      const roundNumber = expandedApprovalRound + 1;
      console.log(`🔄 Seam expansion approval round ${roundNumber}...`);
      await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'approval');

      const approvalResults = await runAgentsWithProviderLimit(approvalAgents, async (agent) => runLoggedAgentStep(agent, `approval-${expansionSuffix}-${roundNumber}`, async () => {
        const reviewContent = buildConsensusReviewContent(
          expandedPrompt,
          expansionDiscussionSoFar,
          expandedConsensusText,
          agent.role || agent.name || 'agent',
        );
        const reviewResponse = await callApprovalReviewWithRepair(
          agent,
          getAgentBundle(agent, 'approval', expandedPrompt),
          reviewContent,
          `approval-${roundNumber}`,
        );
        return {
          agent,
          name: agent.name || 'agent',
          role: agent.role,
          stage: `approval-${expansionSuffix}-${roundNumber}`,
          text: reviewResponse.text,
          completionStatus: reviewResponse.completionStatus,
          meta: reviewResponse.meta,
          approval: reviewResponse.approval,
        };
      }));

      const approvalOutputs = [];
      const revisionNotes = [];
      expandedAllAgreed = true;
      const incompleteApprovalResults = [];

      for (const result of approvalResults) {
        const outputPath = path.join(RUN_ARCHIVE_DIR, `${result.name}-${result.stage}.json`);
        result.outputPath = outputPath;
        const rawOutputPath = writeJsonArtifactWithRaw(outputPath, result.approval, result.text);
        console.log(`✅ Agent output saved: ${outputPath}`);
        console.log(`🧾 Raw approval saved: ${rawOutputPath}`);
        autoLogAgent(result.name, result.stage, outputPath, mapCompletionStatusToLogStatus(result.completionStatus), result.text);

        const outputEntry = {
          name: result.name,
          role: result.role,
          stage: result.stage,
          text: result.text,
        };
        approvalOutputs.push(outputEntry);

        if (result.completionStatus !== 'complete') {
          expandedAllAgreed = false;
          incompleteApprovalResults.push(result);
          recordIncompleteOutputSignal(operationalSignals, {
            agent: result.name,
            provider: getProviderName(result.agent),
            stage: result.stage,
            completionStatus: result.completionStatus,
            stopReason: result.meta?.stopReason || result.meta?.providerStopReason || '',
            outputPath,
          });
          continue;
        }

        if (!result.approval.agreed) {
          expandedAllAgreed = false;
          revisionNotes.push(`- ${result.name}${result.role ? ` (${result.role})` : ''}: ${result.approval.notes}`);
        }
      }

      phaseOutputs.push(...approvalOutputs);
      expandedLatestApprovalOutputs = approvalResults.map((result) => ({
        name: result.name,
        role: result.role,
        stage: result.stage,
        approval: result.approval,
      }));
      expansionDiscussionSoFar = buildDiscussionLog([...agentsOutputs, ...phaseOutputs]);

      if (incompleteApprovalResults.length > 0) {
        throw createIncompleteStructuredOutputError(incompleteApprovalResults[0], `approval-${expansionSuffix}-${roundNumber}`);
      }

      if (expandedAllAgreed) break;

      expandedApprovalRound += 1;
      expandedLastDisagreements = revisionNotes;
      const revisionResponse = await runLoggedAgentStep(consensusAgent, revisionStage, () => callAgentWithValidation(
        consensusAgent,
        getAgentBundle(consensusAgent, 'revision', expandedPrompt),
        buildConsensusRevisionContent(
          expandedPrompt,
          expansionDiscussionSoFar,
          expandedConsensusText,
          revisionNotes.join('\n'),
        ),
        'revision',
      ));
      const sanitizedRevision = sanitizeUserFacingFinalText(revisionResponse.text);
      if (sanitizedRevision.sanitized) {
        console.warn('⚠️ Sanitized internal log/meta chatter from seam expansion revision output.');
      }
      expandedConsensusText = sanitizedRevision.text;
      if (revisionResponse.completionStatus !== 'complete') {
        const outputPath = path.join(RUN_ARCHIVE_DIR, `${consensusAgent.name || 'consensus'}-${revisionStage}.txt`);
        fs.writeFileSync(outputPath, expandedConsensusText + '\n');
        validateEndMarker(expandedConsensusText, outputPath);
        autoLogAgent(consensusAgent.name || 'consensus', revisionStage, outputPath, mapCompletionStatusToLogStatus(revisionResponse.completionStatus), expandedConsensusText);
        throw createIncompleteTextOutputError({
          agent: consensusAgent,
          name: consensusAgent.name || 'consensus',
          completionStatus: revisionResponse.completionStatus,
          meta: revisionResponse.meta,
          outputPath,
        }, revisionStage);
      }
    }

    const expandedTrust = assessFinalResultTrust(expandedConsensusText, {
      allAgreed: expandedAllAgreed,
      codeIndex,
      observedFiles: getObservedEvidenceFiles(),
    });

    agentsOutputs.push(...phaseOutputs);

    console.log('✅ Seam expansion round completed.');
    console.log('=====================================\n');

    return {
      expandedPrompt,
      finalConsensusText: expandedConsensusText,
      approvalConsensusAllAgreed: expandedAllAgreed,
      latestApprovalOutputs: expandedLatestApprovalOutputs,
      discussionSoFar: buildDiscussionLog(agentsOutputs),
      resultTrust: expandedTrust,
      appendixPath,
      lastDisagreements: expandedLastDisagreements,
    };
  }

  // ===== PRE-PROCESS PHASE (Prompt Engineer) =====
  if (ENABLE_PREPOST && preProcessAgents.length > 0 && !SKIP_ENHANCE) {
    if (resumeMode && checkpoint.isPhaseDone(PROJECT_LAYOUT, 'preprocess')) {
      console.log('\n📝 ===== PRE-PROCESS PHASE (cached) =====');
      const cached = checkpoint.getPhaseOutput(PROJECT_LAYOUT, 'preprocess');
      if (cached) {
        try {
          promptEngineerResult = normalizePromptEngineerResult(JSON.parse(cached), originalPrompt);
          if (promptEngineerResult && promptEngineerResult.enhancedPrompt) {
            workingPrompt = promptEngineerResult.enhancedPrompt;
          }
          const promptScopeArtifacts = persistPromptScopeArtifacts(promptEngineerResult, {
            runArchiveDir: RUN_ARCHIVE_DIR,
          });
          promptScopeWarningPath = promptScopeArtifacts.warningPath;
          promptScopeSuggestedPromptPath = promptScopeArtifacts.suggestedPromptPath;
          if (promptScopeArtifacts.risk !== 'none') {
            console.warn(`⚠️ Prompt scope risk: ${promptScopeArtifacts.risk}`);
            for (const note of promptScopeArtifacts.notes) {
              console.warn(`   - ${note}`);
            }
            if (promptScopeWarningPath) {
              console.warn(`   Details: ${toRelativePath(promptScopeWarningPath)}`);
            }
            if (promptScopeSuggestedPromptPath) {
              console.warn(`   Suggested broadened prompt: ${toRelativePath(promptScopeSuggestedPromptPath)}`);
            }
          }
          console.log('✅ Pre-process result loaded from checkpoint.');
        } catch (error) {
          console.warn(`⚠️ Failed to parse cached preprocess result: ${error.message}`);
        }
      }
      console.log('================================\n');
    } else if (reusedPreprocessResult) {
      console.log('\n📝 ===== PRE-PROCESS PHASE (reused) =====');
      promptEngineerResult = reusedPreprocessResult.promptEngineerResult;
      const promptScopeArtifacts = persistPromptScopeArtifacts(promptEngineerResult, {
        runArchiveDir: RUN_ARCHIVE_DIR,
      });
      promptScopeWarningPath = promptScopeArtifacts.warningPath;
      promptScopeSuggestedPromptPath = promptScopeArtifacts.suggestedPromptPath;

      const preprocessAgentName = preProcessAgents[0]?.name || reusedPreprocessResult.agent || 'prompt-engineer';
      const outputPath = path.join(RUN_ARCHIVE_DIR, `${preprocessAgentName}-analysis.json`);
      fs.writeFileSync(outputPath, `${JSON.stringify(promptEngineerResult, null, 2)}\n`);
      checkpoint.updatePhase(PROJECT_LAYOUT, 'preprocess', {
        status: 'done',
        finishedAt: new Date().toISOString(),
        outputFile: outputPath,
        outputFormat: 'json',
        agent: preprocessAgentName,
      });

      if (promptEngineerResult.enhancedPrompt) {
        workingPrompt = promptEngineerResult.enhancedPrompt;
        const enhancedPath = path.join(RUN_ARCHIVE_DIR, 'enhanced-prompt.txt');
        fs.writeFileSync(enhancedPath, workingPrompt);
      }

      console.log(`♻️ Reused prompt analysis from ${reusedPreprocessResult.runId}`);
      if (promptEngineerResult.enhancedPrompt) {
        console.log('✨ Prompt enhancement reused successfully');
      }
      if (promptEngineerResult.scopeRisk !== 'none') {
        console.warn(`⚠️ Prompt scope risk: ${promptEngineerResult.scopeRisk}`);
        for (const note of promptEngineerResult.scopeNotes) {
          console.warn(`   - ${note}`);
        }
        if (promptScopeWarningPath) {
          console.warn(`   Details: ${toRelativePath(promptScopeWarningPath)}`);
        }
        if (promptScopeSuggestedPromptPath) {
          console.warn(`   Suggested broadened prompt: ${toRelativePath(promptScopeSuggestedPromptPath)}`);
        }
      }
      console.log('================================\n');
    } else {
      console.log('\n📝 ===== PRE-PROCESS PHASE =====');
      await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'pre-process');
      logPhaseRiskForecast({
        phaseLabel: 'Pre-process',
        stage: 'pre-process',
        agents: preProcessAgents,
        buildContent: () => buildPromptEngineerContent(originalPrompt),
        contextPrompt: originalPrompt,
      });
      for (const agent of preProcessAgents) {
        console.log(`🔧 ${agent.role || agent.name}: Analyzing and enhancing prompt...`);
        const promptEngineerContent = buildPromptEngineerContent(originalPrompt);
        const response = await runLoggedAgentStep(agent, 'pre-process', () => callAgentWithValidation(
          agent,
          getAgentBundle(agent, 'pre-process', originalPrompt),
          promptEngineerContent,
          'pre-process',
          { responseFormat: 'json', enableRepair: false, allowTools: false },
        ));
        const responseText = response.text;

        const outputPath = path.join(RUN_ARCHIVE_DIR, `${agent.name}-analysis.json`);
        validateEndMarker(responseText, outputPath);
        autoLogAgent(agent.name, 'pre-process', outputPath, 'Completed', responseText);

        promptEngineerResult = parsePromptEngineerResponse(responseText);
        const promptScopeArtifacts = persistPromptScopeArtifacts(promptEngineerResult, {
          runArchiveDir: RUN_ARCHIVE_DIR,
        });
        promptScopeWarningPath = promptScopeArtifacts.warningPath;
        promptScopeSuggestedPromptPath = promptScopeArtifacts.suggestedPromptPath;

        // Save prompt engineer output and raw provider response for forensics
        const rawOutputPath = writeJsonArtifactWithRaw(outputPath, promptEngineerResult, responseText);
        console.log(`✅ Prompt analysis saved: ${outputPath}`);
        console.log(`🧾 Raw prompt analysis saved: ${rawOutputPath}`);
        checkpoint.updatePhase(PROJECT_LAYOUT, 'preprocess', {
          status: 'done',
          finishedAt: new Date().toISOString(),
          outputFile: outputPath,
          outputFormat: 'json',
          agent: agent.name,
        });

        // Use enhanced prompt for the rest of the workflow
        if (promptEngineerResult.enhancedPrompt) {
          workingPrompt = promptEngineerResult.enhancedPrompt;
          console.log('✨ Prompt enhanced successfully');

          // Save enhanced prompt
          const enhancedPath = path.join(RUN_ARCHIVE_DIR, 'enhanced-prompt.txt');
          fs.writeFileSync(enhancedPath, workingPrompt);

          if (promptEngineerResult.analysis) {
            console.log(`📊 Analysis: ${promptEngineerResult.analysis.substring(0, 100)}...`);
          }
          if (promptEngineerResult.assumptions.length > 0) {
            console.log(`⚠️ Assumptions: ${promptEngineerResult.assumptions.length} made`);
          }
        }
        if (promptEngineerResult.scopeRisk !== 'none') {
          console.warn(`⚠️ Prompt scope risk: ${promptEngineerResult.scopeRisk}`);
          for (const note of promptEngineerResult.scopeNotes) {
            console.warn(`   - ${note}`);
          }
          if (promptScopeWarningPath) {
            console.warn(`   Details: ${toRelativePath(promptScopeWarningPath)}`);
          }
          if (promptScopeSuggestedPromptPath) {
            console.warn(`   Suggested broadened prompt: ${toRelativePath(promptScopeSuggestedPromptPath)}`);
          }
        }
      }
      console.log('================================\n');
    }
  }
  if (SKIP_ENHANCE && ENABLE_PREPOST) {
    console.log('\n📝 ===== PRE-PROCESS PHASE (skipped: --skip-enhance) =====');
    console.log('================================\n');
  }

  // ===== COMPLEXITY ROUTING =====
  const taskComplexity = FULL_PANEL ? 'complex' : (promptEngineerResult?.complexity || 'standard');
  operationalSignals.complexity = taskComplexity;
  if (taskComplexity !== 'complex') {
    console.log(`📊 Task complexity: ${taskComplexity}${FULL_PANEL ? ' (overridden by --full-panel)' : ''}`);
  }

  // ===== PROMPT QUALITY GATE =====
  const promptGateCfg = contextConfig.promptGate;
  if (promptGateCfg && promptGateCfg.enabled !== false && codeIndex) {
    const gateResult = promptGate.scorePrompt(workingPrompt, codeIndex, promptGateCfg);
    console.log('\n🔍 Prompt quality gate:');
    console.log(promptGate.formatGateResult(gateResult));

    if (gateResult.verdict === 'block') {
      console.warn(`⚠️  Prompt is too vague (score: ${gateResult.score}). No code symbols or files matched.`);
      console.warn('   Consider adding specific file names, function names, or error messages.');

      if (process.stdin.isTTY && !NON_INTERACTIVE) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((resolve) => {
          rl.question('   Continue anyway? [y/N] ', resolve);
        });
        rl.close();

        const normalized = String(answer || '').trim().toLowerCase();
        if (!normalized || (normalized !== 'y' && normalized !== 'yes')) {
          console.log('   Aborted. Please refine your prompt.');
          return;
        }
      }
    } else if (gateResult.verdict === 'warn') {
      console.warn(`⚠️  Prompt has low specificity (score: ${gateResult.score}). Results may be generic.`);
    } else {
      console.log('   ✅ Prompt quality: good');
    }
  }

  const agentsOutputs = [];
  let discussionSoFar = '';
  const confidenceScores = []; // Track confidence from all responses

  // ===== PROPOSALS (Anthropic sequential, others parallel) =====
  console.log('🚀 Starting proposals...');
  await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'proposal');
  logPhaseRiskForecast({
    phaseLabel: 'Proposal',
    stage: 'proposal',
    agents: filterByComplexityAndPhase(debateAgents, 'proposal', taskComplexity),
    checkpointPhase: 'proposals',
    buildContent: (agent) => buildProposalContent(workingPrompt, '', agent.role || agent.name || 'agent'),
  });
  const proposalResults = await runAgentsWithProviderLimit(filterByComplexityAndPhase(debateAgents, 'proposal', taskComplexity), async (agent) => runLoggedAgentStep(agent, 'proposal', async () => {
    const agentName = agent.name || 'agent';
    if (resumeMode && checkpoint.isAgentDone(PROJECT_LAYOUT, 'proposals', agentName)) {
      console.log(`   ✅ ${agentName} proposal loaded from checkpoint.`);
      const cachedText = checkpoint.getAgentOutput(PROJECT_LAYOUT, 'proposals', agentName);
      const confidence = parseConfidence(cachedText || '');
      return {
        agent,
        name: agentName,
        role: agent.role,
        stage: 'proposal',
        text: cachedText || '',
        confidence,
        fromCheckpoint: true,
      };
    }

    const roleLabel = agent.role || agent.name || 'agent';
    const dynamicContent = buildProposalContent(workingPrompt, '', roleLabel);
    const response = await callAgentWithValidation(
      agent,
      getAgentBundle(agent, 'proposal', workingPrompt),
      dynamicContent,
      'proposal',
    );
    const responseText = response.text;
    const confidence = parseConfidence(responseText);
    return {
      agent,
      name: agentName,
      role: agent.role,
      stage: 'proposal',
      text: responseText,
      completionStatus: response.completionStatus,
      meta: response.meta,
      confidence,
      fromCheckpoint: false,
    };
  }));

  // Save proposal outputs and track confidence
  const incompleteProposalResults = [];
  for (const result of proposalResults) {
    agentsOutputs.push({
      name: result.name,
      role: result.role,
      stage: result.stage,
      text: result.text,
    });
    if (result.confidence !== null) {
      confidenceScores.push(result.confidence);
      console.log(`📊 ${result.name} confidence: ${result.confidence}%`);
    }
    if (!result.fromCheckpoint) {
      const sanitizedProposal = sanitizeUserFacingFinalText(result.text);
      if (sanitizedProposal.sanitized) {
        console.warn(`⚠️ Sanitized internal log/meta chatter from ${result.name} proposal output.`);
        result.text = sanitizedProposal.text;
      }
      const outputPath = path.join(RUN_ARCHIVE_DIR, `${result.name}-proposal.txt`);
      result.outputPath = outputPath;
      fs.writeFileSync(outputPath, result.text + '\n');
      console.log(`✅ Agent output saved: ${outputPath}`);

      // Validate end marker and auto-log
      validateEndMarker(result.text, outputPath);
      autoLogAgent(result.name, 'proposal', outputPath, mapCompletionStatusToLogStatus(result.completionStatus), result.text);
      checkpoint.updatePhaseAgent(PROJECT_LAYOUT, 'proposals', result.name, {
        status: mapCompletionStatusToCheckpointStatus(result.completionStatus),
        outputFile: outputPath,
        outputFormat: 'text',
        completionStatus: result.completionStatus,
        stopReason: result.meta?.stopReason || '',
      });
      if (result.completionStatus !== 'complete') {
        recordIncompleteOutputSignal(operationalSignals, {
          agent: result.name,
          provider: getProviderName(result.agent),
          stage: 'proposal',
          completionStatus: result.completionStatus,
          stopReason: result.meta?.stopReason || result.meta?.providerStopReason || '',
          outputPath,
        });
        incompleteProposalResults.push(result);
      }
    }
  }

  if (incompleteProposalResults.length > 0) {
    throw createIncompleteTextOutputError(incompleteProposalResults[0], 'proposal');
  }

  if (proposalResults.length === 0) {
    throw new Error('All proposal agents failed. Cannot continue without at least one proposal.');
  }

  if (proposalResults.length < debateAgents.filter((a) => (a.debatePhases || ['proposal']).includes('proposal')).length) {
    const succeeded = proposalResults.map((r) => r.name).join(', ');
    console.warn(`⚠️ Only ${proposalResults.length} proposal(s) succeeded (${succeeded}). Continuing with partial results.`);
  }

  discussionSoFar = buildDiscussionLog(agentsOutputs);

  // ===== CRITIQUES (Anthropic sequential, others parallel) =====
  // Use Context Injection: inject proposals from other agents
  console.log('🔍 Starting critiques with Context Injection...');
  await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'critique');
  logPhaseRiskForecast({
    phaseLabel: 'Critique',
    stage: 'critique',
    agents: filterByComplexityAndPhase(debateAgents, 'critique', taskComplexity),
    checkpointPhase: 'critiques',
    buildContent: (agent) => buildCritiqueContentWithProposals(
      workingPrompt,
      proposalResults,
      runFlow.runId,
      agent.role || agent.name || 'agent',
      agent.name || 'agent',
    ),
  });
  const critiqueResults = await runAgentsWithProviderLimit(filterByComplexityAndPhase(debateAgents, 'critique', taskComplexity), async (agent) => runLoggedAgentStep(agent, 'critique', async () => {
    const roleLabel = agent.role || agent.name || 'agent';
    const agentName = agent.name || 'agent';

    if (resumeMode && checkpoint.isAgentDone(PROJECT_LAYOUT, 'critiques', agentName)) {
      console.log(`   ✅ ${agentName} critique loaded from checkpoint.`);
      const cachedText = checkpoint.getAgentOutput(PROJECT_LAYOUT, 'critiques', agentName);
      const confidence = parseConfidence(cachedText || '');
      return {
        agent,
        name: agentName,
        role: agent.role,
        stage: 'critique',
        text: cachedText || '',
        confidence,
        fromCheckpoint: true,
      };
    }

    // Use new buildCritiqueContentWithProposals for explicit cross-referencing
    const critiqueContent = buildCritiqueContentWithProposals(
      workingPrompt,
      proposalResults,
      runFlow.runId,
      roleLabel,
      agentName
    );

    const response = await callAgentWithValidation(
      agent,
      getAgentBundle(agent, 'critique', workingPrompt),
      critiqueContent,
      'critique',
    );
    const responseText = response.text;
    const confidence = parseConfidence(responseText);
    return {
      agent,
      name: agentName,
      role: agent.role,
      stage: 'critique',
      text: responseText,
      completionStatus: response.completionStatus,
      meta: response.meta,
      confidence,
      fromCheckpoint: false,
    };
  }));

  // Save critique outputs and track confidence
  const incompleteCritiqueResults = [];
  for (const result of critiqueResults) {
    agentsOutputs.push({
      name: result.name,
      role: result.role,
      stage: result.stage,
      text: result.text,
    });
    if (result.confidence !== null) {
      confidenceScores.push(result.confidence);
      console.log(`📊 ${result.name} critique confidence: ${result.confidence}%`);
    }
    if (!result.fromCheckpoint) {
      const sanitizedCritique = sanitizeUserFacingFinalText(result.text);
      if (sanitizedCritique.sanitized) {
        console.warn(`⚠️ Sanitized internal log/meta chatter from ${result.name} critique output.`);
        result.text = sanitizedCritique.text;
      }
      const outputPath = path.join(RUN_ARCHIVE_DIR, `${result.name}-critique.txt`);
      result.outputPath = outputPath;
      fs.writeFileSync(outputPath, result.text + '\n');
      console.log(`✅ Agent output saved: ${outputPath}`);

      // Validate end marker and auto-log
      validateEndMarker(result.text, outputPath);
      autoLogAgent(result.name, 'critique', outputPath, mapCompletionStatusToLogStatus(result.completionStatus), result.text);
      checkpoint.updatePhaseAgent(PROJECT_LAYOUT, 'critiques', result.name, {
        status: mapCompletionStatusToCheckpointStatus(result.completionStatus),
        outputFile: outputPath,
        outputFormat: 'text',
        completionStatus: result.completionStatus,
        stopReason: result.meta?.stopReason || '',
      });
      if (result.completionStatus !== 'complete') {
        recordIncompleteOutputSignal(operationalSignals, {
          agent: result.name,
          provider: getProviderName(result.agent),
          stage: 'critique',
          completionStatus: result.completionStatus,
          stopReason: result.meta?.stopReason || result.meta?.providerStopReason || '',
          outputPath,
        });
        incompleteCritiqueResults.push(result);
      }
    }
  }

  if (incompleteCritiqueResults.length > 0) {
    throw createIncompleteTextOutputError(incompleteCritiqueResults[0], 'critique');
  }

  if (critiqueResults.length === 0) {
    throw new Error('All critique agents failed. Cannot continue without at least one critique.');
  }

  if (critiqueResults.length < debateAgents.filter((a) => (a.debatePhases || ['critique']).includes('critique')).length) {
    const succeeded = critiqueResults.map((r) => r.name).join(', ');
    console.warn(`⚠️ Only ${critiqueResults.length} critique(s) succeeded (${succeeded}). Continuing with partial results.`);
  }

  // ===== AGREEMENT SCORING =====
  const critiqueTexts = critiqueResults
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item.text === 'string') return item.text;
      if (item && typeof item.content === 'string') return item.content;
      return '';
    })
    .filter(Boolean);
  const agreementScore = computeAgreementScore(critiqueTexts);
  if (agreementScore !== null) {
    const label = agreementScore >= 50 ? '✅ sufficient' : '⚠️ low';
    console.log(`\n📊 Agreement score: ${agreementScore}% (${label})`);
    if (agreementScore < 30) {
      console.warn(`⚠️  Very low agreement (${agreementScore}%). Consensus may be unreliable.`);
      console.warn('   Consider refining the prompt or adding more context.');
    }
  }

  // Calculate and display average confidence
  // Default to 70% if no agents provided confidence scores
  const DEFAULT_CONFIDENCE = 70;
  const rawAvgConfidence = calculateAverageConfidence(confidenceScores);
  const avgConfidence = rawAvgConfidence !== null ? rawAvgConfidence : DEFAULT_CONFIDENCE;

  const confEmoji = avgConfidence >= 80 ? '🟢' : avgConfidence >= 60 ? '🟡' : '🔴';
  if (rawAvgConfidence !== null) {
    console.log(`${confEmoji} Average confidence: ${avgConfidence}%`);
  } else {
    console.log(`${confEmoji} Average confidence: ${avgConfidence}% (default - no scores provided)`);
  }
  metrics.avgConfidence = avgConfidence;

  discussionSoFar = buildDiscussionLog(agentsOutputs);

  // ===== CONSENSUS =====
  let finalConsensusText = '';
  let approvalConsensusAllAgreed = true;
  let currentResultTrust = null;
  let latestApprovalOutputs = [];
  if (resumeMode && checkpoint.isPhaseDone(PROJECT_LAYOUT, 'consensus')) {
    console.log('🤝 Consensus loaded from checkpoint.');
    finalConsensusText = sanitizeUserFacingFinalText(
      checkpoint.getPhaseOutput(PROJECT_LAYOUT, 'consensus') || '',
    ).text;
    currentResultTrust = assessFinalResultTrust(finalConsensusText, {
      allAgreed: approvalConsensusAllAgreed,
      codeIndex,
      observedFiles: getObservedEvidenceFiles(),
    });
  } else {
    await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'consensus');
    logPhaseRiskForecast({
      phaseLabel: 'Consensus',
      stage: 'consensus',
      agents: [consensusAgent],
      buildContent: (agent) => buildConsensusContent(workingPrompt, discussionSoFar, agent.role || agent.name || 'consensus'),
    });
    const consensusRole = consensusAgent.role || consensusAgent.name || 'consensus';
    const consensusContent = buildConsensusContent(workingPrompt, discussionSoFar, consensusRole);
    const consensusResponse = await runLoggedAgentStep(consensusAgent, 'consensus', () => callAgentWithValidation(
      consensusAgent,
      getAgentBundle(consensusAgent, 'consensus', workingPrompt),
      consensusContent,
      'consensus',
    ));
    const sanitizedConsensus = sanitizeUserFacingFinalText(consensusResponse.text);
    if (sanitizedConsensus.sanitized) {
      console.warn('⚠️ Sanitized internal log/meta chatter from consensus output.');
    }
    finalConsensusText = sanitizedConsensus.text;
    const consensusOutputPath = path.join(RUN_ARCHIVE_DIR, `${consensusAgent.name || 'consensus'}-consensus.txt`);
    fs.writeFileSync(consensusOutputPath, finalConsensusText + '\n');
    console.log(`✅ Consensus output archived: ${consensusOutputPath}`);
    validateEndMarker(finalConsensusText, consensusOutputPath);
    autoLogAgent(
      consensusAgent.name || 'consensus',
      'consensus',
      consensusOutputPath,
      mapCompletionStatusToLogStatus(consensusResponse.completionStatus),
      finalConsensusText,
    );
    checkpoint.updatePhase(PROJECT_LAYOUT, 'consensus', {
      status: mapCompletionStatusToCheckpointStatus(consensusResponse.completionStatus),
      finishedAt: new Date().toISOString(),
      outputFile: consensusOutputPath,
      outputFormat: 'text',
      agent: consensusAgent.name || 'consensus',
      completionStatus: consensusResponse.completionStatus,
      stopReason: consensusResponse.meta?.stopReason || '',
    });
    if (consensusResponse.completionStatus !== 'complete') {
      recordIncompleteOutputSignal(operationalSignals, {
        agent: consensusAgent.name || 'consensus',
        provider: getProviderName(consensusAgent),
        stage: 'consensus',
        completionStatus: consensusResponse.completionStatus,
        stopReason: consensusResponse.meta?.stopReason || consensusResponse.meta?.providerStopReason || '',
        outputPath: consensusOutputPath,
      });
      throw createIncompleteTextOutputError({
        agent: consensusAgent,
        name: consensusAgent.name || 'consensus',
        completionStatus: consensusResponse.completionStatus,
        meta: consensusResponse.meta,
        outputPath: consensusOutputPath,
      }, 'consensus');
    }

    // ===== APPROVAL ROUNDS =====
    const approvalAgents = filterByComplexityAndPhase(debateAgents, 'approval', taskComplexity);
    const MAX_APPROVAL_ROUNDS = 2;
    let approvalRound = 0;
    let allAgreed = false;
    let lastDisagreements = [];
    let lastRoundNumber = 0;
    let warningRelativePath = '';
    let previousRoundSeamKeys = new Set();
    let previousRoundTrustSnapshot = null;
    let triggerSeamExpansion = false;
    let critiqueSeamOverlapRecorded = false;

    if (approvalAgents.length === 0) {
      console.log('ℹ️ No agents configured for approval phase. Skipping approval rounds.');
      allAgreed = true;
    }

    // ===== APPROVAL CHECKPOINT RESUME =====
    if (resumeMode && checkpoint.isPhaseDone(PROJECT_LAYOUT, 'approval')) {
      console.log('✅ Approval loaded from checkpoint.');
      const cachedApproval = checkpoint.loadRun(PROJECT_LAYOUT);
      const approvalPhase = cachedApproval?.phases?.['approval'];
      if (approvalPhase) {
        allAgreed = approvalPhase.allAgreed === true;
        lastRoundNumber = approvalPhase.lastRound || 1;
        const agentEntries = approvalPhase.agents || {};
        latestApprovalOutputs = Object.entries(agentEntries).map(([name, data]) => ({
          name,
          role: data.role || '',
          stage: `approval-${lastRoundNumber}`,
          approval: {
            agreed: data.agreed === true,
            score: data.score,
          },
        }));
        currentResultTrust = assessFinalResultTrust(finalConsensusText, {
          allAgreed,
          codeIndex,
          observedFiles: getObservedEvidenceFiles(),
        });
      }
    }

    while (!allAgreed && approvalRound < MAX_APPROVAL_ROUNDS) {
      const roundNumber = approvalRound + 1;
      lastRoundNumber = roundNumber;
      metrics.consensusRounds = roundNumber;

      console.log(`🔄 Approval round ${roundNumber}...`);
      await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'approval');

      // Approval requests (Anthropic sequential, others parallel)
      let approvalResults;
      let approvalRetries = 0;
      const MAX_APPROVAL_RETRIES = 3;
      while (true) {
        try {
          approvalResults = await runAgentsWithProviderLimit(approvalAgents, async (agent) => runLoggedAgentStep(agent, `approval-${roundNumber}`, async () => {
            const roleLabel = agent.role || agent.name || 'agent';
            const reviewContent = buildConsensusReviewContent(
              workingPrompt,
              discussionSoFar,
              finalConsensusText,
              roleLabel,
            );
            const reviewResponse = await callApprovalReviewWithRepair(
              agent,
              getAgentBundle(agent, 'approval', workingPrompt),
              reviewContent,
              `approval-${roundNumber}`,
            );

            return {
              agent,
              name: agent.name || 'agent',
              role: agent.role,
              stage: `approval-${roundNumber}`,
              text: reviewResponse.text,
              completionStatus: reviewResponse.completionStatus,
              meta: reviewResponse.meta,
              approval: reviewResponse.approval,
            };
          }));
          break; // success
        } catch (approvalError) {
          approvalRetries++;
          const failedAgent = approvalError.agentName || 'unknown';
          const reason = approvalError.requestTimedOut ? `timeout (${approvalError.timeoutMs}ms)` : approvalError.message;
          console.error(`\n❌ Approval round ${roundNumber} failed: ${failedAgent} — ${reason}`);

          if (approvalRetries >= MAX_APPROVAL_RETRIES) {
            console.log(`⏸️  Max retries (${MAX_APPROVAL_RETRIES}) reached. Saving checkpoint and stopping.`);
            checkpoint.updatePhase(PROJECT_LAYOUT, `approval-${roundNumber}`, {
              status: 'failed',
              failedAt: new Date().toISOString(),
              failReason: reason,
            });
            console.log(`\n💾 Run paused. Re-run with the same prompt to resume from approval.`);
            return;
          }

          if (process.stdin.isTTY && !NON_INTERACTIVE) {
            const readline = require('readline');
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const answer = await new Promise((resolve) => {
              rl.question(`   Retry approval round? [Y/n] `, resolve);
            });
            rl.close();
            const normalized = String(answer || 'y').trim().toLowerCase();
            if (normalized === 'n' || normalized === 'no') {
              checkpoint.updatePhase(PROJECT_LAYOUT, `approval-${roundNumber}`, {
                status: 'paused',
                pausedAt: new Date().toISOString(),
                pauseReason: reason,
              });
              console.log(`\n💾 Run paused. Re-run with the same prompt to resume.`);
              return;
            }
            const delay = Math.min(30000, 10000 * approvalRetries);
            console.log(`⏳ Retrying in ${delay / 1000}s...`);
            await sleep(delay);
          } else {
            const delay = Math.min(60000, 15000 * approvalRetries);
            console.log(`⏳ Auto-retrying in ${delay / 1000}s... (attempt ${approvalRetries}/${MAX_APPROVAL_RETRIES})`);
            await sleep(delay);
          }
        }
      }

      const approvalOutputs = [];
      const revisionNotes = [];
      allAgreed = true;
      const incompleteApprovalResults = [];

      for (const result of approvalResults) {
        approvalOutputs.push({
          name: result.name,
          role: result.role,
          stage: result.stage,
          text: result.text,
        });

        const outputPath = path.join(
          RUN_ARCHIVE_DIR,
          `${result.name}-approval-${roundNumber}.json`,
        );
        result.outputPath = outputPath;
        const rawOutputPath = writeJsonArtifactWithRaw(outputPath, result.approval, result.text);
        console.log(`✅ Agent output saved: ${outputPath}`);
        console.log(`🧾 Raw approval saved: ${rawOutputPath}`);
        autoLogAgent(
          result.name,
          `approval-${roundNumber}`,
          outputPath,
          mapCompletionStatusToLogStatus(result.completionStatus),
          result.text,
        );
        checkpoint.updatePhaseAgent(PROJECT_LAYOUT, `approval-${roundNumber}`, result.name, {
          status: mapCompletionStatusToCheckpointStatus(result.completionStatus),
          outputFile: outputPath,
          outputFormat: 'json',
          completionStatus: result.completionStatus,
          stopReason: result.meta?.stopReason || '',
          rawOutputFile: rawOutputPath,
          agreed: result.approval?.agreed === true,
          score: Number.isFinite(result.approval?.score) ? result.approval.score : null,
          repaired: Boolean(result.meta?.repairAttempted),
        });

        if (result.completionStatus !== 'complete') {
          recordIncompleteOutputSignal(operationalSignals, {
            agent: result.name,
            provider: getProviderName(result.agent),
            stage: `approval-${roundNumber}`,
            completionStatus: result.completionStatus,
            stopReason: result.meta?.stopReason || result.meta?.providerStopReason || '',
            outputPath,
          });
          incompleteApprovalResults.push(result);
          allAgreed = false;
          continue;
        }

        if (!result.approval.agreed) {
          allAgreed = false;
          const label = `${result.name}${result.role ? ` (${result.role})` : ''}`;
          revisionNotes.push(`- ${label}: ${result.approval.notes}`);
        }
      }

      agentsOutputs.push(...approvalOutputs);
      latestApprovalOutputs = approvalResults.map((result) => ({
        name: result.name,
        role: result.role,
        stage: result.stage,
        approval: result.approval,
      }));
      discussionSoFar = buildDiscussionLog(agentsOutputs);

      if (incompleteApprovalResults.length > 0) {
        const incResult = incompleteApprovalResults[0];
        const incReason = `${incResult.name} incomplete (${incResult.completionStatus})`;
        console.error(`\n⚠️ Approval round ${roundNumber}: ${incReason}`);

        if (process.stdin.isTTY && !NON_INTERACTIVE) {
          const readline = require('readline');
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise((resolve) => {
            rl.question(`   Retry approval round? [Y/n] `, resolve);
          });
          rl.close();
          const normalized = String(answer || 'y').trim().toLowerCase();
          if (normalized === 'n' || normalized === 'no') {
            checkpoint.updatePhase(PROJECT_LAYOUT, `approval-${roundNumber}`, {
              status: 'paused',
              pausedAt: new Date().toISOString(),
              pauseReason: incReason,
            });
            console.log(`\n💾 Run paused. Re-run with the same prompt to resume.`);
            return;
          }
          // User chose retry — restart this approval round
          console.log(`⏳ Retrying approval round ${roundNumber}...`);
          continue;
        } else {
          // Non-interactive: save checkpoint and stop gracefully
          checkpoint.updatePhase(PROJECT_LAYOUT, `approval-${roundNumber}`, {
            status: 'failed',
            failedAt: new Date().toISOString(),
            failReason: incReason,
          });
          console.log(`\n💾 Run paused (incomplete result). Re-run with the same prompt to resume.`);
          return;
        }
      }

      const roundMissingSeams = extractApprovalMissingSeams(latestApprovalOutputs, {
        ...(indexCfg.critiqueExpansionMaxRequests ? { maxItems: Number(indexCfg.critiqueExpansionMaxRequests) } : {}),
      });
      const roundTrust = assessFinalResultTrust(finalConsensusText, {
        allAgreed,
        codeIndex,
        observedFiles: getObservedEvidenceFiles(),
      });
      const roundTrustSnapshot = buildTrustGapSnapshot({
        ...roundTrust,
        allAgreed,
      });
      recordTrustDeltaPerRoundSignal(operationalSignals, {
        label: 'approval',
        roundNumber,
        contractGapCount: roundTrustSnapshot.contractGapCount,
        groundingGapCount: roundTrustSnapshot.groundingGapCount,
        contractGapDelta: previousRoundTrustSnapshot
          ? roundTrustSnapshot.contractGapCount - previousRoundTrustSnapshot.contractGapCount
          : null,
        groundingGapDelta: previousRoundTrustSnapshot
          ? roundTrustSnapshot.groundingGapCount - previousRoundTrustSnapshot.groundingGapCount
          : null,
      });
      previousRoundTrustSnapshot = roundTrustSnapshot;

      if (!critiqueSeamOverlapRecorded && roundNumber === 1) {
        const overlap = computeCritiqueSeamOverlap(critiqueTexts, roundMissingSeams);
        recordCritiqueSeamOverlapSignal(operationalSignals, overlap);
        critiqueSeamOverlapRecorded = true;
      }

      const newRoundSeamKeys = computeNewApprovalSeamKeys(roundMissingSeams, previousRoundSeamKeys);
      if (roundNumber > 1 && newRoundSeamKeys.length === 0) {
        recordApprovalZeroNewSeamsSignal(operationalSignals, {
          roundNumber,
          seamCount: roundMissingSeams.length,
        });
      }

      const seamExpansionDecision = shouldTriggerSeamExpansion({
        trust: roundTrust,
        approvalOutputs: latestApprovalOutputs,
        alreadyTriggered: seamExpansionRounds >= MAX_SEAM_EXPANSION_ROUNDS,
        ...(indexCfg.critiqueExpansionMaxRequests ? { maxItems: Number(indexCfg.critiqueExpansionMaxRequests) } : {}),
      });
      previousRoundSeamKeys = new Set(roundMissingSeams.map((request) => buildApprovalSeamKey(request)).filter(Boolean));

      if (allAgreed) {
        if (seamExpansionDecision.trigger) {
          console.log('✅ All agents agreed, but substantive assumptions remain with fetchable seams. Triggering seam expansion.');
          recordTokensBeforeFirstSeamFetchSignal(operationalSignals, {
            stage: `approval-${roundNumber}-agreed`,
            tokens: getCurrentTotalTrackedTokens(),
          });
          triggerSeamExpansion = true;
        } else {
          console.log('✅ All agents agreed!');
        }
        break;
      }

      if (roundNumber === 1 && seamExpansionDecision.trigger) {
        recordTokensBeforeFirstSeamFetchSignal(operationalSignals, {
          stage: 'approval-1',
          tokens: getCurrentTotalTrackedTokens(),
        });
        triggerSeamExpansion = true;
        break;
      }

      if (roundNumber === MAX_APPROVAL_ROUNDS) {
        if (seamExpansionDecision.trigger && newRoundSeamKeys.length > 0) {
          recordTokensBeforeFirstSeamFetchSignal(operationalSignals, {
            stage: `approval-${roundNumber}`,
            tokens: getCurrentTotalTrackedTokens(),
          });
          triggerSeamExpansion = true;
          break;
        }
        recordNoMaterialProgressStopSignal(operationalSignals, {
          roundNumber,
          reason: seamExpansionDecision.trigger ? 'no-new-seams-after-round-2' : 'round-limit-without-fetchable-seams',
        });
        break;
      }

      approvalRound += 1;
      lastDisagreements = revisionNotes;
      const revisionPrompt = buildConsensusRevisionContent(
        workingPrompt,
        discussionSoFar,
        finalConsensusText,
        revisionNotes.join('\n'),
      );
      await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'revision');
      const revisionResponse = await runLoggedAgentStep(consensusAgent, 'revision', () => callAgentWithValidation(
        consensusAgent,
        getAgentBundle(consensusAgent, 'revision', workingPrompt),
        revisionPrompt,
        'revision',
      ));
      const sanitizedRevision = sanitizeUserFacingFinalText(revisionResponse.text);
      if (sanitizedRevision.sanitized) {
        console.warn('⚠️ Sanitized internal log/meta chatter from revision output.');
      }
      finalConsensusText = sanitizedRevision.text;
      if (revisionResponse.completionStatus !== 'complete') {
        const revisionOutputPath = path.join(RUN_ARCHIVE_DIR, `${consensusAgent.name || 'consensus'}-revision-${roundNumber}.txt`);
        fs.writeFileSync(revisionOutputPath, finalConsensusText + '\n');
        validateEndMarker(finalConsensusText, revisionOutputPath);
        autoLogAgent(
          consensusAgent.name || 'consensus',
          'revision',
          revisionOutputPath,
          mapCompletionStatusToLogStatus(revisionResponse.completionStatus),
          finalConsensusText,
        );
        recordIncompleteOutputSignal(operationalSignals, {
          agent: consensusAgent.name || 'consensus',
          provider: getProviderName(consensusAgent),
          stage: 'revision',
          completionStatus: revisionResponse.completionStatus,
          stopReason: revisionResponse.meta?.stopReason || revisionResponse.meta?.providerStopReason || '',
          outputPath: revisionOutputPath,
        });
        throw createIncompleteTextOutputError({
          agent: consensusAgent,
          name: consensusAgent.name || 'consensus',
          completionStatus: revisionResponse.completionStatus,
          meta: revisionResponse.meta,
          outputPath: revisionOutputPath,
        }, 'revision');
      }
    }

    // Mark approval phase done in checkpoint
    checkpoint.updatePhase(PROJECT_LAYOUT, 'approval', {
      status: 'done',
      finishedAt: new Date().toISOString(),
      allAgreed,
      lastRound: lastRoundNumber,
    });

    approvalConsensusAllAgreed = allAgreed;
    let disagreementNotes = lastDisagreements.length
      ? lastDisagreements
      : ['- No additional details provided.'];
    let finalResultTrust = assessFinalResultTrust(finalConsensusText, {
      allAgreed,
      codeIndex,
      observedFiles: getObservedEvidenceFiles(),
    });
    while (triggerSeamExpansion && seamExpansionRounds < MAX_SEAM_EXPANSION_ROUNDS) {
      let expansionRoundResult;
      try {
        expansionRoundResult = await runSeamExpansionRound({
          trustSignal: finalResultTrust,
          approvalOutputs: latestApprovalOutputs,
          currentDiscussion: discussionSoFar,
        });
      } catch (seamExpansionError) {
        const msg = String(seamExpansionError?.message || '');
        const code = seamExpansionError?.code || '';
        const isRecoverable = seamExpansionError?.completionStatus === 'truncated'
          || msg.includes('finish_reason: length')
          || code === 'AI_INCOMPLETE_TEXT_OUTPUT'
          || seamExpansionError?.requestTimedOut === true
          || code === 'PROVIDER_REQUEST_TIMEOUT'
          || msg.includes('overloaded')
          || msg.includes('429')
          || msg.includes('rate_limit')
          || msg.includes('ECONNRESET')
          || msg.includes('fetch failed')
          || msg.includes('socket hang up');
        if (isRecoverable) {
          console.warn(`⚠️ Seam expansion failed (${code || msg.slice(0, 100)}). Continuing with pre-expansion result.`);
          break;
        }
        throw seamExpansionError;
      }
      if (!expansionRoundResult) break;

      workingPrompt = expansionRoundResult.expandedPrompt;
      finalConsensusText = expansionRoundResult.finalConsensusText;
      approvalConsensusAllAgreed = expansionRoundResult.approvalConsensusAllAgreed;
      latestApprovalOutputs = expansionRoundResult.latestApprovalOutputs;
      discussionSoFar = expansionRoundResult.discussionSoFar;
      allAgreed = expansionRoundResult.approvalConsensusAllAgreed;
      finalResultTrust = expansionRoundResult.resultTrust;
      disagreementNotes = [
        `- Seam expansion round ${seamExpansionRounds} revised the draft with additional fetched seams.`,
      ];
      triggerSeamExpansion = false;

      // Checkpoint post-expansion consensus so resume doesn't lose seam expansion work
      const postExpansionPath = path.join(RUN_ARCHIVE_DIR, `${consensusAgent.name || 'consensus'}-post-expansion-${seamExpansionRounds}.txt`);
      fs.writeFileSync(postExpansionPath, finalConsensusText + '\n');
      checkpoint.updatePhase(PROJECT_LAYOUT, 'consensus', {
        status: 'done',
        finishedAt: new Date().toISOString(),
        outputFile: postExpansionPath,
        outputFormat: 'text',
        agent: consensusAgent.name || 'consensus',
        seamExpansionRound: seamExpansionRounds,
      });
    }
    currentResultTrust = finalResultTrust;
    const finalResultMode = finalResultTrust.resultMode;
    recordFinalTrustSignal(operationalSignals, finalResultTrust, { allAgreed });
    if (finalResultTrust.warningRequired) {
      const warningBlock = buildResultWarningFileContent({
        resultMode: finalResultMode,
        disagreementNotes: !allAgreed ? disagreementNotes : [],
        contractWarnings: finalResultTrust.groundedAnalysis.contractWarnings,
        validationWarnings: finalResultTrust.groundingValidation.validationWarnings,
      });
      fs.writeFileSync(RESULT_WARNING_PATH, warningBlock);
      warningRelativePath = toRelativePath(RESULT_WARNING_PATH);
      if (!allAgreed) {
        console.warn(`⚠️ Consensus disputed: warning saved to ${RESULT_WARNING_PATH}.`);
      }
      if (finalResultTrust.groundedAnalysis.contractWarnings.length > 0) {
        console.warn(`⚠️ Patch-safe contract gaps detected: ${finalResultTrust.groundedAnalysis.contractWarnings.length}. See ${RESULT_WARNING_PATH}.`);
      }
      if (finalResultTrust.groundingValidation.validationWarnings.length > 0) {
        console.warn(`⚠️ Patch-safe grounding gaps detected: ${finalResultTrust.groundingValidation.validationWarnings.length}. See ${RESULT_WARNING_PATH}.`);
      }
    } else if (fs.existsSync(RESULT_WARNING_PATH)) {
      fs.unlinkSync(RESULT_WARNING_PATH);
      warningRelativePath = '';
    }
    logFinalTrustSignal(operationalSignals.finalTrust, { label: 'Consensus trust' });

    fs.writeFileSync(consensusOutputPath, finalConsensusText + '\n');
    fs.writeFileSync(
      RESULT_PATH,
      buildResultFileContent(finalConsensusText, {
        resultMode: finalResultMode,
        warningPath: warningRelativePath,
        promptScopeWarningPath: promptScopeWarningPath ? toRelativePath(promptScopeWarningPath) : '',
        discussionPath: toRelativePath(TASK_DISCUSSION_DIR),
      }),
    );
    if (finalResultMode === RESULT_MODE_PATCH_SAFE) {
      fs.writeFileSync(
        PATCH_SAFE_RESULT_PATH,
        buildPatchSafeResultContent(finalConsensusText, {
          sourceResultPath: toRelativePath(RESULT_PATH),
          discussionPath: toRelativePath(TASK_DISCUSSION_DIR),
        }),
      );
      console.log(`✅ Patch-safe result saved: ${PATCH_SAFE_RESULT_PATH}`);
    } else if (fs.existsSync(PATCH_SAFE_RESULT_PATH)) {
      fs.unlinkSync(PATCH_SAFE_RESULT_PATH);
    }
    console.log(`✅ Consensus result saved: ${RESULT_PATH}`);
    appendChangeLog({
      model: consensusAgent.name || 'consensus',
      phase: 'consensus-result',
      artifacts: [RESULT_PATH],
      status: allAgreed ? 'COMPLETED' : 'PARTIAL',
      summary: allAgreed
        ? summarizeText(finalConsensusText)
        : `Consensus disputed after round ${lastRoundNumber}. See ${toRelativePath(RESULT_WARNING_PATH)}.`,
    });

  }

  // ===== DEVIL'S ADVOCATE PHASE =====
  let devilsAdvocateResult = null;
  if (devilsAdvocateAgents.length > 0) {
    // Trivial tasks always skip DA
    const trivialDASkip = taskComplexity === 'trivial';

    const remainingFetchableSeams = trivialDASkip ? [] : filterPendingSeams(
      extractApprovalMissingSeams(latestApprovalOutputs, {
        ...(indexCfg.critiqueExpansionMaxRequests ? { maxItems: Number(indexCfg.critiqueExpansionMaxRequests) } : {}),
      }).filter((request) => hasStructuredFetchHint(request)),
    );
    const avgApprovalScore = computeAverageApprovalScore(latestApprovalOutputs);
    const devilsAdvocateGate = trivialDASkip
      ? { skip: true, reason: 'trivial-complexity' }
      : shouldSkipDevilsAdvocate({
        trust: currentResultTrust || {},
        remainingFetchableSeamCount: remainingFetchableSeams.length,
        allAgreed: approvalConsensusAllAgreed,
        avgApprovalScore,
      });

    if (devilsAdvocateGate.skip) {
      console.log('\n😈 ===== DEVIL\'S ADVOCATE PHASE (skipped) =====');
      console.log(`⏭️  Skipped by gate: ${devilsAdvocateGate.reason}`);
      recordCallGatingSignal(operationalSignals, {
        phase: 'devils-advocate',
        action: 'skipped',
        reason: devilsAdvocateGate.reason,
      });
      console.log('=====================================\n');
    } else if (resumeMode && checkpoint.isPhaseDone(PROJECT_LAYOUT, 'devils-advocate')) {
      console.log('\n😈 ===== DEVIL\'S ADVOCATE PHASE (cached) =====');
      const cached = checkpoint.getPhaseOutput(PROJECT_LAYOUT, 'devils-advocate');
      if (cached) {
        try {
          devilsAdvocateResult = JSON.parse(cached);
          console.log('✅ Devil\'s Advocate loaded from checkpoint.');
        } catch (error) {
          console.warn(`⚠️ Failed to parse cached devil's advocate result: ${error.message}`);
        }
      }
      console.log('=====================================\n');
    } else {
      console.log('\n😈 ===== DEVIL\'S ADVOCATE PHASE =====');
      await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'devil-advocate');
      logPhaseRiskForecast({
        phaseLabel: "Devil's Advocate",
        stage: 'devil-advocate',
        agents: devilsAdvocateAgents,
        buildContent: () => buildDevilsAdvocateContent(
          originalPrompt,
          workingPrompt,
          finalConsensusText,
          discussionSoFar,
        ),
      });
      for (const agent of devilsAdvocateAgents) {
        console.log(`🔥 ${agent.role || agent.name}: Challenging the solution...`);
        const daContent = buildDevilsAdvocateContent(
          originalPrompt,
          workingPrompt,
          finalConsensusText,
          discussionSoFar
        );
        const response = await runLoggedAgentStep(agent, 'devil-advocate', () => callAgentWithValidation(
          agent,
          getAgentBundle(agent, 'devil-advocate', workingPrompt),
          daContent,
          'devil-advocate',
          { responseFormat: 'json', enableRepair: false },
        ));
        const responseText = response.text;

        const outputPath = path.join(RUN_ARCHIVE_DIR, `${agent.name}-devils-advocate.json`);
        validateEndMarker(responseText, outputPath);
        autoLogAgent(agent.name, 'devil-advocate', outputPath, 'Completed', responseText);

        devilsAdvocateResult = parseDevilsAdvocateResponse(responseText);

        // Save devil's advocate output and raw provider response for forensics
        const rawOutputPath = writeJsonArtifactWithRaw(outputPath, devilsAdvocateResult, responseText);
        console.log(`✅ Devil's Advocate analysis saved: ${outputPath}`);
        console.log(`🧾 Raw Devil's Advocate output saved: ${rawOutputPath}`);
        checkpoint.updatePhase(PROJECT_LAYOUT, 'devils-advocate', {
          status: 'done',
          finishedAt: new Date().toISOString(),
          outputFile: outputPath,
          outputFormat: 'json',
          agent: agent.name,
        });

        // Print summary
        const verdictEmoji = devilsAdvocateResult.verdict === 'APPROVED' ? '✅' :
                            devilsAdvocateResult.verdict === 'CRITICAL_ISSUES' ? '🚨' : '⚠️';
        const riskEmoji = devilsAdvocateResult.overallRisk === 'CRITICAL' ? '🔴' :
                         devilsAdvocateResult.overallRisk === 'HIGH' ? '🟠' :
                         devilsAdvocateResult.overallRisk === 'MEDIUM' ? '🟡' : '🟢';

        console.log(`${verdictEmoji} Verdict: ${devilsAdvocateResult.verdict}`);
        console.log(`${riskEmoji} Risk Level: ${devilsAdvocateResult.overallRisk}`);

        if (devilsAdvocateResult.weaknesses.length > 0) {
          console.log(`⚠️  Weaknesses: ${devilsAdvocateResult.weaknesses.length} identified`);
          const critical = devilsAdvocateResult.weaknesses.filter(w => w.severity === 'CRITICAL' || w.severity === 'HIGH');
          if (critical.length > 0) {
            console.log(`🚨 Critical/High severity: ${critical.length}`);
          }
        }
        if (devilsAdvocateResult.securityConcerns.length > 0) {
          console.log(`🔒 Security concerns: ${devilsAdvocateResult.securityConcerns.length}`);
        }
        if (devilsAdvocateResult.challengedAssumptions.length > 0) {
          console.log(`❓ Challenged assumptions: ${devilsAdvocateResult.challengedAssumptions.length}`);
        }

        // Save DA report as markdown
        const daReportPath = PROJECT_LAYOUT.devilsAdvocateReportPath;
        const daReport = [
          '# Devil\'s Advocate Report',
          '',
          `**Verdict:** ${devilsAdvocateResult.verdict}`,
          `**Overall Risk:** ${devilsAdvocateResult.overallRisk}`,
          '',
          '## Summary',
          devilsAdvocateResult.summary || 'No summary provided.',
          '',
          '## Challenged Assumptions',
          ...(devilsAdvocateResult.challengedAssumptions.length > 0
            ? devilsAdvocateResult.challengedAssumptions.map(a => `- ${a}`)
            : ['None identified.']),
          '',
          '## Weaknesses',
          ...(devilsAdvocateResult.weaknesses.length > 0
            ? devilsAdvocateResult.weaknesses.map(w =>
                `### ${w.severity}: ${w.issue}\n**Suggestion:** ${w.suggestion || 'None provided'}`)
            : ['None identified.']),
          '',
          '## Edge Cases',
          ...(devilsAdvocateResult.edgeCases.length > 0
            ? devilsAdvocateResult.edgeCases.map(e => `- ${e}`)
            : ['None identified.']),
          '',
          '## Security Concerns',
          ...(devilsAdvocateResult.securityConcerns.length > 0
            ? devilsAdvocateResult.securityConcerns.map(s => `- ${s}`)
            : ['None identified.']),
          '',
          '## Missing Considerations',
          ...(devilsAdvocateResult.missingConsiderations.length > 0
            ? devilsAdvocateResult.missingConsiderations.map(m => `- ${m}`)
            : ['None identified.']),
          '',
        ].join('\n');
        fs.writeFileSync(daReportPath, daReport);
        console.log(`📄 Devil's Advocate report saved: ${daReportPath}`);
      }

      // Check if we need an additional revision based on confidence + devil's advocate
      const revisionCheck = shouldTriggerRevision(avgConfidence, devilsAdvocateResult);
      if (revisionCheck.trigger) {
        console.log(`\n🔄 Triggering additional revision: ${revisionCheck.reason}`);
        const preDAConsensusText = finalConsensusText;

        // Build revision prompt with devil's advocate feedback
        const daFeedback = [
          `## Devil's Advocate Findings (${devilsAdvocateResult.verdict})`,
          '',
          devilsAdvocateResult.summary,
          '',
          'Key issues to address:',
          ...devilsAdvocateResult.weaknesses
            .filter(w => w.severity === 'CRITICAL' || w.severity === 'HIGH')
            .map(w => `- [${w.severity}] ${w.issue}: ${w.suggestion || ''}`),
          ...devilsAdvocateResult.securityConcerns.map(s => `- [SECURITY] ${s}`),
        ].join('\n');

        const revisionPrompt = buildConsensusRevisionContent(
          workingPrompt,
          discussionSoFar,
          finalConsensusText,
          daFeedback
        );

        await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'da-revision');
        const daRevisionResponse = await runLoggedAgentStep(consensusAgent, 'da-revision', () => callAgentWithValidation(
          consensusAgent,
          getAgentBundle(consensusAgent, 'da-revision', workingPrompt),
          revisionPrompt,
          'da-revision',
        ));
        const sanitizedDaRevision = sanitizeUserFacingFinalText(daRevisionResponse.text);
        if (sanitizedDaRevision.sanitized) {
          console.warn('⚠️ Sanitized internal log/meta chatter from devil\'s advocate revision output.');
        }
        finalConsensusText = sanitizedDaRevision.text;
        if (daRevisionResponse.completionStatus !== 'complete') {
          const revisedOutputPath = path.join(RUN_ARCHIVE_DIR, `${consensusAgent.name || 'consensus'}-da-revision.txt`);
          fs.writeFileSync(revisedOutputPath, finalConsensusText + '\n');
          validateEndMarker(finalConsensusText, revisedOutputPath);
          autoLogAgent(
            consensusAgent.name || 'consensus',
            'da-revision',
            revisedOutputPath,
            mapCompletionStatusToLogStatus(daRevisionResponse.completionStatus),
            finalConsensusText,
          );
          recordIncompleteOutputSignal(operationalSignals, {
            agent: consensusAgent.name || 'consensus',
            provider: getProviderName(consensusAgent),
            stage: 'da-revision',
            completionStatus: daRevisionResponse.completionStatus,
            stopReason: daRevisionResponse.meta?.stopReason || daRevisionResponse.meta?.providerStopReason || '',
            outputPath: revisedOutputPath,
          });
          // DA-revision is non-critical: keep pre-DA result instead of crashing the pipeline.
          // The consensus result is already saved; DA feedback is logged in the report.
          console.warn(`⚠️ DA-revision failed (${daRevisionResponse.completionStatus}). Keeping pre-DA consensus result.`);
          finalConsensusText = preDAConsensusText;
        }

        const revisedResultTrust = assessFinalResultTrust(finalConsensusText, {
          allAgreed: approvalConsensusAllAgreed,
          codeIndex,
          observedFiles: getObservedEvidenceFiles(),
        });
        currentResultTrust = revisedResultTrust;
        recordFinalTrustSignal(operationalSignals, revisedResultTrust, {
          allAgreed: approvalConsensusAllAgreed,
        });
        const revisedWarningPath = revisedResultTrust.warningRequired ? toRelativePath(RESULT_WARNING_PATH) : '';
        if (revisedResultTrust.warningRequired) {
          const warningBlock = buildResultWarningFileContent({
            resultMode: revisedResultTrust.resultMode,
            disagreementNotes: [],
            contractWarnings: revisedResultTrust.groundedAnalysis.contractWarnings,
            validationWarnings: revisedResultTrust.groundingValidation.validationWarnings,
          });
          fs.writeFileSync(RESULT_WARNING_PATH, warningBlock);
          if (revisedResultTrust.groundedAnalysis.contractWarnings.length > 0) {
            console.warn(`⚠️ Patch-safe contract gaps detected after Devil's Advocate revision: ${revisedResultTrust.groundedAnalysis.contractWarnings.length}. See ${RESULT_WARNING_PATH}.`);
          }
          if (revisedResultTrust.groundingValidation.validationWarnings.length > 0) {
            console.warn(`⚠️ Patch-safe grounding gaps detected after Devil's Advocate revision: ${revisedResultTrust.groundingValidation.validationWarnings.length}. See ${RESULT_WARNING_PATH}.`);
          }
        } else if (fs.existsSync(RESULT_WARNING_PATH)) {
          fs.unlinkSync(RESULT_WARNING_PATH);
        }
        logFinalTrustSignal(operationalSignals.finalTrust, { label: 'Revised trust' });

        // Save revised consensus
        fs.writeFileSync(
          RESULT_PATH,
          buildResultFileContent(finalConsensusText, {
            extraNote: `Revised after Devil's Advocate review (${revisionCheck.reason})`,
            resultMode: revisedResultTrust.resultMode,
            warningPath: revisedWarningPath,
            promptScopeWarningPath: promptScopeWarningPath ? toRelativePath(promptScopeWarningPath) : '',
            discussionPath: toRelativePath(TASK_DISCUSSION_DIR),
          }),
        );
        if (revisedResultTrust.resultMode === RESULT_MODE_PATCH_SAFE) {
          fs.writeFileSync(
            PATCH_SAFE_RESULT_PATH,
            buildPatchSafeResultContent(finalConsensusText, {
              sourceResultPath: toRelativePath(RESULT_PATH),
              discussionPath: toRelativePath(TASK_DISCUSSION_DIR),
            }),
          );
          console.log(`✅ Patch-safe result saved: ${PATCH_SAFE_RESULT_PATH}`);
        } else if (fs.existsSync(PATCH_SAFE_RESULT_PATH)) {
          fs.unlinkSync(PATCH_SAFE_RESULT_PATH);
        }
        console.log(`✅ Revised consensus saved: ${RESULT_PATH}`);

        const revisedOutputPath = path.join(RUN_ARCHIVE_DIR, `${consensusAgent.name || 'consensus'}-revised.txt`);
        fs.writeFileSync(revisedOutputPath, finalConsensusText + '\n');
        console.log(`✅ Revised consensus archived: ${revisedOutputPath}`);
        appendChangeLog({
          model: consensusAgent.name || 'consensus',
          phase: 'da-revision',
          artifacts: [RESULT_PATH, revisedOutputPath],
          status: 'COMPLETED',
          summary: `Revised after Devil's Advocate: ${revisionCheck.reason}`,
        });
        checkpoint.updatePhase(PROJECT_LAYOUT, 'consensus', {
          status: 'done',
          finishedAt: new Date().toISOString(),
          outputFile: revisedOutputPath,
          outputFormat: 'text',
          agent: consensusAgent.name || 'consensus',
        });
      }

      console.log('=====================================\n');
    }
  }

  // ===== POST-PROCESS PHASE (Tester) =====
  let testerResult = null;
  if (ENABLE_TEST && postProcessAgents.length > 0 && taskComplexity !== 'trivial') {
    const testerGate = resolveTesterGate(currentResultTrust || {});
    const testerMode = testerGate.mode;
    recordCallGatingSignal(operationalSignals, {
      phase: 'tester',
      action: testerGate.action,
      reason: testerGate.reason,
    });
    if (testerGate.skip) {
      console.log('\n🧪 ===== POST-PROCESS PHASE (skipped) =====');
      console.log(`⏭️  Skipped by gate: ${testerGate.reason}`);
      console.log('=================================\n');
    } else if (resumeMode && checkpoint.isPhaseDone(PROJECT_LAYOUT, 'postprocess')) {
      console.log('\n🧪 ===== POST-PROCESS PHASE (cached) =====');
      console.log('✅ Post-process result loaded from checkpoint.');
      console.log('=================================\n');
    } else {
      console.log('\n🧪 ===== POST-PROCESS PHASE =====');
      await applyRuntimeOverridesForPhase(PROJECT_LAYOUT, 'post-process');
      logPhaseRiskForecast({
        phaseLabel: 'Post-process',
        stage: 'post-process',
        agents: postProcessAgents,
        buildContent: () => buildTesterContent(originalPrompt, workingPrompt, finalConsensusText, testerMode),
      });
      for (const agent of postProcessAgents) {
        console.log(`🔬 ${agent.role || agent.name}: Validating solution...`);
        const testerContent = buildTesterContent(originalPrompt, workingPrompt, finalConsensusText, testerMode);
        const response = await runLoggedAgentStep(agent, 'post-process', () => callAgentWithValidation(
          agent,
          getAgentBundle(agent, 'post-process', workingPrompt),
          testerContent,
          'post-process',
          { responseFormat: 'json', enableRepair: false },
        ));
        const responseText = response.text;

        const outputPath = path.join(RUN_ARCHIVE_DIR, `${agent.name}-validation.json`);
        validateEndMarker(responseText, outputPath);
        autoLogAgent(agent.name, 'tester', outputPath, 'Completed', responseText);

        testerResult = parseTesterResponse(responseText);

        // Save tester output and raw provider response for forensics
        const rawOutputPath = writeJsonArtifactWithRaw(outputPath, testerResult, responseText);
        console.log(`✅ Test validation saved: ${outputPath}`);
        console.log(`🧾 Raw test validation saved: ${rawOutputPath}`);
        checkpoint.updatePhase(PROJECT_LAYOUT, 'postprocess', {
          status: 'done',
          finishedAt: new Date().toISOString(),
          outputFile: outputPath,
          outputFormat: 'json',
          agent: agent.name,
        });

        // Print summary
        const verdictEmoji = testerResult.verdict === 'PASS' ? '✅' : testerResult.verdict === 'NEEDS_REVISION' ? '❌' : '⚠️';
        console.log(`${verdictEmoji} Verdict: ${testerResult.verdict} (Score: ${testerResult.score}/10)`);

        if (testerResult.summary) {
          console.log(`📋 Summary: ${testerResult.summary.substring(0, 150)}...`);
        }

        // Log important findings
        if (testerResult.potentialBugs.length > 0) {
          console.log(`🐛 Potential bugs: ${testerResult.potentialBugs.length} found`);
        }
        if (testerResult.securityConcerns.length > 0) {
          console.log(`🔒 Security concerns: ${testerResult.securityConcerns.length} identified`);
        }
        if (testerResult.testCases.length > 0) {
          console.log(`📝 Test cases: ${testerResult.testCases.length} suggested`);
        }

        // Save test report as markdown
        const testReportPath = PROJECT_LAYOUT.testReportPath;
        const testReport = [
          '# Test Validation Report',
          '',
          `**Mode:** ${testerMode}`,
          `**Verdict:** ${testerResult.verdict}`,
          `**Score:** ${testerResult.score}/10`,
          '',
          '## Summary',
          testerResult.summary || 'No summary provided.',
          '',
          '## Test Cases',
          ...(testerResult.testCases.length > 0
            ? testerResult.testCases.map((tc, i) => `### ${i + 1}. ${tc.name}\n- **Steps:** ${tc.steps}\n- **Expected:** ${tc.expected}`)
            : ['No test cases provided.']),
          '',
          '## Edge Cases',
          ...(testerResult.edgeCases.length > 0 ? testerResult.edgeCases.map(e => `- ${e}`) : ['None identified.']),
          '',
          '## Potential Bugs',
          ...(testerResult.potentialBugs.length > 0 ? testerResult.potentialBugs.map(b => `- ${b}`) : ['None identified.']),
          '',
          '## Security Concerns',
          ...(testerResult.securityConcerns.length > 0 ? testerResult.securityConcerns.map(s => `- ${s}`) : ['None identified.']),
          '',
          '## Performance Notes',
          ...(testerResult.performanceNotes.length > 0 ? testerResult.performanceNotes.map(p => `- ${p}`) : ['None identified.']),
          '',
          '## Missing Requirements',
          ...(testerResult.missingRequirements.length > 0 ? testerResult.missingRequirements.map(m => `- ${m}`) : ['None identified.']),
          '',
          '## Suggested Improvements',
          ...(testerResult.suggestedImprovements.length > 0 ? testerResult.suggestedImprovements.map(i => `- ${i}`) : ['None.']),
          '',
        ].join('\n');
        fs.writeFileSync(testReportPath, testReport);
        console.log(`📄 Test report saved: ${testReportPath}`);
      }
      console.log('=================================\n');
    }
  }
  if (ENABLE_TEST && postProcessAgents.length > 0 && taskComplexity === 'trivial') {
    console.log('\n🧪 ===== POST-PROCESS PHASE (skipped: trivial complexity) =====');
    recordCallGatingSignal(operationalSignals, {
      phase: 'tester',
      action: 'skipped',
      reason: 'trivial-complexity',
    });
    console.log('=================================\n');
  }

  // ===== QUALITY FEEDBACK =====
  if (process.stdin.isTTY && !NON_INTERACTIVE) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question('\n📝 Rate result quality [1-5, Enter to skip]: ', resolve);
    });
    rl.close();

    const rating = Number.parseInt(String(answer || '').trim(), 10);
    if (rating >= 1 && rating <= 5) {
      const qualityPath = PROJECT_LAYOUT.qualityPath;
      let history = [];
      try {
        if (fs.existsSync(qualityPath)) {
          history = JSON.parse(fs.readFileSync(qualityPath, 'utf8'));
        }
      } catch {
        history = [];
      }

      history.push({
        timestamp: new Date().toISOString(),
        rating,
        promptPreview: String(promptText || '').slice(0, 100),
        agents: resolvedAgents.map((a) => a.name),
        agreementScore: typeof agreementScore === 'number' ? agreementScore : null,
      });
      if (history.length > 100) history = history.slice(-100);

      fs.mkdirSync(path.dirname(qualityPath), { recursive: true });
      fs.writeFileSync(qualityPath, JSON.stringify(history, null, 2));
      console.log(`   ✅ Rating saved (${rating}/5)`);
    }
  }

  const archivedPrompt = path.join(RUN_ARCHIVE_DIR, 'prompt.txt');
  fs.renameSync(PROMPT_PATH, archivedPrompt);
  fs.writeFileSync(PROMPT_PATH, '');
  console.log(`📦 Prompt archived: ${archivedPrompt}`);

  const discussionPromptPath = path.join(TASK_DISCUSSION_DIR, 'prompt.txt');
  const discussionResultPath = path.join(TASK_DISCUSSION_DIR, 'result.txt');
  const discussionPatchSafeResultPath = path.join(TASK_DISCUSSION_DIR, 'patch-safe-result.md');
  const discussionDaReportPath = path.join(TASK_DISCUSSION_DIR, 'devils-advocate-report.md');
  const discussionTestReportPath = path.join(TASK_DISCUSSION_DIR, 'test-report.md');
  const discussionWarningPath = path.join(TASK_DISCUSSION_DIR, 'result-warning.txt');
  const discussionPromptScopeWarningPath = path.join(TASK_DISCUSSION_DIR, 'prompt-scope-warning.txt');
  const discussionSuggestedPromptPath = path.join(TASK_DISCUSSION_DIR, 'suggested-broadened-prompt.txt');

  copyIfExists(archivedPrompt, discussionPromptPath);
  copyIfExists(RESULT_PATH, discussionResultPath);
  copyIfExists(PATCH_SAFE_RESULT_PATH, discussionPatchSafeResultPath);
  copyIfExists(PROJECT_LAYOUT.devilsAdvocateReportPath, discussionDaReportPath);
  copyIfExists(PROJECT_LAYOUT.testReportPath, discussionTestReportPath);
  copyIfExists(RESULT_WARNING_PATH, discussionWarningPath);
  copyIfExists(promptScopeWarningPath, discussionPromptScopeWarningPath);
  copyIfExists(promptScopeSuggestedPromptPath, discussionSuggestedPromptPath);
  writeTaskDiscussionIndex({
    discussionDir: TASK_DISCUSSION_DIR,
    taskId: effectiveTaskId,
    runId: runFlow.runId,
    runArchiveDir: RUN_ARCHIVE_DIR,
    promptPath: discussionPromptPath,
    resultPath: discussionResultPath,
    patchSafeResultPath: fs.existsSync(discussionPatchSafeResultPath) ? discussionPatchSafeResultPath : '',
    devilsAdvocateReportPath: fs.existsSync(discussionDaReportPath) ? discussionDaReportPath : '',
    testReportPath: fs.existsSync(discussionTestReportPath) ? discussionTestReportPath : '',
    warningPath: fs.existsSync(discussionWarningPath) ? discussionWarningPath : '',
    promptScopeWarningPath: fs.existsSync(discussionPromptScopeWarningPath) ? discussionPromptScopeWarningPath : '',
    suggestedPromptPath: fs.existsSync(discussionSuggestedPromptPath) ? discussionSuggestedPromptPath : '',
  });
  console.log(`🧾 Discussion package saved: ${toRelativePath(TASK_DISCUSSION_DIR)}`);

  try {
    const savedMemoryEntries = saveAutoMemoryEntries(PROJECT_LAYOUT, {
      promptText,
      resultText: finalConsensusText,
      runId: runFlow.runId,
      taskId: effectiveTaskId,
      sourceRef: toRelativePath(TASK_DISCUSSION_DIR),
      createdAt: new Date().toISOString(),
    });
    if (savedMemoryEntries.length > 0) {
      console.log(`🧠 Local memory updated: ${savedMemoryEntries.length} entries saved`);
    }
  } catch (memoryError) {
    console.warn(`⚠️ Failed to update local memory: ${memoryError.message}`);
  }



  // Auto-log the session
  appendToGlobalLog(promptText);
  appendPlanLog({
    model: 'AI Panel (Automated)',
    runId: timestamp,
    request: promptText,
    status: 'DONE',
    notes: `Completed. Final artifact: ${toRelativePath(RESULT_PATH)}`,
  });

  // Print and save metrics
  operationalSignals.status = 'completed';
  operationalSignals.endedAt = new Date().toISOString();
  persistOperationalSignals(PROJECT_LAYOUT, { status: 'completed', endedAt: operationalSignals.endedAt });
  printMetrics(promptText);
  if (fs.existsSync(RESULT_PATH)) {
    saveResultCache(resultCachePath, currentResultHash, RESULT_PATH);
  }

  if (PROJECT_LAYOUT.runtimeOverridesPath && fs.existsSync(PROJECT_LAYOUT.runtimeOverridesPath)) {
    fs.unlinkSync(PROJECT_LAYOUT.runtimeOverridesPath);
    console.log(`🧹 Runtime overrides cleared: ${toRelativePath(PROJECT_LAYOUT.runtimeOverridesPath)}`);
  }

  // --- Checkpoint: archive completed run ---
  checkpoint.archiveRun(PROJECT_LAYOUT);
  console.log(`✅ Run ${runFlow.runId} completed and archived.`);
}

function validateEnvironment() {
  console.log('🔍 Validating environment...');
  const criticalFiles = [CONTEXT_CONFIG_PATH, AGENTS_CONFIG_PATH];
  let hasCriticalError = false;

  // Check critical configs
  criticalFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      console.error(`❌ CRITICAL: Missing configuration file: ${file}`);
      hasCriticalError = true;
    }
  });

  if (hasCriticalError) {
    console.error('🔥 Environment validation failed. Please fix missing files.');
    process.exit(1);
  }

  // Check context files
  const missingFiles = [];
  FULL_FILES.forEach(file => {
    if (!resolveReadablePath(file, { allowHubFallback: true })) {
      missingFiles.push(file);
    }
  });

  const warningState = buildMissingContextWarningState({
    missingFiles,
    projectPath: process.cwd(),
  });
  for (const line of warningState.lines) {
    if (warningState.level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

async function main() {
  ensureUnifiedLogs();
  validateEnvironment();
  const promptText = readPrompt(PROMPT_PATH);
  let treeTruncated = false;
  let treeLimit = 0;
  let totalTreeFiles = 0;

  // Refinement mode: reuse existing context bundle, skip index build and context rebuild
  if (REFINE_MODE) {
    const bundlePath = PROJECT_LAYOUT.bundlePath;
    const existingBundle = fs.existsSync(bundlePath) ? fs.readFileSync(bundlePath, 'utf8') : '';
    await runAgents(existingBundle, promptText, null, {
      contextPackActive: hasContextPackSection(existingBundle),
      treeTruncated: false,
      treeLimit: 0,
      totalFiles: 0,
      packedTreeLimit: PACKED_TREE_LIMIT,
    });
    return;
  }

  let codeIndex = null;
  if (indexCfg.enabled) {
    const prevIndex = loadCodeIndex(INDEX_PATH);
    const indexFiles = listIndexableFiles(TREE_CMD, MAX_FILES * 5);

    codeIndex = buildCodeIndex({
      rootDir: process.cwd(),
      files: indexFiles,
      previousIndex: prevIndex,
      maxFileSize: LIMITS.maxFileSize,
      mode: effectiveIndexMode,
      ignorePatterns: indexCfg.ignorePatterns,
    });

    saveCodeIndex(INDEX_PATH, codeIndex);
    console.log(`🧭 Code index saved: ${INDEX_PATH} (mode: ${effectiveIndexMode}, symbols: ${codeIndex.symbols.length}, edges: ${codeIndex.edges.length})`);
  }

  if (INDEX_ONLY) {
    console.log('✅ Index-only mode complete.');
    return;
  }

  // Check for incremental cache
  let dirSnapshot = '';
  if (!IS_LIGHT_MODE) {
    dirSnapshot = runGitLsFiles() || runTreeCommand(TREE_CMD) || walkProjectFiles(MAX_FILES * 5).join('\n');
  }

  const indexMtime = fs.existsSync(INDEX_PATH) ? fs.statSync(INDEX_PATH).mtimeMs : 'no-index';
  const memoryDigest = `${computeMemoryLogsDigest()}|${computeMemoryStoreDigest(PROJECT_LAYOUT)}`;
  const currentHash = computeFilesHash(
    FILES_TO_INCLUDE,
    `${dirSnapshot}|${indexMtime}|${IS_LIGHT_MODE}|${NO_TREE}|${promptText || ''}|${memoryDigest}|${effectiveIndexMode}`,
  );
  const cache = loadContextCache();
  const useCache = cache && cache.hash === currentHash && !args.includes('--no-cache');

  if (useCache) {
    console.log('📦 Using cached context bundle (files unchanged)');
    const outputPath = PROJECT_LAYOUT.bundlePath;
    fs.writeFileSync(outputPath, cache.bundle);
    console.log(`✅ Context bundle restored from cache: ${outputPath}`);
    console.log(`🔐 Secret redaction: ${REDACT_SECRETS ? 'on' : 'off'}`);
    console.log(`💡 Mode: ${IS_LIGHT_MODE ? 'LIGHT (Cheap & Fast)' : 'FULL (Architectural)'}`);
    await runAgents(cache.bundle, promptText, codeIndex, {
      contextPackActive: hasContextPackSection(cache.bundle),
      treeTruncated: false,
      treeLimit: 0,
      totalFiles: 0,
      packedTreeLimit: PACKED_TREE_LIMIT,
    });
    return;
  }

  // Generate fresh context bundle
  const output = [];

  // 1. Insert CRITICAL INSTRUCTIONS (system prompt)
  const projectSystemPromptPath = `${AI_SOURCE_DIR_NAME}/SYSTEM_PROMPT.md`;
  const hubSystemPromptPath = path.join(__dirname, '..', 'SYSTEM_PROMPT.md');
  if (fs.existsSync(path.join(PROJECT_ROOT, projectSystemPromptPath))) {
    output.push(readFile(projectSystemPromptPath));
    output.push('\n');
  } else if (fs.existsSync(hubSystemPromptPath)) {
    output.push(redactSecrets(fs.readFileSync(hubSystemPromptPath, 'utf8')));
    output.push('\n');
  }

  // Dynamic header based on project name from package.json
  output.push(getContextHeader(process.cwd()));
  output.push('----------------------------------------\n');

  const memorySection = buildProjectMemorySection(promptText);
  if (memorySection) {
    output.push(memorySection);
    output.push('\n');
  }

  let usedContextPack = false;
  let structuralSearchDiagnostics = null;
  if (indexCfg.enabled && promptText) {
    const pack = buildContextPack({
      rootDir: process.cwd(),
      promptText,
      index: codeIndex,
      cfg: indexCfg,
      redactSecrets,
    });
    structuralSearchDiagnostics = pack.structuralSearch || null;
    if (structuralSearchDiagnostics?.backendUsed) {
      const fallbackLabel = structuralSearchDiagnostics.fallback ? ' (fallback)' : '';
      console.log(
        `🔎 Structural search: requested=${structuralSearchDiagnostics.backendRequested}, `
        + `used=${structuralSearchDiagnostics.backendUsed}${fallbackLabel}, `
        + `symbols=${structuralSearchDiagnostics.symbolCount}`
      );
    }

    if (pack.used) {
      output.push(pack.markdown);
      output.push('\n');
      usedContextPack = true;
      console.log(`🎯 Context Pack used (selected: ${pack.selectedCount})`);
    } else {
      console.log(`ℹ️ Context Pack not used: ${pack.reason}`);
    }
  }

  if (CONTEXT_PACK_ONLY) {
    const bundleContent = output.join('\n');
    const outputPath = PROJECT_LAYOUT.bundlePath;
    fs.writeFileSync(outputPath, bundleContent);
    console.log(`✅ Context pack-only generated: ${outputPath}`);
    return;
  }

  // Fallback to the legacy mode when no context pack was built
  if (!usedContextPack && indexCfg.fallbackToFullContext) {
    let totalBytes = Buffer.byteLength(output.join('\n'), 'utf8');

    FILES_TO_INCLUDE.forEach((file) => {
      let content = '';
      if (file === `${AI_DIR_NAME}/logs/AI_LOG.md` && contextConfig.logWindow?.enabled) {
        content = readAiLogWindow(
          file,
          Number(contextConfig.logWindow.maxEntries || 10),
          Number(contextConfig.logWindow.maxBytes || 15000),
        );
      } else {
        content = readFile(file, { maxBytes: LIMITS.maxFileSize });
      }

      const block = [
        `## FILE: ${file}`,
        '```' + detectLanguage(file),
        content,
        '```\n',
      ].join('\n');

      const nextBytes = totalBytes + Buffer.byteLength(block, 'utf8');
      if (nextBytes > LIMITS.maxTotalSize) {
        output.push(`## SKIPPED: ${file} (maxTotalSize exceeded)`);
        return;
      }

      output.push(block);
      totalBytes = nextBytes;
    });
  }

  // Add the directory tree while ignoring node_modules and .git
  if (!IS_LIGHT_MODE && !NO_TREE) {
    treeLimit = usedContextPack ? Math.min(MAX_FILES, PACKED_TREE_LIMIT) : MAX_FILES;
    output.push('## DIRECTORY STRUCTURE\n```\n');
    try {
      const structureText = runGitLsFiles() || runTreeCommand(TREE_CMD) || walkProjectFiles(MAX_FILES * 5).join('\n');
      const allLines = splitLines(structureText);
      totalTreeFiles = allLines.length;
      const isTruncated = totalTreeFiles > treeLimit;
      treeTruncated = isTruncated;
      const includedLines = allLines.slice(0, treeLimit);
      const excludedLines = allLines.slice(treeLimit);

      output.push(includedLines.join('\n'));

      if (isTruncated) {
        const excludedDirs = [...new Set(excludedLines.map(f => {
          const dir = path.dirname(f);
          return dir === '.' ? '(root)' : dir;
        }))].slice(0, 10);

        output.push(`\n... (truncated, showing ${treeLimit} of ${totalTreeFiles} files)`);
        output.push(`Excluded directories: ${excludedDirs.join(', ')}${excludedDirs.length >= 10 ? '...' : ''}`);

        const warningLines = buildTreeTruncationWarningLines({
          totalFiles: totalTreeFiles,
          treeLimit,
          excludedDirs,
          maxFiles: MAX_FILES,
          packedTreeLimit: PACKED_TREE_LIMIT,
          contextPackActive: usedContextPack,
          isFullMode: IS_FULL_MODE,
        });
        for (const line of warningLines) {
          console.warn(line);
        }
      }
    } catch (findError) {
      output.push('Error generating tree');
    }
    output.push('```\n');
  }

  const bundleContent = output.join('\n');

  // Write the final bundle to disk
  const outputPath = PROJECT_LAYOUT.bundlePath;
  fs.writeFileSync(outputPath, bundleContent);

  // Save to cache
  saveContextCache(currentHash, bundleContent);

  console.log(`✅ Context bundle generated at: ${outputPath}`);
  console.log(`📋 Copy content of this file to ChatGPT, Claude, or Gemini.`);
  console.log(`🔐 Secret redaction: ${REDACT_SECRETS ? 'on' : 'off'}`);
  console.log(`💡 Mode: ${IS_LIGHT_MODE ? 'LIGHT (Cheap & Fast)' : 'FULL (Architectural)'}`);

  await runAgents(bundleContent, promptText, codeIndex, {
    contextPackActive: usedContextPack,
    structuralSearch: structuralSearchDiagnostics,
    treeTruncated,
    treeLimit,
    totalFiles: totalTreeFiles,
    packedTreeLimit: PACKED_TREE_LIMIT,
  });
}

if (require.main === module) {
  main().catch((error) => {
    try {
      if (operationalSignals.runId) {
        operationalSignals.status = 'failed';
        operationalSignals.endedAt = new Date().toISOString();
        persistOperationalSignals(PROJECT_LAYOUT, {
          status: 'failed',
          endedAt: operationalSignals.endedAt,
        });
      }
    } catch (persistError) {
      console.warn('⚠️ Failed to persist operational signals:', persistError.message);
    }
    try {
      appendPlanLog({
        model: 'AI Panel (Automated)',
        runId: 'FAILED-RUN',
        request: readPrompt(PROMPT_PATH),
        status: 'FAILED',
        notes: summarizeText(error.message || String(error), 500),
      });
      appendChangeLog({
        model: 'AI Panel (Automated)',
        phase: 'run-failure',
        artifacts: [],
        status: 'FAILED',
        summary: summarizeText(error.message || String(error), 500),
      });
    } catch (logError) {
      console.warn('⚠️ Failed to write failure logs:', logError.message);
    }
    try {
      appendErrorLog({
        model: 'AI Panel (Automated)',
        phase: 'run-failure',
        status: 'FAILED',
        summary: summarizeText(error.message || String(error), 500),
        error,
        details: {
          stage: 'run-failure',
        },
      });
    } catch (logError) {
      console.warn('⚠️ Failed to write error log:', logError.message);
    }
    console.error('❌ Failed to generate context bundle or run agents.');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  main,
  callAgentRaw,
  callAgent,
  callAgentWithValidation,
  normalizeApprovalReview,
  parseRetryAfterMs,
  parseRateLimitResetAt,
  resolveRetryDelayMs,
  isQuotaExhaustedError,
  estimateInputTokens,
  getRecommendedOutputTokensForStage,
  computeAgentPhaseRiskForecast,
  buildForecastCalibration,
  loadRecentOperationalSignalRuns,
  extractRateLimitSnapshotFromHeaders,
  computePreflightRateLimitDelayMs,
  sanitizeForcedFinalAnswer,
  buildAgentCallResult,
  parseRuntimeOverridesDocument,
  getRuntimeOverrideMaxOutputTokens,
  getMaxOutputTokens,
  getConfiguredMaxOutputTokens,
  getAutoMaxOutputTokensSettings,
  resolveEffectiveMaxOutputTokens,
  getRepairMaxOutputTokens,
  sanitizeTaskId,
  resolveTaskId,
  buildTaskDiscussionDir,
  sanitizeUserFacingFinalText,
  normalizeResultMode,
  analyzeEvidenceGroundedResultStructure,
  extractEvidenceAnchors,
  buildEvidenceGroundingValidation,
  assessFinalResultTrust,
  buildFinalTrustSignal,
  buildResultWarningFileContent,
  buildPromptScopeWarningFileContent,
  buildResultFileContent,
  buildPatchSafeResultContent,
  createOperationalSignalsState,
  loadReusablePreprocessResult,
  hasStructuredFetchHint,
  deriveApprovalOutcomeType,
  computeCritiqueSeamOverlap,
  shouldTriggerSeamExpansion,
  computeAverageApprovalScore,
  shouldSkipDevilsAdvocate,
  resolveTesterMode,
  resolveTesterGate,
  recordPreflightWaitSignal,
  recordOutputTokenAdjustmentSignal,
  recordRetrySignal,
  recordRepairSignal,
  recordToolLoopSignal,
  recordIncompleteOutputSignal,
  recordPromptScopeSignal,
  recordCallGatingSignal,
  buildOperationalSignalsSnapshot,
  getJsonRawSidecarPath,
  writeJsonArtifactWithRaw,
  hasContextPackSection,
  detectProjectControlSurface,
  buildMissingContextWarningState,
  buildEffectiveRuntimeSummaryLines,
  buildTreeTruncationWarningLines,
  buildPhaseRiskForecastLines,
};
