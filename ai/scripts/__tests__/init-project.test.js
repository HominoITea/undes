const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  detectProjectType,
  normalizeContextConfig,
  redactSecrets,
  injectBootstrapArtifacts,
  main: initMain,
  parseBootstrapResponse,
  validateBootstrapPayload,
} = require('../init-project');
const { resolveProjectLayout } = require('../path-utils');
const { detectProjectStack, buildLlmsSummary } = require('../domain/stack-profile');

const SCRIPT_PATH = path.join(__dirname, '..', 'init-project.js');
const TMP_BASE = path.join(__dirname, '..', '..', '..', '.tmp-test-work');

function mkTmpDir(prefix) {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(TMP_BASE, prefix));
}

function runInit(projectRoot, args = []) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      _AI_DISPATCHER_RESOLVED: '1',
    },
  });
}

test('detectProjectType: detects nextjs from package dependencies', () => {
  const files = ['package.json', 'app/page.tsx'];
  const packageJson = {
    content: JSON.stringify({ dependencies: { next: '14.1.0', react: '18.2.0' } }),
  };
  assert.equal(detectProjectType(files, packageJson), 'nextjs');
});

test('detectProjectType: detects python without package.json', () => {
  const files = ['pyproject.toml', 'src/main.py'];
  assert.equal(detectProjectType(files, null), 'python');
});

test('normalizeContextConfig: applies fallback and emits warnings for invalid raw config', () => {
  const fallback = {
    fullFiles: ['README.md', 'package.json'],
    lightFiles: ['README.md'],
    exclude: 'find . -maxdepth 2 -type f',
  };

  const result = normalizeContextConfig(
    {
      fullFiles: 'not-array',
      lightFiles: [],
      exclude: 123,
    },
    fallback,
  );

  assert.deepEqual(result.context.fullFiles, fallback.fullFiles);
  assert.deepEqual(result.context.lightFiles, fallback.lightFiles);
  assert.equal(result.context.exclude, fallback.exclude);
  assert.ok(result.warnings.length >= 3);
});

test('redactSecrets: redacts env vars, json secrets and known key patterns', () => {
  const raw = [
    'API_KEY=super-secret',
    '{"token":"abc123"}',
    'openai=sk-abcdefghijklmnopqrstuvwxyz1234',
    'google=AIza12345678901234567890123456789012345',
  ].join('\n');

  const redacted = redactSecrets(raw);
  assert.ok(!redacted.includes('super-secret'));
  assert.ok(!redacted.includes('abc123'));
  assert.ok(!redacted.includes('sk-abcdefghijklmnopqrstuvwxyz1234'));
  assert.ok(!redacted.includes('AIza12345678901234567890123456789012345'));
  assert.ok(redacted.includes('[REDACTED]'));
});

test('parseBootstrapResponse: parses fenced json payload', () => {
  const payload = '{"contextConfig":{"fullFiles":[],"lightFiles":[]}}';
  const parsed = parseBootstrapResponse(`\n\`\`\`json\n${payload}\n\`\`\`\n`);
  assert.equal(parsed.success, true);
  assert.equal(typeof parsed.json, 'object');
  assert.ok(parsed.json.contextConfig);
});

test('parseBootstrapResponse: returns failure for invalid json', () => {
  const parsed = parseBootstrapResponse('not-json');
  assert.equal(parsed.success, false);
  assert.equal(typeof parsed.error, 'string');
  assert.ok(parsed.error.length > 0);
});

test('validateBootstrapPayload: accepts valid payload', () => {
  const validation = validateBootstrapPayload({
    contextConfig: {
      fullFiles: ['README.md'],
      lightFiles: ['README.md'],
    },
    llmsFileContent: 'ok',
    cursorRulesContent: 'ok',
    claudeFileContent: 'ok',
  });
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test('detectProjectStack: detects nextjs stack and package manager from manifests', () => {
  const treeFiles = ['package.json', 'tsconfig.json', 'pnpm-lock.yaml', 'app/page.tsx', '.github/workflows/ci.yml'];
  const keyFiles = [
    {
      path: 'package.json',
      content: JSON.stringify({
        dependencies: {
          next: '15.0.0',
          react: '19.0.0',
          pg: '8.0.0',
        },
        devDependencies: {
          jest: '30.0.0',
        },
      }),
    },
  ];

  const profile = detectProjectStack({ treeFiles, keyFiles, detectedAt: '2026-03-21T00:00:00.000Z' });
  assert.equal(profile.runtime.id, 'node');
  assert.equal(profile.packageManager.id, 'pnpm');
  assert.equal(profile.cicd.id, 'github-actions');
  assert.ok(profile.languages.some((entry) => entry.id === 'typescript'));
  assert.ok(profile.frameworks.some((entry) => entry.id === 'nextjs'));
  assert.ok(profile.databases.some((entry) => entry.id === 'postgresql'));
  assert.ok(profile.testFrameworks.some((entry) => entry.id === 'jest'));
});

test('detectProjectStack: detects dotnet stack from csproj', () => {
  const treeFiles = ['src/App/App.csproj', 'src/App/Program.cs'];
  const keyFiles = [
    {
      path: 'src/App/App.csproj',
      content: [
        '<Project Sdk="Microsoft.NET.Sdk.Web">',
        '  <ItemGroup>',
        '    <PackageReference Include="Npgsql" Version="8.0.0" />',
        '    <PackageReference Include="xunit" Version="2.0.0" />',
        '  </ItemGroup>',
        '</Project>',
      ].join('\n'),
    },
  ];

  const profile = detectProjectStack({ treeFiles, keyFiles, detectedAt: '2026-03-21T00:00:00.000Z' });
  assert.equal(profile.runtime.id, 'dotnet');
  assert.ok(profile.languages.some((entry) => entry.id === 'csharp'));
  assert.ok(profile.frameworks.some((entry) => entry.id === 'aspnet'));
  assert.ok(profile.databases.some((entry) => entry.id === 'postgresql'));
  assert.ok(profile.testFrameworks.some((entry) => entry.id === 'xunit'));
});

test('detectProjectStack: detects python fastapi stack from pyproject', () => {
  const treeFiles = ['pyproject.toml', 'src/main.py', 'uv.lock'];
  const keyFiles = [
    {
      path: 'pyproject.toml',
      content: [
        '[project]',
        'name = "api"',
        'dependencies = ["fastapi", "sqlalchemy", "pytest"]',
      ].join('\n'),
    },
  ];

  const profile = detectProjectStack({ treeFiles, keyFiles, detectedAt: '2026-03-21T00:00:00.000Z' });
  assert.equal(profile.runtime.id, 'python');
  assert.equal(profile.packageManager.id, 'uv');
  assert.ok(profile.languages.some((entry) => entry.id === 'python'));
  assert.ok(profile.frameworks.some((entry) => entry.id === 'fastapi'));
  assert.ok(profile.databases.some((entry) => entry.id === 'sql'));
  assert.ok(profile.testFrameworks.some((entry) => entry.id === 'pytest'));
});

test('detectProjectStack: detects go gin stack from go.mod', () => {
  const treeFiles = ['go.mod', 'cmd/api/main.go'];
  const keyFiles = [
    {
      path: 'go.mod',
      content: [
        'module example.com/api',
        '',
        'require (',
        '  github.com/gin-gonic/gin v1.10.0',
        '  gorm.io/driver/postgres v1.5.0',
        ')',
      ].join('\n'),
    },
  ];

  const profile = detectProjectStack({ treeFiles, keyFiles, detectedAt: '2026-03-21T00:00:00.000Z' });
  assert.equal(profile.runtime.id, 'go');
  assert.equal(profile.packageManager.id, 'go-mod');
  assert.ok(profile.languages.some((entry) => entry.id === 'go'));
  assert.ok(profile.frameworks.some((entry) => entry.id === 'gin'));
  assert.ok(profile.databases.some((entry) => entry.id === 'postgresql'));
});

test('detectProjectStack: detects rust axum stack from cargo manifest', () => {
  const treeFiles = ['Cargo.toml', 'src/main.rs', 'Cargo.lock'];
  const keyFiles = [
    {
      path: 'Cargo.toml',
      content: [
        '[package]',
        'name = "svc"',
        '',
        '[dependencies]',
        'axum = "0.8"',
        'sqlx = "0.8"',
      ].join('\n'),
    },
  ];

  const profile = detectProjectStack({ treeFiles, keyFiles, detectedAt: '2026-03-21T00:00:00.000Z' });
  assert.equal(profile.runtime.id, 'rust');
  assert.equal(profile.packageManager.id, 'cargo');
  assert.ok(profile.languages.some((entry) => entry.id === 'rust'));
  assert.ok(profile.frameworks.some((entry) => entry.id === 'axum'));
});

test('detectProjectStack: detects java spring stack from pom.xml', () => {
  const treeFiles = ['pom.xml', 'src/main/java/com/example/App.java'];
  const keyFiles = [
    {
      path: 'pom.xml',
      content: [
        '<project>',
        '  <dependencies>',
        '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>',
        '    <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId></dependency>',
        '  </dependencies>',
        '</project>',
      ].join('\n'),
    },
  ];

  const profile = detectProjectStack({ treeFiles, keyFiles, detectedAt: '2026-03-21T00:00:00.000Z' });
  assert.equal(profile.runtime.id, 'jvm');
  assert.ok(profile.languages.some((entry) => entry.id === 'java'));
  assert.ok(profile.frameworks.some((entry) => entry.id === 'spring-boot'));
  assert.ok(profile.databases.some((entry) => entry.id === 'postgresql'));
});

test('detectProjectStack: applies user-declared overrides for empty projects', () => {
  const profile = detectProjectStack({
    treeFiles: [],
    keyFiles: [],
    detectedAt: '2026-03-21T00:00:00.000Z',
    overrides: {
      language: 'typescript',
      framework: 'react',
      runtime: 'node',
      database: 'postgresql',
      packageManager: 'pnpm',
      topology: 'single-package',
    },
  });

  assert.equal(profile.runtime.id, 'node');
  assert.equal(profile.runtime.trust, 'user-declared');
  assert.equal(profile.packageManager.id, 'pnpm');
  assert.equal(profile.topology.trust, 'user-declared');
  assert.ok(profile.languages.some((entry) => entry.id === 'typescript' && entry.trust === 'user-declared'));
  assert.ok(profile.frameworks.some((entry) => entry.id === 'react' && entry.trust === 'user-declared'));
  assert.ok(profile.databases.some((entry) => entry.id === 'postgresql' && entry.trust === 'user-declared'));
});

test('detectProjectStack: builds per-scope stack facts for monorepo manifests', () => {
  const treeFiles = [
    'package.json',
    'pnpm-workspace.yaml',
    'pnpm-lock.yaml',
    'apps/web/package.json',
    'apps/web/app/page.tsx',
    'services/api/package.json',
    'services/api/src/main.ts',
  ];
  const keyFiles = [
    {
      path: 'package.json',
      content: JSON.stringify({ private: true, workspaces: ['apps/*', 'services/*'] }),
    },
    {
      path: 'apps/web/package.json',
      content: JSON.stringify({
        dependencies: { next: '15.0.0', react: '19.0.0' },
      }),
    },
    {
      path: 'services/api/package.json',
      content: JSON.stringify({
        dependencies: { '@nestjs/core': '11.0.0', pg: '8.0.0' },
        devDependencies: { jest: '30.0.0' },
      }),
    },
  ];

  const profile = detectProjectStack({ treeFiles, keyFiles, detectedAt: '2026-03-21T00:00:00.000Z' });
  assert.equal(profile.topology.id, 'monorepo');
  assert.equal(profile.packageManager.id, 'pnpm');
  assert.equal(profile.scopes.length, 2);

  const webScope = profile.scopes.find((scope) => scope.path === 'apps/web');
  const apiScope = profile.scopes.find((scope) => scope.path === 'services/api');

  assert.ok(webScope);
  assert.ok(apiScope);
  assert.ok(webScope.frameworks.some((entry) => entry.id === 'nextjs'));
  assert.ok(apiScope.frameworks.some((entry) => entry.id === 'nestjs'));
  assert.ok(apiScope.databases.some((entry) => entry.id === 'postgresql'));
  assert.ok(apiScope.testFrameworks.some((entry) => entry.id === 'jest'));
});

test('buildLlmsSummary: marks stack profile as source of truth', () => {
  const markdown = buildLlmsSummary({
    detectedAt: '2026-03-21T00:00:00.000Z',
    languages: [{ id: 'typescript', confidence: 0.98, evidence: ['package.json'] }],
    frameworks: [{ id: 'nestjs', confidence: 0.9, evidence: ['package.json:@nestjs/core'] }],
    runtime: { id: 'node', confidence: 0.95, evidence: ['package.json'] },
    packageManager: { id: 'pnpm', confidence: 0.99, evidence: ['pnpm-lock.yaml'] },
    topology: { id: 'single-package', confidence: 0.75, evidence: ['package.json'] },
    databases: [],
    testFrameworks: [],
    scopes: [],
  });

  assert.match(markdown, /Source of truth: `\.ai\/stack-profile\.json`/);
  assert.match(markdown, /Frameworks: nestjs/);
});

test('injectBootstrapArtifacts: adds llms and stack-profile paths to context config', () => {
  const layout = {
    runtimeDirName: '.ai',
  };
  const context = injectBootstrapArtifacts(
    { fullFiles: ['README.md'], lightFiles: ['README.md'], exclude: 'find .' },
    layout,
  );

  assert.ok(context.fullFiles.includes('ai/llms.md'));
  assert.ok(context.fullFiles.includes('.ai/stack-profile.json'));
  assert.ok(context.lightFiles.includes('.ai/stack-profile.json'));
});

test('validateBootstrapPayload: rejects invalid payload shape', () => {
  const validation = validateBootstrapPayload({
    contextConfig: {
      fullFiles: 'bad',
      lightFiles: null,
    },
    llmsFileContent: 123,
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 2);
});

test('init-project --dry-run does not write output files', () => {
  const project = mkTmpDir('init-dry-run-');
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'tmp', version: '1.0.0' }));

  const run = runInit(project, ['--dry-run']);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(fs.existsSync(path.join(project, 'ai', 'context.json')), false);
  assert.equal(fs.existsSync(path.join(project, 'ai', 'agents.json')), false);
  assert.equal(fs.existsSync(path.join(project, 'ai', 'llms.md')), false);
  assert.equal(fs.existsSync(path.join(project, '.ai', 'stack-profile.json')), false);
  assert.equal(fs.existsSync(path.join(project, '.cursorrules')), false);
  assert.equal(fs.existsSync(path.join(project, 'CLAUDE.md')), false);
});

test('init-project --force overwrites existing files and creates backup', () => {
  const project = mkTmpDir('init-force-');
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'tmp', version: '1.0.0' }));
  fs.mkdirSync(path.join(project, 'ai'), { recursive: true });
  fs.writeFileSync(path.join(project, 'ai', 'context.json'), '{"old":true}\n');

  const run = runInit(project, ['--force']);
  assert.equal(run.status, 0, run.stderr);

  const contextPath = path.join(project, 'ai', 'context.json');
  const contextRaw = fs.readFileSync(contextPath, 'utf8');
  assert.ok(!contextRaw.includes('"old":true'));

  const aiFiles = fs.readdirSync(path.join(project, 'ai'));
  const backup = aiFiles.find((name) => /^context\.json\.bak-/.test(name));
  assert.ok(backup, 'Expected backup file for ai/context.json');
});

test('init-project scaffolds split-root runtime layout for a brand-new project', () => {
  const project = mkTmpDir('init-split-root-');
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'tmp', version: '1.0.0' }));

  const run = runInit(project, []);
  assert.equal(run.status, 0, run.stderr);

  const layout = resolveProjectLayout(project);
  assert.equal(layout.layoutMode, 'split-root');
  assert.equal(fs.existsSync(path.join(project, 'ai', 'context.json')), true);
  assert.equal(fs.existsSync(path.join(project, 'ai', 'agents.json')), true);
  assert.equal(fs.existsSync(path.join(project, 'ai', 'llms.md')), true);
  assert.equal(fs.existsSync(path.join(project, '.ai', 'stack-profile.json')), true);
  assert.equal(fs.existsSync(layout.runtimeRoot), true);
  assert.equal(fs.existsSync(layout.logsDir), true);
  assert.equal(fs.existsSync(layout.promptsDir), true);
  assert.equal(fs.existsSync(layout.metricsDir), true);
  assert.equal(fs.existsSync(layout.runsDir), true);

  const agentsConfig = JSON.parse(fs.readFileSync(path.join(project, 'ai', 'agents.json'), 'utf8'));
  assert.equal(Array.isArray(agentsConfig.agents), true);

  const archivedEntries = fs.readdirSync(layout.runsDir);
  assert.ok(archivedEntries.some((name) => /^init-.*\.json$/.test(name)));

  const stackProfile = JSON.parse(fs.readFileSync(path.join(project, '.ai', 'stack-profile.json'), 'utf8'));
  assert.equal(stackProfile.version, 1);
  assert.ok(Array.isArray(stackProfile.languages));

  const contextConfig = JSON.parse(fs.readFileSync(path.join(project, 'ai', 'context.json'), 'utf8'));
  assert.ok(contextConfig.fullFiles.includes('.ai/stack-profile.json'));
});

test('init-project main: accepts unified options object contract', async () => {
  const project = mkTmpDir('init-main-options-');
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'tmp', version: '1.0.0' }));

  await assert.doesNotReject(async () => {
    await initMain({
      argv: ['node', 'init-project.js', '--dry-run'],
      env: {
        ...process.env,
        _AI_DISPATCHER_RESOLVED: '1',
      },
      projectPath: project,
      hubRoot: project,
    });
  });

  assert.equal(fs.existsSync(path.join(project, 'ai', 'context.json')), false);
  assert.equal(fs.existsSync(path.join(project, 'ai', 'agents.json')), false);
  assert.equal(fs.existsSync(path.join(project, 'ai', 'llms.md')), false);
  assert.equal(fs.existsSync(path.join(project, '.ai', 'stack-profile.json')), false);
  assert.equal(fs.existsSync(path.join(project, '.cursorrules')), false);
  assert.equal(fs.existsSync(path.join(project, 'CLAUDE.md')), false);
});

test('init-project: writes user-declared stack profile for empty projects via CLI flags', () => {
  const project = mkTmpDir('init-empty-stack-');

  const run = runInit(project, [
    '--yes',
    '--language=typescript',
    '--framework=react',
    '--runtime=node',
    '--database=postgresql',
    '--package-manager=pnpm',
  ]);
  assert.equal(run.status, 0, run.stderr);

  const stackProfile = JSON.parse(fs.readFileSync(path.join(project, '.ai', 'stack-profile.json'), 'utf8'));
  assert.ok(stackProfile.languages.some((entry) => entry.id === 'typescript' && entry.trust === 'user-declared'));
  assert.ok(stackProfile.frameworks.some((entry) => entry.id === 'react' && entry.trust === 'user-declared'));
  assert.equal(stackProfile.runtime.id, 'node');
  assert.equal(stackProfile.packageManager.id, 'pnpm');

  const llms = fs.readFileSync(path.join(project, 'ai', 'llms.md'), 'utf8');
  assert.match(llms, /Frameworks: react/);
});
