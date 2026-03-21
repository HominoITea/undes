const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runGenerateContext(cwd, args, options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..', '..', '..', '..');
  const script = path.join(repoRoot, 'ai', 'scripts', 'generate-context.js');
  const captureDir = mkTmpDir('genctx-output-');
  const stdoutPath = path.join(captureDir, 'stdout.log');
  const stderrPath = path.join(captureDir, 'stderr.log');
  const outFd = fs.openSync(stdoutPath, 'w');
  const errFd = fs.openSync(stderrPath, 'w');

  try {
    const result = spawnSync('node', [script, ...args], {
      cwd,
      env: {
        ...process.env,
        AI_HUB_PROJECT_PATH: '',
        AI_PROJECT_DATA_DIR: '',
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

module.exports = {
  runGenerateContext,
};
