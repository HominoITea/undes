const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateResponse,
  classifyCompletion,
  formatValidation,
} = require('../response-validator');

const END = '=== END OF DOCUMENT ===';

test('validateResponse accepts sufficiently long response with END marker', () => {
  const text = `Implemented fix in src/app.js:42.\nDetailed explanation of changes.\n${END}`;
  const result = validateResponse(text, { minLength: 20 });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateResponse warns when END marker is missing', () => {
  const text = 'This is a complete response body with enough length for validation.';
  const result = validateResponse(text, { minLength: 20, requireEndMarker: true });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Missing END_MARKER/);
});

test('validateResponse fails on short response and refusal phrase', () => {
  const text = "I can't do that.";
  const result = validateResponse(text, { minLength: 30 });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /Response too short/);
  assert.match(result.errors[1], /Refusal detected/);
});

test('validateResponse warns about missing file references when enabled', () => {
  const text = `Implemented requested changes.\n${END}`;
  const result = validateResponse(text, {
    minLength: 10,
    checkFileRefs: true,
    requireEndMarker: true,
  });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /No file:line references or code blocks/);
});

test('validateResponse accepts file:line reference and code block for file checks', () => {
  const withRef = validateResponse(`Updated src/index.ts:12 with guard.\n${END}`, {
    minLength: 10,
    checkFileRefs: true,
  });
  assert.equal(withRef.warnings.length, 0);

  const withCode = validateResponse(`\`\`\`js\nconst x = 1;\nconsole.log(x);\n\`\`\`\n${END}`, {
    minLength: 10,
    checkFileRefs: true,
  });
  assert.equal(withCode.warnings.length, 0);
});

test('validateResponse warns when confidence marker is below threshold', () => {
  const text = `Result summary.\n[CONFIDENCE: 62%]\n${END}`;
  const result = validateResponse(text, {
    minLength: 10,
    minConfidence: 70,
  });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Low confidence: 62%/);
});

test('formatValidation renders both errors and warnings', () => {
  const rendered = formatValidation(
    {
      errors: ['Response too short (10 chars, minimum: 20)'],
      warnings: ['Missing END_MARKER - response may be truncated'],
    },
    'architect',
  );

  assert.match(rendered, /architect: INVALID response/);
  assert.match(rendered, /Response too short/);
  assert.match(rendered, /architect: Missing END_MARKER/);
});

test('classifyCompletion marks missing marker + truncation stopReason as truncated', () => {
  const text = 'This response ends mid sentence without the required marker';
  const validation = validateResponse(text, { minLength: 20, requireEndMarker: true });
  const result = classifyCompletion(text, validation, {
    requireEndMarker: true,
    meta: { stopReason: 'length' },
  });

  assert.equal(result.completionStatus, 'truncated');
  assert.equal(result.providerIndicatesTruncation, true);
});

test('classifyCompletion marks missing marker + heuristic-only incomplete ending as truncated', () => {
  const text = 'Implemented fix in src/app.ts:42 and updated the guard so the next step';
  const validation = validateResponse(text, { minLength: 20, requireEndMarker: true });
  const result = classifyCompletion(text, validation, {
    requireEndMarker: true,
    meta: {},
  });

  assert.equal(result.completionStatus, 'truncated');
  assert.equal(result.heuristicIndicatesTruncation, true);
});

test('classifyCompletion heuristic stays language-agnostic for non-latin trailing text', () => {
  const text = 'Исправил проверку очереди и добавил guard так что следующий шаг';
  const validation = validateResponse(text, { minLength: 20, requireEndMarker: true });
  const result = classifyCompletion(text, validation, {
    requireEndMarker: true,
    meta: {},
  });

  assert.equal(result.completionStatus, 'truncated');
  assert.equal(result.heuristicIndicatesTruncation, true);
});

test('classifyCompletion marks missing marker + non-truncation stopReason as invalid', () => {
  const text = 'This response is long enough but forgot the marker at the end of the document';
  const validation = validateResponse(text, { minLength: 20, requireEndMarker: true });
  const result = classifyCompletion(text, validation, {
    requireEndMarker: true,
    meta: { stopReason: 'stop' },
  });

  assert.equal(result.completionStatus, 'invalid');
});

test('validateResponse does not treat analytical "I cannot" phrasing as refusal', () => {
  const text = `Without reading the initializer path, I cannot point to the exact file, but the queue logic is clearly in ExampleService.\n${END}`;
  const result = validateResponse(text, { minLength: 20 });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});
