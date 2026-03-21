const fs = require('fs');
const path = require('path');

const HUB_CONFIG_DIR_NAME = 'config';
const warnedLegacyFiles = new Set();

function getModernHubFilePath(hubRoot, fileName) {
  return path.join(hubRoot, HUB_CONFIG_DIR_NAME, fileName);
}

function getLegacyHubFilePath(hubRoot, fileName) {
  return path.join(hubRoot, fileName);
}

function warnLegacyHubFile(hubRoot, fileName, logger = console.warn) {
  const warnKey = `${hubRoot}::${fileName}`;
  if (warnedLegacyFiles.has(warnKey)) return;
  warnedLegacyFiles.add(warnKey);
  logger(
    `⚠️ Legacy hub config path detected: ${fileName} in hub root. ` +
    `Move to: ${path.join(HUB_CONFIG_DIR_NAME, fileName)}`,
  );
}

function resolveHubFileForRead(hubRoot, fileName, options = {}) {
  const logger = options.logger || console.warn;
  const warnOnLegacy = options.warnOnLegacy !== false;

  const modernPath = getModernHubFilePath(hubRoot, fileName);
  if (fs.existsSync(modernPath)) return modernPath;

  const legacyPath = getLegacyHubFilePath(hubRoot, fileName);
  if (fs.existsSync(legacyPath)) {
    if (warnOnLegacy) warnLegacyHubFile(hubRoot, fileName, logger);
    return legacyPath;
  }

  return '';
}

function resolveHubFileForWrite(hubRoot, fileName) {
  const configDir = path.join(hubRoot, HUB_CONFIG_DIR_NAME);
  fs.mkdirSync(configDir, { recursive: true });
  return getModernHubFilePath(hubRoot, fileName);
}

module.exports = {
  HUB_CONFIG_DIR_NAME,
  getModernHubFilePath,
  getLegacyHubFilePath,
  resolveHubFileForRead,
  resolveHubFileForWrite,
  warnLegacyHubFile,
};
