import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { SidebarPanel } from './SidebarPanel';
import { describe, it, expect, vi } from 'vitest';

describe('SidebarPanel', () => {
  it('renders tab buttons and title bar with correct counts', () => {
    const setSidebarTab = vi.fn();
    renderWithProviders(
      <SidebarPanel
        sidebarTab="explorer"
        setSidebarTab={setSidebarTab}
        searchedAndFilteredCount={5}
        totalCount={10}
      />
    );

    expect(screen.getByText('File Tree')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('File Structure')).toBeInTheDocument();
    expect(screen.getByText('5 / 10')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Findings'));
    expect(setSidebarTab).toHaveBeenCalledWith('findings');
  });

  it('renders Project Issues title when tab is findings', () => {
    const setSidebarTab = vi.fn();
    renderWithProviders(
      <SidebarPanel
        sidebarTab="findings"
        setSidebarTab={setSidebarTab}
        searchedAndFilteredCount={3}
        totalCount={8}
      />
    );

    expect(screen.getByText('Project Issues')).toBeInTheDocument();
    expect(screen.getByText('3 / 8')).toBeInTheDocument();
  });
});
