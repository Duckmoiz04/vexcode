import { join, basename } from 'path';
import { homedir } from 'node:os';

const reportsBaseDir = join(homedir(), '.vexcode', 'reports');

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
