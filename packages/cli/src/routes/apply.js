import { resolve } from 'node:path';
import { backupFile, applyFixToFile, rollbackFile } from '../services/backupService.js';

export function registerApplyRoutes(app, deps) {
  const { isPathSafe, workspaceDir, backupsBaseDir } = deps;

  app.post('/api/apply', (req, res) => {
    try {
      const { filePath, targetLine, targetContent, replacementContent, codeText } = req.body;

      if (!filePath || targetLine === undefined || targetContent === undefined || replacementContent === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required parameters: filePath, targetLine, targetContent, replacementContent.' });
      }

      if (typeof filePath !== 'string' || typeof targetLine !== 'number' || typeof targetContent !== 'string' || typeof replacementContent !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid parameter types: filePath must be a string, targetLine must be a number, targetContent must be a string, replacementContent must be a string.' });
      }

      const resolvedPath = resolve(filePath);
      if (!isPathSafe(resolvedPath, workspaceDir)) {
        return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
      }

      backupFile(resolvedPath, backupsBaseDir);

      const result = applyFixToFile(resolvedPath, targetLine, targetContent, replacementContent, codeText);
      if (!result.success) {
        return res.status(400).json(result);
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
      const { filePath } = req.body;

      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: filePath.' });
      }

      const resolvedPath = resolve(filePath);
      if (!isPathSafe(resolvedPath, workspaceDir)) {
        return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
      }

      const result = rollbackFile(resolvedPath, backupsBaseDir);
      if (!result.success) {
        return res.status(404).json(result);
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