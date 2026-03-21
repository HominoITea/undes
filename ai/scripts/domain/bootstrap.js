/**
 * domain/bootstrap.js — bootstrap helpers: CLI arg reading, project path resolution,
 * layout validation, path resolution, state factories and resets.
 * Extracted from generate-context.js (Batch 11, Slice D).
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ── CLI arg reading ────────────────────────────────────────────────

/**
 * @param {string} prefix — e.g. '--hub-root='
 * @param {string[]} bootArgs — CLI args (typically process.argv.slice(2))
 */
function readBootstrapArg(prefix, bootArgs) {
  const hit = bootArgs.find((arg) => arg.startsWith(prefix));
  if (!hit) return '';
  return hit.slice(prefix.length).trim();
}

// ── Project path resolution ────────────────────────────────────────

/**
 * @param {string} hubRootPath
 * @param {object} deps
 * @param {string} deps.initialCwd
 * @param {function} deps.resolveHubFileForRead
 */
function resolveAutoProjectPathFromRegistry(hubRootPath, { initialCwd, resolveHubFileForRead }) {
  try {
    if (!hubRootPath || !fs.existsSync(hubRootPath) || !fs.statSync(hubRootPath).isDirectory()) {
      return '';
    }

    const hubReal = fs.realpathSync(hubRootPath);
    const cwdReal = fs.realpathSync(initialCwd);
    if (hubReal !== cwdReal) return '';

    const registryPath = resolveHubFileForRead(hubReal, 'projects.json');
    if (!registryPath) return '';

    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
    const candidates = projects
      .filter((p) => p && p.status !== 'archived' && p.path)
      .filter((p) => fs.existsSync(p.path) && fs.statSync(p.path).isDirectory())
      .sort((a, b) => String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')));

    if (!candidates.length) return '';
    return String(candidates[0].path || '').trim();
  } catch {
    return '';
  }
}

/**
 * @param {string} hubRootPath
 * @param {object} deps
 * @param {string} deps.initialCwd
 * @param {function} deps.resolveHubFileForRead
 */
function resolveProjectPathFromHubConfig(hubRootPath, { initialCwd, resolveHubFileForRead }) {
  try {
    if (!hubRootPath || !fs.existsSync(hubRootPath) || !fs.statSync(hubRootPath).isDirectory()) {
      return '';
    }

    const hubReal = fs.realpathSync(hubRootPath);
    const cwdReal = fs.realpathSync(initialCwd);
    if (hubReal !== cwdReal) return '';

    const configPath = resolveHubFileForRead(hubReal, 'hub-config.json');
    if (!configPath) return '';

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const activePath = String(parsed?.activeProjectPath || '').trim();
    if (!activePath) return '';

    const resolved = path.resolve(activePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return '';
    }
    return resolved;
  } catch {
    return '';
  }
}

// ── Layout validation ──────────────────────────────────────────────

/**
 * @param {object} deps
 * @param {string} deps.aiDataDir
 * @param {string} deps.aiSourceDir
 * @param {string} deps.projectRoot
 */
function validateProjectLayout({ aiDataDir, aiSourceDir, projectRoot }) {
  if (!fs.existsSync(aiDataDir)) {
    console.error(`❌ AI data directory not found: ${aiDataDir}`);
    console.error(`   Run: npm run ai:doctor -- --project-path="${projectRoot}"`);
    process.exit(1);
  }
  const requiredFiles = ['context.json'];
  for (const file of requiredFiles) {
    const filePath = path.join(aiSourceDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Required file missing: ${filePath}`);
      console.error(`   Run: npm run ai:doctor -- --project-path="${projectRoot}"`);
      process.exit(1);
    }
  }
}

// ── Path resolution ────────────────────────────────────────────────

/**
 * @param {string} filePath
 * @param {object} options
 * @param {string} projectRoot
 * @param {string} hubRoot
 * @param {function} resolveReadablePathWithFallbacks — from config-loader
 */
function resolveReadablePath(filePath, options, { projectRoot, hubRoot, resolveReadablePathWithFallbacks }) {
  return resolveReadablePathWithFallbacks(filePath, {
    projectRoot,
    hubRoot,
    ...options,
  });
}

// ── State factories ────────────────────────────────────────────────

function createEvidenceGroundingState() {
  return {
    readFiles: new Set(),
    contextFiles: new Set(),
  };
}

function createAutoOutputBudgetState() {
  return {
    lastApplied: new Map(),
  };
}

// ── State resets ───────────────────────────────────────────────────

/**
 * @param {object} operationalSignals — mutable state ref
 * @param {function} createOperationalSignalsState — factory from operational-signals
 */
function resetOperationalSignals(operationalSignals, createOperationalSignalsState) {
  Object.assign(operationalSignals, createOperationalSignalsState());
}

/**
 * @param {object} evidenceGroundingState — mutable state ref
 */
function resetEvidenceGroundingState(evidenceGroundingState) {
  evidenceGroundingState.readFiles = new Set();
  evidenceGroundingState.contextFiles = new Set();
}

/**
 * @param {object} autoOutputBudgetState — mutable state ref
 */
function resetAutoOutputBudgetState(autoOutputBudgetState) {
  autoOutputBudgetState.lastApplied = new Map();
}

// ── Project-relative path normalization ────────────────────────────

/**
 * @param {string} filePath
 * @param {string} projectRoot
 * @param {function} normalizeTrustProjectRelativeFilePath — from final-result-trust
 */
function normalizeProjectRelativeFilePath(filePath, projectRoot, normalizeTrustProjectRelativeFilePath) {
  return normalizeTrustProjectRelativeFilePath(filePath, projectRoot);
}

module.exports = {
  readBootstrapArg,
  resolveAutoProjectPathFromRegistry,
  resolveProjectPathFromHubConfig,
  validateProjectLayout,
  resolveReadablePath,
  createEvidenceGroundingState,
  createAutoOutputBudgetState,
  resetOperationalSignals,
  resetEvidenceGroundingState,
  resetAutoOutputBudgetState,
  normalizeProjectRelativeFilePath,
};
