const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createHubRoot() {
  const hubRoot = mkTmpDir('bootstrap-hub-');
  fs.mkdirSync(path.join(hubRoot, 'ai', 'scripts'), { recursive: true });
  fs.writeFileSync(
    path.join(hubRoot, 'ai', 'context.json'),
    JSON.stringify({
      fullFiles: ['README.md'],
      lightFiles: ['README.md'],
      exclude: 'find . -maxdepth 2 -type f',
    }, null, 2),
  );
  fs.writeFileSync(path.join(hubRoot, 'ai', 'agents.json'), JSON.stringify({ agents: [] }, null, 2));
  return hubRoot;
}

function runHub(repoRoot, args, options = {}) {
  const script = path.join(repoRoot, 'ai', 'scripts', 'hub.js');
  const captureDir = mkTmpDir('bootstrap-hub-run-');
  const stdoutPath = path.join(captureDir, 'stdout.log');
  const stderrPath = path.join(captureDir, 'stderr.log');
  const outFd = fs.openSync(stdoutPath, 'w');
  const errFd = fs.openSync(stderrPath, 'w');

  try {
    const result = spawnSync('node', [script, ...args], {
      cwd: repoRoot,
      ...options,
      env: {
        ...process.env,
        AI_HUB_PROJECT_PATH: '',
        _AI_DISPATCHER_RESOLVED: '1',
        ...(options.env || {}),
      },
      stdio: ['ignore', outFd, errFd],
    });

    const stdout = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, 'utf8') : '';
    const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8') : '';
    return { ...result, stdout, stderr };
  } finally {
    fs.closeSync(outFd);
    fs.closeSync(errFd);
    fs.rmSync(captureDir, { recursive: true, force: true });
  }
}

test('bootstrap smoke: brand-new project init then hub index writes runtime output to .ai without legacy warning', () => {
  const hubRoot = createHubRoot();
  const projectPath = mkTmpDir('bootstrap-project-');

  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ name: 'tmp', version: '1.0.0' }));
  fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectPath, 'src', 'sample.js'), 'module.exports = 1;\n');

  const initRun = runHub(REPO_ROOT, [
    'run',
    '--mode=init',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);
  assert.equal(initRun.status, 0, `${initRun.stdout}\n${initRun.stderr}`);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', 'context.json')), true);
  assert.equal(fs.existsSync(path.join(projectPath, '.ai', 'logs')), true);
  assert.equal(fs.existsSync(path.join(projectPath, '.ai', 'prompts', 'run')), true);

  const indexRun = runHub(REPO_ROOT, [
    'run',
    '--mode=index',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);
  const output = `${indexRun.stdout}\n${indexRun.stderr}`;
  assert.equal(indexRun.status, 0, output);
  assert.doesNotMatch(output, /Legacy ai\/ layout detected/);
  assert.equal(fs.existsSync(path.join(projectPath, '.ai', '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', '.code_index.json')), false);
});
