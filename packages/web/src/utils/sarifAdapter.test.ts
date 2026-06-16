import { describe, it, expect } from 'vitest';
import { isSarifReport, sarifToReport, type SarifLog } from './sarifAdapter';

// ─── Test fixtures ─────────────────────────────────────────────────────────

const minimalSarif: SarifLog = {
  $schema: 'https://example.com/sarif-schema-2.1.0.json',
  version: '2.1.0',
  runs: [{
    tool: { driver: { name: 'opengrep-mock', rules: [] } },
    results: [],
    invocations: [{ executionSuccessful: true, endTimeUtc: '2026-06-09T00:00:00Z' }],
    originalUriBaseIds: { SRCROOT: { uri: 'file:///test/target' } },
    properties: { metrics: { files: {} } },
  }],
};

function makeResult(overrides: Record<string, unknown> = {}) {
  return {
    ruleId: 'test.rule',
    level: 'error',
    message: { text: 'Test finding' },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: 'test.py' },
        region: { startLine: 10, snippet: { text: 'bad code' } },
      },
    }],
    properties: { _applied: false },
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('isSarifReport', () => {
  it('returns true for valid SARIF', () => {
    expect(isSarifReport(minimalSarif)).toBe(true);
  });

  it('returns false for legacy format', () => {
    expect(isSarifReport({ findings: [], scanner: 'test' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSarifReport(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSarifReport(undefined)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isSarifReport('not an object')).toBe(false);
  });
});

describe('sarifToReport', () => {
  it('converts minimal SARIF to Report', () => {
    const report = sarifToReport(minimalSarif);
    expect(report.scanner).toBe('opengrep-mock');
    expect(report.timestamp).toBe('2026-06-09T00:00:00Z');
    expect(report.target_path).toBe('test/target');
    expect(report.findings).toEqual([]);
    expect(report.ai_resolutions).toEqual({});
    expect(report.metrics).toEqual({ files: {} });
  });

  it('converts results to findings', () => {
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{
        ...minimalSarif.runs[0],
        results: [makeResult()],
      }],
    };

    const report = sarifToReport(sarif);
    expect(report.findings).toHaveLength(1);
    const f = report.findings[0];
    expect(f.rule_id).toBe('test.rule');
    expect(f.severity).toBe('error');
    expect(f.file).toBe('test.py');
    expect(f.line).toBe(10);
    expect(f.message).toBe('Test finding');
    expect(f.code_text).toBe('bad code');
    expect(f._applied).toBe(false);
  });

  it('maps severity levels correctly', () => {
    const results = [
      makeResult({ ruleId: 'r1', level: 'error' }),
      makeResult({ ruleId: 'r2', level: 'warning' }),
      makeResult({ ruleId: 'r3', level: 'note' }),
      makeResult({ ruleId: 'r4', level: 'none' }),
    ];
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{ ...minimalSarif.runs[0], results }],
    };

    const report = sarifToReport(sarif);
    expect(report.findings[0].severity).toBe('error');
    expect(report.findings[1].severity).toBe('warning');
    expect(report.findings[2].severity).toBe('info');
    expect(report.findings[3].severity).toBe('info');
  });

  it('extracts AI resolutions from properties', () => {
    const result = makeResult({
      properties: {
        _applied: false,
        aiResolution: { suggestion: 'Fix it', remediation_code: 'safe()' },
      },
    });
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{ ...minimalSarif.runs[0], results: [result] }],
    };

    const report = sarifToReport(sarif);
    expect(report.ai_resolutions['test.rule']).toEqual({
      suggestion: 'Fix it',
      remediation_code: 'safe()',
    });
  });

  it('extracts git state from versionControlProvenance', () => {
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{
        ...minimalSarif.runs[0],
        versionControlProvenance: [{
          revisionId: 'abc123',
          properties: { isDirty: true },
        }],
      }],
    };

    const report = sarifToReport(sarif);
    expect(report.git_state).toEqual({ commit: 'abc123', is_dirty: true });
  });

  it('extracts AST context from relatedLocations', () => {
    const result = makeResult({
      relatedLocations: [{
        logicalLocations: [{ name: 'handle_auth', kind: 'function' }],
        physicalLocation: {
          artifactLocation: { uri: 'auth.py' },
          region: { snippet: { text: 'def handle_auth():' } },
        },
      }],
    });
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{ ...minimalSarif.runs[0], results: [result] }],
    };

    const report = sarifToReport(sarif);
    expect(report.findings[0].ast_context).toEqual({
      symbol_name: 'handle_auth',
      kind: 'function',
      source_code: 'def handle_auth():',
    });
  });

  it('passes annotations through', () => {
    const report = sarifToReport(minimalSarif, {
      _id: 'rep-1',
      _project: 'project-a',
      _savedAt: '/path/to/report.json',
    });
    expect(report._id).toBe('rep-1');
    expect(report._project).toBe('project-a');
    expect(report._savedAt).toBe('/path/to/report.json');
  });

  it('handles empty runs gracefully', () => {
    const sarif: SarifLog = { version: '2.1.0', runs: [] };
    const report = sarifToReport(sarif);
    expect(report.scanner).toBe('unknown');
    expect(report.findings).toEqual([]);
  });

  it('extracts finding id from properties', () => {
    const result = makeResult({ properties: { _applied: false, id: 'abc123def456' } });
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{ ...minimalSarif.runs[0], results: [result] }],
    };
    const report = sarifToReport(sarif);
    expect(report.findings[0].id).toBe('abc123def456');
  });

  it('extracts status from properties', () => {
    const result = makeResult({ properties: { _applied: true, status: 'applied' } });
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{ ...minimalSarif.runs[0], results: [result] }],
    };
    const report = sarifToReport(sarif);
    expect(report.findings[0].status).toBe('applied');
  });

  it('ignores invalid status values', () => {
    const result = makeResult({ properties: { _applied: false, status: 'bogus' } });
    const sarif: SarifLog = {
      ...minimalSarif,
      runs: [{ ...minimalSarif.runs[0], results: [result] }],
    };
    const report = sarifToReport(sarif);
    expect(report.findings[0].status).toBeUndefined();
  });
});
