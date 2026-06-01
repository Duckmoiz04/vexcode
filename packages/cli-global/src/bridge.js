import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const analysisCoreDir = resolve(__dirname, '../../analysis-core');

export function getPythonPath() {
  const isWindows = platform() === 'win32';
  const pythonRelativePath = isWindows
    ? '.venv/Scripts/python.exe'
    : '.venv/bin/python';
  return resolve(analysisCoreDir, pythonRelativePath);
}

/**
 * Run the Python Analysis Core subprocess.
 * @param {string} targetPath - The path to run scanning on.
 * @param {string} reportOutputPath - The path where the scanner JSON report should be saved.
 * @param {boolean} [mockScan=false] - Use mock scan findings.
 * @param {boolean} [mockAi=false] - Use mock AI suggestions.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export function runPythonAnalysis(targetPath, reportOutputPath, mockScan = false, mockAi = false) {
  return new Promise((resolvePromise, rejectPromise) => {
    const pythonPath = getPythonPath();

    if (!existsSync(pythonPath)) {
      return rejectPromise(new Error(`Python interpreter not found at ${pythonPath}. Please ensure .venv is set up in packages/analysis-core.`));
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

    console.log(`Spawning Python process: ${pythonPath} ${args.join(' ')}`);

    const child = spawn(pythonPath, args, {
      cwd: analysisCoreDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      // Display progress in real-time
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        console.log(`  \x1b[90m[python]\x1b[0m ${line}`);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        rejectPromise(new Error(`Python process exited with code ${code}.\nStdout: ${stdout}\nStderr: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      rejectPromise(err);
    });
  });
}

/**
 * Run scan and return parsed report object.
 * @param {string} targetPath
 * @param {string} reportOutputPath
 * @param {boolean} [mockScan=false]
 * @param {boolean} [mockAi=false]
 * @returns {Promise<object>} Parsed report JSON
 */
export async function runScanAndReadReport(targetPath, reportOutputPath, mockScan = false, mockAi = false) {
  await runPythonAnalysis(targetPath, reportOutputPath, mockScan, mockAi);

  if (!existsSync(reportOutputPath)) {
    throw new Error(`Report file not found at ${reportOutputPath} after scan.`);
  }

  const content = readFileSync(reportOutputPath, 'utf8');
  return JSON.parse(content);
}
