const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadLatestArchivedRun,
  loadPreviousDiscussion,
  buildRefinementContent,
} = require('../refinement');

function mkTmpAiDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refine-'));
  const aiDir = path.join(tmp, '.ai');
  fs.mkdirSync(path.join(aiDir, 'prompts', 'runs'), { recursive: true });
  fs.mkdirSync(path.join(aiDir, 'prompts', 'archive'), { recursive: true });
  return aiDir;
}

// --- loadLatestArchivedRun ---

test('loadLatestArchivedRun returns null on empty archive', () => {
  const aiDir = mkTmpAiDir();
  const result = loadLatestArchivedRun(aiDir);
  assert.equal(result, null);
});

test('loadLatestArchivedRun finds and parses run-flow.json from runs directory', () => {
  const aiDir = mkTmpAiDir();
  const runDir = path.join(aiDir, 'prompts', 'runs', 'run-1000');
  fs.mkdirSync(runDir, { recursive: true });
  const flow = {
    version: 1,
    runId: 'run-1000',
    prompt: 'test prompt',
    phases: { consensus: { status: 'done' } },
  };
  fs.writeFileSync(path.join(runDir, 'run-flow.json'), JSON.stringify(flow));

  const result = loadLatestArchivedRun(aiDir);
  assert.ok(result);
  assert.equal(result.runId, 'run-1000');
  assert.equal(result.prompt, 'test prompt');
  assert.equal(result._archiveDir, runDir);
});

test('loadLatestArchivedRun picks newest when multiple archives exist', () => {
  const aiDir = mkTmpAiDir();

  for (const id of ['run-1000', 'run-2000', 'run-1500']) {
    const dir = path.join(aiDir, 'prompts', 'runs', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'run-flow.json'),
      JSON.stringify({ version: 1, runId: id, prompt: id, phases: {} }),
    );
  }

  const result = loadLatestArchivedRun(aiDir);
  assert.ok(result);
  assert.equal(result.runId, 'run-2000');
});

test('loadLatestArchivedRun falls back to legacy archive directory', () => {
  const aiDir = mkTmpAiDir();
  const legacyRunDir = path.join(aiDir, 'prompts', 'archive', 'run-0900');
  fs.mkdirSync(legacyRunDir, { recursive: true });
  fs.writeFileSync(
    path.join(legacyRunDir, 'run-flow.json'),
    JSON.stringify({ version: 1, runId: 'run-0900', prompt: 'legacy', phases: {} }),
  );

  const result = loadLatestArchivedRun(aiDir);
  assert.ok(result);
  assert.equal(result.runId, 'run-0900');
  assert.equal(result._archiveDir, legacyRunDir);
  assert.equal(result._legacyArchiveDir, legacyRunDir);
});

test('loadLatestArchivedRun falls back to active run when run history has no run dirs', () => {
  const aiDir = mkTmpAiDir();
  // runs dir exists but has no run-* dirs
  fs.mkdirSync(path.join(aiDir, 'prompts', 'run'), { recursive: true });
  const flow = { version: 1, runId: 'run-active', prompt: 'active', phases: {} };
  fs.writeFileSync(
    path.join(aiDir, 'prompts', 'run', 'run-flow.json'),
    JSON.stringify(flow),
  );

  const result = loadLatestArchivedRun(aiDir);
  assert.ok(result);
  assert.equal(result.runId, 'run-active');
});

// --- loadPreviousDiscussion ---

test('loadPreviousDiscussion assembles proposals + critiques from output files', () => {
  const aiDir = mkTmpAiDir();
  const archiveDir = path.join(aiDir, 'prompts', 'runs');

  const proposalFile = path.join(archiveDir, 'agent-a-proposal.txt');
  const critiqueFile = path.join(archiveDir, 'agent-b-critique.txt');
  fs.writeFileSync(proposalFile, 'Proposal from A');
  fs.writeFileSync(critiqueFile, 'Critique from B');

  const flow = {
    version: 1,
    runId: 'run-test',
    phases: {
      proposals: {
        agents: {
          'agent-a': { status: 'done', outputFile: proposalFile },
        },
      },
      critiques: {
        agents: {
          'agent-b': { status: 'done', outputFile: critiqueFile },
        },
      },
    },
  };

  const discussion = loadPreviousDiscussion(flow, aiDir);
  assert.ok(discussion.includes('## agent-a [proposals]'));
  assert.ok(discussion.includes('Proposal from A'));
  assert.ok(discussion.includes('## agent-b [critiques]'));
  assert.ok(discussion.includes('Critique from B'));
});

test('loadPreviousDiscussion skips outputFile outside aiDataDir boundary', () => {
  const aiDir = mkTmpAiDir();
  const outsideFile = path.join(os.tmpdir(), 'evil-leak.txt');
  fs.writeFileSync(outsideFile, 'SECRET DATA');

  const flow = {
    version: 1,
    runId: 'run-evil',
    phases: {
      proposals: {
        agents: {
          'evil-agent': { status: 'done', outputFile: outsideFile },
        },
      },
    },
  };

  const discussion = loadPreviousDiscussion(flow, aiDir);
  assert.ok(!discussion.includes('SECRET DATA'), 'should not read file outside aiDataDir');
  assert.equal(discussion, '');

  // Cleanup
  fs.unlinkSync(outsideFile);
});

test('loadPreviousDiscussion skips symlink escape outside aiDataDir boundary', () => {
  const aiDir = mkTmpAiDir();
  const outsideFile = path.join(os.tmpdir(), `evil-symlink-leak-${process.pid}.txt`);
  fs.writeFileSync(outsideFile, 'SYMLINK SECRET DATA');

  const symlinkPath = path.join(aiDir, 'prompts', 'runs', 'symlinked-output.txt');
  try {
    fs.symlinkSync(outsideFile, symlinkPath);
  } catch (error) {
    if (error && (error.code === 'EPERM' || error.code === 'EACCES')) {
      // Environments that disallow symlink creation should not fail this test suite.
      fs.unlinkSync(outsideFile);
      return;
    }
    throw error;
  }

  const flow = {
    version: 1,
    runId: 'run-symlink',
    phases: {
      proposals: {
        agents: {
          'evil-symlink-agent': { status: 'done', outputFile: symlinkPath },
        },
      },
    },
  };

  const discussion = loadPreviousDiscussion(flow, aiDir);
  assert.ok(!discussion.includes('SYMLINK SECRET DATA'), 'should not read symlink target outside aiDataDir');
  assert.equal(discussion, '');

  fs.unlinkSync(symlinkPath);
  fs.unlinkSync(outsideFile);
});

// --- buildRefinementContent ---

test('buildRefinementContent contains all 4 sections in correct order', () => {
  const content = buildRefinementContent(
    'Original prompt here',
    'Discussion text',
    'Previous consensus text',
    'User feedback text',
  );

  const promptIdx = content.indexOf('Original prompt here');
  const discussionIdx = content.indexOf('Discussion text');
  const consensusIdx = content.indexOf('Previous consensus text');
  const feedbackIdx = content.indexOf('User feedback text');
  const taskIdx = content.indexOf('Revise the consensus');

  assert.ok(promptIdx >= 0, 'should contain original prompt');
  assert.ok(discussionIdx >= 0, 'should contain discussion');
  assert.ok(consensusIdx >= 0, 'should contain consensus');
  assert.ok(feedbackIdx >= 0, 'should contain feedback');
  assert.ok(taskIdx >= 0, 'should contain task instruction');

  assert.ok(promptIdx < discussionIdx, 'prompt before discussion');
  assert.ok(discussionIdx < consensusIdx, 'discussion before consensus');
  assert.ok(consensusIdx < feedbackIdx, 'consensus before feedback');
  assert.ok(feedbackIdx < taskIdx, 'feedback before task');

  assert.ok(content.includes('=== END OF DOCUMENT ==='), 'should include end marker instruction');
});
