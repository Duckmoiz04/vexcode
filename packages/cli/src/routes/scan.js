import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getProjectName, getProjectReportDir, getReportFilename, updateLatestReportPath } from '../utils.js';

export function registerScanRoutes(app, deps) {
  const { isPathSafe, workspaceDir, runPythonAnalysis, cancelActiveScan } = deps;

  app.post('/api/scan/cancel', (req, res) => {
    const cancelled = cancelActiveScan();
    res.json({ success: true, cancelled });
  });

  app.get('/api/scan/stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const { targetPath, mockScan, mockAi, fastScan } = req.query;
      const finalTarget = targetPath ? resolve(targetPath) : workspaceDir;

      if (!isPathSafe(finalTarget, workspaceDir)) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Target path is outside the workspace directory.' })}\n\n`);
        return res.end();
      }

      const projectName = getProjectName(finalTarget);
      const projectDir = getProjectReportDir(projectName);
      mkdirSync(projectDir, { recursive: true });
      const reportFilename = getReportFilename();
      const reportPath = join(projectDir, reportFilename);

      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting scan...' })}\n\n`);

      await runPythonAnalysis(
        finalTarget,
        reportPath,
        mockScan === 'true' || mockScan === true,
        mockAi === 'true' || mockAi === true,
        fastScan === 'true' || fastScan === true,
        (progress) => {
          res.write(`data: ${JSON.stringify({ type: 'status', message: progress.line })}\n\n`);
        }
      );

      // Track latest report path
      updateLatestReportPath(reportPath);

      const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
      reportContent._id = reportFilename.replace('.json', '');
      reportContent._project = projectName;
      reportContent._savedAt = reportPath;

      res.write(`data: ${JSON.stringify({ type: 'complete', report: reportContent })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  });

  app.post('/api/scan', async (req, res) => {
    try {
      const { targetPath, mockScan, mockAi, fastScan } = req.body;

      if (targetPath !== undefined && (typeof targetPath !== 'string' || targetPath.trim() === '')) {
        return res.status(400).json({ success: false, error: 'Invalid targetPath: must be a non-empty string' });
      }

      const finalTarget = targetPath ? resolve(targetPath) : workspaceDir;

      if (!isPathSafe(finalTarget, workspaceDir)) {
        return res.status(400).json({ success: false, error: 'Target path is outside the workspace directory.' });
      }

      const projectName = getProjectName(finalTarget);
      const projectDir = getProjectReportDir(projectName);
      mkdirSync(projectDir, { recursive: true });
      const reportFilename = getReportFilename();
      const reportPath = join(projectDir, reportFilename);

      await runPythonAnalysis(finalTarget, reportPath, !!mockScan, !!mockAi, !!fastScan);

      updateLatestReportPath(reportPath);

      const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
      reportContent._id = reportFilename.replace('.json', '');
      reportContent._project = projectName;
      reportContent._savedAt = reportPath;

      res.json({
        success: true,
        message: 'Scan execution complete',
        report: reportContent,
        reportPath: reportPath
      });
    } catch (error) {
      const statusCode = error.cancelled ? 400 : 500;
      res.status(statusCode).json({ success: false, error: error.message });
    }
  });
}