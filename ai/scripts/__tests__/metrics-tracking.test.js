const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMetricsState,
  trackAgentCall,
  buildMetricsReport,
} = require('../domain/metrics-tracking');

test('buildMetricsReport includes per-phase and per-model token breakdowns', () => {
  const metrics = createMetricsState();

  trackAgentCall(metrics, 'architect', 'proposal', 1200, {
    inputTokens: 120,
    outputTokens: 30,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  });
  trackAgentCall(metrics, 'reviewer', 'proposal', 800, {
    inputTokens: 90,
    outputTokens: 20,
    provider: 'google',
    model: 'gemini-2.5-pro',
  });
  trackAgentCall(metrics, 'synthesizer', 'consensus', 1400, {
    inputTokens: 220,
    outputTokens: 80,
    provider: 'openai',
    model: 'gpt-5.4',
  });

  const report = buildMetricsReport(metrics, { promptPreview: 'test prompt' });

  assert.equal(report.totalInputTokens, 430);
  assert.equal(report.totalOutputTokens, 130);
  assert.equal(report.totalTokens, 560);

  assert.equal(report.stageBreakdown.proposal.calls, 2);
  assert.equal(report.stageBreakdown.proposal.inputTokens, 210);
  assert.equal(report.stageBreakdown.proposal.outputTokens, 50);
  assert.equal(report.stageBreakdown.proposal.totalTimeMs, 2000);
  assert.equal(report.stageBreakdown.proposal.models['anthropic/claude-sonnet-4-6'].calls, 1);
  assert.equal(report.stageBreakdown.proposal.models['anthropic/claude-sonnet-4-6'].totalTimeMs, 1200);
  assert.equal(report.stageBreakdown.proposal.models['google/gemini-2.5-pro'].inputTokens, 90);

  assert.equal(report.modelBreakdown['openai/gpt-5.4'].calls, 1);
  assert.equal(report.modelBreakdown['openai/gpt-5.4'].stages.consensus.outputTokens, 80);
  assert.equal(report.modelBreakdown['openai/gpt-5.4'].totalTimeMs, 1400);

  assert.equal(report.agents.architect.callDetails[0].provider, 'anthropic');
  assert.equal(report.agents.architect.callDetails[0].model, 'claude-sonnet-4-6');
  assert.equal(report.agents.architect.stageBreakdown.proposal.totalTokens, 150);
  assert.equal(report.agents.reviewer.modelBreakdown['google/gemini-2.5-pro'].inputTokens, 90);
});

test('trackAgentCall keeps backward compatibility with positional token args', () => {
  const metrics = createMetricsState();

  trackAgentCall(metrics, 'developer', 'revision', 600, 40, 10);

  const report = buildMetricsReport(metrics, { promptPreview: 'legacy call' });

  assert.equal(report.totalInputTokens, 40);
  assert.equal(report.totalOutputTokens, 10);
  assert.equal(report.stageBreakdown.revision.totalTokens, 50);
  assert.equal(report.agents.developer.callDetails[0].provider, '');
  assert.equal(report.agents.developer.callDetails[0].model, '');
});
