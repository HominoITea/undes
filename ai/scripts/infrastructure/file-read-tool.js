const fs = require('fs');
const path = require('path');

const BLOCKED_FILE_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /credentials/i,
  /secrets?[\/._-]/i,
  /private[\/._-]?key/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /password/i,
  /tokens?\.(json|txt|env)$/i,
];

function isBlockedFile(filePath = '') {
  const normalized = String(filePath || '').toLowerCase();
  const parts = normalized.split(/[/\\]/);
  for (const part of parts) {
    if (part.startsWith('.') && part !== '.' && part !== '..') {
      const allowed = ['.cursorrules', '.gitignore', '.eslintrc', '.prettierrc'];
      if (!allowed.some((allowedPart) => part.startsWith(allowedPart))) {
        return { blocked: true, reason: 'Hidden files are restricted' };
      }
    }
  }

  for (const pattern of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { blocked: true, reason: `File matches blocked pattern: ${pattern}` };
    }
  }

  return { blocked: false, reason: '' };
}

function extractFileReadRequests(text = '') {
  const regex = /<<<READ_FILE:\s*(.+?)>>>/g;
  const matches = [];
  let match;
  while ((match = regex.exec(String(text || ''))) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

function parseFileRequest(request = '') {
  const raw = String(request || '').trim();
  const match = raw.match(/^(.*?)(?:#L(\d+)(?:-L?(\d+))?)?$/);
  if (!match) {
    return {
      request: raw,
      filePath: raw,
      fromLine: null,
      toLine: null,
    };
  }

  const filePath = String(match[1] || '').trim();
  const fromLine = match[2] ? Number.parseInt(match[2], 10) : null;
  const toLine = match[3] ? Number.parseInt(match[3], 10) : null;

  return {
    request: raw,
    filePath,
    fromLine: Number.isFinite(fromLine) ? fromLine : null,
    toLine: Number.isFinite(toLine) ? toLine : null,
  };
}

function getFileContent(fileRequest, options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const maxFileBytes = Number.isFinite(options.maxFileBytes) ? options.maxFileBytes : 100 * 1024;
  const parsed = parseFileRequest(fileRequest);
  const filePath = parsed.filePath;

  try {
    if (String(filePath || '').includes('..')) {
      return { content: `[Error: Path traversal not allowed: ${filePath}]`, size: 0, ok: false };
    }

    const fullPath = path.resolve(rootDir, String(filePath || ''));
    if (!fullPath.startsWith(rootDir)) {
      return { content: `[Error: Access denied - file outside working directory: ${filePath}]`, size: 0, ok: false };
    }

    const blockCheck = isBlockedFile(filePath);
    if (blockCheck.blocked) {
      return { content: `[Error: Access denied - ${blockCheck.reason}]`, size: 0, ok: false };
    }

    if (!fs.existsSync(fullPath)) {
      return { content: `[Error: File not found: ${filePath}]`, size: 0, ok: false };
    }

    const stats = fs.statSync(fullPath);
    const hasRange = parsed.fromLine !== null;
    if (!hasRange && stats.size > maxFileBytes) {
      return {
        content: `[Error: File too large (${stats.size} bytes). Request a narrower range like ${filePath}#L120-L260.]`,
        size: 0,
        ok: false,
      };
    }

    const raw = fs.readFileSync(fullPath, 'utf8');
    if (!hasRange) {
      return { content: raw, size: stats.size, ok: true };
    }

    const lines = raw.split('\n');
    const start = Math.max(1, parsed.fromLine);
    const end = Math.max(start, parsed.toLine || parsed.fromLine);
    const boundedEnd = Math.min(end, lines.length);
    const excerpt = lines.slice(start - 1, boundedEnd).join('\n');
    return {
      content: excerpt,
      size: Buffer.byteLength(excerpt, 'utf8'),
      ok: true,
    };
  } catch (error) {
    return { content: `[Error reading ${filePath}: ${error.message}]`, size: 0, ok: false };
  }
}

module.exports = {
  BLOCKED_FILE_PATTERNS,
  isBlockedFile,
  extractFileReadRequests,
  parseFileRequest,
  getFileContent,
};
