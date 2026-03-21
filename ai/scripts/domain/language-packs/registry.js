'use strict';

const englishPack = require('./en');
const russianPack = require('./ru');

const LANGUAGE_PACKS = Object.freeze([englishPack, russianPack]);
const DEFAULT_TOKEN_PATTERN = /[\p{L}\p{N}_$.:-]{2,}/gu;
const DEFAULT_WORD_SPLIT_PATTERN = /[^\p{L}\p{N}_-]+/u;

function listLanguagePacks() {
  return LANGUAGE_PACKS;
}

function normalizeLanguageCode(code) {
  return String(code || '').trim().toLowerCase();
}

function resolveLanguagePacks(codes = []) {
  const requested = Array.isArray(codes)
    ? codes.map((code) => normalizeLanguageCode(code)).filter(Boolean)
    : [];

  if (!requested.length) return LANGUAGE_PACKS;

  const byCode = new Map(LANGUAGE_PACKS.map((pack) => [pack.code, pack]));
  const resolved = [];
  for (const code of requested) {
    const pack = byCode.get(code);
    if (pack && !resolved.includes(pack)) resolved.push(pack);
  }

  return resolved.length ? resolved : LANGUAGE_PACKS;
}

function buildStopWords(packs = LANGUAGE_PACKS) {
  const words = new Set();
  for (const pack of packs) {
    for (const word of pack?.stopWords || []) {
      const normalized = String(word || '').trim().toLowerCase();
      if (normalized) words.add(normalized);
    }
  }
  return words;
}

function buildTokenTranslations(packs = LANGUAGE_PACKS) {
  const translations = new Map();
  for (const pack of packs) {
    const entries = Object.entries(pack?.tokenTranslations || {});
    for (const [source, target] of entries) {
      const normalizedSource = String(source || '').trim().toLowerCase();
      const normalizedTarget = String(target || '').trim().toLowerCase();
      if (normalizedSource && normalizedTarget) {
        translations.set(normalizedSource, normalizedTarget);
      }
    }
  }
  return translations;
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectPackValues(packs = LANGUAGE_PACKS, fieldName = '') {
  const out = [];
  const seen = new Set();

  for (const pack of packs) {
    for (const rawValue of pack?.[fieldName] || []) {
      const value = String(rawValue || '').trim();
      const normalized = value.toLowerCase();
      if (!value || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(value);
    }
  }

  return out;
}

function buildMemoryDecisionHeadingPattern(packs = LANGUAGE_PACKS) {
  const headings = collectPackValues(packs, 'memoryDecisionHeadings').map(escapeRegex);

  if (!headings.length) {
    return /^(?:#+\s*)?(?:what to do)(?=$|[:：])[:：]?$/i;
  }

  return new RegExp(`^(?:#+\\s*)?(?:${headings.join('|')})(?=$|[:：])[:：]?$`, 'iu');
}

function buildLogSectionHeadingPattern(packs = LANGUAGE_PACKS) {
  const headings = collectPackValues(packs, 'logSectionHeadings').map(escapeRegex);
  if (!headings.length) {
    return /(?:^|\n)#{2,3}\s*(?:Logs)(?=$|\s|[:：])[\s\S]*$/i;
  }
  return new RegExp(`(?:^|\\n)#{2,3}\\s*(?:${headings.join('|')})(?=$|\\s|[:：])[\\s\\S]*$`, 'iu');
}

function buildMetaTailPattern(packs = LANGUAGE_PACKS) {
  const leadIns = collectPackValues(packs, 'metaTailLeadIns').map(escapeRegex);
  if (!leadIns.length) {
    return /(?:^|\n)(?:If you want, I can)[\s\S]*$/i;
  }
  return new RegExp(`(?:^|\\n)(?:${leadIns.join('|')})[\\s\\S]*$`, 'iu');
}

function buildEvidenceAlternativePathLabel(packs = LANGUAGE_PACKS) {
  const terms = collectPackValues(packs, 'evidenceAlternativePathTerms');
  return terms.length ? terms.join('/') : 'or';
}

function buildMetaChatterExamplesLabel(packs = LANGUAGE_PACKS) {
  const examples = collectPackValues(packs, 'metaChatterExamples');
  if (!examples.length) {
    return '"If you want, I can provide..."';
  }
  if (examples.length === 1) {
    return `"${examples[0]}"`;
  }
  return examples
    .map((example, index) => (index === 0 ? `"${example}"` : `or "${example}"`))
    .join(' ');
}

function buildHardScopeExamplesLabel(packs = LANGUAGE_PACKS) {
  return collectPackValues(packs, 'hardScopeExamples')
    .map((example) => `\`${example}\``)
    .join(', ');
}

const DEFAULT_LANGUAGE_PACKS = listLanguagePacks();
const DEFAULT_STOP_WORDS = buildStopWords(DEFAULT_LANGUAGE_PACKS);
const DEFAULT_TOKEN_TRANSLATIONS = buildTokenTranslations(DEFAULT_LANGUAGE_PACKS);
const DEFAULT_EVIDENCE_ALTERNATIVE_PATH_LABEL = buildEvidenceAlternativePathLabel(DEFAULT_LANGUAGE_PACKS);
const DEFAULT_HARD_SCOPE_EXAMPLES_LABEL = buildHardScopeExamplesLabel(DEFAULT_LANGUAGE_PACKS);
const DEFAULT_LOG_SECTION_HEADING_PATTERN = buildLogSectionHeadingPattern(DEFAULT_LANGUAGE_PACKS);
const DEFAULT_MEMORY_DECISION_HEADING_PATTERN = buildMemoryDecisionHeadingPattern(DEFAULT_LANGUAGE_PACKS);
const DEFAULT_META_CHATTER_EXAMPLES_LABEL = buildMetaChatterExamplesLabel(DEFAULT_LANGUAGE_PACKS);
const DEFAULT_META_TAIL_PATTERN = buildMetaTailPattern(DEFAULT_LANGUAGE_PACKS);

module.exports = {
  DEFAULT_EVIDENCE_ALTERNATIVE_PATH_LABEL,
  DEFAULT_HARD_SCOPE_EXAMPLES_LABEL,
  DEFAULT_LANGUAGE_PACKS,
  DEFAULT_LOG_SECTION_HEADING_PATTERN,
  DEFAULT_MEMORY_DECISION_HEADING_PATTERN,
  DEFAULT_META_CHATTER_EXAMPLES_LABEL,
  DEFAULT_META_TAIL_PATTERN,
  DEFAULT_STOP_WORDS,
  DEFAULT_TOKEN_PATTERN,
  DEFAULT_TOKEN_TRANSLATIONS,
  DEFAULT_WORD_SPLIT_PATTERN,
  buildEvidenceAlternativePathLabel,
  buildHardScopeExamplesLabel,
  buildLogSectionHeadingPattern,
  buildMemoryDecisionHeadingPattern,
  buildMetaChatterExamplesLabel,
  buildMetaTailPattern,
  buildStopWords,
  buildTokenTranslations,
  listLanguagePacks,
  resolveLanguagePacks,
};
