#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const {
  resolveHubRoot,
  canonicalProjectPath,
  makeProjectId,
  normalizeForCompare,
  isSameOrSubPath,
  resolveProjectLayout,
  safeJoinProjectData,
} = require('./path-utils');
const {
  resolveHubFileForRead,
  resolveHubFileForWrite,
} = require('./hub-config-paths');
const { detectAstGrepBinary } = require('./structural-search');

const RAW_ARGS = process.argv.slice(2);
const HUB_ROOT = resolveHubRoot(RAW_ARGS, process.cwd());
const HUB_AI_DIR = path.join(HUB_ROOT, 'ai');

const DEFAULT_REGISTRY = {
  version: 1,
  updatedAt: '',
  projects: [],
};

const DEFAULT_HUB_CONFIG = {
  version: 1,
  updatedAt: '',
  activeProjectPath: '',
};

const LOG_FILES = [
  'AI_LOG.md',
  'AI_PLAN_LOG.md',
  'AI_PROPOSAL_LOG.md',
  'AI_DISCUSSION_LOG.md',
  'AI_CHANGE_LOG.md',
  'AI_ERROR_LOG.md',
];

const LOG_TEMPLATES = {
  'AI_LOG.md': '# Global AI Interaction Log (Project Scope)\n\n## LOG ENTRIES\n',
  'AI_PLAN_LOG.md': '# AI Plan Log\n\n## LOG ENTRIES\n',
  'AI_PROPOSAL_LOG.md': '# AI Proposal Log\n\n## LOG ENTRIES\n',
  'AI_DISCUSSION_LOG.md': '# AI Discussion Log\n\n## LOG ENTRIES\n',
  'AI_CHANGE_LOG.md': '# AI Change Log\n\n## LOG ENTRIES\n',
  'AI_ERROR_LOG.md': '# AI Error Log\n\n## LOG ENTRIES\n',
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const rawArgs = args.slice(1);
  const command = args[0] || 'help';
  const options = {};

  for (const arg of rawArgs) {
    if (!arg.startsWith('--')) continue;
    const idx = arg.indexOf('=');
    if (idx === -1) {
      options[arg.slice(2)] = true;
      continue;
    }
    const key = arg.slice(2, idx);
    const value = arg.slice(idx + 1);
    options[key] = value;
  }

  return { command, options, rawArgs };
}

function nowIso() {
  return new Date().toISOString();
}

function getRegistryReadPath() {
  return resolveHubFileForRead(HUB_ROOT, 'projects.json');
}

function getRegistryWritePath() {
  return resolveHubFileForWrite(HUB_ROOT, 'projects.json');
}

function getHubConfigReadPath() {
  return resolveHubFileForRead(HUB_ROOT, 'hub-config.json');
}

function getHubConfigWritePath() {
  return resolveHubFileForWrite(HUB_ROOT, 'hub-config.json');
}

function ensureRegistryFile() {
  const existing = getRegistryReadPath();
  if (existing && fs.existsSync(existing)) return;
  writeRegistry(DEFAULT_REGISTRY);
}

function loadRegistry() {
  ensureRegistryFile();
  const registryPath = getRegistryReadPath();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid projects.json: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid projects.json: root must be object.');
  }
  if (!Array.isArray(parsed.projects)) {
    throw new Error('Invalid projects.json: "projects" must be array.');
  }

  return {
    version: Number(parsed.version || 1),
    updatedAt: String(parsed.updatedAt || ''),
    projects: parsed.projects.map((entry) => ({
      projectId: String(entry.projectId || ''),
      path: String(entry.path || ''),
      displayName: String(entry.displayName || ''),
      status: String(entry.status || 'active'),
      createdAt: String(entry.createdAt || ''),
      lastUsed: String(entry.lastUsed || ''),
      archivedAt: entry.archivedAt ? String(entry.archivedAt) : '',
    })),
  };
}

function writeRegistry(registry) {
  const registryPath = getRegistryWritePath();
  const payload = {
    version: registry.version || 1,
    updatedAt: nowIso(),
    projects: registry.projects || [],
  };

  const tmpPath = `${registryPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tmpPath, registryPath);
}

function loadHubConfig() {
  const hubConfigPath = getHubConfigReadPath();
  if (!hubConfigPath || !fs.existsSync(hubConfigPath)) {
    return { ...DEFAULT_HUB_CONFIG };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(hubConfigPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid hub-config.json: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid hub-config.json: root must be object.');
  }

  return {
    version: Number(parsed.version || 1),
    updatedAt: String(parsed.updatedAt || ''),
    activeProjectPath: String(parsed.activeProjectPath || ''),
  };
}

function writeHubConfig(config) {
  const hubConfigPath = getHubConfigWritePath();
  const payload = {
    version: Number(config.version || 1),
    updatedAt: nowIso(),
    activeProjectPath: String(config.activeProjectPath || ''),
  };

  const tmpPath = `${hubConfigPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tmpPath, hubConfigPath);
}

function setActiveProjectPath(projectPath) {
  const hubConfig = loadHubConfig();
  hubConfig.activeProjectPath = String(projectPath || '').trim();
  writeHubConfig(hubConfig);
}

function ensureNoNestedConflict(registry, candidatePath, candidateId) {
  for (const project of registry.projects) {
    if (!project.path || project.status === 'archived') continue;
    if (candidateId && project.projectId === candidateId) continue;
    const existingPath = normalizeForCompare(project.path);
    if (!existingPath) continue;

    if (isSameOrSubPath(existingPath, candidatePath) || isSameOrSubPath(candidatePath, existingPath)) {
      throw new Error(
        `Path conflict with existing project "${project.displayName || project.projectId}" (${project.path}). ` +
        'Nested project paths are not allowed.',
      );
    }
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFile(filePath, content) {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, content);
}

function copyIfMissing(srcPath, dstPath) {
  if (!fs.existsSync(srcPath) || fs.existsSync(dstPath)) return;
  ensureDir(path.dirname(dstPath));
  fs.copyFileSync(srcPath, dstPath);
}

function ensureRootGitignoreRule(projectPath, rule) {
  const gitignorePath = path.join(projectPath, '.gitignore');
  const normalizedRule = String(rule || '').trim();
  if (!normalizedRule) return;

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${normalizedRule}\n`);
    return;
  }

  const current = fs.readFileSync(gitignorePath, 'utf8');
  const lines = current.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(normalizedRule) || lines.includes(normalizedRule.replace(/\/$/, ''))) {
    return;
  }

  const suffix = current.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(gitignorePath, `${suffix}${normalizedRule}\n`);
}

function scaffoldProjectAi(projectPath) {
  const layout = resolveProjectLayout(projectPath);
  const sourceRoot = layout.sourceRoot;
  const aiRoot = layout.runtimeRoot;
  const logsDir = layout.logsDir;
  const promptsDir = layout.promptsDir;
  const metricsDir = layout.metricsDir;
  const runsDir = layout.runsDir;

  ensureDir(sourceRoot);
  ensureDir(aiRoot);
  ensureDir(logsDir);
  ensureDir(promptsDir);
  ensureDir(metricsDir);
  ensureDir(runsDir);

  ensureFile(path.join(aiRoot, '.gitignore'), '*\n');

  copyIfMissing(path.join(HUB_AI_DIR, 'agents.json'), layout.agentsConfigPath);
  copyIfMissing(path.join(HUB_AI_DIR, 'context.json'), layout.contextConfigPath);
  copyIfMissing(path.join(HUB_AI_DIR, 'architecture-rules.json'), layout.architectureRulesPath);

  for (const fileName of LOG_FILES) {
    const projectLog = path.join(logsDir, fileName);
    ensureFile(projectLog, LOG_TEMPLATES[fileName] || `# ${fileName}\n\n## LOG ENTRIES\n`);
  }

  ensureRootGitignoreRule(projectPath, '.ai/');
}

function updateProjectLastUsed(project, status = 'active') {
  project.lastUsed = nowIso();
  project.status = status;
}

function detectProjectHealth(project) {
  if (!project || !project.path) {
    return { status: 'broken', reason: 'missing path' };
  }
  if (project.status === 'archived') {
    return { status: 'archived', reason: '' };
  }

  if (!fs.existsSync(project.path)) {
    return { status: 'broken', reason: 'path not found' };
  }

  const layout = resolveProjectLayout(project.path);
  const aiRoot = layout.runtimeRoot;
  if (!fs.existsSync(aiRoot)) {
    return { status: 'broken', reason: `missing ${path.relative(project.path, aiRoot) || '.ai'} folder` };
  }
  if (!fs.existsSync(layout.contextConfigPath)) {
    return { status: 'broken', reason: `missing ${path.relative(project.path, layout.contextConfigPath)}` };
  }

  return { status: 'active', reason: '' };
}

function readEntriesCount(logPath) {
  if (!fs.existsSync(logPath)) return 0;
  const raw = fs.readFileSync(logPath, 'utf8');
  const matches = raw.match(/^##\s+\[/gm);
  return matches ? matches.length : 0;
}

function dirSizeBytes(rootDir) {
  if (!fs.existsSync(rootDir)) return 0;
  let total = 0;
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function parseNonNegativeInt(options, key, fallback) {
  if (options[key] === undefined || options[key] === null || String(options[key]).trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(options[key]).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid --${key} value: ${options[key]}`);
  }
  return parsed;
}

function getProjectTargets(registry, options = {}) {
  if (options['project-path']) {
    const canonical = canonicalProjectPath(options['project-path'], HUB_ROOT);
    const existing = registry.projects.find((project) => normalizeForCompare(project.path) === normalizeForCompare(canonical));
    if (existing) return [existing];
    return [{
      projectId: makeProjectId(canonical),
      path: canonical,
      displayName: path.basename(canonical),
      status: 'active',
      createdAt: '',
      lastUsed: '',
      archivedAt: '',
    }];
  }
  return registry.projects;
}

function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile()) out.push(fullPath);
    }
  }
  return out;
}

function printHelp() {
  console.log('AI Hub CLI (initial)');
  console.log('');
  console.log('Usage:');
  console.log('  npm run ai:<command> -- [options] [--hub-root=/abs/hub]');
  console.log('  npm run ai -- [--prompt="..."] [--project-path=/abs/project/path]');
  console.log('  npm run ai:light -- [--prompt="..."] [--project-path=/abs/project/path]');
  console.log('  npm run ai:index -- [--project-path=/abs/project/path]');
  console.log('  npm run ai:pack -- [--project-path=/abs/project/path]');
  console.log('');
  console.log('Commands:');
  console.log('  run [--mode=default|light|index|pack|memory|init|clean|arch-check] [--project-path=/abs/project/path]');
  console.log('  add --path=/abs/project/path [--name=Display Name]');
  console.log('  list');
  console.log('  start [--select=N]');
  console.log('  status [--project-path=/abs/project/path]');
  console.log('  doctor --project-path=/abs/project/path');
  console.log('  stats [--project-path=/abs/project/path]');
  console.log('  gc [--project-path=/abs/project/path] [--dry-run] [--archive-days=30] [--metrics-keep=200]');
  console.log('  help');
}

const RUN_MODE_TARGETS = {
  default: { script: 'generate-context.js', baseArgs: [], transport: 'spawn' },
  light: { script: 'generate-context.js', baseArgs: ['--light'], transport: 'spawn' },
  index: { script: 'generate-context.js', baseArgs: ['--index-only'], transport: 'spawn' },
  pack: { script: 'generate-context.js', baseArgs: ['--context-pack-only'], transport: 'spawn' },
  memory: { script: 'memory.js', baseArgs: [], transport: 'require' },
  init: { script: 'init-project.js', baseArgs: [], transport: 'require' },
  clean: { script: 'cleanup.js', baseArgs: [], transport: 'require' },
  'arch-check': { script: 'architecture-check.js', baseArgs: [], transport: 'require' },
};

function shouldSkipRunArg(arg) {
  return (
    arg.startsWith('--mode=') ||
    arg.startsWith('--project-path=') ||
    arg.startsWith('--hub-root=')
  );
}

function createRunEnv(projectPath) {
  return {
    ...process.env,
    AI_HUB_PROJECT_PATH: projectPath,
    _AI_DISPATCHER_RESOLVED: '1',
  };
}

async function withProcessExitCapture(run) {
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;
  process.exit = (code) => {
    const error = new Error(`EXIT:${code}`);
    error.hubExitCode = Number.isFinite(code) ? code : 1;
    throw error;
  };
  process.exitCode = 0;

  try {
    await run();
    return { status: Number.isFinite(process.exitCode) ? process.exitCode : 0 };
  } catch (error) {
    if (Number.isFinite(error?.hubExitCode)) {
      return { status: error.hubExitCode };
    }
    throw error;
  } finally {
    process.exit = originalExit;
    process.exitCode = originalExitCode;
  }
}

async function runModeViaRequire(target, scriptPath, passthroughArgs, projectPath) {
  const scriptModule = require(scriptPath);
  if (!scriptModule || typeof scriptModule.main !== 'function') {
    throw new Error(`Require transport expected exported main() in: ${scriptPath}`);
  }

  const argv = [
    process.execPath,
    scriptPath,
    ...target.baseArgs,
    ...passthroughArgs,
    `--project-path=${projectPath}`,
    `--hub-root=${HUB_ROOT}`,
  ];
  const env = createRunEnv(projectPath);

  return withProcessExitCapture(() => scriptModule.main({
    argv,
    env,
    projectPath,
    hubRoot: HUB_ROOT,
  }));
}

function runModeViaSpawn(target, scriptPath, passthroughArgs, projectPath) {
  const childArgs = [
    scriptPath,
    ...target.baseArgs,
    ...passthroughArgs,
    `--project-path=${projectPath}`,
    `--hub-root=${HUB_ROOT}`,
  ];

  return spawnSync(process.execPath, childArgs, {
    cwd: projectPath,
    stdio: 'inherit',
    env: createRunEnv(projectPath),
  });
}

function resolveProjectPathForRun(options = {}) {
  const explicit = String(options['project-path'] || '').trim();
  if (explicit) {
    return canonicalProjectPath(explicit, HUB_ROOT);
  }

  const envPath = String(process.env.AI_HUB_PROJECT_PATH || '').trim();
  if (envPath) {
    return canonicalProjectPath(envPath, HUB_ROOT);
  }

  try {
    const hubConfig = loadHubConfig();
    const activePath = String(hubConfig.activeProjectPath || '').trim();
    if (activePath && fs.existsSync(activePath) && fs.statSync(activePath).isDirectory()) {
      return canonicalProjectPath(activePath, HUB_ROOT);
    }
  } catch (error) {
    console.warn(`⚠️ ${error.message}. Falling back to registry lastUsed.`);
  }

  const registry = loadRegistry();
  const candidate = [...registry.projects]
    .filter((project) => project.status !== 'archived' && project.path)
    .filter((project) => fs.existsSync(project.path) && fs.statSync(project.path).isDirectory())
    .sort((a, b) => String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')))[0];

  if (candidate) {
    return canonicalProjectPath(candidate.path, HUB_ROOT);
  }

  throw new Error(
    'No project selected/found. Use one of: ' +
    '`npm run ai:start`, `npm run ai:add -- --path=/abs/project/path`, or `--project-path=/abs/project/path`.',
  );
}

function touchProjectSelection(projectPath) {
  setActiveProjectPath(projectPath);
  const registry = loadRegistry();
  const target = registry.projects.find((project) => normalizeForCompare(project.path) === normalizeForCompare(projectPath));
  if (!target) return;
  updateProjectLastUsed(target, 'active');
  writeRegistry(registry);
}

async function commandRun(options, rawArgs = []) {
  const modeRaw = String(options.mode || 'default').trim().toLowerCase();
  const mode = modeRaw || 'default';
  const target = RUN_MODE_TARGETS[mode];
  if (!target) {
    throw new Error(`Unsupported --mode=${mode}. Allowed: ${Object.keys(RUN_MODE_TARGETS).join(', ')}`);
  }

  const projectPath = resolveProjectPathForRun(options);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    throw new Error(`Resolved project path does not exist: ${projectPath}`);
  }

  touchProjectSelection(projectPath);

  const hubScriptPath = path.join(HUB_AI_DIR, 'scripts', target.script);
  const localScriptPath = path.join(__dirname, target.script);
  const scriptPath = fs.existsSync(hubScriptPath) ? hubScriptPath : localScriptPath;
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `Target script not found: ${hubScriptPath} (hub root) and ${localScriptPath} (local fallback)`,
    );
  }

  const passthroughArgs = rawArgs.filter((arg) => !shouldSkipRunArg(arg));
  const result = target.transport === 'require'
    ? await runModeViaRequire(target, scriptPath, passthroughArgs, projectPath)
    : runModeViaSpawn(target, scriptPath, passthroughArgs, projectPath);

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    // Preserve child signal semantics for callers (same behavior as direct invocation).
    process.kill(process.pid, result.signal);
    return;
  }

  process.exitCode = Number.isFinite(result.status) ? result.status : 1;
}

function commandAdd(options) {
  const projectPath = canonicalProjectPath(options.path, HUB_ROOT);
  const displayName = String(options.name || path.basename(projectPath)).trim() || path.basename(projectPath);
  const projectId = makeProjectId(projectPath);

  const registry = loadRegistry();
  const existingByPath = registry.projects.find((project) => normalizeForCompare(project.path) === normalizeForCompare(projectPath));
  const existingById = registry.projects.find((project) => project.projectId === projectId);

  ensureNoNestedConflict(registry, projectPath, existingById ? existingById.projectId : '');
  scaffoldProjectAi(projectPath);

  if (existingByPath || existingById) {
    const target = existingByPath || existingById;
    target.path = projectPath;
    target.displayName = displayName;
    updateProjectLastUsed(target, 'active');
    writeRegistry(registry);
    console.log(`Updated project: ${target.displayName} (${target.projectId})`);
    console.log(`Path: ${target.path}`);
    return;
  }

  const createdAt = nowIso();
  registry.projects.push({
    projectId,
    path: projectPath,
    displayName,
    status: 'active',
    createdAt,
    lastUsed: createdAt,
    archivedAt: '',
  });

  writeRegistry(registry);
  console.log(`Added project: ${displayName} (${projectId})`);
  console.log(`Path: ${projectPath}`);
}

function commandList() {
  const registry = loadRegistry();
  if (!registry.projects.length) {
    console.log('No projects in registry. Use: npm run ai:add -- --path=/abs/project/path');
    return;
  }

  const sorted = [...registry.projects].sort((a, b) => {
    return String(b.lastUsed || '').localeCompare(String(a.lastUsed || ''));
  });

  console.log(`Projects (${sorted.length}):`);
  sorted.forEach((project, index) => {
    const health = detectProjectHealth(project);
    console.log(
      `${index + 1}. ${project.displayName || project.projectId} ` +
      `[${project.projectId}] status=${health.status} lastUsed=${project.lastUsed || 'n/a'}`,
    );
    console.log(`   ${project.path}`);
    if (health.reason) {
      console.log(`   reason: ${health.reason}`);
    }
  });
}

function getSelectedProject(registry, options = {}) {
  if (options['project-path']) {
    const canonical = canonicalProjectPath(options['project-path'], HUB_ROOT);
    return registry.projects.find((project) => normalizeForCompare(project.path) === normalizeForCompare(canonical)) || null;
  }

  const hubConfig = loadHubConfig();
  const activePath = String(hubConfig.activeProjectPath || '').trim();
  if (activePath) {
    const selectedByConfig = registry.projects.find((project) => {
      return normalizeForCompare(project.path) === normalizeForCompare(activePath);
    });
    if (selectedByConfig) return selectedByConfig;
  }

  const sorted = [...registry.projects].sort((a, b) => String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')));
  return sorted[0] || null;
}

function commandStatus(options) {
  const registry = loadRegistry();
  const selected = getSelectedProject(registry, options);

  if (!selected) {
    console.log('No project selected/found. Use: npm run ai:add -- --path=... or npm run ai:status -- --project-path=...');
    return;
  }

  const health = detectProjectHealth(selected);
  const layout = resolveProjectLayout(selected.path);
  const aiRoot = layout.runtimeRoot;
  const logPath = path.join(layout.logsDir, 'AI_LOG.md');
  const resultPath = layout.resultPath;

  const logEntries = readEntriesCount(logPath);
  const aiSize = dirSizeBytes(aiRoot);
  const lastRun = fs.existsSync(resultPath) ? fs.statSync(resultPath).mtime.toISOString() : 'n/a';

  console.log(`Project: ${selected.displayName || selected.projectId}`);
  console.log(`ID: ${selected.projectId}`);
  console.log(`Path: ${selected.path}`);
  console.log(`Health: ${health.status}${health.reason ? ` (${health.reason})` : ''}`);
  console.log(`Last used: ${selected.lastUsed || 'n/a'}`);
  console.log(`Log entries: ${logEntries}`);
  console.log(`Last run artifact: ${lastRun}`);
  console.log(`.ai size: ${formatBytes(aiSize)}`);
}

function commandStats(options) {
  const registry = loadRegistry();
  const targets = getProjectTargets(registry, options);
  if (!targets.length) {
    console.log('No projects in registry. Use: npm run ai:add -- --path=/abs/project/path');
    return;
  }

  const totals = {
    projects: 0,
    active: 0,
    archived: 0,
    broken: 0,
    totalSize: 0,
    totalLogs: 0,
  };
  const rows = [];

  for (const project of targets) {
    const health = detectProjectHealth(project);
    totals.projects += 1;
    if (health.status === 'active') totals.active += 1;
    else if (health.status === 'archived') totals.archived += 1;
    else totals.broken += 1;

    let aiSize = 0;
    let logEntries = 0;
    let lastRun = 'n/a';
    if (health.status === 'active') {
      const layout = resolveProjectLayout(project.path);
      aiSize = dirSizeBytes(layout.runtimeRoot);
      logEntries = readEntriesCount(path.join(layout.logsDir, 'AI_LOG.md'));
      const resultPath = layout.resultPath;
      if (fs.existsSync(resultPath)) {
        lastRun = fs.statSync(resultPath).mtime.toISOString();
      }
    }

    totals.totalSize += aiSize;
    totals.totalLogs += logEntries;
    rows.push({
      project,
      health,
      aiSize,
      logEntries,
      lastRun,
    });
  }

  console.log('Hub stats');
  console.log(`Projects: ${totals.projects} (active=${totals.active}, archived=${totals.archived}, broken=${totals.broken})`);
  console.log(`Total .ai size: ${formatBytes(totals.totalSize)}`);
  console.log(`Total AI_LOG entries: ${totals.totalLogs}`);
  console.log('');

  rows
    .sort((a, b) => b.aiSize - a.aiSize)
    .forEach((row, index) => {
      console.log(
        `${index + 1}. ${row.project.displayName || row.project.projectId} ` +
        `[${row.project.projectId}] health=${row.health.status}`,
      );
      console.log(`   path=${row.project.path}`);
      console.log(`   size=${formatBytes(row.aiSize)} logs=${row.logEntries} lastRun=${row.lastRun}`);
      if (row.health.reason) {
        console.log(`   reason=${row.health.reason}`);
      }
    });
}

function validateJson(filePath, label, validator = null) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof validator === 'function') {
      const errors = validator(parsed);
      if (errors.length > 0) {
        return { ok: false, message: `${label}: invalid schema (${errors.join('; ')})` };
      }
    }
    return { ok: true, message: `${label}: OK` };
  } catch (error) {
    return { ok: false, message: `${label}: invalid JSON (${error.message})` };
  }
}

function validateContextShape(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    errors.push('root must be object');
    return errors;
  }
  if (!Array.isArray(data.fullFiles)) {
    errors.push('"fullFiles" must be array');
  }
  if (!Array.isArray(data.lightFiles)) {
    errors.push('"lightFiles" must be array');
  }
  if (data.exclude !== undefined && typeof data.exclude !== 'string') {
    errors.push('"exclude" must be string');
  }
  return errors;
}

function validateAgentsShape(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    errors.push('root must be object');
    return errors;
  }
  if (!Array.isArray(data.agents)) {
    errors.push('"agents" must be array');
  }
  return errors;
}

function commandDoctor(options) {
  const projectPath = options['project-path']
    ? canonicalProjectPath(options['project-path'], HUB_ROOT)
    : null;

  if (!projectPath) {
    throw new Error('doctor requires --project-path=/abs/project/path');
  }

  const layout = resolveProjectLayout(projectPath);
  const aiRoot = layout.runtimeRoot;
  const rootGitignore = path.join(projectPath, '.gitignore');
  const checks = [];
  const warnings = [];
  const registry = loadRegistry();
  const registered = registry.projects.find((project) => normalizeForCompare(project.path) === normalizeForCompare(projectPath));

  checks.push({
    ok: fs.existsSync(projectPath),
    message: `Project path exists: ${projectPath}`,
  });
  checks.push({
    ok: fs.existsSync(aiRoot),
    message: `AI data dir exists: ${aiRoot}`,
  });

  if (fs.existsSync(rootGitignore)) {
    const lines = fs.readFileSync(rootGitignore, 'utf8').split(/\r?\n/).map((line) => line.trim());
    checks.push({
      ok: lines.includes('.ai/') || lines.includes('.ai'),
      message: 'Root .gitignore contains .ai/ rule',
    });
  } else {
    checks.push({
      ok: false,
      message: 'Root .gitignore exists',
    });
  }

  checks.push({
    ok: fs.existsSync(layout.logsDir),
    message: `Exists: ${path.relative(projectPath, layout.logsDir)}`,
  });
  checks.push({
    ok: fs.existsSync(layout.promptsDir),
    message: `Exists: ${path.relative(projectPath, layout.promptsDir)}`,
  });
  checks.push({
    ok: fs.existsSync(layout.metricsDir),
    message: `Exists: ${path.relative(projectPath, layout.metricsDir)}`,
  });
  checks.push({
    ok: fs.existsSync(layout.runsDir) || fs.existsSync(layout.legacyArchiveDir),
    message: `Exists: ${path.relative(projectPath, fs.existsSync(layout.runsDir) ? layout.runsDir : layout.legacyArchiveDir)}`,
  });

  const requiredFiles = [
    path.join(aiRoot, '.gitignore'),
    layout.agentsConfigPath,
    layout.contextConfigPath,
    layout.architectureRulesPath,
  ];
  for (const filePath of requiredFiles) {
    checks.push({
      ok: fs.existsSync(filePath),
      message: `Exists: ${path.relative(projectPath, filePath)}`,
    });
  }
  for (const fileName of LOG_FILES) {
    const filePath = path.join(layout.logsDir, fileName);
    checks.push({
      ok: fs.existsSync(filePath),
      message: `Exists: ${path.relative(projectPath, filePath)}`,
    });
  }

  if (fs.existsSync(layout.agentsConfigPath)) {
    checks.push(validateJson(layout.agentsConfigPath, 'agents.json', validateAgentsShape));
  }
  if (fs.existsSync(layout.contextConfigPath)) {
    checks.push(validateJson(layout.contextConfigPath, 'context.json', validateContextShape));
  }

  if (registered) {
    checks.push({
      ok: true,
      message: `Registry entry exists: ${registered.projectId}`,
    });
  } else {
    warnings.push(`Project is not in registry: ${projectPath}`);
  }

  const legacyAi = path.join(projectPath, 'ai');
  if (fs.existsSync(legacyAi) && !isSameOrSubPath(path.join(projectPath, '.ai'), aiRoot)) {
    warnings.push('Legacy ai/ directory detected. Consider migrating to .ai/');
  }

  const aiSize = dirSizeBytes(aiRoot);
  if (aiSize > 250 * 1024 * 1024) {
    warnings.push(`Large AI data dir (${formatBytes(aiSize)}). Consider: npm run ai:gc -- --project-path="${projectPath}"`);
  }

  const astGrepBinary = detectAstGrepBinary({
    env: process.env,
    timeoutMs: 1200,
  });
  if (astGrepBinary) {
    const displayPath = path.isAbsolute(astGrepBinary) && isSameOrSubPath(HUB_ROOT, astGrepBinary)
      ? path.relative(HUB_ROOT, astGrepBinary)
      : astGrepBinary;
    checks.push({
      ok: true,
      message: `Structural search binary detected: ${displayPath}`,
    });
  } else {
    warnings.push(
      'ast-grep not detected. Runtime will safely fall back to index-backed structural search. '
      + 'Run `npm install` in the kit root to install the optional bundled @ast-grep/cli.'
    );
  }

  const failed = checks.filter((item) => !item.ok);
  console.log(`Doctor report for ${projectPath}`);
  for (const check of checks) {
    console.log(`${check.ok ? '✅' : '❌'} ${check.message}`);
  }
  for (const warning of warnings) {
    console.log(`⚠️ ${warning}`);
  }

  if (failed.length > 0) {
    console.log('');
    console.log('Suggested fixes:');
    console.log(`1) Re-run: npm run ai:add -- --path="${projectPath}"`);
    console.log('2) If this is an old single-root project, normalize it manually to split-root (`ai/` config + `.ai/` runtime).');
    process.exitCode = 1;
    return;
  }

  console.log('Doctor: no issues found.');
}

function commandGc(options) {
  const registry = loadRegistry();
  const targets = getProjectTargets(registry, options);
  if (!targets.length) {
    console.log('No projects in registry. Use: npm run ai:add -- --path=/abs/project/path');
    return;
  }

  const dryRun = Boolean(options['dry-run']);
  const archiveDays = parseNonNegativeInt(options, 'archive-days', 30);
  const metricsKeep = parseNonNegativeInt(options, 'metrics-keep', 200);
  const archiveCutoffMs = Date.now() - archiveDays * 24 * 60 * 60 * 1000;

  let removedFiles = 0;
  let reclaimedBytes = 0;
  let trimmedMetrics = 0;

  for (const project of targets) {
    const health = detectProjectHealth(project);
    if (health.status !== 'active') {
      console.log(`Skipping ${project.displayName || project.projectId}: ${health.status}${health.reason ? ` (${health.reason})` : ''}`);
      continue;
    }

    const layout = resolveProjectLayout(project.path);
    const aiRoot = layout.runtimeRoot;
    const candidates = [];

    const transientFiles = [
      '.context_cache.json',
      'prompts/result.txt',
      'prompts/result-warning.txt',
      'prompts/metrics/latest.json',
    ];
    for (const relPath of transientFiles) {
      const fullPath = safeJoinProjectData(project.path, aiRoot, relPath);
      if (!fs.existsSync(fullPath)) continue;
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      candidates.push({ type: 'delete', filePath: fullPath, bytes: stat.size, reason: relPath });
    }

    const historyDirs = [
      safeJoinProjectData(project.path, aiRoot, 'prompts/runs'),
      safeJoinProjectData(project.path, aiRoot, 'prompts/archive'),
    ];
    for (const historyDir of historyDirs) {
      if (!fs.existsSync(historyDir) || !fs.statSync(historyDir).isDirectory()) continue;
      const archiveFiles = listFilesRecursive(historyDir);
      for (const filePath of archiveFiles) {
        if (!isSameOrSubPath(aiRoot, filePath)) continue;
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs <= archiveCutoffMs) {
          candidates.push({ type: 'delete', filePath, bytes: stat.size, reason: 'archive-ttl' });
        }
      }
    }

    const metricsHistoryPath = safeJoinProjectData(project.path, aiRoot, 'prompts/metrics/history.json');
    if (fs.existsSync(metricsHistoryPath) && fs.statSync(metricsHistoryPath).isFile()) {
      try {
        const parsed = JSON.parse(fs.readFileSync(metricsHistoryPath, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > metricsKeep) {
          const trimmed = metricsKeep === 0 ? [] : parsed.slice(-metricsKeep);
          const serialized = JSON.stringify(trimmed, null, 2) + '\n';
          const before = fs.statSync(metricsHistoryPath).size;
          const after = Buffer.byteLength(serialized, 'utf8');
          candidates.push({
            type: 'trim-history',
            filePath: metricsHistoryPath,
            bytes: Math.max(0, before - after),
            keep: metricsKeep,
            value: serialized,
            reason: `metrics-history ${parsed.length} -> ${trimmed.length}`,
          });
        }
      } catch (error) {
        console.log(`⚠️ Skip invalid metrics history JSON: ${metricsHistoryPath} (${error.message})`);
      }
    }

    if (!candidates.length) {
      console.log(`No GC actions for ${project.displayName || project.projectId}`);
      continue;
    }

    console.log(`GC actions for ${project.displayName || project.projectId} (${project.path}):`);
    for (const action of candidates) {
      const rel = path.relative(project.path, action.filePath);
      console.log(`- ${action.type} ${rel} (${formatBytes(action.bytes)}) [${action.reason}]`);
    }

    if (dryRun) continue;

    for (const action of candidates) {
      if (action.type === 'delete') {
        fs.rmSync(action.filePath, { force: true });
        removedFiles += 1;
        reclaimedBytes += action.bytes;
      } else if (action.type === 'trim-history') {
        fs.writeFileSync(action.filePath, action.value);
        trimmedMetrics += 1;
        reclaimedBytes += action.bytes;
      }
    }
  }

  if (dryRun) {
    console.log('Dry-run mode: no files changed.');
    return;
  }

  console.log(`GC complete. Removed files: ${removedFiles}, trimmed metrics files: ${trimmedMetrics}, reclaimed: ${formatBytes(reclaimedBytes)}.`);
}

function applyLastUsed(registry, projectId) {
  const target = registry.projects.find((project) => project.projectId === projectId);
  if (!target) return;
  updateProjectLastUsed(target, 'active');
  writeRegistry(registry);
}

function askSelection(maxNumber) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`Select project number (1-${maxNumber}): `, (answer) => {
      rl.close();
      const parsed = Number.parseInt(String(answer || '').trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > maxNumber) {
        resolve(null);
        return;
      }
      resolve(parsed);
    });
  });
}

async function commandStart(options) {
  const registry = loadRegistry();
  if (!registry.projects.length) {
    console.log('No projects in registry. Use: npm run ai:add -- --path=/abs/project/path');
    return;
  }

  const healthy = [...registry.projects]
    .map((project) => ({ project, health: detectProjectHealth(project) }))
    .filter((item) => item.health.status === 'active')
    .sort((a, b) => String(b.project.lastUsed || '').localeCompare(String(a.project.lastUsed || '')));

  if (!healthy.length) {
    console.log('No healthy projects found. Fix paths or run npm run ai:add again.');
    return;
  }

  let selectedIndex = null;
  if (options.select) {
    const parsed = Number.parseInt(String(options.select).trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= healthy.length) {
      selectedIndex = parsed;
    } else {
      throw new Error(`Invalid --select value: ${options.select}`);
    }
  } else if (healthy.length === 1) {
    selectedIndex = 1;
  } else if (!process.stdin.isTTY) {
    console.log('Multiple projects found. Use --select=N:');
    healthy.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.project.displayName} [${item.project.projectId}]`);
    });
    return;
  } else {
    console.log('Recent projects:');
    healthy.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.project.displayName} [${item.project.projectId}]`);
      console.log(`   ${item.project.path}`);
    });
    selectedIndex = await askSelection(healthy.length);
    if (!selectedIndex) {
      throw new Error('Selection cancelled or invalid input.');
    }
  }

  const selected = healthy[selectedIndex - 1].project;
  applyLastUsed(registry, selected.projectId);
  setActiveProjectPath(selected.path);

  console.log(`Selected project: ${selected.displayName} (${selected.projectId})`);
  console.log(`Path: ${selected.path}`);
  console.log(`Saved in hub config: ${getHubConfigWritePath()}`);
  console.log('');
  console.log('Use this environment variable for hub-aware runs:');
  console.log(`AI_HUB_PROJECT_PATH="${selected.path}"`);
}

async function main() {
  const { command, options, rawArgs } = parseArgs(process.argv);

  switch (command) {
    case 'run':
      await commandRun(options, rawArgs);
      return;
    case 'add':
      commandAdd(options);
      return;
    case 'list':
      commandList();
      return;
    case 'status':
      commandStatus(options);
      return;
    case 'stats':
      commandStats(options);
      return;
    case 'doctor':
      commandDoctor(options);
      return;
    case 'gc':
      commandGc(options);
      return;
    case 'start':
      await commandStart(options);
      return;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
