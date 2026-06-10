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

  it('renders findings list with severity dots, rule IDs, file names, line numbers, messages, and applied badges', () => {
    const onSelectFilePath = vi.fn();
    const onSelectFindingIndex = vi.fn();

    renderWithProviders(
      <FindingsList
        findings={mockFindings}
        searchedAndFilteredFindings={mockFindings}
        selectedFindingIndex={null}
        onSelectFindingIndex={onSelectFindingIndex}
        onSelectFilePath={onSelectFilePath}
      />
    );

    expect(screen.getByText('injection')).toBeInTheDocument();
    expect(screen.getByText('naming')).toBeInTheDocument();
    expect(screen.getByText('applied')).toBeInTheDocument();
    expect(screen.getByText('SQL Injection vulnerability')).toBeInTheDocument();
    expect(screen.getByText('Bad variable name')).toBeInTheDocument();
    expect(screen.getByText('Line 10')).toBeInTheDocument();
    expect(screen.getByText('Line 20')).toBeInTheDocument();

    fireEvent.click(screen.getByText('injection'));
    expect(onSelectFilePath).toHaveBeenCalledWith('src/auth.ts');
    expect(onSelectFindingIndex).toHaveBeenCalledWith(0);
  });
});
