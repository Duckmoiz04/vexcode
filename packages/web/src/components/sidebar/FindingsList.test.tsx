import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, createMockFinding } from '../../test/test-utils';
import { FindingsList } from './FindingsList';
import { describe, it, expect, vi } from 'vitest';

describe('FindingsList', () => {
  const mockFindings = [
    createMockFinding({
      rule_id: 'rules.security.injection',
      severity: 'error',
      file: 'src/auth.ts',
      line: 10,
      message: 'SQL Injection vulnerability',
      _applied: true,
    }),
    createMockFinding({
      rule_id: 'rules.style.naming',
      severity: 'warning',
      file: 'src/utils.ts',
      line: 20,
      message: 'Bad variable name',
      _applied: false,
    }),
  ];

  it('renders findings list with grouped files, tags, message, line coords, and status dropdown', () => {
    const onSelectFilePath = vi.fn();
    const onSelectFindingIndex = vi.fn();

    renderWithProviders(
      <FindingsList
        findings={mockFindings}
        searchedAndFilteredFindings={mockFindings}
        selectedFindingIndex={null}
        onSelectFindingIndex={onSelectFindingIndex}
        onSelectFilePath={onSelectFilePath}
        targetPath=""
      />
    );

    // Group header file paths
    expect(screen.getByText('src/auth.ts')).toBeInTheDocument();
    expect(screen.getByText('src/utils.ts')).toBeInTheDocument();

    // Check message titles
    expect(screen.getByText('SQL Injection vulnerability')).toBeInTheDocument();
    expect(screen.getByText('Bad variable name')).toBeInTheDocument();

    // Check tags parsed from rule_ids
    expect(screen.getByText('injection')).toBeInTheDocument();
    expect(screen.getByText('naming')).toBeInTheDocument();

    // Check L10 and L20 line coordinates
    expect(screen.getByText('L10')).toBeInTheDocument();
    expect(screen.getByText('L20')).toBeInTheDocument();

    // Click on finding title should trigger callbacks
    fireEvent.click(screen.getByText('SQL Injection vulnerability'));
    expect(onSelectFilePath).toHaveBeenCalledWith('src/auth.ts');
    expect(onSelectFindingIndex).toHaveBeenCalledWith(0);
  });
});
