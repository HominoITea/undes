'use strict';

const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

function detectLanguage(filePath) {
  if (filePath === '.cursorrules') return 'markdown';
  const ext = path.extname(filePath);
  switch (ext) {
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.mjs':
      return 'javascript';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.css':
      return 'css';
    default:
      return 'text';
  }
}

function createRedactSecrets(redactEnabled = true) {
  return function redactSecrets(contents) {
    if (!redactEnabled) return contents;

    let redacted = contents;
    const envPattern =
      /(^|\n)(\s*[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY)[A-Z0-9_]*\s*=\s*)([^\n]*)/gi;
    const jsonPattern =
      /("?(?:secret|token|password|apiKey|privateKey|clientSecret|accessKey)"?\s*:\s*)(".*?"|'.*?'|[^,\n}]+)/gi;

    // Catch common key prefixes in free text
    const openAiPattern = /\b(sk-[a-zA-Z0-9]{20,})\b/g;
    const googlePattern = /\b(AIza[0-9A-Za-z-_]{35})\b/g;

    redacted = redacted.replace(envPattern, (match, prefix, key, value) => {
      return `${prefix}${key}[REDACTED]`;
    });
    redacted = redacted.replace(jsonPattern, (match, prefix, value) => {
      const quote = value.trim().startsWith("'") ? "'" : '"';
      return `${prefix}${quote}[REDACTED]${quote}`;
    });

    redacted = redacted.replace(openAiPattern, 'sk-[REDACTED]');
    redacted = redacted.replace(googlePattern, 'AIza[REDACTED]');

    return redacted;
  };
}

function loadAiEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!key) return;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function readFile(filePath, options = {}) {
  const {
    fromLine = 1,
    toLine = Number.MAX_SAFE_INTEGER,
    maxBytes = Number.MAX_SAFE_INTEGER,
    resolveReadablePath,
    redactSecrets = (s) => s,
  } = options;

  try {
    const abs = resolveReadablePath
      ? resolveReadablePath(filePath, { allowHubFallback: true })
      : filePath;
    if (!abs) throw new Error('not found');
    const raw = fs.readFileSync(abs, 'utf8');
    const lines = raw.split('\n');
    const sliced = lines.slice(Math.max(0, fromLine - 1), Math.min(lines.length, toLine)).join('\n');

    const slicedBytes = Buffer.byteLength(sliced, 'utf8');
    let limited = sliced;
    if (slicedBytes > maxBytes) {
      limited = Buffer.from(sliced, 'utf8').slice(0, maxBytes).toString('utf8');
      // align to last complete line to avoid broken UTF-8/partial lines
      const lastNewline = limited.lastIndexOf('\n');
      if (lastNewline > 0) limited = limited.slice(0, lastNewline);
      limited += '\n... [truncated by maxBytes]';
    }

    return redactSecrets(limited);
  } catch (e) {
    return `[Error reading ${filePath}]`;
  }
}

function readAiLogWindow(filePath, maxEntries = 10, maxBytes = 15000, options = {}) {
  const {
    resolveReadablePath,
    redactSecrets = (s) => s,
  } = options;

  const abs = resolveReadablePath
    ? resolveReadablePath(filePath, { allowHubFallback: false })
    : filePath;
  if (!abs || !fs.existsSync(abs)) return `[Error reading ${filePath}]`;

  const text = fs.readFileSync(abs, 'utf8');
  const parts = text
    .split(/\n(?=##+\s*\[\d{4}-\d{2}-\d{2})/g)
    .map((part) => part.trim())
    .filter((part) => /^##+\s*\[\d{4}-\d{2}-\d{2}/.test(part));

  if (!parts.length) return 'No entries yet.';

  const lastEntries = parts.slice(-maxEntries).join('\n\n').trim();

  const bytes = Buffer.byteLength(lastEntries, 'utf8');
  if (bytes <= maxBytes) return redactSecrets(lastEntries);

  // trim from tail, then align to first complete line to avoid broken UTF-8
  const buf = Buffer.from(lastEntries, 'utf8').slice(bytes - maxBytes);
  const raw = buf.toString('utf8');
  const firstNewline = raw.indexOf('\n');
  const trimmed = firstNewline >= 0 ? raw.slice(firstNewline + 1) : raw;
  return redactSecrets(trimmed);
}

function runGitLsFiles() {
  try {
    return execSync('git ls-files', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return '';
  }
}

function runTreeCommand(treeCmd) {
  if (!treeCmd || typeof treeCmd !== 'string') return '';
  const cmd = treeCmd.trim();
  if (!cmd) return '';

  // "find -maxdepth ..." commands are usually Unix-specific and noisy on Windows cmd.exe.
  if (process.platform === 'win32' && /\bfind\b/i.test(cmd) && cmd.includes('-maxdepth')) {
    return '';
  }

  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return '';
  }
}

function walkProjectFiles(maxFiles = 5000) {
  const results = [];
  const skipDirs = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', 'coverage', 'bin', 'obj']);

  const walk = (dir, depth = 0) => {
    if (depth > 10 || results.length >= maxFiles) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(fullPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;
      results.push(relPath);
    }
  };

  walk(process.cwd(), 0);
  return results;
}

function splitLines(text = '') {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function listIndexableFiles(treeCmd, maxFiles = 5000) {
  const set = new Set();

  splitLines(runGitLsFiles()).forEach((f) => set.add(f));
  splitLines(runTreeCommand(treeCmd)).forEach((f) => set.add(f));

  if (set.size === 0) {
    walkProjectFiles(maxFiles).forEach((f) => set.add(f));
  }

  return [...set]
    .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|py|java|cs)$/i.test(f))
    .slice(0, maxFiles);
}

module.exports = {
  detectLanguage,
  createRedactSecrets,
  loadAiEnv,
  readFile,
  readAiLogWindow,
  runGitLsFiles,
  runTreeCommand,
  walkProjectFiles,
  splitLines,
  listIndexableFiles,
};
