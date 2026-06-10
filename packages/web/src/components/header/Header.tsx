import React from 'react';
import { HeaderNav } from './HeaderNav';
import { ScanButton } from './ScanButton';
import { HeaderActions } from './HeaderActions';
import type { Project, ReportListItem } from '../../types';

export interface HeaderProps {
  projectName: string | null;
  projects: Project[];
  onSelectProject: (name: string | null) => void;
  onOpenSettings: () => void;
  onStartScan: (fastScan: boolean) => void;
  onReResolve?: () => void;
  reports: ReportListItem[];
  currentReportId: string | null;
  onSelectReportId: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  projects,
  onSelectProject,
  onOpenSettings,
  onStartScan,
  onReResolve,
  reports,
  currentReportId,
  onSelectReportId,
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#161622] border-b border-card-border z-40">
      <HeaderNav
        projectName={projectName}
        projects={projects}
        onSelectProject={onSelectProject}
        reports={reports}
        currentReportId={currentReportId}
        onSelectReportId={onSelectReportId}
      />
      <div className="flex items-center gap-3">
        <HeaderActions onOpenSettings={onOpenSettings} />
        <ScanButton
          onStartScan={onStartScan}
          onReResolve={onReResolve}
          currentReportId={currentReportId}
        />
      </div>
    </header>
  );
};
