/**
 * domain/context-bundle.js — context bundle building, provider profiles, result caching.
 * Extracted from generate-context.js (Batch 11, Slice A).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildContextPack } = require('../context-pack');
const { getProviderName } = require('../infrastructure/providers');

// ── Context bundle transforms ──────────────────────────────────────

function replaceMarkdownSection(content, sectionHeader, replacement) {
  if (!content || typeof content !== 'string') return content;
  const sectionStart = content.indexOf(sectionHeader);
  if (sectionStart < 0) return content;

  const nextSectionStart = content.indexOf('\n## ', sectionStart + 1);
  const sectionEnd = nextSectionStart > sectionStart ? nextSectionStart : content.length;
  return content.slice(0, sectionStart) + replacement + content.slice(sectionEnd);
}

function buildCompactContextPack(bundleContent) {
  const packStart = bundleContent.indexOf('## CONTEXT PACK');
  if (packStart < 0) return bundleContent;

  const nextSectionStart = bundleContent.indexOf('\n## ', packStart + 1);
  const packEnd = nextSectionStart > packStart ? nextSectionStart : bundleContent.length;
  const packContent = bundleContent.slice(packStart, packEnd);
  const lines = packContent.split('\n');

  const compact = ['## CONTEXT PACK (COMPACT)'];
  for (const prefix of ['Prompt:', 'Level:']) {
    const match = lines.find((line) => line.startsWith(prefix));
    if (match) compact.push(match);
  }

  const symbolsHeaderIndex = lines.indexOf('### Symbols');
  if (symbolsHeaderIndex !== -1) {
    compact.push('');
    compact.push('### Symbols');
    const symbolLines = [];
    for (let i = symbolsHeaderIndex + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.startsWith('### ')) break;
      if (line.trim().startsWith('- ')) symbolLines.push(line);
    }
    const maxSymbolLines = 8;
    compact.push(...symbolLines.slice(0, maxSymbolLines));
    if (symbolLines.length > maxSymbolLines) {
      const omitted = symbolLines.length - maxSymbolLines;
      compact.push(`- ... (${omitted} more symbols omitted)`);
    }
  }

  compact.push('');
  compact.push('### Code Context');
  compact.push('_Context pack compressed for synthesis/revision. Use proposals, critiques, approvals, and fetched seams for detailed evidence._');
  compact.push('');

  return replaceMarkdownSection(bundleContent, '## CONTEXT PACK', compact.join('\n'));
}

function trimContextForPhase(contextBundle, phase) {
  if (!contextBundle || typeof contextBundle !== 'string') return contextBundle;

  const trimPhases = ['critique', 'consensus', 'devil-advocate', 'da-revision', 'approval', 'revision'];
  if (!trimPhases.includes(phase)) return contextBundle;

  const fragStart = contextBundle.indexOf('### Relevant Code Fragments');
  if (fragStart < 0) return contextBundle;

  const afterFrag = contextBundle.indexOf('\n---', fragStart);
  const nextHeader = contextBundle.indexOf('\n## ', fragStart + 1);

  let sectionEnd = -1;
  if (afterFrag > fragStart && nextHeader > fragStart) {
    sectionEnd = Math.min(afterFrag, nextHeader);
  } else if (afterFrag > fragStart) {
    sectionEnd = afterFrag;
  } else if (nextHeader > fragStart) {
    sectionEnd = nextHeader;
  }

  const replacement = '### Code Context\n_Code fragments omitted - see proposals above for relevant code._\n';
  if (sectionEnd > fragStart) {
    contextBundle = contextBundle.slice(0, fragStart) + replacement + contextBundle.slice(sectionEnd);
  } else {
    contextBundle = contextBundle.slice(0, fragStart) + replacement;
  }

  const synthesisPhases = ['consensus', 'revision', 'da-revision'];
  if (synthesisPhases.includes(phase)) {
    contextBundle = buildCompactContextPack(contextBundle);
    contextBundle = replaceMarkdownSection(
      contextBundle,
      '## DIRECTORY STRUCTURE',
      '## DIRECTORY STRUCTURE\n_Context omitted for synthesis/revision to reduce repeated bundle size._\n',
    );
  }

  return contextBundle;
}

function replaceContextPackSection(bundleContent, newPackMarkdown) {
  if (!bundleContent || typeof bundleContent !== 'string') return bundleContent;
  const packStart = bundleContent.indexOf('## CONTEXT PACK');
  if (packStart < 0) return bundleContent;

  const nextSectionStart = bundleContent.indexOf('\n## ', packStart + 1);
  const packEnd = nextSectionStart > packStart ? nextSectionStart : bundleContent.length;
  return bundleContent.slice(0, packStart) + newPackMarkdown + '\n' + bundleContent.slice(packEnd);
}

function buildAgentContextBundle(agent, baseBundle, contextPrompt, codeIndex, indexConfig, { redactSecrets } = {}) {
  const budget = Number(agent?.contextBudget);
  const globalBudget = Number(indexConfig?.maxPackBytes || 0);
  if (!Number.isFinite(budget) || budget <= 0) return baseBundle;
  if (!indexConfig?.enabled || !codeIndex || !contextPrompt) return baseBundle;
  if (globalBudget > 0 && budget === globalBudget) return baseBundle;

  const agentCfg = { ...indexConfig, maxPackBytes: budget };
  const pack = buildContextPack({
    rootDir: process.cwd(),
    promptText: contextPrompt,
    index: codeIndex,
    cfg: agentCfg,
    redactSecrets: redactSecrets || ((x) => x),
  });
  if (!pack.used || !pack.markdown) return baseBundle;
  return replaceContextPackSection(baseBundle, pack.markdown);
}

// ── Provider profiles ──────────────────────────────────────────────

function loadProviderProfile(agent) {
  const provider = getProviderName(agent);
  if (!provider || provider === 'other') return null;
  const profilePath = path.join(__dirname, '..', '..', 'prompts', 'providers', `${provider}.md`);
  try {
    if (!fs.existsSync(profilePath)) return null;
    return fs.readFileSync(profilePath, 'utf8');
  } catch {
    return null;
  }
}

function applyProviderProfile(bundleContent, agent) {
  const profile = loadProviderProfile(agent);
  if (!profile) return bundleContent;
  return `${bundleContent}\n\n---\n\n${profile}`;
}

// ── Result caching ─────────────────────────────────────────────────

function computeResultHash(promptText, codeIndex) {
  const h = crypto.createHash('sha256');
  h.update(String(promptText || ''));
  if (codeIndex && codeIndex.byFile) {
    h.update(JSON.stringify(Object.keys(codeIndex.byFile).sort()));
    h.update(String((codeIndex.symbols || []).length));
  }
  return h.digest('hex').slice(0, 16);
}

function loadResultCache(cachePath) {
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch {
    // Ignore broken cache file.
  }
  return null;
}

function saveResultCache(cachePath, hash, resultPath) {
  const payload = {
    hash,
    resultPath,
    createdAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2));
  } catch {
    // Non-fatal.
  }
}

module.exports = {
  replaceMarkdownSection,
  buildCompactContextPack,
  trimContextForPhase,
  replaceContextPackSection,
  buildAgentContextBundle,
  loadProviderProfile,
  applyProviderProfile,
  computeResultHash,
  loadResultCache,
  saveResultCache,
};
