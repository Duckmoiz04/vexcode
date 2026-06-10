import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { getProjectReportDir } from '../utils.js';

/**
 * List all projects with their reports.
 * @param {string} reportsBaseDir
 * @returns {{ success: boolean, projects: Array }}
 */
export function listProjects(reportsBaseDir) {
  if (!existsSync(reportsBaseDir)) {
    return { success: true, projects: [] };
  }

  const entries = readdirSync(reportsBaseDir);
  const projects = [];

  for (const entry of entries) {
    const entryPath = join(reportsBaseDir, entry);
    if (statSync(entryPath).isDirectory()) {
      const reports = readdirSync(entryPath)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      if (reports.length > 0) {
        const latestPath = join(entryPath, reports[0]);
        let latestReport = {};
        try {
          latestReport = JSON.parse(readFileSync(latestPath, 'utf8'));
        } catch {}

        projects.push({
          name: entry,
          reportCount: reports.length,
          latestReport: {
            id: reports[0].replace('.json', ''),
            timestamp: latestReport.timestamp || null,
            findings: latestReport.findings?.length || 0
          }
        });
      }
    }
  }

  return { success: true, projects };
}

/**
 * List reports for a specific project.
 * @param {string} projectName
 * @returns {{ success: boolean, project?: string, reports?: Array, error?: string }}
 */
export function listProjectReports(projectName) {
  const projectDir = getProjectReportDir(projectName);

  if (!existsSync(projectDir)) {
    return { success: false, error: `Project "${projectName}" not found.` };
  }

  const reports = readdirSync(projectDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  const reportList = reports.map(filename => {
    const filePath = join(projectDir, filename);
    let report = {};
    try {
      report = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {}

    return {
      id: filename.replace('.json', ''),
      timestamp: report.timestamp || null,
      target: report.target_path || null,
      findings: report.findings?.length || 0
    };
  });

  return { success: true, project: projectName, reports: reportList };
}

/**
 * Get a specific report by project name and report ID.
 * @param {string} projectName
 * @param {string} reportId
 * @returns {{ success: boolean, report?: object, error?: string }}
 */
export function getReportContent(projectName, reportId) {
  const reportPath = join(getProjectReportDir(projectName), `${reportId}.json`);

  if (!existsSync(reportPath)) {
    return { success: false, error: 'Report not found.' };
  }

  const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
  reportContent._id = reportId;
  reportContent._project = projectName;
  reportContent._savedAt = reportPath;

  return { success: true, report: reportContent };
}

/**
 * Get the latest report across all projects.
 * @param {string} reportsBaseDir
 * @returns {{ success: boolean, report?: object, error?: string }}
 */
export function getLatestReportContent(reportsBaseDir) {
  if (!existsSync(reportsBaseDir)) {
    return { success: false, error: 'No reports found.' };
  }

  const projects = readdirSync(reportsBaseDir);
  if (projects.length === 0) {
    return { success: false, error: 'No reports found.' };
  }

  let latestReport = null;
  let latestTime = 0;

  for (const project of projects) {
    const projectDir = join(reportsBaseDir, project);
    if (!statSync(projectDir).isDirectory()) continue;

    const reports = readdirSync(projectDir).filter(f => f.endsWith('.json'));
    for (const report of reports) {
      const reportPath = join(projectDir, report);
      const stat = statSync(reportPath);
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latestReport = {
          path: reportPath,
          project,
          id: report.replace('.json', '')
        };
      }
    }
  }

  if (!latestReport) {
    return { success: false, error: 'No reports found.' };
  }

  const content = JSON.parse(readFileSync(latestReport.path, 'utf8'));
  content._id = latestReport.id;
  content._project = latestReport.project;

  return { success: true, report: content };
}