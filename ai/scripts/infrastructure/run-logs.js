const fs = require('fs');
const path = require('path');

function createRunLoggers(options) {
  const {
    globalLogPath,
    changeLogPath,
    planLogPath,
    proposalLogPath,
    discussionLogPath,
    errorLogPath: rawErrorLogPath,
    aiLogDir,
    endMarker = '=== END OF DOCUMENT ===',
    utcTimestamp = () => new Date().toISOString().replace('T', ' ').replace('Z', ' UTC'),
    projectName = () => path.basename(process.cwd()) || 'project',
    toRelativePath = (targetPath = '') => path.relative(process.cwd(), targetPath).replace(/\\/g, '/'),
    summarizeText = (text = '') => String(text || '').trim(),
    sanitizeText = (text = '') => String(text || ''),
  } = options || {};
  const errorLogPath = rawErrorLogPath || path.join(aiLogDir || path.dirname(globalLogPath || '.'), 'AI_ERROR_LOG.md');

  function ensureLogFile(filePath, header) {
    if (fs.existsSync(filePath)) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${String(header || '').trim()}\n`);
  }

  function ensureUnifiedLogs() {
    const fenced = (lines) => ['```markdown', ...lines, '```'].join('\n');
    const changeTemplate = fenced([
      '## [YYYY-MM-DD HH:mm:ss UTC] - Model: <name>',
      'Project: <project>',
      'Path: <cwd>',
      'Phase: <consensus|revision|post-process|...>',
      'Artifacts:',
      '- <file/path>',
      'Status: <COMPLETED|PARTIAL|FAILED>',
      'Summary: <short summary>',
    ]);
    const planTemplate = fenced([
      '## [YYYY-MM-DD HH:mm:ss UTC] - Model: <name>',
      'Project: <project>',
      'Path: <cwd>',
      'Run ID: <id>',
      'Request: <short request>',
      'Status: <IN_PROGRESS|DONE|FAILED>',
      'Notes: <optional>',
    ]);
    const proposalTemplate = fenced([
      '## [YYYY-MM-DD HH:mm:ss UTC] - Model: <name>',
      'Project: <project>',
      'Path: <cwd>',
      'Phase: proposal',
      'Artifact: <file/path>',
      'Summary: <short summary>',
    ]);
    const discussionTemplate = fenced([
      '## [YYYY-MM-DD HH:mm:ss UTC] - Model: <name>',
      'Project: <project>',
      'Path: <cwd>',
      'Phase: <critique|approval|tester|devil-advocate|...>',
      'Artifact: <file/path>',
      'Summary: <short summary>',
    ]);
    const errorTemplate = fenced([
      '## [YYYY-MM-DD HH:mm:ss UTC] - Source: <agent|system>',
      'Project: <project>',
      'Path: <cwd>',
      'Phase: <proposal|critique|consensus|runtime|...>',
      'Status: <RETRYING|FAILED>',
      'Summary: <short summary>',
      'Details:',
      '```json',
      '{ "provider": "anthropic", "status": 429 }',
      '```',
    ]);

    ensureLogFile(
      globalLogPath,
      `# Global AI Interaction Log (Shared Memory)

This file acts as the **Project History and Context** for all AI assistants.

## LOG ENTRIES
`,
    );

    ensureLogFile(
      changeLogPath,
      `# AI Change Log

Tracks completed changes and resulting artifacts from all models.

## Entry Template

${changeTemplate}

## LOG ENTRIES
`,
    );

    ensureLogFile(
      planLogPath,
      `# AI Plan Log

Tracks planned improvements/tasks and execution lifecycle.

## Entry Template

${planTemplate}

## LOG ENTRIES
`,
    );

    ensureLogFile(
      proposalLogPath,
      `# AI Proposal Log

Tracks proposals and draft solution suggestions per model.

## Entry Template

${proposalTemplate}

## LOG ENTRIES
`,
    );

    ensureLogFile(
      discussionLogPath,
      `# AI Discussion Log

Tracks critique, review, approval, tester, and devil\'s advocate discussions.

## Entry Template

${discussionTemplate}

## LOG ENTRIES
`,
    );

    ensureLogFile(
      errorLogPath,
      `# AI Error Log

Tracks runtime/provider failures, retries, and fatal execution errors.

## Entry Template

${errorTemplate}

## LOG ENTRIES
`,
    );
  }

  function appendMarkdownEntry(filePath, body) {
    try {
      ensureUnifiedLogs();
      fs.appendFileSync(filePath, `\n${String(body || '').trim()}\n`);
    } catch (error) {
      console.warn(`⚠️ Failed to append log ${toRelativePath(filePath)}: ${error.message}`);
    }
  }

  function appendPlanLog({ model = 'AI Panel (Automated)', runId = '', request = '', status = 'IN_PROGRESS', notes = '' }) {
    const entry = [
      `## [${utcTimestamp()}] - Model: ${model}`,
      `Project: ${projectName()}`,
      `Path: ${process.cwd()}`,
      `Run ID: ${runId || 'N/A'}`,
      `Request: ${summarizeText(request, 400)}`,
      `Status: ${status}`,
      `Notes: ${notes || 'N/A'}`,
    ].join('\n');
    appendMarkdownEntry(planLogPath, entry);
  }

  function appendProposalLog({ model = 'agent', phase = 'proposal', artifactPath = '', text = '' }) {
    const entry = [
      `## [${utcTimestamp()}] - Model: ${model}`,
      `Project: ${projectName()}`,
      `Path: ${process.cwd()}`,
      `Phase: ${phase}`,
      `Artifact: ${toRelativePath(artifactPath) || 'N/A'}`,
      `Summary: ${summarizeText(text)}`,
    ].join('\n');
    appendMarkdownEntry(proposalLogPath, entry);
  }

  function appendDiscussionLog({ model = 'agent', phase = 'discussion', artifactPath = '', text = '' }) {
    const entry = [
      `## [${utcTimestamp()}] - Model: ${model}`,
      `Project: ${projectName()}`,
      `Path: ${process.cwd()}`,
      `Phase: ${phase}`,
      `Artifact: ${toRelativePath(artifactPath) || 'N/A'}`,
      `Summary: ${summarizeText(text)}`,
    ].join('\n');
    appendMarkdownEntry(discussionLogPath, entry);
  }

  function appendChangeLog({ model = 'AI Panel (Automated)', phase = 'consensus', artifacts = [], status = 'COMPLETED', summary = '' }) {
    const artifactLines = artifacts.length
      ? artifacts.map((item) => `- ${toRelativePath(item)}`)
      : ['- N/A'];
    const entry = [
      `## [${utcTimestamp()}] - Model: ${model}`,
      `Project: ${projectName()}`,
      `Path: ${process.cwd()}`,
      `Phase: ${phase}`,
      'Artifacts:',
      ...artifactLines,
      `Status: ${status}`,
      `Summary: ${summary || 'N/A'}`,
    ].join('\n');
    appendMarkdownEntry(changeLogPath, entry);
  }

  function buildErrorDetails(error, extra = {}) {
    const details = {
      ...extra,
    };

    const safeAssign = (key, value, maxLen = 4000) => {
      if (value === undefined || value === null || value === '') return;
      const text = sanitizeText(String(value));
      details[key] = text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
    };

    if (error && typeof error === 'object') {
      safeAssign('errorName', error.name);
      safeAssign('message', error.message);
      safeAssign('provider', error.provider);
      safeAssign('agentName', error.agentName);
      safeAssign('model', error.model);
      safeAssign('apiUrl', error.apiUrl);
      safeAssign('status', error.status);
      safeAssign('statusText', error.statusText);
      safeAssign('requestId', error.requestId);
      safeAssign('retryAfter', error.retryAfter);
      safeAssign('responseBody', error.responseBody);
      safeAssign('completionStatus', error.completionStatus);
      safeAssign('outputPath', error.outputPath);
      safeAssign('operatorReason', error.operatorReason);
      safeAssign('estimatedInputTokens', error.estimatedInputTokens);
      safeAssign('contextBudget', error.contextBudget);
      safeAssign('maxOutputTokens', error.maxOutputTokens);
      safeAssign('configuredMaxOutputTokens', error.configuredMaxOutputTokens);
      safeAssign('recommendedOutputTokens', error.recommendedOutputTokens);
      safeAssign('repairBudgetTokens', error.repairBudgetTokens);
      safeAssign('agreementScore', error.agreementScore);
      safeAssign('budgetShortfallTokens', error.budgetShortfallTokens);
      if (error.headers && typeof error.headers === 'object' && Object.keys(error.headers).length > 0) {
        details.headers = error.headers;
      }
      if (error.cause && typeof error.cause === 'object') {
        details.cause = {
          name: error.cause.name || 'Error',
          message: sanitizeText(String(error.cause.message || '')),
          code: error.cause.code || '',
        };
      }
      safeAssign('stack', error.stack, 6000);
    } else {
      safeAssign('message', error);
    }

    return details;
  }

  function appendErrorLog({
    model = 'system',
    phase = 'runtime',
    status = 'FAILED',
    summary = '',
    error = null,
    details = {},
  }) {
    const mergedDetails = buildErrorDetails(error, details);
    const detailJson = JSON.stringify(mergedDetails, null, 2);
    const entry = [
      `## [${utcTimestamp()}] - Source: ${model}`,
      `Project: ${projectName()}`,
      `Path: ${process.cwd()}`,
      `Phase: ${phase}`,
      `Status: ${status}`,
      `Summary: ${summary || summarizeText(error?.message || String(error || 'Unknown error'))}`,
      'Details:',
      '```json',
      detailJson,
      '```',
    ].join('\n');
    appendMarkdownEntry(errorLogPath, entry);
  }

  function appendToGlobalLog(promptText) {
    const safePrompt = sanitizeText(promptText || '');
    const entry = [
      `## [${utcTimestamp()}] - Agent: AI Panel (Automated)`,
      '',
      `**User Query:** ${safePrompt}`,
      '',
      '**Reasoning:** Automated multi-agent panel execution.',
      '',
      '**Changes:** See .ai/prompts/result.txt and .ai/logs/*.md logs.',
      '',
      '**Status:** Completed',
      '',
      endMarker,
      '',
    ].join('\n');

    try {
      ensureUnifiedLogs();
      fs.appendFileSync(globalLogPath, `${entry}\n`);
      console.log(`📝 Auto-logged to ${toRelativePath(globalLogPath)}`);
    } catch (e) {
      console.error('⚠️ Failed to auto-log:', e.message);
    }
  }

  async function autoLogAgent(agentName, phase, responseFile, status = 'Completed', responseText = '') {
    const timestamp = utcTimestamp();
    const entry = [
      `## [${timestamp}] - Agent: ${agentName}`,
      `**Phase:** ${phase}`,
      `**Output:** ${toRelativePath(responseFile) || responseFile}`,
      `**Status:** ${status}`,
      '',
      endMarker,
      '',
    ].join('\n');

    try {
      ensureUnifiedLogs();
      fs.appendFileSync(globalLogPath, `${entry}\n`);

      const phaseLower = String(phase || '').toLowerCase();
      const payload = {
        model: agentName,
        phase,
        artifactPath: responseFile,
        text: responseText,
      };

      if (phaseLower === 'proposal' || phaseLower === 'pre-process') {
        appendProposalLog(payload);
      } else if (phaseLower === 'consensus' || phaseLower === 'revision' || phaseLower === 'da-revision') {
        appendChangeLog({
          model: agentName,
          phase,
          artifacts: [responseFile],
          summary: summarizeText(responseText),
          status: status === 'Completed' ? 'COMPLETED' : String(status || '').toUpperCase(),
        });
      } else {
        appendDiscussionLog(payload);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to auto-log for ${agentName}:`, e.message);
    }
  }

  return {
    ensureUnifiedLogs,
    appendMarkdownEntry,
    appendPlanLog,
    appendProposalLog,
    appendDiscussionLog,
    appendChangeLog,
    appendErrorLog,
    appendToGlobalLog,
    autoLogAgent,
  };
}

module.exports = {
  createRunLoggers,
};
