// ============ TEXT UTILITIES ============
const path = require('path');
const { stripEndMarker } = require('./prompt-content');

function utcTimestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function projectName() {
  const name = path.basename(process.cwd());
  return name || 'project';
}

function toRelativePath(targetPath = '') {
  if (!targetPath) return '';
  return path.relative(process.cwd(), targetPath).replace(/\\/g, '/') || targetPath;
}

function summarizeText(text = '', maxLen = 320) {
  const cleaned = stripEndMarker(String(text || ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'N/A';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 3)}...`;
}

function normalizeTokenCount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
}

function buildToolLoopExhaustedPrompt() {
  return [
    '[System Note: File-reader budget is exhausted. You will not receive more files in this run.]',
    '[System Note: Use only the context bundle and files already provided in this conversation.]',
    '[System Note: Do not output any READ_FILE markers. Return your best final answer now.]',
  ].join('\n');
}

function stripReadFileMarkers(text = '') {
  return String(text || '')
    .replace(/<<<READ_FILE:\s*[^>]+>>>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeForcedFinalAnswer(text = '') {
  const cleaned = stripReadFileMarkers(text);

  if (cleaned) return cleaned;
  return 'Tool budget exhausted before the agent produced a final answer.';
}

function mergeContinuationText(originalText = '', continuationText = '') {
  const original = stripEndMarker(String(originalText || '')).trimEnd();
  const continuation = String(continuationText || '').trimStart();
  if (!original) return continuation;
  if (!continuation) return original;
  const separator = /[\s\n]$/.test(original) || /^[\s,.;:!?)]/.test(continuation) ? '' : '\n';
  return `${original}${separator}${continuation}`;
}

function sanitizeTaskId(value = '') {
  return String(value || '')
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = {
  utcTimestamp,
  projectName,
  toRelativePath,
  summarizeText,
  normalizeTokenCount,
  buildToolLoopExhaustedPrompt,
  stripReadFileMarkers,
  sanitizeForcedFinalAnswer,
  mergeContinuationText,
  sanitizeTaskId,
};
