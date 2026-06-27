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

/**
 * Ensure the Python virtual environment exists.
 * @returns {string} The resolved Python path.
 * @throws {Error} If the Python interpreter is not found, with an actionable setup command.
 */
export function ensureVenv() {
  const pythonPath = getPythonPath();
  if (!existsSync(pythonPath)) {
    throw new Error(
      `Python interpreter not found at ${pythonPath}.` +
      `\nEnsure .venv is set up:\n  cd packages/engine && python -m venv .venv`
    );
  }
  return pythonPath;
}

let activeScan = null;

/**
 * Run the Python Analysis Core subprocess.
 * @param {string} targetPath - The path to run scanning on.
 * @param {string} reportOutputPath - The path where the scanner JSON report should be saved.
 * @param {boolean} [mockScan=false] - Use mock scan findings.
 * @param {boolean} [mockAi=false] - Use mock AI suggestions.
 * @param {boolean} [fastScan=false] - Run incremental scan on changed files (git).
 * @param {boolean} [noSarif=false] - Skip SARIF 2.1.0 sidecar report.
 * @param {function} [onProgress=null] - Optional progress callback.
 * @param {object} [extra={}] - Additional flags: format, thresholdsPath, explain, failOnThreshold.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export function runPythonAnalysis(targetPath, reportOutputPath, mockScan = false, mockAi = false, fastScan = false, noSarif = false, onProgress = null, extra = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    let pythonPath;
    try {
      pythonPath = ensureVenv();
    } catch (err) {
      return rejectPromise(err);
    }

    // Use -u flag for unbuffered stdout — critical when piped through Node.js.
    // Without this, Python buffers stdout and progress lines are never received
    // by the SSE stream until the buffer fills (causing the UI to hang).
    const args = [
      '-u',
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
    if (noSarif) {
      args.push('--no-sarif');
    }
    if (extra.format && extra.format !== 'json') {
      args.push('--format', extra.format);
    }
    if (extra.thresholdsPath) {
      args.push('--thresholds', extra.thresholdsPath);
    }
    if (extra.explain) {
      args.push('--explain');
    }
    if (extra.failOnThreshold) {
      args.push('--fail-on-threshold');
    }

    console.log(`Spawning Python process: ${pythonPath} ${args.join(' ')}`);

    const child = spawn(pythonPath, args, {
      cwd: analysisCoreDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
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
          // Detect structured JSON progress lines from the Python engine
          if (line.startsWith('{')) {
            try {
              const parsed = JSON.parse(line);
              if (parsed && parsed.type === 'progress') {
                onProgress(parsed);
                continue;
              }
            } catch {
              // Not JSON — fall through to plain text
            }
          }
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
 * Run the config_cli.py helper to read/write AI configuration.
 * @param {'dump'|'update'} command - The config CLI command.
 * @param {object|null} payload - JSON payload for 'update' (sent via stdin).
 * @returns {Promise<object>} Parsed JSON from the Python script.
 */
export function runConfigCli(command, payload = null) {
  return new Promise((resolvePromise, rejectPromise) => {
    let pythonPath;
    try {
      pythonPath = ensureVenv();
    } catch (err) {
      return rejectPromise(err);
    }

    const analysisCoreDir = resolve(__dirname, '../../engine');
    const args = ['config_cli.py', command];

    const child = spawn(pythonPath, args, {
      cwd: analysisCoreDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return rejectPromise(new Error(`config_cli.py exited with code ${code}.\nStderr: ${stderr}`));
      }
      try {
        const result = JSON.parse(stdout);
        resolvePromise(result);
      } catch (err) {
        rejectPromise(new Error(`Failed to parse config_cli.py output: ${err.message}\nStdout: ${stdout}`));
      }
    });

    child.on('error', (err) => {
      rejectPromise(err);
    });

    // Send payload via stdin for 'update' command
    if (payload !== null) {
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    }
  });
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
export async function runScanAndReadReport(targetPath, reportOutputPath, mockScan = false, mockAi = false, fastScan = false, noSarif = false) {
  await runPythonAnalysis(targetPath, reportOutputPath, mockScan, mockAi, fastScan, noSarif);

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
    let pythonPath;
    try {
      pythonPath = ensureVenv();
    } catch (err) {
      return rejectPromise(err);
    }

    const args = [
      '-u',
      'main.py',
      '--refresh-ai', reportPath
    ];

    if (mockAi) {
      args.push('--mock-ai');
    }

    console.log(`Spawning Python process for refresh-ai: ${pythonPath} ${args.join(' ')}`);

    const child = spawn(pythonPath, args, {
      cwd: analysisCoreDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
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
          if (line.startsWith('{')) {
            try {
              const parsed = JSON.parse(line);
              if (parsed && parsed.type === 'progress') {
                onProgress(parsed);
                continue;
              }
            } catch {
              // Not JSON — fall through to plain text
            }
          }
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
