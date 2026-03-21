const test = require('node:test');
const assert = require('node:assert/strict');

const {
  callAgentRaw,
  sanitizeForcedFinalAnswer,
} = require('../generate-context');

test('callAgentRaw requests a forced final answer when tool loop budget is exhausted', async () => {
  const prevMaxTurns = process.env.AI_TOOL_MAX_TURNS;
  process.env.AI_TOOL_MAX_TURNS = '1';

  let callCount = 0;
  const seenMessages = [];

  try {
    const result = await callAgentRaw(
      { name: 'architect', apiUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-6' },
      'context bundle',
      'prompt',
      'proposal',
      {
        callProvider: async (_agent, _contextBundle, messages) => {
          callCount += 1;
          seenMessages.push(messages.map((m) => ({ role: m.role, content: String(m.content) })));
          if (callCount === 1) {
            return {
              text: 'Need more context\n<<<READ_FILE: src/a.ts#L1-L20>>>',
              inputTokens: 100,
              outputTokens: 20,
              headers: {},
            };
          }
          return {
            text: 'Final answer using already loaded context.',
            inputTokens: 80,
            outputTokens: 40,
            headers: {},
          };
        },
        getFileContent: () => ({ content: 'export const a = 1;', size: 19 }),
        rootDir: '/tmp',
      },
    );

    assert.equal(callCount, 2);
    assert.equal(result.text, 'Final answer using already loaded context.');
    assert.equal(result.inputTokens, 180);
    assert.equal(result.outputTokens, 60);
    assert.match(seenMessages[1][seenMessages[1].length - 1].content, /File-reader budget is exhausted/);
  } finally {
    if (prevMaxTurns === undefined) {
      delete process.env.AI_TOOL_MAX_TURNS;
    } else {
      process.env.AI_TOOL_MAX_TURNS = prevMaxTurns;
    }
  }
});

test('sanitizeForcedFinalAnswer removes READ_FILE markers from forced final output', () => {
  const sanitized = sanitizeForcedFinalAnswer('Need more code\n<<<READ_FILE: src/a.ts>>>');
  assert.equal(sanitized, 'Need more code');
});
