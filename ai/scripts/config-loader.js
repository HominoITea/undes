'use strict';

const fs = require('fs');
const path = require('path');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function mergeContextConfig(baseConfig = {}, projectConfig = {}) {
  const merged = {
    ...baseConfig,
    ...projectConfig,
  };

  const nestedKeys = ['limits', 'codeIndex', 'logWindow', 'memoryWindow', 'priority'];
  for (const key of nestedKeys) {
    merged[key] = {
      ...(baseConfig[key] || {}),
      ...(projectConfig[key] || {}),
    };
  }

  if (Array.isArray(projectConfig.fullFiles)) merged.fullFiles = projectConfig.fullFiles;
  else if (Array.isArray(baseConfig.fullFiles)) merged.fullFiles = baseConfig.fullFiles;

  if (Array.isArray(projectConfig.lightFiles)) merged.lightFiles = projectConfig.lightFiles;
  else if (Array.isArray(baseConfig.lightFiles)) merged.lightFiles = baseConfig.lightFiles;

  if (typeof projectConfig.exclude === 'string') merged.exclude = projectConfig.exclude;
  else if (typeof baseConfig.exclude === 'string') merged.exclude = baseConfig.exclude;

  return merged;
}

function mergeAgentsConfig(baseConfig = null, projectConfig = null) {
  const baseAgents = Array.isArray(baseConfig?.agents) ? baseConfig.agents : [];
  const projectAgents = Array.isArray(projectConfig?.agents) ? projectConfig.agents : [];
  if (baseAgents.length === 0 && projectAgents.length === 0) {
    return baseConfig || projectConfig;
  }
  if (baseAgents.length === 0) return projectConfig || baseConfig;
  if (projectAgents.length === 0) return baseConfig || projectConfig;

  const out = [];
  const seenNames = new Set();
  for (const agent of baseAgents) {
    if (!agent || !agent.name) continue;
    const override = projectAgents.find((item) => item && item.name === agent.name);
    out.push(override ? { ...agent, ...override } : { ...agent });
    seenNames.add(agent.name);
  }
  for (const agent of projectAgents) {
    if (!agent || !agent.name || seenNames.has(agent.name)) continue;
    out.push({ ...agent });
  }
  return { ...baseConfig, ...projectConfig, agents: out };
}

function resolveReadablePath(filePath, options = {}) {
  const {
    allowHubFallback = true,
    projectRoot = process.cwd(),
    hubRoot = '',
  } = options;
  const rel = String(filePath || '').trim();
  if (!rel) return null;

  const projectCandidates = [path.join(projectRoot, rel)];
  for (const candidate of projectCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  if (!allowHubFallback || !hubRoot) return null;
  if (!rel.startsWith('ai/') && !rel.startsWith('.ai/')) return null;

  const hubRel = rel.startsWith('.ai/') ? `ai/${rel.slice(4)}` : rel;
  const hubCandidate = path.join(hubRoot, hubRel);
  if (fs.existsSync(hubCandidate)) return hubCandidate;
  return null;
}

function loadContextConfig(hubConfigPath, projectConfigPath, defaultTreeCmd, validateContextConfig) {
  const hubDefaults = readJsonIfExists(hubConfigPath) || {};
  const projectOverrides = readJsonIfExists(projectConfigPath) || {};
  const config = mergeContextConfig(hubDefaults, projectOverrides);

  if (config.exclude !== undefined && typeof config.exclude !== 'string') {
    console.warn('⚠️ ai/context.json: "exclude" is not a string; applying default exclude command.');
    config.exclude = defaultTreeCmd;
  } else if (typeof config.exclude === 'string') {
    config.exclude = config.exclude.trim();
    if (!config.exclude) {
      console.warn('⚠️ ai/context.json: "exclude" is empty; applying default exclude command.');
      config.exclude = defaultTreeCmd;
    }
  }

  if (typeof validateContextConfig === 'function') {
    const errors = validateContextConfig(config);
    if (errors.length > 0) {
      const error = new Error('Invalid ai/context.json');
      error.code = 'INVALID_CONTEXT_CONFIG';
      error.validationErrors = errors;
      throw error;
    }
  }

  return config;
}

module.exports = {
  readJsonIfExists,
  mergeContextConfig,
  mergeAgentsConfig,
  resolveReadablePath,
  loadContextConfig,
};
