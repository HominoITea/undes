#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { enforceDispatcherGuard } = require('./dispatcher-guard');
const { normalizeScriptMainInput } = require('./infrastructure/main-input');
const { resolveProjectLayout } = require('./path-utils');

const DEFAULT_RULES = {
  targets: ['rust-cli/src', 'src'],
  extensions: ['.rs'],
  ignoreDirNames: ['.git', 'node_modules', 'target'],
  ignorePathParts: ['/generated/', '/vendor/'],
  maxLines: 200,
  maxFunctions: 12,
  maxExports: 8,
  maxImplBlocks: 8,
  maxConcernBuckets: 3,
  godModuleFunctionThreshold: 8,
};
const CONCERNS = [
  ['cli', /\bclap::|derive\s*\(\s*Parser|derive\s*\(\s*Subcommand|structopt\b/],
  ['filesystem', /\bstd::fs\b|\btokio::fs\b|\bFile\b|\bread_to_string\b|\bwrite\b/],
  ['network', /\breqwest\b|\bhyper\b|\bhttp::\b|\bStatusCode\b/],
  ['serialization', /\bserde\b|\bserde_json\b/],
  ['process', /\bstd::process\b|\bCommand::new\b/],
  ['logging', /\btracing\b|\blog::\b|\bmetrics\b/],
  ['concurrency', /\btokio::spawn\b|\bstd::thread\b|\bMutex\b|\bRwLock\b/],
];

function toArray(value, fallback) {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : fallback;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv) {
  const options = { help: false, targets: [], overrides: {} };
  const map = {
    'max-lines': 'maxLines',
    'max-functions': 'maxFunctions',
    'max-exports': 'maxExports',
    'max-impl-blocks': 'maxImplBlocks',
    'max-concerns': 'maxConcernBuckets',
    'god-fns': 'godModuleFunctionThreshold',
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') options.help = true;
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const value = eq === -1 ? '' : arg.slice(eq + 1);
    if (key === 'target' && value) options.targets.push(value);
    if (map[key]) options.overrides[map[key]] = toInt(value, null);
  }
  return options;
}

function resolveRulesPath(root = process.cwd()) {
  return resolveProjectLayout(root).architectureRulesPath;
}

function loadRules(options, rulesPath = resolveRulesPath(process.cwd())) {
  let fileRules = {};
  if (fs.existsSync(rulesPath)) {
    try {
      fileRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } catch (error) {
      console.error(`❌ Failed to parse ${rulesPath}: ${error.message}`);
      process.exit(1);
    }
  }

  const rules = { ...DEFAULT_RULES, ...fileRules };
  rules.targets = options.targets.length ? options.targets : toArray(rules.targets, DEFAULT_RULES.targets);
  rules.extensions = toArray(rules.extensions, DEFAULT_RULES.extensions);
  rules.ignoreDirNames = toArray(rules.ignoreDirNames, DEFAULT_RULES.ignoreDirNames);
  rules.ignorePathParts = toArray(rules.ignorePathParts, DEFAULT_RULES.ignorePathParts);

  for (const [key, value] of Object.entries(options.overrides)) {
    rules[key] = value ?? toInt(rules[key], DEFAULT_RULES[key]);
  }
  for (const key of Object.keys(DEFAULT_RULES)) {
    if (typeof DEFAULT_RULES[key] === 'number') {
      rules[key] = toInt(rules[key], DEFAULT_RULES[key]);
    }
  }
  return rules;
}

function normPath(value) {
  return value.split(path.sep).join('/');
}

function isIgnored(relPath, rules) {
  const normalized = `/${normPath(relPath)}`;
  return rules.ignorePathParts.some((part) => normalized.includes(part));
}

function walk(absDir, rules, files, root = process.cwd()) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const absPath = path.join(absDir, entry.name);
    const relPath = path.relative(root, absPath);
    if (entry.isDirectory()) {
      if (!rules.ignoreDirNames.includes(entry.name) && !isIgnored(relPath, rules)) {
        walk(absPath, rules, files, root);
      }
      continue;
    }
    if (!entry.isFile() || isIgnored(relPath, rules)) continue;
    if (rules.extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push({ absPath, relPath: normPath(relPath) });
    }
  }
}

function collectFiles(rules, root = process.cwd()) {
  const files = [];
  for (const target of rules.targets) {
    const absTarget = path.join(root, target);
    if (fs.existsSync(absTarget) && fs.statSync(absTarget).isDirectory()) {
      walk(absTarget, rules, files, root);
    }
  }
  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function count(content, regex) {
  const hits = content.match(regex);
  return hits ? hits.length : 0;
}

function detectConcerns(content) {
  return CONCERNS.filter(([, pattern]) => pattern.test(content)).map(([name]) => name);
}

function analyze(file, rules) {
  const content = fs.readFileSync(file.absPath, 'utf8');
  const metrics = {
    lines: content.split(/\r?\n/).length,
    fns: count(content, /\b(?:pub\s+)?(?:async\s+)?fn\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/g),
    exports: count(content, /\bpub\s+(?:\([^)]+\)\s+)?(?:async\s+)?fn\b|\bpub\s+(?:struct|enum|trait|mod|type|const|static)\b/g),
    impls: count(content, /\bimpl(?:\s*<[^>]+>)?\s+[A-Za-z_][A-Za-z0-9_]*/g),
  };
  const concerns = detectConcerns(content);
  const violations = [];
  if (metrics.lines > rules.maxLines) violations.push(`line count ${metrics.lines} > ${rules.maxLines}`);
  if (metrics.fns > rules.maxFunctions) violations.push(`function count ${metrics.fns} > ${rules.maxFunctions}`);
  if (metrics.exports > rules.maxExports) violations.push(`export count ${metrics.exports} > ${rules.maxExports}`);
  if (metrics.impls > rules.maxImplBlocks) violations.push(`impl block count ${metrics.impls} > ${rules.maxImplBlocks}`);
  if (concerns.length > rules.maxConcernBuckets && metrics.fns >= rules.godModuleFunctionThreshold) {
    violations.push(`god-module signal: concerns=${concerns.length} [${concerns.join(', ')}], functions=${metrics.fns}`);
  }
  return { ...file, ...metrics, violations };
}

function printHelp() {
  console.log('Usage: node ai/scripts/architecture-check.js [--target=PATH] [--max-lines=N] [--max-functions=N]');
  console.log('Extra options: --max-exports=N --max-impl-blocks=N --max-concerns=N --god-fns=N');
}

function normalizeMainInput(optionsOrArgv = process.argv, root = process.cwd()) {
  return normalizeScriptMainInput(optionsOrArgv, {
    argv: process.argv,
    env: process.env,
    projectPath: root || process.cwd(),
    hubRoot: '',
  });
}

function main(optionsOrArgv = process.argv, root = process.cwd()) {
  const input = normalizeMainInput(optionsOrArgv, root);
  const argv = input.argv;
  const projectRoot = input.projectPath;
  const options = parseArgs(argv);
  if (options.help) return printHelp();
  const rules = loadRules(options, resolveRulesPath(projectRoot));
  const files = collectFiles(rules, projectRoot);

  if (!files.length) {
    console.log(`⚠️ Architecture check skipped: no ${rules.extensions.join(', ')} files found in [${rules.targets.join(', ')}]`);
    return;
  }

  const results = files.map((file) => analyze(file, rules));
  const failed = results.filter((r) => r.violations.length);
  if (!failed.length) {
    console.log(`✅ Architecture check passed: ${results.length} file(s) validated.`);
    return;
  }

  console.error(`❌ Architecture check failed: ${failed.length}/${results.length} file(s) violate rules.`);
  for (const result of failed) {
    console.error(`\n- ${result.relPath}`);
    console.error(`  metrics: lines=${result.lines}, fns=${result.fns}, exports=${result.exports}, impl=${result.impls}`);
    for (const violation of result.violations) console.error(`  violation: ${violation}`);
  }
  process.exit(1);
}

if (require.main === module) {
  enforceDispatcherGuard({
    useCommand: 'npm run ai:arch:check -- [--target=PATH] [--max-lines=N]',
  });
  main();
}

module.exports = {
  DEFAULT_RULES,
  CONCERNS,
  toArray,
  toInt,
  parseArgs,
  resolveRulesPath,
  loadRules,
  normPath,
  isIgnored,
  walk,
  collectFiles,
  count,
  detectConcerns,
  analyze,
  normalizeMainInput,
  main,
};
