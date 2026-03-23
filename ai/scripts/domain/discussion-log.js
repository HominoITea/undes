const DEFAULT_MAX_DISCUSSION_LOG_BYTES = 120_000;
const DEFAULT_COMPACT_DISCUSSION_MAX_ENTRIES = 6;
const DEFAULT_COMPACT_DISCUSSION_ENTRY_CHARS = 420;
const DEFAULT_COMPACT_DISCUSSION_MAX_BYTES = 9_000;

function formatDiscussionEntry(entry) {
  const roleLabel = entry.role ? ` (${entry.role})` : '';
  const stageLabel = entry.stage ? ` [${entry.stage}]` : '';
  return `## ${entry.name}${roleLabel}${stageLabel}\n${entry.text}\n`;
}

function summarizeDiscussionText(text = '', maxChars = DEFAULT_COMPACT_DISCUSSION_ENTRY_CHARS) {
  const limit = Number(maxChars) || DEFAULT_COMPACT_DISCUSSION_ENTRY_CHARS;
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'N/A';
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 3))}...`;
}

function splitDiscussionEntries(discussionText = '') {
  const normalized = String(discussionText || '').trim();
  if (!normalized) return [];
  if (!/^## /m.test(normalized)) return [];
  const sections = normalized.split(/\n(?=## )/).map((chunk) => chunk.trim()).filter(Boolean);
  return sections.map((section) => {
    const lines = section.split('\n');
    const header = lines.shift() || '';
    const body = lines.join('\n').trim();
    return { header, body };
  }).filter((entry) => entry.header);
}

function buildDiscussionLog(agentsOutputs = [], options = {}) {
  const maxBytes = Number(options.maxBytes) || DEFAULT_MAX_DISCUSSION_LOG_BYTES;

  const formatted = agentsOutputs.map((entry) => formatDiscussionEntry(entry));
  const full = formatted.join('\n');

  if (Buffer.byteLength(full, 'utf8') <= maxBytes) {
    return full;
  }

  // Keep newest entries, drop oldest until within budget.
  // Always keep at least the last entry.
  const kept = [];
  let totalBytes = 0;
  const separator = '\n';
  const windowHeader = '[… earlier discussion entries truncated for brevity …]\n\n';
  const headerBytes = Buffer.byteLength(windowHeader, 'utf8');
  const budget = maxBytes - headerBytes;

  for (let i = formatted.length - 1; i >= 0; i--) {
    const entryBytes = Buffer.byteLength(formatted[i], 'utf8')
      + (kept.length > 0 ? Buffer.byteLength(separator, 'utf8') : 0);
    if (totalBytes + entryBytes > budget && kept.length > 0) break;
    kept.unshift(formatted[i]);
    totalBytes += entryBytes;
  }

  const truncated = kept.length < formatted.length;
  const body = kept.join(separator);
  return truncated ? windowHeader + body : body;
}

function buildCompactDiscussionLogText(discussionText = '', options = {}) {
  const maxEntries = Number(options.maxEntries) || DEFAULT_COMPACT_DISCUSSION_MAX_ENTRIES;
  const maxEntryChars = Number(options.maxEntryChars) || DEFAULT_COMPACT_DISCUSSION_ENTRY_CHARS;
  const maxBytes = Number(options.maxBytes) || DEFAULT_COMPACT_DISCUSSION_MAX_BYTES;
  const entries = splitDiscussionEntries(discussionText);

  if (entries.length === 0) return String(discussionText || '').trim();

  const keptEntries = entries.slice(-maxEntries);
  const truncatedCount = Math.max(0, entries.length - keptEntries.length);
  const compactBody = keptEntries.map((entry) => `${entry.header}\n${summarizeDiscussionText(entry.body, maxEntryChars)}\n`).join('\n');
  const prefix = truncatedCount > 0
    ? `[… ${truncatedCount} earlier discussion entr${truncatedCount === 1 ? 'y' : 'ies'} summarized/omitted …]\n\n`
    : '';
  const combined = `${prefix}${compactBody}`.trim();

  if (Buffer.byteLength(combined, 'utf8') <= maxBytes) {
    return combined;
  }

  const tighterEntries = Math.max(1, Math.min(maxEntries, 4));
  const tighterChars = Math.max(140, Math.floor(maxEntryChars * 0.6));
  const retryEntries = keptEntries.slice(-tighterEntries).map((entry) => `${entry.header}\n${summarizeDiscussionText(entry.body, tighterChars)}\n`).join('\n');
  const retryPrefix = entries.length > tighterEntries
    ? `[… ${entries.length - tighterEntries} earlier discussion entries summarized/omitted …]\n\n`
    : '';
  const retryCombined = `${retryPrefix}${retryEntries}`.trim();

  if (Buffer.byteLength(retryCombined, 'utf8') <= maxBytes) {
    return retryCombined;
  }

  const finalLimit = Math.max(600, maxBytes - 64);
  const hardTrimmed = retryCombined.slice(0, finalLimit).trimEnd();
  return `${hardTrimmed}\n…`;
}

module.exports = {
  DEFAULT_MAX_DISCUSSION_LOG_BYTES,
  DEFAULT_COMPACT_DISCUSSION_MAX_ENTRIES,
  DEFAULT_COMPACT_DISCUSSION_ENTRY_CHARS,
  DEFAULT_COMPACT_DISCUSSION_MAX_BYTES,
  formatDiscussionEntry,
  buildDiscussionLog,
  buildCompactDiscussionLogText,
};
