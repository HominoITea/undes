'use strict';

const fs = require('fs');

function toSafeInt(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
}

function normalizeCallUsage(inputTokensOrUsage = 0, outputTokens = 0) {
  if (inputTokensOrUsage && typeof inputTokensOrUsage === 'object') {
    return {
      inputTokens: toSafeInt(inputTokensOrUsage.inputTokens),
      outputTokens: toSafeInt(inputTokensOrUsage.outputTokens),
      provider: String(inputTokensOrUsage.provider || '').trim(),
      model: String(inputTokensOrUsage.model || '').trim(),
    };
  }

  return {
    inputTokens: toSafeInt(inputTokensOrUsage),
    outputTokens: toSafeInt(outputTokens),
    provider: '',
    model: '',
  };
}

function createRollupBucket(label = '', extra = {}) {
  return {
    label,
    calls: 0,
    totalTimeMs: 0,
    totalTimeSeconds: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    ...extra,
  };
}

function ensureStageRollup(target, stage = '') {
  const key = String(stage || 'unknown').trim() || 'unknown';
  if (!target[key]) {
    target[key] = createRollupBucket(key, { models: {} });
  }
  return target[key];
}

function getModelKey(provider = '', model = '') {
  const safeProvider = String(provider || '').trim();
  const safeModel = String(model || '').trim();
  if (safeProvider && safeModel) return `${safeProvider}/${safeModel}`;
  return safeModel || safeProvider || 'unknown';
}

function ensureModelRollup(target, provider = '', model = '') {
  const key = getModelKey(provider, model);
  if (!target[key]) {
    target[key] = createRollupBucket(key, {
      provider: String(provider || '').trim(),
      model: String(model || '').trim(),
      stages: {},
    });
  }
  return target[key];
}

function applyRollup(bucket, duration, inputTokens, outputTokens) {
  bucket.calls += 1;
  bucket.totalTimeMs += duration;
  bucket.totalTimeSeconds = parseFloat((bucket.totalTimeMs / 1000).toFixed(2));
  bucket.inputTokens += inputTokens;
  bucket.outputTokens += outputTokens;
  bucket.totalTokens = bucket.inputTokens + bucket.outputTokens;
}

function buildBreakdowns(calls = []) {
  const stageBreakdown = {};
  const modelBreakdown = {};

  for (const call of calls) {
    const duration = toSafeInt(call.duration ?? call.durationMs);
    const inputTokens = toSafeInt(call.inputTokens);
    const outputTokens = toSafeInt(call.outputTokens);
    const provider = String(call.provider || '').trim();
    const model = String(call.model || '').trim();
    const stage = String(call.stage || 'unknown').trim() || 'unknown';

    const stageBucket = ensureStageRollup(stageBreakdown, stage);
    applyRollup(stageBucket, duration, inputTokens, outputTokens);

    const modelBucket = ensureModelRollup(modelBreakdown, provider, model);
    applyRollup(modelBucket, duration, inputTokens, outputTokens);

    const stageModelBucket = ensureModelRollup(stageBucket.models, provider, model);
    applyRollup(stageModelBucket, duration, inputTokens, outputTokens);

    const modelStageBucket = ensureStageRollup(modelBucket.stages, stage);
    applyRollup(modelStageBucket, duration, inputTokens, outputTokens);
  }

  return {
    stageBreakdown,
    modelBreakdown,
  };
}

function createMetricsState() {
  return {
    startTime: Date.now(),
    agents: {},
    totalInputTokens: 0,
    totalOutputTokens: 0,
    consensusRounds: 0,
    hasUsage: false,
  };
}

function trackAgentCall(metrics, agentName, stage, duration, inputTokensOrUsage = 0, outputTokens = 0) {
  const usage = normalizeCallUsage(inputTokensOrUsage, outputTokens);
  if (!metrics.agents[agentName]) {
    metrics.agents[agentName] = { calls: [], totalTime: 0, inputTokens: 0, outputTokens: 0 };
  }
  metrics.agents[agentName].calls.push({
    stage,
    duration,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    provider: usage.provider,
    model: usage.model,
  });
  metrics.agents[agentName].totalTime += duration;
  metrics.agents[agentName].inputTokens += usage.inputTokens;
  metrics.agents[agentName].outputTokens += usage.outputTokens;
  metrics.totalInputTokens += usage.inputTokens;
  metrics.totalOutputTokens += usage.outputTokens;
  if (usage.inputTokens || usage.outputTokens) {
    metrics.hasUsage = true;
  }
}

function buildMetricsReport(metrics, options = {}) {
  const {
    promptPreview = '',
    operationalSignalsSnapshot = null,
  } = options;

  const endTime = Date.now();
  const totalTimeMs = endTime - metrics.startTime;
  const totalTime = (totalTimeMs / 1000).toFixed(2);

  const report = {
    timestamp: new Date().toISOString(),
    promptPreview: promptPreview.substring(0, 100) + (promptPreview.length > 100 ? '...' : ''),
    totalTimeMs,
    totalTimeSeconds: parseFloat(totalTime),
    consensusRounds: metrics.consensusRounds,
    avgConfidence: metrics.avgConfidence || null,
    agents: {},
    stageBreakdown: {},
    modelBreakdown: {},
    totalInputTokens: metrics.hasUsage ? metrics.totalInputTokens : null,
    totalOutputTokens: metrics.hasUsage ? metrics.totalOutputTokens : null,
    totalTokens: metrics.hasUsage ? metrics.totalInputTokens + metrics.totalOutputTokens : null,
    operationalSignals: operationalSignalsSnapshot || null,
  };

  const allCalls = [];
  for (const [name, data] of Object.entries(metrics.agents)) {
    const avgTime = (data.totalTime / data.calls.length / 1000).toFixed(2);
    const callDetails = data.calls.map((call) => ({
      stage: call.stage,
      durationMs: toSafeInt(call.duration),
      durationSeconds: parseFloat((toSafeInt(call.duration) / 1000).toFixed(2)),
      inputTokens: toSafeInt(call.inputTokens),
      outputTokens: toSafeInt(call.outputTokens),
      totalTokens: toSafeInt(call.inputTokens) + toSafeInt(call.outputTokens),
      provider: String(call.provider || '').trim(),
      model: String(call.model || '').trim(),
    }));
    const breakdowns = buildBreakdowns(callDetails);
    allCalls.push(...callDetails);
    report.agents[name] = {
      calls: data.calls.length,
      totalTimeMs: data.totalTime,
      totalTimeSeconds: parseFloat((data.totalTime / 1000).toFixed(2)),
      avgTimeSeconds: parseFloat(avgTime),
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      stages: data.calls.map(c => c.stage),
      callDetails,
      stageBreakdown: breakdowns.stageBreakdown,
      modelBreakdown: breakdowns.modelBreakdown,
    };
  }

  const globalBreakdowns = buildBreakdowns(allCalls);
  report.stageBreakdown = globalBreakdowns.stageBreakdown;
  report.modelBreakdown = globalBreakdowns.modelBreakdown;

  return report;
}

function printMetricsToConsole(metrics, report) {
  const totalTime = (report.totalTimeMs / 1000).toFixed(2);

  console.log('\n📊 ===== METRICS =====');
  console.log(`⏱️  Total time: ${totalTime}s`);
  console.log(`🔄 Consensus rounds: ${metrics.consensusRounds}`);
  if (metrics.avgConfidence !== undefined) {
    const confEmoji = metrics.avgConfidence >= 80 ? '🟢' : metrics.avgConfidence >= 60 ? '🟡' : '🔴';
    console.log(`${confEmoji} Avg confidence: ${metrics.avgConfidence}%`);
  }

  for (const [name, data] of Object.entries(metrics.agents)) {
    const avgTime = (data.totalTime / data.calls.length / 1000).toFixed(2);
    console.log(`\n🤖 ${name}:`);
    console.log(`   Calls: ${data.calls.length}`);
    console.log(`   Total time: ${(data.totalTime / 1000).toFixed(2)}s (avg: ${avgTime}s)`);
    if (data.inputTokens || data.outputTokens) {
      console.log(`   Tokens: ${data.inputTokens} in / ${data.outputTokens} out`);
    }
  }

  if (metrics.hasUsage) {
    console.log(`\n💰 Total tokens: ${metrics.totalInputTokens} in / ${metrics.totalOutputTokens} out`);
    const stageSummary = Object.values(report.stageBreakdown || {});
    if (stageSummary.length > 0) {
      console.log('🧩 Tokens by phase:');
      for (const entry of stageSummary) {
        console.log(
          `   - ${entry.label}: ${entry.inputTokens} in / ${entry.outputTokens} out `
          + `(${entry.calls} call${entry.calls === 1 ? '' : 's'})`,
        );
      }
    }
    const modelSummary = Object.values(report.modelBreakdown || {});
    if (modelSummary.length > 0) {
      console.log('🧠 Tokens by model:');
      for (const entry of modelSummary) {
        console.log(
          `   - ${entry.label}: ${entry.inputTokens} in / ${entry.outputTokens} out `
          + `(${entry.calls} call${entry.calls === 1 ? '' : 's'})`,
        );
      }
    }
  } else {
    console.log('\n💰 Total tokens: unknown (provider did not return usage)');
  }
  console.log('======================\n');
}

function saveMetricsFiles(report, paths = {}) {
  const { metricsDir, latestPath, historyPath } = paths;
  try {
    fs.mkdirSync(metricsDir, { recursive: true });

    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
    console.log(`📁 Metrics saved: ${latestPath}`);

    let history = [];
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (e) {
        history = [];
      }
    }
    history.push(report);
    if (history.length > 100) {
      history = history.slice(-100);
    }
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch (e) {
    console.warn('⚠️ Failed to save metrics:', e.message);
  }
}

module.exports = {
  createMetricsState,
  trackAgentCall,
  buildMetricsReport,
  printMetricsToConsole,
  saveMetricsFiles,
};
