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
      />
    );

    // Verify HeaderNav elements
    expect(screen.getByText('AI Code Review')).toBeInTheDocument();
    expect(screen.getByText('project-1')).toBeInTheDocument();
    expect(screen.getByText('2026 06 10-12:00:00')).toBeInTheDocument();

    // Verify ScanButton elements
    expect(screen.getByRole('button', { name: /Scan Project/i })).toBeInTheDocument();

    // Verify HeaderActions elements
    const buttons = screen.getAllByRole('button');
    // buttons[0] is project dropdown, buttons[1] is version dropdown, buttons[2] is settings, buttons[3] is scan project, buttons[4] is scan dropdown
    fireEvent.click(buttons[2]); // Settings button
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
