import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, createMockFinding } from '../../test/test-utils';
import { Sidebar } from './Sidebar';
import { describe, it, expect, vi } from 'vitest';

describe('Sidebar Container', () => {
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

  const defaultProps = {
    projectName: 'DATN2',
    findings: mockFindings,
    selectedFilePath: null,
    onSelectFilePath: vi.fn(),
    targetPath: '',
    searchQuery: '',
    setSearchQuery: vi.fn(),
    filterSeverities: [],
    setFilterSeverities: vi.fn(),
    filterCategories: [],
    setFilterCategories: vi.fn(),
    selectedFindingIndex: null,
    onSelectFindingIndex: vi.fn(),
    filterStatuses: [],
    setFilterStatuses: vi.fn(),
    filterLanguages: [],
    setFilterLanguages: vi.fn(),
    availableLanguages: ['TypeScript'],
  };

  it('renders the Sidebar container and allows switching tabs', () => {
    renderWithProviders(<Sidebar {...defaultProps} />);

    // Default tab is File Tree
    expect(screen.getByText('File Tree')).toBeInTheDocument();
    expect(screen.getByText('auth.ts')).toBeInTheDocument();
    expect(screen.getByText('utils.ts')).toBeInTheDocument();

    // Switch to Findings tab
    fireEvent.click(screen.getByText('Findings'));
    expect(screen.getByText('injection')).toBeInTheDocument();
    expect(screen.getByText('naming')).toBeInTheDocument();
  });
});
