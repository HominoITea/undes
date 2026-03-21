const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  buildRegressionReport,
  compareValues,
} = require('../run-artifact-regression');

const manifestPath = path.join(__dirname, 'fixtures', 'run-artifacts', 'golden-manifest.json');

test('buildRegressionReport validates golden run-artifact fixtures', () => {
  const report = buildRegressionReport(manifestPath);

  assert.equal(report.passed, true);
  assert.equal(report.cases.length, 4);
  assert.equal(report.comparisons.length, 1);

  const targetedLength = report.cases.find((testCase) => testCase.id === 'targeted-length');
  const targetedQuota = report.cases.find((testCase) => testCase.id === 'targeted-quota');
  assert.ok(targetedLength);
  assert.ok(targetedQuota);
  assert.equal(targetedLength.summary.artifactState, 'partial');
  assert.equal(targetedLength.summary.runFlow.failureReason, 'provider_length');
  assert.equal(targetedQuota.summary.runFlow.failureReason, 'quota_exhausted');
  assert.equal(targetedQuota.summary.runFlow.lastFailedStage, 'approval-2');

  const broadened = report.cases.find((testCase) => testCase.id === 'broadened');
  const narrow = report.cases.find((testCase) => testCase.id === 'narrow');
  assert.ok(broadened);
  assert.ok(narrow);
  assert.equal(broadened.summary.tester.score > narrow.summary.tester.score, true);
});

test('compareValues supports numeric ordering for regression comparisons', () => {
  assert.equal(compareValues(6, 4, 'gt'), true);
  assert.equal(compareValues(4, 6, 'lt'), true);
  assert.equal(compareValues(6, 6, 'gte'), true);
  assert.equal(compareValues(6, 6, 'lte'), true);
  assert.equal(compareValues('complete', 'complete', 'eq'), true);
});
