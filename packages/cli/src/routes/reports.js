import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { listProjects, listProjectReports, getReportContent, getLatestReportContent } from '../services/reportService.js';

export function registerReportRoutes(app, deps) {
  const { isPathSafe, workspaceDir, reportsBaseDir, runRefreshAi } = deps;

  app.get('/api/reports', (req, res) => {
    try {
      const result = listProjects(reportsBaseDir);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/reports/:project', (req, res) => {
    try {
      const result = listProjectReports(req.params.project);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/report/:project/:id', (req, res) => {
    try {
      const result = getReportContent(req.params.project, req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result.report);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/report', (req, res) => {
    try {
      if (req.query.path) {
        const reportFilePath = resolve(req.query.path);
        if (!isPathSafe(reportFilePath, workspaceDir)) {
          return res.status(400).json({ success: false, error: 'Report path is outside the workspace directory.' });
        }
        if (!existsSync(reportFilePath)) {
          return res.status(404).json({ success: false, error: `Report file not found at ${reportFilePath}` });
        }
        const reportContent = readFileSync(reportFilePath, 'utf8');
        return res.json(JSON.parse(reportContent));
      }

      const result = getLatestReportContent(reportsBaseDir);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result.report);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/re-resolve', async (req, res) => {
    try {
      const { reportPath, mockAi } = req.body;

      if (typeof reportPath !== 'string' || reportPath.trim() === '') {
        return res.status(400).json({ success: false, error: 'Invalid reportPath: must be a non-empty string' });
      }

      if (!reportPath || !existsSync(reportPath)) {
        return res.status(400).json({ success: false, error: 'Valid reportPath is required.' });
      }

      await runRefreshAi(reportPath, !!mockAi);

      const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
      reportContent._id = basename(reportPath).replace('.json', '');
      reportContent._project = basename(dirname(reportPath));
      reportContent._savedAt = reportPath;

      res.json({
        success: true,
        message: 'Refresh AI complete',
        report: reportContent
      });
    } catch (error) {
      const statusCode = error.cancelled ? 400 : 500;
      res.status(statusCode).json({ success: false, error: error.message });
    }
  });
}