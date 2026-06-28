import { join, basename, dirname, resolve, relative, isAbsolute } from 'path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';

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

const SYSTEM_PATHS_TO_EXCLUDE = [
  'c:\\windows',
  '/etc',
  '/var',
  '/bin',
  '/sbin',
  '/usr',
  '/sys',
  '/proc',
  'c:\\program files',
  'c:\\program files (x86)'
];

export function isSystemPath(pathStr) {
  const normalized = pathStr.toLowerCase();
  return SYSTEM_PATHS_TO_EXCLUDE.some(sysPath => 
    normalized === sysPath || 
    normalized.startsWith(sysPath + '\\') || 
    normalized.startsWith(sysPath + '/')
  );
}

export function getKnownProjectPaths(reportsBaseDir) {
  const paths = new Set();
  if (!reportsBaseDir || !existsSync(reportsBaseDir)) return paths;
  try {
    const projects = readdirSync(reportsBaseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    for (const project of projects) {
      const projectDir = join(reportsBaseDir, project);
      const files = readdirSync(projectDir)
        .filter(f => f.endsWith('.json'))
        .sort();
      if (files.length > 0) {
        const latestReportPath = join(projectDir, files[files.length - 1]);
        try {
          const content = JSON.parse(readFileSync(latestReportPath, 'utf8'));
          if (content.target_path) {
            const resolvedPath = resolve(content.target_path);
            if (!isSystemPath(resolvedPath)) {
              paths.add(resolvedPath.toLowerCase());
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error('Error reading known project paths:', err);
  }
  return paths;
}

export function isPathUnderKnownProjects(finalTarget, knownPaths) {
  const resolvedTarget = resolve(finalTarget).toLowerCase();
  for (const knownPath of knownPaths) {
    const rel = relative(knownPath, resolvedTarget);
    if (rel === '' || (!isAbsolute(rel) && !rel.startsWith('..'))) {
      return true;
    }
  }
  return false;
}
