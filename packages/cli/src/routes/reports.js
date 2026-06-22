import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { listProjects, listProjectReports, getReportContent, getLatestReportContent } from '../services/reportService.js';
import { readSarifSidecar } from '../services/formatDetector.js';
import { getApiKey } from '../middleware/auth.js';

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
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.pageSize, 10) || 0;
      const result = getReportContent(req.params.project, req.params.id, page, pageSize);
      if (!result.success) {
        return res.status(404).json(result);
      }
      // Include pagination metadata alongside the report
      const response = { ...result.report };
      if (result.pagination) {
        response._pagination = result.pagination;
      }
      res.json(response);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/report/:project/:id/sarif', (req, res) => {
    try {
      const result = getReportContent(req.params.project, req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      // SARIF sidecar path: <report.json path> with .sarif extension
      const jsonPath = `${result.report._savedAt}`;
      const sarif = readSarifSidecar(jsonPath);
      if (!sarif) {
        return res.status(404).json({
          success: false,
          error: 'SARIF sidecar not found. Re-run a scan to generate the latest SARIF export.'
        });
      }
      res.setHeader('Content-Type', 'application/sarif+json');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.sarif"`);
      return res.json(sarif);
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

  // SSE re-resolve endpoint with progress streaming
  app.get('/api/re-resolve/stream', async (req, res) => {
    // SSE can't send Authorization headers; accept token via query param instead.
    const sseToken = req.query.token || '';
    if (sseToken !== getApiKey()) {
      res.writeHead(401, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Authentication required.', code: 'AUTH_REQUIRED' })}\n\n`);
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      const { reportPath, mockAi } = req.query;

      if (!reportPath || typeof reportPath !== 'string' || !existsSync(reportPath)) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Valid reportPath is required.' })}\n\n`);
        return res.end();
      }

      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting AI re-resolution...' })}\n\n`);

      await runRefreshAi(reportPath, mockAi === 'true', (progress) => {
        if (progress.type === 'progress') {
          res.write(`data: ${JSON.stringify(progress)}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ type: 'status', message: progress.line || progress.message })}\n\n`);
        }
      });

      const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
      reportContent._id = basename(reportPath).replace('.json', '');
      reportContent._project = basename(dirname(reportPath));
      reportContent._savedAt = reportPath;

      res.write(`data: ${JSON.stringify({ type: 'complete', report: reportContent })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  });
}
