const fs = require('fs');
const path = require('path');
const { enforceDispatcherGuard } = require('./dispatcher-guard');
const { resolveProjectLayout } = require('./path-utils');
const { normalizeScriptMainInput } = require('./infrastructure/main-input');

const KEEP_COUNT = 20;

/** List run-* directories in run history, sorted newest-first by mtime. */
function listArchiveRuns(historyDir) {
  return fs.readdirSync(historyDir)
    .filter((f) => f.startsWith('run-') && fs.statSync(path.join(historyDir, f)).isDirectory())
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(historyDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);
}

/** List loose flat files (backward compat — pre-grouping archives). */
function listArchiveFiles(historyDir) {
  return fs.readdirSync(historyDir)
    .filter((f) => fs.statSync(path.join(historyDir, f)).isFile())
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(historyDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);
}

function resolveHistoryDir(options = {}) {
  if (options.archiveDir) {
    return {
      historyDir: options.archiveDir,
      isLegacyArchive: String(options.archiveDir).replace(/\\/g, '/').includes('/prompts/archive'),
    };
  }
  if (options.runsDir) {
    return { historyDir: options.runsDir, isLegacyArchive: false };
  }

  const projectRoot = options.projectRoot || process.cwd();
  const layout = resolveProjectLayout(projectRoot);
  if (fs.existsSync(layout.runsDir)) {
    return { historyDir: layout.runsDir, isLegacyArchive: false };
  }
  if (fs.existsSync(layout.legacyArchiveDir)) {
    return { historyDir: layout.legacyArchiveDir, isLegacyArchive: true };
  }
  return { historyDir: layout.runsDir, isLegacyArchive: false };
}

function cleanup(options = {}) {
  const { historyDir, isLegacyArchive } = resolveHistoryDir(options);
  const keepCount = Number.isFinite(options.keepCount) ? options.keepCount : KEEP_COUNT;
  const logger = typeof options.logger === 'function' ? options.logger : console.log;
  const historyLabel = isLegacyArchive ? 'legacy archive directory' : 'runs directory';

  if (!fs.existsSync(historyDir)) {
    logger(`✨ ${historyLabel} does not exist. Nothing to clean.`);
    return { deleted: 0, total: 0, skipped: true };
  }

  let totalDeleted = 0;
  const runs = listArchiveRuns(historyDir);
  const looseFiles = listArchiveFiles(historyDir);

  if (runs.length > 0) {
    // New mode: run-directory-based cleanup
    if (runs.length > keepCount) {
      const toDelete = runs.slice(keepCount);
      logger(`🧹 Cleaning up ${toDelete.length} old run directories from ${historyLabel}...`);
      toDelete.forEach((run) => {
        fs.rmSync(path.join(historyDir, run.name), { recursive: true, force: true });
        logger(`   Deleted: ${run.name}/`);
      });
      totalDeleted += toDelete.length;
    }

    // When run directories exist, remove ALL loose files as legacy artifacts
    if (looseFiles.length > 0) {
      logger(`🧹 Cleaning up ${looseFiles.length} legacy flat files from ${historyLabel}...`);
      looseFiles.forEach((file) => {
        fs.unlinkSync(path.join(historyDir, file.name));
        logger(`   Deleted: ${file.name}`);
      });
      totalDeleted += looseFiles.length;
    }
  } else {
    // Backward compat: no run directories yet, apply keepCount to flat files
    if (looseFiles.length > keepCount) {
      const toDelete = looseFiles.slice(keepCount);
      logger(`🧹 Cleaning up ${toDelete.length} old files from ${historyLabel}...`);
      toDelete.forEach((file) => {
        fs.unlinkSync(path.join(historyDir, file.name));
        logger(`   Deleted: ${file.name}`);
      });
      totalDeleted += toDelete.length;
    }
  }

  const totalItems = runs.length + looseFiles.length;
  if (totalDeleted === 0) {
    const countLabel = runs.length > 0 ? `${runs.length} runs` : `${looseFiles.length} files`;
    logger(`✨ ${historyLabel} has ${countLabel} (limit: ${keepCount}). No cleanup needed.`);
    return { deleted: 0, total: totalItems, skipped: true };
  }

  logger('✅ Cleanup complete.');
  return { deleted: totalDeleted, total: totalItems, skipped: false };
}

function normalizeMainInput(optionsOrArgv = process.argv, env = process.env, baseCwd = process.cwd()) {
  return normalizeScriptMainInput(optionsOrArgv, {
    argv: process.argv,
    env,
    projectPath: baseCwd || process.cwd(),
    hubRoot: '',
  });
}

function main(optionsOrArgv = process.argv, env = process.env, baseCwd = process.cwd()) {
  const input = normalizeMainInput(optionsOrArgv, env, baseCwd);
  return cleanup({
    ...input,
    projectRoot: input.projectPath,
  });
}

if (require.main === module) {
  enforceDispatcherGuard({
    useCommand: 'npm run ai:clean',
  });
  main();
}

module.exports = {
  KEEP_COUNT,
  listArchiveRuns,
  listArchiveFiles,
  cleanup,
  normalizeMainInput,
  main,
};
