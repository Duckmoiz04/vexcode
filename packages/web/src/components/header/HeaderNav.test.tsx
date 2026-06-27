import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { HeaderNav } from './HeaderNav';
import type { Project, ReportListItem } from '../../types';

describe('HeaderNav', () => {
  const mockProjects: Project[] = [
    { name: 'project-1', reportCount: 2, latestReport: { id: 'report_1', timestamp: '2026-06-10T12:00:00.000Z', findings: 5 } },
    { name: 'project-2', reportCount: 1, latestReport: { id: 'report_2', timestamp: null, findings: 3 } },
  ];

  const mockReports: ReportListItem[] = [
    { id: 'report_2026-06-10-12-00-00', findings: 5, timestamp: '2026-06-10T12:00:00.000Z' },
    { id: 'report_2026-06-10-11-00-00', findings: 2, timestamp: '2026-06-10T11:00:00.000Z' },
  ];

  it('renders logo and title', () => {
    const onSelectProject = vi.fn();
    renderWithProviders(
      <HeaderNav
        projectName={null}
        projects={[]}
        onSelectProject={onSelectProject}
        reports={[]}
        currentReportId={null}
        onSelectReportId={vi.fn()}
      />
    );

    expect(screen.getByText('Vexcode')).toBeInTheDocument();
    
    // Clicking logo should select null project
    fireEvent.click(screen.getByText('Vexcode'));
    expect(onSelectProject).toHaveBeenCalledWith(null);
  });

  it('does not render project dropdown when projectName is null', () => {
    renderWithProviders(
      <HeaderNav
        projectName={null}
        projects={mockProjects}
        onSelectProject={vi.fn()}
        reports={[]}
        currentReportId={null}
        onSelectReportId={vi.fn()}
      />
    );

    expect(screen.queryByText('project-1')).not.toBeInTheDocument();
  });

  it('renders project dropdown when projectName is provided', () => {
    const onSelectProject = vi.fn();
    renderWithProviders(
      <HeaderNav
        projectName="project-1"
        projects={mockProjects}
        onSelectProject={onSelectProject}
        reports={[]}
        currentReportId={null}
        onSelectReportId={vi.fn()}
      />
    );

    // The button showing the current project name
    const projectBtn = screen.getByRole('button');
    expect(projectBtn).toHaveTextContent('project-1');

    // Click to open dropdown
    fireEvent.click(projectBtn);

    // Should show projects header and list
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('project-2')).toBeInTheDocument();

    // Click on project-2
    fireEvent.click(screen.getByText('project-2'));
    expect(onSelectProject).toHaveBeenCalledWith('project-2');
  });
});

