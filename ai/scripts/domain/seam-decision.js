const {
  normalizeMissingSeams,
  shouldTriggerCritiqueExpansion,
  collectMissingSeamsFromApprovalOutputs,
} = require('../critique-expansion');
const {
  normalizeResultMode: normalizeResultModeBase,
  buildFinalTrustSignal: buildFinalTrustSignalBase,
} = require('./final-result-trust');

function hasStructuredFetchHint(request = {}) {
  return Boolean(String(request?.fetchHint || '').trim());
}

function deriveApprovalOutcomeType(approval = {}) {
  const missingSeams = Array.isArray(approval?.missingSeams) ? approval.missingSeams : [];
  if (missingSeams.length > 0) return 'fetch-evidence';
  if (approval?.agreed === true) return 'approved';
  return 'revise-text';
}

function approvalNotesFlagGroundedFixError(notes = '') {
  const normalized = String(notes || '').trim().toLowerCase();
  if (!normalized) return false;
  const mentionsGroundedFixes = normalized.includes('grounded fixes')
    || normalized.includes('grounded fix')
    || normalized.includes('grounded patch')
    || normalized.includes('grounded code');
  if (!mentionsGroundedFixes) return false;
  return /(incorrect|wrong|contradict|conflict|false|invalid|non-?existent|nonexistent|broken|cannot compile|can't compile|won't compile|compile error|syntax error|mismatch|does not match)/.test(normalized);
}

function buildApprovalSeamKey(request = {}) {
  const normalized = normalizeMissingSeams([request], { maxItems: 1 });
  if (normalized.length === 0) return '';
  return String(normalized[0].symbolOrSeam || '').trim().toLowerCase();
}

function extractApprovalMissingSeams(approvalOutputs = [], options = {}) {
  return collectMissingSeamsFromApprovalOutputs(approvalOutputs, options);
}

function computeNewApprovalSeamKeys(currentRequests = [], previousKeys = new Set()) {
  const newKeys = [];
  for (const request of currentRequests) {
    const key = buildApprovalSeamKey(request);
    if (!key || previousKeys.has(key)) continue;
    newKeys.push(key);
  }
  return newKeys;
}

function computeCritiqueSeamOverlap(critiqueTexts = [], missingSeams = []) {
  const normalizedSeams = normalizeMissingSeams(missingSeams);
  if (normalizedSeams.length === 0) {
    return { percent: null, matched: 0, total: 0 };
  }

  const critiqueCorpus = critiqueTexts
    .map((item) => String(item || '').toLowerCase())
    .join('\n');
  let matched = 0;
  for (const seam of normalizedSeams) {
    const symbol = String(seam.symbolOrSeam || '').trim().toLowerCase();
    const fetchHint = String(seam.fetchHint || '').trim().toLowerCase();
    if ((symbol && critiqueCorpus.includes(symbol)) || (fetchHint && critiqueCorpus.includes(fetchHint))) {
      matched += 1;
    }
  }

  return {
    matched,
    total: normalizedSeams.length,
    percent: Number(((matched / normalizedSeams.length) * 100).toFixed(1)),
  };
}

function shouldTriggerSeamExpansion(options = {}) {
  const baseDecision = shouldTriggerCritiqueExpansion(options);
  if (!baseDecision.trigger) return baseDecision;

  const missingSeams = normalizeMissingSeams(baseDecision.missingSeams, {
    maxItems: options.maxItems,
  });
  if (!missingSeams.some((request) => hasStructuredFetchHint(request))) {
    return {
      trigger: false,
      reason: 'no-structured-fetch-hints',
      missingSeams,
    };
  }

  return {
    ...baseDecision,
    missingSeams,
  };
}

function buildTrustGapSnapshot(trust = {}) {
  const signal = buildFinalTrustSignalBase(trust, {
    allAgreed: Boolean(trust?.allAgreed),
  });
  return {
    contractGapCount: Number(signal.contractGapCount) || 0,
    groundingGapCount: Number(signal.groundingGapCount) || 0,
  };
}

function computeAverageApprovalScore(approvalOutputs = []) {
  const scores = Array.isArray(approvalOutputs)
    ? approvalOutputs
      .map((item) => item?.approval?.score)
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
    : [];
  if (scores.length === 0) return null;
  return Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1));
}

function shouldSkipRevisionRound(options = {}) {
  const approvalOutputs = Array.isArray(options.approvalOutputs) ? options.approvalOutputs : [];
  let disagreementCount = 0;
  let fetchEvidenceCount = 0;
  let editorialOnlyCount = 0;

  for (const output of approvalOutputs) {
    const approval = output?.approval || {};
    if (approval?.agreed === true) continue;
    disagreementCount += 1;
    if (approvalNotesFlagGroundedFixError(approval?.notes || '')) {
      return {
        skip: false,
        reason: 'grounded-fix-error',
        disagreementCount,
        fetchEvidenceCount,
        editorialOnlyCount,
      };
    }
    const outcomeType = deriveApprovalOutcomeType(approval);
    if (outcomeType === 'fetch-evidence') {
      fetchEvidenceCount += 1;
      continue;
    }
    editorialOnlyCount += 1;
  }

  if (disagreementCount === 0) {
    return {
      skip: false,
      reason: 'all-approved',
      disagreementCount,
      fetchEvidenceCount,
      editorialOnlyCount,
    };
  }

  if (fetchEvidenceCount === 0) {
    return {
      skip: false,
      reason: 'no-evidence-gap-requests',
      disagreementCount,
      fetchEvidenceCount,
      editorialOnlyCount,
    };
  }

  return {
    skip: true,
    reason: editorialOnlyCount > 0 ? 'evidence-gap-with-editorial-notes' : 'evidence-gap-only',
    disagreementCount,
    fetchEvidenceCount,
    editorialOnlyCount,
  };
}

function shouldSkipDevilsAdvocate(options = {}) {
  const trust = options.trust || {};
  const remainingFetchableSeamCount = Number(options.remainingFetchableSeamCount) || 0;
  const allAgreed = options.allAgreed === true;
  const avgApprovalScore = Number(options.avgApprovalScore);
  const resultMode = normalizeResultModeBase(trust?.resultMode || '');
  const categories = Array.isArray(trust?.groundingGapCategories)
    ? trust.groundingGapCategories.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const hasSubstantiveAssumptions = categories.includes('substantive-assumptions')
    || trust?.groundingValidation?.hasSubstantiveAssumptions === true;

  const diagnosticSkip = resultMode === 'DIAGNOSTIC'
    && hasSubstantiveAssumptions
    && remainingFetchableSeamCount === 0;
  if (diagnosticSkip) {
    return {
      skip: true,
      reason: 'diagnostic-with-substantive-assumptions-and-no-fetchable-seams',
    };
  }

  const cleanRunSkip = allAgreed
    && Number.isFinite(avgApprovalScore)
    && avgApprovalScore >= 9
    && trust?.groundingValidation?.patchSafeEligible === true;

  return {
    skip: cleanRunSkip,
    reason: cleanRunSkip ? 'clean-patch-safe-high-approval-consensus' : '',
  };
}

function resolveTesterMode(trust = {}) {
  return trust?.groundingValidation?.patchSafeEligible === true
    ? 'patch-validation'
    : 'diagnostic-review';
}

function resolveTesterGate(trust = {}) {
  const mode = resolveTesterMode(trust);
  if (mode === 'patch-validation') {
    return {
      skip: false,
      mode,
      action: mode,
      reason: 'patch-safe-eligible',
    };
  }
  return {
    skip: true,
    mode,
    action: 'skipped',
    reason: 'diagnostic-result',
  };
}

module.exports = {
  hasStructuredFetchHint,
  deriveApprovalOutcomeType,
  buildApprovalSeamKey,
  extractApprovalMissingSeams,
  computeNewApprovalSeamKeys,
  computeCritiqueSeamOverlap,
  shouldTriggerSeamExpansion,
  buildTrustGapSnapshot,
  computeAverageApprovalScore,
  approvalNotesFlagGroundedFixError,
  shouldSkipRevisionRound,
  shouldSkipDevilsAdvocate,
  resolveTesterMode,
  resolveTesterGate,
};
