import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getProjectName, getProjectReportDir, getReportFilename, updateLatestReportPath, getKnownProjectPaths, isPathUnderKnownProjects } from '../utils.js';

import { getApiKey } from '../middleware/auth.js';

// Phase 2.4 — safe error messages that never leak internals
const SAFE_ERRORS = {
  SCAN_CANCELLED: 'Scan was cancelled.',
  SCAN_FAILED:     'Scan failed to complete. Please try again.',
  PATH_INVALID:    'Invalid target path.',
  AUTH_REQUIRED:   'Authentication required.',
  RATE_LIMITED:    'Too many requests. Please try again later.',
};

function toSafeError(originalMessage) {
  if (originalMessage === 'Scan cancelled by user') {
    return { code: 'SCAN_CANCELLED', message: SAFE_ERRORS.SCAN_CANCELLED };
  }
  if (originalMessage && originalMessage.includes('outside the workspace')) {
    return { code: 'PATH_INVALID', message: SAFE_ERRORS.PATH_INVALID };
  }
  return { code: 'SCAN_FAILED', message: SAFE_ERRORS.SCAN_FAILED };
}

function parseBool(val) {
  if (val === 'true' || val === true)  return true;
  if (val === 'false' || val === false) return false;
  return undefined;
}


export function registerScanRoutes(app, deps) {
  const { isPathSafe, workspaceDir, runPythonAnalysis, cancelActiveScan, scanLimiter, reportsBaseDir } = deps;

  app.post('/api/scan/cancel', (req, res) => {
    const cancelled = cancelActiveScan();
    res.json({ success: true, cancelled });
  });

  app.get('/api/scan/stream', async (req, res) => {
    // SSE can't send Authorization headers; accept token via query param instead.
    const sseToken = req.query.token || '';
    if (sseToken !== getApiKey()) {
      res.writeHead(401, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Authentication required.', code: 'AUTH_REQUIRED' })}\n\n`);
      return res.end();
    }

    // Phase 2.2 — detect client disconnect and cancel the Python process
    let clientCancelled = false;
    req.on('close', () => {
      if (!res.writableEnded) {
        clientCancelled = true;
        cancelActiveScan();
      }
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const { targetPath, mockScan, mockAi, fastScan } = req.query;


      const mockScanBool  = parseBool(mockScan);
      const mockAiBool    = parseBool(mockAi);
      const fastScanBool  = parseBool(fastScan);
      if (mockScan !== undefined && mockScanBool === undefined) {
        const err = SAFE_ERRORS.PATH_INVALID;
        res.write(`data: ${JSON.stringify({ type: 'error', error: err, code: 'SCAN_FAILED' })}\n\n`);
        return res.end();
      }

      const finalTarget = targetPath ? resolve(targetPath) : workspaceDir;
      const isWorkspaceRoot = finalTarget.toLowerCase() === workspaceDir.toLowerCase();
      
      const knownPaths = getKnownProjectPaths(reportsBaseDir);
      const isSafe = isWorkspaceRoot || isPathSafe(finalTarget, workspaceDir) || isPathUnderKnownProjects(finalTarget, knownPaths);
      
      console.log('SCAN DEBUG STREAM:', { targetPath, finalTarget, workspaceDir, isWorkspaceRoot, isSafe });

      if (!isSafe) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: SAFE_ERRORS.PATH_INVALID, code: 'PATH_INVALID' })}\n\n`);
        return res.end();
      }

      const projectName = getProjectName(finalTarget);
      const projectDir = getProjectReportDir(projectName);
      mkdirSync(projectDir, { recursive: true });
      const reportFilename = getReportFilename();
      const reportPath = join(projectDir, reportFilename);

      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting scan...' })}\n\n`);

      // Guard against write-after-end if client disconnected during setup
      if (clientCancelled || res.writableEnded) return;

      await runPythonAnalysis(
        finalTarget,
        reportPath,
        mockScanBool === true,
        mockAiBool === true,
        fastScanBool === true,
        (progress) => {
          if (res.writableEnded) return;
          if (progress.type === 'progress') {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'status', message: progress.line || progress.message })}\n\n`);
          }
        }
      );

      if (res.writableEnded) return;

      // Track latest report path
      updateLatestReportPath(reportPath);

      const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
      reportContent._id = reportFilename.replace('.json', '');
      reportContent._project = projectName;
      reportContent._savedAt = reportPath;

      res.write(`data: ${JSON.stringify({ type: 'complete', report: reportContent })}\n\n`);
      res.end();
    } catch (error) {
      if (res.writableEnded) return;
      const safe = toSafeError(error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: safe.message, code: safe.code })}\n\n`);
      res.end();
    }
  });

  app.post('/api/scan', scanLimiter, async (req, res) => {
    try {
      const { targetPath, mockScan, mockAi, fastScan } = req.body;

      if (targetPath !== undefined && (typeof targetPath !== 'string' || targetPath.trim() === '')) {
        return res.status(400).json({ success: false, error: 'Invalid targetPath: must be a non-empty string' });
      }

      const finalTarget = targetPath ? resolve(targetPath) : workspaceDir;
      const isWorkspaceRoot = finalTarget.toLowerCase() === workspaceDir.toLowerCase();
      
      const knownPaths = getKnownProjectPaths(reportsBaseDir);
      const isSafe = isWorkspaceRoot || isPathSafe(finalTarget, workspaceDir) || isPathUnderKnownProjects(finalTarget, knownPaths);
      
      console.log('SCAN DEBUG POST:', { targetPath, finalTarget, workspaceDir, isWorkspaceRoot, isSafe });

      if (!isSafe) {
        return res.status(400).json({ success: false, error: SAFE_ERRORS.PATH_INVALID, code: 'PATH_INVALID' });
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
      const safe = toSafeError(error.message);
      const statusCode = error.cancelled ? 400 : 500;
      res.status(statusCode).json({ success: false, error: safe.message, code: safe.code });
    }
  });
}