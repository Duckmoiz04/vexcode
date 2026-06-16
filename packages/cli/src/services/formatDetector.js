/**
 * Helpers for reading VexCode report files on disk.
 *
 * VexCode reports are stored as `.json` (primary, consumed by the web UI
 * directly). A `.sarif` sidecar is written alongside for external tools.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Return the SARIF sidecar path for a given VexCode report `.json` path.
 * @param {string} jsonPath - e.g. ".../reports/foo/abc123.json"
 * @returns {string} - e.g. ".../reports/foo/abc123.sarif"
 */
export function sarifPathFor(jsonPath) {
  return jsonPath.replace(/\.json$/, '.sarif');
}

/**
 * Read the SARIF sidecar for a VexCode report, or null if not present.
 * @param {string} jsonPath
 * @returns {object|null}
 */
export function readSarifSidecar(jsonPath) {
  const sarifPath = sarifPathFor(jsonPath);
  if (!existsSync(sarifPath)) return null;
  try {
    return JSON.parse(readFileSync(sarifPath, 'utf8'));
  } catch {
    return null;
  }
}
