#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { buildContextPack, tokens, translateTokens } = require('./context-pack');
const { loadCodeIndex, resolveIndexConfig } = require('./context-index');
const { parseFlagValue, resolveProjectLayout } = require('./path-utils');
const { detectAstGrepBinary, searchStructuralSymbols } = require('./structural-search');

function hasFlag(argv, name) {
  return (argv || []).includes(`--${name}`);
}

function parseIntFlag(argv, name, fallback) {
  const raw = parseFlagValue(argv, name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSource(argv) {
  const raw = String(parseFlagValue(argv, 'source') || 'runs').trim().toLowerCase();
  if (raw === 'runs' || raw === 'discussions' || raw === 'both') return raw;
  throw new Error(`Unsupported --source value: ${raw}. Expected runs, discussions, or both.`);
}

function parseOutputPath(argv) {
  const raw = String(parseFlagValue(argv, 'output') || '').trim();
  return raw ? path.resolve(raw) : '';
}

function usage() {
  console.log([
    'Usage:',
    '  node ai/scripts/structural-search-ab.js --project-path=/abs/project [options]',
    '',
    'Options:',
    '  --source=runs|discussions|both   Prompt source to compare (default: runs)',
    '  --limit=N                        Number of unique prompts to compare (default: 5, 0 = all)',
    '  --symbols=N                      Number of top symbols to print (default: 5)',
    '  --json                           Emit JSON instead of human-readable text',
    '  --output=/abs/report.json        Also write the report to a file',
    '  --help                           Show this help',
  ].join('\n'));
}

function sha12(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function truncateText(text, max = 140) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, Math.max(1, max - 3))}...`;
}

function estimateTokensFromBytes(bytes) {
  return Math.ceil(Math.max(0, Number(bytes) || 0) / 4);
}

function computeFullFilesBaseline(projectRoot, index) {
  const files = new Set();
  for (const sym of index?.symbols || []) {
    if (sym?.file) files.add(sym.file);
  }

  let totalBytes = 0;
  for (const relPath of files) {
    const absPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(absPath)) continue;
    totalBytes += fs.statSync(absPath).size;
  }

  return {
    files: files.size,
    bytes: totalBytes,
    tokens: estimateTokensFromBytes(totalBytes),
  };
}

function mergedPromptTokens(promptText) {
  const promptTokens = tokens(promptText);
  const translated = translateTokens(promptTokens);
  return translated.length ? [...promptTokens, ...translated] : promptTokens;
}

function listPromptCandidates(rootDir, groupLabel) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) return [];

  const out = [];
  const stack = [{ dir: rootDir, depth: 0 }];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current.dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const entryPath = path.join(current.dir, entry.name);
      if (entry.isDirectory()) {
        if (current.depth < 2) stack.push({ dir: entryPath, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile() || entry.name !== 'prompt.txt') continue;

      const stat = fs.statSync(entryPath);
      out.push({
        source: groupLabel,
        path: entryPath,
        relativePath: path.relative(rootDir, entryPath).replace(/\\/g, '/'),
        mtimeMs: stat.mtimeMs,
      });
    }
  }

  out.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
  return out;
}

function collectPrompts(layout, sourceMode, limit) {
  const candidates = [];

  if (sourceMode === 'runs' || sourceMode === 'both') {
    candidates.push(...listPromptCandidates(layout.runsDir, 'runs'));
  }
  if (sourceMode === 'discussions' || sourceMode === 'both') {
    candidates.push(...listPromptCandidates(layout.discussionsDir, 'discussions'));
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));

  const prompts = [];
  const seenHashes = new Set();
  for (const item of candidates) {
    const promptText = fs.readFileSync(item.path, 'utf8').trim();
    if (!promptText) continue;
    const promptHash = sha12(promptText);
    if (seenHashes.has(promptHash)) continue;
    seenHashes.add(promptHash);
    prompts.push({
      id: `${item.source}:${item.relativePath.replace(/\/prompt\.txt$/, '') || '.'}`,
      source: item.source,
      path: item.path,
      promptHash,
      promptText,
      mtimeMs: item.mtimeMs,
      preview: truncateText(promptText, 160),
    });
    if (limit > 0 && prompts.length >= limit) break;
  }

  return prompts;
}

function extractListedSymbols(markdown) {
  const lines = String(markdown || '').split('\n');
  const out = [];
  let inSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!inSection) {
      if (line === '### Symbols') inSection = true;
      continue;
    }
    if (!line) break;
    if (line.startsWith('### ')) break;
    if (!line.startsWith('- ')) continue;
    if (line.includes('more symbols omitted')) continue;

    const match = /^- (.+?) \[(.+?)\] (.+?):(\d+)-(\d+)$/.exec(line);
    if (!match) {
      out.push({
        label: line.slice(2),
        key: line.slice(2),
      });
      continue;
    }

    const [, name, type, file, startLine, endLine] = match;
    out.push({
      label: `${name} [${type}] ${file}:${startLine}-${endLine}`,
      key: `${file}:${startLine}-${endLine}:${name}:${type}`,
    });
  }

  return out;
}

function formatSymbol(symbol) {
  return `${symbol.name} [${symbol.type}] ${symbol.file}:${symbol.startLine}-${symbol.endLine}`;
}

function percent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function percentSaved(packBytes, baselineBytes) {
  if (!baselineBytes) return 0;
  return Number((100 - ((packBytes / baselineBytes) * 100)).toFixed(1));
}

function compareKeySets(keysA, keysB) {
  const setA = new Set(keysA || []);
  const setB = new Set(keysB || []);
  const union = new Set([...setA, ...setB]);
  let shared = 0;
  for (const key of setA) {
    if (setB.has(key)) shared++;
  }
  return {
    shared,
    union: union.size,
    percent: union.size ? Number(((shared / union.size) * 100).toFixed(1)) : 100,
  };
}

function summarizeVariant({ projectRoot, prompt, index, cfg, backend, fullFilesBaseline, symbolPreviewCount }) {
  const variantCfg = {
    ...cfg,
    structuralSearchBackend: backend,
  };
  const promptTokens = mergedPromptTokens(prompt.promptText);
  const structural = searchStructuralSymbols({
    rootDir: projectRoot,
    promptText: prompt.promptText,
    promptTokens,
    index,
    codeIndexConfig: variantCfg,
    redactSecrets: null,
  });
  const pack = buildContextPack({
    rootDir: projectRoot,
    promptText: prompt.promptText,
    index,
    cfg: variantCfg,
    redactSecrets: null,
  });

  const packBytes = pack.used ? Buffer.byteLength(pack.markdown, 'utf8') : 0;
  const listedSymbols = pack.used ? extractListedSymbols(pack.markdown) : [];

  return {
    requestBackend: backend,
    backendUsed: pack.structuralSearch?.backendUsed || structural.backendUsed,
    fallback: Boolean(pack.structuralSearch?.fallback ?? structural.fallback),
    structuralSymbolCount: Number(pack.structuralSearch?.symbolCount || structural.symbols?.length || 0),
    structuralSymbols: (structural.symbols || []).slice(0, symbolPreviewCount).map((sym) => ({
      label: formatSymbol(sym),
      key: `${sym.file}:${sym.startLine}-${sym.endLine}:${sym.name}:${sym.type}`,
    })),
    packUsed: Boolean(pack.used),
    reason: String(pack.reason || ''),
    selectedCount: Number(pack.selectedCount || 0),
    packBytes,
    packTokens: estimateTokensFromBytes(packBytes),
    packSavingsPct: pack.used ? percentSaved(packBytes, fullFilesBaseline.bytes) : 0,
    packSymbols: listedSymbols.slice(0, symbolPreviewCount),
  };
}

function compareVariants(indexVariant, astVariant) {
  const structuralOverlap = compareKeySets(
    indexVariant.structuralSymbols.map((item) => item.key),
    astVariant.structuralSymbols.map((item) => item.key)
  );
  const packOverlap = compareKeySets(
    indexVariant.packSymbols.map((item) => item.key),
    astVariant.packSymbols.map((item) => item.key)
  );

  return {
    bytesDelta: astVariant.packBytes - indexVariant.packBytes,
    selectedDelta: astVariant.selectedCount - indexVariant.selectedCount,
    structuralOverlapPct: structuralOverlap.percent,
    packOverlapPct: packOverlap.percent,
    sameBackendOutcome: indexVariant.backendUsed === astVariant.backendUsed
      && indexVariant.fallback === astVariant.fallback,
    identicalPackOutcome: indexVariant.packUsed === astVariant.packUsed
      && indexVariant.selectedCount === astVariant.selectedCount
      && indexVariant.packBytes === astVariant.packBytes
      && packOverlap.percent === 100,
  };
}

function aggregateResults(results, fullFilesBaseline) {
  const aggregate = {
    promptsCompared: results.length,
    fullFilesBaseline,
    variants: {
      index: {
        requested: 'index',
        packUsedCount: 0,
        fallbackCount: 0,
        backendUsage: {},
        totalSelected: 0,
        totalPackBytes: 0,
      },
      'ast-grep': {
        requested: 'ast-grep',
        packUsedCount: 0,
        fallbackCount: 0,
        backendUsage: {},
        totalSelected: 0,
        totalPackBytes: 0,
      },
    },
    comparisons: {
      identicalPackOutcomeCount: 0,
      astRequestedButFellBackCount: 0,
      astActuallyUsedCount: 0,
      totalBytesDelta: 0,
      totalSelectedDelta: 0,
      averageStructuralOverlapPct: 0,
      averagePackOverlapPct: 0,
    },
  };

  for (const result of results) {
    for (const variantName of ['index', 'ast-grep']) {
      const variant = result.variants[variantName];
      const bucket = aggregate.variants[variantName];
      if (variant.packUsed) bucket.packUsedCount++;
      if (variant.fallback) bucket.fallbackCount++;
      bucket.backendUsage[variant.backendUsed] = (bucket.backendUsage[variant.backendUsed] || 0) + 1;
      bucket.totalSelected += variant.selectedCount;
      bucket.totalPackBytes += variant.packBytes;
    }

    if (result.comparison.identicalPackOutcome) {
      aggregate.comparisons.identicalPackOutcomeCount++;
    }
    if (result.variants['ast-grep'].fallback) {
      aggregate.comparisons.astRequestedButFellBackCount++;
    }
    if (result.variants['ast-grep'].backendUsed === 'ast-grep') {
      aggregate.comparisons.astActuallyUsedCount++;
    }
    aggregate.comparisons.totalBytesDelta += result.comparison.bytesDelta;
    aggregate.comparisons.totalSelectedDelta += result.comparison.selectedDelta;
    aggregate.comparisons.averageStructuralOverlapPct += result.comparison.structuralOverlapPct;
    aggregate.comparisons.averagePackOverlapPct += result.comparison.packOverlapPct;
  }

  for (const variantName of ['index', 'ast-grep']) {
    const bucket = aggregate.variants[variantName];
    bucket.packUsedPct = percent(bucket.packUsedCount, aggregate.promptsCompared);
    bucket.fallbackPct = percent(bucket.fallbackCount, aggregate.promptsCompared);
    bucket.avgSelected = aggregate.promptsCompared
      ? Number((bucket.totalSelected / aggregate.promptsCompared).toFixed(1))
      : 0;
    bucket.avgPackBytes = aggregate.promptsCompared
      ? Math.round(bucket.totalPackBytes / aggregate.promptsCompared)
      : 0;
    bucket.avgPackTokens = estimateTokensFromBytes(bucket.avgPackBytes);
    bucket.avgSavingsPct = percentSaved(bucket.avgPackBytes, fullFilesBaseline.bytes);
  }

  if (aggregate.promptsCompared) {
    aggregate.comparisons.averageStructuralOverlapPct = Number(
      (aggregate.comparisons.averageStructuralOverlapPct / aggregate.promptsCompared).toFixed(1)
    );
    aggregate.comparisons.averagePackOverlapPct = Number(
      (aggregate.comparisons.averagePackOverlapPct / aggregate.promptsCompared).toFixed(1)
    );
  }

  return aggregate;
}

function renderHumanReport(report) {
  const lines = [];
  lines.push(`Project: ${report.projectPath}`);
  lines.push(`Prompt source: ${report.source}`);
  lines.push(`Unique prompts compared: ${report.prompts.length}`);
  lines.push(`Index path: ${report.indexPath}`);
  lines.push(
    `ast-grep binary: ${report.astGrepBinary || 'not detected'}`
    + (report.astGrepBinary ? '' : ' (ast-grep requests will fallback to index)')
  );
  lines.push(
    `Full-files baseline: ${report.aggregate.fullFilesBaseline.files} files, `
    + `${(report.aggregate.fullFilesBaseline.bytes / 1024).toFixed(1)} KB `
    + `~ ${report.aggregate.fullFilesBaseline.tokens} tokens`
  );
  lines.push('');
  lines.push('Aggregate');
  for (const variantName of ['index', 'ast-grep']) {
    const variant = report.aggregate.variants[variantName];
    const usage = Object.entries(variant.backendUsage)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([backend, count]) => `${backend}:${count}`)
      .join(', ') || 'none';
    lines.push(
      `- ${variantName}: packUsed=${variant.packUsedCount}/${report.aggregate.promptsCompared} `
      + `(${variant.packUsedPct}%), fallback=${variant.fallbackCount}/${report.aggregate.promptsCompared} `
      + `(${variant.fallbackPct}%), backendUsed={${usage}}, avgSelected=${variant.avgSelected}, `
      + `avgPack=${(variant.avgPackBytes / 1024).toFixed(1)} KB ~ ${variant.avgPackTokens} tokens, `
      + `avgSavings=${variant.avgSavingsPct}%`
    );
  }
  lines.push(
    `- compare: astUsed=${report.aggregate.comparisons.astActuallyUsedCount}/${report.aggregate.promptsCompared}, `
    + `astFallback=${report.aggregate.comparisons.astRequestedButFellBackCount}/${report.aggregate.promptsCompared}, `
    + `identicalPack=${report.aggregate.comparisons.identicalPackOutcomeCount}/${report.aggregate.promptsCompared}, `
    + `avgStructuralOverlap=${report.aggregate.comparisons.averageStructuralOverlapPct}%, `
    + `avgPackOverlap=${report.aggregate.comparisons.averagePackOverlapPct}%, `
    + `bytesDelta=${report.aggregate.comparisons.totalBytesDelta}, `
    + `selectedDelta=${report.aggregate.comparisons.totalSelectedDelta}`
  );

  for (const result of report.results) {
    lines.push('');
    lines.push(`[${result.prompt.id}] ${result.prompt.preview}`);
    lines.push(`- promptHash=${result.prompt.promptHash}, source=${result.prompt.source}`);
    for (const variantName of ['index', 'ast-grep']) {
      const variant = result.variants[variantName];
      const structuralPreview = variant.structuralSymbols.map((item) => item.label).join(' | ') || 'none';
      const packPreview = variant.packSymbols.map((item) => item.label).join(' | ') || 'none';
      lines.push(
        `- ${variantName}: requested=${variant.requestBackend}, used=${variant.backendUsed}, `
        + `fallback=${variant.fallback}, packUsed=${variant.packUsed}, selected=${variant.selectedCount}, `
        + `structuralSymbols=${variant.structuralSymbolCount}, packBytes=${variant.packBytes}, `
        + `savings=${variant.packSavingsPct}%${variant.reason ? `, reason=${variant.reason}` : ''}`
      );
      lines.push(`  structuralTop: ${structuralPreview}`);
      lines.push(`  packTop: ${packPreview}`);
    }
    lines.push(
      `- diff: selectedDelta=${result.comparison.selectedDelta}, bytesDelta=${result.comparison.bytesDelta}, `
      + `structuralOverlap=${result.comparison.structuralOverlapPct}%, `
      + `packOverlap=${result.comparison.packOverlapPct}%, `
      + `identicalPack=${result.comparison.identicalPackOutcome}`
    );
  }

  return lines.join('\n');
}

function buildReport({ projectPath, source, prompts, indexPath, astGrepBinary, results, aggregate }) {
  return {
    generatedAt: new Date().toISOString(),
    projectPath,
    source,
    promptCount: prompts.length,
    indexPath,
    astGrepBinary: astGrepBinary || '',
    prompts: prompts.map((prompt) => ({
      id: prompt.id,
      source: prompt.source,
      path: prompt.path,
      promptHash: prompt.promptHash,
      preview: prompt.preview,
    })),
    results,
    aggregate,
  };
}

function main(argv = process.argv.slice(2)) {
  if (hasFlag(argv, 'help')) {
    usage();
    return 0;
  }

  const projectPathRaw = String(parseFlagValue(argv, 'project-path') || '').trim();
  if (!projectPathRaw) {
    usage();
    throw new Error('Missing required --project-path flag.');
  }

  const projectPath = path.resolve(projectPathRaw);
  const source = parseSource(argv);
  const limit = Math.max(0, parseIntFlag(argv, 'limit', 5));
  const symbolPreviewCount = Math.max(1, parseIntFlag(argv, 'symbols', 5));
  const jsonOutput = hasFlag(argv, 'json');
  const outputPath = parseOutputPath(argv);

  const layout = resolveProjectLayout(projectPath);
  if (!fs.existsSync(layout.contextConfigPath)) {
    throw new Error(`Context config not found: ${layout.contextConfigPath}`);
  }

  const contextConfig = JSON.parse(fs.readFileSync(layout.contextConfigPath, 'utf8'));
  const indexCfg = resolveIndexConfig(contextConfig);
  const indexPath = layout.resolveIndexPath(indexCfg.outputPath);
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Code index not found: ${indexPath}. Run ai:index for the project first.`);
  }

  const prompts = collectPrompts(layout, source, limit);
  if (!prompts.length) {
    throw new Error(`No prompt.txt files found in source=${source}.`);
  }

  const index = loadCodeIndex(indexPath);
  const fullFilesBaseline = computeFullFilesBaseline(projectPath, index);
  const astGrepBinary = detectAstGrepBinary({
    env: process.env,
    timeoutMs: 1500,
  });

  const results = prompts.map((prompt) => {
    const indexVariant = summarizeVariant({
      projectRoot: projectPath,
      prompt,
      index,
      cfg: indexCfg,
      backend: 'index',
      fullFilesBaseline,
      symbolPreviewCount,
    });
    const astVariant = summarizeVariant({
      projectRoot: projectPath,
      prompt,
      index,
      cfg: indexCfg,
      backend: 'ast-grep',
      fullFilesBaseline,
      symbolPreviewCount,
    });

    return {
      prompt: {
        id: prompt.id,
        source: prompt.source,
        path: prompt.path,
        promptHash: prompt.promptHash,
        preview: prompt.preview,
      },
      variants: {
        index: indexVariant,
        'ast-grep': astVariant,
      },
      comparison: compareVariants(indexVariant, astVariant),
    };
  });

  const aggregate = aggregateResults(results, fullFilesBaseline);
  const report = buildReport({
    projectPath,
    source,
    prompts,
    indexPath,
    astGrepBinary,
    results,
    aggregate,
  });

  const rendered = jsonOutput
    ? JSON.stringify(report, null, 2)
    : renderHumanReport(report);

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rendered, 'utf8');
  }

  console.log(rendered);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  aggregateResults,
  collectPrompts,
  compareKeySets,
  compareVariants,
  computeFullFilesBaseline,
  extractListedSymbols,
  renderHumanReport,
  summarizeVariant,
};
