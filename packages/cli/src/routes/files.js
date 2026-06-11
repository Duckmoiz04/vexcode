import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';

export function registerFileRoutes(app, deps) {
  const { isPathSafe, workspaceDir, readEnvConfig, envPath } = deps;

  app.get('/api/file-content', (req, res) => {
    try {
      const filePath = req.query.path;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: path.' });
      }

      const resolvedPath = resolve(filePath);
      if (!isPathSafe(resolvedPath, workspaceDir)) {
        return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
      }

      if (!existsSync(resolvedPath)) {
        return res.status(404).json({ success: false, error: `File not found at ${resolvedPath}` });
      }

      const content = readFileSync(resolvedPath, 'utf8');
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/line-map', (req, res) => {
    try {
      const { path: filePath, line, codeText } = req.query;
      if (!filePath || line === undefined || !codeText) {
        return res.status(400).json({ success: false, error: 'Missing required parameters: path, line, codeText' });
      }

      const resolvedPath = resolve(filePath);
      if (!isPathSafe(resolvedPath, workspaceDir)) {
        return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
      }

      if (!existsSync(resolvedPath)) {
        return res.status(404).json({ success: false, error: 'File not found.' });
      }

      const targetLineNum = parseInt(line, 10);
      const fileContent = readFileSync(resolvedPath, 'utf8');
      const lines = fileContent.split(/\r?\n/);

      if (targetLineNum >= 1 && targetLineNum <= lines.length) {
        const originalLineContent = lines[targetLineNum - 1];
        if (originalLineContent.includes(codeText) || originalLineContent.trim() === codeText.trim()) {
          return res.json({ success: true, mappedLine: targetLineNum });
        }
      }

      let closestLine = -1;
      let minDiff = Infinity;

      for (let i = 0; i < lines.length; i++) {
        const currentLineContent = lines[i];
        if (currentLineContent.includes(codeText) || currentLineContent.trim() === codeText.trim()) {
          const lineNum = i + 1;
          const diff = Math.abs(lineNum - targetLineNum);
          if (diff < minDiff) {
            minDiff = diff;
            closestLine = lineNum;
          }
        }
      }

      if (closestLine !== -1) {
        return res.json({ success: true, mappedLine: closestLine });
      }

      return res.status(404).json({ success: false, error: 'Target code text not found in file.' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/open-in-ide', (req, res) => {
    try {
      const { filePath, line } = req.body;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: filePath.' });
      }

      const resolvedPath = resolve(filePath);
      if (!isPathSafe(resolvedPath, workspaceDir)) {
        return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
      }

      const lineSuffix = line !== undefined ? `:${line}` : '';
      const config = readEnvConfig(envPath);
      const ideCommand = config.IDE_COMMAND || 'code';

      const cmd = `"${ideCommand}" --goto "${resolvedPath}${lineSuffix}"`;
      console.log(`Running open IDE command: ${cmd}`);

      exec(cmd, (err) => {
        if (err) {
          if (ideCommand === 'code') {
            const fallbackCmd = `cursor --goto "${resolvedPath}${lineSuffix}"`;
            console.log(`VS Code failed, trying Cursor fallback: ${fallbackCmd}`);
            exec(fallbackCmd, (fallbackErr) => {
              if (fallbackErr) {
                return res.status(500).json({ success: false, error: `Failed to open in IDE (tried code and cursor): ${err.message}` });
              }
              res.json({ success: true, message: 'Opened in IDE (Cursor fallback)' });
            });
          } else {
            return res.status(500).json({ success: false, error: `Failed to open in IDE: ${err.message}` });
          }
        } else {
          res.json({ success: true, message: 'Opened in IDE' });
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}