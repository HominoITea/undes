const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveProjectLayout } = require('../path-utils');

const {
  END_MARKER,
  isOutputComplete,
  normalizeRuntimeSettings,
  describeRuntimeSettingDiff,
  runFingerprint,
  promptHash,
  runFlowPath,
  runDir,
  createRun,
  loadRun,
  writeFlowAtomic,
  updatePhase,
  updatePhaseAgent,
  isPhaseDone,
  isAgentDone,
  getAgentOutput,
  getPhaseOutput,
  getResumePoint,
  archiveRun,
  clearRun,
  clearLoadRunCache,
  formatRunAge,
} = require('../checkpoint-manager');

function mkTmpAiDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-'));
  const aiDir = path.join(tmp, '.ai');
  fs.mkdirSync(path.join(aiDir, 'prompts', 'run'), { recursive: true });
  fs.mkdirSync(path.join(aiDir, 'prompts', 'runs'), { recursive: true });
  fs.writeFileSync(path.join(aiDir, 'agents.json'), '{}');
  fs.writeFileSync(path.join(aiDir, 'context.json'), '{}');
  return aiDir;
}

function mkSplitRootLayout() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-layout-'));
  const sourceRoot = path.join(projectRoot, 'ai');
  const runtimeRoot = path.join(projectRoot, '.ai');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, 'prompts', 'run'), { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, 'prompts', 'runs'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'agents.json'), '{}');
  fs.writeFileSync(path.join(sourceRoot, 'context.json'), '{}');
  return resolveProjectLayout(projectRoot);
}

test('isOutputComplete true for text file with END marker', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'ok.txt');
  fs.writeFileSync(fp, `hello\n${END_MARKER}`);
  assert.equal(isOutputComplete(fp), true);
});

test('isOutputComplete false for text file without END marker', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'bad.txt');
  fs.writeFileSync(fp, 'hello');
  assert.equal(isOutputComplete(fp), false);
});

test('isOutputComplete true for valid json file', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'ok.json');
  fs.writeFileSync(fp, JSON.stringify({ ok: true }));
  assert.equal(isOutputComplete(fp), true);
});

test('isOutputComplete false for invalid json file', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'bad.json');
  fs.writeFileSync(fp, '{broken');
  assert.equal(isOutputComplete(fp), false);
});

test('isOutputComplete respects explicit outputFormat override', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'analysis.json');
  fs.writeFileSync(fp, JSON.stringify({ ok: true }));
  assert.equal(isOutputComplete(fp, 'text'), false);
  assert.equal(isOutputComplete(fp, 'json'), true);
});

test('isOutputComplete false for non-existent file', () => {
  assert.equal(isOutputComplete('/tmp/does-not-exist-abcdef.txt'), false);
});

test('isOutputComplete false for empty file', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'empty.txt');
  fs.writeFileSync(fp, '');
  assert.equal(isOutputComplete(fp), false);
});

test('isOutputComplete handles trailing whitespace after marker', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'trail.txt');
  fs.writeFileSync(fp, `content\n${END_MARKER}\n\n`);
  assert.equal(isOutputComplete(fp), true);
});

test('promptHash deterministic and 12 chars', () => {
  const a = promptHash('same');
  const b = promptHash('same');
  assert.equal(a, b);
  assert.equal(a.length, 12);
});

test('promptHash differs for different prompts', () => {
  assert.notEqual(promptHash('a'), promptHash('b'));
});

test('runFingerprint deterministic for same state', () => {
  const aiDir = mkTmpAiDir();
  const f1 = runFingerprint('prompt', aiDir);
  const f2 = runFingerprint('prompt', aiDir);
  assert.equal(f1, f2);
  assert.equal(f1.length, 16);
});

test('runFingerprint changes when prompt changes', () => {
  const aiDir = mkTmpAiDir();
  assert.notEqual(runFingerprint('prompt-a', aiDir), runFingerprint('prompt-b', aiDir));
});

test('runFingerprint changes when config mtime changes', () => {
  const aiDir = mkTmpAiDir();
  const fp = path.join(aiDir, 'agents.json');
  const before = runFingerprint('prompt', aiDir);
  const atime = new Date();
  const mtime = new Date(Date.now() + 60_000);
  fs.utimesSync(fp, atime, mtime);
  const after = runFingerprint('prompt', aiDir);
  assert.notEqual(before, after);
});

test('runFingerprint changes when runtime settings change', () => {
  const aiDir = mkTmpAiDir();
  const before = runFingerprint('prompt', aiDir, {
    mode: 'full',
    limits: { maxFiles: 200 },
    phases: { prepost: false, test: false },
  });
  const after = runFingerprint('prompt', aiDir, {
    mode: 'full',
    limits: { maxFiles: 500 },
    phases: { prepost: false, test: false },
  });
  assert.notEqual(before, after);
});

test('normalizeRuntimeSettings sorts keys deterministically', () => {
  const normalized = normalizeRuntimeSettings({
    phases: { test: false, prepost: true },
    limits: { maxFiles: 200, maxTreeFilesWhenPacked: 120 },
    mode: 'full',
  });
  assert.deepEqual(normalized, {
    limits: { maxFiles: 200, maxTreeFilesWhenPacked: 120 },
    mode: 'full',
    phases: { prepost: true, test: false },
  });
});

test('describeRuntimeSettingDiff returns changed runtime knobs', () => {
  const diffs = describeRuntimeSettingDiff(
    {
      limits: { maxFiles: 200 },
      phases: { prepost: false, test: false },
      mode: 'full',
    },
    {
      limits: { maxFiles: 500 },
      phases: { prepost: true, test: false },
      mode: 'full',
    },
  );
  assert.ok(diffs.includes('limits.maxFiles: 200 → 500'));
  assert.ok(diffs.includes('phases.prepost: false → true'));
});

test('runFlowPath and runDir point to prompts/run', () => {
  const aiDir = mkTmpAiDir();
  assert.ok(runFlowPath(aiDir).endsWith(path.join('prompts', 'run', 'run-flow.json')));
  assert.ok(runDir(aiDir).endsWith(path.join('prompts', 'run')));
});

test('createRun creates and loadRun reads flow', () => {
  const aiDir = mkTmpAiDir();
  const runtimeSettings = {
    limits: { maxFiles: 200 },
    mode: 'full',
    phases: { prepost: true, test: false },
  };
  const flow = createRun(aiDir, 'test prompt', ['--prepost'], ['architect', 'reviewer'], {
    taskId: 'DOC-123',
    runtimeSettings,
  });
  assert.ok(flow.runId.startsWith('run-'));
  assert.equal(flow.prompt, 'test prompt');
  assert.equal(flow.promptHash, promptHash('test prompt'));
  assert.ok(flow.fingerprint);
  assert.equal(flow.taskId, 'DOC-123');
  assert.deepEqual(flow.agents, ['architect', 'reviewer']);
  assert.deepEqual(flow.runtimeSettings, runtimeSettings);

  const loaded = loadRun(aiDir);
  assert.equal(loaded.runId, flow.runId);
  assert.equal(loaded.fingerprint, flow.fingerprint);
  assert.equal(loaded.taskId, 'DOC-123');
  assert.deepEqual(loaded.runtimeSettings, runtimeSettings);
});

test('loadRun returns null when flow file does not exist', () => {
  const aiDir = mkTmpAiDir();
  clearRun(aiDir);
  assert.equal(loadRun(aiDir), null);
});

test('loadRun returns null on corrupt json', () => {
  const aiDir = mkTmpAiDir();
  fs.writeFileSync(runFlowPath(aiDir), '{bad');
  assert.equal(loadRun(aiDir), null);
});

test('writeFlowAtomic overwrites flow atomically', () => {
  const aiDir = mkTmpAiDir();
  const flow = createRun(aiDir, 'a', [], []);
  flow.prompt = 'b';
  writeFlowAtomic(aiDir, flow);
  const loaded = loadRun(aiDir);
  assert.equal(loaded.prompt, 'b');
});

test('updatePhase marks text phase done and isPhaseDone true', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], []);
  const out = path.join(aiDir, 'consensus.txt');
  fs.writeFileSync(out, `result\n${END_MARKER}`);
  updatePhase(aiDir, 'consensus', { status: 'done', outputFile: out, outputFormat: 'text' });
  assert.equal(isPhaseDone(aiDir, 'consensus'), true);
});

test('isPhaseDone false when status is done but text file truncated', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], []);
  const out = path.join(aiDir, 'bad.txt');
  fs.writeFileSync(out, 'no marker');
  updatePhase(aiDir, 'consensus', { status: 'done', outputFile: out, outputFormat: 'text' });
  assert.equal(isPhaseDone(aiDir, 'consensus'), false);
});

test('isPhaseDone true for json phase with valid json output', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], []);
  const out = path.join(aiDir, 'pre.json');
  fs.writeFileSync(out, JSON.stringify({ enhancedPrompt: 'ok' }));
  updatePhase(aiDir, 'preprocess', { status: 'done', outputFile: out, outputFormat: 'json' });
  assert.equal(isPhaseDone(aiDir, 'preprocess'), true);
});

test('isPhaseDone true for done phase without outputFile', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], []);
  updatePhase(aiDir, 'postprocess', { status: 'done', finishedAt: new Date().toISOString() });
  assert.equal(isPhaseDone(aiDir, 'postprocess'), true);
});

test('updatePhaseAgent tracks per-agent completion', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['architect', 'reviewer']);
  const out = path.join(aiDir, 'arch.txt');
  fs.writeFileSync(out, `proposal\n${END_MARKER}`);
  updatePhaseAgent(aiDir, 'proposals', 'architect', {
    status: 'done',
    outputFile: out,
    outputFormat: 'text',
  });
  assert.equal(isAgentDone(aiDir, 'proposals', 'architect'), true);
  assert.equal(isAgentDone(aiDir, 'proposals', 'reviewer'), false);
});

test('updatePhaseAgent keeps phase partial until all agents done', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['a', 'b']);
  const out = path.join(aiDir, 'a.txt');
  fs.writeFileSync(out, `a\n${END_MARKER}`);
  updatePhaseAgent(aiDir, 'proposals', 'a', { status: 'done', outputFile: out, outputFormat: 'text' });
  const loaded = loadRun(aiDir);
  assert.equal(loaded.phases.proposals.status, 'partial');
});

test('updatePhaseAgent marks phase done when all agents done', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['a', 'b']);
  const a = path.join(aiDir, 'a.txt');
  const b = path.join(aiDir, 'b.txt');
  fs.writeFileSync(a, `a\n${END_MARKER}`);
  fs.writeFileSync(b, `b\n${END_MARKER}`);
  updatePhaseAgent(aiDir, 'proposals', 'a', { status: 'done', outputFile: a, outputFormat: 'text' });
  updatePhaseAgent(aiDir, 'proposals', 'b', { status: 'done', outputFile: b, outputFormat: 'text' });
  const loaded = loadRun(aiDir);
  assert.equal(loaded.phases.proposals.status, 'done');
  assert.ok(loaded.phases.proposals.finishedAt);
});

test('isAgentDone false when agent status is not done', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['a']);
  const out = path.join(aiDir, 'a.txt');
  fs.writeFileSync(out, `a\n${END_MARKER}`);
  updatePhaseAgent(aiDir, 'proposals', 'a', { status: 'failed', outputFile: out, outputFormat: 'text' });
  assert.equal(isAgentDone(aiDir, 'proposals', 'a'), false);
});

test('isAgentDone false when output file is missing', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['a']);
  updatePhaseAgent(aiDir, 'proposals', 'a', { status: 'done', outputFile: '/tmp/nope.txt', outputFormat: 'text' });
  assert.equal(isAgentDone(aiDir, 'proposals', 'a'), false);
});

test('isAgentDone false for invalid json outputFormat', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['a']);
  const out = path.join(aiDir, 'a.json');
  fs.writeFileSync(out, '{bad');
  updatePhaseAgent(aiDir, 'proposals', 'a', { status: 'done', outputFile: out, outputFormat: 'json' });
  assert.equal(isAgentDone(aiDir, 'proposals', 'a'), false);
});

test('getAgentOutput returns saved agent text', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['a']);
  const out = path.join(aiDir, 'a.txt');
  fs.writeFileSync(out, `hello\n${END_MARKER}`);
  updatePhaseAgent(aiDir, 'proposals', 'a', { status: 'done', outputFile: out, outputFormat: 'text' });
  assert.ok(getAgentOutput(aiDir, 'proposals', 'a').includes('hello'));
});

test('getPhaseOutput returns saved phase text', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], []);
  const out = path.join(aiDir, 'consensus.txt');
  fs.writeFileSync(out, `final\n${END_MARKER}`);
  updatePhase(aiDir, 'consensus', { status: 'done', outputFile: out, outputFormat: 'text' });
  assert.ok(getPhaseOutput(aiDir, 'consensus').includes('final'));
});

test('getResumePoint returns first non-done phase', () => {
  const phases = ['preprocess', 'proposals', 'critiques', 'consensus'];
  const flow = { phases: { preprocess: { status: 'done' }, proposals: { status: 'done' } } };
  assert.equal(getResumePoint(flow, phases), 'critiques');
});

test('getResumePoint returns null when all phases done', () => {
  const phases = ['proposals', 'consensus'];
  const flow = { phases: { proposals: { status: 'done' }, consensus: { status: 'done' } } };
  assert.equal(getResumePoint(flow, phases), null);
});

test('getResumePoint returns first phase when flow empty or null', () => {
  const phases = ['proposals', 'critiques'];
  assert.equal(getResumePoint({ phases: {} }, phases), 'proposals');
  assert.equal(getResumePoint(null, phases), 'proposals');
});

test('archiveRun moves only run-flow.json into archive run folder', () => {
  const aiDir = mkTmpAiDir();
  const flow = createRun(aiDir, 'test', [], []);
  const output = path.join(aiDir, 'prompts', 'runs', 'keep.txt');
  fs.writeFileSync(output, 'keep');
  archiveRun(aiDir);
  assert.equal(fs.existsSync(runFlowPath(aiDir)), false);
  const archivedFlow = path.join(aiDir, 'prompts', 'runs', flow.runId, 'run-flow.json');
  assert.equal(fs.existsSync(archivedFlow), true);
  assert.equal(fs.existsSync(output), true);
});

test('archiveRun handles missing flow gracefully', () => {
  const aiDir = mkTmpAiDir();
  clearRun(aiDir);
  archiveRun(aiDir);
  assert.equal(true, true);
});

test('clearRun removes run directory recursively', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], []);
  const dir = runDir(aiDir);
  assert.equal(fs.existsSync(dir), true);
  clearRun(aiDir);
  assert.equal(fs.existsSync(dir), false);
});

test('formatRunAge returns min/hour/day buckets', () => {
  const now = new Date();
  assert.ok(formatRunAge(now.toISOString()).includes('min'));

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  assert.ok(formatRunAge(oneHourAgo.toISOString()).includes('h'));

  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  assert.ok(formatRunAge(twoDaysAgo.toISOString()).includes('d'));
});

test('formatRunAge handles invalid input', () => {
  assert.equal(formatRunAge('not-a-date'), 'unknown age');
});

test('phaseOrder includes approval between consensus and devils-advocate', () => {
  // This validates the contract that approval is a recognized checkpoint phase
  const phaseOrder = ['preprocess', 'proposals', 'critiques', 'consensus', 'approval', 'devils-advocate', 'postprocess'];
  const consensusIdx = phaseOrder.indexOf('consensus');
  const approvalIdx = phaseOrder.indexOf('approval');
  const daIdx = phaseOrder.indexOf('devils-advocate');
  assert.ok(approvalIdx > consensusIdx, 'approval must come after consensus');
  assert.ok(approvalIdx < daIdx, 'approval must come before devils-advocate');
});

test('getResumePoint returns approval when consensus is done but approval is not', () => {
  const phaseOrder = ['preprocess', 'proposals', 'critiques', 'consensus', 'approval', 'devils-advocate', 'postprocess'];
  const flow = {
    phases: {
      preprocess: { status: 'done' },
      proposals: { status: 'done' },
      critiques: { status: 'done' },
      consensus: { status: 'done' },
    },
  };
  assert.equal(getResumePoint(flow, phaseOrder), 'approval');
});

test('getResumePoint skips approval when it is done', () => {
  const phaseOrder = ['preprocess', 'proposals', 'critiques', 'consensus', 'approval', 'devils-advocate', 'postprocess'];
  const flow = {
    phases: {
      preprocess: { status: 'done' },
      proposals: { status: 'done' },
      critiques: { status: 'done' },
      consensus: { status: 'done' },
      approval: { status: 'done' },
    },
  };
  assert.equal(getResumePoint(flow, phaseOrder), 'devils-advocate');
});

test('isPhaseDone true for approval phase marked done without outputFile', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['reviewer']);
  updatePhase(aiDir, 'approval', {
    status: 'done',
    finishedAt: new Date().toISOString(),
    allAgreed: true,
    lastRound: 1,
  });
  assert.equal(isPhaseDone(aiDir, 'approval'), true);
});

test('isPhaseDone false for approval phase marked paused', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['reviewer']);
  updatePhase(aiDir, 'approval', {
    status: 'paused',
    pausedAt: new Date().toISOString(),
    pauseReason: 'timeout',
  });
  assert.equal(isPhaseDone(aiDir, 'approval'), false);
});

test('approval phase checkpoint preserves allAgreed and lastRound', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['reviewer']);
  updatePhase(aiDir, 'approval', {
    status: 'done',
    finishedAt: new Date().toISOString(),
    allAgreed: false,
    lastRound: 2,
  });
  const loaded = loadRun(aiDir);
  assert.equal(loaded.phases.approval.allAgreed, false);
  assert.equal(loaded.phases.approval.lastRound, 2);
});

test('consensus checkpoint updated after seam expansion preserves post-expansion output', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], ['reviewer']);

  // Initial consensus
  const initialOut = path.join(aiDir, 'consensus.txt');
  fs.writeFileSync(initialOut, `initial consensus\n${END_MARKER}`);
  updatePhase(aiDir, 'consensus', {
    status: 'done',
    outputFile: initialOut,
    outputFormat: 'text',
    agent: 'synthesizer',
  });
  assert.ok(getPhaseOutput(aiDir, 'consensus').includes('initial consensus'));

  // Post-expansion update overwrites consensus checkpoint
  const postExpansionOut = path.join(aiDir, 'post-expansion-1.txt');
  fs.writeFileSync(postExpansionOut, `expanded consensus with seam data\n${END_MARKER}`);
  updatePhase(aiDir, 'consensus', {
    status: 'done',
    outputFile: postExpansionOut,
    outputFormat: 'text',
    agent: 'synthesizer',
    seamExpansionRound: 1,
  });

  // On resume, consensus should load post-expansion version
  assert.ok(isPhaseDone(aiDir, 'consensus'));
  const loaded = getPhaseOutput(aiDir, 'consensus');
  assert.ok(loaded.includes('expanded consensus with seam data'));
  assert.ok(!loaded.includes('initial consensus'));

  // Metadata preserved
  const flow = loadRun(aiDir);
  assert.equal(flow.phases.consensus.seamExpansionRound, 1);
});

test('loadRun cache returns same data without re-reading file', () => {
  clearLoadRunCache();
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'cache test', [], ['a']);
  const first = loadRun(aiDir);
  // Mutate returned object — cache should be independent
  first.prompt = 'mutated';
  const second = loadRun(aiDir);
  assert.equal(second.prompt, 'cache test');
});

test('loadRun cache invalidates when file changes externally', () => {
  clearLoadRunCache();
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'original', [], []);
  const first = loadRun(aiDir);
  assert.equal(first.prompt, 'original');
  // Modify file directly (simulating external change)
  const fp = runFlowPath(aiDir);
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  raw.prompt = 'externally changed';
  // Touch with new mtime
  const future = new Date(Date.now() + 5000);
  fs.writeFileSync(fp, JSON.stringify(raw, null, 2) + '\n');
  fs.utimesSync(fp, future, future);
  const second = loadRun(aiDir);
  assert.equal(second.prompt, 'externally changed');
});

test('clearLoadRunCache forces re-read from disk', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'before clear', [], []);
  loadRun(aiDir); // populate cache
  clearLoadRunCache();
  const loaded = loadRun(aiDir);
  assert.equal(loaded.prompt, 'before clear');
});

test('clearRun clears cache for that path', () => {
  const aiDir = mkTmpAiDir();
  createRun(aiDir, 'test', [], []);
  loadRun(aiDir); // populate cache
  clearRun(aiDir);
  assert.equal(loadRun(aiDir), null);
});

test('checkpoint-manager accepts split-root layout objects', () => {
  const layout = mkSplitRootLayout();
  const before = runFingerprint('prompt', layout);
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(layout.agentsConfigPath, new Date(), future);
  const after = runFingerprint('prompt', layout);
  assert.notEqual(before, after);

  const flow = createRun(layout, 'split prompt', [], ['architect']);
  assert.equal(runDir(layout), path.join(layout.runtimeRoot, 'prompts', 'run'));
  assert.equal(runFlowPath(layout), path.join(layout.runtimeRoot, 'prompts', 'run', 'run-flow.json'));
  assert.equal(loadRun(layout).runId, flow.runId);

  archiveRun(layout);
  assert.equal(fs.existsSync(runFlowPath(layout)), false);
  assert.equal(fs.existsSync(path.join(layout.runsDir, flow.runId, 'run-flow.json')), true);
});
