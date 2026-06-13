#!/usr/bin/env node
/**
 * Postinstall hook — download the Opengrep binary if not already present.
 * Spawns the engine's Python installer script so Node and Python share
 * the same download logic.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const engineDir = resolve(__dirname, '../../engine');
const installerScript = resolve(engineDir, 'scripts/install_opengrep.py');
const pythonExt = platform() === 'win32' ? 'python.exe' : 'python3';
const pythonCmd = platform() === 'win32' ? 'python' : 'python3';

function findPython() {
  // Try python3 first, then python
  const candidates = platform() === 'win32'
    ? ['python', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      const result = spawn.sync(cmd, ['--version'], { stdio: 'pipe' });
      if (result.status === 0) return cmd;
    } catch { /* not found */ }
  }
  return null;
}

async function main() {
  const python = findPython();
  if (!python) {
    console.log('[opengrep] Python not found — skipping auto-install. Run `python scripts/install_opengrep.py` in packages/engine manually.');
    return;
  }

  const child = spawn(python, [installerScript], {
    cwd: engineDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => process.stdout.write(`  ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`  ${data}`));

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        console.log('[opengrep] ✓ Binary ready.');
        resolve();
      } else {
        console.log(`[opengrep] ⚠ Installer exited with code ${code} — run it manually if needed.`);
        resolve(); // don't fail the npm install
      }
    });
    child.on('error', (err) => {
      console.log(`[opengrep] ⚠ Could not launch installer: ${err.message}`);
      resolve(); // don't fail the npm install
    });
  });
}

main();
