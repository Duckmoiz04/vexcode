import { resolve } from 'node:path';
import { backupFile, applyFixToFile, rollbackFile } from '../services/backupService.js';
import { markFindingApplied, updateFindingStatus } from '../services/reportService.js';
import { getKnownProjectPaths, isPathUnderKnownProjects } from '../utils.js';

export function registerApplyRoutes(app, deps) {
  const { isPathSafe, workspaceDir, backupsBaseDir, reportsBaseDir } = deps;

  app.post('/api/apply', (req, res) => {
    try {
      const { filePath, targetLine, targetContent, replacementContent, codeText, reportPath, findingId, findingFile, findingLine, findingRuleId } = req.body;

      if (!filePath || targetLine === undefined || targetContent === undefined || replacementContent === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required parameters: filePath, targetLine, targetContent, replacementContent.' });
      }

      if (typeof filePath !== 'string' || typeof targetLine !== 'number' || typeof targetContent !== 'string' || typeof replacementContent !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid parameter types: filePath must be a string, targetLine must be a number, targetContent must be a string, replacementContent must be a string.' });
      }

      const resolvedPath = resolve(filePath);
      const knownPaths = getKnownProjectPaths(reportsBaseDir);
      const isSafe = isPathSafe(resolvedPath, workspaceDir) || isPathUnderKnownProjects(resolvedPath, knownPaths);
      if (!isSafe) {
        return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
      }

      backupFile(resolvedPath, backupsBaseDir);

      const result = applyFixToFile(resolvedPath, targetLine, targetContent, replacementContent, codeText);
      if (!result.success) {
        return res.status(400).json(result);
      }

      // Persist status to report JSON (optional: reportPath + findingId required)
      if (reportPath && (findingId || (findingFile && findingLine !== undefined && findingRuleId))) {
        try {
          const locator = findingId
            ? { id: findingId }
            : { file: findingFile, line: findingLine, rule_id: findingRuleId };
          markFindingApplied(reportPath, locator);
        } catch (persistErr) {
          // Don't fail the apply if status persistence fails — log and continue
          console.error('Failed to persist finding status:', persistErr.message);
        }
      }

      res.json({
        success: true,
        message: 'Vulnerability resolution applied successfully.'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/rollback', (req, res) => {
    try {
      const { filePath, reportPath, findingId, findingFile, findingLine, findingRuleId } = req.body;

      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: filePath.' });
      }

      const resolvedPath = resolve(filePath);
      const knownPaths = getKnownProjectPaths(reportsBaseDir);
      const isSafe = isPathSafe(resolvedPath, workspaceDir) || isPathUnderKnownProjects(resolvedPath, knownPaths);
      if (!isSafe) {
        return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
      }

      const result = rollbackFile(resolvedPath, backupsBaseDir);
      if (!result.success) {
        return res.status(404).json(result);
      }

      // Persist status to report JSON (set back to 'open')
      if (reportPath && (findingId || (findingFile && findingLine !== undefined && findingRuleId))) {
        try {
          const locator = findingId
            ? { id: findingId }
            : { file: findingFile, line: findingLine, rule_id: findingRuleId };
          updateFindingStatus(reportPath, locator, 'open');
        } catch (persistErr) {
          console.error('Failed to update finding status on rollback:', persistErr.message);
        }
      }

      res.json({
        success: true,
        message: 'Vulnerability resolution rolled back successfully.'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}