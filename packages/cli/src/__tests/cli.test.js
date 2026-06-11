import { describe, it, expect } from 'vitest';
import { exec } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../../bin/cli.js');

function runCli(args = []) {
  return new Promise((resolve, reject) => {
    // Run with NODE_ENV=test and TEST_SKIP_BROWSER=true to avoid starting browser / real scan
    exec(
      `node "${cliPath}" ${args.join(' ')}`,
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TEST_SKIP_BROWSER: 'true',
          TEST_SKIP_GITNEXUS: 'true'
        }
      },
      (error, stdout, stderr) => {
        resolve({
          code: error ? error.code : 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          error
        });
      }
    );
  });
}

describe('AI Code Review CLI Integration', () => {
  it('should display version number on --version', async () => {
    const { code, stdout } = await runCli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should display help on --help', async () => {
    const { code, stdout } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('AI Code Review CLI');
    expect(stdout).toContain('Commands:');
    expect(stdout).toContain('scan');
    expect(stdout).toContain('serve');
  });

  it('should display help for scan command on scan --help', async () => {
    const { code, stdout } = await runCli(['scan', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: vexcode scan');
    expect(stdout).toContain('--mock-scan');
    expect(stdout).toContain('--mock-ai');
  });

  it('should display help for serve command on serve --help', async () => {
    const { code, stdout } = await runCli(['serve', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: vexcode serve');
    expect(stdout).toContain('--port');
  });

  it('should execute mock scan and output summary to stdout', async () => {
    const targetPath = path.resolve(__dirname, '../..');
    const { code, stdout } = await runCli([
      'scan',
      '--target', `"${targetPath}"`,
      '--mock-scan',
      '--mock-ai'
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain('Scanning target:');
    expect(stdout).toContain('Project:');
    expect(stdout).toContain('AI Code Review Report');
    expect(stdout).toContain('Report saved to:');
  }, 20000);
});
