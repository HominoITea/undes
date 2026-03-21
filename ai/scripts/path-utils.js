'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function toPosix(p) {
  return String(p || '').split(path.sep).join('/');
}

function normalizeForCompare(p) {
  return toPosix(path.resolve(String(p || ''))).replace(/\/+$/, '');
}

function isSameOrSubPath(parentPath, childPath) {
  const parent = normalizeForCompare(parentPath);
  const child = normalizeForCompare(childPath);
  if (parent === child) return true;
  if (!child.startsWith(parent)) return false;
  return child[parent.length] === '/';
}

function parseFlagValue(argv, flagName) {
  const prefix = `--${flagName}=`;
  const entry = (argv || []).find((arg) => String(arg).startsWith(prefix));
  if (!entry) return '';
  return String(entry).slice(prefix.length).trim();
}

function resolveHubRoot(argv = process.argv.slice(2), fallbackCwd = process.cwd()) {
  const fromFlag = parseFlagValue(argv, 'hub-root');
  const fromEnv = String(process.env.AI_HUB_ROOT || '').trim();
  const raw = fromFlag || fromEnv || fallbackCwd;
  const resolved = path.resolve(raw);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Hub root does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`Hub root is not a directory: ${resolved}`);
  }
  return fs.realpathSync(resolved);
}

function canonicalProjectPath(inputPath, hubRoot) {
  if (!inputPath || !String(inputPath).trim()) {
    throw new Error('Missing required project path.');
  }
  const resolved = path.resolve(hubRoot || process.cwd(), String(inputPath).trim());
  if (!fs.existsSync(resolved)) {
    throw new Error(`Project path does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Project path is not a directory: ${resolved}`);
  }
  return fs.realpathSync(resolved);
}

function detectProjectAiDir(projectPath) {
  const dotAi = path.join(projectPath, '.ai');
  if (fs.existsSync(dotAi) && fs.statSync(dotAi).isDirectory()) {
    return dotAi;
  }
  const legacyAi = path.join(projectPath, 'ai');
  if (fs.existsSync(legacyAi) && fs.statSync(legacyAi).isDirectory()) {
    return legacyAi;
  }
  return dotAi;
}

function resolveProjectDirName(projectRoot, dirName) {
  const raw = String(dirName || '').trim();
  if (!raw) return '';
  return path.resolve(path.join(projectRoot, raw));
}

function relativeProjectDir(projectRoot, targetPath) {
  const rel = path.relative(projectRoot, targetPath).replace(/\\/g, '/');
  return rel || '.';
}

function resolveProjectLayout(projectPath, options = {}) {
  const root = fs.realpathSync(projectPath);
  const overrideDir = String(options.aiDir || options.singleRootDir || '').trim();

  let layoutMode = 'dotai-single-root';
  let sourceRoot;
  let runtimeRoot;

  if (overrideDir) {
    const overridden = resolveProjectDirName(root, overrideDir);
    sourceRoot = overridden;
    runtimeRoot = overridden;
    layoutMode = 'override-single-root';
  } else {
    const dotAi = path.join(root, '.ai');
    const legacyAi = path.join(root, 'ai');
    const hasDotAi = fs.existsSync(dotAi) && fs.statSync(dotAi).isDirectory();
    const hasLegacyAi = fs.existsSync(legacyAi) && fs.statSync(legacyAi).isDirectory();

    if (hasDotAi && hasLegacyAi) {
      sourceRoot = legacyAi;
      runtimeRoot = dotAi;
      layoutMode = 'split-root';
    } else if (hasDotAi) {
      sourceRoot = dotAi;
      runtimeRoot = dotAi;
      layoutMode = 'dotai-single-root';
    } else if (hasLegacyAi) {
      sourceRoot = legacyAi;
      runtimeRoot = legacyAi;
      layoutMode = 'legacy-single-root';
    } else {
      sourceRoot = legacyAi;
      runtimeRoot = dotAi;
      layoutMode = 'split-root';
    }
  }

  const logsDir = path.join(runtimeRoot, 'logs');
  const memoryDir = path.join(runtimeRoot, 'memory');
  const memoryDecisionsDir = path.join(memoryDir, 'decisions');
  const memoryEpisodesDir = path.join(memoryDir, 'episodes');
  const promptsDir = path.join(runtimeRoot, 'prompts');
  const metricsDir = path.join(promptsDir, 'metrics');
  const runsDir = path.join(promptsDir, 'runs');
  const legacyArchiveDir = path.join(promptsDir, 'archive');
  const discussionsDir = path.join(promptsDir, 'discussions');
  const runDir = path.join(promptsDir, 'run');

  return {
    projectRoot: root,
    layoutMode,
    sourceRoot,
    runtimeRoot,
    sourceDirName: relativeProjectDir(root, sourceRoot),
    runtimeDirName: relativeProjectDir(root, runtimeRoot),
    // Backward-compatible alias for scripts/tests that still think in single-root terms.
    aiDataRoot: runtimeRoot,
    logsDir,
    memoryDir,
    memoryDbPath: path.join(memoryDir, 'memory.db'),
    memoryDecisionsDir,
    memoryEpisodesDir,
    promptsDir,
    metricsDir,
    runDir,
    runsDir,
    legacyArchiveDir,
    // Backward-compatible alias while the old prompts/archive path remains readable.
    archiveDir: runsDir,
    discussionsDir,
    contextConfigPath: path.join(sourceRoot, 'context.json'),
    agentsConfigPath: path.join(sourceRoot, 'agents.json'),
    architectureRulesPath: path.join(sourceRoot, 'architecture-rules.json'),
    bundlePath: path.join(runtimeRoot, '.context_bundle.md'),
    cachePath: path.join(runtimeRoot, '.context_cache.json'),
    promptPath: path.join(promptsDir, 'prompt.txt'),
    runtimeOverridesPath: path.join(runDir, 'runtime-overrides.json'),
    resultPath: path.join(promptsDir, 'result.txt'),
    patchSafeResultPath: path.join(promptsDir, 'patch-safe-result.md'),
    resultWarningPath: path.join(promptsDir, 'result-warning.txt'),
    devilsAdvocateReportPath: path.join(promptsDir, 'devils-advocate-report.md'),
    testReportPath: path.join(promptsDir, 'test-report.md'),
    qualityPath: path.join(metricsDir, 'quality.json'),
    lastResultHashPath: path.join(metricsDir, 'last-result-hash.json'),
    resolveIndexPath(outputPath = '.code_index.json') {
      const raw = String(outputPath || '').trim() || '.code_index.json';
      return path.isAbsolute(raw) ? raw : path.join(runtimeRoot, raw);
    },
  };
}

/**
 * @deprecated Prefer resolveProjectLayout(projectPath) to access split-root-aware paths.
 */
function resolveProjectPaths(projectPath) {
  return resolveProjectLayout(projectPath);
}

function safeJoinProjectData(projectRoot, aiDataRoot, relPath, options = {}) {
  const { allowAbsolute = false } = options;
  const rel = String(relPath || '').trim();
  if (!rel) throw new Error('safeJoinProjectData: empty relative path');
  if (!allowAbsolute && path.isAbsolute(rel)) {
    throw new Error(`Absolute paths are not allowed: ${rel}`);
  }
  if (rel.includes('\0')) {
    throw new Error('Path contains NUL byte.');
  }

  const candidate = path.resolve(aiDataRoot, rel);
  const root = fs.realpathSync(projectRoot);
  const aiRootExists = fs.existsSync(aiDataRoot);
  const aiRoot = aiRootExists ? fs.realpathSync(aiDataRoot) : path.resolve(aiDataRoot);

  if (!isSameOrSubPath(root, candidate)) {
    throw new Error(`Path escapes project root: ${rel}`);
  }
  if (!isSameOrSubPath(aiRoot, candidate)) {
    throw new Error(`Path escapes project AI directory: ${rel}`);
  }

  // Reject symlink escape if parent exists and resolves outside ai root.
  const parent = path.dirname(candidate);
  if (fs.existsSync(parent)) {
    const parentReal = fs.realpathSync(parent);
    if (!isSameOrSubPath(aiRoot, parentReal)) {
      throw new Error(`Symlink escape detected for path: ${rel}`);
    }
  }

  return candidate;
}

function makeProjectId(projectCanonicalPath) {
  return crypto.createHash('sha256').update(projectCanonicalPath).digest('hex').slice(0, 12);
}

module.exports = {
  parseFlagValue,
  resolveHubRoot,
  canonicalProjectPath,
  detectProjectAiDir,
  resolveProjectLayout,
  resolveProjectPaths,
  safeJoinProjectData,
  makeProjectId,
  normalizeForCompare,
  isSameOrSubPath,
};
