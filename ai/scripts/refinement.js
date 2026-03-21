'use strict';

const fs = require('fs');
const path = require('path');
const { isSameOrSubPath } = require('./path-utils');

function findLatestRunFromBase(baseDir) {
  if (!fs.existsSync(baseDir)) return null;
  const entries = fs.readdirSync(baseDir).filter(name => {
    const fullPath = path.join(baseDir, name);
    return name.startsWith('run-') && fs.statSync(fullPath).isDirectory();
  });

  if (!entries.length) return null;
  entries.sort((a, b) => b.localeCompare(a));

  for (const entry of entries) {
    const flowPath = path.join(baseDir, entry, 'run-flow.json');
    if (!fs.existsSync(flowPath)) continue;
    try {
      const flow = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
      if (flow && flow.version === 1 && flow.runId) {
        flow._archiveDir = path.join(baseDir, entry);
        return flow;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Find the most recent completed run in the canonical runs directory.
 * Falls back to legacy archive/ and finally to the active run directory.
 */
function loadLatestArchivedRun(aiDataDir) {
  const runsBase = path.join(aiDataDir, 'prompts', 'runs');
  const legacyArchiveBase = path.join(aiDataDir, 'prompts', 'archive');

  const fromRuns = findLatestRunFromBase(runsBase);
  if (fromRuns) return fromRuns;

  const fromLegacyArchive = findLatestRunFromBase(legacyArchiveBase);
  if (fromLegacyArchive) {
    fromLegacyArchive._legacyArchiveDir = fromLegacyArchive._archiveDir;
    return fromLegacyArchive;
  }

  // Fallback: check active run directory
  const activeFlowPath = path.join(aiDataDir, 'prompts', 'run', 'run-flow.json');
  if (fs.existsSync(activeFlowPath)) {
    try {
      const flow = JSON.parse(fs.readFileSync(activeFlowPath, 'utf8'));
      if (flow && flow.version === 1 && flow.runId) return flow;
    } catch { /* ignore */ }
  }

  return null;
}

/**
 * Load proposals + critiques from a previous run's output files.
 * Returns a concatenated discussion string.
 * Validates that outputFile paths are within aiDataDir to prevent path traversal.
 */
function loadPreviousDiscussion(flow, aiDataDir) {
  const parts = [];
  const phases = ['proposals', 'critiques'];

  for (const phaseName of phases) {
    const phase = (flow.phases || {})[phaseName];
    if (!phase || !phase.agents) continue;

    for (const [agentName, agentData] of Object.entries(phase.agents)) {
      if (!agentData.outputFile || !fs.existsSync(agentData.outputFile)) continue;

      // Path traversal guard: only read files within the .ai data directory
      if (aiDataDir) {
        const resolved = fs.realpathSync(agentData.outputFile);
        if (!isSameOrSubPath(fs.realpathSync(aiDataDir), resolved)) {
          console.warn(`⚠️ Skipping out-of-bounds outputFile for ${agentName}: ${agentData.outputFile}`);
          continue;
        }
      }

      try {
        const text = fs.readFileSync(agentData.outputFile, 'utf8');
        parts.push(`## ${agentName} [${phaseName}]\n${text}\n`);
      } catch {
        continue;
      }
    }
  }

  return parts.join('\n');
}

/**
 * Build the prompt content for a refinement call.
 * Concatenates: original prompt, previous discussion, previous consensus, user feedback, instruction.
 */
function buildRefinementContent(originalPrompt, discussion, consensus, feedback) {
  return [
    '# ORIGINAL PROMPT\n',
    originalPrompt,
    '\n\n---\n\n# PREVIOUS DISCUSSION\n',
    discussion || 'None available.',
    '\n\n# PREVIOUS CONSENSUS\n',
    consensus || 'None available.',
    '\n\n# USER FEEDBACK\n',
    feedback,
    '\n\n# YOUR TASK\n',
    'Revise the consensus to address the user feedback above. Produce only the updated final answer, incorporating the feedback while maintaining the strengths of the original consensus.',
    '\n\n**IMPORTANT:** End your response with: `=== END OF DOCUMENT ===`',
  ].join('');
}

module.exports = { loadLatestArchivedRun, loadPreviousDiscussion, buildRefinementContent };
