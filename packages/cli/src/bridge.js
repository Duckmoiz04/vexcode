import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const analysisCoreDir = resolve(__dirname, '../../engine');

export function getPythonPath() {
  const isWindows = platform() === 'win32';
  const pythonRelativePath = isWindows
    ? '.venv/Scripts/python.exe'
    : '.venv/bin/python';
  return resolve(analysisCoreDir, pythonRelativePath);
}

let activeScan = null;

/**
 * Run the Python Analysis Core subprocess.
 * @param {string} targetPath - The path to run scanning on.
 * @param {string} reportOutputPath - The path where the scanner JSON report should be saved.
 * @param {boolean} [mockScan=false] - Use mock scan findings.
 * @param {boolean} [mockAi=false] - Use mock AI suggestions.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export function runPythonAnalysis(targetPath, reportOutputPath, mockScan = false, mockAi = false, fastScan = false, onProgress = null) {
  return new Promise((resolvePromise, rejectPromise) => {
    const pythonPath = getPythonPath();

    if (!existsSync(pythonPath)) {
      return rejectPromise(new Error(`Python interpreter not found at ${pythonPath}. Please ensure .venv is set up in packages/engine.`));
    }

    const args = [
      'main.py',
      '--target', targetPath,
      '--output', reportOutputPath
    ];

    if (mockScan) {
      args.push('--mock-scan');
    }
    if (mockAi) {
      args.push('--mock-ai');
    }
    if (fastScan) {
      args.push('--fast');
    }

    console.log(`Spawning Python process: ${pythonPath} ${args.join(' ')}`);

    const child = spawn(pythonPath, args, {
      cwd: analysisCoreDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const scanRecord = { child, cancelled: false };
    activeScan = scanRecord;

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onProgress) {
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines) {
          onProgress({ type: 'stdout', line });
        }
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      // Display progress in real-time
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        console.log(`  \x1b[90m[python]\x1b[0m ${line}`);
        if (onProgress) {
          onProgress({ type: 'stderr', line });
        }
      }
    });

    child.on('close', (code) => {
      if (activeScan === scanRecord) {
        activeScan = null;
      }
      if (scanRecord.cancelled) {
        const err = new Error('Scan cancelled by user');
        err.cancelled = true;
        rejectPromise(err);
        return;
      }
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        rejectPromise(new Error(`Python process exited with code ${code}.\nStdout: ${stdout}\nStderr: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      if (activeScan === scanRecord) {
        activeScan = null;
      }
      rejectPromise(err);
    });
  });
}

/**
 * Cancel the active running scan, if any.
 * @returns {boolean} True if cancellation was requested, false if no active scan was running.
 */
export function cancelActiveScan() {
  if (activeScan && activeScan.child) {
    activeScan.cancelled = true;
    activeScan.child.kill();
    return true;
  }
  return false;
}

/**
 * Run scan and return parsed report object.
 * @param {string} targetPath
 * @param {string} reportOutputPath
 * @param {boolean} [mockScan=false]
 * @param {boolean} [mockAi=false]
 * @param {boolean} [fastScan=false]
 * @returns {Promise<object>} Parsed report JSON
 */
export async function runScanAndReadReport(targetPath, reportOutputPath, mockScan = false, mockAi = false, fastScan = false) {
  await runPythonAnalysis(targetPath, reportOutputPath, mockScan, mockAi, fastScan);

  if (!existsSync(reportOutputPath)) {
    throw new Error(`Report file not found at ${reportOutputPath} after scan.`);
  }

  const content = readFileSync(reportOutputPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Run the Python Analysis Core subprocess in refresh-ai mode.
 * @param {string} reportPath - The path to the existing report to re-run AI on.
 * @param {boolean} [mockAi=false] - Use mock AI suggestions.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export function runRefreshAi(reportPath, mockAi = false, onProgress = null) {
  return new Promise((resolvePromise, rejectPromise) => {
    const pythonPath = getPythonPath();

    if (!existsSync(pythonPath)) {
      return rejectPromise(new Error(`Python interpreter not found at ${pythonPath}. Please ensure .venv is set up in packages/engine.`));
    }

    const args = [
      'main.py',
      '--refresh-ai', reportPath
    ];

    if (mockAi) {
      args.push('--mock-ai');
    }

    console.log(`Spawning Python process for refresh-ai: ${pythonPath} ${args.join(' ')}`);

    const child = spawn(pythonPath, args, {
      cwd: analysisCoreDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const scanRecord = { child, cancelled: false };
    activeScan = scanRecord;

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onProgress) {
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines) {
          onProgress({ type: 'stdout', line });
        }
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      // Display progress in real-time
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        console.log(`  \x1b[90m[python]\x1b[0m ${line}`);
        if (onProgress) {
          onProgress({ type: 'stderr', line });
        }
      }
    });

    child.on('close', (code) => {
      if (activeScan === scanRecord) {
        activeScan = null;
      }
      if (scanRecord.cancelled) {
        const err = new Error('Re-resolve cancelled by user');
        err.cancelled = true;
        rejectPromise(err);
        return;
      }
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        rejectPromise(new Error(`Python process exited with code ${code}.\nStdout: ${stdout}\nStderr: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      if (activeScan === scanRecord) {
        activeScan = null;
      }
      rejectPromise(err);
    });
  });
}
