import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { resolve, join, sep, relative, isAbsolute } from 'node:path';

/**
 * Check if a path is within the base directory (prevent directory traversal).
 *
 * Uses path.relative() which correctly handles edge cases like
 * ``/workspace-evil`` passing ``startsWith('/workspace')``.
 *
 * @param {string} targetPath
 * @param {string} baseDir
 * @returns {boolean}
 */
export function isPathSafe(targetPath, baseDir) {
  const resolved = resolve(targetPath);
  const normalizedBase = resolve(baseDir);
  // path.relative returns a path without leading '..' only when
  // the target is truly inside the base directory.
  const rel = relative(normalizedBase, resolved);
  // Absolute result means cross-drive on Windows (e.g., C:\ vs D:\).
  // Boolean(rel) false means same path (workspace root itself).
  return Boolean(rel) && !isAbsolute(rel) && !rel.startsWith('..');
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
    // Ensure AI master toggle and agent-to-provider routing keys are
    // also covered so the web UI never drops them on save.
    knownKeys.add('AI_ENABLED');
    for (const key of knownKeys) {
      if (!(key in merged)) {
        merged[key] = '';
      }
    }

    const content = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n';
    writeFileSync(envPath, content, 'utf8');
    try { chmodSync(envPath, 0o600); } catch { /* best-effort on platforms that don't support chmod */ }
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