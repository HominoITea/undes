const fs = require('fs');
const path = require('path');

const DEFAULT_FORBIDDEN_PATHS = [
  {
    relativePath: path.join('docs', 'commercialization'),
    reason: 'internal commercialization planning must be moved to a private planning surface before public release',
  },
  {
    relativePath: 'commercial-addons-local',
    reason: 'local scratch area for paid add-on experiments must not be included in a public release',
  },
];

const DEFAULT_REQUIRED_PATHS = [
  {
    relativePath: 'LICENSE',
    reason: 'public OSS release must include an explicit license file',
  },
  {
    relativePath: 'THIRD_PARTY_NOTICES.md',
    reason: 'public OSS release must include bundled third-party license notices',
  },
  {
    relativePath: path.join('config', 'public-export-manifest.json'),
    reason: 'public export must be driven by the machine-readable allowlist manifest',
  },
];

function parseArgs(argv = process.argv) {
  const args = argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) {
      options[arg.slice(2)] = true;
      continue;
    }
    options[arg.slice(2, eq)] = arg.slice(eq + 1);
  }

  return options;
}

function getRepoRoot(options = {}) {
  const root = options.root ? path.resolve(options.root) : path.resolve(__dirname, '..', '..');
  return fs.realpathSync(root);
}

function findForbiddenPaths(repoRoot, forbiddenPaths = DEFAULT_FORBIDDEN_PATHS) {
  const hits = [];

  for (const entry of forbiddenPaths) {
    const absolutePath = path.join(repoRoot, entry.relativePath);
    if (!fs.existsSync(absolutePath)) continue;

    hits.push({
      relativePath: entry.relativePath,
      absolutePath,
      reason: entry.reason,
    });
  }

  return hits;
}

function findMissingRequiredPaths(repoRoot, requiredPaths = DEFAULT_REQUIRED_PATHS) {
  const missing = [];

  for (const entry of requiredPaths) {
    const absolutePath = path.join(repoRoot, entry.relativePath);
    if (fs.existsSync(absolutePath)) continue;

    missing.push({
      relativePath: entry.relativePath,
      absolutePath,
      reason: entry.reason,
    });
  }

  return missing;
}

function formatFailureMessage(repoRoot, hits, missingRequired = []) {
  const lines = [
    '❌ Public release check failed.',
    `Repository root: ${repoRoot}`,
  ];

  if (missingRequired.length > 0) {
    lines.push('');
    lines.push('Required release artifacts are missing:');

    for (const entry of missingRequired) {
      lines.push(`- ${entry.relativePath}`);
      lines.push(`  reason: ${entry.reason}`);
    }
  }

  if (hits.length > 0) {
    lines.push('');
    lines.push('Forbidden paths still exist in this release package:');

    for (const hit of hits) {
      lines.push(`- ${hit.relativePath}`);
      lines.push(`  reason: ${hit.reason}`);
    }
  }

  lines.push('');
  lines.push('Move or exclude these materials before making the repository public.');
  return lines.join('\n');
}

function main(argv = process.argv) {
  const options = parseArgs(argv);
  const repoRoot = getRepoRoot(options);
  const hits = findForbiddenPaths(repoRoot);
  const missingRequired = findMissingRequiredPaths(repoRoot);

  if (hits.length > 0 || missingRequired.length > 0) {
    console.error(formatFailureMessage(repoRoot, hits, missingRequired));
    process.exitCode = 1;
    return { ok: false, repoRoot, hits, missingRequired };
  }

  console.log(`✅ Public release check passed.\nRepository root: ${repoRoot}`);
  return { ok: true, repoRoot, hits: [], missingRequired: [] };
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_FORBIDDEN_PATHS,
  DEFAULT_REQUIRED_PATHS,
  parseArgs,
  getRepoRoot,
  findForbiddenPaths,
  findMissingRequiredPaths,
  formatFailureMessage,
  main,
};
