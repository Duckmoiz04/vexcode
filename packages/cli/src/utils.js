import { join, basename, dirname } from 'path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const reportsBaseDir = join(homedir(), '.vexcode', 'reports');
const LATEST_FILE = join(reportsBaseDir, '.latest');

// Helper: get project name from path
export function getProjectName(targetPath) {
  const name = basename(targetPath);
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Helper: get project report directory
export function getProjectReportDir(projectName) {
  return join(reportsBaseDir, projectName);
}

// Helper: generate report filename from timestamp
export function getReportFilename() {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `report_${ts}.json`;
}

// Helper: persist path of the most recently created report
export function updateLatestReportPath(reportPath) {
  const dir = dirname(LATEST_FILE);
  if (!existsSync(dir)) {
    return; // reports base dir doesn't exist yet — nothing to update
  }
  writeFileSync(LATEST_FILE, reportPath, 'utf8');
}

// Helper: read the latest report path, returns null if missing or stale
export function getLatestReportPath() {
  if (!existsSync(LATEST_FILE)) {
    return null;
  }
  const path = readFileSync(LATEST_FILE, 'utf8').trim();
  if (!path || !existsSync(path)) {
    return null;
  }
  return path;
}
