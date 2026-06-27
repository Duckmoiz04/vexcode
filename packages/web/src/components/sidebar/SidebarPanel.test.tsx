import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { SidebarPanel } from './SidebarPanel';
import { describe, it, expect, vi } from 'vitest';

describe('SidebarPanel', () => {
  it('renders tab buttons and hides stats count on explorer tab', () => {
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
    expect(screen.queryByText('5 / 10')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Findings'));
    expect(setSidebarTab).toHaveBeenCalledWith('findings');
  });

  it('renders correct stats count when tab is findings', () => {
    const setSidebarTab = vi.fn();
    renderWithProviders(
      <SidebarPanel
        sidebarTab="findings"
        setSidebarTab={setSidebarTab}
        searchedAndFilteredCount={3}
        totalCount={8}
      />
    );

    expect(screen.getByText('3 / 8')).toBeInTheDocument();
  });
});
