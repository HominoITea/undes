const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const END_MARKER = '=== END OF DOCUMENT ===';

const {
  callAgent,
  callAgentWithValidation,
  normalizeApprovalReview,
  sanitizeTaskId,
  resolveTaskId,
  buildTaskDiscussionDir,
  sanitizeUserFacingFinalText,
  analyzeEvidenceGroundedResultStructure,
  extractEvidenceAnchors,
  buildEvidenceGroundingValidation,
  assessFinalResultTrust,
  buildFinalTrustSignal,
  buildResultWarningFileContent,
  buildPromptScopeWarningFileContent,
  buildResultFileContent,
  buildPatchSafeResultContent,
  buildApprovalHandoffSummary,
  buildSeamExpansionDeltaDiscussion,
  buildLatePhaseDiscussionSummary,
  parseRuntimeOverridesDocument,
  loadReusablePreprocessResult,
  getMaxOutputTokens,
  getConfiguredMaxOutputTokens,
  getAutoMaxOutputTokensSettings,
  resolveEffectiveMaxOutputTokens,
  getRepairMaxOutputTokens,
  createOperationalSignalsState,
  hasStructuredFetchHint,
  deriveApprovalOutcomeType,
  computeCritiqueSeamOverlap,
  shouldTriggerSeamExpansion,
  computeAverageApprovalScore,
  shouldSkipRevisionRound,
  shouldSkipDevilsAdvocate,
  shouldDowngradeDevilsAdvocateError,
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
  isQuotaExhaustedError,
  hasContextPackSection,
  detectProjectControlSurface,
  buildMissingContextWarningState,
  getRecommendedOutputTokensForStage,
  computeAgentPhaseRiskForecast,
  buildForecastCalibration,
  loadRecentOperationalSignalRuns,
  buildEffectiveRuntimeSummaryLines,
  buildTreeTruncationWarningLines,
  buildPhaseRiskForecastLines,
} = require('../generate-context');

function mockResponse({ ok = true, status = 200, statusText = 'OK', json = {}, text = '', headers = {} } = {}) {
  const headerEntries = Object.entries(headers);
  return {
    ok,
    status,
    statusText,
    headers: {
      entries() {
        return headerEntries[Symbol.iterator]();
      },
      forEach(callback) {
        headerEntries.forEach(([key, value]) => callback(value, key));
      },
    },
    async json() { return json; },
    async text() { return text; },
  };
}

test('callAgent returns structured metadata instead of plain text', async () => {
  const originalFetch = global.fetch;
  const content = `${'Structured contract test. '.repeat(8)}\n=== END OF DOCUMENT ===`;

  global.fetch = async () => mockResponse({
    ok: true,
    json: {
      model: 'gpt-5.4',
      choices: [{ message: { content }, finish_reason: 'length' }],
      usage: { prompt_tokens: 21, completion_tokens: 34 },
    },
  });

  try {
    const result = await callAgent(
      { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'developer' },
      'context bundle',
      'prompt text',
      'proposal',
    );

    assert.equal(result.text, content);
    assert.equal(result.meta.provider, 'openai');
    assert.equal(result.meta.stopReason, 'length');
    assert.equal(result.meta.inputTokens, 21);
    assert.equal(result.meta.outputTokens, 34);
  } finally {
    global.fetch = originalFetch;
  }
});

test('buildLatePhaseDiscussionSummary compacts long discussion logs for approval/revision handoff', () => {
  const discussion = [
    '## architect (Architect) [proposal]',
    'A'.repeat(900),
    '',
    '## reviewer (Reviewer) [critique]',
    'B'.repeat(900),
    '',
    '## developer (Developer) [approval-1]',
    'C'.repeat(900),
  ].join('\n');

  const compact = buildLatePhaseDiscussionSummary(discussion);

  assert.match(compact, /## reviewer \(Reviewer\) \[critique\]/);
  assert.match(compact, /## developer \(Developer\) \[approval-1\]/);
  assert.ok(Buffer.byteLength(compact, 'utf8') <= 9000);
  assert.ok(compact.length < discussion.length);
});

test('callAgent auto-raises max tokens for heavy critique turns', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  const content = `${'Heavy critique response. '.repeat(10)}\n=== END OF DOCUMENT ===`;

  global.fetch = async (_url, options = {}) => {
    requests.push(JSON.parse(options.body || '{}'));
    return mockResponse({
      ok: true,
      json: {
        model: 'gpt-5.4',
        choices: [{ message: { content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 9100, completion_tokens: 120 },
      },
    });
  };

  try {
    const result = await callAgent(
      {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-5.4',
        key: 'k',
        name: 'reviewer',
        maxOutputTokens: 1536,
      },
      'C'.repeat(36000),
      'prompt text',
      'critique',
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0].max_completion_tokens, 4096);
    assert.equal(result.meta.maxOutputTokens, 4096);
    assert.equal(result.meta.configuredMaxOutputTokens, 1536);
    assert.equal(result.meta.recommendedOutputTokens, 4096);
    assert.equal(result.meta.autoAdjustedMaxOutputTokens, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('callAgent does not waste retries on insufficient quota errors', async () => {
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async () => {
    calls += 1;
    return mockResponse({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: JSON.stringify({
        error: {
          message: 'You exceeded your current quota, please check your plan and billing details.',
          type: 'insufficient_quota',
          code: 'insufficient_quota',
        },
      }),
    });
  };

  try {
    await assert.rejects(
      callAgent(
        { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'developer' },
        'context bundle',
        'prompt text',
        'proposal',
      ),
      (error) => {
        assert.equal(error.provider, 'openai');
        assert.equal(error.quotaExhausted, true);
        return true;
      },
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('callAgentWithValidation returns structured result with completionStatus and validation metadata', async () => {
  const originalFetch = global.fetch;
  const content = `${'Validation contract test. '.repeat(8)}\n=== END OF DOCUMENT ===`;

  global.fetch = async () => mockResponse({
    ok: true,
    json: {
      model: 'gpt-5.4',
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 14, completion_tokens: 29 },
    },
  });

  try {
    const result = await callAgentWithValidation(
      { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'reviewer' },
      'context bundle',
      'prompt text',
      'critique',
    );

    assert.equal(result.text, content);
    assert.equal(result.completionStatus, 'complete');
    assert.equal(result.meta.provider, 'openai');
    assert.equal(result.meta.stopReason, 'stop');
    assert.deepEqual(result.meta.validation.errors, []);
  } finally {
    global.fetch = originalFetch;
  }
});

test('isQuotaExhaustedError recognizes provider quota fingerprints', () => {
  assert.equal(isQuotaExhaustedError({
    quotaExhausted: true,
  }), true);
  assert.equal(isQuotaExhaustedError({
    message: 'Openai API error (429): insufficient_quota',
  }), true);
  assert.equal(isQuotaExhaustedError({
    responseBody: '{"error":{"message":"credit balance is too low"}}',
  }), true);
  assert.equal(isQuotaExhaustedError({
    message: 'rate_limit_error',
  }), false);
  assert.equal(isQuotaExhaustedError({
    requestTimedOut: true,
    code: 'PROVIDER_REQUEST_TIMEOUT',
    message: 'Request timed out after 15000ms',
  }), false);
});

test('callAgentWithValidation can disable tool instruction for no-tools phases', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  const content = `${'Validation contract test. '.repeat(8)}\n=== END OF DOCUMENT ===`;

  global.fetch = async (_url, options = {}) => {
    requests.push(JSON.parse(options.body || '{}'));
    return mockResponse({
      ok: true,
      json: {
        model: 'gpt-5.4',
        choices: [{ message: { content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 14, completion_tokens: 29 },
      },
    });
  };

  try {
    await callAgentWithValidation(
      { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'prompt-engineer' },
      'context bundle',
      'prompt text',
      'pre-process',
      { allowTools: false },
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0].messages[1].content, 'prompt text');
    assert.doesNotMatch(requests[0].messages[1].content, /READ_FILE/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('callAgentWithValidation forwards explicit initialMessages for structured repair flows', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  const content = '{"score":8,"notes":"ok"}\n=== END OF DOCUMENT ===';

  global.fetch = async (_url, options = {}) => {
    requests.push(JSON.parse(options.body || '{}'));
    return mockResponse({
      ok: true,
      json: {
        model: 'gpt-5.4',
        choices: [{ message: { content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 18, completion_tokens: 16 },
      },
    });
  };

  try {
    await callAgentWithValidation(
      { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'reviewer' },
      'context bundle',
      'prompt text',
      'approval-1-repair',
      {
        responseFormat: 'json',
        allowTools: false,
        initialMessages: [
          { role: 'user', content: 'original approval request' },
          { role: 'assistant', content: 'bad markdown reply' },
          { role: 'user', content: 'rewrite as json only' },
        ],
      },
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0].messages[1].content, 'original approval request');
    assert.equal(requests[0].messages[2].content, 'bad markdown reply');
    assert.equal(requests[0].messages[3].content, 'rewrite as json only');
  } finally {
    global.fetch = originalFetch;
  }
});

test('callAgentWithValidation marks missing marker + truncation stop reason as truncated', async () => {
  const originalFetch = global.fetch;
  const content = 'This response is long enough to validate but ends without the required marker and stops mid explanation';

  global.fetch = async () => mockResponse({
    ok: true,
    json: {
      model: 'gpt-5.4',
      choices: [{ message: { content }, finish_reason: 'length' }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    },
  });

  try {
    const result = await callAgentWithValidation(
      { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'architect' },
      'context bundle',
      'prompt text',
      'proposal',
    );

    assert.equal(result.completionStatus, 'truncated');
    assert.equal(result.meta.completion.providerIndicatesTruncation, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('callAgentWithValidation performs one bounded repair pass for truncated text output', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  const firstText = 'Implemented the fix in src/app.ts:42 but the final explanation stops before the end marker';
  const repairTail = ' and now finishes cleanly.\n=== END OF DOCUMENT ===';

  global.fetch = async (_url, options = {}) => {
    requests.push(JSON.parse(options.body || '{}'));
    if (requests.length === 1) {
      return mockResponse({
        ok: true,
        json: {
          model: 'gpt-5.4',
          choices: [{ message: { content: firstText }, finish_reason: 'length' }],
          usage: { prompt_tokens: 12, completion_tokens: 18 },
        },
      });
    }

    return mockResponse({
      ok: true,
      json: {
        model: 'gpt-5.4',
        choices: [{ message: { content: repairTail }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 7, completion_tokens: 11 },
      },
    });
  };

  try {
    const result = await callAgentWithValidation(
      { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5.4', key: 'k', name: 'architect', maxOutputTokens: 1536 },
      'context bundle',
      'prompt text',
      'proposal',
    );

    assert.equal(requests.length, 2);
    assert.equal(result.completionStatus, 'complete');
    assert.match(result.text, /finishes cleanly\.\n=== END OF DOCUMENT ===$/);
    assert.equal(result.meta.repaired, true);
    assert.equal(result.meta.repairBudgetTokens, 1800);
    assert.equal(result.meta.originalCompletion, 'truncated');

    const repairMessages = requests[1].messages;
    assert.equal(repairMessages[1].content, 'prompt text');
    assert.equal(repairMessages[2].role, 'assistant');
    assert.equal(repairMessages[2].content, firstText);
    assert.match(repairMessages[3].content, /Continue from the exact point/);
    assert.doesNotMatch(repairMessages[3].content, /READ_FILE/);
    assert.equal(requests[1].max_completion_tokens, 1800);
  } finally {
    global.fetch = originalFetch;
  }
});

test('normalizeApprovalReview keeps valid JSON approvals complete', () => {
  const result = normalizeApprovalReview({
    text: '{"score":8,"notes":"Looks good","missingSeams":[{"symbolOrSeam":"processPrimaryFlow(...)","reasonNeeded":"Need body"}]}\n=== END OF DOCUMENT ===',
    completionStatus: 'complete',
  });

  assert.equal(result.completionStatus, 'complete');
  assert.deepEqual(result.approval, {
    success: true,
    score: 8,
    agreed: true,
    notes: 'Looks good',
    missingSeams: [
      {
        symbolOrSeam: 'processPrimaryFlow',
        reasonNeeded: 'Need body',
        expectedImpact: '',
        fetchHint: '',
      },
    ],
  });
});

test('normalizeApprovalReview downgrades non-JSON complete approval to invalid', () => {
  const result = normalizeApprovalReview({
    text: 'AGREE',
    completionStatus: 'complete',
  });

  assert.equal(result.completionStatus, 'invalid');
  assert.equal(result.approval.success, false);
  assert.equal(result.approval.agreed, false);
  assert.match(result.approval.notes, /AGREE/);
  assert.deepEqual(result.approval.missingSeams, []);
});

test('sanitizeTaskId keeps stable filesystem-safe identifiers', () => {
  assert.equal(sanitizeTaskId('DOC/42: Duplicate rows?'), 'DOC-42-Duplicate-rows');
  assert.equal(sanitizeTaskId('   '), '');
});

test('buildTaskDiscussionDir nests runs under task discussion root', () => {
  const result = buildTaskDiscussionDir('/tmp/discussions', 'DOC-42', 'run-123');
  assert.equal(result, '/tmp/discussions/DOC-42/run-123');
});

test('resolveTaskId falls back to prompt hash without manual prefix', () => {
  const result = resolveTaskId('Investigate duplicate rows in DB');
  assert.match(result, /^[a-f0-9]{12}$/);
});

test('buildResultFileContent adds discussion link and warning notes ahead of final text', () => {
  const content = buildResultFileContent('Final answer', {
    extraNote: 'Revised after review',
    resultMode: 'DIAGNOSTIC',
    warningPath: '.ai/prompts/result-warning.txt',
    promptScopeWarningPath: '.ai/prompts/runs/run-123/prompt-scope-warning.txt',
    discussionPath: '.ai/prompts/discussions/DOC-42/run-123',
  });

  assert.match(content, /RESULT_MODE: DIAGNOSTIC/);
  assert.match(content, /COPYPASTE_READY: NO/);
  assert.match(content, /NOTE: This result is not guaranteed copy-paste-safe\./);
  assert.match(content, /NOTE: Revised after review/);
  assert.match(content, /NOTE: See \.ai\/prompts\/result-warning\.txt for disagreement details\./);
  assert.match(content, /NOTE: Prompt scope may have constrained retrieval\. See \.ai\/prompts\/runs\/run-123\/prompt-scope-warning\.txt\./);
  assert.match(content, /DISCUSSION: See \.ai\/prompts\/discussions\/DOC-42\/run-123/);
  assert.match(content, /Final answer\n$/);
});

test('buildPatchSafeResultContent emits strict grounded-fixes artifact', () => {
  const content = buildPatchSafeResultContent(`
## Grounded Fixes
- Keep turn validation on current step only.
Evidence: src/main/java/example/ExampleService.java:10
\`\`\`java
Utils.getCurrentUserPltId();
\`\`\`

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Run approval regression tests.
`, {
    sourceResultPath: '.ai/prompts/result.txt',
    discussionPath: '.ai/prompts/discussions/DOC-42/run-123',
  });

  assert.match(content, /^# Patch-Safe Result/m);
  assert.match(content, /RESULT_MODE: PATCH_SAFE/);
  assert.match(content, /COPYPASTE_READY: YES/);
  assert.match(content, /SOURCE_RESULT: \.ai\/prompts\/result\.txt/);
  assert.match(content, /DISCUSSION: \.ai\/prompts\/discussions\/DOC-42\/run-123/);
  assert.match(content, /## Grounded Fixes/);
  assert.doesNotMatch(content, /## Assumptions \/ Unverified Seams/);
  assert.doesNotMatch(content, /## Assumed Implementation/);
  assert.match(content, /## Deferred Checks/);
});

test('buildResultWarningFileContent marks diagnostic output as manual-review-only', () => {
  const content = buildResultWarningFileContent({
    resultMode: 'DIAGNOSTIC',
    primaryFailureClass: 'seam-confirmation-failure',
    failureClasses: ['seam-confirmation-failure', 'role-evidence-divergence'],
    failureSummary: 'Grounded fixes still rely on seams that were not directly confirmed by fetched evidence.',
    disagreementNotes: ['- Reviewer disagreed on edge-case handling'],
    contractWarnings: ['Missing required section: `## Grounded Fixes`.'],
    validationWarnings: ['Grounded fix references unconfirmed method seam: `authService.getCurrentUserId`.'],
  });

  assert.match(content, /WARNING: Generated output is not guaranteed copy-paste-safe\./);
  assert.match(content, /RESULT_MODE: DIAGNOSTIC/);
  assert.match(content, /MANUAL_REVIEW_REQUIRED: YES/);
  assert.match(content, /PRIMARY_FAILURE_CLASS: seam-confirmation-failure/);
  assert.match(content, /FAILURE_CLASSES: seam-confirmation-failure, role-evidence-divergence/);
  assert.match(content, /PATCH_SAFE_CONTRACT_GAP_COUNT: 1/);
  assert.match(content, /PATCH_SAFE_GROUNDING_GAP_COUNT: 1/);
  assert.match(content, /PATCH_SAFE_CONTRACT_GAP_CATEGORIES: missing-section/);
  assert.match(content, /PATCH_SAFE_GROUNDING_GAP_CATEGORIES: unconfirmed-seam/);
  assert.match(content, /Reviewer disagreed on edge-case handling/);
  assert.match(content, /Failure summary: Grounded fixes still rely on seams that were not directly confirmed by fetched evidence\./);
  assert.match(content, /Patch-safe contract gaps:/);
  assert.match(content, /Missing required section: `## Grounded Fixes`\./);
  assert.match(content, /Patch-safe validation gaps:/);
  assert.match(content, /authService\.getCurrentUserId/);
});

test('buildPromptScopeWarningFileContent explains narrow starting seams and optional broadened prompt', () => {
  const content = buildPromptScopeWarningFileContent({
    risk: 'narrow-starting-seams',
    notes: ['Prompt pins only ExampleService#handleRequest as the main code seam.'],
    suggestedPromptPath: '.ai/prompts/runs/run-123/suggested-broadened-prompt.txt',
  });

  assert.match(content, /# Prompt Scope Warning/);
  assert.match(content, /SCOPE_RISK: narrow-starting-seams/);
  assert.match(content, /MANUAL_REVIEW_RECOMMENDED: YES/);
  assert.match(content, /may bias retrieval toward a too-local slice/);
  assert.match(content, /Prompt pins only ExampleService#handleRequest/);
  assert.match(content, /Suggested broadened prompt: \.ai\/prompts\/runs\/run-123\/suggested-broadened-prompt\.txt/);
  assert.match(content, /Use the broader prompt only with user approval/);
});

test('analyzeEvidenceGroundedResultStructure recognizes required sections and evidence anchors', () => {
  const analysis = analyzeEvidenceGroundedResultStructure(`
## Grounded Fixes
- Fix queue advancement for same-step approvals.
Evidence: src/main/java/example/ExampleService.java:10
\`\`\`java
// patch
\`\`\`

## Assumptions / Unverified Seams
- Repository method name may differ in this project.

## Deferred Checks
- Run approval regression tests.
`);

  assert.equal(analysis.structureComplete, true);
  assert.equal(analysis.contractWarnings.length, 0);
  assert.equal(analysis.groundedHasEvidence, true);
  assert.equal(analysis.groundedHasCode, true);
  assert.equal(analysis.hasAssumedImplementation, false);
});

test('analyzeEvidenceGroundedResultStructure parses Assumed Implementation section', () => {
  const analysis = analyzeEvidenceGroundedResultStructure(`
## Grounded Fixes
- Fix queue advancement.
Evidence: src/main/java/example/ExampleService.java:10
\`\`\`java
// patch
\`\`\`

## Assumptions / Unverified Seams
- authService API shape is assumed.

## Assumed Implementation
Assumption: authService.getCurrentUserId() method signature unverified.
\`\`\`java
String userId = authService.getCurrentUserId();
\`\`\`

## Deferred Checks
- Run approval regression tests.
`);

  assert.equal(analysis.structureComplete, true);
  assert.equal(analysis.hasAssumedImplementation, true);
  assert.ok(analysis.assumedImplementationBody.includes('authService.getCurrentUserId()'));
});

test('analyzeEvidenceGroundedResultStructure accepts markdown-styled evidence labels', () => {
  const analysis = analyzeEvidenceGroundedResultStructure(`
## Grounded Fixes
- Fix queue advancement for same-step approvals.
**Evidence:** \`src/main/java/example/ExampleService.java:10\`
\`\`\`java
approvalQueueService.advanceQueue();
\`\`\`

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Run approval regression tests.
`);

  assert.equal(analysis.structureComplete, true);
  assert.equal(analysis.contractWarnings.length, 0);
  assert.equal(analysis.groundedHasEvidence, true);
});

test('analyzeEvidenceGroundedResultStructure flags missing evidence and missing sections', () => {
  const analysis = analyzeEvidenceGroundedResultStructure(`
## Grounded Fixes
\`\`\`java
// speculative patch
\`\`\`
`);

  assert.equal(analysis.structureComplete, false);
  assert.match(analysis.contractWarnings.join('\n'), /Assumptions \/ Unverified Seams/);
  assert.match(analysis.contractWarnings.join('\n'), /Deferred Checks/);
  assert.match(analysis.contractWarnings.join('\n'), /without explicit `Evidence:` anchors/);
});

test('analyzeEvidenceGroundedResultStructure flags implementation guidance without code blocks', () => {
  const analysis = analyzeEvidenceGroundedResultStructure(`
## Grounded Fixes
- Add a new endpoint and service method for partial cancellation.
Evidence: src/main/java/example/MtfOrderController.java:10

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Run regression tests.
`);

  assert.equal(analysis.structureComplete, false);
  assert.match(analysis.contractWarnings.join('\n'), /without concrete code blocks or diff snippets/);
});

test('extractEvidenceAnchors keeps only the primary file anchor from each evidence line', () => {
  const anchors = extractEvidenceAnchors(`
- Keep turn validation on current step only.
Evidence: src/main/java/example/ExampleService.java:10, src/main/java/example/ApprovalInstance.java:44
`);

  assert.deepEqual(anchors, ['src/main/java/example/ExampleService.java']);
});

test('extractEvidenceAnchors keeps only the primary markdown-styled file anchor', () => {
  const anchors = extractEvidenceAnchors(`
- Keep turn validation on current step only.
**Evidence:** \`src/main/java/example/ExampleService.java:10\`, \`src/main/java/example/ApprovalInstance.java:44\`
`);

  assert.deepEqual(anchors, ['src/main/java/example/ExampleService.java']);
});

test('extractEvidenceAnchors ignores parenthetical code expressions after valid anchors', () => {
  const anchors = extractEvidenceAnchors(`
- Keep orthogonality guard local.
Evidence: \`app/board/[boardId]/_components/canvas/canvas.tsx:520-526\` (before \`const hit = segments.some(...)\`)
`);

  assert.deepEqual(anchors, [
    'app/board/[boardId]/_components/canvas/canvas.tsx',
  ]);
});

test('buildEvidenceGroundingValidation accepts grounded seams backed by observed files and indexed symbols', () => {
  const validation = buildEvidenceGroundingValidation(`
## Grounded Fixes
- Guard current turn before approve.
Evidence: src/main/java/example/ExampleService.java:10
\`\`\`java
Utils.getCurrentUserPltId();
new ApprovalTypeEntity();
\`\`\`

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Run regression tests.
`, {
    observedFiles: ['src/main/java/example/ExampleService.java'],
    codeIndex: {
      byFile: {
        'src/main/java/example/ExampleService.java': { symbols: [] },
      },
      symbols: [
        { name: 'getCurrentUserPltId' },
        { name: 'ApprovalTypeEntity' },
      ],
    },
  });

  assert.deepEqual(validation.evidenceAnchors, ['src/main/java/example/ExampleService.java']);
  assert.equal(validation.validationWarnings.length, 0);
  assert.equal(validation.patchSafeEligible, true);
});

test('buildEvidenceGroundingValidation flags speculative seams and substantive assumptions', () => {
  const validation = buildEvidenceGroundingValidation(`
## Grounded Fixes
- Rewire approval step ownership.
Evidence: src/main/java/example/ExampleService.java:10
\`\`\`java
authService.getCurrentUserId();
\`\`\`

## Assumptions / Unverified Seams
- authService may expose getCurrentUserId() in this project.

## Deferred Checks
- Compile and run approval tests.
`, {
    observedFiles: ['src/main/java/example/ExampleService.java'],
    codeIndex: {
      byFile: {
        'src/main/java/example/ExampleService.java': { symbols: [] },
      },
      symbols: [
        { name: 'getCurrentUserPltId' },
      ],
    },
  });

  assert.match(validation.validationWarnings.join('\n'), /authService\.getCurrentUserId/);
  assert.match(validation.validationWarnings.join('\n'), /Assumptions \/ Unverified Seams/);
  assert.equal(validation.patchSafeEligible, false);
});

test('buildEvidenceGroundingValidation ignores dotted constants that are not file anchors', () => {
  const validation = buildEvidenceGroundingValidation(`
## Grounded Fixes
- Reuse existing exception keys only.
Evidence: src/main/java/example/ExampleService.java:10, error.template.not.found, error.document.org.not.found

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Verify localized message bundles separately.
`, {
    observedFiles: ['src/main/java/example/ExampleService.java'],
    codeIndex: {
      byFile: {
        'src/main/java/example/ExampleService.java': { symbols: [] },
      },
      symbols: [],
    },
  });

  assert.deepEqual(validation.evidenceAnchors, ['src/main/java/example/ExampleService.java']);
  assert.equal(
    validation.validationWarnings.some((warning) => warning.includes('error.template.not.found')),
    false,
  );
  assert.equal(
    validation.validationWarnings.some((warning) => warning.includes('error.document.org.not.found')),
    false,
  );
});

test('buildEvidenceGroundingValidation ignores code-like parenthetical annotations after valid evidence anchors', () => {
  const validation = buildEvidenceGroundingValidation(`
## Grounded Fixes
- Keep the guard local to the confirmed branch.
Evidence: \`app/board/[boardId]/_components/canvas/canvas.tsx:520-526\` (before \`const hit = segments.some(...)\`)
\`\`\`ts
const lostOrthogonality = allPts.some(Boolean);
\`\`\`

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Re-run the locked Manhattan drag scenario.
`, {
    observedFiles: ['app/board/[boardId]/_components/canvas/canvas.tsx'],
    codeIndex: {
      byFile: {
        'app/board/[boardId]/_components/canvas/canvas.tsx': { symbols: [] },
      },
      symbols: [],
    },
  });

  assert.deepEqual(validation.evidenceAnchors, [
    'app/board/[boardId]/_components/canvas/canvas.tsx',
  ]);
  assert.equal(
    validation.validationWarnings.some((warning) => warning.includes('segments.some')),
    false,
  );
});

test('buildEvidenceGroundingValidation ignores bare dotted expressions after a valid anchor', () => {
  const validation = buildEvidenceGroundingValidation(`
## Grounded Fixes
- Keep the branch-local guard where the hit is computed.
Evidence: canvas.tsx:520-526, segments.some, hit
\`\`\`ts
const hit = segments.some((segment) => segment.length > 0);
\`\`\`

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Re-run the locked Manhattan drag scenario.
`, {
    observedFiles: ['canvas.tsx'],
    codeIndex: {
      byFile: {
        'canvas.tsx': { symbols: [] },
      },
      symbols: [],
    },
  });

  assert.deepEqual(validation.evidenceAnchors, ['canvas.tsx']);
  assert.equal(
    validation.validationWarnings.some((warning) => warning.includes('segments.some')),
    false,
  );
});

test('assessFinalResultTrust upgrades to patch-safe only when evidence gate passes', () => {
  const trust = assessFinalResultTrust(`
## Grounded Fixes
- Guard current turn before approve.
Evidence: src/main/java/example/ExampleService.java:10
\`\`\`java
Utils.getCurrentUserPltId();
\`\`\`

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Run regression tests.
`, {
    allAgreed: true,
    observedFiles: ['src/main/java/example/ExampleService.java'],
    codeIndex: {
      byFile: {
        'src/main/java/example/ExampleService.java': { symbols: [] },
      },
      symbols: [
        { name: 'getCurrentUserPltId' },
      ],
    },
  });

  assert.equal(trust.resultMode, 'PATCH_SAFE');
  assert.equal(trust.warningRequired, false);
});

test('assessFinalResultTrust keeps prose-only implementation advice diagnostic even with evidence anchors', () => {
  const trust = assessFinalResultTrust(`
## Grounded Fixes
- Add a new endpoint and service method for partial cancellation.
Evidence: src/main/java/example/MtfOrderController.java:10

## Assumptions / Unverified Seams
- None.

## Deferred Checks
- Run regression tests.
`, {
    allAgreed: true,
    observedFiles: ['src/main/java/example/MtfOrderController.java'],
    codeIndex: {
      byFile: {
        'src/main/java/example/MtfOrderController.java': { symbols: [] },
      },
      symbols: [],
    },
  });

  assert.equal(trust.resultMode, 'DIAGNOSTIC');
  assert.match(trust.groundedAnalysis.contractWarnings.join('\n'), /without concrete code blocks or diff snippets/);
});

test('buildFinalTrustSignal summarizes trust gaps into structured telemetry', () => {
  const signal = buildFinalTrustSignal({
    resultMode: 'DIAGNOSTIC',
    warningRequired: true,
    groundedAnalysis: {
      contractWarnings: [
        'Missing required section: `## Grounded Fixes`.',
        '`## Grounded Fixes` contains implementation guidance without explicit `Evidence:` anchors.',
      ],
    },
    groundingValidation: {
      patchSafeEligible: false,
      validationWarnings: [
        'Evidence anchor was not observed in the current run context: `src/main/java/example/ExampleService.java`.',
        '`## Assumptions / Unverified Seams` contains substantive items; patch-safe mode denied.',
      ],
      evidenceAnchors: ['src/main/java/example/ExampleService.java'],
      observedFiles: ['src/main/java/example/OtherFile.java'],
      candidateSeams: [{ kind: 'method', token: 'authService.getCurrentUserId' }],
      hasSubstantiveAssumptions: true,
    },
  }, {
    allAgreed: true,
    approvalOutputs: [
      { approval: { agreed: true, score: 9 } },
      { approval: { agreed: false, score: 3 } },
    ],
    operationalSignals: {},
  });

  assert.equal(signal.resultMode, 'DIAGNOSTIC');
  assert.equal(signal.copyPasteReady, false);
  assert.equal(signal.contractGapCount, 2);
  assert.equal(signal.groundingGapCount, 2);
  assert.deepEqual(signal.contractGapCategories, ['missing-evidence-anchor', 'missing-section']);
  assert.deepEqual(signal.groundingGapCategories, ['substantive-assumptions', 'unobserved-file-anchor']);
  assert.equal(signal.evidenceAnchorCount, 1);
  assert.equal(signal.observedFileCount, 1);
  assert.equal(signal.candidateSeamCount, 1);
  assert.equal(signal.hasSubstantiveAssumptions, true);
  assert.equal(signal.primaryFailureClass, 'anchor-coverage-failure');
  assert.deepEqual(signal.failureClasses, ['anchor-coverage-failure', 'seam-confirmation-failure', 'role-evidence-divergence']);
});

test('buildFinalTrustSignal ignores approval-derived divergence when approval snapshot is stale', () => {
  const signal = buildFinalTrustSignal({
    resultMode: 'DIAGNOSTIC',
    warningRequired: true,
    groundedAnalysis: {
      contractWarnings: [],
    },
    groundingValidation: {
      patchSafeEligible: false,
      validationWarnings: [
        '`## Assumptions / Unverified Seams` contains substantive items; patch-safe mode denied.',
      ],
      evidenceAnchors: ['app/file.ts:10'],
      observedFiles: ['app/file.ts'],
      candidateSeams: [],
      hasSubstantiveAssumptions: true,
    },
  }, {
    allAgreed: false,
    approvalOutputs: [
      { approval: { agreed: true, score: 8 } },
      { approval: { agreed: false, score: 4 } },
    ],
    approvalSnapshotFresh: false,
    operationalSignals: {},
  });

  assert.equal(signal.approvalSnapshotFresh, false);
  assert.equal(signal.primaryFailureClass, 'other');
  assert.deepEqual(signal.failureClasses, []);
});

test('parseRuntimeOverridesDocument accepts safe live overrides', () => {
  const parsed = parseRuntimeOverridesDocument({
    version: 1,
    agents: {
      reviewer: {
        maxOutputTokens: 12000,
      },
    },
    pauseBeforePhases: {
      consensus: 15,
    },
  });

  assert.equal(parsed.version, 1);
  assert.equal(parsed.safe.agents.reviewer.maxOutputTokens, 12000);
  assert.equal(parsed.safe.pauseBeforePhases.consensus, 15);
  assert.deepEqual(parsed.restartRequired, []);
  assert.deepEqual(parsed.ignored, []);
});

test('parseRuntimeOverridesDocument normalizes test aliases to post-process', () => {
  const parsed = parseRuntimeOverridesDocument({
    pauseBeforePhases: {
      test: 20,
      tester: 10,
    },
  });

  assert.equal(parsed.safe.pauseBeforePhases['post-process'], 10);
  assert.deepEqual(parsed.ignored, []);
});

test('parseRuntimeOverridesDocument classifies restart-required keys', () => {
  const parsed = parseRuntimeOverridesDocument({
    phaseToggles: {
      postprocess: false,
    },
    agents: {
      reviewer: {
        contextBudget: 9999,
      },
    },
  });

  assert.deepEqual(parsed.restartRequired.sort(), [
    'agents.reviewer.contextBudget',
    'phaseToggles',
  ]);
});

test('loadReusablePreprocessResult reuses archived preprocess output for the same prompt hash', () => {
  const aiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preprocess-reuse-'));
  const archivedDir = path.join(aiDir, 'prompts', 'runs', 'run-older');
  fs.mkdirSync(archivedDir, { recursive: true });
  const outputPath = path.join(archivedDir, 'prompt-engineer-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    analysis: 'Reuse me.',
    enhancedPrompt: 'Enhanced prompt',
    complexity: 'trivial',
  }, null, 2));
  fs.writeFileSync(path.join(archivedDir, 'run-flow.json'), JSON.stringify({
    version: 1,
    runId: 'run-older',
    prompt: 'same prompt',
    promptHash: '66fddd00ccb8',
    phases: {
      preprocess: {
        status: 'done',
        outputFile: outputPath,
        agent: 'prompt-engineer',
      },
    },
  }, null, 2));

  const reused = loadReusablePreprocessResult({
    aiDataDir: aiDir,
    promptText: 'same prompt',
    currentRunId: 'run-current',
  });

  assert.equal(reused.runId, 'run-older');
  assert.equal(reused.agent, 'prompt-engineer');
  assert.equal(reused.promptEngineerResult.enhancedPrompt, 'Enhanced prompt');
  assert.equal(reused.promptEngineerResult.complexity, 'trivial');
});

test('loadReusablePreprocessResult ignores the active run and mismatched prompts', () => {
  const aiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preprocess-reuse-active-'));
  const runDir = path.join(aiDir, 'prompts', 'run');
  fs.mkdirSync(runDir, { recursive: true });
  const outputPath = path.join(runDir, 'prompt-engineer-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({ enhancedPrompt: 'Enhanced prompt' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'run-flow.json'), JSON.stringify({
    version: 1,
    runId: 'run-current',
    prompt: 'same prompt',
    promptHash: '66fddd00ccb8',
    phases: {
      preprocess: {
        status: 'done',
        outputFile: outputPath,
        agent: 'prompt-engineer',
      },
    },
  }, null, 2));

  assert.equal(loadReusablePreprocessResult({
    aiDataDir: aiDir,
    promptText: 'same prompt',
    currentRunId: 'run-current',
  }), null);
  assert.equal(loadReusablePreprocessResult({
    aiDataDir: aiDir,
    promptText: 'different prompt',
    currentRunId: 'run-next',
  }), null);
});

test('getMaxOutputTokens prefers safe runtime override over agent default budget', () => {
  const result = getMaxOutputTokens(
    {
      name: 'reviewer',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',
      maxOutputTokens: 4096,
    },
    {
      agents: {
        reviewer: {
          maxOutputTokens: 12000,
        },
      },
    },
  );

  assert.equal(result, 12000);
});

test('getAutoMaxOutputTokensSettings defaults to enabled with provider ceiling', () => {
  const settings = getAutoMaxOutputTokensSettings({
    name: 'reviewer',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-5.4',
  });

  assert.equal(settings.enabled, true);
  assert.equal(settings.ceilingTokens, 8192);
  assert.equal(settings.minGainTokens, 256);
});

test('resolveEffectiveMaxOutputTokens auto-raises heavy critique budget within ceiling', () => {
  const result = resolveEffectiveMaxOutputTokens({
    agent: {
      name: 'reviewer',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-5.4',
      maxOutputTokens: 1536,
    },
    stage: 'critique',
    estimatedInputTokens: 9000,
  });

  assert.equal(result.stage, 'critique');
  assert.equal(result.adjusted, true);
  assert.equal(result.source, 'auto');
  assert.equal(result.configuredTokens, 1536);
  assert.equal(result.recommendedTokens, 4096);
  assert.equal(result.effectiveTokens, 4096);
});

test('resolveEffectiveMaxOutputTokens respects runtime override instead of auto-adjust', () => {
  const result = resolveEffectiveMaxOutputTokens({
    agent: {
      name: 'reviewer',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-5.4',
      maxOutputTokens: 1536,
    },
    stage: 'critique',
    estimatedInputTokens: 15000,
    safeOverrides: {
      agents: {
        reviewer: {
          maxOutputTokens: 12000,
        },
      },
    },
  });

  assert.equal(result.adjusted, false);
  assert.equal(result.source, 'runtime-override');
  assert.equal(result.effectiveTokens, 12000);
  assert.equal(result.configuredTokens, 12000);
});

test('getRecommendedOutputTokensForStage escalates for heavy proposal and critique phases', () => {
  assert.equal(getRecommendedOutputTokensForStage('proposal', 5000), 1800);
  assert.equal(getRecommendedOutputTokensForStage('proposal', 11000), 6144);
  assert.equal(getRecommendedOutputTokensForStage('proposal', 15000), 8192);
  assert.equal(getRecommendedOutputTokensForStage('critique', 9000), 4096);
  assert.equal(getRecommendedOutputTokensForStage('critique', 15000), 8192);
  assert.equal(getRecommendedOutputTokensForStage('critique-retry', 9000), 4096);
  assert.equal(getRecommendedOutputTokensForStage('proposal-tool-budget-final', 11000), 6144);
  assert.equal(getRecommendedOutputTokensForStage('consensus', 5000), 1800);
  assert.equal(getRecommendedOutputTokensForStage('consensus', 11000), 4096);
  assert.equal(getRecommendedOutputTokensForStage('consensus', 15000), 6144);
  assert.equal(getRecommendedOutputTokensForStage('consensus', 23000), 8192);
  assert.equal(getRecommendedOutputTokensForStage('revision', 15000), 6144);
  assert.equal(getRecommendedOutputTokensForStage('da-revision', 23000), 8192);
  assert.equal(getRecommendedOutputTokensForStage('approval', 15000), 384);
  assert.equal(getRecommendedOutputTokensForStage('approval-2', 15000), 384);
});

test('getRepairMaxOutputTokens keeps repair bounded but large enough for code-heavy continuations', () => {
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 1536 }), 1536);
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 4096 }), 3072);
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 8192 }), 3072);
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 120 }), 256);
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 4096 }, 'consensus'), 4096);
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 8192 }, 'consensus'), 6144);
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 4096 }, 'revision', { maxOutputTokens: 6144 }), 6144);
  assert.equal(getRepairMaxOutputTokens({ maxOutputTokens: 8192 }, 'critique', { maxOutputTokens: 8192 }), 3072);
});

test('approval routing helpers keep existing schema and gate seam expansion by structured fetch hints', () => {
  assert.equal(hasStructuredFetchHint({ fetchHint: 'src/main/java/example/OrderService.java:10-40' }), true);
  assert.equal(hasStructuredFetchHint({ fetchHint: '  ' }), false);

  assert.equal(deriveApprovalOutcomeType({ agreed: true, missingSeams: [] }), 'approved');
  assert.equal(deriveApprovalOutcomeType({ agreed: false, missingSeams: [] }), 'revise-text');
  assert.equal(deriveApprovalOutcomeType({
    agreed: false,
    missingSeams: [{ symbolOrSeam: 'OrderService#cancel', fetchHint: 'src/main/java/example/OrderService.java:10-40' }],
  }), 'fetch-evidence');
  assert.deepEqual(
    shouldSkipRevisionRound({
      approvalOutputs: [
        {
          approval: {
            agreed: false,
            notes: 'Need OrderService#cancel body before patch-safe approval.',
            missingSeams: [
              {
                symbolOrSeam: 'OrderService#cancel',
                fetchHint: 'src/main/java/example/OrderService.java:10-40',
              },
            ],
          },
        },
        {
          approval: {
            agreed: false,
            notes: 'Keep the assumption explicit until the seam is read.',
            missingSeams: [],
          },
        },
      ],
    }),
    {
      skip: true,
      reason: 'evidence-gap-with-editorial-notes',
      disagreementCount: 2,
      fetchEvidenceCount: 1,
      editorialOnlyCount: 1,
    },
  );
  assert.deepEqual(
    shouldSkipRevisionRound({
      approvalOutputs: [
        {
          approval: {
            agreed: false,
            notes: 'Grounded Fixes incorrectly claims the cancellation updates Order.status immediately.',
            missingSeams: [
              {
                symbolOrSeam: 'OrderService#cancel',
                fetchHint: 'src/main/java/example/OrderService.java:10-40',
              },
            ],
          },
        },
      ],
    }),
    {
      skip: false,
      reason: 'grounded-fix-error',
      disagreementCount: 1,
      fetchEvidenceCount: 0,
      editorialOnlyCount: 0,
    },
  );

  const trigger = shouldTriggerSeamExpansion({
    trust: {
      groundingGapCategories: ['substantive-assumptions'],
      groundingValidation: { hasSubstantiveAssumptions: true },
    },
    approvalOutputs: [
      {
        approval: {
          agreed: false,
          missingSeams: [
            {
              symbolOrSeam: 'OrderService#cancel',
              reasonNeeded: 'Need method body',
              expectedImpact: 'Retire seam',
              fetchHint: 'src/main/java/example/OrderService.java:10-40',
            },
          ],
        },
      },
    ],
  });
  assert.equal(trigger.trigger, true);

  const blocked = shouldTriggerSeamExpansion({
    trust: {
      groundingGapCategories: ['substantive-assumptions'],
      groundingValidation: { hasSubstantiveAssumptions: true },
    },
    approvalOutputs: [
      {
        approval: {
          agreed: false,
          missingSeams: [
            {
              symbolOrSeam: 'OrderService#cancel',
              reasonNeeded: 'Need method body',
              expectedImpact: 'Retire seam',
              fetchHint: '',
            },
          ],
        },
      },
    ],
  });
  assert.equal(blocked.trigger, false);
  assert.equal(blocked.reason, 'no-structured-fetch-hints');
});

test('round rationalization helpers classify critique overlap and downstream gates', () => {
  const overlap = computeCritiqueSeamOverlap(
    [
      'Need OrderService#cancel body and src/main/java/example/OrderService.java:10-40 before patch-safe approval.',
      'Another critique.',
    ],
    [
      { symbolOrSeam: 'OrderService#cancel', fetchHint: 'src/main/java/example/OrderService.java:10-40' },
      { symbolOrSeam: 'PaymentService#reserve', fetchHint: 'src/main/java/example/PaymentService.java:20-50' },
    ],
  );
  assert.equal(overlap.matched, 1);
  assert.equal(overlap.total, 2);
  assert.equal(overlap.percent, 50);
  assert.equal(computeAverageApprovalScore([
    { approval: { score: 10 } },
    { approval: { score: 8 } },
    { approval: { score: null } },
  ]), 9);
  assert.equal(computeAverageApprovalScore([{ approval: { score: null } }]), null);

  assert.deepEqual(
    shouldSkipDevilsAdvocate({
      trust: {
        resultMode: 'DIAGNOSTIC',
        groundingGapCategories: ['substantive-assumptions'],
        groundingValidation: { hasSubstantiveAssumptions: true },
      },
      remainingFetchableSeamCount: 0,
    }),
    {
      skip: true,
      reason: 'diagnostic-with-substantive-assumptions-and-no-fetchable-seams',
    },
  );
  assert.deepEqual(
    shouldSkipDevilsAdvocate({
      trust: {
        resultMode: 'PATCH_SAFE',
        groundingValidation: { patchSafeEligible: true },
      },
      allAgreed: true,
      avgApprovalScore: 9.3,
      remainingFetchableSeamCount: 2,
    }),
    {
      skip: true,
      reason: 'clean-patch-safe-high-approval-consensus',
    },
  );
  assert.deepEqual(
    shouldSkipDevilsAdvocate({
      trust: {
        resultMode: 'PATCH_SAFE',
        groundingValidation: { patchSafeEligible: false },
      },
      allAgreed: true,
      avgApprovalScore: 9.7,
      remainingFetchableSeamCount: 0,
    }),
    {
      skip: false,
      reason: '',
    },
  );

  assert.equal(resolveTesterMode({ groundingValidation: { patchSafeEligible: true } }), 'patch-validation');
  assert.equal(resolveTesterMode({ groundingValidation: { patchSafeEligible: false } }), 'diagnostic-review');
  assert.deepEqual(resolveTesterGate({ groundingValidation: { patchSafeEligible: true } }), {
    skip: false,
    mode: 'patch-validation',
    action: 'patch-validation',
    reason: 'patch-safe-eligible',
  });
  assert.deepEqual(resolveTesterGate({ groundingValidation: { patchSafeEligible: false } }), {
    skip: true,
    mode: 'diagnostic-review',
    action: 'skipped',
    reason: 'diagnostic-result',
  });
});

test('computeAgentPhaseRiskForecast flags output, ITPM, and tool-loop pressure from current runtime state', () => {
  const forecast = computeAgentPhaseRiskForecast({
    agent: {
      name: 'reviewer',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',
    },
    stage: 'critique',
    estimatedInputTokens: 15000,
    contextBudget: 22000,
    maxOutputTokens: 2048,
    rateLimitSnapshot: {
      inputTokens: {
        limit: 30000,
        remaining: 4000,
        resetAt: Date.now() + 20000,
      },
    },
    contextPackActive: true,
    treeTruncated: true,
    treeLimit: 120,
  });

  assert.equal(forecast.agentName, 'reviewer');
  assert.equal(forecast.overall, 'high');
  assert.equal(forecast.recommendedOutputTokens, 8192);
  assert.match(forecast.details.join(' | '), /MAX_TOKENS risk/);
  assert.match(forecast.details.join(' | '), /rate-limit wait likely/);
  assert.match(forecast.details.join(' | '), /tool-loop risk/);
});

test('buildForecastCalibration summarizes historical operational signals per agent/stage', () => {
  const calibration = buildForecastCalibration([
    {
      operationalSignals: {
        preflightWaits: {
          events: [
            { agent: 'reviewer', provider: 'google', stage: 'proposal', waitMs: 22000 },
          ],
        },
        retries: {
          events: [
            { agent: 'reviewer', provider: 'google', stage: 'proposal', isRateLimit: true },
          ],
        },
        repairs: {
          events: [
            { agent: 'reviewer', stage: 'proposal', outcome: 'failed' },
          ],
        },
        toolLoopExhaustions: {
          events: [
            { agent: 'reviewer', provider: 'google', stage: 'proposal' },
          ],
        },
        incompleteOutputs: {
          events: [
            { agent: 'reviewer', provider: 'google', stage: 'proposal', completionStatus: 'truncated' },
          ],
        },
      },
    },
    {
      operationalSignals: {
        preflightWaits: { events: [] },
        retries: { events: [] },
        repairs: { events: [] },
        toolLoopExhaustions: { events: [] },
        incompleteOutputs: { events: [] },
      },
    },
  ], {
    agentName: 'reviewer',
    provider: 'google',
    stage: 'proposal',
  });

  assert.equal(calibration.runsAnalyzed, 2);
  assert.equal(calibration.incompleteRuns, 1);
  assert.equal(calibration.retryRuns, 1);
  assert.equal(calibration.rateLimitRetryRuns, 1);
  assert.equal(calibration.toolLoopRuns, 1);
  assert.equal(calibration.repairFailureRuns, 1);
  assert.equal(calibration.preflightWaitRuns, 1);
  assert.equal(calibration.maxHistoricalWaitMs, 22000);
});

test('computeAgentPhaseRiskForecast includes calibrated historical risk signals', () => {
  const forecast = computeAgentPhaseRiskForecast({
    agent: {
      name: 'reviewer',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',
    },
    stage: 'proposal',
    estimatedInputTokens: 9000,
    contextBudget: 22000,
    maxOutputTokens: 4096,
    rateLimitSnapshot: null,
    contextPackActive: false,
    treeTruncated: false,
    treeLimit: 0,
    calibration: {
      runsAnalyzed: 3,
      incompleteRuns: 2,
      retryRuns: 1,
      rateLimitRetryRuns: 1,
      toolLoopRuns: 0,
      repairFailureRuns: 0,
      preflightWaitRuns: 1,
      maxHistoricalWaitMs: 18000,
    },
  });

  assert.equal(forecast.calibrationRunsAnalyzed, 3);
  assert.equal(forecast.overall, 'high');
  assert.match(forecast.details.join(' | '), /historical truncation/);
  assert.match(forecast.details.join(' | '), /historical rate-limit retries/);
});

test('buildPhaseRiskForecastLines renders compact console-oriented forecast summary', () => {
  const lines = buildPhaseRiskForecastLines({
    phaseLabel: 'Proposal',
    forecasts: [
      {
        agentName: 'architect',
        overall: 'high',
        calibrationRunsAnalyzed: 3,
        details: ['ITPM risk (Anthropic input ~16000 tokens)', 'tool-loop risk (tree capped at 120 files)'],
      },
      {
        agentName: 'developer',
        overall: 'low',
        calibrationRunsAnalyzed: 0,
        details: ['no elevated risk signals'],
      },
    ],
    treeTruncated: true,
    treeLimit: 120,
    packedTreeLimit: 120,
    contextPackActive: true,
  });

  assert.equal(lines[0], '🔮 Proposal risk forecast:');
  assert.match(lines[1], /calibrated with 3 recent runs/);
  assert.match(lines[2], /context tree: hard-capped at 120 files/);
  assert.match(lines[3], /architect: HIGH/);
  assert.match(lines[4], /developer: LOW/);
});

test('loadRecentOperationalSignalRuns reads recent run-flow snapshots from runs directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-signals-'));
  const runsDir = path.join(root, 'prompts', 'runs');
  fs.mkdirSync(runsDir, { recursive: true });

  const runA = path.join(runsDir, 'run-200');
  const runB = path.join(runsDir, 'run-100');
  fs.mkdirSync(runA, { recursive: true });
  fs.mkdirSync(runB, { recursive: true });

  fs.writeFileSync(path.join(runA, 'run-flow.json'), JSON.stringify({
    version: 1,
    runId: 'run-200',
    operationalSignals: { incompleteOutputs: { events: [] } },
  }));
  fs.writeFileSync(path.join(runB, 'run-flow.json'), JSON.stringify({
    version: 1,
    runId: 'run-100',
    operationalSignals: { incompleteOutputs: { events: [] } },
  }));

  const flows = loadRecentOperationalSignalRuns({
    runsDir,
    legacyArchiveDir: path.join(root, 'prompts', 'archive'),
  }, 2);

  assert.deepEqual(flows.map((flow) => flow.runId), ['run-200', 'run-100']);
});

test('operational signal helpers accumulate bounded post-run telemetry', () => {
  const state = createOperationalSignalsState();
  state.runId = 'run-123';
  state.taskId = 'TASK-1';
  state.status = 'in-progress';
  state.startedAt = '2026-03-13T04:00:00.000Z';
  state.runtime = {
    contextPackActive: true,
    treeTruncated: true,
    treeLimit: 120,
    structuralSearch: {
      backendRequested: 'ast-grep',
      backendUsed: 'index',
      fallback: true,
      symbolCount: 7,
    },
  };
  state.finalTrust = buildFinalTrustSignal({
    resultMode: 'DIAGNOSTIC',
    warningRequired: true,
    groundedAnalysis: {
      contractWarnings: ['Missing required section: `## Grounded Fixes`.'],
    },
    groundingValidation: {
      patchSafeEligible: false,
      validationWarnings: ['Evidence anchor points to missing file: `src/main/java/example/Missing.java`.'],
      evidenceAnchors: ['src/main/java/example/Missing.java'],
      observedFiles: ['src/main/java/example/ExampleService.java'],
      candidateSeams: [],
      hasSubstantiveAssumptions: false,
    },
  }, {
    allAgreed: false,
  });

  recordPreflightWaitSignal(state, {
    agent: 'architect',
    provider: 'anthropic',
    stage: 'proposal',
    waitMs: 22000,
    estimatedInputTokens: 17000,
    reason: 'input tokens remaining 11000/30000',
  });
  recordOutputTokenAdjustmentSignal(state, {
    agent: 'reviewer',
    provider: 'google',
    stage: 'critique-retry',
    estimatedInputTokens: 9300,
    configuredTokens: 1536,
    recommendedTokens: 4096,
    effectiveTokens: 4096,
    ceilingTokens: 8192,
    source: 'auto',
  });
  recordRetrySignal(state, {
    agent: 'architect',
    provider: 'anthropic',
    stage: 'proposal',
    attempt: 1,
    willRetry: true,
    isRateLimit: false,
    delayMs: 1000,
    errorName: 'ProviderRequestError',
    message: 'fetch failed',
  });
  recordRepairSignal(state, {
    agent: 'reviewer',
    stage: 'critique',
    outcome: 'attempted',
    stopReason: 'MAX_TOKENS',
    budgetTokens: 1024,
  });
  recordRepairSignal(state, {
    agent: 'reviewer',
    stage: 'critique',
    outcome: 'failed',
    stopReason: 'MAX_TOKENS',
    repairStopReason: 'MAX_TOKENS',
    budgetTokens: 1024,
  });
  recordToolLoopSignal(state, {
    agent: 'architect',
    provider: 'anthropic',
    stage: 'proposal',
    turnCount: 5,
    totalBytes: 120000,
  });
  recordIncompleteOutputSignal(state, {
    agent: 'reviewer',
    provider: 'google',
    stage: 'consensus',
    completionStatus: 'truncated',
    stopReason: 'length',
    outputPath: '.ai/prompts/runs/run-123/synthesizer-consensus.txt',
    estimatedInputTokens: 27645,
    contextBudget: 28000,
    maxOutputTokens: 4096,
    configuredMaxOutputTokens: 4096,
    recommendedOutputTokens: 8192,
    repairBudgetTokens: 3072,
    agreementScore: 27,
  });
  recordPromptScopeSignal(state, {
    risk: 'narrow-starting-seams',
    warningIssued: true,
    suggestionAvailable: true,
    notes: ['Prompt pins only a narrow starting seam.'],
    warningPath: '.ai/prompts/runs/run-123/prompt-scope-warning.txt',
    suggestedPromptPath: '.ai/prompts/runs/run-123/suggested-broadened-prompt.txt',
  });
  recordCallGatingSignal(state, {
    phase: 'revision',
    action: 'skipped-to-seam-expansion',
    reason: 'evidence-gap-only',
  });
  recordCallGatingSignal(state, {
    phase: 'tester',
    action: 'skipped',
    reason: 'diagnostic-result',
  });

  const snapshot = buildOperationalSignalsSnapshot(state, {
    status: 'failed',
    endedAt: '2026-03-13T04:02:00.000Z',
  });

  assert.equal(snapshot.runId, 'run-123');
  assert.equal(snapshot.status, 'failed');
  assert.equal(snapshot.preflightWaits.count, 1);
  assert.equal(snapshot.preflightWaits.totalWaitMs, 22000);
  assert.equal(snapshot.outputTokenAdjustments.count, 1);
  assert.equal(snapshot.outputTokenAdjustments.byStage.critique, 1);
  assert.equal(snapshot.outputTokenAdjustments.events[0].effectiveTokens, 4096);
  assert.equal(snapshot.retries.count, 1);
  assert.equal(snapshot.repairs.attempted, 1);
  assert.equal(snapshot.repairs.failed, 1);
  assert.equal(snapshot.toolLoopExhaustions.count, 1);
  assert.equal(snapshot.incompleteOutputs.count, 1);
  assert.equal(snapshot.incompleteOutputs.byStage.consensus, 1);
  assert.equal(snapshot.incompleteOutputs.events[0].operatorReason, 'consensus-budget-underprovisioned');
  assert.equal(snapshot.incompleteOutputs.events[0].estimatedInputTokens, 27645);
  assert.equal(snapshot.incompleteOutputs.events[0].contextBudget, 28000);
  assert.equal(snapshot.incompleteOutputs.events[0].maxOutputTokens, 4096);
  assert.equal(snapshot.incompleteOutputs.events[0].recommendedOutputTokens, 8192);
  assert.equal(snapshot.incompleteOutputs.events[0].repairBudgetTokens, 3072);
  assert.equal(snapshot.incompleteOutputs.events[0].agreementScore, 27);
  assert.equal(snapshot.incompleteOutputs.events[0].budgetShortfallTokens, 4096);
  assert.equal(snapshot.promptScope.risk, 'narrow-starting-seams');
  assert.equal(snapshot.promptScope.warningIssued, true);
  assert.equal(snapshot.promptScope.suggestionAvailable, true);
  assert.equal(snapshot.roundRationalization.approvalRoundsWithZeroNewSeams, 0);
  assert.equal(snapshot.roundRationalization.tokensBeforeFirstSeamFetch, null);
  assert.equal(snapshot.roundRationalization.critiqueSeamOverlap, null);
  assert.equal(snapshot.roundRationalization.callsAvoidedByGating.revisionSkipped, 1);
  assert.equal(snapshot.roundRationalization.callsAvoidedByGating.testerDiagnosticSkipped, 1);
  assert.equal(snapshot.roundRationalization.callsAvoidedByGating.testerDiagnosticMode, 0);
  assert.deepEqual(snapshot.promptScope.notes, ['Prompt pins only a narrow starting seam.']);
  assert.equal(snapshot.promptScope.warningPath, '.ai/prompts/runs/run-123/prompt-scope-warning.txt');
  assert.equal(snapshot.promptScope.suggestedPromptPath, '.ai/prompts/runs/run-123/suggested-broadened-prompt.txt');
  assert.deepEqual(snapshot.runtime.structuralSearch, {
    backendRequested: 'ast-grep',
    backendUsed: 'index',
    fallback: true,
    symbolCount: 7,
  });
  assert.deepEqual(snapshot.finalTrust, {
    resultMode: 'DIAGNOSTIC',
    copyPasteReady: false,
    allAgreed: false,
    approvalSnapshotFresh: true,
    warningRequired: true,
    patchSafeEligible: false,
    contractGapCount: 1,
    groundingGapCount: 1,
    contractGapCategories: ['missing-section'],
    groundingGapCategories: ['missing-file-anchor'],
    contractGapSamples: ['Missing required section: `## Grounded Fixes`.'],
    groundingGapSamples: ['Evidence anchor points to missing file: `src/main/java/example/Missing.java`.'],
    evidenceAnchorCount: 1,
    observedFileCount: 1,
    candidateSeamCount: 0,
    hasSubstantiveAssumptions: false,
    hasAssumedImplementation: false,
    primaryFailureClass: 'anchor-coverage-failure',
    failureClasses: ['anchor-coverage-failure'],
    failureSummary: 'Evidence anchors do not align cleanly with files observed in this run.',
  });
});

test('sanitizeUserFacingFinalText strips leaked internal log appendix and preserves end marker', () => {
  const input = [
    'Safe patch summary.',
    '',
    '### Логи',
    '',
    '**`.ai/logs/AI_PLAN_LOG.md`**',
    '```md',
    'log body',
    '```',
    '',
    'Если хотите, следующим сообщением могу дать diff.',
    END_MARKER,
  ].join('\n');

  const result = sanitizeUserFacingFinalText(input);

  assert.equal(result.sanitized, true);
  assert.equal(result.text, `Safe patch summary.\n${END_MARKER}`);
  assert.doesNotMatch(result.text, /\.ai\/logs\/AI_PLAN_LOG\.md/);
  assert.doesNotMatch(result.text, /Если хотите/);
});

test('sanitizeUserFacingFinalText strips ## Логи (h2) header variant', () => {
  const input = [
    'Grounded result here.',
    '',
    '## Логи',
    '',
    '```',
    '=== AI_PLAN_LOG entry ===',
    'Date: 2026-03-18',
    '=== END ===',
    '```',
    END_MARKER,
  ].join('\n');

  const result = sanitizeUserFacingFinalText(input);

  assert.equal(result.sanitized, true);
  assert.equal(result.text, `Grounded result here.\n${END_MARKER}`);
  assert.doesNotMatch(result.text, /AI_PLAN_LOG/);
});

test('sanitizeUserFacingFinalText strips standalone AI log blocks without header', () => {
  const input = [
    'Code patch here.',
    '',
    '```',
    '=== AI_CHANGE_LOG entry ===',
    'Date: 2026-03-18',
    'File: src/Service.java',
    '=== END ===',
    '```',
    ' runs\\run-1773793204706',
    END_MARKER,
  ].join('\n');

  const result = sanitizeUserFacingFinalText(input);

  assert.equal(result.sanitized, true);
  assert.doesNotMatch(result.text, /AI_CHANGE_LOG/);
  assert.doesNotMatch(result.text, /run-177379/);
});

test('sanitizeUserFacingFinalText leaves normal final answer unchanged', () => {
  const input = `Нормальный итог без служебных блоков.\n${END_MARKER}`;
  const result = sanitizeUserFacingFinalText(input);

  assert.equal(result.sanitized, false);
  assert.equal(result.text, input);
});

test('hasContextPackSection detects context-pack marker in bundle content', () => {
  assert.equal(hasContextPackSection('## CONTEXT PACK\nselected files'), true);
  assert.equal(hasContextPackSection('# plain bundle'), false);
});

test('detectProjectControlSurface detects java control files without package.json', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'project-surface-java-'));
  fs.writeFileSync(path.join(project, 'pom.xml'), '<project />');

  const result = detectProjectControlSurface(project);

  assert.equal(result.projectType, 'java');
  assert.deepEqual(result.primaryControlFiles, ['pom.xml']);
});

test('buildMissingContextWarningState downgrades package.json warning for java project', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'project-warning-java-'));
  fs.writeFileSync(path.join(project, 'pom.xml'), '<project />');

  const result = buildMissingContextWarningState({
    missingFiles: ['package.json'],
    projectPath: project,
  });

  assert.equal(result.level, 'info');
  assert.match(result.lines.join('\n'), /detected java project/i);
  assert.match(result.lines.join('\n'), /pom\.xml/);
  assert.doesNotMatch(result.lines.join('\n'), /The AI might lack important context/i);
});

test('buildMissingContextWarningState keeps package.json as warning for generic project', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'project-warning-generic-'));

  const result = buildMissingContextWarningState({
    missingFiles: ['package.json'],
    projectPath: project,
  });

  assert.equal(result.level, 'warn');
  assert.match(result.lines.join('\n'), /package\.json/);
  assert.match(result.lines.join('\n'), /The AI might lack important context/i);
});

test('buildEffectiveRuntimeSummaryLines prints effective limits and per-agent budgets', () => {
  const lines = buildEffectiveRuntimeSummaryLines({
    maxFiles: 200,
    packedTreeLimit: 120,
    contextPackActive: true,
    isLightMode: false,
    checkpointStatus: 'resume from proposals',
    agents: [
      { name: 'reviewer', contextBudget: 28000, maxOutputTokens: 12000 },
      { name: 'developer', contextBudget: 28000, maxOutputTokens: 4096 },
    ],
  });

  assert.equal(lines[0], '📏 Effective runtime limits:');
  assert.ok(lines.some((line) => line.includes('maxFiles=200')));
  assert.ok(lines.some((line) => line.includes('maxTreeFilesWhenPacked=120')));
  assert.ok(lines.some((line) => line.includes('context pack: on')));
  assert.ok(lines.some((line) => line.includes('checkpoint: resume from proposals')));
  assert.ok(lines.some((line) => line.includes('agent reviewer: contextBudget=28000, maxOutputTokens=12000')));
});

test('shouldDowngradeDevilsAdvocateError only downgrades provider timeouts', () => {
  assert.equal(shouldDowngradeDevilsAdvocateError({
    requestTimedOut: true,
    code: 'PROVIDER_REQUEST_TIMEOUT',
  }), true);
  assert.equal(shouldDowngradeDevilsAdvocateError({
    code: 'PROVIDER_REQUEST_TIMEOUT',
  }), true);
  assert.equal(shouldDowngradeDevilsAdvocateError({
    code: 'AI_INCOMPLETE_TEXT_OUTPUT',
  }), false);
  assert.equal(shouldDowngradeDevilsAdvocateError(new Error('generic failure')), false);
});

test('buildApprovalHandoffSummary renders compact approval status lines', () => {
  const lines = buildApprovalHandoffSummary([
    {
      name: 'reviewer',
      role: 'Reviewer',
      approval: {
        score: 8,
        agreed: true,
        notes: 'Grounded patch is acceptable, but one fallback path remains deferred.',
      },
    },
  ]);

  assert.equal(lines.length, 1);
  assert.match(lines[0], /reviewer \(Reviewer\): score=8, agreed=yes/);
  assert.match(lines[0], /Grounded patch is acceptable/);
});

test('buildSeamExpansionDeltaDiscussion keeps compact baseline and only new outputs', () => {
  const discussion = buildSeamExpansionDeltaDiscussion({
    currentDiscussion: 'Long earlier discussion about root cause and several rejected hypotheses.',
    previousConsensusText: 'Grounded fix touches the main route branch and defers one fallback path.',
    approvalOutputs: [
      {
        name: 'developer',
        role: 'Developer',
        approval: { score: 4, agreed: false, notes: 'Need one more seam for fallback branch.' },
      },
    ],
    phaseOutputs: [
      {
        name: 'architect',
        role: 'Architect',
        stage: 'proposal-lever3-1',
        text: 'New proposal based on fetched seam.',
      },
    ],
    expansionResult: {
      requestedSeams: [{}, {}],
      fetchedSeams: [{}],
    },
    appendixPath: '/tmp/critique-expansion-1.md',
  });

  assert.match(discussion, /# SEAM EXPANSION HANDOFF/);
  assert.match(discussion, /Pre-expansion consensus summary:/);
  assert.match(discussion, /Earlier discussion summary:/);
  assert.match(discussion, /Pre-expansion approval summary:/);
  assert.match(discussion, /score=4, agreed=no/);
  assert.match(discussion, /Seam expansion fetched 1 of 2 requested seams/);
  assert.match(discussion, /Appendix artifact:/);
  assert.match(discussion, /## architect \(Architect\) \[proposal-lever3-1\]/);
  assert.doesNotMatch(discussion, /rejected hypotheses\.\nLong earlier discussion/);
});

test('buildTreeTruncationWarningLines names packed tree cap as active limiter', () => {
  const lines = buildTreeTruncationWarningLines({
    totalFiles: 291,
    treeLimit: 120,
    excludedDirs: ['src/main/java/a', 'src/main/java/b'],
    maxFiles: 200,
    packedTreeLimit: 120,
    contextPackActive: true,
    isFullMode: false,
  });

  assert.equal(lines[0], '⚠️ Truncated: 291 → 120 files');
  assert.ok(lines.some((line) => line.includes('Active limiter: maxTreeFilesWhenPacked=120 while context pack is enabled')));
  assert.ok(lines.some((line) => line.includes('increasing --max-files will not expand the tree output')));
});

test('buildTreeTruncationWarningLines names maxFiles as active limiter when context pack is off', () => {
  const lines = buildTreeTruncationWarningLines({
    totalFiles: 291,
    treeLimit: 80,
    excludedDirs: [],
    maxFiles: 80,
    packedTreeLimit: 120,
    contextPackActive: false,
    isFullMode: false,
  });

  assert.ok(lines.some((line) => line.includes('Active limiter: maxFiles=80')));
  assert.ok(lines.some((line) => line.includes('Use --max-files=N or --full')));
});
