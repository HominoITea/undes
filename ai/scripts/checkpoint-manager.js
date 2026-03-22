'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const END_MARKER = '=== END OF DOCUMENT ===';

// In-memory cache for loadRun() — avoids re-reading run-flow.json on every call.
// Keyed by absolute file path → { flow (parsed object), mtimeMs }.
// Invalidated automatically by writeFlowAtomic and clearLoadRunCache.
const _flowCache = new Map();

function resolveCheckpointLayout(layoutOrAiDataDir) {
  if (layoutOrAiDataDir && typeof layoutOrAiDataDir === 'object') {
    const runtimeRoot = layoutOrAiDataDir.runtimeRoot || layoutOrAiDataDir.aiDataRoot;
    const promptsDir = layoutOrAiDataDir.promptsDir || path.join(runtimeRoot, 'prompts');
    const runDirPath = path.join(promptsDir, 'run');
    const runsDir = layoutOrAiDataDir.runsDir || layoutOrAiDataDir.archiveDir || path.join(promptsDir, 'runs');
    const legacyArchiveDir = layoutOrAiDataDir.legacyArchiveDir || path.join(promptsDir, 'archive');
    return {
      runtimeRoot,
      promptsDir,
      runDir: runDirPath,
      runFlowPath: path.join(runDirPath, 'run-flow.json'),
      runsDir,
      legacyArchiveDir,
      archiveDir: runsDir,
      agentsConfigPath: layoutOrAiDataDir.agentsConfigPath || path.join(runtimeRoot, 'agents.json'),
      contextConfigPath: layoutOrAiDataDir.contextConfigPath || path.join(runtimeRoot, 'context.json'),
    };
  }

  const aiDataDir = String(layoutOrAiDataDir || '');
  const promptsDir = path.join(aiDataDir, 'prompts');
  const runDirPath = path.join(promptsDir, 'run');
  return {
    runtimeRoot: aiDataDir,
    promptsDir,
    runDir: runDirPath,
    runFlowPath: path.join(runDirPath, 'run-flow.json'),
    runsDir: path.join(promptsDir, 'runs'),
    legacyArchiveDir: path.join(promptsDir, 'archive'),
    archiveDir: path.join(promptsDir, 'runs'),
    agentsConfigPath: path.join(aiDataDir, 'agents.json'),
    contextConfigPath: path.join(aiDataDir, 'context.json'),
  };
}

function isOutputComplete(filePath, outputFormat) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return false;

  const format = outputFormat || (String(filePath).endsWith('.json') ? 'json' : 'text');
  if (format === 'json') {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  return content.trimEnd().endsWith(END_MARKER);
}

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = stableNormalize(value[key]);
        if (normalized !== undefined) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }
  if (value === undefined) return undefined;
  return value;
}

function normalizeRuntimeSettings(runtimeSettings) {
  if (!runtimeSettings || typeof runtimeSettings !== 'object') return null;
  return stableNormalize(runtimeSettings);
}

function flattenSettings(value, prefix = '', target = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) target[prefix] = value;
    return target;
  }
  for (const key of Object.keys(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenSettings(value[key], nextPrefix, target);
  }
  return target;
}

function describeRuntimeSettingDiff(previousSettings, currentSettings, limit = 6) {
  const prev = flattenSettings(normalizeRuntimeSettings(previousSettings) || {});
  const curr = flattenSettings(normalizeRuntimeSettings(currentSettings) || {});
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(curr)])).sort();
  const diffs = [];
  for (const key of keys) {
    if (Object.is(prev[key], curr[key])) continue;
    diffs.push(`${key}: ${String(prev[key])} → ${String(curr[key])}`);
    if (diffs.length >= limit) break;
  }
  return diffs;
}

function runFingerprint(promptText, layoutOrAiDataDir, runtimeSettings) {
  const layout = resolveCheckpointLayout(layoutOrAiDataDir);
  const parts = [String(promptText || '')];
  const configFiles = [
    ['agents.json', layout.agentsConfigPath],
    ['context.json', layout.contextConfigPath],
  ];
  for (const [fileName, fp] of configFiles) {
    try {
      const stat = fs.statSync(fp);
      parts.push(`${fileName}:${stat.mtimeMs}`);
    } catch {
      parts.push(`${fileName}:missing`);
    }
  }
  const normalizedRuntimeSettings = normalizeRuntimeSettings(runtimeSettings);
  if (normalizedRuntimeSettings) {
    parts.push(`runtime:${JSON.stringify(normalizedRuntimeSettings)}`);
  } else {
    parts.push('runtime:none');
  }
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

function promptHash(promptText) {
  return crypto.createHash('sha256').update(String(promptText || '')).digest('hex').slice(0, 12);
}

function runFlowPath(layoutOrAiDataDir) {
  return resolveCheckpointLayout(layoutOrAiDataDir).runFlowPath;
}

function runDir(layoutOrAiDataDir) {
  return resolveCheckpointLayout(layoutOrAiDataDir).runDir;
}

function writeFlowAtomic(layoutOrAiDataDir, flow) {
  const fp = runFlowPath(layoutOrAiDataDir);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${fp}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(flow, null, 2) + '\n');
  fs.renameSync(tmp, fp);
  // Update cache after successful write.
  try {
    const stat = fs.statSync(fp);
    _flowCache.set(path.resolve(fp), { flow: JSON.parse(JSON.stringify(flow)), mtimeMs: stat.mtimeMs });
  } catch {
    _flowCache.delete(path.resolve(fp));
  }
}

function createRun(layoutOrAiDataDir, promptText, flags, agentNames, options = {}) {
  const layout = resolveCheckpointLayout(layoutOrAiDataDir);
  fs.mkdirSync(layout.runDir, { recursive: true });
  const taskId = String(options.taskId || '').trim();
  const runtimeSettings = normalizeRuntimeSettings(options.runtimeSettings);
  const flow = {
    version: 1,
    runId: `run-${Date.now()}`,
    startedAt: new Date().toISOString(),
    prompt: String(promptText || ''),
    promptHash: promptHash(promptText),
    fingerprint: runFingerprint(promptText, layout, runtimeSettings),
    flags: Array.isArray(flags) ? flags : [],
    agents: Array.isArray(agentNames) ? agentNames : [],
    phases: {},
  };
  if (taskId) {
    flow.taskId = taskId;
  }
  if (runtimeSettings) {
    flow.runtimeSettings = runtimeSettings;
  }
  writeFlowAtomic(layout, flow);
  return flow;
}

function loadRun(layoutOrAiDataDir) {
  const fp = runFlowPath(layoutOrAiDataDir);
  const resolvedFp = path.resolve(fp);

  // Check mtime-based cache first.
  try {
    const stat = fs.statSync(fp);
    const cached = _flowCache.get(resolvedFp);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return JSON.parse(JSON.stringify(cached.flow));
    }
  } catch {
    // File doesn't exist or stat failed — clear cache entry.
    _flowCache.delete(resolvedFp);
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!parsed || parsed.version !== 1 || !parsed.runId) return null;
    if (!parsed.phases || typeof parsed.phases !== 'object') parsed.phases = {};
    parsed.runtimeSettings = normalizeRuntimeSettings(parsed.runtimeSettings);
    // Populate cache.
    const stat = fs.statSync(fp);
    _flowCache.set(resolvedFp, { flow: JSON.parse(JSON.stringify(parsed)), mtimeMs: stat.mtimeMs });
    return parsed;
  } catch {
    return null;
  }
}

function clearLoadRunCache() {
  _flowCache.clear();
}

function updatePhase(layoutOrAiDataDir, phaseName, phaseData) {
  const flow = loadRun(layoutOrAiDataDir);
  if (!flow) return;
  flow.phases[phaseName] = {
    ...(flow.phases[phaseName] || {}),
    ...(phaseData || {}),
  };
  writeFlowAtomic(layoutOrAiDataDir, flow);
}

function updatePhaseAgent(layoutOrAiDataDir, phaseName, agentName, agentData) {
  const flow = loadRun(layoutOrAiDataDir);
  if (!flow) return;
  if (!flow.phases[phaseName]) flow.phases[phaseName] = { status: 'partial', agents: {} };
  if (!flow.phases[phaseName].agents) flow.phases[phaseName].agents = {};
  const expectedAgentsFromUpdate = Array.isArray(agentData?.expectedAgents)
    ? agentData.expectedAgents.filter((name) => typeof name === 'string' && name.trim())
    : null;
  if (expectedAgentsFromUpdate && expectedAgentsFromUpdate.length > 0) {
    flow.phases[phaseName].expectedAgents = Array.from(new Set(expectedAgentsFromUpdate));
  }
  flow.phases[phaseName].agents[agentName] = {
    ...(flow.phases[phaseName].agents[agentName] || {}),
    ...(agentData || {}),
  };

  const expectedAgents = Array.isArray(flow.phases[phaseName].expectedAgents) && flow.phases[phaseName].expectedAgents.length > 0
    ? flow.phases[phaseName].expectedAgents
    : (Array.isArray(flow.agents) ? flow.agents : []);
  const entries = flow.phases[phaseName].agents;
  let allDone = false;
  if (expectedAgents.length > 0) {
    allDone = expectedAgents.every((name) => entries[name] && entries[name].status === 'done');
  } else {
    const present = Object.values(entries);
    allDone = present.length > 0 && present.every((item) => item && item.status === 'done');
  }
  if (allDone) {
    flow.phases[phaseName].status = 'done';
    flow.phases[phaseName].finishedAt = new Date().toISOString();
  } else {
    flow.phases[phaseName].status = 'partial';
  }

  writeFlowAtomic(layoutOrAiDataDir, flow);
}

function isPhaseDone(layoutOrAiDataDir, phaseName) {
  const flow = loadRun(layoutOrAiDataDir);
  if (!flow || !flow.phases[phaseName]) return false;
  const phase = flow.phases[phaseName];
  if (phase.status !== 'done') return false;
  if (phase.outputFile) {
    return isOutputComplete(phase.outputFile, phase.outputFormat);
  }
  return true;
}

function isAgentDone(layoutOrAiDataDir, phaseName, agentName) {
  const flow = loadRun(layoutOrAiDataDir);
  if (!flow || !flow.phases[phaseName]) return false;
  const agents = flow.phases[phaseName].agents;
  if (!agents || !agents[agentName]) return false;
  const agent = agents[agentName];
  if (agent.status !== 'done') return false;
  if (!agent.outputFile) return false;
  return isOutputComplete(agent.outputFile, agent.outputFormat || 'text');
}

function getAgentOutput(layoutOrAiDataDir, phaseName, agentName) {
  const flow = loadRun(layoutOrAiDataDir);
  if (!flow || !flow.phases[phaseName]) return null;
  const agents = flow.phases[phaseName].agents;
  if (!agents || !agents[agentName]) return null;
  const outputFile = agents[agentName].outputFile;
  if (!outputFile || !fs.existsSync(outputFile)) return null;
  return fs.readFileSync(outputFile, 'utf8');
}

function getPhaseOutput(layoutOrAiDataDir, phaseName) {
  const flow = loadRun(layoutOrAiDataDir);
  if (!flow || !flow.phases[phaseName]) return null;
  const outputFile = flow.phases[phaseName].outputFile;
  if (!outputFile || !fs.existsSync(outputFile)) return null;
  return fs.readFileSync(outputFile, 'utf8');
}

function getResumePoint(flow, phaseOrder) {
  const order = Array.isArray(phaseOrder) ? phaseOrder : [];
  if (!flow || !flow.phases) return order[0] || null;
  for (const phase of order) {
    const entry = flow.phases[phase];
    if (!entry || entry.status !== 'done') return phase;
  }
  return null;
}

function archiveRun(layoutOrAiDataDir) {
  const layout = resolveCheckpointLayout(layoutOrAiDataDir);
  const flow = loadRun(layout);
  if (!flow) return;
  const srcDir = layout.runDir;
  const srcFlow = layout.runFlowPath;
  const baseDest = path.join(layout.runsDir || layout.archiveDir, flow.runId);
  const dest = fs.existsSync(baseDest) ? `${baseDest}-${Date.now()}` : baseDest;
  fs.mkdirSync(dest, { recursive: true });
  if (fs.existsSync(srcFlow)) {
    _flowCache.delete(path.resolve(srcFlow));
    fs.renameSync(srcFlow, path.join(dest, 'run-flow.json'));
  }
  try {
    fs.rmdirSync(srcDir);
  } catch {
    // no-op: directory may be non-empty or absent
  }
}

function clearRun(layoutOrAiDataDir) {
  const fp = runFlowPath(layoutOrAiDataDir);
  _flowCache.delete(path.resolve(fp));
  const dir = runDir(layoutOrAiDataDir);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function formatRunAge(startedAt) {
  const startedTs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedTs)) return 'unknown age';
  const diff = Date.now() - startedTs;
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

module.exports = {
  END_MARKER,
  isOutputComplete,
  normalizeRuntimeSettings,
  describeRuntimeSettingDiff,
  runFingerprint,
  promptHash,
  runFlowPath,
  runDir,
  createRun,
  loadRun,
  writeFlowAtomic,
  updatePhase,
  updatePhaseAgent,
  isPhaseDone,
  isAgentDone,
  getAgentOutput,
  getPhaseOutput,
  getResumePoint,
  archiveRun,
  clearRun,
  clearLoadRunCache,
  formatRunAge,
};
