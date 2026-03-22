const fs = require('fs');
const path = require('path');

function readTextIfExists(filePath = '') {
  const resolved = String(filePath || '').trim();
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return '';
  return fs.readFileSync(resolved, 'utf8');
}

function readJsonIfExists(filePath = '') {
  const resolved = String(filePath || '').trim();
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    return null;
  }
}

function safeReadDir(dirPath = '') {
  const resolved = String(dirPath || '').trim();
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return [];
  try {
    return fs.readdirSync(resolved);
  } catch {
    return [];
  }
}

function parseBooleanFlag(value = '') {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'YES') return true;
  if (normalized === 'NO') return false;
  return null;
}

function parseCsvList(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.toLowerCase() === 'none') return [];
  return normalized.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseKeyValueLines(text = '') {
  const out = {};
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([A-Z0-9_]+):\s*(.+)$/);
    if (!match) continue;
    out[match[1]] = match[2].trim();
  }
  return out;
}

function parsePromptScopeWarningContent(text = '') {
  const source = String(text || '');
  const lines = source.split('\n');
  const values = parseKeyValueLines(source);
  const details = [];
  let inDetails = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inDetails) inDetails = false;
      continue;
    }
    if (line === 'Details:') {
      inDetails = true;
      continue;
    }
    if (inDetails && line.startsWith('- ')) {
      details.push(line.slice(2).trim());
      continue;
    }
  }

  return {
    scopeRisk: String(values.SCOPE_RISK || '').trim() || 'unknown',
    manualReviewRecommended: parseBooleanFlag(values.MANUAL_REVIEW_RECOMMENDED),
    suggestedPromptPath: String((source.match(/^Suggested broadened prompt:\s*(.+)$/m) || [])[1] || '').trim(),
    details,
  };
}

function parseResultWarningContent(text = '') {
  const values = parseKeyValueLines(text);
  return {
    resultMode: String(values.RESULT_MODE || '').trim() || 'unknown',
    manualReviewRequired: parseBooleanFlag(values.MANUAL_REVIEW_REQUIRED),
    primaryFailureClass: String(values.PRIMARY_FAILURE_CLASS || '').trim() || 'none',
    failureClasses: parseCsvList(values.FAILURE_CLASSES || ''),
    contractGapCount: Number.parseInt(values.PATCH_SAFE_CONTRACT_GAP_COUNT || '0', 10) || 0,
    groundingGapCount: Number.parseInt(values.PATCH_SAFE_GROUNDING_GAP_COUNT || '0', 10) || 0,
    contractGapCategories: parseCsvList(values.PATCH_SAFE_CONTRACT_GAP_CATEGORIES || ''),
    groundingGapCategories: parseCsvList(values.PATCH_SAFE_GROUNDING_GAP_CATEGORIES || ''),
  };
}

function parseTesterValidationContent(text = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return {
      success: false,
      verdict: '',
      score: 0,
      summary: '',
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return {
      success: Boolean(parsed.success),
      verdict: String(parsed.verdict || '').trim(),
      score: Number(parsed.score) || 0,
      summary: String(parsed.summary || '').trim(),
    };
  } catch {
    return {
      success: false,
      verdict: '',
      score: 0,
      summary: '',
    };
  }
}

function classifyRunFailureReason(runFlow = {}) {
  const operationalSignals = runFlow?.operationalSignals || {};
  const retryEvents = Array.isArray(operationalSignals?.retries?.events)
    ? operationalSignals.retries.events
    : [];
  const incompleteEvents = Array.isArray(operationalSignals?.incompleteOutputs?.events)
    ? operationalSignals.incompleteOutputs.events
    : [];
  const lastRetry = retryEvents[retryEvents.length - 1] || null;
  const fingerprint = [
    operationalSignals?.status || '',
    lastRetry?.message || '',
    lastRetry?.errorName || '',
    ...retryEvents.map((event) => event?.message || ''),
    ...incompleteEvents.map((event) => event?.message || ''),
  ].join(' ').toLowerCase();

  if (!fingerprint.trim()) return 'unknown';
  if (fingerprint.includes('insufficient_quota')
    || fingerprint.includes('credit balance is too low')
    || fingerprint.includes('exceeded your current quota')
    || fingerprint.includes('billing details')) {
    return 'quota_exhausted';
  }
  if (fingerprint.includes('finish_reason: length')
    || fingerprint.includes('missing end_marker')
    || fingerprint.includes('truncated')) {
    return 'provider_length';
  }
  if (incompleteEvents.length > 0) return 'incomplete_output';
  if ((operationalSignals?.toolLoopExhaustions?.count || 0) > 0) return 'tool_loop_exhausted';
  if (operationalSignals?.status === 'failed') return 'runtime_failure';
  if (operationalSignals?.status === 'completed') return 'completed';
  return 'unknown';
}

function summarizeRunFlow(runFlow = {}) {
  if (!runFlow || typeof runFlow !== 'object' || Object.keys(runFlow).length === 0) {
    return {
      found: false,
      runId: '',
      status: 'missing',
      failureReason: 'unknown',
      lastFailedAgent: '',
      lastFailedStage: '',
      lastErrorMessage: '',
      retryCount: 0,
      rateLimitCount: 0,
      toolLoopExhaustions: 0,
      completedPhases: [],
      partialPhases: [],
    };
  }

  const phases = runFlow.phases && typeof runFlow.phases === 'object'
    ? runFlow.phases
    : {};
  const phaseEntries = Object.entries(phases);
  const completedPhases = phaseEntries
    .filter(([, phase]) => phase && phase.status === 'done')
    .map(([name]) => name);
  const partialPhases = phaseEntries
    .filter(([, phase]) => phase && phase.status === 'partial')
    .map(([name]) => name);
  const operationalSignals = runFlow.operationalSignals || {};
  const retryEvents = Array.isArray(operationalSignals?.retries?.events)
    ? operationalSignals.retries.events
    : [];
  const lastRetry = retryEvents[retryEvents.length - 1] || null;

  return {
    found: true,
    runId: String(runFlow.runId || '').trim(),
    status: String(operationalSignals.status || '').trim() || 'unknown',
    failureReason: classifyRunFailureReason(runFlow),
    lastFailedAgent: String(lastRetry?.agent || '').trim(),
    lastFailedStage: String(lastRetry?.stage || '').trim(),
    lastErrorMessage: String(lastRetry?.message || '').trim(),
    retryCount: Number(operationalSignals?.retries?.count) || 0,
    rateLimitCount: Number(operationalSignals?.retries?.rateLimitCount) || 0,
    toolLoopExhaustions: Number(operationalSignals?.toolLoopExhaustions?.count) || 0,
    completedPhases,
    partialPhases,
  };
}

function resolveRunFlowPath(runDir = '', explicitRunFlowPath = '') {
  const explicit = String(explicitRunFlowPath || '').trim();
  if (explicit) {
    return readJsonIfExists(explicit) ? explicit : '';
  }

  const resolvedRunDir = String(runDir || '').trim();
  if (!resolvedRunDir) return '';

  const direct = path.join(resolvedRunDir, 'run-flow.json');
  if (readJsonIfExists(direct)) return direct;

  const runId = path.basename(resolvedRunDir);
  const runsRoot = path.dirname(resolvedRunDir);
  const promptsRoot = path.dirname(runsRoot);
  const activeFlowPath = path.join(promptsRoot, 'run', 'run-flow.json');
  const activeFlow = readJsonIfExists(activeFlowPath);
  if (activeFlow?.runId === runId) return activeFlowPath;

  const archivedFlowDirs = safeReadDir(runsRoot)
    .filter((entry) => entry.startsWith(`${runId}-`))
    .sort()
    .reverse();

  for (const entry of archivedFlowDirs) {
    const candidate = path.join(runsRoot, entry, 'run-flow.json');
    const parsed = readJsonIfExists(candidate);
    if (parsed?.runId === runId) return candidate;
  }

  return '';
}

function classifyRunArtifactState(summary = {}) {
  const availableArtifacts = [];
  const missingArtifacts = [];

  if (summary.promptScopeWarningPath) availableArtifacts.push('prompt-scope-warning');
  else missingArtifacts.push('prompt-scope-warning');

  if (summary.testerValidationPath) availableArtifacts.push('tester-validation');
  else missingArtifacts.push('tester-validation');

  if (summary.resultWarningPath) availableArtifacts.push('result-warning');
  else missingArtifacts.push('result-warning');

  if (summary.runFlowPath) availableArtifacts.push('run-flow');
  else missingArtifacts.push('run-flow');

  const hasTesterVerdict = Boolean(summary?.tester?.verdict);
  const artifactState = hasTesterVerdict
    ? 'complete'
    : availableArtifacts.length > 0
      ? 'partial'
      : 'empty';

  return {
    artifactState,
    availableArtifacts,
    missingArtifacts,
  };
}

function buildRunArtifactSummary(options = {}) {
  const runDir = String(options.runDir || '').trim();
  const promptScopeWarningPath = String(options.promptScopeWarningPath || path.join(runDir, 'prompt-scope-warning.txt')).trim();
  const testerValidationPath = String(options.testerValidationPath || path.join(runDir, 'tester-validation.json')).trim();
  const resultWarningPath = String(options.resultWarningPath || '').trim();
  const runFlowPath = resolveRunFlowPath(runDir, options.runFlowPath);

  const promptScopeWarningText = readTextIfExists(promptScopeWarningPath);
  const testerValidationText = readTextIfExists(testerValidationPath);
  const resultWarningText = readTextIfExists(resultWarningPath);
  const runFlow = readJsonIfExists(runFlowPath);

  const summary = {
    runDir,
    promptScopeWarningPath: promptScopeWarningText ? promptScopeWarningPath : '',
    testerValidationPath: testerValidationText ? testerValidationPath : '',
    resultWarningPath: resultWarningText ? resultWarningPath : '',
    runFlowPath,
    promptScope: parsePromptScopeWarningContent(promptScopeWarningText),
    tester: parseTesterValidationContent(testerValidationText),
    resultWarning: parseResultWarningContent(resultWarningText),
    runFlow: summarizeRunFlow(runFlow),
  };

  return {
    ...summary,
    ...classifyRunArtifactState(summary),
  };
}

function parseArgs(argv = []) {
  const args = {
    runDir: '',
    promptScopeWarningPath: '',
    testerValidationPath: '',
    resultWarningPath: '',
    runFlowPath: '',
  };

  for (const arg of argv) {
    if (arg.startsWith('--run-dir=')) args.runDir = arg.slice('--run-dir='.length).trim();
    else if (arg.startsWith('--prompt-scope-warning=')) args.promptScopeWarningPath = arg.slice('--prompt-scope-warning='.length).trim();
    else if (arg.startsWith('--tester-validation=')) args.testerValidationPath = arg.slice('--tester-validation='.length).trim();
    else if (arg.startsWith('--result-warning=')) args.resultWarningPath = arg.slice('--result-warning='.length).trim();
    else if (arg.startsWith('--run-flow=')) args.runFlowPath = arg.slice('--run-flow='.length).trim();
  }

  return args;
}

function main(input = process.argv.slice(2)) {
  const args = parseArgs(input);
  if (!args.runDir && !args.promptScopeWarningPath && !args.testerValidationPath && !args.resultWarningPath && !args.runFlowPath) {
    console.error('Usage: node ai/scripts/run-artifact-summary.js --run-dir=PATH [--result-warning=PATH] [--run-flow=PATH]');
    process.exitCode = 1;
    return null;
  }

  const summary = buildRunArtifactSummary(args);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  main();
}

module.exports = {
  parsePromptScopeWarningContent,
  parseResultWarningContent,
  parseTesterValidationContent,
  classifyRunFailureReason,
  summarizeRunFlow,
  resolveRunFlowPath,
  classifyRunArtifactState,
  buildRunArtifactSummary,
  parseArgs,
  main,
};
