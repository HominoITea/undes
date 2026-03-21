'use strict';

const { tokens, scoreSymbols, translateTokens, fileNameSeeds } = require('./context-pack');

/**
 * Score how specific/actionable a prompt is.
 *
 * Returns: { score, matchedSymbols, matchedFiles, tokenCount, translatedCount, verdict }
 * verdict: 'pass' | 'warn' | 'block'
 */
function scorePrompt(promptText, index, cfg = {}) {
  const promptTokens = tokens(promptText);
  const translated = translateTokens(promptTokens);
  const allTokens = [...promptTokens, ...translated];

  const result = {
    score: 0,
    matchedSymbols: 0,
    matchedFiles: 0,
    tokenCount: promptTokens.length,
    translatedCount: translated.length,
    verdict: 'pass',
  };

  if (!index || !Array.isArray(index.symbols)) {
    result.verdict = 'pass';
    return result;
  }

  const scored = scoreSymbols(allTokens, index.symbols).filter((x) => x.score > 0);
  result.matchedSymbols = scored.length;
  result.score += scored.length * 3;

  const fnSeeds = fileNameSeeds(allTokens, index.symbols);
  const uniqueFiles = new Set(fnSeeds.map((s) => s.file));
  result.matchedFiles = uniqueFiles.size;
  result.score += uniqueFiles.size * 2;

  result.score += promptTokens.length;
  result.score += translated.length;

  const warnThreshold = Number(cfg.warnThreshold ?? 3);
  const blockThreshold = Number(cfg.blockThreshold ?? 0);

  if (result.score <= blockThreshold) {
    result.verdict = 'block';
  } else if (result.score <= warnThreshold) {
    result.verdict = 'warn';
  } else {
    result.verdict = 'pass';
  }

  return result;
}

function formatGateResult(result) {
  const lines = [];
  lines.push(
    `   Score: ${result.score} (symbols: ${result.matchedSymbols}, files: ${result.matchedFiles}, tokens: ${result.tokenCount})`,
  );
  if (result.translatedCount > 0) {
    lines.push(`   Canonical translations: ${result.translatedCount}`);
  }
  return lines.join('\n');
}

module.exports = {
  scorePrompt,
  formatGateResult,
};
