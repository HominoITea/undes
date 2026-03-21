'use strict';

module.exports = {
  code: 'en',
  stopWords: [
    'a', 'an', 'and', 'are', 'but', 'can', 'for', 'from', 'have', 'in', 'into', 'just', 'not', 'of', 'or', 'that',
    'the', 'their', 'this', 'those', 'to', 'with', 'without', 'your', 'about', 'after', 'before', 'between',
    'should', 'would', 'could', 'there', 'where', 'which', 'when', 'what', 'will', 'been', 'were', 'than', 'then',
    'them', 'they', 'need',
    'fix', 'add', 'bug', 'refactor', 'feature',
  ],
  tokenTranslations: {},
  evidenceAlternativePathTerms: [
    'or',
  ],
  hardScopeExamples: [
    'only',
    'strictly',
    'do not go beyond',
  ],
  logSectionHeadings: [
    'Logs',
  ],
  memoryDecisionHeadings: [
    'what to do',
    'recommended solution',
    'recommended fix',
    'recommendation',
    'decision',
    'next steps',
  ],
  metaChatterExamples: [
    'If you want, I can provide...',
  ],
  metaTailLeadIns: [
    'If you want, I can',
    'Let me know if you want me to',
  ],
};
