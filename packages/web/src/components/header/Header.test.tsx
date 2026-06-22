import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { Header } from './Header';
import type { Project, ReportListItem } from '../../types';

describe('Header', () => {
  const mockProjects: Project[] = [
    {
      name: 'project-1',
      reportCount: 2,
      latestReport: { id: 'report_2026-06-10-12-00-00', timestamp: '2026-06-10T12:00:00.000Z', findings: 5 }
    },
  ];

  const mockReports: ReportListItem[] = [
    { id: 'report_2026-06-10-12-00-00', findings: 5, timestamp: '2026-06-10T12:00:00.000Z' },
  ];

  it('renders all sub-components and propagates props', () => {
    const onSelectProject = vi.fn();
    const onOpenSettings = vi.fn();
    const onStartScan = vi.fn();
    const onReResolve = vi.fn();
    const onSelectReportId = vi.fn();
    const onToggleTheme = vi.fn();
    const onTabChange = vi.fn();

    renderWithProviders(
      <Header
        projectName="project-1"
        projects={mockProjects}
        onSelectProject={onSelectProject}
        onOpenSettings={onOpenSettings}
        onStartScan={onStartScan}
        onReResolve={onReResolve}
        reports={mockReports}
        currentReportId="report_2026-06-10-12-00-00"
        onSelectReportId={onSelectReportId}
        theme="dark"
        onToggleTheme={onToggleTheme}
        activeTab="dashboard"
        onTabChange={onTabChange}
      />
    );

    // Verify HeaderNav elements
    expect(screen.getByText('Vexcode')).toBeInTheDocument();
    expect(screen.getByText('project-1')).toBeInTheDocument();
    expect(screen.getByText('2026 06 10-12:00:00')).toBeInTheDocument();

    // Verify Tab Switcher renders and works
    const issuesTab = screen.getByRole('button', { name: /Issues/i });
    expect(issuesTab).toBeInTheDocument();
    fireEvent.click(issuesTab);
    expect(onTabChange).toHaveBeenCalledWith('issues');

    // Verify ScanButton elements
    expect(screen.getByRole('button', { name: /Scan Project/i })).toBeInTheDocument();

    // Verify HeaderActions elements
    const settingsBtn = screen.getByTitle('Settings');
    expect(settingsBtn).toBeInTheDocument();
    fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
