import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';

export function registerFileRoutes(app, deps) {
  const { isPathSafe, workspaceDir, readEnvConfig, envPath } = deps;

  /**
   * Resolve a request path safely.
   *
   * Finding file paths are stored relative to the scanned project's root
   * (the `target_path` used during scan). When the frontend calls this
   * endpoint it sends the original `filePath` plus the scan's `baseDir`
   * (== `target_path`).
   *
   * Because Opengrep may emit paths relative to the scan target OR relative
   * to the workspace root (depending on version/invocation), we try several
   * candidates in order and return the first one that actually exists:
   *   1. Absolute paths as-is
   *   2. Relative to baseDir (scan target)
   *   3. Relative to workspaceDir
   *   4. Legacy: relative to process.cwd()
   *
   * The returned path is always validated with `isPathSafe`.
   */
  const resolveRequestPath = (filePath, baseDir) => {
    if (!filePath) return null;

    // 1. Absolute path (Windows drive letter or Unix leading slash)
    //    Return as-is — the route handler's isPathSafe check validates it.
    if (filePath.includes(':') || filePath.startsWith('/')) {
      return resolve(filePath);
    }

    // 2. Relative to the scan target (baseDir).
    //    If baseDir itself is outside the workspace, treat it as invalid.
    if (baseDir) {
      const resolvedBase = resolve(baseDir);
      if (!isPathSafe(resolvedBase, workspaceDir)) {
        return null; // caller will emit 'Invalid base directory.'
      }
      const candidate = resolve(resolvedBase, filePath);
      if (existsSync(candidate)) return candidate;
    }

    // 3. Relative to the workspace root
    const workspaceCandidate = resolve(workspaceDir, filePath);
    if (existsSync(workspaceCandidate)) return workspaceCandidate;

    // 4. Legacy fallback: relative to process.cwd()
    //    Return as-is — route handler validates with isPathSafe.
    return resolve(filePath);
  };

  app.get('/api/file-content', (req, res) => {
    try {
      const filePath = req.query.path;
      const baseDir = req.query.baseDir;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: path.' });
      }

      const resolvedPath = resolveRequestPath(filePath, baseDir);
      if (!resolvedPath) {
        return res.status(400).json({ success: false, error: 'Invalid base directory.' });
      }
      // When baseDir is provided (scan target), validate against it.
      // When baseDir is absent (legacy), validate against workspaceDir.
      const securityBase = baseDir ? resolve(baseDir) : workspaceDir;
      if (!isPathSafe(resolvedPath, securityBase)) {
        return res.status(400).json({ success: false, error: 'File path is outside the allowed directory.' });
      }

      if (!existsSync(resolvedPath)) {
        return res.status(404).json({ success: false, error: `File not found at ${resolvedPath} (baseDir=${baseDir || 'none'}, workspaceDir=${workspaceDir})` });
      }

      const content = readFileSync(resolvedPath, 'utf8');
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/line-map', (req, res) => {
    try {
      const { path: filePath, line, codeText, baseDir } = req.query;
      if (!filePath || line === undefined || !codeText) {
        return res.status(400).json({ success: false, error: 'Missing required parameters: path, line, codeText' });
      }

      const resolvedPath = resolveRequestPath(filePath, baseDir);
      if (!resolvedPath) {
        return res.status(400).json({ success: false, error: 'Invalid base directory.' });
      }
      const securityBase = baseDir ? resolve(baseDir) : workspaceDir;
      if (!isPathSafe(resolvedPath, securityBase)) {
        return res.status(400).json({ success: false, error: 'File path is outside the allowed directory.' });
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
      const { filePath, line, baseDir } = req.body;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: filePath.' });
      }

      const resolvedPath = resolveRequestPath(filePath, baseDir);
      if (!resolvedPath) {
        return res.status(400).json({ success: false, error: 'Invalid base directory.' });
      }
      const securityBase = baseDir ? resolve(baseDir) : workspaceDir;
      if (!isPathSafe(resolvedPath, securityBase)) {
        return res.status(400).json({ success: false, error: 'File path is outside the allowed directory.' });
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