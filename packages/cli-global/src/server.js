import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { runPythonAnalysis, cancelActiveScan } from './bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Workspace root: d:\DATN2
const workspaceDir = resolve(__dirname, '../../..');
const analysisCoreDir = resolve(__dirname, '../../analysis-core');
const envPath = resolve(analysisCoreDir, '.env');
const publicDir = resolve(__dirname, 'public');

// Centralized report storage: ~/.ai-code-review/reports/
const reportsBaseDir = join(homedir(), '.ai-code-review', 'reports');

// Helper: get project name from path (last folder name)
function getProjectName(targetPath) {
  const name = basename(targetPath);
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Helper: get project report directory
function getProjectReportDir(projectName) {
  return join(reportsBaseDir, projectName);
}

// Helper: generate report filename from timestamp
function getReportFilename() {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `report_${ts}.json`;
}

// Helper to check if path is within workspace (prevent directory traversal)
export function isPathSafe(targetPath, baseDir = workspaceDir) {
  const resolved = resolve(targetPath);
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

// Serve static assets from src/public
app.use(express.static(publicDir));

// GET /api/file-content
app.get('/api/file-content', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: path.' });
    }

    const resolvedPath = resolve(filePath);
    if (!isPathSafe(resolvedPath)) {
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

// POST /api/scan/cancel
app.post('/api/scan/cancel', (req, res) => {
  const cancelled = cancelActiveScan();
  res.json({ success: true, cancelled });
});

// GET /api/scan/stream (SSE)
app.get('/api/scan/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    const { targetPath, mockScan, mockAi, fastScan } = req.query;
    const finalTarget = targetPath ? resolve(targetPath) : workspaceDir;

    if (!isPathSafe(finalTarget)) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Target path is outside the workspace directory.' })}\n\n`);
      return res.end();
    }

    const projectName = getProjectName(finalTarget);
    const projectDir = getProjectReportDir(projectName);
    mkdirSync(projectDir, { recursive: true });
    const reportFilename = getReportFilename();
    const reportPath = join(projectDir, reportFilename);

    // Send initial status event to satisfy tests expecting data: {"type":"status",
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

// GET /api/line-map
app.get('/api/line-map', (req, res) => {
  try {
    const { path: filePath, line, codeText } = req.query;
    if (!filePath || line === undefined || !codeText) {
      return res.status(400).json({ success: false, error: 'Missing required parameters: path, line, codeText' });
    }

    const resolvedPath = resolve(filePath);
    if (!isPathSafe(resolvedPath)) {
      return res.status(400).json({ success: false, error: 'File path is outside the workspace directory.' });
    }

    if (!existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, error: 'File not found.' });
    }

    const targetLineNum = parseInt(line, 10);
    const fileContent = readFileSync(resolvedPath, 'utf8');
    const lines = fileContent.split(/\r?\n/);

    // 1. Check if original line matches
    if (targetLineNum >= 1 && targetLineNum <= lines.length) {
      const originalLineContent = lines[targetLineNum - 1];
      if (originalLineContent.includes(codeText) || originalLineContent.trim() === codeText.trim()) {
        return res.json({ success: true, mappedLine: targetLineNum });
      }
    }

    // 2. Otherwise search for closest matching line
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

// POST /api/scan
app.post('/api/scan', async (req, res) => {
  try {
    const { targetPath, mockScan, mockAi, fastScan } = req.body;

    const finalTarget = targetPath ? resolve(targetPath) : workspaceDir;

    if (!isPathSafe(finalTarget)) {
      return res.status(400).json({ success: false, error: 'Target path is outside the workspace directory.' });
    }

    // Generate report path in centralized storage
    const projectName = getProjectName(finalTarget);
    const projectDir = getProjectReportDir(projectName);
    mkdirSync(projectDir, { recursive: true });
    const reportFilename = getReportFilename();
    const reportPath = join(projectDir, reportFilename);

    await runPythonAnalysis(finalTarget, reportPath, !!mockScan, !!mockAi, !!fastScan);

    // Read the saved report to return it
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

// GET /api/reports - List all projects with reports
app.get('/api/reports', (req, res) => {
  try {
    if (!existsSync(reportsBaseDir)) {
      return res.json({ success: true, projects: [] });
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
          // Read latest report to get metadata
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
              findings: latestReport.findings?.length || 0
            }
          });
        }
      }
    }

    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reports/:project - List reports for a project
app.get('/api/reports/:project', (req, res) => {
  try {
    const projectName = req.params.project;
    const projectDir = getProjectReportDir(projectName);

    if (!existsSync(projectDir)) {
      return res.status(404).json({ success: false, error: `Project "${projectName}" not found.` });
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
        findings: report.findings?.length || 0
      };
    });

    res.json({ success: true, project: projectName, reports: reportList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/report/:project/:id - Get specific report
app.get('/api/report/:project/:id', (req, res) => {
  try {
    const projectName = req.params.project;
    const reportId = req.params.id;
    const reportPath = join(getProjectReportDir(projectName), `${reportId}.json`);

    if (!existsSync(reportPath)) {
      return res.status(404).json({ success: false, error: 'Report not found.' });
    }

    const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
    reportContent._id = reportId;
    reportContent._project = projectName;

    res.json(reportContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/report - Get latest report (backward compatible)
app.get('/api/report', (req, res) => {
  try {
    // If path query provided, use legacy behavior
    if (req.query.path) {
      const reportFilePath = resolve(req.query.path);
      if (!isPathSafe(reportFilePath)) {
        return res.status(400).json({ success: false, error: 'Report path is outside the workspace directory.' });
      }
      if (!existsSync(reportFilePath)) {
        return res.status(404).json({ success: false, error: `Report file not found at ${reportFilePath}` });
      }
      const reportContent = readFileSync(reportFilePath, 'utf8');
      return res.json(JSON.parse(reportContent));
    }

    // Otherwise, get latest report from centralized storage
    if (!existsSync(reportsBaseDir)) {
      return res.status(404).json({ success: false, error: 'No reports found.' });
    }

    const projects = readdirSync(reportsBaseDir);
    if (projects.length === 0) {
      return res.status(404).json({ success: false, error: 'No reports found.' });
    }

    // Find the most recent report across all projects
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
      return res.status(404).json({ success: false, error: 'No reports found.' });
    }

    const content = JSON.parse(readFileSync(latestReport.path, 'utf8'));
    content._id = latestReport.id;
    content._project = latestReport.project;

    res.json(content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/apply
app.post('/api/apply', (req, res) => {
  try {
    const { filePath, targetLine, targetContent, replacementContent, codeText } = req.body;

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

    let lineToUse = parseInt(targetLine, 10);

    if (codeText) {
      // Resolve line mapping first
      let closestLine = -1;
      let minDiff = Infinity;

      for (let i = 0; i < lines.length; i++) {
        const currentLineContent = lines[i];
        if (currentLineContent.includes(codeText) || currentLineContent.trim() === codeText.trim()) {
          const lineNum = i + 1;
          const diff = Math.abs(lineNum - lineToUse);
          if (diff < minDiff) {
            minDiff = diff;
            closestLine = lineNum;
          }
        }
      }

      if (closestLine !== -1) {
        lineToUse = closestLine;
      }
    }

    if (lineToUse < 1 || lineToUse + targetLines.length - 1 > lines.length) {
      return res.status(400).json({ success: false, error: `Target line ${lineToUse} is out of file bounds.` });
    }

    const fileSegment = lines.slice(lineToUse - 1, lineToUse - 1 + targetLines.length).join('\n');

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

    lines.splice(lineToUse - 1, targetLines.length, ...replacedLines);

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

// GET /api/models - Fetch available models from a provider
app.get('/api/models', async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.query;

    if (!baseUrl) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: baseUrl' });
    }

    // Build the models endpoint URL
    const modelsUrl = `${baseUrl.replace(/\/$/, '')}/models`;

    // Make request to the provider
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(modelsUrl, { headers });

    if (!response.ok) {
      // If provider doesn't support /models endpoint, return empty list
      return res.json({ success: true, models: [] });
    }

    const data = await response.json();

    // Normalize the response based on provider format
    let models = [];

    // OpenAI format: { data: [{ id: "model-name", ... }] }
    if (data.data && Array.isArray(data.data)) {
      models = data.data.map(m => ({
        id: m.id,
        name: m.id,
        owned_by: m.owned_by || ''
      }));
    }
    // Anthropic format is different, but they don't have a public models endpoint
    // Google format: { models: [{ name: "models/gemini-1.5-flash", ... }] }
    else if (data.models && Array.isArray(data.models)) {
      models = data.models.map(m => ({
        id: m.name?.replace('models/', '') || m.id,
        name: m.displayName || m.name?.replace('models/', '') || m.id,
        owned_by: m.supportedGenerationMethods?.includes('generateContent') ? 'google' : ''
      }));
    }

    // Sort models by name
    models.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, models });
  } catch (error) {
    // If fetch fails, return empty list (provider might be offline)
    console.error('Error fetching models:', error.message);
    res.json({ success: true, models: [] });
  }
});

// POST /api/chat - Chat with AI about a finding
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, provider, apiKey, baseUrl, model, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: messages' });
    }

    // API key is optional for 9router (runs locally)
    if (!apiKey && provider !== '9router') {
      return res.status(400).json({ success: false, error: 'Missing API key' });
    }

    // Build the chat request based on provider
    const chatBaseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const chatModel = model || 'gpt-4o-mini';
    const chatTemp = temperature || 0.7;
    const chatMaxTokens = maxTokens || 2048;

    // Prepare headers based on provider
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let response;
    let responseData;

    try {
      if (provider === 'anthropic') {
        // Anthropic Messages API format
        const systemMsg = messages.find(m => m.role === 'system');
        const userMsgs = messages.filter(m => m.role !== 'system');

        const payload = {
          model: chatModel,
          max_tokens: chatMaxTokens,
          temperature: chatTemp,
          system: systemMsg?.content || '',
          messages: userMsgs.map(m => ({ role: m.role, content: m.content }))
        };

        response = await fetch(`${chatBaseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey || '',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        try {
          responseData = JSON.parse(responseText);
          const contentBlocks = responseData.content || [];
          const content = contentBlocks
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n');
          res.json({ success: true, response: content });
        } catch (parseError) {
          res.json({ success: true, response: responseText });
        }

      } else if (provider === 'google') {
        // Google Gemini API format
        const contents = messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            parts: [{ text: m.content }]
          }));

        const payload = {
          contents,
          generationConfig: {
            temperature: chatTemp,
            maxOutputTokens: chatMaxTokens
          }
        };

        response = await fetch(`${chatBaseUrl}/v1beta/models/${chatModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        try {
          responseData = JSON.parse(responseText);
          const candidates = responseData.candidates || [];
          const content = candidates.length > 0
            ? (candidates[0].content?.parts || []).map(p => p.text || '').join('\n')
            : '';
          res.json({ success: true, response: content });
        } catch (parseError) {
          res.json({ success: true, response: responseText });
        }

      } else {
        // OpenAI-compatible format (OpenAI, 9router, Ollama, LM Studio, etc.)
        const payload = {
          model: chatModel,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: chatTemp,
          max_tokens: chatMaxTokens
        };

        response = await fetch(`${chatBaseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        // Get response text first, then try to parse as JSON
        const responseText = await response.text();

        try {
          responseData = JSON.parse(responseText);
          const content = responseData.choices?.[0]?.message?.content || '';
          res.json({ success: true, response: content });
        } catch (parseError) {
          // If not valid JSON, return the raw text (might be a streaming response or plain text)
          console.log('Response is not JSON, returning raw text:', responseText.substring(0, 200));
          res.json({ success: true, response: responseText });
        }
      }
    } catch (fetchError) {
      console.error('Provider request failed:', fetchError.message);
      res.status(500).json({ success: false, error: `Provider request failed: ${fetchError.message}` });
    }
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export function startServer(port = 3000) {
  // Ensure reports directory exists
  mkdirSync(reportsBaseDir, { recursive: true });

  return app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Reports stored at: ${reportsBaseDir}`);
  });
}

export { app };
