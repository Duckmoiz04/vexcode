import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, createMockFinding } from '../../test/test-utils';
import { FileViewer } from './FileViewer';
import type { AiResolution } from '../../types';

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

  it('shows "No diff available." when isLoading is true and no resolution', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent=""
        isLoading={true}
        error={null}
        resolution={undefined}
      />
    );

    expect(screen.getByText(/no diff available/i)).toBeInTheDocument();
  });

  it('shows "No diff available." when error is set and no resolution', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent=""
        isLoading={false}
        error="Network error"
        resolution={undefined}
      />
    );

    expect(screen.getByText(/no diff available/i)).toBeInTheDocument();
  });

  it('shows "No diff available." when resolution is undefined', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={undefined}
      />
    );

    expect(screen.getByText(/no diff available/i)).toBeInTheDocument();
  });

  it('renders remediation code block when resolution has remediation_code', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={baseResolution}
      />
    );

    // Remediation lines should be visible
    expect(screen.getByText('fixed_line_1')).toBeInTheDocument();
    expect(screen.getByText('fixed_line_2')).toBeInTheDocument();
  });

  it('shows "No diff available." when suggestion is false positive with empty remediation', () => {
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
      />
    );

    expect(screen.getByText(/no diff available/i)).toBeInTheDocument();
  });

  it('renders diff view when remediation_code is empty and not false positive', () => {
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
      />
    );

    // Empty remediation_code (not undefined) still triggers diff rendering
    // because hasRemediation is true and isFalsePositive is false.
    // Content appears in both deleted and inserted chunks, so check for
    // the CodeMirror editor container instead of individual text nodes.
    const editor = document.querySelector('.cm-editor');
    expect(editor).toBeInTheDocument();
  });
});