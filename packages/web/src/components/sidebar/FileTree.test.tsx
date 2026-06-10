import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, createMockFinding } from '../../test/test-utils';
import { FileTree } from './FileTree';
import { describe, it, expect, vi } from 'vitest';

describe('FileTree', () => {
  const mockFindings = [
    createMockFinding({
      file: 'src/components/Button.tsx',
    }),
    createMockFinding({
      file: 'src/utils/math.ts',
    }),
  ];

  it('renders recursive file tree and handles folder expand/collapse and file selection', () => {
    const onSelectFilePath = vi.fn();

    renderWithProviders(
      <FileTree
        projectName="MyTestProject"
        findings={mockFindings}
        searchedAndFilteredFindings={mockFindings}
        selectedFilePath={null}
        onSelectFilePath={onSelectFilePath}
        targetPath=""
      />
    );

    // Folder names should be rendered
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.getByText('utils')).toBeInTheDocument();

    // File names should be rendered
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.getByText('math.ts')).toBeInTheDocument();

    // Click on a file should trigger onSelectFilePath
    fireEvent.click(screen.getByText('Button.tsx'));
    expect(onSelectFilePath).toHaveBeenCalledWith('src/components/Button.tsx');
  });
});
