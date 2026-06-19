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
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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
  theme,
  onToggleTheme,
}) => {
  if (!projectName) {
    return (
      <header className="w-full pt-10 pb-5 bg-bg-secondary flex items-center justify-center select-none">
        <div className="flex items-center gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="h-7 w-auto text-accent" fill="currentColor">
            <path d="M1.88 5.21039C1.6008 5.36239 1.2504 5.33599 1.2504 5.01199V3.67599L6.308 0.799988V2.13599C6.308 2.46079 6.0832 2.85599 5.7864 3.00959L1.88 5.21439V5.21039ZM9.1704 14.5336C9.4496 14.376 9.4496 14.1016 9.1704 13.948L5.144 11.6544C4.98356 11.5785 4.80828 11.5391 4.6308 11.5391C4.45331 11.5391 4.27803 11.5785 4.1176 11.6544L2.952 12.3248L8.0104 15.2L9.176 14.5344L9.1704 14.5336ZM13.4904 3.00559C13.2024 2.85759 12.9504 2.97359 12.9504 3.30239V7.89279C12.9504 8.21679 13.184 8.61279 13.4904 8.76079L14.7048 9.43199V3.67599L13.4904 3.01039V3.00559Z" />
            <path d="M1.2504 3.67999L6.308 0.799988L10.8576 3.38719C11.1368 3.54079 11.1368 3.81519 10.8576 3.96799L6.8256 6.26319C6.5512 6.41599 6.0784 6.41599 5.804 6.26319L1.2496 3.67519L1.2504 3.67999ZM2.6 7.01039C2.6 6.68159 2.8384 6.55999 3.1536 6.71759L7.4464 9.05359C7.6026 9.14519 7.73445 9.27305 7.83081 9.42636C7.92716 9.57966 7.9852 9.75392 8 9.93439V15.2L2.6 12.2752V7.01039ZM10.3088 12.0144C10.0384 12.172 9.8 12.0504 9.8 11.7264V7.13599C9.8 6.81199 10.0208 6.41599 10.3088 6.26319L14.7504 3.67599V9.43119L10.3088 12.0144Z" />
          </svg>
          <span className="text-xl font-bold tracking-[0.25em] uppercase text-text-primary">Vexcode</span>
        </div>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-bg-secondary border-b border-card-border z-40">
      <HeaderNav
        projectName={projectName}
        projects={projects}
        onSelectProject={onSelectProject}
        reports={reports}
        currentReportId={currentReportId}
        onSelectReportId={onSelectReportId}
      />
      <div className="flex items-center gap-3">
        <HeaderActions onOpenSettings={onOpenSettings} theme={theme} onToggleTheme={onToggleTheme} />
        <ScanButton
          onStartScan={onStartScan}
          onReResolve={onReResolve}
          currentReportId={currentReportId}
        />
      </div>
    </header>
  );
};
