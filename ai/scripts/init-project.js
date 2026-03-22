const fs = require('fs');
const path = require('path');
const readline = require('node:readline/promises');
const { enforceDispatcherGuard } = require('./dispatcher-guard');
const { normalizeScriptMainInput } = require('./infrastructure/main-input');
const { resolveProjectLayout } = require('./path-utils');
const {
  detectProjectStack,
  deriveProjectTypeFromStackProfile,
  buildLlmsSummary,
  hasWeakStackSignals,
} = require('./domain/stack-profile');
const {
  buildScaffoldSyncPlan,
  applyScaffoldSyncPlan,
} = require('./domain/project-scaffold');

const DEFAULT_MAX_FILES = 200;
const DEFAULT_MAX_BYTES = 400 * 1024;
const DEFAULT_MAX_FILE_BYTES = 80 * 1024;
const DEFAULT_DEPTH = 3;
const DEFAULT_EXCLUDE_CMD = 'find . -maxdepth 4 -type f -not -path "./node_modules/*" -not -path "./.git/*"';
const DEFAULT_AGENTS_TEMPLATE_PATH = path.join(__dirname, '..', 'agents.json');

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  'target',
  'bin',
  'obj',
]);

const OUTPUT_FILES = [
  'ai/context.json',
  'ai/llms.md',
  '.cursorrules',
  'CLAUDE.md',
];

function getArgValue(argv, prefix, fallback) {
  const entry = (argv || []).find((arg) => arg.startsWith(prefix));
  if (!entry) return fallback;
  return entry.split('=').slice(1).join('=').trim();
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFlags(argv = process.argv, env = process.env) {
  const args = (argv || []).slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force') || env.npm_config_force === 'true',
    yes: args.includes('--yes'),
    audit: args.includes('--audit'),
    sync: args.includes('--sync'),
    depth: toFiniteNumber(getArgValue(args, '--depth=', DEFAULT_DEPTH), DEFAULT_DEPTH),
    maxFiles: toFiniteNumber(getArgValue(args, '--max-files=', DEFAULT_MAX_FILES), DEFAULT_MAX_FILES),
    maxBytes: toFiniteNumber(getArgValue(args, '--max-bytes=', DEFAULT_MAX_BYTES), DEFAULT_MAX_BYTES),
    provider: getArgValue(args, '--provider=', ''),
    model: getArgValue(args, '--model=', ''),
    apiKeyEnv: getArgValue(args, '--api-key-env=', ''),
    language: getArgValue(args, '--language=', ''),
    framework: getArgValue(args, '--framework=', ''),
    runtime: getArgValue(args, '--runtime=', ''),
    database: getArgValue(args, '--database=', ''),
    packageManager: getArgValue(args, '--package-manager=', ''),
    topology: getArgValue(args, '--topology=', ''),
  };
}

function normalizeMainInput(optionsOrArgv = process.argv, env = process.env, baseCwd = process.cwd()) {
  return normalizeScriptMainInput(optionsOrArgv, {
    argv: process.argv,
    env,
    projectPath: baseCwd || process.cwd(),
    hubRoot: '',
  });
}

function redactSecrets(contents) {
  let redacted = contents;
  const envPattern =
    /(^|\n)(\s*[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY)[A-Z0-9_]*\s*=\s*)([^\n]*)/gi;
  const jsonPattern =
    /("?(?:secret|token|password|apiKey|privateKey|clientSecret|accessKey)"?\s*:\s*)(".*?"|'.*?'|[^,\n}]+)/gi;
  const openAiPattern = /\b(sk-[a-zA-Z0-9]{20,})\b/g;
  const googlePattern = /\b(AIza[0-9A-Za-z-_]{35})\b/g;

  redacted = redacted.replace(envPattern, (match, prefix, key) => `${prefix}${key}[REDACTED]`);
  redacted = redacted.replace(jsonPattern, (match, prefix, value) => {
    const quote = value.trim().startsWith("'") ? "'" : '"';
    return `${prefix}${quote}[REDACTED]${quote}`;
  });
  redacted = redacted.replace(openAiPattern, 'sk-[REDACTED]');
  redacted = redacted.replace(googlePattern, 'AIza[REDACTED]');

  return redacted;
}

function loadAiEnv(filePath, runtimeEnv = process.env) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!key) return;
    if (!runtimeEnv[key]) {
      runtimeEnv[key] = value;
    }
  });
}

function isBinaryBuffer(buffer) {
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function readFileSafe(filePath, maxBytes, rootDir = process.cwd()) {
  try {
    const fullPath = path.join(rootDir, filePath);
    const stats = fs.statSync(fullPath);
    if (stats.size > maxBytes) {
      return `[Truncated: ${stats.size} bytes exceeds ${maxBytes}]`;
    }
    const raw = fs.readFileSync(fullPath);
    if (isBinaryBuffer(raw)) {
      return '[Skipped binary file]';
    }
    return redactSecrets(raw.toString('utf8'));
  } catch (error) {
    return `[Error reading ${filePath}: ${error.message}]`;
  }
}

function scanTree(rootDir, depth, maxFiles) {
  const results = [];
  const root = path.resolve(rootDir);

  function walk(dir, currentDepth) {
    if (results.length >= maxFiles) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      if (entry.name.startsWith('.')) {
        if (entry.name !== '.gitignore' && entry.name !== '.cursorrules') continue;
      }
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        if (currentDepth < depth) {
          walk(fullPath, currentDepth + 1);
        }
      } else {
        results.push(relPath);
      }
    }
  }

  walk(root, 0);
  return results;
}

// ============ SMART PROJECT TYPE DETECTION ============
function detectProjectType(files, packageJson) {
  const stackProfile = detectProjectStack({
    treeFiles: files,
    keyFiles: packageJson ? [packageJson] : [],
    detectedAt: 'legacy-detect-project-type',
  });
  return deriveProjectTypeFromStackProfile(stackProfile);
}

const ROOT_KEY_FILE_CANDIDATES = [
  'package.json',
  'README.md',
  'requirements.txt',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'Gemfile',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'lerna.json',
];

const NESTED_MANIFEST_PATTERN =
  /^(packages|apps|services|libs)\/[^/]+\/(?:package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(?:\.kts)?|composer\.json|Gemfile|[^/]+\.csproj)$/;

function collectStackOverridesFromFlags(flags) {
  return {
    language: flags.language,
    framework: flags.framework,
    runtime: flags.runtime,
    database: flags.database,
    packageManager: flags.packageManager,
    topology: flags.topology,
  };
}

function hasDeclaredStackOverrides(overrides) {
  return Object.values(overrides || {}).some((value) => typeof value === 'string' && value.trim());
}

function listKeyFileCandidates(treeFiles) {
  const rootCandidates = ROOT_KEY_FILE_CANDIDATES.filter((file) => fileExistsInTree(treeFiles, file));
  const rootCsprojFiles = (treeFiles || [])
    .filter((file) => file.endsWith('.csproj') && !NESTED_MANIFEST_PATTERN.test(file))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 3);
  const nestedManifests = (treeFiles || [])
    .filter((file) => NESTED_MANIFEST_PATTERN.test(file))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);

  return [...new Set([...rootCandidates, ...rootCsprojFiles, ...nestedManifests])];
}

function fileExistsInTree(treeFiles, targetFile) {
  return (treeFiles || []).includes(targetFile);
}

function collectKeyFiles(treeFiles, projectRoot, maxBytes) {
  let byteBudget = maxBytes;
  const keyFiles = [];

  listKeyFileCandidates(treeFiles).forEach((file) => {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) return;
    const content = readFileSafe(file, Math.min(DEFAULT_MAX_FILE_BYTES, byteBudget), projectRoot);
    byteBudget = Math.max(0, byteBudget - content.length);
    keyFiles.push({ path: file, content });
  });

  return keyFiles;
}

function normalizePromptAnswer(answer) {
  return typeof answer === 'string' ? answer.trim() : '';
}

async function promptForBootstrapOverridesIfNeeded(stackProfile, flags, existingOverrides, io = {}) {
  if (!hasWeakStackSignals(stackProfile)) return existingOverrides;
  if (hasDeclaredStackOverrides(existingOverrides)) return existingOverrides;
  if (flags.yes) return existingOverrides;

  const input = io.input || process.stdin;
  const output = io.output || process.stdout;
  if (!input || !output || !input.isTTY || !output.isTTY) {
    return existingOverrides;
  }

  console.log('ℹ️ Stack detection has weak signals. Answer a few bootstrap questions to seed .ai/stack-profile.json.');
  console.log('   Leave any answer empty if you do not want to declare it yet.');

  const rl = readline.createInterface({ input, output });
  try {
    return {
      language: normalizePromptAnswer(await rl.question('Primary language (e.g. typescript, python, go): ')),
      framework: normalizePromptAnswer(await rl.question('Framework or app type (e.g. react, nextjs, fastapi): ')),
      runtime: normalizePromptAnswer(await rl.question('Runtime/platform (e.g. node, python, dotnet, jvm): ')),
      database: normalizePromptAnswer(await rl.question('Database (optional, e.g. postgresql, mongodb): ')),
      packageManager: normalizePromptAnswer(await rl.question('Package manager/build tool (optional, e.g. pnpm, poetry, cargo): ')),
      topology: normalizePromptAnswer(await rl.question('Topology (optional, e.g. single-package, monorepo): ')),
    };
  } finally {
    rl.close();
  }
}

// Project-specific patterns for context generation
const PROJECT_PATTERNS = {
  nextjs: {
    fullFiles: ['app/**/*.tsx', 'pages/**/*.tsx', 'lib/**/*.ts', 'components/**/*.tsx', 'convex/**/*.ts'],
    lightFiles: ['README.md', 'package.json', 'next.config.js']
  },
  nuxt: {
    fullFiles: ['pages/**/*.vue', 'components/**/*.vue', 'composables/**/*.ts', 'server/**/*.ts'],
    lightFiles: ['README.md', 'package.json', 'nuxt.config.ts']
  },
  react: {
    fullFiles: ['src/**/*.tsx', 'src/**/*.ts', 'src/components/**/*.tsx'],
    lightFiles: ['README.md', 'package.json']
  },
  vue: {
    fullFiles: ['src/**/*.vue', 'src/**/*.ts', 'src/components/**/*.vue'],
    lightFiles: ['README.md', 'package.json']
  },
  'node-backend': {
    fullFiles: ['src/**/*.ts', 'src/**/*.js', 'routes/**/*.ts', 'controllers/**/*.ts', 'models/**/*.ts'],
    lightFiles: ['README.md', 'package.json']
  },
  convex: {
    fullFiles: ['convex/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts'],
    lightFiles: ['README.md', 'package.json', 'convex/schema.ts']
  },
  python: {
    fullFiles: ['**/*.py', '!venv/**', '!.venv/**', '!__pycache__/**'],
    lightFiles: ['README.md', 'requirements.txt', 'pyproject.toml']
  },
  go: {
    fullFiles: ['**/*.go', '!vendor/**'],
    lightFiles: ['README.md', 'go.mod']
  },
  rust: {
    fullFiles: ['src/**/*.rs'],
    lightFiles: ['README.md', 'Cargo.toml']
  },
  dotnet: {
    fullFiles: ['**/*.cs', '**/*.csproj'],
    lightFiles: ['README.md', '*.sln']
  },
  java: {
    fullFiles: ['src/**/*.java', 'src/**/*.kt'],
    lightFiles: ['README.md', 'pom.xml', 'build.gradle']
  },
  generic: {
    fullFiles: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
    lightFiles: ['README.md']
  }
};

function buildDefaultContext(files, projectType) {
  const fileSet = new Set(files);
  const fullFiles = [];
  const lightFiles = [];

  if (fileSet.has('README.md')) lightFiles.push('README.md');
  if (fileSet.has('ai/PATTERNS.md')) lightFiles.push('ai/PATTERNS.md');
  if (fileSet.has('CLAUDE.md')) lightFiles.push('CLAUDE.md');
  if (fileSet.has('.cursorrules')) lightFiles.push('.cursorrules');

  if (projectType === 'node') {
    if (fileSet.has('package.json')) fullFiles.push('package.json');
    if (fileSet.has('tsconfig.json')) fullFiles.push('tsconfig.json');
  }
  if (projectType === 'python') {
    if (fileSet.has('pyproject.toml')) fullFiles.push('pyproject.toml');
    if (fileSet.has('requirements.txt')) fullFiles.push('requirements.txt');
  }
  if (projectType === 'dotnet') {
    files.filter((file) => file.endsWith('.csproj')).slice(0, 3).forEach((file) => fullFiles.push(file));
  }
  if (projectType === 'go') {
    if (fileSet.has('go.mod')) fullFiles.push('go.mod');
  }

  if (fileSet.has('ai/llms.md')) fullFiles.push('ai/llms.md');

  ['ai/KNOWLEDGE_BASE.md', 'ai/agents.json'].forEach((file) => {
    if (fileSet.has(file)) fullFiles.push(file);
  });

  const appCandidates = files.filter((file) =>
    file.startsWith('src/') ||
    file.startsWith('app/') ||
    file.startsWith('server/') ||
    file.startsWith('lib/')
  );
  appCandidates.slice(0, 12).forEach((file) => fullFiles.push(file));

  const uniqueFull = Array.from(new Set(fullFiles)).slice(0, 30);
  const uniqueLight = Array.from(new Set(lightFiles)).slice(0, 10);

  return {
    fullFiles: uniqueFull.length ? uniqueFull : ['README.md', 'package.json'].filter((f) => fileSet.has(f)),
    lightFiles: uniqueLight.length ? uniqueLight : ['README.md'].filter((f) => fileSet.has(f)),
    exclude: DEFAULT_EXCLUDE_CMD,
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean))];
}

function normalizeContextConfig(rawConfig, fallbackContext) {
  const fallback = fallbackContext || {
    fullFiles: ['README.md', 'package.json'],
    lightFiles: ['README.md'],
    exclude: DEFAULT_EXCLUDE_CMD,
  };
  const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const warnings = [];

  const fullFiles = normalizeStringArray(raw.fullFiles);
  const lightFiles = normalizeStringArray(raw.lightFiles);

  let exclude = '';
  if (typeof raw.exclude === 'string' && raw.exclude.trim()) {
    exclude = raw.exclude.trim();
  } else {
    if (raw.exclude !== undefined) {
      warnings.push('contextConfig.exclude is not a non-empty string; fallback exclude command was applied.');
    }
    exclude = fallback.exclude || DEFAULT_EXCLUDE_CMD;
  }

  if (!fullFiles.length) {
    warnings.push('contextConfig.fullFiles is missing/invalid; fallback fullFiles were applied.');
  }
  if (!lightFiles.length) {
    warnings.push('contextConfig.lightFiles is missing/invalid; fallback lightFiles were applied.');
  }

  return {
    context: {
      ...raw,
      fullFiles: fullFiles.length ? fullFiles : fallback.fullFiles,
      lightFiles: lightFiles.length ? lightFiles : fallback.lightFiles,
      exclude,
    },
    warnings,
  };
}

function addUniqueItems(items, additions) {
  const next = Array.isArray(items) ? [...items] : [];
  for (const entry of additions || []) {
    const value = typeof entry === 'string' ? entry.trim() : '';
    if (!value || next.includes(value)) continue;
    next.push(value);
  }
  return next;
}

function injectBootstrapArtifacts(contextConfig, projectLayout) {
  const runtimeStackProfilePath = path.posix.join(projectLayout.runtimeDirName.replace(/\\/g, '/'), 'stack-profile.json');
  return {
    ...contextConfig,
    fullFiles: addUniqueItems(contextConfig.fullFiles, ['ai/llms.md', runtimeStackProfilePath]),
    lightFiles: addUniqueItems(contextConfig.lightFiles, ['ai/llms.md', runtimeStackProfilePath]),
  };
}

function buildDefaultLlms(projectType) {
  if (projectType === 'nextjs' || projectType === 'react') {
    return [
      '# Project Architecture Summary',
      '',
      `Detected stack: ${projectType} (React + TypeScript)`,
      '',
      '## 1) Product Context',
      '- Web application built on Next.js App Router.',
      '- Main goals: fast first render, predictable data flow, safe server-side operations.',
      '',
      '## 2) Core Stack',
      '- Framework: Next.js 14+ (App Router, Route Handlers, Server Components).',
      '- UI: React 18+ with TypeScript strict mode.',
      '- Styling: CSS Modules / Tailwind (project decision).',
      '- Validation: Zod at API boundary.',
      '- Data access: Prisma or typed repository layer.',
      '',
      '## 3) Recommended Folder Structure',
      '- `app/` - routes, layouts, loading/error boundaries, route handlers.',
      '- `components/` - reusable UI components, split by domain and ui primitives.',
      '- `features/` - business modules (auth, billing, dashboard, etc.).',
      '- `lib/` - cross-cutting utilities (api clients, logger, auth helpers).',
      '- `server/` - server-only services, repositories, integrations.',
      '- `types/` - shared DTO and domain types.',
      '',
      '## 4) Architectural Rules',
      '- Keep domain logic out of UI components.',
      '- Use Server Components by default; add `\"use client\"` only when required.',
      '- Keep API schemas colocated with handlers and reuse schema types on client.',
      '- Avoid direct DB calls from route files; route -> service -> repository.',
      '- Prefer explicit mapping between DB entities and API DTOs.',
      '',
      '## 5) Typical Request Flow',
      '1. UI event in client component.',
      '2. Typed request to Route Handler / Server Action.',
      '3. Validation with Zod.',
      '4. Business logic in service layer.',
      '5. Repository/database access.',
      '6. Typed response + UI state update.',
      '',
      '## 6) Security Baseline',
      '- Validate all external input.',
      '- Enforce auth/role checks on server side only.',
      '- Keep secrets in `.env` and never expose on client.',
      '- Log security-sensitive events without leaking PII/secrets.',
      '',
      '## 7) Performance Baseline',
      '- Use route-level caching and revalidation intentionally.',
      '- Avoid over-fetching in Server Components.',
      '- Split heavy client bundles and defer non-critical UI.',
      '- Measure Core Web Vitals on key pages.',
    ].join('\n');
  }

  return [
    '# Project Architecture Summary',
    '',
    `Detected stack: ${projectType}`,
    '',
    '## 1) Product Context',
    '- Multi-module application with typed boundaries.',
    '- Goal: maintainable architecture and predictable delivery.',
    '',
    '## 2) Baseline Rules',
    '- Keep business logic separate from transport/UI.',
    '- Validate external input at module boundaries.',
    '- Keep secrets out of source control and prompts.',
    '- Favor small, testable modules over god files.',
    '',
    '## 3) Required Follow-up',
    '- Replace this default summary with project-specific modules.',
    '- Describe real data flow and auth model.',
    '- List critical invariants and known pitfalls.',
  ].join('\n');
}

function buildDefaultCursorRules(projectType) {
  if (projectType === 'nextjs' || projectType === 'react') {
    return [
      '# Role and Context',
      `You are a senior engineer working on a ${projectType} (Next.js + React + TypeScript) codebase.`,
      '',
      '# Mission',
      '- Deliver production-ready code with minimal and safe diffs.',
      '- Respect architecture boundaries and typed contracts.',
      '',
      '# Code Style and Safety',
      '- TypeScript strict: avoid `any`, prefer exact types and discriminated unions.',
      '- Keep files focused; split modules before they become god objects.',
      '- Reuse existing helpers/components before introducing new abstractions.',
      '- Never hardcode secrets/tokens/URLs that belong in env config.',
      '',
      '# Next.js Rules',
      '- Prefer Server Components; use `\"use client\"` only for interactive UI/hooks.',
      '- Keep server-only code out of client bundles.',
      '- For API logic use route handlers with input validation.',
      '- Handle loading/error states at route level (`loading.tsx`, `error.tsx`).',
      '',
      '# Data and API Rules',
      '- Validate request payloads with runtime schema checks.',
      '- Keep route handlers thin: parse -> authorize -> service -> map response.',
      '- Return stable response shapes; avoid leaking internal DB models.',
      '',
      '# PR Quality Bar',
      '- Include concise reasoning for non-obvious trade-offs.',
      '- Mention risks and rollback approach for impactful changes.',
      '- Add/update tests when behavior changes.',
      '- If requirement is ambiguous, state assumptions explicitly.',
    ].join('\n');
  }

  return [
    '# Role and Context',
    `You are a senior engineer working on a ${projectType} codebase.`,
    '',
    '# General Rules',
    '- Keep changes minimal and safe.',
    '- Prefer existing patterns and utilities.',
    '- Avoid introducing new dependencies without justification.',
    '- State assumptions explicitly when requirements are ambiguous.',
  ].join('\n');
}

function buildDefaultClaudeGuide(projectType) {
  if (projectType === 'nextjs' || projectType === 'react') {
    return [
      '# Claude Guide',
      '',
      `Project type: ${projectType} (Next.js + React + TypeScript)`,
      '',
      '## Primary Objective',
      '- Produce robust, maintainable implementation guidance for a production web app.',
      '',
      '## Response Policy',
      '- Prioritize correctness over novelty.',
      '- Keep recommendations aligned with existing repository patterns.',
      '- Call out security/performance risks and explicit trade-offs.',
      '',
      '## Technical Focus Areas',
      '- App Router boundaries (server/client components).',
      '- Typed API contracts and runtime validation.',
      '- Error handling, retries, and safe fallback behavior.',
      '- Bundle size and rendering performance.',
      '',
      '## Delivery Checklist',
      '- Clear implementation plan.',
      '- File-level change map.',
      '- Test strategy (unit/integration/e2e where relevant).',
      '- Migration/rollback notes for risky changes.',
    ].join('\n');
  }

  return [
    '# Claude Guide',
    '',
    `Project type: ${projectType}`,
    '',
    'Focus on correctness, maintainability, and minimal diffs.',
    'Document assumptions, risks, and validation steps.',
  ].join('\n');
}

function loadAgentsConfig(configPath) {
  if (!fs.existsSync(configPath)) return null;
  const raw = fs.readFileSync(configPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function loadDefaultAgentsTemplate() {
  if (fs.existsSync(DEFAULT_AGENTS_TEMPLATE_PATH)) {
    return fs.readFileSync(DEFAULT_AGENTS_TEMPLATE_PATH, 'utf8');
  }
  return JSON.stringify({ agents: [] }, null, 2) + '\n';
}

function pickBootstrapAgent(agentsConfig) {
  if (!agentsConfig || !Array.isArray(agentsConfig.agents)) return null;
  const preferred = agentsConfig.agents.find((agent) =>
    typeof agent.role === 'string' && agent.role.toLowerCase().includes('architect')
  );
  return preferred || agentsConfig.agents[0] || null;
}

function buildPrompt(metadata) {
  return [
    '# SYSTEM PROMPT: AI ARCHITECT BOOTSTRAPPER',
    '',
    'You are an expert Software Architect and DevOps Engineer.',
    'Your goal is to configure an AI Agent System for a SPECIFIC existing project.',
    '',
    '## INPUT CONTEXT',
    'You will receive:',
    '1) A directory tree of the project.',
    '2) Contents of key config files (package.json, README, etc.).',
    '',
    '## YOUR TASK',
    'Analyze the input and generate THREE JSON objects.',
    '',
    '### 1) Context Configuration (ai/context.json)',
    '- fullFiles: critical logic, entry points, schema, auth. Limit to 20-30 files.',
    '- lightFiles: high-level docs.',
    '- exclude: build folders, huge assets.',
    '',
    '### 2) Architecture Summary (ai/llms.md)',
    '- Stack (Language, Framework, DB).',
    '- Key patterns (MVC, Clean Arch).',
    '- Folder structure explanation.',
    '',
    '### 3) Cursor Rules (.cursorrules)',
    '- Naming conventions.',
    '- Preferred libraries (detected from package.json).',
    '- Pitfalls to avoid.',
    '',
    '## OUTPUT FORMAT',
    'Return strictly a JSON object:',
    '{',
    '  "contextConfig": { ... },',
    '  "llmsFileContent": "...",',
    '  "cursorRulesContent": "...",',
    '  "claudeFileContent": "..."',
    '}',
    '',
    '---',
    '# PROJECT METADATA',
    metadata,
  ].join('\n');
}

async function callAnthropic(agent, userContent) {
  const response = await fetch(agent.apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': agent.key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: agent.model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const content = Array.isArray(data.content) ? data.content : [];
  return content.map((item) => item.text).join('\n').trim();
}

async function callOpenAI(agent, userContent) {
  const usesCompletionTokens = String(agent.model || '').startsWith('o1') || String(agent.model || '').startsWith('gpt-5');
  const body = {
    model: agent.model,
    messages: [{ role: 'user', content: userContent }],
  };
  if (usesCompletionTokens) {
    body.max_completion_tokens = 8192;
  } else {
    body.max_tokens = 8192;
  }

  const response = await fetch(agent.apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${agent.key}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callGoogle(agent, userContent) {
  const url = agent.apiUrl.includes('key=') ? agent.apiUrl : `${agent.apiUrl}?key=${encodeURIComponent(agent.key)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
  const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
    ? candidate.content.parts
    : [];
  return parts.map((part) => part.text).join('\n').trim();
}

async function callProvider(agent, userContent) {
  if (agent.apiUrl.includes('anthropic.com')) {
    return callAnthropic(agent, userContent);
  }
  if (agent.apiUrl.includes('openai.com')) {
    return callOpenAI(agent, userContent);
  }
  if (agent.apiUrl.includes('googleapis.com')) {
    return callGoogle(agent, userContent);
  }
  throw new Error(`Unsupported API URL: ${agent.apiUrl}`);
}

function buildMetadata(treeLines, keyFiles) {
  const parts = ['## DIRECTORY TREE', '```', ...treeLines, '```', ''];
  keyFiles.forEach((file) => {
    parts.push(`## FILE: ${file.path}`);
    parts.push('```');
    parts.push(file.content);
    parts.push('```');
    parts.push('');
  });
  return parts.join('\n');
}

function writeOutput(filePath, content, force, rootDir = process.cwd()) {
  const fullPath = path.join(rootDir, filePath);
  if (fs.existsSync(fullPath) && !force) {
    return { status: 'skipped', reason: 'exists' };
  }
  if (fs.existsSync(fullPath) && force) {
    const backupPath = `${fullPath}.bak-${Date.now()}`;
    fs.copyFileSync(fullPath, backupPath);
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return { status: 'written' };
}

function parseBootstrapResponse(text) {
  const trimmed = text.trim().replace(/```json/g, '').replace(/```/g, '');
  try {
    const json = JSON.parse(trimmed);
    return { success: true, json };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function validateBootstrapPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be an object.');
    return { valid: false, errors };
  }
  if (!payload.contextConfig || typeof payload.contextConfig !== 'object') {
    errors.push('contextConfig must be an object.');
  } else {
    if (!Array.isArray(payload.contextConfig.fullFiles)) {
      errors.push('contextConfig.fullFiles must be an array.');
    }
    if (!Array.isArray(payload.contextConfig.lightFiles)) {
      errors.push('contextConfig.lightFiles must be an array.');
    }
  }
  if (payload.llmsFileContent && typeof payload.llmsFileContent !== 'string') {
    errors.push('llmsFileContent must be a string.');
  }
  if (payload.stackProfile && typeof payload.stackProfile !== 'object') {
    errors.push('stackProfile must be an object if provided.');
  }
  if (payload.cursorRulesContent && typeof payload.cursorRulesContent !== 'string') {
    errors.push('cursorRulesContent must be a string.');
  }
  if (payload.claudeFileContent && typeof payload.claudeFileContent !== 'string') {
    errors.push('claudeFileContent must be a string.');
  }
  return { valid: errors.length === 0, errors };
}

function archiveInit(timestamp, data, dryRun, archiveDir) {
  if (dryRun) return;
  fs.mkdirSync(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, `init-${timestamp}.json`);
  fs.writeFileSync(archivePath, JSON.stringify(data, null, 2));
  console.log(`📦 Init archive saved: ${archivePath}`);
}

function scaffoldRuntimeLayout(layout, dryRun) {
  if (dryRun || !layout) return;
  const runtimeDirs = [
    layout.runtimeRoot,
    layout.logsDir,
    layout.promptsDir,
    layout.metricsDir,
    layout.archiveDir,
    path.join(layout.promptsDir, 'run'),
  ];
  runtimeDirs.forEach((dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
  });
}

// ============ AUDIT MODE ============
function runAudit(treeFiles, projectType, rootDir = process.cwd()) {
  console.log('\n🔍 ===== AUDIT MODE =====\n');
  console.log(`📦 Detected project type: ${projectType}`);
  console.log(`📊 Total files scanned: ${treeFiles.length}`);

  // Group files by directory
  const dirCounts = {};
  treeFiles.forEach(file => {
    const dir = path.dirname(file);
    const topDir = dir.split('/')[0] || '(root)';
    dirCounts[topDir] = (dirCounts[topDir] || 0) + 1;
  });

  // Sort by count
  const sortedDirs = Object.entries(dirCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log('\n📁 Top directories by file count:');
  sortedDirs.forEach(([dir, count]) => {
    console.log(`   ${dir}: ${count} files`);
  });

  // Check what's in existing context
  const contextPath = path.join(rootDir, 'ai/context.json');
  let includedFiles = [];
  if (fs.existsSync(contextPath)) {
    try {
      const ctx = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
      includedFiles = ctx.fullFiles || [];
      console.log(`\n✅ Currently included in context.json: ${includedFiles.length} files`);
      includedFiles.slice(0, 10).forEach(f => console.log(`   - ${f}`));
      if (includedFiles.length > 10) {
        console.log(`   ... and ${includedFiles.length - 10} more`);
      }
    } catch (e) {
      console.log('\n⚠️ Could not parse existing ai/context.json');
    }
  } else {
    console.log('\n⚠️ No ai/context.json found');
  }

  // Suggest patterns based on project type
  const patterns = PROJECT_PATTERNS[projectType] || PROJECT_PATTERNS.generic;
  console.log(`\n💡 Recommended patterns for ${projectType}:`);
  console.log('   Full context:');
  patterns.fullFiles.forEach(p => console.log(`     - ${p}`));
  console.log('   Light context:');
  patterns.lightFiles.forEach(p => console.log(`     - ${p}`));

  // Check for large directories not in context
  const includedDirs = new Set(includedFiles.map(f => f.split('/')[0]));
  const missedLargeDirs = sortedDirs
    .filter(([dir, count]) => count > 5 && !includedDirs.has(dir))
    .filter(([dir]) => !EXCLUDE_DIRS.has(dir) && !dir.startsWith('.'));

  if (missedLargeDirs.length > 0) {
    console.log('\n⚠️ Large directories NOT in context:');
    missedLargeDirs.forEach(([dir, count]) => {
      console.log(`   - ${dir}/ (${count} files)`);
    });
    console.log('\n   Consider adding them to ai/context.json fullFiles');
  }

  // File type breakdown
  const extCounts = {};
  treeFiles.forEach(file => {
    const ext = path.extname(file) || '(no extension)';
    extCounts[ext] = (extCounts[ext] || 0) + 1;
  });

  const sortedExts = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\n📄 File types breakdown:');
  sortedExts.forEach(([ext, count]) => {
    console.log(`   ${ext}: ${count}`);
  });

  console.log('\n========================\n');
  console.log('To add more files, edit ai/context.json or run:');
  console.log('  npm run undes:init --force');
  console.log('');
}

async function main(optionsOrArgv = process.argv, env = process.env, baseCwd = process.cwd()) {
  const input = normalizeMainInput(optionsOrArgv, env, baseCwd);
  const runtimeEnv = input.env && typeof input.env === 'object' ? input.env : process.env;
  const projectRoot = input.projectPath || process.cwd();
  const projectLayout = resolveProjectLayout(projectRoot);
  const flags = parseFlags(input.argv, runtimeEnv);
  const aiEnvPath = path.join(projectRoot, '.ai.env');
  const agentsConfigPath = projectLayout.agentsConfigPath;
  const archiveDir = projectLayout.archiveDir;

  loadAiEnv(aiEnvPath, runtimeEnv);

  const treeFiles = scanTree(projectRoot, flags.depth, flags.maxFiles);
  const treeLines = treeFiles.slice(0, flags.maxFiles);
  const keyFiles = collectKeyFiles(treeFiles, projectRoot, flags.maxBytes);
  let stackOverrides = collectStackOverridesFromFlags(flags);
  let stackProfile = detectProjectStack({
    treeFiles,
    keyFiles,
    detectedAt: new Date().toISOString(),
    overrides: stackOverrides,
  });
  if (!flags.audit) {
    stackOverrides = await promptForBootstrapOverridesIfNeeded(stackProfile, flags, stackOverrides);
    if (hasDeclaredStackOverrides(stackOverrides)) {
      stackProfile = detectProjectStack({
        treeFiles,
        keyFiles,
        detectedAt: stackProfile.detectedAt,
        overrides: stackOverrides,
      });
    }
  }
  const projectType = deriveProjectTypeFromStackProfile(stackProfile);

  // Audit mode: analyze and exit
  if (flags.audit) {
    runAudit(treeFiles, projectType, projectRoot);
    return;
  }

  if (flags.sync) {
    const syncPlan = buildScaffoldSyncPlan(projectRoot, projectLayout, { includeMergeAware: true });
    const summary = [];
    if (flags.dryRun) {
      console.log('🧪 Dry run: scaffold sync plan only.');
      syncPlan.syncable.forEach((item) => {
        summary.push(`${item.path}: would update (${item.policy})`);
      });
    } else {
      const updated = applyScaffoldSyncPlan(projectRoot, syncPlan, {
        mode: 'full-sync',
        backupMergeAware: true,
      });
      if (updated.length === 0) {
        summary.push('No scaffold drift detected.');
      } else {
        updated.forEach((filePath) => summary.push(`${filePath}: updated`));
      }
    }
    console.log('✅ Scaffold sync summary:');
    summary.forEach((line) => console.log(`- ${line}`));
    if (syncPlan.issues.length > 0) {
      console.log('\nℹ️ Additional observations:');
      syncPlan.issues.forEach((issue) => console.log(`- ${issue.message}`));
    }
    return;
  }
  const metadata = buildMetadata(treeLines, keyFiles);

  const agentsConfig = loadAgentsConfig(agentsConfigPath) || loadAgentsConfig(DEFAULT_AGENTS_TEMPLATE_PATH);
  const bootstrapAgent = pickBootstrapAgent(agentsConfig);

  let generatedConfig = null;
  let rawResponse = '';
  let validationErrors = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (bootstrapAgent) {
    const apiKey = runtimeEnv[bootstrapAgent.key];
    if (!apiKey) {
      console.log('ℹ️ Missing API key for bootstrap agent. Falling back to templates.');
    } else {
      const agent = { ...bootstrapAgent, key: apiKey };
      const prompt = buildPrompt(metadata);
      console.log(`🤖 Bootstrap agent: ${agent.name} (${agent.model})`);
      rawResponse = await callProvider(agent, prompt);
      const parsed = parseBootstrapResponse(rawResponse);
      if (parsed.success) {
        const validation = validateBootstrapPayload(parsed.json);
        if (validation.valid) {
          generatedConfig = parsed.json;
        } else {
          validationErrors = validation.errors;
          console.warn(`⚠️ Invalid bootstrap payload: ${validation.errors.join(' ')}`);
        }
      } else {
        console.warn(`⚠️ Failed to parse JSON response: ${parsed.error}`);
      }
    }
  }

  const fallbackContext = buildDefaultContext(treeFiles, projectType);
  const normalizedContext = normalizeContextConfig(generatedConfig?.contextConfig, fallbackContext);
  const contextConfig = injectBootstrapArtifacts(normalizedContext.context, projectLayout);
  normalizedContext.warnings.forEach((warning) => {
    console.warn(`⚠️ ${warning}`);
  });
  if (hasWeakStackSignals(stackProfile) && !hasDeclaredStackOverrides(stackOverrides)) {
    console.warn('⚠️ Stack detection has weak signals. Re-run `npm run undes:init -- --language=... --framework=...` or answer the bootstrap questionnaire in an interactive terminal.');
  }
  const llmsContent = buildLlmsSummary(stackProfile) || generatedConfig?.llmsFileContent || buildDefaultLlms(projectType);
  const cursorRulesContent =
    generatedConfig?.cursorRulesContent || buildDefaultCursorRules(projectType);
  const claudeContent =
    generatedConfig?.claudeFileContent || buildDefaultClaudeGuide(projectType);
  const agentsTemplate = loadDefaultAgentsTemplate();
  const runtimeStackProfilePath = path.posix.join(projectLayout.runtimeDirName.replace(/\\/g, '/'), 'stack-profile.json');

  const outputs = {
    'ai/context.json': JSON.stringify(contextConfig, null, 2) + '\n',
    'ai/agents.json': agentsTemplate.trim() + '\n',
    'ai/llms.md': llmsContent.trim() + '\n',
    [runtimeStackProfilePath]: JSON.stringify(stackProfile, null, 2) + '\n',
    '.cursorrules': cursorRulesContent.trim() + '\n',
    'CLAUDE.md': claudeContent.trim() + '\n',
  };

  archiveInit(timestamp, {
    timestamp,
    projectType,
    stackProfile,
    stackOverrides,
    treeFiles: treeLines,
    keyFiles: keyFiles.map((file) => file.path),
    bootstrapAgent: bootstrapAgent ? { name: bootstrapAgent.name, model: bootstrapAgent.model } : null,
    rawResponse: rawResponse ? redactSecrets(rawResponse) : '',
    validationErrors,
  }, flags.dryRun, archiveDir);

  scaffoldRuntimeLayout(projectLayout, flags.dryRun);

  if (flags.dryRun) {
    console.log('🧪 Dry run: generated files not written.');
  }

  const summary = [];
  for (const [filePath, content] of Object.entries(outputs)) {
    if (flags.dryRun) {
      summary.push(`${filePath}: preview (${content.length} chars)`);
      continue;
    }
    const result = writeOutput(filePath, content, flags.force, projectRoot);
    summary.push(`${filePath}: ${result.status}`);
  }

  if (!flags.force) {
    const skipped = summary.filter((line) => line.includes('skipped'));
    if (skipped.length && !flags.yes) {
      console.log('⚠️ Some files already exist. Re-run with --force to overwrite.');
    }
  }

  console.log('✅ Init summary:');
  summary.forEach((line) => console.log(`- ${line}`));
  console.log('\nℹ️ Bootstrap writes active config files directly. Use --dry-run to preview or --force to overwrite.');
}

if (require.main === module) {
  enforceDispatcherGuard({
    useCommand: 'npm run undes:init -- [--dry-run] [--force]',
  });
  main().catch((error) => {
    console.error('❌ init-project failed.');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  detectProjectType,
  normalizeContextConfig,
  redactSecrets,
  injectBootstrapArtifacts,
  parseFlags,
  normalizeMainInput,
  parseBootstrapResponse,
  validateBootstrapPayload,
  main,
};
