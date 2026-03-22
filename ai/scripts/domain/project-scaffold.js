'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { mergeContextConfig, mergeAgentsConfig, readJsonIfExists } = require('../config-loader');
const { detectProjectStack, buildLlmsSummary } = require('./stack-profile');

const HUB_CONTRACT_VERSION = 1;
const DEFAULT_SCAN_DEPTH = 4;
const DEFAULT_SCAN_LIMIT = 5000;
const DEFAULT_MAX_FILE_BYTES = 80 * 1024;
const DEFAULT_EXCLUDE_CMD = 'find . -maxdepth 4 -type f -not -path "./node_modules/*" -not -path "./.git/*"';

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  'target',
  'bin',
  'obj',
]);

const ROOT_KEY_FILE_CANDIDATES = [
  'package.json',
  'README.md',
  'requirements.txt',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'Gemfile',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'lerna.json',
];

const NESTED_MANIFEST_PATTERN =
  /^(packages|apps|services|libs)\/[^/]+\/(?:package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(?:\.kts)?|composer\.json|Gemfile|[^/]+\.csproj)$/;

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableNormalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function toPrettyJson(value) {
  return JSON.stringify(stableNormalize(value), null, 2) + '\n';
}

function sha256(content) {
  return crypto.createHash('sha256').update(String(content || '')).digest('hex');
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean))];
}

function addUniqueItems(items, additions) {
  const next = Array.isArray(items) ? [...items] : [];
  for (const entry of additions || []) {
    const value = typeof entry === 'string' ? entry.trim() : '';
    if (!value || next.includes(value)) continue;
    next.push(value);
  }
  return next;
}

function injectBootstrapArtifacts(contextConfig, projectLayout) {
  const runtimeStackProfilePath = path.posix.join(projectLayout.runtimeDirName.replace(/\\/g, '/'), 'stack-profile.json');
  return {
    ...contextConfig,
    fullFiles: addUniqueItems(contextConfig.fullFiles, ['ai/llms.md', runtimeStackProfilePath]),
    lightFiles: addUniqueItems(contextConfig.lightFiles, ['ai/llms.md', runtimeStackProfilePath]),
  };
}

function scanTree(rootDir, depth = DEFAULT_SCAN_DEPTH, maxFiles = DEFAULT_SCAN_LIMIT) {
  const results = [];
  const root = path.resolve(rootDir);

  function walk(dir, currentDepth) {
    if (results.length >= maxFiles) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      if (entry.name.startsWith('.')) {
        if (entry.name !== '.gitignore' && entry.name !== '.cursorrules') continue;
      }
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        if (currentDepth < depth) {
          walk(fullPath, currentDepth + 1);
        }
      } else {
        results.push(relPath);
      }
    }
  }

  walk(root, 0);
  return results;
}

function readFileSafe(projectRoot, filePath, maxBytes = DEFAULT_MAX_FILE_BYTES) {
  try {
    const fullPath = path.join(projectRoot, filePath);
    const stats = fs.statSync(fullPath);
    if (stats.size > maxBytes) {
      return `[Truncated: ${stats.size} bytes exceeds ${maxBytes}]`;
    }
    const raw = fs.readFileSync(fullPath);
    for (let i = 0; i < raw.length; i += 1) {
      if (raw[i] === 0) return '[Skipped binary file]';
    }
    return raw.toString('utf8');
  } catch (error) {
    return `[Error reading ${filePath}: ${error.message}]`;
  }
}

function listKeyFileCandidates(treeFiles) {
  const fileSet = new Set(treeFiles || []);
  const rootCandidates = ROOT_KEY_FILE_CANDIDATES.filter((file) => fileSet.has(file));
  const rootCsprojFiles = (treeFiles || [])
    .filter((file) => file.endsWith('.csproj') && !NESTED_MANIFEST_PATTERN.test(file))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 3);
  const nestedManifests = (treeFiles || [])
    .filter((file) => NESTED_MANIFEST_PATTERN.test(file))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);
  return [...new Set([...rootCandidates, ...rootCsprojFiles, ...nestedManifests])];
}

function collectKeyFiles(projectRoot, treeFiles) {
  return listKeyFileCandidates(treeFiles).map((file) => ({
    path: file,
    content: readFileSafe(projectRoot, file),
  }));
}

function resolveHubAiDir(hubRoot = '') {
  const root = String(hubRoot || '').trim()
    ? path.resolve(hubRoot)
    : path.resolve(__dirname, '..', '..');
  return path.join(root, 'ai');
}

function getContractPath(projectLayout) {
  return path.join(projectLayout.runtimeRoot, 'hub-contract.json');
}

function buildMergedContextConfig(projectLayout, hubAiDir) {
  const hubContextPath = path.join(hubAiDir, 'context.json');
  const hubDefaults = readJsonIfExists(hubContextPath) || {};
  const projectOverrides = readJsonIfExists(projectLayout.contextConfigPath) || {};
  const merged = mergeContextConfig(hubDefaults, projectOverrides);
  if (!Array.isArray(merged.fullFiles)) merged.fullFiles = [];
  if (!Array.isArray(merged.lightFiles)) merged.lightFiles = [];
  if (typeof merged.exclude !== 'string' || !merged.exclude.trim()) {
    merged.exclude = DEFAULT_EXCLUDE_CMD;
  }
  return injectBootstrapArtifacts(merged, projectLayout);
}

function buildPatchedContextConfig(projectLayout) {
  const projectOverrides = readJsonIfExists(projectLayout.contextConfigPath) || {};
  if (!Array.isArray(projectOverrides.fullFiles)) projectOverrides.fullFiles = [];
  if (!Array.isArray(projectOverrides.lightFiles)) projectOverrides.lightFiles = [];
  if (typeof projectOverrides.exclude !== 'string' || !projectOverrides.exclude.trim()) {
    projectOverrides.exclude = DEFAULT_EXCLUDE_CMD;
  }
  return injectBootstrapArtifacts(projectOverrides, projectLayout);
}

function buildMergedAgentsConfig(projectLayout, hubAiDir) {
  const hubAgentsPath = path.join(hubAiDir, 'agents.json');
  const hubDefaults = readJsonIfExists(hubAgentsPath) || { agents: [] };
  const projectOverrides = readJsonIfExists(projectLayout.agentsConfigPath) || { agents: [] };
  return mergeAgentsConfig(hubDefaults, projectOverrides) || hubDefaults;
}

function buildDetectedStackProfile(projectRoot) {
  const treeFiles = scanTree(projectRoot);
  const keyFiles = collectKeyFiles(projectRoot, treeFiles);
  return detectProjectStack({
    treeFiles,
    keyFiles,
    detectedAt: new Date().toISOString(),
  });
}

function buildContractManifest(projectLayout, outputs, options = {}) {
  const trackedFiles = Object.entries(outputs || {}).map(([filePath, meta]) => ({
    path: filePath,
    policy: meta.policy,
    hash: sha256(meta.content),
  }));
  return {
    version: 1,
    contractVersion: HUB_CONTRACT_VERSION,
    syncedAt: new Date().toISOString(),
    sourceRoot: projectLayout.sourceDirName,
    runtimeRoot: projectLayout.runtimeDirName,
    mode: options.mode || 'generated-only',
    files: trackedFiles,
  };
}

function buildScaffoldSyncPlan(projectRoot, projectLayout, options = {}) {
  const hubAiDir = resolveHubAiDir(options.hubRoot);
  const includeMergeAware = options.includeMergeAware === true;
  const existingContract = readJsonIfExists(getContractPath(projectLayout));
  const stackProfile = buildDetectedStackProfile(projectRoot);
  const llmsContent = (buildLlmsSummary(stackProfile) || '').trim() + '\n';
  const runtimeStackProfileRel = path.posix.join(projectLayout.runtimeDirName.replace(/\\/g, '/'), 'stack-profile.json');

  const outputs = {
    [runtimeStackProfileRel]: {
      policy: 'generated',
      content: toPrettyJson(stackProfile),
    },
    'ai/llms.md': {
      policy: 'derived',
      content: llmsContent,
    },
  };

  if (includeMergeAware) {
    outputs['ai/context.json'] = {
      policy: 'merge-aware',
      content: toPrettyJson(buildMergedContextConfig(projectLayout, hubAiDir)),
    };
    outputs['ai/agents.json'] = {
      policy: 'merge-aware',
      content: toPrettyJson(buildMergedAgentsConfig(projectLayout, hubAiDir)),
    };
  } else {
    outputs['ai/context.json'] = {
      policy: 'merge-aware',
      content: toPrettyJson(buildPatchedContextConfig(projectLayout)),
    };
  }

  const contractPath = path.posix.join(projectLayout.runtimeDirName.replace(/\\/g, '/'), 'hub-contract.json');
  outputs[contractPath] = {
    policy: 'generated',
    content: '',
  };
  const manifest = buildContractManifest(projectLayout, outputs, {
    mode: includeMergeAware ? 'full-sync' : 'generated-only',
  });
  outputs[contractPath].content = toPrettyJson(manifest);

  const issues = [];
  const syncable = [];

  if (!existingContract) {
    issues.push({
      type: 'missing-contract',
      severity: 'high',
      message: 'Project scaffold contract is missing.',
    });
  } else if (Number(existingContract.contractVersion || 0) < HUB_CONTRACT_VERSION) {
    issues.push({
      type: 'outdated-contract',
      severity: 'high',
      message: `Project scaffold contract is outdated (${existingContract.contractVersion || 0} < ${HUB_CONTRACT_VERSION}).`,
    });
  }

  for (const [relPath, meta] of Object.entries(outputs)) {
    const absolutePath = path.join(projectRoot, relPath);
    const exists = fs.existsSync(absolutePath);
    const current = exists ? fs.readFileSync(absolutePath, 'utf8') : '';
    const same = exists && sha256(current) === sha256(meta.content);
    if (!same) {
      syncable.push({
        path: relPath,
        policy: meta.policy,
        exists,
      });
    }
  }

  const promptPath = projectLayout.promptPath;
  if (fs.existsSync(promptPath)) {
    const promptSize = fs.statSync(promptPath).size;
    if (promptSize === 0) {
      issues.push({
        type: 'empty-prompt-surface',
        severity: 'medium',
        message: '.ai/prompts/prompt.txt is empty.',
      });
    }
  }

  return {
    contractVersion: HUB_CONTRACT_VERSION,
    includeMergeAware,
    issues,
    syncable,
    outputs,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileWithBackup(filePath, content, options = {}) {
  ensureDir(path.dirname(filePath));
  if (options.backup && fs.existsSync(filePath)) {
    const backupPath = `${filePath}.bak-${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
  }
  fs.writeFileSync(filePath, content);
}

function applyScaffoldSyncPlan(projectRoot, plan, options = {}) {
  const mode = options.mode || 'generated-only';
  const backupMergeAware = options.backupMergeAware === true;
  const updated = [];
  for (const [relPath, meta] of Object.entries(plan.outputs || {})) {
    if (mode !== 'full-sync' && meta.policy === 'merge-aware') {
      if (relPath !== 'ai/context.json') continue;
    }
    const absolutePath = path.join(projectRoot, relPath);
    const exists = fs.existsSync(absolutePath);
    const current = exists ? fs.readFileSync(absolutePath, 'utf8') : '';
    if (sha256(current) === sha256(meta.content)) continue;
    writeFileWithBackup(absolutePath, meta.content, {
      backup: backupMergeAware && meta.policy === 'merge-aware',
    });
    updated.push(relPath);
  }
  return updated;
}

function ensureProjectScaffoldUpToDate(projectRoot, projectLayout, options = {}) {
  const plan = buildScaffoldSyncPlan(projectRoot, projectLayout, {
    hubRoot: options.hubRoot,
    includeMergeAware: options.includeMergeAware === true,
  });
  const shouldAutoSync = plan.syncable.some((item) => item.policy === 'generated' || item.path === 'ai/context.json');
  const updated = shouldAutoSync
    ? applyScaffoldSyncPlan(projectRoot, plan, {
      mode: 'generated-only',
      backupMergeAware: false,
    })
    : [];
  return {
    plan,
    updated,
  };
}

module.exports = {
  HUB_CONTRACT_VERSION,
  getContractPath,
  buildScaffoldSyncPlan,
  applyScaffoldSyncPlan,
  ensureProjectScaffoldUpToDate,
};
