import { describe, it, expect } from 'vitest';
import { normalizeReport } from './reportNormalizer';

const legacyReport = {
  scanner: 'semgrep',
  timestamp: '2024-01-01T10:00:00Z',
  target_path: '/test/project',
  findings: [{ rule_id: 'r1', severity: 'error' as const, file: 'a.py', line: 1, message: 'msg' }],
  ai_resolutions: { r1: { suggestion: 'Fix it' } },
  git_state: { commit: 'abc', is_dirty: false },
  metrics: { files: {} },
  _id: 'rep-1',
  _project: 'project-a',
};

const sarifReport = {
  $schema: 'https://example.com/sarif-schema-2.1.0.json',
  version: '2.1.0' as const,
  runs: [{
    tool: { driver: { name: 'opengrep', rules: [] } },
    results: [{
      ruleId: 'r1',
      level: 'error',
      message: { text: 'msg' },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: 'a.py' },
          region: { startLine: 1, snippet: { text: 'code' } },
        },
      }],
      properties: {
        _applied: false,
        aiResolution: { suggestion: 'Fix it' },
      },
    }],
    invocations: [{ executionSuccessful: true, endTimeUtc: '2024-01-01T10:00:00Z' }],
    originalUriBaseIds: { SRCROOT: { uri: 'file:///test/project' } },
    properties: { metrics: { files: {} } },
  }],
};

describe('normalizeReport', () => {
  it('converts SARIF to Report', () => {
    const result = normalizeReport(sarifReport);
    expect(result).not.toBeNull();
    expect(result!.scanner).toBe('opengrep');
    expect(result!.findings).toHaveLength(1);
    expect(result!.findings[0].rule_id).toBe('r1');
    expect(result!.ai_resolutions['r1']).toEqual({ suggestion: 'Fix it' });
  });

  it('passes through legacy VexCode format', () => {
    const result = normalizeReport(legacyReport);
    expect(result).not.toBeNull();
    expect(result!.scanner).toBe('semgrep');
    expect(result!.findings).toHaveLength(1);
    expect(result!._id).toBe('rep-1');
  });

  it('applies annotations to SARIF', () => {
    const result = normalizeReport(sarifReport, {
      _id: 'custom-id',
      _project: 'custom-project',
    });
    expect(result!._id).toBe('custom-id');
    expect(result!._project).toBe('custom-project');
  });

  it('returns null for null input', () => {
    expect(normalizeReport(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeReport(undefined)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizeReport('string')).toBeNull();
  });

  it('returns null for object without findings array', () => {
    expect(normalizeReport({ scanner: 'test' })).toBeNull();
  });
});
