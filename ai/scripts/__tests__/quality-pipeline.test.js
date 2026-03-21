const test = require('node:test');
const assert = require('node:assert/strict');

const { scorePrompt, formatGateResult } = require('../prompt-gate');
const { validateResponse, formatValidation, REFUSAL_PATTERNS } = require('../response-validator');

test('scorePrompt: vague prompt scores low', () => {
  const index = { symbols: [{ name: 'foo', file: './bar.js', signature: 'function foo()' }], edges: [] };
  const result = scorePrompt('make it better', index, {});
  assert.ok(result.score <= 3, `Expected score <= 3, got ${result.score}`);
  assert.ok(result.verdict === 'warn' || result.verdict === 'block');
});

test('scorePrompt: specific prompt scores high', () => {
  const index = {
    symbols: [
      { name: 'buildCodeIndex', file: './context-index.js', signature: 'function buildCodeIndex({' },
      { name: 'scoreSymbols', file: './context-pack.js', signature: 'function scoreSymbols()' },
    ],
    edges: [],
  };

  const result = scorePrompt('Fix bug in buildCodeIndex where symbols are duplicated', index, {});
  assert.ok(result.score > 3, `Expected score > 3, got ${result.score}`);
  assert.equal(result.verdict, 'pass');
  assert.ok(result.matchedSymbols > 0);
});

test('scorePrompt: Russian prompt with translations scores ok', () => {
  const index = {
    symbols: [
      { name: 'loadConfig', file: './config.js', signature: 'function loadConfig()' },
      { name: 'handleError', file: './errors.js', signature: 'function handleError()' },
    ],
    edges: [],
  };

  const result = scorePrompt('Добавь обработку ошибок в модуль загрузки конфигурации', index, {});
  assert.ok(result.score > 3, `Expected score > 3, got ${result.score}`);
  assert.equal(result.verdict, 'pass');
});

test('scorePrompt: no index returns pass', () => {
  const result = scorePrompt('any prompt', null, {});
  assert.equal(result.verdict, 'pass');
});

test('scorePrompt: empty prompt with index returns block', () => {
  const index = { symbols: [{ name: 'foo', file: './bar.js', signature: 'function foo()' }], edges: [] };
  const result = scorePrompt('', index, { blockThreshold: 0 });
  assert.equal(result.score, 0);
  assert.equal(result.verdict, 'block');
});

test('formatGateResult: includes canonical translation count when present', () => {
  const output = formatGateResult({
    score: 10,
    matchedSymbols: 2,
    matchedFiles: 1,
    tokenCount: 5,
    translatedCount: 3,
  });

  assert.ok(output.includes('Canonical translations'));
  assert.ok(output.includes('3'));
});

test('formatGateResult: omits canonical translation line when zero translations', () => {
  const output = formatGateResult({
    score: 5,
    matchedSymbols: 1,
    matchedFiles: 0,
    tokenCount: 3,
    translatedCount: 0,
  });

  assert.ok(!output.includes('Canonical translations'));
});

test('validateResponse: valid response passes', () => {
  const text = 'Here is my analysis of the code.\n'.repeat(10) + '\n=== END OF DOCUMENT ===';
  const result = validateResponse(text);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateResponse: short response fails', () => {
  const text = 'OK\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 50 });
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].includes('too short'));
});

test('validateResponse: refusal "I cannot" detected', () => {
  const text = 'I cannot help with this request because I do not have access.\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 10 });
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].includes('Refusal'));
});

test('validateResponse: refusal "As an AI" detected', () => {
  const text = 'As an AI language model, I need to clarify that I should not do this.\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 10 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Refusal')));
});

test('validateResponse: missing END_MARKER is warning not error', () => {
  const text = 'A valid response with enough content to pass the length check easily and provide useful information.';
  const result = validateResponse(text, { minLength: 20 });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings[0].includes('END_MARKER'));
});

test('validateResponse: low confidence warning', () => {
  const text = 'Some analysis here with enough length to pass.\n[CONFIDENCE: 15%]\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 10, minConfidence: 30 });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes('Low confidence')));
});

test('validateResponse: analytical "I cannot" inside valid reasoning is not refusal', () => {
  const text = 'The queue bug is in ApproverFacadeImpl. Without reading one more initializer, I cannot point to the exact creator method, but the three defects are already visible.\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 10 });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateResponse: high confidence no warning', () => {
  const text = 'Some analysis here with enough length to pass.\n[CONFIDENCE: 85%]\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 10, minConfidence: 30 });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0);
});

test('validateResponse: disabled checks pass everything', () => {
  const text = 'x';
  const result = validateResponse(text, {
    minLength: 0,
    requireEndMarker: false,
    checkRefusal: false,
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
});

test('validateResponse: file ref check warns when no code present', () => {
  const text = 'This is a long response about general concepts without specific code references or blocks of any kind.\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 10, checkFileRefs: true });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes('file:line')));
});

test('validateResponse: file ref check passes with code block', () => {
  const text = 'Here is the fix:\n```javascript\nfunction foo() { return 42; }\n```\nThis resolves the issue.\n=== END OF DOCUMENT ===';
  const result = validateResponse(text, { minLength: 10, checkFileRefs: true });
  assert.equal(result.valid, true);
  assert.ok(!result.warnings.some((w) => w.includes('file:line')));
});

test('validateResponse: null/undefined input handled', () => {
  const result = validateResponse(null, {
    minLength: 0,
    requireEndMarker: false,
    checkRefusal: false,
  });

  assert.equal(result.valid, true);
});

test('formatValidation: returns empty string for clean result', () => {
  const output = formatValidation({ valid: true, errors: [], warnings: [] }, 'test-agent');
  assert.equal(output, '');
});

test('formatValidation: shows errors and warnings', () => {
  const output = formatValidation({
    valid: false,
    errors: ['Refusal detected: "I cannot"'],
    warnings: ['Missing END_MARKER - response may be truncated'],
  }, 'claude');

  assert.ok(output.includes('claude'));
  assert.ok(output.includes('INVALID'));
  assert.ok(output.includes('Refusal'));
  assert.ok(output.includes('END_MARKER'));
});

test('REFUSAL_PATTERNS: all patterns are valid RegExp', () => {
  assert.ok(Array.isArray(REFUSAL_PATTERNS));
  assert.ok(REFUSAL_PATTERNS.length > 0);
  for (const pattern of REFUSAL_PATTERNS) {
    assert.ok(pattern instanceof RegExp, `Expected RegExp, got ${typeof pattern}`);
  }
});

function computeAgreementScore(critiqueTexts) {
  let agrees = 0;
  let disagrees = 0;
  for (const text of critiqueTexts || []) {
    const safeText = String(text || '');
    agrees += (safeText.match(/✅/g) || []).length;
    disagrees += (safeText.match(/❌/g) || []).length;
  }
  const total = agrees + disagrees;
  if (total === 0) return null;
  return Math.round((agrees / total) * 100);
}

function trimContextForPhase(contextBundle, phase) {
  if (!contextBundle || typeof contextBundle !== 'string') return contextBundle;

  const trimPhases = ['critique', 'consensus', 'devil-advocate', 'da-revision', 'approval', 'revision'];
  if (!trimPhases.includes(phase)) return contextBundle;

  const fragStart = contextBundle.indexOf('### Relevant Code Fragments');
  if (fragStart < 0) return contextBundle;

  const afterFrag = contextBundle.indexOf('\n---', fragStart);
  const nextHeader = contextBundle.indexOf('\n## ', fragStart + 1);

  let sectionEnd = -1;
  if (afterFrag > fragStart && nextHeader > fragStart) {
    sectionEnd = Math.min(afterFrag, nextHeader);
  } else if (afterFrag > fragStart) {
    sectionEnd = afterFrag;
  } else if (nextHeader > fragStart) {
    sectionEnd = nextHeader;
  }

  const replacement = '### Code Context\n_Code fragments omitted - see proposals above for relevant code._\n';
  if (sectionEnd > fragStart) {
    return contextBundle.slice(0, fragStart) + replacement + contextBundle.slice(sectionEnd);
  }
  return contextBundle.slice(0, fragStart) + replacement;
}

test('computeAgreementScore: mostly agree returns high score', () => {
  const critiques = ['✅ Good', '✅ Looks fine', '✅ Works as expected', '❌ Missing edge case'];
  const score = computeAgreementScore(critiques);
  assert.equal(score, 75);
  assert.ok(score > 70);
});

test('computeAgreementScore: mostly disagree returns low score', () => {
  const critiques = ['❌ Wrong approach', '❌ Incomplete', '✅ Minor point', '❌ Security issue'];
  const score = computeAgreementScore(critiques);
  assert.equal(score, 25);
  assert.ok(score < 30);
});

test('computeAgreementScore: no markers returns null', () => {
  const critiques = ['Looks reasonable', 'Need more detail'];
  assert.equal(computeAgreementScore(critiques), null);
});

test('computeAgreementScore: mixed markers proportional', () => {
  const critiques = ['✅', '✅', '❌', '❌'];
  assert.equal(computeAgreementScore(critiques), 50);
});

test('computeAgreementScore: empty input returns null', () => {
  assert.equal(computeAgreementScore([]), null);
});

test('trimContextForPhase: proposal phase returns full bundle', () => {
  const bundle = '## CONTEXT PACK\n### Relevant Code Fragments\ncode\n---\n## NEXT';
  assert.equal(trimContextForPhase(bundle, 'proposal'), bundle);
});

test('trimContextForPhase: critique phase strips code fragments', () => {
  const bundle = '## CONTEXT PACK\n### Symbols\n- a\n### Relevant Code Fragments\n```js\ncode\n```\n---\n## DIRECTORY STRUCTURE\n...';
  const trimmed = trimContextForPhase(bundle, 'critique');
  assert.ok(!trimmed.includes('```js'));
  assert.ok(trimmed.includes('### Code Context'));
  assert.ok(trimmed.includes('## DIRECTORY STRUCTURE'));
});

test('trimContextForPhase: consensus phase strips code fragments', () => {
  const bundle = '## CONTEXT PACK\n### Relevant Code Fragments\ncode\n---\n## NEXT';
  const trimmed = trimContextForPhase(bundle, 'consensus');
  assert.ok(trimmed.includes('### Code Context'));
  assert.ok(!trimmed.includes('### Relevant Code Fragments'));
});

test('trimContextForPhase: no marker returns full bundle', () => {
  const bundle = '## CONTEXT PACK\n### Symbols\n- a\n## NEXT';
  assert.equal(trimContextForPhase(bundle, 'critique'), bundle);
});

test('trimContextForPhase: null input returns null', () => {
  assert.equal(trimContextForPhase(null, 'critique'), null);
});

test('trimContextForPhase: undefined input returns undefined', () => {
  assert.equal(trimContextForPhase(undefined, 'critique'), undefined);
});

test('trimContextForPhase: code fragments at end of bundle', () => {
  const bundle = '## CONTEXT PACK\n### Relevant Code Fragments\n```js\ncode\n```';
  const trimmed = trimContextForPhase(bundle, 'critique');
  assert.ok(trimmed.includes('### Code Context'));
  assert.ok(!trimmed.includes('```js'));
});

test('trimContextForPhase: devil-advocate phase trims', () => {
  const bundle = '## CONTEXT PACK\n### Relevant Code Fragments\ncode\n---\n## NEXT';
  const trimmed = trimContextForPhase(bundle, 'devil-advocate');
  assert.ok(trimmed.includes('### Code Context'));
});

test('trimContextForPhase: pre-process phase returns full bundle', () => {
  const bundle = '## CONTEXT PACK\n### Relevant Code Fragments\ncode\n---\n## NEXT';
  assert.equal(trimContextForPhase(bundle, 'pre-process'), bundle);
});

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function computeResultHash(promptText, codeIndex) {
  const h = crypto.createHash('sha256');
  h.update(String(promptText || ''));
  if (codeIndex && codeIndex.byFile) {
    h.update(JSON.stringify(Object.keys(codeIndex.byFile).sort()));
    h.update(String((codeIndex.symbols || []).length));
  }
  return h.digest('hex').slice(0, 16);
}

test('resultCache: same prompt + same index -> same hash', () => {
  const index = { byFile: { 'a.js': [], 'b.js': [] }, symbols: [1, 2, 3] };
  const h1 = computeResultHash('fix bug in foo', index);
  const h2 = computeResultHash('fix bug in foo', index);
  assert.equal(h1, h2);
});

test('resultCache: different prompt -> different hash', () => {
  const index = { byFile: { 'a.js': [] }, symbols: [1] };
  const h1 = computeResultHash('fix bug in foo', index);
  const h2 = computeResultHash('add feature bar', index);
  assert.notEqual(h1, h2);
});

test('resultCache: different files -> different hash', () => {
  const index1 = { byFile: { 'a.js': [] }, symbols: [1] };
  const index2 = { byFile: { 'a.js': [], 'b.js': [] }, symbols: [1] };
  const h1 = computeResultHash('fix bug', index1);
  const h2 = computeResultHash('fix bug', index2);
  assert.notEqual(h1, h2);
});

test('resultCache: different symbol count -> different hash', () => {
  const index1 = { byFile: { 'a.js': [] }, symbols: [1, 2] };
  const index2 = { byFile: { 'a.js': [] }, symbols: [1, 2, 3] };
  const h1 = computeResultHash('fix bug', index1);
  const h2 = computeResultHash('fix bug', index2);
  assert.notEqual(h1, h2);
});

test('resultCache: null index -> still returns hash', () => {
  const h = computeResultHash('some prompt', null);
  assert.equal(typeof h, 'string');
  assert.equal(h.length, 16);
});

test('resultCache: empty prompt -> still returns hash', () => {
  const h = computeResultHash('', { byFile: {}, symbols: [] });
  assert.equal(typeof h, 'string');
  assert.equal(h.length, 16);
});

test('provider profiles: anthropic.md exists and is valid', () => {
  const profilePath = path.join(__dirname, '..', '..', 'prompts', 'providers', 'anthropic.md');
  assert.ok(fs.existsSync(profilePath), 'anthropic.md should exist');
  const content = fs.readFileSync(profilePath, 'utf8');
  assert.ok(content.length > 50, 'Profile should have content');
  assert.ok(content.includes('=== END OF DOCUMENT ==='), 'Profile should have END_MARKER');
});

test('provider profiles: openai.md exists and is valid', () => {
  const profilePath = path.join(__dirname, '..', '..', 'prompts', 'providers', 'openai.md');
  assert.ok(fs.existsSync(profilePath), 'openai.md should exist');
  const content = fs.readFileSync(profilePath, 'utf8');
  assert.ok(content.length > 50);
  assert.ok(content.includes('=== END OF DOCUMENT ==='));
});

test('provider profiles: google.md exists and is valid', () => {
  const profilePath = path.join(__dirname, '..', '..', 'prompts', 'providers', 'google.md');
  assert.ok(fs.existsSync(profilePath), 'google.md should exist');
  const content = fs.readFileSync(profilePath, 'utf8');
  assert.ok(content.length > 50);
  assert.ok(content.includes('=== END OF DOCUMENT ==='));
});

test('provider profiles: all files under 500 bytes', () => {
  const dir = path.join(__dirname, '..', '..', 'prompts', 'providers');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    assert.ok(stat.size < 500, `${file} should be under 500 bytes (got ${stat.size})`);
  }
});
