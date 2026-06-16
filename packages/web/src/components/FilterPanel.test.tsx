import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test/test-utils';
import { FilterPanel } from './FilterPanel';

describe('FilterPanel Scan Status', () => {
  const defaultProps = {
    searchQuery: '',
    setSearchQuery: vi.fn(),
    filterSeverities: [],
    setFilterSeverities: vi.fn(),
    filterCategories: [],
    setFilterCategories: vi.fn(),
    filterStatuses: [],
    setFilterStatuses: vi.fn(),
    filterLanguages: [],
    setFilterLanguages: vi.fn(),
    filterScanStatuses: [] as string[],
    setFilterScanStatuses: vi.fn(),
    filterCounts: {
      severity: { error: 5, warning: 8, info: 11 },
      category: { security: 2, quality: 4, maintainability: 1, architecture: 2 },
      status: { open: 6, applied: 2, false_positive: 0, ignored: 1 },
      language: { Python: 5, JavaScript: 4 },
      scanStatus: { new: 3, persisting: 7, resolved: 9, regressed: 10 },
    },
    availableLanguages: ['Python', 'JavaScript'],
  };

  it('renders the Scan Status filter section', () => {
    renderWithProviders(<FilterPanel {...defaultProps} />);
    expect(screen.getByText('Scan Status')).toBeInTheDocument();
  });

  it('renders all four scan status options', () => {
    renderWithProviders(<FilterPanel {...defaultProps} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Persisting')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Regressed')).toBeInTheDocument();
  });

  it('displays scan status counts', () => {
    renderWithProviders(<FilterPanel {...defaultProps} />);
    // Scan status counts should be visible (unique values to avoid ambiguity)
    expect(screen.getByText('3')).toBeInTheDocument(); // new
    expect(screen.getByText('7')).toBeInTheDocument(); // persisting
    expect(screen.getByText('9')).toBeInTheDocument(); // resolved
    expect(screen.getByText('10')).toBeInTheDocument(); // regressed
  });

  it('calls setFilterScanStatuses when clicking a scan status option', () => {
    const setFilterScanStatuses = vi.fn();
    renderWithProviders(
      <FilterPanel {...defaultProps} setFilterScanStatuses={setFilterScanStatuses} />
    );

    fireEvent.click(screen.getByText('New'));
    expect(setFilterScanStatuses).toHaveBeenCalled();
  });

  it('includes filterScanStatuses in Clear All visibility check', () => {
    renderWithProviders(
      <FilterPanel {...defaultProps} filterScanStatuses={['new']} />
    );
    // Clear All button should be visible when scan status filter is active
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('calls setFilterScanStatuses([]) when Clear All is clicked', () => {
    const setFilterScanStatuses = vi.fn();
    renderWithProviders(
      <FilterPanel {...defaultProps} filterScanStatuses={['new']} setFilterScanStatuses={setFilterScanStatuses} />
    );

    fireEvent.click(screen.getByText('Clear All'));
    expect(setFilterScanStatuses).toHaveBeenCalledWith([]);
  });
});
