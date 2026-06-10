import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  createMockFinding,
  createMockReport,
  createMockConfig,
  renderWithProviders,
} from './test-utils';

describe('createMockFinding', () => {
  it('produces a valid Finding with defaults', () => {
    const finding = createMockFinding();

    expect(finding).toMatchObject({
      rule_id: expect.any(String),
      severity: expect.stringMatching(/^(error|warning|info)$/),
      file: expect.any(String),
      line: expect.any(Number),
      message: expect.any(String),
    });
  });

  it('merges overrides', () => {
    const finding = createMockFinding({ severity: 'error', line: 99 });

    expect(finding.severity).toBe('error');
    expect(finding.line).toBe(99);
    // defaults still apply for non-overridden fields
    expect(finding.rule_id).toBeTruthy();
    expect(finding.file).toBeTruthy();
    expect(finding.message).toBeTruthy();
  });
});

describe('createMockReport', () => {
  it('produces a valid Report', () => {
    const report = createMockReport();

    expect(report).toMatchObject({
      scanner: expect.any(String),
      timestamp: expect.any(String),
      target_path: expect.any(String),
      findings: expect.any(Array),
      ai_resolutions: expect.any(Object),
      git_state: expect.objectContaining({
        commit: expect.any(String),
        is_dirty: expect.any(Boolean),
      }),
      metrics: expect.objectContaining({
        files: expect.any(Object),
      }),
    });
    expect(report.findings.length).toBeGreaterThanOrEqual(1);
  });

  it('includes at least 1 finding', () => {
    const report = createMockReport();
    expect(report.findings.length).toBeGreaterThanOrEqual(1);
    expect(report.findings[0]).toMatchObject({
      rule_id: expect.any(String),
      severity: expect.any(String),
    });
  });

  it('merges overrides', () => {
    const report = createMockReport({ scanner: 'custom-scanner' });
    expect(report.scanner).toBe('custom-scanner');
    expect(report.findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('createMockConfig', () => {
  it('produces a valid Config with AI_PROVIDER default', () => {
    const config = createMockConfig();

    expect(config).toMatchObject({
      AI_PROVIDER: expect.any(String),
      AI_TEMPERATURE: expect.any(String),
      AI_MAX_TOKENS: expect.any(String),
    });
    expect(config.AI_PROVIDER).toBeTruthy();
  });

  it('merges overrides', () => {
    const config = createMockConfig({ AI_PROVIDER: 'openai' });
    expect(config.AI_PROVIDER).toBe('openai');
  });
});

describe('renderWithProviders', () => {
  it('renders a simple div without crash', () => {
    const { container } = renderWithProviders(<div>Hello World</div>);

    expect(container.textContent).toBe('Hello World');
  });

  it('renders children inside the provider', () => {
    renderWithProviders(<span data-testid="child">Content</span>);

    expect(screen.getByTestId('child')).toHaveTextContent('Content');
  });

  it('accepts providerConfig option', () => {
    renderWithProviders(<div>Config test</div>, {
      providerConfig: { AI_PROVIDER: 'openai' },
    });

    expect(screen.getByText('Config test')).toBeInTheDocument();
  });
});
