function parseConfidence(responseText = '') {
  const match = String(responseText || '').match(/\[CONFIDENCE:\s*(\d+)%?\]/i);
  if (!match) return null;
  const confidence = Number.parseInt(match[1], 10);
  if (!Number.isFinite(confidence)) return null;
  return Math.min(100, Math.max(0, confidence));
}

function calculateAverageConfidence(confidenceScores = []) {
  const validScores = confidenceScores.filter((c) => c !== null && !Number.isNaN(c));
  if (!validScores.length) return null;
  return Math.round(validScores.reduce((sum, value) => sum + value, 0) / validScores.length);
}

function computeAgreementScore(critiqueTexts = []) {
  let agrees = 0;
  let disagrees = 0;
  for (const text of critiqueTexts) {
    const safeText = String(text || '');
    agrees += (safeText.match(/✅/g) || []).length;
    disagrees += (safeText.match(/❌/g) || []).length;
  }
  const total = agrees + disagrees;
  if (total === 0) return null;
  return Math.round((agrees / total) * 100);
}

function shouldTriggerRevision(avgConfidence, devilsAdvocateResult) {
  if (avgConfidence < 60) {
    return { trigger: true, reason: `Low confidence (${avgConfidence}%)` };
  }

  if (devilsAdvocateResult && devilsAdvocateResult.verdict === 'CRITICAL_ISSUES') {
    return { trigger: true, reason: "Devil's Advocate found critical issues" };
  }

  if (devilsAdvocateResult && devilsAdvocateResult.overallRisk === 'CRITICAL') {
    return { trigger: true, reason: 'Critical risk level identified' };
  }

  const criticalWeaknesses = (devilsAdvocateResult?.weaknesses || [])
    .filter((w) => w.severity === 'CRITICAL' || w.severity === 'HIGH');
  if (criticalWeaknesses.length >= 2) {
    return { trigger: true, reason: `${criticalWeaknesses.length} high/critical weaknesses found` };
  }

  return { trigger: false, reason: null };
}

module.exports = {
  parseConfidence,
  calculateAverageConfidence,
  computeAgreementScore,
  shouldTriggerRevision,
};
