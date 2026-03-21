const DEFAULT_MAX_DISCUSSION_LOG_BYTES = 120_000;

function formatDiscussionEntry(entry) {
  const roleLabel = entry.role ? ` (${entry.role})` : '';
  const stageLabel = entry.stage ? ` [${entry.stage}]` : '';
  return `## ${entry.name}${roleLabel}${stageLabel}\n${entry.text}\n`;
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

module.exports = {
  DEFAULT_MAX_DISCUSSION_LOG_BYTES,
  formatDiscussionEntry,
  buildDiscussionLog,
};
