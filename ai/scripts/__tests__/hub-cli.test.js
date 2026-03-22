const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { KEEP_COUNT } = require('../cleanup');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
// doctor warns when AI dir exceeds 250MB (ai/scripts/hub.js, commandDoctor)
const DOCTOR_LARGE_DIR_TEST_BYTES = 260 * 1024 * 1024;

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createHubRoot() {
  const hubRoot = mkTmpDir('hub-root-');
  fs.mkdirSync(path.join(hubRoot, 'ai', 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(hubRoot, 'ai', 'logs'), { recursive: true });

  fs.writeFileSync(
    path.join(hubRoot, 'ai', 'context.json'),
    JSON.stringify({ fullFiles: ['README.md'], lightFiles: ['README.md'], exclude: 'find . -maxdepth 2 -type f' }),
  );
  fs.writeFileSync(path.join(hubRoot, 'ai', 'agents.json'), JSON.stringify({ agents: [] }));
  fs.writeFileSync(path.join(hubRoot, 'ai', 'architecture-rules.json'), JSON.stringify({ targets: ['src'] }));
  return hubRoot;
}

function runHub(repoRoot, args, options = {}) {
  const script = path.join(repoRoot, 'ai', 'scripts', 'hub.js');
  const captureDir = mkTmpDir('hub-cli-output-');
  const stdoutPath = path.join(captureDir, 'stdout.log');
  const stderrPath = path.join(captureDir, 'stderr.log');
  const outFd = fs.openSync(stdoutPath, 'w');
  const errFd = fs.openSync(stderrPath, 'w');

  try {
    const result = spawnSync('node', [script, ...args], {
      cwd: repoRoot,
      ...options,
      stdio: ['ignore', outFd, errFd],
    });

    const stdout = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, 'utf8') : '';
    const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8') : '';

    return {
      ...result,
      stdout,
      stderr,
    };
  } finally {
    fs.closeSync(outFd);
    fs.closeSync(errFd);
    fs.rmSync(captureDir, { recursive: true, force: true });
  }
}

function setupHubWithProject(prefix = 'hub-project-') {
  const hubRoot = createHubRoot();
  const projectPath = mkTmpDir(prefix);
  const add = runHub(REPO_ROOT, ['add', `--path=${projectPath}`, `--hub-root=${hubRoot}`]);
  assert.equal(add.status, 0, add.stderr);
  return { hubRoot, projectPath };
}

function setupHubWithProjects(prefixes) {
  const hubRoot = createHubRoot();
  const projects = prefixes.map((prefix) => mkTmpDir(prefix));
  for (const projectPath of projects) {
    const add = runHub(REPO_ROOT, ['add', `--path=${projectPath}`, `--hub-root=${hubRoot}`]);
    assert.equal(add.status, 0, add.stderr);
  }
  return { hubRoot, projects };
}

function writeGcFixtures(projectPath) {
  const aiRoot = path.join(projectPath, '.ai');
  fs.mkdirSync(path.join(aiRoot, 'prompts', 'metrics'), { recursive: true });
  fs.mkdirSync(path.join(aiRoot, 'prompts', 'archive'), { recursive: true });
  fs.writeFileSync(path.join(aiRoot, '.context_cache.json'), '{"cache":1}');
  fs.writeFileSync(path.join(aiRoot, 'prompts', 'result.txt'), 'result');
  fs.writeFileSync(path.join(aiRoot, 'prompts', 'result-warning.txt'), 'warn');
  fs.writeFileSync(path.join(aiRoot, 'prompts', 'metrics', 'latest.json'), '{"ok":true}');
  fs.writeFileSync(
    path.join(aiRoot, 'prompts', 'metrics', 'history.json'),
    JSON.stringify([{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }], null, 2),
  );

  const oldArchive = path.join(aiRoot, 'prompts', 'archive', 'old.txt');
  const newArchive = path.join(aiRoot, 'prompts', 'archive', 'new.txt');
  fs.writeFileSync(oldArchive, 'old');
  fs.writeFileSync(newArchive, 'new');

  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  fs.utimesSync(oldArchive, oldDate, oldDate);
}

function writeCleanupArchiveFixtures(archiveDir, count) {
  fs.mkdirSync(archiveDir, { recursive: true });
  for (let i = 1; i <= count; i += 1) {
    const fileName = `cleanup-${String(i).padStart(2, '0')}.txt`;
    const filePath = path.join(archiveDir, fileName);
    fs.writeFileSync(filePath, fileName);
    const ts = new Date(Date.now() + i * 1000);
    fs.utimesSync(filePath, ts, ts);
  }
}

function seedIndexableSource(projectPath, fileName = 'sample.js', contents = 'module.exports = 1;\n') {
  const srcDir = path.join(projectPath, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, fileName), contents);
}

test('hub add registers project and creates split-root scaffold', () => {
  const hubRoot = createHubRoot();
  const projectPath = mkTmpDir('hub-project-');

  const add = runHub(REPO_ROOT, ['add', `--path=${projectPath}`, `--hub-root=${hubRoot}`]);
  assert.equal(add.status, 0, add.stderr);

  const registryPath = path.join(hubRoot, 'config', 'projects.json');
  assert.equal(fs.existsSync(registryPath), true);
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.equal(Array.isArray(registry.projects), true);
  assert.equal(registry.projects.length, 1);

  assert.equal(fs.existsSync(path.join(projectPath, '.ai', '.gitignore')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', 'context.json')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', 'agents.json')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', 'architecture-rules.json')), true);
  assert.equal(fs.existsSync(path.join(projectPath, '.ai', 'logs', 'AI_LOG.md')), true);
});

test('hub doctor fails for missing .ai in project', () => {
  const hubRoot = createHubRoot();
  const projectPath = mkTmpDir('hub-doctor-');

  const doctor = runHub(REPO_ROOT, ['doctor', `--project-path=${projectPath}`, `--hub-root=${hubRoot}`]);
  assert.equal(doctor.status, 1);
});

test('hub doctor succeeds for scaffolded project', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-doctor-ok-');

  const doctor = runHub(REPO_ROOT, ['doctor', `--project-path=${projectPath}`, `--hub-root=${hubRoot}`]);
  assert.equal(doctor.status, 0, doctor.stderr);
});

test('hub add rejects nested project path', () => {
  const hubRoot = createHubRoot();
  const parentProject = mkTmpDir('hub-parent-');
  const childProject = path.join(parentProject, 'child');
  fs.mkdirSync(childProject, { recursive: true });

  const addParent = runHub(REPO_ROOT, ['add', `--path=${parentProject}`, `--hub-root=${hubRoot}`]);
  assert.equal(addParent.status, 0, addParent.stderr);

  const addChild = runHub(REPO_ROOT, ['add', `--path=${childProject}`, `--hub-root=${hubRoot}`]);
  assert.notEqual(addChild.status, 0, 'Should reject nested path');
});

test('hub list shows registered projects', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-list-');
  const list = runHub(REPO_ROOT, ['list', `--hub-root=${hubRoot}`]);
  assert.equal(list.status, 0);
  const registryPath = path.join(hubRoot, 'config', 'projects.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.equal(registry.projects.length, 1);
  assert.equal(registry.projects[0].path, projectPath);
});

test('hub start writes active project into hub-config.json', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-start-config-');

  const start = runHub(REPO_ROOT, ['start', `--hub-root=${hubRoot}`]);
  assert.equal(start.status, 0, start.stderr);

  const hubConfigPath = path.join(hubRoot, 'config', 'hub-config.json');
  assert.equal(fs.existsSync(hubConfigPath), true);
  const hubConfig = JSON.parse(fs.readFileSync(hubConfigPath, 'utf8'));
  assert.equal(hubConfig.activeProjectPath, projectPath);
});

test('hub stats command succeeds', () => {
  const { hubRoot } = setupHubWithProject('hub-stats-');

  const stats = runHub(REPO_ROOT, ['stats', `--hub-root=${hubRoot}`]);
  assert.equal(stats.status, 0, stats.stderr);
});

test('hub gc dry-run keeps files intact', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-gc-dry-');
  writeGcFixtures(projectPath);

  const cachePath = path.join(projectPath, '.ai', '.context_cache.json');
  const oldArchive = path.join(projectPath, '.ai', 'prompts', 'archive', 'old.txt');
  const historyPath = path.join(projectPath, '.ai', 'prompts', 'metrics', 'history.json');

  const gc = runHub(REPO_ROOT, ['gc', '--dry-run', '--archive-days=30', '--metrics-keep=2', `--hub-root=${hubRoot}`]);
  assert.equal(gc.status, 0, gc.stderr);
  assert.equal(fs.existsSync(cachePath), true);
  assert.equal(fs.existsSync(oldArchive), true);
  assert.equal(JSON.parse(fs.readFileSync(historyPath, 'utf8')).length, 4);
});

test('hub gc removes transient files and trims metrics history', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-gc-run-');
  writeGcFixtures(projectPath);

  const aiRoot = path.join(projectPath, '.ai');
  const cachePath = path.join(aiRoot, '.context_cache.json');
  const resultPath = path.join(aiRoot, 'prompts', 'result.txt');
  const warningPath = path.join(aiRoot, 'prompts', 'result-warning.txt');
  const latestPath = path.join(aiRoot, 'prompts', 'metrics', 'latest.json');
  const oldArchive = path.join(aiRoot, 'prompts', 'archive', 'old.txt');
  const newArchive = path.join(aiRoot, 'prompts', 'archive', 'new.txt');
  const historyPath = path.join(aiRoot, 'prompts', 'metrics', 'history.json');

  const gc = runHub(REPO_ROOT, ['gc', '--archive-days=30', '--metrics-keep=2', `--hub-root=${hubRoot}`]);
  assert.equal(gc.status, 0, gc.stderr);
  assert.equal(fs.existsSync(cachePath), false);
  assert.equal(fs.existsSync(resultPath), false);
  assert.equal(fs.existsSync(warningPath), false);
  assert.equal(fs.existsSync(latestPath), false);
  assert.equal(fs.existsSync(oldArchive), false);
  assert.equal(fs.existsSync(newArchive), true);
  assert.equal(JSON.parse(fs.readFileSync(historyPath, 'utf8')).length, 2);
});

test('hub status with explicit --project-path bypasses broken hub-config', () => {
  const { hubRoot, projects } = setupHubWithProjects(['hub-precedence-a-', 'hub-precedence-b-']);
  const [projectA, projectB] = projects;

  const hubConfigPath = path.join(hubRoot, 'config', 'hub-config.json');
  fs.writeFileSync(hubConfigPath, '{ broken json');

  const broken = runHub(REPO_ROOT, ['status', `--hub-root=${hubRoot}`]);
  assert.notEqual(broken.status, 0);

  const explicit = runHub(REPO_ROOT, ['status', `--project-path=${projectB}`, `--hub-root=${hubRoot}`]);
  assert.equal(explicit.status, 0, explicit.stderr);
  const explicitA = runHub(REPO_ROOT, ['status', `--project-path=${projectA}`, `--hub-root=${hubRoot}`]);
  assert.equal(explicitA.status, 0, explicitA.stderr);
});

test('hub status fails on invalid config/hub-config.json', () => {
  const { hubRoot } = setupHubWithProject('hub-invalid-config-');

  const hubConfigPath = path.join(hubRoot, 'config', 'hub-config.json');
  fs.writeFileSync(hubConfigPath, '{ broken json');

  const status = runHub(REPO_ROOT, ['status', `--hub-root=${hubRoot}`]);
  assert.notEqual(status.status, 0);
});

test('hub start in non-TTY with multiple projects asks for --select', () => {
  const { hubRoot } = setupHubWithProjects(['hub-start-nontty-a-', 'hub-start-nontty-b-']);

  const start = runHub(REPO_ROOT, ['start', `--hub-root=${hubRoot}`]);
  assert.equal(start.status, 0, start.stderr);
  assert.equal(fs.existsSync(path.join(hubRoot, 'config', 'hub-config.json')), false);
  assert.match(`${start.stdout}\n${start.stderr}`, /--select=N/);
});

test('hub doctor warns on legacy ai/ layout', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-doctor-legacy-ai-');

  const dotAi = path.join(projectPath, '.ai');
  const legacyAi = path.join(projectPath, 'ai');
  fs.cpSync(dotAi, legacyAi, { recursive: true });
  fs.rmSync(dotAi, { recursive: true, force: true });

  const doctor = runHub(REPO_ROOT, ['doctor', `--project-path=${projectPath}`, `--hub-root=${hubRoot}`]);
  assert.equal(doctor.status, 0, doctor.stderr);
});

test('hub doctor warns on large AI data directory', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-doctor-large-');

  const bigFile = path.join(projectPath, '.ai', 'logs', 'big.bin');
  fs.writeFileSync(bigFile, '');
  fs.truncateSync(bigFile, DOCTOR_LARGE_DIR_TEST_BYTES);

  const doctor = runHub(REPO_ROOT, ['doctor', `--project-path=${projectPath}`, `--hub-root=${hubRoot}`]);
  assert.equal(doctor.status, 0, doctor.stderr);
});

test('hub run --mode=index creates code index for explicit project path', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-run-index-');
  seedIndexableSource(projectPath, 'sample.js', 'function sample() { return 1; }\n');

  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=index',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(fs.existsSync(path.join(projectPath, '.ai', '.code_index.json')), true);
});

test('hub run uses active project from hub-config when project path is omitted', () => {
  const { hubRoot, projects } = setupHubWithProjects(['hub-run-active-a-', 'hub-run-active-b-']);
  const [projectA, projectB] = projects;
  seedIndexableSource(projectA, 'a.js', 'module.exports = 1;\n');
  seedIndexableSource(projectB, 'b.js', 'module.exports = 2;\n');

  fs.mkdirSync(path.join(hubRoot, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(hubRoot, 'config', 'hub-config.json'),
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      activeProjectPath: projectB,
    }, null, 2),
  );

  const run = runHub(REPO_ROOT, ['run', '--mode=index', `--hub-root=${hubRoot}`]);
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(fs.existsSync(path.join(projectB, '.ai', '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(projectA, '.ai', '.code_index.json')), false);
});

test('hub run precedence: explicit --project-path overrides AI_HUB_PROJECT_PATH and hub-config', () => {
  const { hubRoot, projects } = setupHubWithProjects(['hub-run-explicit-a-', 'hub-run-explicit-b-']);
  const [projectA, projectB] = projects;
  seedIndexableSource(projectA, 'a.js', 'module.exports = "A";\n');
  seedIndexableSource(projectB, 'b.js', 'module.exports = "B";\n');

  fs.mkdirSync(path.join(hubRoot, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(hubRoot, 'config', 'hub-config.json'),
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      activeProjectPath: projectB,
    }, null, 2),
  );

  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=index',
    `--project-path=${projectA}`,
    `--hub-root=${hubRoot}`,
  ], {
    env: {
      ...process.env,
      AI_HUB_PROJECT_PATH: projectB,
    },
  });

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(fs.existsSync(path.join(projectA, '.ai', '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(projectB, '.ai', '.code_index.json')), false);
});

test('hub run precedence: AI_HUB_PROJECT_PATH overrides hub-config active project', () => {
  const { hubRoot, projects } = setupHubWithProjects(['hub-run-env-a-', 'hub-run-env-b-']);
  const [projectA, projectB] = projects;
  seedIndexableSource(projectA, 'a.js', 'module.exports = "A";\n');
  seedIndexableSource(projectB, 'b.js', 'module.exports = "B";\n');

  fs.mkdirSync(path.join(hubRoot, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(hubRoot, 'config', 'hub-config.json'),
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      activeProjectPath: projectA,
    }, null, 2),
  );

  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=index',
    `--hub-root=${hubRoot}`,
  ], {
    env: {
      ...process.env,
      AI_HUB_PROJECT_PATH: projectB,
    },
  });

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(fs.existsSync(path.join(projectB, '.ai', '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(projectA, '.ai', '.code_index.json')), false);
});

test('hub run precedence: registry lastUsed is used when explicit/env/config are absent', () => {
  const { hubRoot, projects } = setupHubWithProjects(['hub-run-registry-a-', 'hub-run-registry-b-']);
  const [projectA, projectB] = projects;
  seedIndexableSource(projectA, 'a.js', 'module.exports = "A";\n');
  seedIndexableSource(projectB, 'b.js', 'module.exports = "B";\n');

  const registryPath = path.join(hubRoot, 'config', 'projects.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const target = registry.projects.find((project) => project.path === projectB);
  const other = registry.projects.find((project) => project.path === projectA);
  target.lastUsed = '2026-03-04T12:00:00.000Z';
  other.lastUsed = '2026-03-01T12:00:00.000Z';
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=index',
    `--hub-root=${hubRoot}`,
  ], {
    env: {
      ...process.env,
      AI_HUB_PROJECT_PATH: '',
    },
  });

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(fs.existsSync(path.join(projectB, '.ai', '.code_index.json')), true);
  assert.equal(fs.existsSync(path.join(projectA, '.ai', '.code_index.json')), false);
});

test('hub run --mode=memory forwards passthrough args', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-run-memory-');
  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=memory',
    '--help',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(`${run.stdout}\n${run.stderr}`, /Usage: npm run undes:memory/);
});

test('hub run --mode=memory propagates in-process exit code on validation failure', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-run-memory-fail-');
  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=memory',
    '--log=unknown',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);

  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}\n${run.stderr}`, /No valid logs selected/);
});

test('hub run --mode=arch-check forwards passthrough args', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-run-arch-check-');
  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=arch-check',
    '--help',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(`${run.stdout}\n${run.stderr}`, /Usage: node ai\/scripts\/architecture-check\.js/);
});

test('hub run --mode=init forwards dry-run and does not write active files', () => {
  const hubRoot = createHubRoot();
  const projectPath = mkTmpDir('hub-run-init-');
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ name: 'tmp', version: '1.0.0' }));

  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=init',
    '--dry-run',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', 'context.json')), false);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', 'agents.json')), false);
  assert.equal(fs.existsSync(path.join(projectPath, 'ai', 'llms.md')), false);
  assert.equal(fs.existsSync(path.join(projectPath, '.cursorrules')), false);
});

test('hub run --mode=clean cleans .ai runs directory', () => {
  const { hubRoot, projectPath } = setupHubWithProject('hub-run-clean-');
  const runsDir = path.join(projectPath, '.ai', 'prompts', 'runs');
  writeCleanupArchiveFixtures(runsDir, KEEP_COUNT + 2);

  const run = runHub(REPO_ROOT, [
    'run',
    '--mode=clean',
    `--project-path=${projectPath}`,
    `--hub-root=${hubRoot}`,
  ]);

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(fs.readdirSync(runsDir).length, KEEP_COUNT);
});
