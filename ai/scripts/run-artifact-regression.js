const fs = require('fs');
const path = require('path');

const { buildRunArtifactSummary } = require('./run-artifact-summary');

function readJsonFile(filePath = '') {
  const resolved = String(filePath || '').trim();
  if (!resolved) throw new Error('Manifest path is required.');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function getValueAtPath(source, dottedPath = '') {
  const pathParts = String(dottedPath || '').split('.').map((part) => part.trim()).filter(Boolean);
  let current = source;
  for (const part of pathParts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function flattenExpectationEntries(expectation, prefix = '') {
  const out = [];
  if (!expectation || typeof expectation !== 'object' || Array.isArray(expectation)) {
    return out;
  }

  for (const [key, value] of Object.entries(expectation)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...flattenExpectationEntries(value, nextPath));
      continue;
    }
    out.push([nextPath, value]);
  }

  return out;
}

function compareValues(actual, expected, operator = 'eq') {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    default:
      throw new Error(`Unsupported comparison operator: ${operator}`);
  }
}

function evaluateCaseExpectations(summary, expectation = {}) {
  return flattenExpectationEntries(expectation).map(([pathKey, expected]) => {
    const actual = getValueAtPath(summary, pathKey);
    const passed = Array.isArray(expected)
      ? JSON.stringify(actual) === JSON.stringify(expected)
      : actual === expected;
    return {
      path: pathKey,
      expected,
      actual,
      passed,
    };
  });
}

function evaluateComparisons(indexedCases = {}, comparisons = []) {
  return comparisons.map((comparison) => {
    const leftSummary = indexedCases[comparison.left];
    const rightSummary = indexedCases[comparison.right];
    const leftValue = getValueAtPath(leftSummary, comparison.path);
    const rightValue = getValueAtPath(rightSummary, comparison.path);
    const passed = compareValues(leftValue, rightValue, comparison.operator || 'eq');
    return {
      id: comparison.id || `${comparison.left}-${comparison.operator || 'eq'}-${comparison.right}-${comparison.path}`,
      left: comparison.left,
      right: comparison.right,
      path: comparison.path,
      operator: comparison.operator || 'eq',
      leftValue,
      rightValue,
      passed,
    };
  });
}

function buildRegressionReport(manifestPath = '') {
  const resolvedManifestPath = path.resolve(String(manifestPath || '').trim());
  const manifestDir = path.dirname(resolvedManifestPath);
  const manifest = readJsonFile(resolvedManifestPath);
  const indexedCases = {};

  const activeCases = (manifest.cases || []).filter((c) => c.status !== 'pending');
  const cases = activeCases.map((testCase) => {
    const runDir = path.resolve(manifestDir, String(testCase.runDir || '').trim());
    const resultWarningPath = testCase.resultWarningPath
      ? path.resolve(manifestDir, String(testCase.resultWarningPath || '').trim())
      : '';
    const runFlowPath = testCase.runFlowPath
      ? path.resolve(manifestDir, String(testCase.runFlowPath || '').trim())
      : '';
    const summary = buildRunArtifactSummary({
      runDir,
      resultWarningPath,
      runFlowPath,
    });
    const checks = evaluateCaseExpectations(summary, testCase.expect || {});
    indexedCases[testCase.id] = summary;
    return {
      id: testCase.id,
      label: testCase.label || testCase.id,
      runDir,
      summary,
      checks,
      passed: checks.every((check) => check.passed),
    };
  });

  const comparisons = evaluateComparisons(indexedCases, manifest.comparisons || []);
  const passed = cases.every((testCase) => testCase.passed)
    && comparisons.every((comparison) => comparison.passed);

  return {
    manifestPath: resolvedManifestPath,
    passed,
    cases,
    comparisons,
  };
}

function parseArgs(argv = []) {
  const args = {
    manifestPath: path.join(__dirname, '__tests__', 'fixtures', 'run-artifacts', 'golden-manifest.json'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--manifest=')) args.manifestPath = arg.slice('--manifest='.length).trim();
  }

  return args;
}

function main(input = process.argv.slice(2)) {
  const args = parseArgs(input);
  const report = buildRegressionReport(args.manifestPath);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.passed ? 0 : 1;
  return report;
}

if (require.main === module) {
  main();
}

module.exports = {
  readJsonFile,
  getValueAtPath,
  flattenExpectationEntries,
  compareValues,
  evaluateCaseExpectations,
  evaluateComparisons,
  buildRegressionReport,
  parseArgs,
  main,
};
