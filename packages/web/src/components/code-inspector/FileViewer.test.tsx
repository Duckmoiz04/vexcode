import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, createMockFinding } from '../../test/test-utils';
import { FileViewer } from './FileViewer';
import type { AiResolution } from '../../types';

// Mock react-syntax-highlighter to simplify rendering in tests
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, lineProps }: { children: string; lineProps?: () => Record<string, unknown> }) => {
    const lines = children.split('\n');
    return (
      <pre data-testid="syntax-highlighter">
        {lines.map((line, i) => (
          <span key={i} data-testid={`code-line-${i}`} {...(lineProps?.() ?? {})}>
            {line}
          </span>
        ))}
      </pre>
    );
  },
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

describe('FileViewer', () => {
  const baseFinding = createMockFinding({
    rule_id: 'rules.test.injection',
    severity: 'error',
    file: 'src/test.py',
    line: 2,
    message: 'Test vulnerability',
  });

  const baseResolution: AiResolution = {
    suggestion: 'Fix the issue',
    remediation_code: 'fixed_line_1\nfixed_line_2',
  };

  it('renders loading state when isLoading is true', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent=""
        isLoading={true}
        error={null}
        resolution={undefined}
        fileFindings={[]}
        allFindings={[]}
      />
    );

    expect(screen.getByText(/loading file content/i)).toBeInTheDocument();
  });

  it('renders error state when error is set', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent=""
        isLoading={false}
        error="Network error"
        resolution={undefined}
        fileFindings={[]}
        allFindings={[]}
      />
    );

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('renders code lines with syntax highlighting when content is available', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={undefined}
        fileFindings={[]}
        allFindings={[]}
      />
    );

    // Syntax highlighter should be rendered
    expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    // Line numbers should be visible in the gutter
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders remediation code block when resolution has remediation_code', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={baseResolution}
        fileFindings={[]}
        allFindings={[]}
      />
    );

    // Remediation lines should be visible
    expect(screen.getByText('fixed_line_1')).toBeInTheDocument();
    expect(screen.getByText('fixed_line_2')).toBeInTheDocument();
  });

  it('renders false positive indicator when suggestion starts with "false positive" and remediation is empty', () => {
    const fpResolution: AiResolution = {
      suggestion: 'False positive - this is safe',
      remediation_code: '',
    };

    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={fpResolution}
        fileFindings={[]}
        allFindings={[]}
      />
    );

    expect(screen.getByText(/false positive/i)).toBeInTheDocument();
  });

  it('renders deletion indicator when remediation_code is empty and not false positive', () => {
    const delResolution: AiResolution = {
      suggestion: 'Remove this line',
      remediation_code: '',
    };

    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={delResolution}
        fileFindings={[]}
        allFindings={[]}
      />
    );

    expect(screen.getByText(/line removed/i)).toBeInTheDocument();
  });

  it('renders finding dots in gutter for lines with findings', () => {
    const findingsOnFile = [
      createMockFinding({ rule_id: 'r1', severity: 'error', file: 'src/test.py', line: 1, message: 'err' }),
    ];

    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={undefined}
        fileFindings={findingsOnFile}
        allFindings={findingsOnFile}
      />
    );

    // The gutter should have a button for the finding on line 1
    const gutterButtons = screen.getAllByRole('button');
    expect(gutterButtons.length).toBeGreaterThan(0);
  });
});