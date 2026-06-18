import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { getProjectReportDir, getLatestReportPath } from '../utils.js';

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
            findings: (latestReport.findings || []).length
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
      findings: (report.findings || []).length
    };
  });

  return { success: true, project: projectName, reports: reportList };
}

/**
 * Get a specific report by project name and report ID.
 * Supports pagination of findings via page/pageSize parameters.
 * @param {string} projectName
 * @param {string} reportId
 * @param {number} [page=1] - 1-based page number
 * @param {number} [pageSize=1000] - items per page (0 = no pagination)
 * @returns {{ success: boolean, report?: object, pagination?: object, error?: string }}
 */
export function getReportContent(projectName, reportId, page = 1, pageSize = 1000) {
  const reportPath = join(getProjectReportDir(projectName), `${reportId}.json`);

  if (!existsSync(reportPath)) {
    return { success: false, error: 'Report not found.' };
  }

  const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
  reportContent._id = reportId;
  reportContent._project = projectName;
  reportContent._savedAt = reportPath;

  // Apply pagination to findings if pageSize > 0
  const allFindings = reportContent.findings || [];
  const total = allFindings.length;

  if (pageSize > 0 && total > 0) {
    const startIdx = (page - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    reportContent.findings = allFindings.slice(startIdx, endIdx);

    const result = {
      success: true,
      report: reportContent,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    // Compute filter counts from the full findings (not the sliced subset)
    const filterCounts = {};
    const severityCounts = {};
    for (const f of allFindings) {
      const sev = (f.severity || 'unknown').toLowerCase();
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
      const status = f.scan_status || 'new';
      filterCounts[status] = (filterCounts[status] || 0) + 1;
    }
    result.pagination.filterCounts = filterCounts;
    result.pagination.severityCounts = severityCounts;

    return result;
  }

  // Return all findings when pageSize is 0 (legacy behavior)
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

  // Fast path: try .latest pointer first
  const latestPath = getLatestReportPath();
  if (latestPath) {
    for (const project of readdirSync(reportsBaseDir)) {
      const projectDir = join(reportsBaseDir, project);
      if (!statSync(projectDir).isDirectory()) continue;
      if (latestPath.startsWith(projectDir + '\\') || latestPath.startsWith(projectDir + '/')) {
        const id = basename(latestPath).replace('.json', '');
        const content = JSON.parse(readFileSync(latestPath, 'utf8'));
        content._id = id;
        content._project = project;
        return { success: true, report: content };
      }
    }
  }

  // Fallback: scan all project directories by mtime
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

/**
 * Atomically write a report to disk.
 * Strategy: write to a temp file, then rename (atomic on most filesystems).
 * @param {string} reportPath - absolute path to the report JSON
 * @param {object} reportData - the parsed report object
 */
export function writeReportAtomic(reportPath, reportData) {
  const tmpPath = `${reportPath}.tmp-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(reportData, null, 2), 'utf8');
  renameSync(tmpPath, reportPath);
}

/**
 * Mark a specific finding as applied in the report JSON on disk.
 * Locates finding by id (preferred) or by (file, line, rule_id) tuple.
 * Sets finding._applied = true and finding.status = 'applied'.
 * @param {string} reportPath - absolute path to the report JSON
 * @param {object} findingLocator - { id?, file?, line?, rule_id? }
 * @returns {{ success: boolean, error?: string }}
 */
export function markFindingApplied(reportPath, findingLocator) {
  if (!existsSync(reportPath)) {
    return { success: false, error: 'Report file not found.' };
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (e) {
    return { success: false, error: `Failed to parse report: ${e.message}` };
  }

  const findings = report.findings || [];
  const target = findings.find((f) => {
    if (findingLocator.id && f.id) {
      return f.id === findingLocator.id;
    }
    return (
      f.file === findingLocator.file &&
      f.line === findingLocator.line &&
      f.rule_id === findingLocator.rule_id
    );
  });

  if (!target) {
    return { success: false, error: 'Finding not found in report.' };
  }

  target._applied = true;
  target.status = 'applied';

  writeReportAtomic(reportPath, report);
  return { success: true, finding: target };
}

/**
 * Set the status of a specific finding in the report JSON on disk.
 * Locates finding by id (preferred) or by (file, line, rule_id) tuple.
 * @param {string} reportPath - absolute path to the report JSON
 * @param {object} findingLocator - { id?, file?, line?, rule_id? }
 * @param {'open' | 'applied' | 'false_positive' | 'ignored'} status
 * @returns {{ success: boolean, error?: string, finding?: object }}
 */
export function updateFindingStatus(reportPath, findingLocator, status) {
  const VALID_STATUSES = ['open', 'applied', 'false_positive', 'ignored'];
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` };
  }

  if (!existsSync(reportPath)) {
    return { success: false, error: 'Report file not found.' };
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (e) {
    return { success: false, error: `Failed to parse report: ${e.message}` };
  }

  const findings = report.findings || [];
  const target = findings.find((f) => {
    if (findingLocator.id && f.id) {
      return f.id === findingLocator.id;
    }
    return (
      f.file === findingLocator.file &&
      f.line === findingLocator.line &&
      f.rule_id === findingLocator.rule_id
    );
  });

  if (!target) {
    return { success: false, error: 'Finding not found in report.' };
  }

  target.status = status;
  // Keep _applied in sync for backward compatibility
  target._applied = status === 'applied';

  writeReportAtomic(reportPath, report);
  return { success: true, finding: target };
}
