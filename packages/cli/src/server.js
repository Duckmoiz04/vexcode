import express from 'express';
import cors from 'cors';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

import { runPythonAnalysis, cancelActiveScan, runPythonReResolve } from './bridge.js';
import { isPathSafe, readEnvConfig, writeEnvConfig } from './services/fileService.js';

import { registerConfigRoutes } from './routes/config.js';
import { registerScanRoutes } from './routes/scan.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerApplyRoutes } from './routes/apply.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerFileRoutes } from './routes/files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workspaceDir = resolve(__dirname, '../../..');
const analysisCoreDir = resolve(__dirname, '../../engine');
const envPath = resolve(analysisCoreDir, '.env');
const publicDir = resolve(__dirname, 'public');
const reportsBaseDir = join(homedir(), '.vexcode', 'reports');
const backupsBaseDir = join(homedir(), '.vexcode', 'backups');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

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
  runPythonReResolve,
};

registerConfigRoutes(app, deps);
registerScanRoutes(app, deps);
registerReportRoutes(app, deps);
registerApplyRoutes(app, deps);
registerChatRoutes(app, deps);
registerFileRoutes(app, deps);

export function startServer(port = 3000) {
  mkdirSync(reportsBaseDir, { recursive: true });

  return app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Reports stored at: ${reportsBaseDir}`);
  });
}

export { app };