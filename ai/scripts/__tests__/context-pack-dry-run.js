#!/usr/bin/env node
/**
 * Dry-run test for context-pack: loads real index, runs typical prompts,
 * shows how many symbols match and what token savings we get.
 *
 * Usage:  node ai/scripts/__tests__/context-pack-dry-run.js
 *         node ai/scripts/__tests__/context-pack-dry-run.js --prompt="your custom prompt"
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const {
  buildContextPack,
  tokens,
  scoreSymbols,
  fileNameSeeds,
  translateTokens,
} = require(path.join(ROOT, 'ai/scripts/context-pack.js'));
const { loadCodeIndex, resolveIndexConfig } = require(path.join(ROOT, 'ai/scripts/context-index.js'));
const { resolveProjectPaths } = require(path.join(ROOT, 'ai/scripts/path-utils.js'));

// ── Load real index ──
const projectPaths = resolveProjectPaths(ROOT);
const contextConfigPath = path.join(projectPaths.aiDataRoot, 'context.json');
const contextConfig = JSON.parse(fs.readFileSync(contextConfigPath, 'utf8'));
const indexCfg = resolveIndexConfig(contextConfig);
const primaryIndexPath = path.join(projectPaths.aiDataRoot, indexCfg.outputPath);
const legacyIndexPath = path.join(ROOT, indexCfg.outputPath);
const indexPath = fs.existsSync(primaryIndexPath) ? primaryIndexPath : legacyIndexPath;

if (!fs.existsSync(indexPath)) {
  console.error(`❌ Index not found at ${indexPath}. Run "npm run ai:index" first.`);
  process.exit(1);
}

const index = loadCodeIndex(indexPath);
console.log(`\n📊 Index loaded: ${index.symbols.length} symbols, ${index.edges.length} edges, mode: ${index.mode}\n`);

// ── Typical prompts to test ──
const TEST_PROMPTS = [
  // EN: technical, references function names
  'Fix bug in buildCodeIndex where symbols are duplicated',
  // EN: architectural, no direct function names
  'Add rate limiting to all API calls in the agent pipeline',
  // RU: typical user prompt
  'Добавь обработку ошибок в модуль загрузки конфигурации',
  // RU: abstract task
  'Оптимизируй производительность сборки контекста',
  // EN: references file names
  'Refactor context-pack.js to support fuzzy matching',
  // EN: references specific concepts
  'Add tree-sitter support for Kotlin language',
  // Mixed: typical real prompt
  'Исправь баг: generate-context падает если agents.json пустой',
  // Very abstract (worst case)
  'Сделай код лучше',
  // Direct function reference
  'scoreSymbols should also match camelCase substrings',
  // Hub-specific
  'Add new command to hub.js for project archiving',
];

// ── Allow custom prompt from CLI ──
const customPrompt = process.argv.find(a => a.startsWith('--prompt='));
if (customPrompt) {
  TEST_PROMPTS.unshift(customPrompt.split('=').slice(1).join('='));
}

// ── Token estimation ──
function estimateTokens(text) {
  // Rough: 1 token ≈ 4 chars for code
  return Math.ceil((text || '').length / 4);
}

// ── Compute full-files baseline ──
function computeFullFilesBaseline(index) {
  const files = new Set(index.symbols.map(s => s.file));
  let totalBytes = 0;
  for (const relPath of files) {
    const abs = path.join(ROOT, relPath);
    if (fs.existsSync(abs)) {
      totalBytes += fs.statSync(abs).size;
    }
  }
  return totalBytes;
}

const fullFilesBytes = computeFullFilesBaseline(index);
const fullFilesTokens = estimateTokens('x'.repeat(fullFilesBytes));

console.log(`📁 Full files baseline: ${(fullFilesBytes / 1024).toFixed(1)} KB ≈ ${fullFilesTokens} tokens\n`);
console.log('═'.repeat(90));

// ── Run each prompt ──
let passCount = 0;
let fallbackCount = 0;

for (const prompt of TEST_PROMPTS) {
  console.log(`\n🔍 Prompt: "${prompt}"`);

  const promptTokens = tokens(prompt);
  const translated = translateTokens(promptTokens);
  const mergedTokens = translated.length ? [...promptTokens, ...translated] : promptTokens;
  const fnSeeds = fileNameSeeds(mergedTokens, index.symbols);

  console.log(`   Tokens extracted: [${promptTokens.join(', ')}]`);
  if (translated.length) {
    console.log(`   RU→EN mapped: [${translated.join(', ')}]`);
  }
  if (fnSeeds.length) {
    const files = [...new Set(fnSeeds.map((s) => s.file))];
    console.log(`   File-name seeds: ${fnSeeds.length} symbols from ${files.length} file(s): ${files.join(', ')}`);
  }

  const scored = scoreSymbols(mergedTokens, index.symbols).filter(x => x.score > 0);
  console.log(`   Symbols matched: ${scored.length} / ${index.symbols.length}`);

  if (scored.length > 0) {
    console.log(`   Top-5 matches:`);
    for (const { sym, score } of scored.slice(0, 5)) {
      console.log(`     ${score.toString().padStart(3)} pts  ${sym.name} [${sym.type}]  ${sym.file}:${sym.startLine}`);
    }
  }

  const pack = buildContextPack({
    rootDir: ROOT,
    promptText: prompt,
    index,
    cfg: indexCfg,
    redactSecrets: null,
  });

  if (pack.used) {
    const packBytes = Buffer.byteLength(pack.markdown, 'utf8');
    const packTokens = estimateTokens(pack.markdown);
    const savings = ((1 - packBytes / fullFilesBytes) * 100).toFixed(1);
    console.log(`   ✅ Pack USED: ${pack.selectedCount} symbols, ${(packBytes / 1024).toFixed(1)} KB ≈ ${packTokens} tokens`);
    console.log(`   💰 Savings vs full files: ${savings}% (${fullFilesTokens - packTokens} tokens saved)`);
    passCount++;
  } else {
    console.log(`   ⚠️  Pack NOT used: ${pack.reason} → FALLBACK to full files`);
    fallbackCount++;
  }

  console.log('─'.repeat(90));
}

// ── Summary ──
console.log('\n' + '═'.repeat(90));
console.log(`\n📋 SUMMARY`);
console.log(`   Total prompts tested: ${TEST_PROMPTS.length}`);
console.log(`   ✅ Context pack used:  ${passCount} (${((passCount / TEST_PROMPTS.length) * 100).toFixed(0)}%)`);
console.log(`   ⚠️  Fallback to full:  ${fallbackCount} (${((fallbackCount / TEST_PROMPTS.length) * 100).toFixed(0)}%)`);
console.log(`   Index symbols total:  ${index.symbols.length}`);
console.log(`   Index edges total:    ${index.edges.length}`);
console.log(`   Full files baseline:  ${(fullFilesBytes / 1024).toFixed(1)} KB ≈ ${fullFilesTokens} tokens`);

if (fallbackCount > TEST_PROMPTS.length * 0.3) {
  console.log(`\n⚠️  WARNING: High fallback rate (${((fallbackCount / TEST_PROMPTS.length) * 100).toFixed(0)}%).`);
  console.log(`   The tokenizer/scorer may need improvements for better prompt-to-symbol matching.`);
}

if (index.edges.length === 0) {
  console.log(`\n⚠️  WARNING: Index has 0 edges. Graph expansion is effectively disabled.`);
  console.log(`   Only direct name matches will work, no dependency traversal.`);
}

console.log('');
