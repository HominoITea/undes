const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parsePromptScopeWarningContent,
  parseResultWarningContent,
  parseTesterValidationContent,
  summarizeRunFlow,
  buildRunArtifactSummary,
} = require('../run-artifact-summary');

test('parsePromptScopeWarningContent extracts risk, details, and suggested prompt path', () => {
  const parsed = parsePromptScopeWarningContent(`
# Prompt Scope Warning

SCOPE_RISK: narrow-starting-seams
MANUAL_REVIEW_RECOMMENDED: YES
NOTE: Prompt names narrow starting seams that may bias retrieval toward a too-local slice.

Details:
- Upstream route creation may still be unread.
- Reset path may remain unverified.

Suggested broadened prompt: .ai/prompts/runs/run-1/suggested-broadened-prompt.txt
Use the broader prompt only with user approval.
`);

  assert.equal(parsed.scopeRisk, 'narrow-starting-seams');
  assert.equal(parsed.manualReviewRecommended, true);
  assert.equal(parsed.suggestedPromptPath, '.ai/prompts/runs/run-1/suggested-broadened-prompt.txt');
  assert.deepEqual(parsed.details, [
    'Upstream route creation may still be unread.',
    'Reset path may remain unverified.',
  ]);
});

test('parseResultWarningContent extracts patch-safe gap counts and categories', () => {
  const parsed = parseResultWarningContent(`
WARNING: Generated output is not guaranteed copy-paste-safe.
RESULT_MODE: DIAGNOSTIC
MANUAL_REVIEW_REQUIRED: YES
PATCH_SAFE_CONTRACT_GAP_COUNT: 0
PATCH_SAFE_GROUNDING_GAP_COUNT: 1
PATCH_SAFE_CONTRACT_GAP_CATEGORIES: none
PATCH_SAFE_GROUNDING_GAP_CATEGORIES: substantive-assumptions, unconfirmed-seam
`);

  assert.equal(parsed.resultMode, 'DIAGNOSTIC');
  assert.equal(parsed.manualReviewRequired, true);
  assert.equal(parsed.contractGapCount, 0);
  assert.equal(parsed.groundingGapCount, 1);
  assert.deepEqual(parsed.contractGapCategories, []);
  assert.deepEqual(parsed.groundingGapCategories, ['substantive-assumptions', 'unconfirmed-seam']);
});

test('parseTesterValidationContent tolerates empty and invalid payloads', () => {
  assert.deepEqual(parseTesterValidationContent(''), {
    success: false,
    verdict: '',
    score: 0,
    summary: '',
  });

  assert.deepEqual(parseTesterValidationContent('bad-json'), {
    success: false,
    verdict: '',
    score: 0,
    summary: '',
  });
});

test('summarizeRunFlow classifies quota and length failures', () => {
  const quotaSummary = summarizeRunFlow({
    runId: 'run-2',
    phases: {
      preprocess: { status: 'done' },
      consensus: { status: 'done' },
      'approval-2': { status: 'partial' },
    },
    operationalSignals: {
      status: 'failed',
      retries: {
        count: 4,
        rateLimitCount: 4,
        events: [
          {
            agent: 'developer',
            stage: 'approval-2',
            message: 'Openai API error (429): {"error":{"message":"You exceeded your current quota","type":"insufficient_quota"}}',
          },
        ],
      },
      toolLoopExhaustions: { count: 1 },
    },
  });

  assert.equal(quotaSummary.failureReason, 'quota_exhausted');
  assert.equal(quotaSummary.lastFailedAgent, 'developer');
  assert.equal(quotaSummary.lastFailedStage, 'approval-2');
  assert.deepEqual(quotaSummary.completedPhases, ['preprocess', 'consensus']);
  assert.deepEqual(quotaSummary.partialPhases, ['approval-2']);

  const lengthSummary = summarizeRunFlow({
    runId: 'run-3',
    phases: {
      preprocess: { status: 'done' },
    },
    operationalSignals: {
      status: 'failed',
      retries: {
        count: 1,
        rateLimitCount: 0,
        events: [
          {
            agent: 'developer',
            stage: 'proposal',
            message: 'OpenAI empty response. finish_reason: length, model: gpt-5.4',
          },
        ],
      },
    },
  });

  assert.equal(lengthSummary.failureReason, 'provider_length');
  assert.equal(lengthSummary.lastFailedStage, 'proposal');
});

test('buildRunArtifactSummary loads available files from a run directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-artifact-summary-'));
  const promptsRoot = path.join(root, 'prompts');
  const runDir = path.join(promptsRoot, 'runs', 'run-1');
  const activeRunDir = path.join(promptsRoot, 'run');
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(activeRunDir, { recursive: true });

  fs.writeFileSync(path.join(runDir, 'prompt-scope-warning.txt'), `
SCOPE_RISK: explicit-hard-scope
MANUAL_REVIEW_RECOMMENDED: YES

Details:
- User explicitly requested a hard scope.
`);
  fs.writeFileSync(path.join(runDir, 'tester-validation.json'), JSON.stringify({
    success: true,
    verdict: 'NEEDS_REVISION',
    score: 6,
    summary: 'Still missing upstream route creation.',
  }, null, 2));
  const resultWarningPath = path.join(root, 'result-warning.txt');
  fs.writeFileSync(resultWarningPath, `
RESULT_MODE: DIAGNOSTIC
MANUAL_REVIEW_REQUIRED: YES
PATCH_SAFE_CONTRACT_GAP_COUNT: 1
PATCH_SAFE_GROUNDING_GAP_COUNT: 2
PATCH_SAFE_CONTRACT_GAP_CATEGORIES: missing-section
PATCH_SAFE_GROUNDING_GAP_CATEGORIES: substantive-assumptions
`);
  fs.writeFileSync(path.join(activeRunDir, 'run-flow.json'), JSON.stringify({
    runId: 'run-1',
    phases: {
      preprocess: { status: 'done' },
      tester: { status: 'done' },
    },
    operationalSignals: {
      status: 'completed',
      retries: { count: 0, rateLimitCount: 0, events: [] },
      toolLoopExhaustions: { count: 0 },
    },
  }, null, 2));

  const summary = buildRunArtifactSummary({
    runDir,
    resultWarningPath,
  });

  assert.equal(summary.artifactState, 'complete');
  assert.deepEqual(summary.availableArtifacts, [
    'prompt-scope-warning',
    'tester-validation',
    'result-warning',
    'run-flow',
  ]);
  assert.deepEqual(summary.missingArtifacts, []);
  assert.equal(summary.runFlow.status, 'completed');
  assert.equal(summary.runFlow.failureReason, 'completed');
  assert.equal(summary.promptScope.scopeRisk, 'explicit-hard-scope');
  assert.deepEqual(summary.promptScope.details, ['User explicitly requested a hard scope.']);
  assert.equal(summary.tester.verdict, 'NEEDS_REVISION');
  assert.equal(summary.tester.score, 6);
  assert.equal(summary.resultWarning.contractGapCount, 1);
  assert.deepEqual(summary.resultWarning.contractGapCategories, ['missing-section']);
  assert.deepEqual(summary.resultWarning.groundingGapCategories, ['substantive-assumptions']);
});
