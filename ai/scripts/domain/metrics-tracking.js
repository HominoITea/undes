'use strict';

const fs = require('fs');

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

function trackAgentCall(metrics, agentName, stage, duration, inputTokens = 0, outputTokens = 0) {
  if (!metrics.agents[agentName]) {
    metrics.agents[agentName] = { calls: [], totalTime: 0, inputTokens: 0, outputTokens: 0 };
  }
  metrics.agents[agentName].calls.push({ stage, duration });
  metrics.agents[agentName].totalTime += duration;
  metrics.agents[agentName].inputTokens += inputTokens;
  metrics.agents[agentName].outputTokens += outputTokens;
  metrics.totalInputTokens += inputTokens;
  metrics.totalOutputTokens += outputTokens;
  if (inputTokens || outputTokens) {
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
    totalInputTokens: metrics.hasUsage ? metrics.totalInputTokens : null,
    totalOutputTokens: metrics.hasUsage ? metrics.totalOutputTokens : null,
    totalTokens: metrics.hasUsage ? metrics.totalInputTokens + metrics.totalOutputTokens : null,
    operationalSignals: operationalSignalsSnapshot || null,
  };

  for (const [name, data] of Object.entries(metrics.agents)) {
    const avgTime = (data.totalTime / data.calls.length / 1000).toFixed(2);
    report.agents[name] = {
      calls: data.calls.length,
      totalTimeMs: data.totalTime,
      totalTimeSeconds: parseFloat((data.totalTime / 1000).toFixed(2)),
      avgTimeSeconds: parseFloat(avgTime),
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      stages: data.calls.map(c => c.stage),
    };
  }

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
