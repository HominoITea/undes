const fs = require('fs');
const path = require('path');

const RESULT_MODE_PATCH_SAFE = 'PATCH_SAFE';
const RESULT_MODE_DIAGNOSTIC = 'DIAGNOSTIC';
const EVIDENCE_GROUNDED_SECTION_HEADINGS = {
  groundedFixes: 'Grounded Fixes',
  assumptions: 'Assumptions / Unverified Seams',
  assumedImplementation: 'Assumed Implementation',
  deferredChecks: 'Deferred Checks',
};
const EVIDENCE_NONE_PATTERNS = [
  /^(?:-?\s*)?(?:none|n\/a|no assumptions|no unverified seams|no deferred checks|none confirmed|not needed)\.?$/i,
  /^(?:-?\s*)?(?:none identified|none required)\.?$/i,
  /^(?:-?\s*)?(?:no grounded patch content(?: available)?|no grounded code(?: available)?|grounded code not available)\.?$/i,
];
const LIKELY_PROJECT_RECEIVER_SUFFIXES = [
  'service',
  'repository',
  'repo',
  'facade',
  'handler',
  'client',
  'mapper',
  'factory',
  'controller',
  'api',
  'entity',
  'dto',
  'request',
  'response',
  'context',
  'exception',
  'util',
  'utils',
];
const STANDARD_SEAM_RECEIVERS = new Set([
  'string',
  'strings',
  'math',
  'objects',
  'arrays',
  'collections',
  'list',
  'map',
  'set',
  'optional',
  'stream',
  'streams',
  'system',
  'console',
  'logger',
  'log',
  'json',
  'buffer',
  'path',
  'files',
  'paths',
  'date',
]);
const CONTRACT_GAP_CATEGORY_RULES = [
  { category: 'missing-section', pattern: /^Missing required section:/i },
  { category: 'missing-evidence-anchor', pattern: /without explicit `Evidence:` anchors/i },
  { category: 'missing-code-block', pattern: /without concrete code blocks or diff snippets/i },
  { category: 'code-without-evidence', pattern: /^Code blocks were found/i },
];
const GROUNDING_GAP_CATEGORY_RULES = [
  { category: 'missing-file-anchor', pattern: /Evidence anchor points to missing file/i },
  { category: 'unobserved-file-anchor', pattern: /Evidence anchor was not observed in the current run context/i },
  { category: 'unconfirmed-seam', pattern: /Grounded fix references unconfirmed .* seam/i },
  { category: 'substantive-assumptions', pattern: /Assumptions \/ Unverified Seams.*contains substantive items/i },
];

function normalizeProjectRelativeFilePath(filePath = '', projectRoot = process.cwd()) {
  const root = path.resolve(String(projectRoot || process.cwd()).trim() || process.cwd());
  const raw = String(filePath || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!raw || raw.includes('..')) return '';
  const resolved = path.resolve(root, raw);
  const relative = path.relative(root, resolved).replace(/\\/g, '/');
  if (!relative || relative.startsWith('..')) return '';
  return relative;
}

function normalizeResultMode(resultMode = '') {
  const normalized = String(resultMode || '').trim().toUpperCase();
  if (normalized === RESULT_MODE_PATCH_SAFE) return RESULT_MODE_PATCH_SAFE;
  return RESULT_MODE_DIAGNOSTIC;
}

function summarizeGapCategories(warnings = [], rules = []) {
  const source = Array.isArray(warnings) ? warnings : [];
  const categories = new Set();
  for (const warning of source) {
    const text = String(warning || '').trim();
    if (!text) continue;
    const matchedRule = rules.find((rule) => rule.pattern.test(text));
    categories.add(matchedRule ? matchedRule.category : 'other');
  }
  return Array.from(categories).sort();
}

function summarizeGapSamples(warnings = [], limit = 3) {
  const samples = [];
  for (const warning of Array.isArray(warnings) ? warnings : []) {
    const text = String(warning || '').trim();
    if (!text || samples.includes(text)) continue;
    samples.push(text);
    if (samples.length >= limit) break;
  }
  return samples;
}

function summarizeApprovalScores(approvalOutputs = []) {
  const scores = [];
  let agreedCount = 0;
  let disagreedCount = 0;
  for (const item of Array.isArray(approvalOutputs) ? approvalOutputs : []) {
    const approval = item?.approval || {};
    if (approval.agreed === true) agreedCount += 1;
    if (approval.agreed === false) disagreedCount += 1;
    const score = Number(approval.score);
    if (Number.isFinite(score)) scores.push(score);
  }
  const min = scores.length > 0 ? Math.min(...scores) : null;
  const max = scores.length > 0 ? Math.max(...scores) : null;
  return {
    count: scores.length,
    min,
    max,
    spread: Number.isFinite(min) && Number.isFinite(max) ? max - min : null,
    agreedCount,
    disagreedCount,
  };
}

function hasLateStageContextPressure(operationalSignals = {}) {
  const incompleteEvents = Array.isArray(operationalSignals?.incompleteOutputs?.events)
    ? operationalSignals.incompleteOutputs.events
    : [];
  for (const event of incompleteEvents) {
    const stage = String(event?.stage || '').trim();
    if (!['consensus', 'revision', 'da-revision'].includes(stage)) continue;
    if (String(event?.operatorReason || '').trim()) return true;
    if (String(event?.completionStatus || '').trim() === 'truncated') return true;
  }
  return false;
}

function classifyOperatorFailure(signal = {}, options = {}) {
  const failureClasses = new Set();
  const contractGapCategories = Array.isArray(signal.contractGapCategories)
    ? signal.contractGapCategories
    : [];
  const groundingGapCategories = Array.isArray(signal.groundingGapCategories)
    ? signal.groundingGapCategories
    : [];
  const approvalStats = summarizeApprovalScores(options.approvalOutputs);

  if (contractGapCategories.includes('missing-evidence-anchor')
    || groundingGapCategories.includes('missing-file-anchor')
    || groundingGapCategories.includes('unobserved-file-anchor')) {
    failureClasses.add('anchor-coverage-failure');
  }

  if (groundingGapCategories.includes('unconfirmed-seam')
    || (signal.hasSubstantiveAssumptions === true && Number(signal.candidateSeamCount) > 0)) {
    failureClasses.add('seam-confirmation-failure');
  }

  if ((approvalStats.agreedCount > 0 && approvalStats.disagreedCount > 0)
    || (Number.isFinite(approvalStats.spread) && approvalStats.spread >= 4)) {
    failureClasses.add('role-evidence-divergence');
  }

  if (hasLateStageContextPressure(options.operationalSignals)) {
    failureClasses.add('late-stage-context-pressure');
  }

  const orderedClasses = Array.from(failureClasses);
  const primaryFailureClass = orderedClasses[0] || (signal.resultMode === RESULT_MODE_DIAGNOSTIC ? 'other' : 'none');
  let failureSummary = '';
  switch (primaryFailureClass) {
    case 'anchor-coverage-failure':
      failureSummary = 'Evidence anchors do not align cleanly with files observed in this run.';
      break;
    case 'seam-confirmation-failure':
      failureSummary = 'Grounded fixes still rely on seams that were not directly confirmed by fetched evidence.';
      break;
    case 'role-evidence-divergence':
      failureSummary = 'Approval roles ended with materially different confidence on the same draft and evidence set.';
      break;
    case 'late-stage-context-pressure':
      failureSummary = 'Late synthesis stages showed output/context pressure that materially affected the run.';
      break;
    case 'other':
      failureSummary = 'The run remained diagnostic without matching a known primary failure class.';
      break;
    default:
      failureSummary = '';
  }

  return {
    primaryFailureClass,
    failureClasses: orderedClasses,
    failureSummary,
  };
}

function buildFinalTrustSignal(trust = {}, options = {}) {
  const groundedAnalysis = trust?.groundedAnalysis && typeof trust.groundedAnalysis === 'object'
    ? trust.groundedAnalysis
    : {};
  const groundingValidation = trust?.groundingValidation && typeof trust.groundingValidation === 'object'
    ? trust.groundingValidation
    : {};
  const contractWarnings = Array.isArray(groundedAnalysis.contractWarnings)
    ? groundedAnalysis.contractWarnings.map((warning) => String(warning || '').trim()).filter(Boolean)
    : [];
  const validationWarnings = Array.isArray(groundingValidation.validationWarnings)
    ? groundingValidation.validationWarnings.map((warning) => String(warning || '').trim()).filter(Boolean)
    : [];
  const resultMode = normalizeResultMode(trust.resultMode);

  const signal = {
    resultMode,
    copyPasteReady: resultMode === RESULT_MODE_PATCH_SAFE,
    allAgreed: options.allAgreed !== false,
    warningRequired: Boolean(trust.warningRequired),
    patchSafeEligible: groundingValidation.patchSafeEligible === true,
    contractGapCount: contractWarnings.length,
    groundingGapCount: validationWarnings.length,
    contractGapCategories: summarizeGapCategories(contractWarnings, CONTRACT_GAP_CATEGORY_RULES),
    groundingGapCategories: summarizeGapCategories(validationWarnings, GROUNDING_GAP_CATEGORY_RULES),
    contractGapSamples: summarizeGapSamples(contractWarnings),
    groundingGapSamples: summarizeGapSamples(validationWarnings),
    evidenceAnchorCount: Array.isArray(groundingValidation.evidenceAnchors) ? groundingValidation.evidenceAnchors.length : 0,
    observedFileCount: Array.isArray(groundingValidation.observedFiles) ? groundingValidation.observedFiles.length : 0,
    candidateSeamCount: Array.isArray(groundingValidation.candidateSeams) ? groundingValidation.candidateSeams.length : 0,
    hasSubstantiveAssumptions: groundingValidation.hasSubstantiveAssumptions === true,
    hasAssumedImplementation: groundingValidation.hasAssumedImplementation === true,
  };
  const classification = classifyOperatorFailure(signal, options);
  return {
    ...signal,
    primaryFailureClass: classification.primaryFailureClass,
    failureClasses: classification.failureClasses,
    failureSummary: classification.failureSummary,
  };
}

function extractMarkdownSectionBody(text = '', heading = '') {
  const source = String(text || '');
  const safeHeading = String(heading || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!safeHeading) return '';
  const pattern = new RegExp(`(^|\\n)##\\s+${safeHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
  const match = source.match(pattern);
  return match ? String(match[2] || '').trim() : '';
}

function analyzeEvidenceGroundedResultStructure(finalText = '') {
  const text = String(finalText || '');
  const groundedBody = extractMarkdownSectionBody(text, EVIDENCE_GROUNDED_SECTION_HEADINGS.groundedFixes);
  const assumptionsBody = extractMarkdownSectionBody(text, EVIDENCE_GROUNDED_SECTION_HEADINGS.assumptions);
  const assumedImplementationBody = extractMarkdownSectionBody(text, EVIDENCE_GROUNDED_SECTION_HEADINGS.assumedImplementation);
  const deferredChecksBody = extractMarkdownSectionBody(text, EVIDENCE_GROUNDED_SECTION_HEADINGS.deferredChecks);

  const contractWarnings = [];
  if (!groundedBody) contractWarnings.push('Missing required section: `## Grounded Fixes`.');
  if (!assumptionsBody) contractWarnings.push('Missing required section: `## Assumptions / Unverified Seams`.');
  if (!deferredChecksBody) contractWarnings.push('Missing required section: `## Deferred Checks`.');

  const groundedHasEvidence = /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?Evidence:(?:\*\*)?\s+/i.test(groundedBody);
  const groundedHasCode = /```[\s\S]*?```/.test(groundedBody);
  const groundedHasSubstantiveContent = groundedBody
    && !EVIDENCE_NONE_PATTERNS.some((pattern) => pattern.test(groundedBody.trim()));
  if (groundedHasSubstantiveContent && !groundedHasEvidence) {
    contractWarnings.push('`## Grounded Fixes` contains implementation guidance without explicit `Evidence:` anchors.');
  }
  if (groundedHasSubstantiveContent && !groundedHasCode) {
    contractWarnings.push('`## Grounded Fixes` contains implementation guidance without concrete code blocks or diff snippets.');
  }
  if (groundedHasCode && !groundedHasEvidence) {
    contractWarnings.push('Code blocks were found in `## Grounded Fixes` without an accompanying `Evidence:` anchor.');
  }

  const hasAssumedImplementation = Boolean(assumedImplementationBody) && !EVIDENCE_NONE_PATTERNS.some((pattern) => pattern.test(assumedImplementationBody.trim()));

  return {
    groundedBody,
    assumptionsBody,
    assumedImplementationBody,
    deferredChecksBody,
    groundedHasEvidence,
    groundedHasCode,
    groundedHasSubstantiveContent,
    hasAssumedImplementation,
    contractWarnings,
    structureComplete: contractWarnings.length === 0,
  };
}

function hasSubstantiveEvidenceSection(body = '') {
  const normalized = String(body || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*(?:[-*]\s*)?(?:\*\*)?Evidence:(?:\*\*)?\s+.+$/gim, '')
    .replace(/^\s*[-*]\s*/gm, '')
    .trim();
  if (!normalized) return false;
  return !EVIDENCE_NONE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function extractEvidenceAnchors(groundedBody = '', options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const anchors = [];
  const matches = String(groundedBody || '').matchAll(/^\s*(?:[-*]\s*)?(?:\*\*)?Evidence:(?:\*\*)?\s*(.+)$/gim);
  for (const match of matches) {
    const line = String(match[1] || '').trim();
    const candidates = line.match(/[A-Za-z0-9_./\\-]+\.[A-Za-z0-9_]+(?::\d+)?/g) || [];
    for (const candidate of candidates) {
      const fileRef = normalizeProjectRelativeFilePath(candidate.replace(/:\d+$/, ''), projectRoot);
      if (fileRef) anchors.push(fileRef);
    }
  }
  return Array.from(new Set(anchors));
}

function shouldValidateUnknownEvidenceAnchor(filePath = '', indexedFiles = new Set(), projectRoot = process.cwd()) {
  const normalized = normalizeProjectRelativeFilePath(filePath, projectRoot);
  if (!normalized) return false;
  if (indexedFiles instanceof Set && indexedFiles.has(normalized)) return true;
  if (normalized.includes('/')) return true;
  if (fs.existsSync(path.join(projectRoot, normalized))) return true;

  const dotCount = (normalized.match(/\./g) || []).length;
  return dotCount <= 2;
}

function extractGroundedCodeBlocks(groundedBody = '') {
  return Array.from(String(groundedBody || '').matchAll(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g))
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

function isLikelyProjectReceiver(receiver = '') {
  const normalized = String(receiver || '').trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (STANDARD_SEAM_RECEIVERS.has(lower)) return false;
  return LIKELY_PROJECT_RECEIVER_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isLikelyProjectType(typeName = '') {
  const normalized = String(typeName || '').trim();
  if (!normalized || !/^[A-Z][A-Za-z0-9_]*$/.test(normalized)) return false;
  const lower = normalized.toLowerCase();
  return LIKELY_PROJECT_RECEIVER_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function extractGroundedSeamCandidates(groundedBody = '') {
  const candidates = [];
  for (const block of extractGroundedCodeBlocks(groundedBody)) {
    for (const match of block.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const receiver = String(match[1] || '').trim();
      const member = String(match[2] || '').trim();
      if (!isLikelyProjectReceiver(receiver) || !member) continue;
      candidates.push({
        kind: 'method',
        token: `${receiver}.${member}`,
        lookupName: member,
      });
    }
    for (const match of block.matchAll(/\bnew\s+([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
      const typeName = String(match[1] || '').trim();
      if (!isLikelyProjectType(typeName)) continue;
      candidates.push({
        kind: 'type',
        token: typeName,
        lookupName: typeName,
      });
    }
  }
  return Array.from(new Map(candidates.map((item) => [`${item.kind}:${item.token}`, item])).values());
}

function buildEvidenceGroundingValidation(finalText = '', options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const groundedAnalysis = analyzeEvidenceGroundedResultStructure(finalText);
  const codeIndex = options.codeIndex && typeof options.codeIndex === 'object' ? options.codeIndex : null;
  const observedFiles = Array.isArray(options.observedFiles)
    ? options.observedFiles.map((filePath) => normalizeProjectRelativeFilePath(filePath, projectRoot)).filter(Boolean)
    : [];
  const observedFileSet = new Set(observedFiles);
  const indexedFiles = new Set(codeIndex?.byFile ? Object.keys(codeIndex.byFile) : []);
  const indexedSymbols = new Set(
    Array.isArray(codeIndex?.symbols)
      ? codeIndex.symbols
        .map((symbol) => String(symbol?.name || '').trim().toLowerCase())
        .filter(Boolean)
      : [],
  );

  const evidenceAnchors = extractEvidenceAnchors(groundedAnalysis.groundedBody, { projectRoot });
  const validationWarnings = [];

  for (const filePath of evidenceAnchors) {
    const existsInIndex = indexedFiles.has(filePath);
    const existsOnDisk = fs.existsSync(path.join(projectRoot, filePath));
    if (!existsInIndex && !existsOnDisk) {
      if (!shouldValidateUnknownEvidenceAnchor(filePath, indexedFiles, projectRoot)) {
        continue;
      }
      validationWarnings.push(`Evidence anchor points to missing file: \`${filePath}\`.`);
      continue;
    }
    if (observedFileSet.size > 0 && !observedFileSet.has(filePath)) {
      validationWarnings.push(`Evidence anchor was not observed in the current run context: \`${filePath}\`.`);
    }
  }

  const candidateSeams = extractGroundedSeamCandidates(groundedAnalysis.groundedBody);
  const anchoredContents = evidenceAnchors
    .map((filePath) => {
      try {
        const fullPath = path.join(projectRoot, filePath);
        return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
      } catch {
        return '';
      }
    })
    .filter(Boolean);

  for (const candidate of candidateSeams) {
    const lookupName = String(candidate.lookupName || '').trim().toLowerCase();
    if (!lookupName) continue;
    if (indexedSymbols.has(lookupName)) continue;
    if (anchoredContents.some((content) => content.includes(candidate.lookupName))) continue;
    validationWarnings.push(
      `Grounded fix references unconfirmed ${candidate.kind} seam: \`${candidate.token}\`.`,
    );
  }

  const hasSubstantiveAssumptions = hasSubstantiveEvidenceSection(groundedAnalysis.assumptionsBody);
  if (hasSubstantiveAssumptions) {
    validationWarnings.push('`## Assumptions / Unverified Seams` contains substantive items; patch-safe mode denied.');
  }

  return {
    evidenceAnchors,
    observedFiles,
    candidateSeams,
    validationWarnings,
    hasSubstantiveAssumptions,
    hasAssumedImplementation: groundedAnalysis.hasAssumedImplementation === true,
    patchSafeEligible: groundedAnalysis.contractWarnings.length === 0 && validationWarnings.length === 0,
  };
}

function assessFinalResultTrust(finalText = '', options = {}) {
  const groundedAnalysis = analyzeEvidenceGroundedResultStructure(finalText);
  const groundingValidation = buildEvidenceGroundingValidation(finalText, options);
  const finalResultMode = options.allAgreed !== false && groundingValidation.patchSafeEligible
    ? RESULT_MODE_PATCH_SAFE
    : RESULT_MODE_DIAGNOSTIC;
  return {
    groundedAnalysis,
    groundingValidation,
    resultMode: finalResultMode,
    warningRequired: options.allAgreed !== true || finalResultMode !== RESULT_MODE_PATCH_SAFE,
  };
}

function buildResultWarningFileContent(options = {}) {
  const resultMode = normalizeResultMode(options.resultMode);
  const disagreementNotes = Array.isArray(options.disagreementNotes)
    ? options.disagreementNotes.map((note) => String(note || '').trim()).filter(Boolean)
    : [];
  const contractWarnings = Array.isArray(options.contractWarnings)
    ? options.contractWarnings.map((note) => String(note || '').trim()).filter(Boolean)
    : [];
  const validationWarnings = Array.isArray(options.validationWarnings)
    ? options.validationWarnings.map((note) => String(note || '').trim()).filter(Boolean)
    : [];
  const contractGapCategories = summarizeGapCategories(contractWarnings, CONTRACT_GAP_CATEGORY_RULES);
  const groundingGapCategories = summarizeGapCategories(validationWarnings, GROUNDING_GAP_CATEGORY_RULES);
  const failureClasses = Array.isArray(options.failureClasses)
    ? options.failureClasses.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const primaryFailureClass = String(options.primaryFailureClass || '').trim() || (failureClasses[0] || 'none');
  const failureSummary = String(options.failureSummary || '').trim();
  const lines = [
    'WARNING: Generated output is not guaranteed copy-paste-safe.',
    `RESULT_MODE: ${resultMode}`,
    'MANUAL_REVIEW_REQUIRED: YES',
    `PRIMARY_FAILURE_CLASS: ${primaryFailureClass}`,
    `FAILURE_CLASSES: ${failureClasses.length > 0 ? failureClasses.join(', ') : 'none'}`,
    `PATCH_SAFE_CONTRACT_GAP_COUNT: ${contractWarnings.length}`,
    `PATCH_SAFE_GROUNDING_GAP_COUNT: ${validationWarnings.length}`,
    `PATCH_SAFE_CONTRACT_GAP_CATEGORIES: ${contractGapCategories.length > 0 ? contractGapCategories.join(', ') : 'none'}`,
    `PATCH_SAFE_GROUNDING_GAP_CATEGORIES: ${groundingGapCategories.length > 0 ? groundingGapCategories.join(', ') : 'none'}`,
    'Do not apply generated code, config, or commands without project-specific review, testing, and validation.',
  ];

  if (disagreementNotes.length > 0) {
    lines.push('', 'Disagreements:', ...disagreementNotes);
  }
  if (failureSummary) {
    lines.push('', `Failure summary: ${failureSummary}`);
  }
  if (contractWarnings.length > 0) {
    lines.push('', 'Patch-safe contract gaps:', ...contractWarnings.map((note) => `- ${note}`));
  }
  if (validationWarnings.length > 0) {
    lines.push('', 'Patch-safe validation gaps:', ...validationWarnings.map((note) => `- ${note}`));
  }

  return `${lines.join('\n')}\n`;
}

function buildPromptScopeWarningFileContent(options = {}) {
  const risk = String(options.risk || 'none').trim() || 'none';
  const notes = Array.isArray(options.notes)
    ? options.notes.map((note) => String(note || '').trim()).filter(Boolean)
    : [];
  const suggestedPromptPath = String(options.suggestedPromptPath || '').trim();
  const lines = [
    '# Prompt Scope Warning',
    '',
    `SCOPE_RISK: ${risk}`,
    `MANUAL_REVIEW_RECOMMENDED: ${risk === 'none' ? 'NO' : 'YES'}`,
  ];

  if (risk === 'narrow-starting-seams') {
    lines.push('NOTE: Prompt names narrow starting seams that may bias retrieval toward a too-local slice.');
  } else if (risk === 'explicit-hard-scope') {
    lines.push('NOTE: Prompt appears to impose an explicit hard scope. Runtime kept that scope authoritative and did not broaden it automatically.');
  } else {
    lines.push('NOTE: No prompt-scope risk detected.');
  }

  if (notes.length > 0) {
    lines.push('', 'Details:', ...notes.map((note) => `- ${note}`));
  }
  if (suggestedPromptPath) {
    lines.push('', `Suggested broadened prompt: ${suggestedPromptPath}`);
    lines.push('Use the broader prompt only with user approval.');
  }

  return `${lines.join('\n')}\n`;
}

function buildResultFileContent(finalText, options = {}) {
  const resultMode = normalizeResultMode(options.resultMode);
  const copyPasteReady = resultMode === RESULT_MODE_PATCH_SAFE ? 'YES' : 'NO';
  const notes = [];
  const extraNote = String(options.extraNote || '').trim();
  const warningPath = String(options.warningPath || '').trim();
  const promptScopeWarningPath = String(options.promptScopeWarningPath || '').trim();
  const discussionPath = String(options.discussionPath || '').trim();

  notes.push(`RESULT_MODE: ${resultMode}`);
  notes.push(`COPYPASTE_READY: ${copyPasteReady}`);
  if (resultMode === RESULT_MODE_PATCH_SAFE) {
    notes.push('NOTE: Patch-safe gate passed for this run. Manual review and project-specific validation are still recommended before applying changes.');
  } else {
    notes.push('NOTE: This result is not guaranteed copy-paste-safe. Manual review, testing, and project-specific validation are required before using generated code or configuration.');
  }
  if (extraNote) notes.push(`NOTE: ${extraNote}`);
  if (warningPath) notes.push(`NOTE: See ${warningPath} for disagreement details.`);
  if (promptScopeWarningPath) notes.push(`NOTE: Prompt scope may have constrained retrieval. See ${promptScopeWarningPath}.`);
  if (discussionPath) notes.push(`DISCUSSION: See ${discussionPath}`);

  const prefix = notes.length > 0 ? `${notes.join('\n')}\n\n` : '';
  return `${prefix}${String(finalText || '').trimEnd()}\n`;
}

function buildPatchSafeResultContent(finalText, options = {}) {
  const analysis = analyzeEvidenceGroundedResultStructure(finalText);
  const lines = [
    '# Patch-Safe Result',
    '',
    'RESULT_MODE: PATCH_SAFE',
    'COPYPASTE_READY: YES',
  ];

  const sourceResultPath = String(options.sourceResultPath || '').trim();
  const discussionPath = String(options.discussionPath || '').trim();
  if (sourceResultPath) lines.push(`SOURCE_RESULT: ${sourceResultPath}`);
  if (discussionPath) lines.push(`DISCUSSION: ${discussionPath}`);

  lines.push(
    '',
    `## ${EVIDENCE_GROUNDED_SECTION_HEADINGS.groundedFixes}`,
    analysis.groundedBody || '- None.',
  );

  if (analysis.deferredChecksBody) {
    lines.push(
      '',
      `## ${EVIDENCE_GROUNDED_SECTION_HEADINGS.deferredChecks}`,
      analysis.deferredChecksBody,
    );
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  RESULT_MODE_PATCH_SAFE,
  RESULT_MODE_DIAGNOSTIC,
  normalizeProjectRelativeFilePath,
  normalizeResultMode,
  analyzeEvidenceGroundedResultStructure,
  extractEvidenceAnchors,
  buildEvidenceGroundingValidation,
  assessFinalResultTrust,
  buildFinalTrustSignal,
  buildResultWarningFileContent,
  buildPromptScopeWarningFileContent,
  buildResultFileContent,
  buildPatchSafeResultContent,
};
