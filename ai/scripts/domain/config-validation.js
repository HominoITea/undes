// ============ CONFIG VALIDATION ============
function validateAgentsConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return errors;
  }

  if (!Array.isArray(config.agents)) {
    errors.push('Config must have an "agents" array');
    return errors;
  }

  config.agents.forEach((agent, index) => {
    const prefix = `agents[${index}]`;

    if (!agent.name || typeof agent.name !== 'string') {
      errors.push(`${prefix}: "name" is required and must be a string`);
    }
    if (!agent.apiUrl || typeof agent.apiUrl !== 'string') {
      errors.push(`${prefix}: "apiUrl" is required and must be a string`);
    }
    if (!agent.model || typeof agent.model !== 'string') {
      errors.push(`${prefix}: "model" is required and must be a string`);
    }
    if (!agent.key || typeof agent.key !== 'string') {
      errors.push(`${prefix}: "key" is required and must be a string (env var name)`);
    }
    if (agent.role && typeof agent.role !== 'string') {
      errors.push(`${prefix}: "role" must be a string if provided`);
    }
    if (agent.consensus !== undefined && typeof agent.consensus !== 'boolean') {
      errors.push(`${prefix}: "consensus" must be a boolean if provided`);
    }
    if (agent.phase && !['pre-process', 'post-process', 'devil-advocate'].includes(agent.phase)) {
      errors.push(`${prefix}: "phase" must be "pre-process", "post-process", or "devil-advocate" if provided`);
    }
    if (agent.description && typeof agent.description !== 'string') {
      errors.push(`${prefix}: "description" must be a string if provided`);
    }
    if (agent.debatePhases !== undefined) {
      if (!Array.isArray(agent.debatePhases)) {
        errors.push(`${prefix}: "debatePhases" must be an array`);
      } else {
        const validDebatePhases = ['proposal', 'critique', 'approval'];
        for (const p of agent.debatePhases) {
          if (!validDebatePhases.includes(p)) {
            errors.push(`${prefix}: "debatePhases" contains invalid value "${p}". Valid: ${validDebatePhases.join(', ')}`);
          }
        }
      }
    }
    if (agent.contextBudget !== undefined) {
      const budget = Number(agent.contextBudget);
      if (!Number.isFinite(budget) || budget <= 0) {
        errors.push(`${prefix}: "contextBudget" must be a positive number if provided`);
      }
    }
    if (agent.maxOutputTokens !== undefined) {
      const limit = Number(agent.maxOutputTokens);
      if (!Number.isFinite(limit) || limit <= 0) {
        errors.push(`${prefix}: "maxOutputTokens" must be a positive number if provided`);
      }
    }
  });

  return errors;
}

function validateContextConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return errors;
  }

  if (!Array.isArray(config.fullFiles)) {
    errors.push('"fullFiles" must be an array');
  } else {
    config.fullFiles.forEach((file, i) => {
      if (typeof file !== 'string') {
        errors.push(`fullFiles[${i}] must be a string`);
      }
    });
  }

  if (!Array.isArray(config.lightFiles)) {
    errors.push('"lightFiles" must be an array');
  } else {
    config.lightFiles.forEach((file, i) => {
      if (typeof file !== 'string') {
        errors.push(`lightFiles[${i}] must be a string`);
      }
    });
  }

  if (config.exclude && typeof config.exclude !== 'string') {
    errors.push('"exclude" must be a string if provided');
  }

  return errors;
}

module.exports = {
  validateAgentsConfig,
  validateContextConfig,
};
