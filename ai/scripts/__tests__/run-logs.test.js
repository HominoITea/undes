const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createRunLoggers } = require('../infrastructure/run-logs');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-logs-'));
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

test('ensureUnifiedLogs creates all typed logs', () => {
  const root = mkTmp();
  const logsDir = path.join(root, 'logs');
  const runLogs = createRunLoggers({
    globalLogPath: path.join(logsDir, 'AI_LOG.md'),
    changeLogPath: path.join(logsDir, 'AI_CHANGE_LOG.md'),
    planLogPath: path.join(logsDir, 'AI_PLAN_LOG.md'),
    proposalLogPath: path.join(logsDir, 'AI_PROPOSAL_LOG.md'),
    discussionLogPath: path.join(logsDir, 'AI_DISCUSSION_LOG.md'),
    errorLogPath: path.join(logsDir, 'AI_ERROR_LOG.md'),
    aiLogDir: logsDir,
  });

  runLogs.ensureUnifiedLogs();

  assert.equal(fs.existsSync(path.join(logsDir, 'AI_LOG.md')), true);
  assert.equal(fs.existsSync(path.join(logsDir, 'AI_CHANGE_LOG.md')), true);
  assert.equal(fs.existsSync(path.join(logsDir, 'AI_PLAN_LOG.md')), true);
  assert.equal(fs.existsSync(path.join(logsDir, 'AI_PROPOSAL_LOG.md')), true);
  assert.equal(fs.existsSync(path.join(logsDir, 'AI_DISCUSSION_LOG.md')), true);
  assert.equal(fs.existsSync(path.join(logsDir, 'AI_ERROR_LOG.md')), true);
});

test('appendPlanLog writes structured entry', () => {
  const root = mkTmp();
  const logsDir = path.join(root, 'logs');
  const runLogs = createRunLoggers({
    globalLogPath: path.join(logsDir, 'AI_LOG.md'),
    changeLogPath: path.join(logsDir, 'AI_CHANGE_LOG.md'),
    planLogPath: path.join(logsDir, 'AI_PLAN_LOG.md'),
    proposalLogPath: path.join(logsDir, 'AI_PROPOSAL_LOG.md'),
    discussionLogPath: path.join(logsDir, 'AI_DISCUSSION_LOG.md'),
    errorLogPath: path.join(logsDir, 'AI_ERROR_LOG.md'),
    aiLogDir: logsDir,
  });

  runLogs.appendPlanLog({ runId: 'run-123', request: 'Implement X', status: 'DONE', notes: 'ok' });
  const text = read(path.join(logsDir, 'AI_PLAN_LOG.md'));

  assert.match(text, /Run ID: run-123/);
  assert.match(text, /Request: Implement X/);
  assert.match(text, /Status: DONE/);
});

test('appendToGlobalLog uses sanitizer', () => {
  const root = mkTmp();
  const logsDir = path.join(root, 'logs');
  const runLogs = createRunLoggers({
    globalLogPath: path.join(logsDir, 'AI_LOG.md'),
    changeLogPath: path.join(logsDir, 'AI_CHANGE_LOG.md'),
    planLogPath: path.join(logsDir, 'AI_PLAN_LOG.md'),
    proposalLogPath: path.join(logsDir, 'AI_PROPOSAL_LOG.md'),
    discussionLogPath: path.join(logsDir, 'AI_DISCUSSION_LOG.md'),
    errorLogPath: path.join(logsDir, 'AI_ERROR_LOG.md'),
    aiLogDir: logsDir,
    sanitizeText: () => '[SANITIZED]',
  });

  runLogs.appendToGlobalLog('secret prompt');
  const text = read(path.join(logsDir, 'AI_LOG.md'));

  assert.match(text, /\*\*User Query:\*\* \[SANITIZED\]/);
});

test('autoLogAgent routes proposal phase to proposal log', async () => {
  const root = mkTmp();
  const logsDir = path.join(root, 'logs');
  const artifact = path.join(root, 'archive', 'agent-proposal.txt');
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  fs.writeFileSync(artifact, 'data');

  const runLogs = createRunLoggers({
    globalLogPath: path.join(logsDir, 'AI_LOG.md'),
    changeLogPath: path.join(logsDir, 'AI_CHANGE_LOG.md'),
    planLogPath: path.join(logsDir, 'AI_PLAN_LOG.md'),
    proposalLogPath: path.join(logsDir, 'AI_PROPOSAL_LOG.md'),
    discussionLogPath: path.join(logsDir, 'AI_DISCUSSION_LOG.md'),
    errorLogPath: path.join(logsDir, 'AI_ERROR_LOG.md'),
    aiLogDir: logsDir,
  });

  await runLogs.autoLogAgent('architect', 'proposal', artifact, 'Completed', 'proposal text');

  const proposalText = read(path.join(logsDir, 'AI_PROPOSAL_LOG.md'));

  assert.match(proposalText, /Phase: proposal/);
  assert.match(proposalText, /Summary: proposal text/);
});

test('appendErrorLog writes structured error entry', () => {
  const root = mkTmp();
  const logsDir = path.join(root, 'logs');
  const runLogs = createRunLoggers({
    globalLogPath: path.join(logsDir, 'AI_LOG.md'),
    changeLogPath: path.join(logsDir, 'AI_CHANGE_LOG.md'),
    planLogPath: path.join(logsDir, 'AI_PLAN_LOG.md'),
    proposalLogPath: path.join(logsDir, 'AI_PROPOSAL_LOG.md'),
    discussionLogPath: path.join(logsDir, 'AI_DISCUSSION_LOG.md'),
    errorLogPath: path.join(logsDir, 'AI_ERROR_LOG.md'),
    aiLogDir: logsDir,
  });

  const error = new Error('Anthropic API error (429): rate_limit_error');
  error.provider = 'anthropic';
  error.status = 429;
  error.retryAfter = '60';
  error.headers = { 'retry-after': '60' };

  runLogs.appendErrorLog({
    model: 'architect',
    phase: 'proposal',
    status: 'RETRYING',
    error,
    details: { attempt: 1, maxAttempts: 4 },
  });

  const text = read(path.join(logsDir, 'AI_ERROR_LOG.md'));
  assert.match(text, /Source: architect/);
  assert.match(text, /Phase: proposal/);
  assert.match(text, /Status: RETRYING/);
  assert.match(text, /"provider": "anthropic"/);
  assert.match(text, /"status": "429"/);
});
