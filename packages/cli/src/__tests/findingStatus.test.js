import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { markFindingApplied, updateFindingStatus } from '../services/reportService.js';

let tmpDir;
let reportPath;

const SAMPLE_REPORT = {
  scanner: 'test',
  timestamp: '2026-06-15T00:00:00Z',
  findings: [
    { id: 'abc123', file: 'app.py', line: 10, rule_id: 'xss', severity: 'error', message: 'XSS vuln', _applied: false, status: 'open' },
    { id: 'def456', file: 'utils.py', line: 20, rule_id: 'sql-inject', severity: 'warning', message: 'SQL injection', _applied: false, status: 'open' },
    { file: 'main.py', line: 5, rule_id: 'unused-import', severity: 'info', message: 'Unused import' },
  ],
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-test-status-'));
  reportPath = path.join(tmpDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(SAMPLE_REPORT, null, 2), 'utf8');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('markFindingApplied', () => {
  it('marks finding as applied by id', () => {
    const result = markFindingApplied(reportPath, { id: 'abc123' });
    expect(result.success).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const f = report.findings[0];
    expect(f._applied).toBe(true);
    expect(f.status).toBe('applied');
  });

  it('marks finding as applied by file+line+rule_id', () => {
    const result = markFindingApplied(reportPath, { file: 'utils.py', line: 20, rule_id: 'sql-inject' });
    expect(result.success).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const f = report.findings[1];
    expect(f._applied).toBe(true);
    expect(f.status).toBe('applied');
  });

  it('returns error for missing report', () => {
    const result = markFindingApplied('/nonexistent/path.json', { id: 'abc123' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error for missing finding', () => {
    const result = markFindingApplied(reportPath, { id: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('updateFindingStatus', () => {
  it('sets status to false_positive', () => {
    const result = updateFindingStatus(reportPath, { id: 'abc123' }, 'false_positive');
    expect(result.success).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.findings[0].status).toBe('false_positive');
    expect(report.findings[0]._applied).toBe(false);
  });

  it('sets status to ignored', () => {
    const result = updateFindingStatus(reportPath, { id: 'def456' }, 'ignored');
    expect(result.success).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.findings[1].status).toBe('ignored');
  });

  it('sets status to open (reopen)', () => {
    // First mark as applied
    updateFindingStatus(reportPath, { id: 'abc123' }, 'applied');
    // Then reopen
    const result = updateFindingStatus(reportPath, { id: 'abc123' }, 'open');
    expect(result.success).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.findings[0].status).toBe('open');
    expect(report.findings[0]._applied).toBe(false);
  });

  it('sets _applied=true when status=applied', () => {
    const result = updateFindingStatus(reportPath, { id: 'abc123' }, 'applied');
    expect(result.success).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.findings[0].status).toBe('applied');
    expect(report.findings[0]._applied).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateFindingStatus(reportPath, { id: 'abc123' }, 'invalid');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('returns error for missing report', () => {
    const result = updateFindingStatus('/nonexistent/path.json', { id: 'abc' }, 'open');
    expect(result.success).toBe(false);
  });

  it('returns error for missing finding', () => {
    const result = updateFindingStatus(reportPath, { id: 'zzz' }, 'open');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('locates finding by file+line+rule_id when no id', () => {
    const result = updateFindingStatus(reportPath, { file: 'main.py', line: 5, rule_id: 'unused-import' }, 'ignored');
    expect(result.success).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.findings[2].status).toBe('ignored');
  });
});
