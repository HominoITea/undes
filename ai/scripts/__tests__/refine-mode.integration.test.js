const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function mkTmpProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'refine-mode-project-'));
  const aiDir = path.join(projectRoot, '.ai');
  fs.mkdirSync(path.join(aiDir, 'prompts', 'archive'), { recursive: true });

  const contextConfig = {
    fullFiles: ['README.md'],
    lightFiles: ['README.md'],
    exclude: 'find . -maxdepth 2 -type f',
  };
  fs.writeFileSync(path.join(aiDir, 'context.json'), JSON.stringify(contextConfig, null, 2));
  fs.writeFileSync(path.join(aiDir, 'agents.json'), JSON.stringify({ agents: [] }, null, 2));

  return { projectRoot, aiDir };
}

function runGenerateContext(repoRoot, args, options = {}) {
  const script = path.join(repoRoot, 'ai', 'scripts', 'generate-context.js');
  const mergedEnv = {
    ...process.env,
    _AI_DISPATCHER_RESOLVED: '1',
    ...(options.env || {}),
  };
  return spawnSync('node', [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
    env: mergedEnv,
  });
}

test('refine mode rejects consensus output path outside ai data directory', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const { projectRoot, aiDir } = mkTmpProject();
  const runDir = path.join(aiDir, 'prompts', 'archive', 'run-20260303-1');
  fs.mkdirSync(runDir, { recursive: true });

  const externalConsensus = path.join(os.tmpdir(), `external-consensus-${process.pid}.txt`);
  fs.writeFileSync(externalConsensus, 'External consensus content');

  const flow = {
    version: 1,
    runId: 'run-20260303-1',
    prompt: 'Original prompt',
    phases: {
      consensus: {
        status: 'done',
        outputFile: externalConsensus,
      },
    },
  };
  fs.writeFileSync(path.join(runDir, 'run-flow.json'), JSON.stringify(flow, null, 2));

  const result = runGenerateContext(repoRoot, [
    '--refine',
    '--feedback=Please improve this',
    `--project-path=${projectRoot}`,
    `--hub-root=${repoRoot}`,
  ]);

  const combined = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, combined);
  assert.equal(fs.existsSync(path.join(aiDir, '.code_index.json')), false);
  assert.equal(
    fs.readdirSync(path.join(aiDir, 'prompts', 'archive')).some((name) => name.includes('refinement')),
    false,
  );

  fs.unlinkSync(externalConsensus);
});

test('refine mode requires --feedback in non-interactive mode', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const { projectRoot, aiDir } = mkTmpProject();
  const runDir = path.join(aiDir, 'prompts', 'archive', 'run-20260303-2');
  fs.mkdirSync(runDir, { recursive: true });

  const consensusPath = path.join(runDir, 'consensus.txt');
  fs.writeFileSync(consensusPath, 'Consensus text\n=== END OF DOCUMENT ===\n');

  const flow = {
    version: 1,
    runId: 'run-20260303-2',
    prompt: 'Original prompt',
    phases: {
      consensus: {
        status: 'done',
        outputFile: consensusPath,
      },
    },
  };
  fs.writeFileSync(path.join(runDir, 'run-flow.json'), JSON.stringify(flow, null, 2));

  const result = runGenerateContext(repoRoot, [
    '--refine',
    '--non-interactive',
    `--project-path=${projectRoot}`,
    `--hub-root=${repoRoot}`,
  ]);

  const combined = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, combined);
  assert.equal(fs.existsSync(path.join(aiDir, '.code_index.json')), false);
  assert.equal(
    fs.readdirSync(path.join(aiDir, 'prompts', 'archive')).some((name) => name.includes('refinement')),
    false,
  );
});
