import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Check if a path is within the base directory (prevent directory traversal).
 * @param {string} targetPath
 * @param {string} baseDir
 * @returns {boolean}
 */
export function isPathSafe(targetPath, baseDir) {
  const resolved = resolve(targetPath);
  return resolved.toLowerCase().startsWith(baseDir.toLowerCase());
}

/**
 * Read .env config file into a plain object.
 * @param {string} envPath - Path to the .env file
 * @returns {Record<string, string>}
 */
export function readEnvConfig(envPath) {
  if (!existsSync(envPath)) {
    return {};
  }
  try {
    const content = readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const config = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        const val = trimmed.slice(index + 1).trim();
        config[key] = val;
      }
    }
    return config;
  } catch (error) {
    console.error('Error reading env config:', error);
    return {};
  }
}

/**
 * Write merged config to .env file, preserving all known AI provider keys.
 * @param {Record<string, string>} newConfig
 * @param {string} envPath - Path to the .env file
 */
export function writeEnvConfig(newConfig, envPath) {
  try {
    const current = readEnvConfig(envPath);
    const merged = { ...current, ...newConfig };

    // Preserve all known AI provider config keys so they are never lost,
    // including empty values. This ensures the Python side sees the empty
    // value and falls back properly instead of seeing stale cached data.
    const knownKeys = new Set([
      'AI_PROVIDER', 'AI_TEMPERATURE', 'AI_MAX_TOKENS',
      'AI_RESOLVE_TIMEOUT_SECONDS', 'AI_NAMING_TIMEOUT_SECONDS',
      'AI_MAX_RETRIES', 'AI_REQUEST_COOLDOWN_SECONDS',
      'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL',
      'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL',
      'GOOGLE_API_KEY', 'GOOGLE_BASE_URL', 'GOOGLE_MODEL',
      'NINEROUTER_API_KEY', 'NINEROUTER_BASE_URL', 'NINEROUTER_MODEL',
      'NVIDIA_API_KEY', 'NVIDIA_BASE_URL', 'NVIDIA_MODEL',
      'SEMGREP_RULES_PATH',
    ]);
    for (const key of knownKeys) {
      if (!(key in merged)) {
        merged[key] = '';
      }
    }

    const content = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n';
    writeFileSync(envPath, content, 'utf8');
  } catch (error) {
    console.error('Error writing env config:', error);
    throw error;
  }
}

/**
 * Get the backup file path for a given source file path.
 * @param {string} filePath
 * @param {string} backupsBaseDir
 * @returns {string}
 */
export function getBackupFilePath(filePath, backupsBaseDir) {
  return join(backupsBaseDir, encodeURIComponent(filePath) + '.bak');
}