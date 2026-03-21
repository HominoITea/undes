/**
 * domain/memory-context.js — memory log digests, project memory sections, context caching, limits.
 * Extracted from generate-context.js (Batch 11, Slice B).
 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');

// ── Memory log digest ──────────────────────────────────────────────

/**
 * @param {string[]} memoryLogFiles — array of absolute file paths to memory log files
 */
function computeMemoryLogsDigest(memoryLogFiles) {
  const hash = crypto.createHash('md5');
  for (const filePath of memoryLogFiles) {
    try {
      const stat = fs.statSync(filePath);
      hash.update(`${filePath}:${stat.mtimeMs}:${stat.size}`);
    } catch (e) {
      hash.update(`${filePath}:missing`);
    }
  }
  return hash.digest('hex');
}

// ── Project memory sections ────────────────────────────────────────

/**
 * @param {object} options
 * @param {object} options.contextConfig
 * @param {string} options.planLogPath
 * @param {string} options.changeLogPath
 * @param {string} options.proposalLogPath
 * @param {string} options.discussionLogPath
 * @param {string} options.globalAiLogPath
 * @param {function} options.readAiLogWindow — (filePath, maxEntries, maxBytes) => string
 * @param {function} options.toRelativePath — (absPath) => string
 */
function buildProjectMemoryLogSnapshotSection(options) {
  const { contextConfig, planLogPath, changeLogPath, proposalLogPath, discussionLogPath, globalAiLogPath, readAiLogWindow, toRelativePath } = options;
  const memoryCfg = contextConfig.memoryWindow || {};
  const maxEntries = Number(memoryCfg.maxEntries || contextConfig.logWindow?.maxEntries || 8);
  const maxBytes = Number(memoryCfg.maxBytes || contextConfig.logWindow?.maxBytes || 12000);
  const sectionMaxBytes = Number(memoryCfg.sectionMaxBytes || Math.max(2000, Math.floor(maxBytes / 2)));

  const sections = [
    { title: 'Planned Improvements', filePath: toRelativePath(planLogPath) },
    { title: 'Recent Changes', filePath: toRelativePath(changeLogPath) },
    { title: 'Recent Proposals', filePath: toRelativePath(proposalLogPath) },
    { title: 'Recent Discussions', filePath: toRelativePath(discussionLogPath) },
    { title: 'Global Timeline', filePath: toRelativePath(globalAiLogPath) },
  ];

  const blocks = ['## PROJECT MEMORY (AUTO)'];
  for (const section of sections) {
    const content = readAiLogWindow(section.filePath, maxEntries, sectionMaxBytes).trim();
    if (!content || content.startsWith('[Error reading')) continue;
    blocks.push('');
    blocks.push(`### ${section.title} (${section.filePath})`);
    blocks.push(content);
  }

  return blocks.length > 1 ? blocks.join('\n') : '';
}

/**
 * @param {string} promptText
 * @param {object} options
 * @param {object} options.contextConfig
 * @param {object} options.projectLayout
 * @param {function} options.buildMemoryRecallSection — (layout, promptText, memoryCfg) => string|null
 * @param {function} options.buildProjectMemoryLogSnapshotSection — () => string
 */
function buildProjectMemorySection(promptText, options) {
  const { contextConfig, projectLayout, buildMemoryRecallSection, buildProjectMemoryLogSnapshotSection: buildSnapshot } = options;
  const memoryCfg = contextConfig.memoryWindow || {};
  const recallSection = buildMemoryRecallSection(projectLayout, promptText, memoryCfg);
  if (recallSection) {
    return recallSection;
  }
  return buildSnapshot();
}

// ── Incremental context cache ──────────────────────────────────────

/**
 * @param {string[]} files — relative file paths
 * @param {string} extra — extra content to include in hash
 * @param {object} options
 * @param {function} options.resolveReadablePath — (filePath, opts) => string|null
 */
function computeFilesHash(files, extra, options) {
  const { resolveReadablePath } = options;
  const hash = crypto.createHash('md5');

  for (const file of files) {
    const filePath = resolveReadablePath(file, { allowHubFallback: true });
    try {
      if (!filePath) throw new Error('missing');
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      hash.update(`${file}:${stat.mtimeMs}:${content.length}`);
    } catch (e) {
      hash.update(`${file}:missing`);
    }
  }

  if (extra) {
    hash.update(`extra:${extra.length}:${extra}`);
  }

  return hash.digest('hex');
}

/**
 * @param {string} cachePath — absolute path to cache JSON file
 */
function loadContextCache(cachePath) {
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch (e) {
    // Ignore cache read errors
  }
  return null;
}

/**
 * @param {string} cachePath — absolute path to cache JSON file
 * @param {string} hash
 * @param {string} bundle
 */
function saveContextCache(cachePath, hash, bundle) {
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ hash, bundle, timestamp: Date.now() }));
  } catch (e) {
    console.warn('⚠️ Failed to save context cache:', e.message);
  }
}

// ── Limits ─────────────────────────────────────────────────────────

/**
 * @param {object} config — contextConfig
 * @param {object} options
 * @param {string[]} options.args — CLI args
 * @param {object} options.defaultLimits — { maxFiles, maxFileSize, maxTotalSize }
 */
function getLimits(config, options) {
  const { args, defaultLimits } = options;
  const configLimits = config.limits || {};

  // CLI args
  const maxFilesArg = args.find(arg => arg.startsWith('--max-files='));
  const maxFilesFromArgs = maxFilesArg ? Number(maxFilesArg.split('=')[1]) : 0;

  // Env vars
  const maxFilesFromEnv = Number(process.env.CONTEXT_MAX_FILES || 0);

  // --full flag = no limits
  const isFullMode = args.includes('--full');

  return {
    maxFiles: isFullMode ? 10000 : (maxFilesFromArgs || maxFilesFromEnv || configLimits.maxFiles || defaultLimits.maxFiles),
    maxFileSize: configLimits.maxFileSize || defaultLimits.maxFileSize,
    maxTotalSize: configLimits.maxTotalSize || defaultLimits.maxTotalSize
  };
}

module.exports = {
  computeMemoryLogsDigest,
  buildProjectMemoryLogSnapshotSection,
  buildProjectMemorySection,
  computeFilesHash,
  loadContextCache,
  saveContextCache,
  getLimits,
};
