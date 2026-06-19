import express from 'express';
import cors from 'cors';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { rateLimit } from 'express-rate-limit';

import { runPythonAnalysis, cancelActiveScan, runRefreshAi, runConfigCli } from './bridge.js';
import { isPathSafe, readEnvConfig, writeEnvConfig } from './services/fileService.js';
import { authMiddleware, getApiKey } from './middleware/auth.js';

import { registerConfigRoutes } from './routes/config.js';
import { registerAiSettingsRoutes } from './routes/ai-settings.js';
import { registerScanRoutes } from './routes/scan.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerApplyRoutes } from './routes/apply.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerFileRoutes } from './routes/files.js';
import { registerFindingsRoutes } from './routes/findings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workspaceDir = resolve(__dirname, '../../..');
const analysisCoreDir = resolve(__dirname, '../../engine');
const vexcodeDir = join(homedir(), '.vexcode');
const envPath = join(vexcodeDir, '.env');

const publicDir = resolve(__dirname, 'public');
const reportsBaseDir = join(homedir(), '.vexcode', 'reports');
const backupsBaseDir = join(homedir(), '.vexcode', 'backups');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' })); // Phase 3.2 — body size limit

// ── Rate limiting (Phase 2.1) ──────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
});

const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many scan requests. Please try again later.', code: 'RATE_LIMITED' },
});

// Apply global rate limiter to /api routes before auth.
app.use('/api', globalLimiter);

// Auth middleware for all API routes (exempt SSE stream and static files).
app.use('/api', (req, res, next) => {
  // SSE stream endpoint uses ?token= query param (EventSource lacks header support).
  if (req.path === '/scan/stream' && req.method === 'GET') {
    return next();
  }
  // Expose the API key to the frontend (unauthenticated — needed for initial handshake).
  if (req.path === '/auth/key' && req.method === 'GET') {
    return next();
  }
  authMiddleware(req, res, next);
});

const deps = {
  workspaceDir,
  analysisCoreDir,
  envPath,
  publicDir,
  reportsBaseDir,
  backupsBaseDir,
  isPathSafe,
  readEnvConfig,
  writeEnvConfig,
  runPythonAnalysis,
  cancelActiveScan,
  runRefreshAi,
  runConfigCli,
  scanLimiter,
};

registerConfigRoutes(app, deps);
registerAiSettingsRoutes(app, deps);
registerScanRoutes(app, deps);
registerReportRoutes(app, deps);
registerApplyRoutes(app, deps);
registerChatRoutes(app, deps);
registerFileRoutes(app, deps);
registerFindingsRoutes(app, deps);

// Expose the generated API key so the frontend can include it in requests.
app.get('/api/auth/key', (req, res) => {
  res.json({ apiKey: getApiKey() });
});

// Catch-all for unmatched /api/* routes — return JSON 404, never HTML
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// Static file serving for the SPA
app.use(express.static(publicDir));

// Global error handler — catch anything Express would format as HTML and return JSON instead
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

export function startServer(port = 3000) {
  mkdirSync(vexcodeDir, { recursive: true });

  // Migration from old location (packages/engine/.env)
  const oldEnvPath = resolve(analysisCoreDir, '.env');
  if (existsSync(oldEnvPath) && !existsSync(envPath)) {
    copyFileSync(oldEnvPath, envPath);
    console.log(`Migrated .env from ${oldEnvPath} to ${envPath}`);
  }

  mkdirSync(reportsBaseDir, { recursive: true });

  return app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Reports stored at: ${reportsBaseDir}`);
  });
}

export { app };