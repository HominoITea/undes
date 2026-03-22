#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { enforceDispatcherGuard } = require('./dispatcher-guard');
const { normalizeScriptMainInput } = require('./infrastructure/main-input');
const { resolveProjectLayout } = require('./path-utils');
const {
  ENTRY_TYPES,
  normalizeEntryType,
  normalizeTags,
  saveMemoryEntry,
  searchMemoryEntries,
  isSqliteAvailable,
} = require('./local-memory');

const LOG_ORDER = ['plan', 'proposal', 'discussion', 'change', 'error', 'global'];

function readArgValue(argv, prefix) {
  const entry = (argv || []).find((arg) => String(arg).startsWith(prefix));
  if (!entry) return '';
  return String(entry).slice(prefix.length).trim();
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseArgs(argv) {
  const opts = {
    entries: null,
    bytes: null,
    logs: null,
    help: false,
    action: 'snapshot',
    query: '',
    type: '',
    title: '',
    content: '',
    contentFile: '',
    summary: '',
    tags: [],
    sourceRef: '',
    limit: null,
    confidence: null,
  };

  for (const arg of (argv || []).slice(2)) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg.startsWith('--entries=')) {
      opts.entries = toInt(arg.split('=').slice(1).join('='), null);
      continue;
    }
    if (arg.startsWith('--bytes=')) {
      opts.bytes = toInt(arg.split('=').slice(1).join('='), null);
      continue;
    }
    if (arg.startsWith('--log=')) {
      const raw = arg.split('=').slice(1).join('=').trim();
      opts.logs = raw
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith('--action=')) {
      opts.action = arg.split('=').slice(1).join('=').trim().toLowerCase() || 'snapshot';
      continue;
    }
    if (arg.startsWith('--search=')) {
      opts.action = 'search';
      opts.query = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg === '--save') {
      opts.action = 'save';
      continue;
    }
    if (arg.startsWith('--query=')) {
      opts.query = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--type=')) {
      opts.type = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--title=')) {
      opts.title = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--content=')) {
      opts.content = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--content-file=')) {
      opts.contentFile = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--summary=')) {
      opts.summary = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--tags=')) {
      opts.tags = arg.split('=').slice(1).join('=').split(',').map((x) => x.trim()).filter(Boolean);
      continue;
    }
    if (arg.startsWith('--source-ref=')) {
      opts.sourceRef = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--limit=')) {
      opts.limit = toInt(arg.split('=').slice(1).join('='), null);
      continue;
    }
    if (arg.startsWith('--confidence=')) {
      const parsed = Number.parseFloat(arg.split('=').slice(1).join('=').trim());
      opts.confidence = Number.isFinite(parsed) ? parsed : null;
    }
  }
  return opts;
}

function resolveRuntime(argv = process.argv.slice(2), env = process.env, baseCwd = process.cwd()) {
  const projectPathRaw = readArgValue(argv, '--project-path=') || String(env.AI_HUB_PROJECT_PATH || '').trim();
  const root = projectPathRaw ? path.resolve(baseCwd, projectPathRaw) : baseCwd;
  const aiDirRaw = readArgValue(argv, '--ai-dir=') || String(env.AI_PROJECT_DATA_DIR || '').trim();
  const canResolveLayout = fs.existsSync(root) && fs.statSync(root).isDirectory();
  const layout = canResolveLayout ? resolveProjectLayout(root, { aiDir: aiDirRaw }) : null;
  const aiDirName = layout
    ? layout.runtimeDirName
    : (aiDirRaw || (fs.existsSync(path.join(root, '.ai')) ? '.ai' : 'ai'));
  const aiRoot = layout ? layout.runtimeRoot : path.join(root, aiDirName);
  const logsDir = layout ? layout.logsDir : path.join(aiRoot, 'logs');
  const contextPath = layout ? layout.contextConfigPath : path.join(aiRoot, 'context.json');
  const memoryDir = layout ? layout.memoryDir : path.join(aiRoot, 'memory');
  const memoryDbPath = layout ? layout.memoryDbPath : path.join(memoryDir, 'memory.db');

  const logs = {
    plan: {
      label: 'Planned Improvements',
      path: path.join(logsDir, 'AI_PLAN_LOG.md'),
    },
    proposal: {
      label: 'Recent Proposals',
      path: path.join(logsDir, 'AI_PROPOSAL_LOG.md'),
    },
    discussion: {
      label: 'Recent Discussions',
      path: path.join(logsDir, 'AI_DISCUSSION_LOG.md'),
    },
    change: {
      label: 'Recent Changes',
      path: path.join(logsDir, 'AI_CHANGE_LOG.md'),
    },
    error: {
      label: 'Recent Errors',
      path: path.join(logsDir, 'AI_ERROR_LOG.md'),
    },
    global: {
      label: 'Global Timeline',
      path: path.join(logsDir, 'AI_LOG.md'),
    },
  };

  return {
    root,
    aiDirName,
    aiRoot,
    memoryDir,
    memoryDbPath,
    contextPath,
    layout,
    logs,
  };
}

function loadContextConfig(contextPath) {
  if (!fs.existsSync(contextPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  } catch {
    return {};
  }
}

function resolveWindowOptions(opts, context) {
  const memoryWindow = (context && context.memoryWindow) || {};
  const logWindow = (context && context.logWindow) || {};

  const entries = opts.entries || toInt(memoryWindow.maxEntries, null) || toInt(logWindow.maxEntries, 10);
  const bytes = opts.bytes || toInt(memoryWindow.sectionMaxBytes, null) || toInt(logWindow.maxBytes, 4000);

  return { entries, bytes };
}

function trimToBytes(text, maxBytes) {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return text;

  const buf = Buffer.from(text, 'utf8').slice(bytes - maxBytes);
  const raw = buf.toString('utf8');
  const firstNewline = raw.indexOf('\n');
  const trimmed = firstNewline >= 0 ? raw.slice(firstNewline + 1) : raw;
  return `[truncated to last ${maxBytes} bytes]\n${trimmed}`;
}

function extractEntries(text) {
  return text
    .split(/\n(?=##+\s*\[\d{4}-\d{2}-\d{2})/g)
    .map((part) => part.trim())
    .filter((part) => /^##+\s*\[\d{4}-\d{2}-\d{2}/.test(part));
}

function readLogWindow(filePath, maxEntries, maxBytes) {
  if (!fs.existsSync(filePath)) return '[missing file]';
  const raw = fs.readFileSync(filePath, 'utf8');
  const entries = extractEntries(raw);
  if (!entries.length) return 'No entries yet.';
  const joined = entries.slice(-maxEntries).join('\n\n');
  return trimToBytes(joined, maxBytes);
}

function selectLogKeys(requestedLogs, logs) {
  const source = requestedLogs && requestedLogs.length ? requestedLogs : LOG_ORDER;
  return source.filter((key) => Object.prototype.hasOwnProperty.call(logs, key));
}

function printHelp() {
  console.log('Usage: npm run undes:memory -- [--entries=N] [--bytes=N] [--log=plan,proposal,discussion,change,error,global]');
  console.log('Additional commands:');
  console.log('  npm run undes:memory:search -- --query="jwt race" [--type=fact|decision|episode|openQuestion] [--limit=N]');
  console.log('  npm run undes:memory:save -- --type=decision --title="..." --content="..." [--summary="..."] [--tags=a,b] [--source-ref=path]');
  console.log('Examples:');
  console.log('  npm run undes:memory');
  console.log('  npm run undes:memory -- --entries=5 --bytes=3000');
  console.log('  npm run undes:memory -- --log=change,discussion');
  console.log('  npm run undes:memory:search -- --query="split root layout"');
  console.log('  npm run undes:memory:save -- --type=fact --title="Framework" --content="Project uses Next.js 15" --tags=nextjs,app-router');
}

function normalizeMainInput(optionsOrArgv = process.argv, env = process.env, baseCwd = process.cwd()) {
  return normalizeScriptMainInput(optionsOrArgv, {
    argv: process.argv,
    env,
    projectPath: baseCwd || process.cwd(),
    hubRoot: '',
  });
}

function resolveContentValue(opts, runtimeRoot) {
  const inline = String(opts.content || '').trim();
  if (inline) return inline;
  const fromFile = String(opts.contentFile || '').trim();
  if (!fromFile) return '';
  const absolute = path.resolve(runtimeRoot, fromFile);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Invalid --content-file: ${absolute}`);
  }
  return fs.readFileSync(absolute, 'utf8').trim();
}

function printMemorySearch(runtime, opts) {
  if (!isSqliteAvailable()) {
    console.error('Local memory search is unavailable: node:sqlite is not supported in this runtime.');
    process.exit(1);
  }

  const query = String(opts.query || '').trim();
  const type = String(opts.type || '').trim();
  const normalizedType = type ? normalizeEntryType(type) : '';
  const entries = searchMemoryEntries(runtime.layout, {
    query,
    type: normalizedType,
    limit: opts.limit || opts.entries || resolveWindowOptions(opts, loadContextConfig(runtime.contextPath)).entries,
  });

  console.log('# AI Memory Search');
  console.log(`Query: ${query || '(recent entries)'}`);
  if (normalizedType) console.log(`Type: ${normalizedType}`);
  console.log(`Database: ${path.relative(runtime.root, runtime.memoryDbPath).replace(/\\/g, '/')}`);

  if (entries.length === 0) {
    console.log('\nNo memory entries found.');
    return;
  }

  for (const entry of entries) {
    console.log('\n---');
    console.log(`## ${entry.type.toUpperCase()}: ${entry.title}`);
    console.log(`Summary: ${entry.summary}`);
    if (entry.tags.length > 0) console.log(`Tags: ${entry.tags.join(', ')}`);
    if (entry.sourceRef) console.log(`Source: ${entry.sourceRef}`);
    if (entry.sidecarPath) console.log(`Artifact: ${entry.sidecarPath}`);
    if (entry.score !== null) console.log(`Score: ${entry.score.toFixed(3)}`);
    console.log(entry.content);
  }
}

function saveManualMemoryEntry(runtime, opts) {
  if (!isSqliteAvailable()) {
    console.error('Local memory save is unavailable: node:sqlite is not supported in this runtime.');
    process.exit(1);
  }

  const entryType = normalizeEntryType(opts.type);
  const content = resolveContentValue(opts, runtime.root);
  const entry = saveMemoryEntry(runtime.layout, {
    type: entryType,
    title: opts.title,
    content,
    summary: opts.summary,
    tags: normalizeTags(opts.tags),
    sourceRef: opts.sourceRef,
    confidence: opts.confidence,
  });

  console.log('✅ Memory entry saved');
  console.log(`- Type: ${entry.type}`);
  console.log(`- Title: ${entry.title}`);
  console.log(`- Database: ${path.relative(runtime.root, runtime.memoryDbPath).replace(/\\/g, '/')}`);
  if (entry.sidecarPath) console.log(`- Artifact: ${entry.sidecarPath}`);
  if (entry.tags.length > 0) console.log(`- Tags: ${entry.tags.join(', ')}`);
}

function main(optionsOrArgv = process.argv, env = process.env, baseCwd = process.cwd()) {
  const input = normalizeMainInput(optionsOrArgv, env, baseCwd);
  const argv = input.argv;
  const runtimeEnv = input.env;
  const runtime = resolveRuntime((argv || []).slice(2), runtimeEnv, input.projectPath);

  if (!fs.existsSync(runtime.root) || !fs.statSync(runtime.root).isDirectory()) {
    console.error(`Invalid --project-path: ${runtime.root}`);
    process.exit(1);
  }

  const opts = parseArgs(argv);
  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.action === 'search') {
    printMemorySearch(runtime, opts);
    return;
  }

  if (opts.action === 'save') {
    if (!String(opts.type || '').trim()) {
      console.error('Missing required --type for memory save.');
      process.exit(1);
    }
    if (!String(opts.title || '').trim()) {
      console.error('Missing required --title for memory save.');
      process.exit(1);
    }
    saveManualMemoryEntry(runtime, opts);
    return;
  }

  const context = loadContextConfig(runtime.contextPath);
  const { entries, bytes } = resolveWindowOptions(opts, context);
  const selectedKeys = selectLogKeys(opts.logs, runtime.logs);

  if (!selectedKeys.length) {
  console.error('No valid logs selected. Valid values: plan, proposal, discussion, change, error, global');
    process.exit(1);
  }

  const now = new Date().toISOString();
  console.log('# AI Memory Snapshot');
  console.log(`Generated: ${now}`);
  console.log(`Entries per log: ${entries}`);
  console.log(`Bytes per log: ${bytes}`);

  for (const key of selectedKeys) {
    const meta = runtime.logs[key];
    const rel = path.relative(runtime.root, meta.path).replace(/\\/g, '/');
    const content = readLogWindow(meta.path, entries, bytes);
    console.log('\n---');
    console.log(`## ${meta.label} (${rel})`);
    console.log(content);
  }
}

if (require.main === module) {
  enforceDispatcherGuard({
    useCommand: 'npm run undes:memory -- [--entries=N] [--bytes=N] [--log=...]',
  });
  main();
}

module.exports = {
  toInt,
  parseArgs,
  resolveRuntime,
  loadContextConfig,
  resolveWindowOptions,
  trimToBytes,
  extractEntries,
  readLogWindow,
  selectLogKeys,
  resolveContentValue,
  printMemorySearch,
  saveManualMemoryEntry,
  normalizeMainInput,
  main,
};
