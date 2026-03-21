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

function shouldSkipDevilsAdvocate(options = {}) {
  const trust = options.trust || {};
  const remainingFetchableSeamCount = Number(options.remainingFetchableSeamCount) || 0;
  const resultMode = normalizeResultModeBase(trust?.resultMode || '');
  const categories = Array.isArray(trust?.groundingGapCategories)
    ? trust.groundingGapCategories.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const hasSubstantiveAssumptions = categories.includes('substantive-assumptions')
    || trust?.groundingValidation?.hasSubstantiveAssumptions === true;

  const skip = resultMode === 'DIAGNOSTIC'
    && hasSubstantiveAssumptions
    && remainingFetchableSeamCount === 0;

  return {
    skip,
    reason: skip ? 'diagnostic-with-substantive-assumptions-and-no-fetchable-seams' : '',
  };
}

function resolveTesterMode(trust = {}) {
  return trust?.groundingValidation?.patchSafeEligible === true
    ? 'patch-validation'
    : 'diagnostic-review';
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
  shouldSkipDevilsAdvocate,
  resolveTesterMode,
};
