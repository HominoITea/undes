const fs = require('fs');

function hasContextPackSection(bundleContent = '') {
  return typeof bundleContent === 'string' && bundleContent.includes('## CONTEXT PACK');
}

function buildCheckpointRuntimeSettings({
  maxFiles,
  maxFileSize,
  maxTotalSize,
  packedTreeLimit,
  contextPackActive,
  isLightMode,
  noTree,
  effectiveIndexMode,
  redactSecrets,
  enablePrepost,
  enableTest,
}) {
  const treeCap = contextPackActive ? Math.min(maxFiles, packedTreeLimit) : maxFiles;
  return {
    version: 1,
    limits: {
      maxFiles,
      maxFileSize,
      maxTotalSize,
      maxTreeFilesWhenPacked: packedTreeLimit,
      treeCap,
    },
    mode: isLightMode ? 'light' : 'full',
    contextPackActive: Boolean(contextPackActive),
    noTree: Boolean(noTree),
    effectiveIndexMode: String(effectiveIndexMode || ''),
    redactSecrets: Boolean(redactSecrets),
    phases: {
      prepost: Boolean(enablePrepost),
      test: Boolean(enableTest),
    },
  };
}

function buildEffectiveRuntimeSummaryLines({
  maxFiles,
  packedTreeLimit,
  contextPackActive,
  isLightMode,
  checkpointStatus,
  agents,
}) {
  const treeCap = contextPackActive ? Math.min(maxFiles, packedTreeLimit) : maxFiles;
  const lines = [
    '📏 Effective runtime limits:',
    `   files: maxFiles=${maxFiles}, maxTreeFilesWhenPacked=${packedTreeLimit}, treeCap=${treeCap}`,
    `   context pack: ${contextPackActive ? 'on' : 'off'}`,
    `   mode: ${isLightMode ? 'light' : 'full'}`,
    `   checkpoint: ${checkpointStatus || 'fresh run'}`,
  ];

  if (Array.isArray(agents) && agents.length > 0) {
    for (const agent of agents) {
      lines.push(
        `   agent ${agent.name || 'agent'}: contextBudget=${Number(agent.contextBudget) || 0}, maxOutputTokens=${Number(agent.maxOutputTokens) || 0}`,
      );
    }
  }

  return lines;
}

function buildTreeTruncationWarningLines({
  totalFiles,
  treeLimit,
  excludedDirs,
  maxFiles,
  packedTreeLimit,
  contextPackActive,
  isFullMode,
}) {
  const dirs = Array.isArray(excludedDirs) ? excludedDirs.filter(Boolean) : [];
  const lines = [`⚠️ Truncated: ${totalFiles} → ${treeLimit} files`];

  if (dirs.length > 0) {
    lines.push(`   Excluded dirs: ${dirs.slice(0, 5).join(', ')}`);
  }

  const packedTreeActive = contextPackActive && packedTreeLimit <= maxFiles && treeLimit === packedTreeLimit;
  if (packedTreeActive) {
    lines.push(`   Active limiter: maxTreeFilesWhenPacked=${packedTreeLimit} while context pack is enabled`);
    if (isFullMode) {
      lines.push('   Note: --full does not bypass the packed tree cap while context pack is enabled');
    } else {
      lines.push(`   Note: effective maxFiles=${maxFiles} is above the packed tree cap, so increasing --max-files will not expand the tree output`);
    }
  } else {
    lines.push(`   Active limiter: maxFiles=${maxFiles}`);
    lines.push(`   Tip: Use ${isFullMode ? 'context.json fullFiles' : '--max-files=N or --full'} to include more files`);
  }

  lines.push('   Tip: Add specific files to ai/context.json fullFiles for guaranteed inclusion');
  return lines;
}

function detectProjectControlSurface(projectPath) {
  const root = String(projectPath || '').trim();
  if (!root || !fs.existsSync(root)) {
    return { projectType: 'generic', primaryControlFiles: [] };
  }

  let rootFiles = [];
  try {
    rootFiles = fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return { projectType: 'generic', primaryControlFiles: [] };
  }

  const has = (fileName) => rootFiles.includes(fileName);
  const existing = (fileNames) => fileNames.filter((fileName) => has(fileName));

  if (has('package.json')) {
    return { projectType: 'node', primaryControlFiles: ['package.json'] };
  }

  const javaFiles = existing(['pom.xml', 'build.gradle', 'settings.gradle', 'build.gradle.kts', 'settings.gradle.kts']);
  if (javaFiles.length > 0) {
    return { projectType: 'java', primaryControlFiles: javaFiles };
  }

  const pythonFiles = existing(['pyproject.toml', 'requirements.txt', 'setup.py']);
  if (pythonFiles.length > 0) {
    return { projectType: 'python', primaryControlFiles: pythonFiles };
  }

  if (has('Cargo.toml')) {
    return { projectType: 'rust', primaryControlFiles: ['Cargo.toml'] };
  }

  if (has('go.mod')) {
    return { projectType: 'go', primaryControlFiles: ['go.mod'] };
  }

  const dotnetFiles = rootFiles.filter((fileName) => fileName.endsWith('.sln') || fileName.endsWith('.csproj'));
  if (dotnetFiles.length > 0) {
    return { projectType: 'dotnet', primaryControlFiles: dotnetFiles.slice(0, 3) };
  }

  return { projectType: 'generic', primaryControlFiles: [] };
}

function buildMissingContextWarningState({ missingFiles, projectPath }) {
  const missing = Array.isArray(missingFiles) ? missingFiles.filter(Boolean) : [];
  if (missing.length === 0) {
    return {
      level: 'ok',
      lines: ['✅ Environment check passed.\n'],
    };
  }

  const projectInfo = detectProjectControlSurface(projectPath);
  const optionalMissing = missing.filter((file) => (
    file === 'package.json'
    && projectInfo.projectType !== 'node'
    && projectInfo.primaryControlFiles.length > 0
  ));
  const relevantMissing = missing.filter((file) => !optionalMissing.includes(file));

  if (relevantMissing.length > 0) {
    const lines = ['⚠️  WARNING: The following context files are missing:'];
    relevantMissing.forEach((file) => lines.push(`   - ${file}`));
    if (optionalMissing.length > 0) {
      lines.push(
        `   Optional for detected ${projectInfo.projectType} project: ${optionalMissing.join(', ')}`,
      );
    }
    if (projectInfo.primaryControlFiles.length > 0 && projectInfo.projectType !== 'node') {
      lines.push(`   Detected project control surface: ${projectInfo.primaryControlFiles.join(', ')}`);
      lines.push('   Tip: Add the detected control files to ai/context.json fullFiles if build/config context matters.');
    }
    lines.push('   The AI might lack important context. Consider restoring them.\n');
    return { level: 'warn', lines };
  }

  const lines = [`ℹ️ Optional context defaults are missing for detected ${projectInfo.projectType} project:`];
  optionalMissing.forEach((file) => lines.push(`   - ${file}`));
  if (projectInfo.primaryControlFiles.length > 0) {
    lines.push(`   Detected project control surface: ${projectInfo.primaryControlFiles.join(', ')}`);
    lines.push('   Tip: Add the detected control files to ai/context.json fullFiles if build/config context matters.');
  }
  lines.push('   Continuing without warning because the missing defaults look optional for this project type.\n');
  return { level: 'info', lines };
}

module.exports = {
  hasContextPackSection,
  buildCheckpointRuntimeSettings,
  buildEffectiveRuntimeSummaryLines,
  buildTreeTruncationWarningLines,
  detectProjectControlSurface,
  buildMissingContextWarningState,
};
