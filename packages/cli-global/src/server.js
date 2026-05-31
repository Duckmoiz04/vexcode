import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPythonAnalysis } from './bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Workspace root: d:\DATN2
const workspaceDir = resolve(__dirname, '../../..');
const analysisCoreDir = resolve(__dirname, '../../analysis-core');
const defaultReportPath = resolve(analysisCoreDir, 'analysis_report.json');
const envPath = resolve(analysisCoreDir, '.env');

// Helper to check if path is within workspace (prevent directory traversal)
export function isPathSafe(targetPath, baseDir = workspaceDir) {
  const resolved = resolve(targetPath);
  // Ensure the path is strictly within the workspace
  // On Windows, drive letter case can be inconsistent, so normalize case
  return resolved.toLowerCase().startsWith(baseDir.toLowerCase());
}

// Read/write config helper
export function readEnvConfig() {
  if (!existsSync(envPath)) {
    return {};
  }
  try {
    const content = readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const config = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        const val = trimmed.slice(index + 1).trim();
        config[key] = val;
      }
    }
    return config;
  } catch (error) {
    console.error('Error reading env config:', error);
    return {};
  }
}

export function writeEnvConfig(newConfig) {
  try {
    // Preserve existing, merge new
    const current = readEnvConfig();
    const merged = { ...current, ...newConfig };
    const content = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n';
    writeFileSync(envPath, content, 'utf8');
  } catch (error) {
    console.error('Error writing env config:', error);
    throw error;
  }
}

const app = express();

app.use(cors());
app.use(express.json());

// GET /api/config
app.get('/api/config', (req, res) => {
  const config = readEnvConfig();
  res.json(config);
});

// POST /api/config
app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    writeEnvConfig(newConfig);
    res.json({ success: true, message: 'Configuration updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/scan
app.post('/api/scan', async (req, res) => {
  try {
    const { targetPath, mockScan, mockAi, reportPath } = req.body;
    
    // Resolve target path or fallback to workspaceDir
    const finalTarget = targetPath ? resolve(targetPath) : workspaceDir;
    
    // Resolve report path or fallback to default
    const finalReport = reportPath ? resolve(reportPath) : defaultReportPath;

    // Safety checks
    if (!isPathSafe(finalTarget)) {
      return res.status(400).json({ success: false, error: 'Target path is outside the workspace directory.' });
    }
    if (!isPathSafe(finalReport)) {
      return res.status(400).json({ success: false, error: 'Report output path is outside the workspace directory.' });
    }

    await runPythonAnalysis(finalTarget, finalReport, !!mockScan, !!mockAi);

    res.json({
      success: true,
      message: 'Scan execution complete',
      reportPath: finalReport
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/report
app.get('/api/report', (req, res) => {
  try {
    const reportFilePath = req.query.path ? resolve(req.query.path) : defaultReportPath;

    if (!isPathSafe(reportFilePath)) {
      return res.status(400).json({ success: false, error: 'Report path is outside the workspace directory.' });
    }

    if (!existsSync(reportFilePath)) {
      return res.status(404).json({ success: false, error: `Report file not found at ${reportFilePath}` });
    }

    const reportContent = readFileSync(reportFilePath, 'utf8');
    res.json(JSON.parse(reportContent));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/apply
app.post('/api/apply', (req, res) => {
  try {
    const { filePath, targetLine, targetContent, replacementContent } = req.body;

    if (!filePath || targetLine === undefined || targetContent === undefined || replacementContent === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required parameters: filePath, targetLine, targetContent, replacementContent.' });
    }

    const resolvedPath = resolve(filePath);
    if (!isPathSafe(resolvedPath)) {
      return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
    }

    if (!existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, error: `File not found at ${resolvedPath}` });
    }

    const fileContent = readFileSync(resolvedPath, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    const targetLines = targetContent.split(/\r?\n/);

    if (targetLine < 1 || targetLine + targetLines.length - 1 > lines.length) {
      return res.status(400).json({ success: false, error: `Target line ${targetLine} is out of file bounds.` });
    }

    const fileSegment = lines.slice(targetLine - 1, targetLine - 1 + targetLines.length).join('\n');
    
    // Normalize newlines for comparison
    const normalizedFileSegment = fileSegment.replace(/\r/g, '');
    const normalizedTarget = targetContent.replace(/\r/g, '');

    if (normalizedFileSegment.trim() !== normalizedTarget.trim() && !normalizedFileSegment.includes(normalizedTarget)) {
      return res.status(400).json({
        success: false,
        error: `Target content mismatch. Expected to find: "${targetContent.trim()}" but found: "${fileSegment.trim()}"`
      });
    }

    const replacedSegment = normalizedFileSegment.replace(normalizedTarget, replacementContent);
    const replacedLines = replacedSegment.split('\n');

    lines.splice(targetLine - 1, targetLines.length, ...replacedLines);

    const hasCRLF = fileContent.includes('\r\n');
    const newFileContent = lines.join(hasCRLF ? '\r\n' : '\n');

    writeFileSync(resolvedPath, newFileContent, 'utf8');

    res.json({
      success: true,
      message: 'Vulnerability resolution applied successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export function startServer(port = 3000) {
  return app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export { app };
