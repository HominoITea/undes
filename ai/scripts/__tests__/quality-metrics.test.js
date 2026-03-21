const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseConfidence,
  calculateAverageConfidence,
  computeAgreementScore,
  shouldTriggerRevision,
} = require('../domain/quality-metrics');

test('parseConfidence parses valid marker and clamps value', () => {
  assert.equal(parseConfidence('[CONFIDENCE: 87%]'), 87);
  assert.equal(parseConfidence('[confidence: 150%]'), 100);
  assert.equal(parseConfidence('[CONFIDENCE: -1%]'), null);
  assert.equal(parseConfidence('no marker'), null);
});

test('calculateAverageConfidence ignores null values', () => {
  assert.equal(calculateAverageConfidence([90, 70, null]), 80);
  assert.equal(calculateAverageConfidence([null, null]), null);
});

test('computeAgreementScore returns percentage by markers', () => {
  assert.equal(computeAgreementScore(['✅ ok', '✅ yes', '❌ no']), 67);
  assert.equal(computeAgreementScore(['plain text only']), null);
});

test('shouldTriggerRevision triggers on low confidence', () => {
  const result = shouldTriggerRevision(55, { verdict: 'APPROVED', weaknesses: [] });
  assert.equal(result.trigger, true);
  assert.match(result.reason, /Low confidence/);
});

test('shouldTriggerRevision triggers on critical DA findings', () => {
  const criticalVerdict = shouldTriggerRevision(80, { verdict: 'CRITICAL_ISSUES', weaknesses: [] });
  assert.equal(criticalVerdict.trigger, true);

  const criticalWeaknesses = shouldTriggerRevision(80, {
    verdict: 'CONCERNS',
    overallRisk: 'HIGH',
    weaknesses: [{ severity: 'HIGH' }, { severity: 'CRITICAL' }],
  });
  assert.equal(criticalWeaknesses.trigger, true);
});

test('shouldTriggerRevision does not trigger on healthy output', () => {
  const result = shouldTriggerRevision(82, {
    verdict: 'APPROVED',
    overallRisk: 'LOW',
    weaknesses: [{ severity: 'LOW' }],
  });
  assert.deepEqual(result, { trigger: false, reason: null });
});
