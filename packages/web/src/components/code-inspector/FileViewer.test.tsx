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

  it('shows loading message when isLoading is true', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent=""
        isLoading={true}
        error={null}
        resolution={undefined}
      />
    );

    expect(screen.getByText(/loading file content/i)).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent=""
        isLoading={false}
        error="Failed to load file"
        resolution={undefined}
      />
    );

    expect(screen.getByText(/error: failed to load file/i)).toBeInTheDocument();
  });

  it('shows "No file content available." when content is empty', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent=""
        isLoading={false}
        error={null}
        resolution={undefined}
      />
    );

    expect(screen.getByText(/no file content available/i)).toBeInTheDocument();
  });

  it('renders CodeMirrorEditor when file content is loaded', () => {
    renderWithProviders(
      <FileViewer
        finding={baseFinding}
        fileContent="line1\nline2\nline3"
        isLoading={false}
        error={null}
        resolution={undefined}
      />
    );

    const editor = document.querySelector('.cm-editor');
    expect(editor).toBeInTheDocument();
  });
});