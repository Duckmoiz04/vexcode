import { describe, it, expect } from 'vitest';
import { runPythonAnalysis, getPythonPath } from '../bridge.js';
import { existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Python Process Bridge', () => {
  it('should resolve python path', () => {
    const pythonPath = getPythonPath();
    expect(pythonPath).toBeTypeOf('string');
    expect(existsSync(pythonPath)).toBe(true);
  });

  it('should execute python analysis process successfully', async () => {
    const reportPath = join(__dirname, 'test_report.json');
    
    // Clean up if it exists from previous runs
    if (existsSync(reportPath)) {
      unlinkSync(reportPath);
    }

    // Run python core with mocks enabled so it doesn't try to call real semgrep/9router APIs
    await runPythonAnalysis(__dirname, reportPath, true, true);

    expect(existsSync(reportPath)).toBe(true);

    // Clean up
    if (existsSync(reportPath)) {
      unlinkSync(reportPath);
    }
  }, 20000);
});
