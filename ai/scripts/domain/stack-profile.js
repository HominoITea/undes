'use strict';

const FRAMEWORK_SIGNATURES = new Map([
  ['next', 'nextjs'],
  ['@nestjs/core', 'nestjs'],
  ['express', 'express'],
  ['fastify', 'fastify'],
  ['koa', 'koa'],
  ['react', 'react'],
  ['vue', 'vue'],
  ['nuxt', 'nuxt'],
  ['@remix-run/node', 'remix'],
  ['@remix-run/react', 'remix'],
  ['@sveltejs/kit', 'sveltekit'],
  ['svelte', 'svelte'],
  ['hono', 'hono'],
  ['django', 'django'],
  ['fastapi', 'fastapi'],
  ['flask', 'flask'],
  ['starlette', 'starlette'],
  ['spring-boot', 'spring-boot'],
  ['org.springframework.boot', 'spring-boot'],
  ['quarkus', 'quarkus'],
  ['micronaut', 'micronaut'],
  ['Microsoft.NET.Sdk.Web', 'aspnet'],
  ['Microsoft.AspNetCore.App', 'aspnet'],
  ['Microsoft.AspNetCore', 'aspnet'],
  ['Blazor', 'blazor'],
  ['github.com/gin-gonic/gin', 'gin'],
  ['github.com/labstack/echo', 'echo'],
  ['github.com/gofiber/fiber', 'fiber'],
  ['actix-web', 'actix'],
  ['axum', 'axum'],
  ['rocket', 'rocket'],
]);

const DATABASE_SIGNATURES = new Map([
  ['pg', 'postgresql'],
  ['postgres', 'postgresql'],
  ['postgresql', 'postgresql'],
  ['typeorm', 'sql'],
  ['prisma', 'sql'],
  ['mysql', 'mysql'],
  ['mysql2', 'mysql'],
  ['sqlite', 'sqlite'],
  ['sqlite3', 'sqlite'],
  ['mongoose', 'mongodb'],
  ['mongodb', 'mongodb'],
  ['redis', 'redis'],
  ['sqlalchemy', 'sql'],
  ['psycopg', 'postgresql'],
  ['psycopg2', 'postgresql'],
  ['gorm.io/driver/postgres', 'postgresql'],
  ['gorm.io/driver/mysql', 'mysql'],
  ['Npgsql', 'postgresql'],
]);

const TEST_SIGNATURES = new Map([
  ['jest', 'jest'],
  ['vitest', 'vitest'],
  ['mocha', 'mocha'],
  ['cypress', 'cypress'],
  ['playwright', 'playwright'],
  ['pytest', 'pytest'],
  ['unittest', 'unittest'],
  ['xunit', 'xunit'],
  ['nunit', 'nunit'],
  ['Microsoft.NET.Test.Sdk', 'dotnet-test'],
  ['go test', 'go-test'],
  ['cargo test', 'cargo-test'],
]);

const CI_SIGNATURES = [
  { file: '.github/workflows', id: 'github-actions' },
  { file: '.gitlab-ci.yml', id: 'gitlab-ci' },
  { file: 'azure-pipelines.yml', id: 'azure-pipelines' },
  { file: 'Jenkinsfile', id: 'jenkins' },
];

const TOPOLOGY_MARKERS = new Map([
  ['pnpm-workspace.yaml', 'pnpm-workspace'],
  ['turbo.json', 'turbo'],
  ['nx.json', 'nx'],
  ['lerna.json', 'lerna'],
]);

const TRUST_MANIFEST = 'manifest-derived';
const TRUST_FILE = 'file-presence';
const TRUST_USER = 'user-declared';

function findKeyFile(keyFiles, targetPath) {
  return (keyFiles || []).find((file) => file && file.path === targetPath) || null;
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeEvidence(evidence) {
  return [...new Set((evidence || []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsSignature(content, signature) {
  const pattern = new RegExp(`(^|[^A-Za-z0-9_./@-])${escapeRegExp(signature)}($|[^A-Za-z0-9_./@-])`, 'mi');
  return pattern.test(String(content || ''));
}

function createDetection(id, confidence, evidence, trust = TRUST_MANIFEST) {
  if (!id) return null;
  return {
    id,
    confidence,
    evidence: normalizeEvidence(evidence),
    trust,
  };
}

function sortDetections(detections) {
  return [...detections].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return String(a.id).localeCompare(String(b.id));
  });
}

function trustRank(trust) {
  if (trust === TRUST_USER) return 3;
  if (trust === TRUST_MANIFEST) return 2;
  if (trust === TRUST_FILE) return 1;
  return 0;
}

function addDetection(map, id, confidence, evidence, trust = TRUST_MANIFEST) {
  if (!id) return;
  const normalizedEvidence = normalizeEvidence(evidence);
  const existing = map.get(id);
  if (!existing) {
    map.set(id, createDetection(id, confidence, normalizedEvidence, trust));
    return;
  }

  existing.confidence = Math.max(existing.confidence, confidence);
  existing.evidence = normalizeEvidence([...existing.evidence, ...normalizedEvidence]);
  if (trustRank(trust) > trustRank(existing.trust)) {
    existing.trust = trust;
  }
}

function fileExists(treeFiles, targetPath) {
  return (treeFiles || []).includes(targetPath);
}

function hasExtension(treeFiles, exts) {
  return (treeFiles || []).some((file) => exts.some((ext) => file.endsWith(ext)));
}

function collectPackageDependencies(packageJson) {
  if (!packageJson || !packageJson.content) return {};
  const parsed = safeParseJson(packageJson.content);
  if (!parsed) return {};
  return {
    ...(parsed.dependencies || {}),
    ...(parsed.devDependencies || {}),
    ...(parsed.peerDependencies || {}),
    ...(parsed.optionalDependencies || {}),
  };
}

function splitCsvValues(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeScopePath(filePath) {
  const match = String(filePath || '').match(/^(packages|apps|services|libs)\/([^/]+)/);
  return match ? `${match[1]}/${match[2]}` : '';
}

function filterTreeFilesByScope(treeFiles, scopePath) {
  const prefix = `${scopePath}/`;
  return (treeFiles || [])
    .filter((file) => file === scopePath || file.startsWith(prefix))
    .map((file) => (file === scopePath ? '' : file.slice(prefix.length)))
    .filter(Boolean);
}

function filterKeyFilesByScope(keyFiles, scopePath) {
  const prefix = `${scopePath}/`;
  return (keyFiles || [])
    .filter((file) => file && file.path && file.path.startsWith(prefix))
    .map((file) => ({ ...file, path: file.path.slice(prefix.length) }));
}

function detectLanguages(treeFiles, keyFiles) {
  const out = new Map();
  const packageJson = findKeyFile(keyFiles, 'package.json');

  if (packageJson) {
    const evidence = ['package.json'];
    if (fileExists(treeFiles, 'tsconfig.json') || hasExtension(treeFiles, ['.ts', '.tsx'])) {
      addDetection(
        out,
        'typescript',
        0.98,
        [...evidence, fileExists(treeFiles, 'tsconfig.json') ? 'tsconfig.json' : '.ts/.tsx files'],
        TRUST_MANIFEST,
      );
    } else if (hasExtension(treeFiles, ['.js', '.jsx', '.mjs', '.cjs'])) {
      addDetection(out, 'javascript', 0.96, [...evidence, '.js/.jsx files'], TRUST_MANIFEST);
    }
  }

  if (fileExists(treeFiles, 'pyproject.toml') || fileExists(treeFiles, 'requirements.txt') || hasExtension(treeFiles, ['.py'])) {
    const evidence = [];
    if (fileExists(treeFiles, 'pyproject.toml')) evidence.push('pyproject.toml');
    if (fileExists(treeFiles, 'requirements.txt')) evidence.push('requirements.txt');
    if (hasExtension(treeFiles, ['.py'])) evidence.push('.py files');
    addDetection(
      out,
      'python',
      fileExists(treeFiles, 'pyproject.toml') || fileExists(treeFiles, 'requirements.txt') ? 0.97 : 0.75,
      evidence,
      fileExists(treeFiles, 'pyproject.toml') || fileExists(treeFiles, 'requirements.txt') ? TRUST_MANIFEST : TRUST_FILE,
    );
  }

  if (hasExtension(treeFiles, ['.cs']) || (treeFiles || []).some((file) => file.endsWith('.csproj'))) {
    const evidence = [];
    if ((treeFiles || []).some((file) => file.endsWith('.csproj'))) evidence.push('.csproj');
    if (hasExtension(treeFiles, ['.cs'])) evidence.push('.cs files');
    addDetection(
      out,
      'csharp',
      evidence.includes('.csproj') ? 0.98 : 0.78,
      evidence,
      evidence.includes('.csproj') ? TRUST_MANIFEST : TRUST_FILE,
    );
  }

  if (fileExists(treeFiles, 'go.mod') || hasExtension(treeFiles, ['.go'])) {
    const evidence = [];
    if (fileExists(treeFiles, 'go.mod')) evidence.push('go.mod');
    if (hasExtension(treeFiles, ['.go'])) evidence.push('.go files');
    addDetection(out, 'go', fileExists(treeFiles, 'go.mod') ? 0.98 : 0.78, evidence, fileExists(treeFiles, 'go.mod') ? TRUST_MANIFEST : TRUST_FILE);
  }

  if (fileExists(treeFiles, 'Cargo.toml') || hasExtension(treeFiles, ['.rs'])) {
    const evidence = [];
    if (fileExists(treeFiles, 'Cargo.toml')) evidence.push('Cargo.toml');
    if (hasExtension(treeFiles, ['.rs'])) evidence.push('.rs files');
    addDetection(out, 'rust', fileExists(treeFiles, 'Cargo.toml') ? 0.98 : 0.78, evidence, fileExists(treeFiles, 'Cargo.toml') ? TRUST_MANIFEST : TRUST_FILE);
  }

  if (
    fileExists(treeFiles, 'pom.xml')
    || fileExists(treeFiles, 'build.gradle')
    || fileExists(treeFiles, 'build.gradle.kts')
    || hasExtension(treeFiles, ['.java'])
  ) {
    const evidence = [];
    if (fileExists(treeFiles, 'pom.xml')) evidence.push('pom.xml');
    if (fileExists(treeFiles, 'build.gradle')) evidence.push('build.gradle');
    if (fileExists(treeFiles, 'build.gradle.kts')) evidence.push('build.gradle.kts');
    if (hasExtension(treeFiles, ['.java'])) evidence.push('.java files');
    addDetection(
      out,
      'java',
      evidence.some((item) => item.endsWith('.xml') || item.endsWith('.gradle') || item.endsWith('.kts')) ? 0.97 : 0.76,
      evidence,
      evidence.some((item) => item.endsWith('.xml') || item.endsWith('.gradle') || item.endsWith('.kts')) ? TRUST_MANIFEST : TRUST_FILE,
    );
  }

  if (hasExtension(treeFiles, ['.kt', '.kts'])) {
    const evidence = ['.kt/.kts files'];
    if (fileExists(treeFiles, 'build.gradle.kts')) evidence.push('build.gradle.kts');
    addDetection(out, 'kotlin', fileExists(treeFiles, 'build.gradle.kts') ? 0.9 : 0.72, evidence, fileExists(treeFiles, 'build.gradle.kts') ? TRUST_MANIFEST : TRUST_FILE);
  }

  if (fileExists(treeFiles, 'composer.json') || hasExtension(treeFiles, ['.php'])) {
    const evidence = [];
    if (fileExists(treeFiles, 'composer.json')) evidence.push('composer.json');
    if (hasExtension(treeFiles, ['.php'])) evidence.push('.php files');
    addDetection(out, 'php', fileExists(treeFiles, 'composer.json') ? 0.96 : 0.72, evidence, fileExists(treeFiles, 'composer.json') ? TRUST_MANIFEST : TRUST_FILE);
  }

  if (fileExists(treeFiles, 'Gemfile') || hasExtension(treeFiles, ['.rb'])) {
    const evidence = [];
    if (fileExists(treeFiles, 'Gemfile')) evidence.push('Gemfile');
    if (hasExtension(treeFiles, ['.rb'])) evidence.push('.rb files');
    addDetection(out, 'ruby', fileExists(treeFiles, 'Gemfile') ? 0.96 : 0.72, evidence, fileExists(treeFiles, 'Gemfile') ? TRUST_MANIFEST : TRUST_FILE);
  }

  return sortDetections([...out.values()]);
}

function detectManifestMatches(keyFiles, signatureMap, confidence) {
  const out = new Map();
  for (const file of keyFiles || []) {
    const content = String(file?.content || '');
    for (const [signature, result] of signatureMap.entries()) {
      if (containsSignature(content, signature)) {
        addDetection(out, result, confidence, [`${file.path}:${signature}`], TRUST_MANIFEST);
      }
    }
  }
  return out;
}

function detectCategorizedMatches(treeFiles, keyFiles) {
  const packageJson = findKeyFile(keyFiles, 'package.json');
  const packageDeps = collectPackageDependencies(packageJson);
  const frameworks = new Map();
  const databases = new Map();
  const testFrameworks = new Map();

  for (const depName of Object.keys(packageDeps)) {
    if (FRAMEWORK_SIGNATURES.has(depName)) {
      addDetection(frameworks, FRAMEWORK_SIGNATURES.get(depName), 0.95, [`package.json:${depName}`], TRUST_MANIFEST);
    }
    if (DATABASE_SIGNATURES.has(depName)) {
      addDetection(databases, DATABASE_SIGNATURES.get(depName), 0.8, [`package.json:${depName}`], TRUST_MANIFEST);
    }
    if (TEST_SIGNATURES.has(depName)) {
      addDetection(testFrameworks, TEST_SIGNATURES.get(depName), 0.8, [`package.json:${depName}`], TRUST_MANIFEST);
    }
  }

  const manifestFiles = (keyFiles || []).filter((file) => file && file.path !== 'package.json');
  const frameworkMatches = detectManifestMatches(manifestFiles, FRAMEWORK_SIGNATURES, 0.9);
  const databaseMatches = detectManifestMatches(manifestFiles, DATABASE_SIGNATURES, 0.78);
  const testMatches = detectManifestMatches(manifestFiles, TEST_SIGNATURES, 0.78);

  for (const entry of frameworkMatches.values()) addDetection(frameworks, entry.id, entry.confidence, entry.evidence, entry.trust);
  for (const entry of databaseMatches.values()) addDetection(databases, entry.id, entry.confidence, entry.evidence, entry.trust);
  for (const entry of testMatches.values()) addDetection(testFrameworks, entry.id, entry.confidence, entry.evidence, entry.trust);

  if (fileExists(treeFiles, 'convex/schema.ts') || fileExists(treeFiles, 'convex/_generated/api.d.ts')) {
    addDetection(frameworks, 'convex', 0.96, ['convex/schema.ts or convex generated api'], TRUST_FILE);
  }

  return {
    frameworks: sortDetections([...frameworks.values()]),
    databases: sortDetections([...databases.values()]),
    testFrameworks: sortDetections([...testFrameworks.values()]),
  };
}

function detectRuntime(languages, frameworks) {
  const frameworkIds = new Set((frameworks || []).map((item) => item.id));
  const languageIds = new Set((languages || []).map((item) => item.id));

  const nodeFrameworks = new Set([
    'nextjs',
    'nestjs',
    'express',
    'fastify',
    'koa',
    'react',
    'vue',
    'nuxt',
    'remix',
    'sveltekit',
    'hono',
    'convex',
  ]);

  const nodeEvidence = [...frameworkIds].filter((id) => nodeFrameworks.has(id));
  if (nodeEvidence.length) {
    return createDetection('node', 0.95, nodeEvidence, TRUST_MANIFEST);
  }
  if (languageIds.has('python')) return createDetection('python', 0.92, ['python language'], TRUST_FILE);
  if (languageIds.has('csharp')) return createDetection('dotnet', 0.92, ['csharp language'], TRUST_FILE);
  if (languageIds.has('go')) return createDetection('go', 0.92, ['go language'], TRUST_FILE);
  if (languageIds.has('rust')) return createDetection('rust', 0.92, ['rust language'], TRUST_FILE);
  if (languageIds.has('java') || languageIds.has('kotlin')) {
    return createDetection('jvm', 0.88, ['java/kotlin language'], TRUST_FILE);
  }
  if (languageIds.has('php')) return createDetection('php', 0.88, ['php language'], TRUST_FILE);
  if (languageIds.has('ruby')) return createDetection('ruby', 0.88, ['ruby language'], TRUST_FILE);
  if (languageIds.has('typescript') || languageIds.has('javascript')) {
    return createDetection('node', 0.85, ['package.json'], TRUST_MANIFEST);
  }
  return null;
}

function detectPackageManager(treeFiles) {
  if (fileExists(treeFiles, 'pnpm-lock.yaml')) return createDetection('pnpm', 0.99, ['pnpm-lock.yaml'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'yarn.lock')) return createDetection('yarn', 0.99, ['yarn.lock'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'package-lock.json')) return createDetection('npm', 0.99, ['package-lock.json'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'bun.lockb')) return createDetection('bun', 0.99, ['bun.lockb'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'poetry.lock')) return createDetection('poetry', 0.95, ['poetry.lock'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'uv.lock')) return createDetection('uv', 0.95, ['uv.lock'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'Pipfile.lock')) return createDetection('pipenv', 0.95, ['Pipfile.lock'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'Cargo.lock')) return createDetection('cargo', 0.95, ['Cargo.lock'], TRUST_MANIFEST);
  if (fileExists(treeFiles, 'go.mod')) return createDetection('go-mod', 0.9, ['go.mod'], TRUST_MANIFEST);
  return null;
}

function detectTopology(treeFiles, keyFiles) {
  const packageJson = findKeyFile(keyFiles, 'package.json');
  const parsedPackageJson = packageJson ? safeParseJson(packageJson.content) : null;
  const evidence = [];
  let topologyId = 'single-package';
  let confidence = 0.72;
  let trust = TRUST_FILE;

  for (const [marker, markerId] of TOPOLOGY_MARKERS.entries()) {
    if (fileExists(treeFiles, marker)) {
      topologyId = 'monorepo';
      confidence = 0.95;
      trust = TRUST_MANIFEST;
      evidence.push(markerId);
    }
  }

  if (Array.isArray(parsedPackageJson?.workspaces) && parsedPackageJson.workspaces.length > 0) {
    topologyId = 'monorepo';
    confidence = Math.max(confidence, 0.95);
    trust = TRUST_MANIFEST;
    evidence.push('package.json:workspaces');
  }

  const packageManifests = (treeFiles || []).filter((file) =>
    /^(packages|apps|services|libs)\//.test(file) && /package\.json$/.test(file)
  );
  if (packageManifests.length > 1) {
    topologyId = 'monorepo';
    confidence = Math.max(confidence, 0.85);
    evidence.push('nested package.json manifests');
  }

  return createDetection(topologyId, confidence, evidence.length ? evidence : ['single root manifest'], trust);
}

function detectCi(treeFiles) {
  for (const marker of CI_SIGNATURES) {
    if ((treeFiles || []).some((file) => file === marker.file || file.startsWith(`${marker.file}/`))) {
      return createDetection(marker.id, 0.9, [marker.file], TRUST_MANIFEST);
    }
  }
  return null;
}

function detectStackFacts(treeFiles, keyFiles) {
  const languages = detectLanguages(treeFiles, keyFiles);
  const { frameworks, databases, testFrameworks } = detectCategorizedMatches(treeFiles, keyFiles);
  const runtime = detectRuntime(languages, frameworks);
  const packageManager = detectPackageManager(treeFiles);
  const topology = detectTopology(treeFiles, keyFiles);
  const cicd = detectCi(treeFiles);

  return {
    languages,
    frameworks,
    databases,
    testFrameworks,
    runtime,
    packageManager,
    topology,
    cicd,
  };
}

function buildScopeDetection(scopePath, scopeFacts) {
  const evidence = normalizeEvidence([
    ...scopeFacts.languages.flatMap((entry) => entry.evidence),
    ...scopeFacts.frameworks.flatMap((entry) => entry.evidence),
    ...scopeFacts.databases.flatMap((entry) => entry.evidence),
    ...scopeFacts.testFrameworks.flatMap((entry) => entry.evidence),
    ...(scopeFacts.packageManager ? scopeFacts.packageManager.evidence : []),
  ]).slice(0, 10);
  const strongestDetection =
    scopeFacts.frameworks[0]
    || scopeFacts.languages[0]
    || scopeFacts.databases[0]
    || scopeFacts.testFrameworks[0]
    || scopeFacts.runtime
    || scopeFacts.packageManager;

  return {
    path: scopePath,
    confidence: strongestDetection?.confidence || 0.72,
    trust: strongestDetection?.trust || TRUST_FILE,
    evidence,
    languages: scopeFacts.languages,
    frameworks: scopeFacts.frameworks,
    runtime: scopeFacts.runtime,
    packageManager: scopeFacts.packageManager,
    databases: scopeFacts.databases,
    testFrameworks: scopeFacts.testFrameworks,
  };
}

function detectScopes(treeFiles, keyFiles, topology) {
  if (!topology || topology.id !== 'monorepo') return [];

  const scopePaths = new Set();
  for (const file of treeFiles || []) {
    const scopePath = normalizeScopePath(file);
    if (scopePath) scopePaths.add(scopePath);
  }

  return [...scopePaths]
    .sort((a, b) => a.localeCompare(b))
    .map((scopePath) => {
      const scopeTreeFiles = filterTreeFilesByScope(treeFiles, scopePath);
      const scopeKeyFiles = filterKeyFilesByScope(keyFiles, scopePath);
      return buildScopeDetection(scopePath, detectStackFacts(scopeTreeFiles, scopeKeyFiles));
    });
}

function applyUserStackOverrides(stackProfile, overrides = {}) {
  const next = {
    ...stackProfile,
    languages: [...(stackProfile.languages || [])],
    frameworks: [...(stackProfile.frameworks || [])],
    databases: [...(stackProfile.databases || [])],
  };

  const languageMap = new Map(next.languages.map((entry) => [entry.id, entry]));
  splitCsvValues(overrides.language).forEach((id) => {
    addDetection(languageMap, id, 0.99, ['flag:--language'], TRUST_USER);
  });
  next.languages = sortDetections([...languageMap.values()]);

  const frameworkMap = new Map(next.frameworks.map((entry) => [entry.id, entry]));
  splitCsvValues(overrides.framework).forEach((id) => {
    addDetection(frameworkMap, id, 0.99, ['flag:--framework'], TRUST_USER);
  });
  next.frameworks = sortDetections([...frameworkMap.values()]);

  const databaseMap = new Map(next.databases.map((entry) => [entry.id, entry]));
  splitCsvValues(overrides.database).forEach((id) => {
    addDetection(databaseMap, id, 0.99, ['flag:--database'], TRUST_USER);
  });
  next.databases = sortDetections([...databaseMap.values()]);

  if (overrides.runtime) {
    next.runtime = createDetection(String(overrides.runtime).trim(), 0.99, ['flag:--runtime'], TRUST_USER);
  }
  if (overrides.packageManager) {
    next.packageManager = createDetection(String(overrides.packageManager).trim(), 0.99, ['flag:--package-manager'], TRUST_USER);
  }
  if (overrides.topology) {
    next.topology = createDetection(String(overrides.topology).trim(), 0.99, ['flag:--topology'], TRUST_USER);
  }

  return next;
}

function detectProjectStack(options = {}) {
  const {
    treeFiles = [],
    keyFiles = [],
    detectedAt = new Date().toISOString(),
    overrides = {},
  } = options;

  const facts = detectStackFacts(treeFiles, keyFiles);
  const profile = applyUserStackOverrides({
    version: 1,
    detectedAt,
    languages: facts.languages,
    frameworks: facts.frameworks,
    runtime: facts.runtime,
    packageManager: facts.packageManager,
    topology: facts.topology,
    databases: facts.databases,
    testFrameworks: facts.testFrameworks,
    cicd: facts.cicd,
    scopes: [],
  }, overrides);

  profile.scopes = detectScopes(treeFiles, keyFiles, profile.topology);
  return profile;
}

function deriveProjectTypeFromStackProfile(stackProfile) {
  const frameworkIds = new Set((stackProfile?.frameworks || []).map((entry) => entry.id));
  const languageIds = new Set((stackProfile?.languages || []).map((entry) => entry.id));
  const runtimeId = stackProfile?.runtime?.id || '';

  if (frameworkIds.has('nextjs')) return 'nextjs';
  if (frameworkIds.has('nuxt')) return 'nuxt';
  if (frameworkIds.has('remix')) return 'remix';
  if (frameworkIds.has('svelte') || frameworkIds.has('sveltekit')) return 'svelte';
  if (frameworkIds.has('vue')) return 'vue';
  if (frameworkIds.has('react')) return 'react';
  if (frameworkIds.has('convex')) return 'convex';
  if (frameworkIds.has('express') || frameworkIds.has('fastify') || frameworkIds.has('koa') || frameworkIds.has('nestjs') || frameworkIds.has('hono')) {
    return 'node-backend';
  }
  if (languageIds.has('csharp')) return 'dotnet';
  if (languageIds.has('python')) return 'python';
  if (languageIds.has('go')) return 'go';
  if (languageIds.has('rust')) return 'rust';
  if (languageIds.has('kotlin')) return 'kotlin';
  if (languageIds.has('java')) return 'java';
  if (runtimeId === 'node' || languageIds.has('typescript') || languageIds.has('javascript')) return 'node';
  return 'generic';
}

function hasWeakStackSignals(stackProfile) {
  return !(stackProfile.languages?.length || stackProfile.frameworks?.length || stackProfile.runtime);
}

function buildLlmsSummary(stackProfile) {
  const listIds = (detections) => (detections || []).map((item) => item.id);
  const languages = listIds(stackProfile.languages);
  const frameworks = listIds(stackProfile.frameworks);
  const databases = listIds(stackProfile.databases);
  const tests = listIds(stackProfile.testFrameworks);

  const lines = [
    '# Project Architecture & Stack',
    '',
    `Auto-generated from runtime stack profile at \`${stackProfile.detectedAt}\`.`,
    '',
    'Source of truth: `.ai/stack-profile.json`',
    'This file is a human-readable derived summary.',
    '',
    '## Tech Stack',
    `- Languages: ${languages.length ? languages.join(', ') : 'not confidently detected'}`,
    `- Frameworks: ${frameworks.length ? frameworks.join(', ') : 'none confidently detected'}`,
    `- Runtime: ${stackProfile.runtime?.id || 'not confidently detected'}`,
    `- Package Manager: ${stackProfile.packageManager?.id || 'not confidently detected'}`,
    `- Topology: ${stackProfile.topology?.id || 'single-package'}`,
    `- Database: ${databases.length ? databases.join(', ') : 'not confidently detected'}`,
    `- Test Stack: ${tests.length ? tests.join(', ') : 'not confidently detected'}`,
  ];

  if (stackProfile.cicd?.id) {
    lines.push(`- CI/CD: ${stackProfile.cicd.id}`);
  }

  if (hasWeakStackSignals(stackProfile)) {
    lines.push('- Detection Status: weak signals, supplement with user-declared bootstrap answers');
  }

  lines.push('', '## Detection Notes');
  lines.push('- Treat this file as a summary, not as the canonical machine-readable artifact.');
  lines.push('- If stack detection looks incomplete, refresh the project index or update manifests.');
  lines.push('- Trust labels in `.ai/stack-profile.json` distinguish manifest-derived, file-presence, and user-declared facts.');

  if (stackProfile.scopes?.length) {
    lines.push('', '## Detected Scopes');
    stackProfile.scopes.slice(0, 8).forEach((scope) => {
      const scopeFrameworks = (scope.frameworks || []).map((entry) => entry.id).join(', ') || 'no framework detected';
      const scopeLanguages = (scope.languages || []).map((entry) => entry.id).join(', ') || 'no language detected';
      lines.push(`- \`${scope.path}\` (${scopeLanguages}; ${scopeFrameworks})`);
    });
  }

  lines.push('', '## Required Follow-up');
  lines.push('- Add project-specific architecture rules, invariants, and domain terminology.');
  lines.push('- Keep `.ai/stack-profile.json` and manifests aligned as the project evolves.');

  return lines.join('\n');
}

module.exports = {
  detectProjectStack,
  deriveProjectTypeFromStackProfile,
  buildLlmsSummary,
  hasWeakStackSignals,
};
