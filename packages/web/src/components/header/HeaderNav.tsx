import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Folder } from 'lucide-react';
import type { Project, ReportListItem } from '../../types';


export interface HeaderNavProps {
  projectName: string | null;
  projects: Project[];
  onSelectProject: (name: string | null) => void;
  reports: ReportListItem[];
  currentReportId: string | null;
  onSelectReportId: (id: string) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  projectName,
  projects,
  onSelectProject,
  reports,
  currentReportId,
  onSelectReportId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setIsVersionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatReportId = (id: string) => {
    if (!id) return '';
    return id
      .replace('report_', '')
      .replace(/-/g, (m: string, i: number) => (i > 10 ? ':' : i > 7 ? '-' : ' '));
  };

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    try {
      const now = new Date();
      const date = new Date(timestamp);
      const diffMs = now.getTime() - date.getTime();
      
      if (isNaN(diffMs)) return '';

      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) {
        return 'vừa xong';
      } else if (diffMins < 60) {
        return `${diffMins} phút trước`;
      } else if (diffHours < 24) {
        return `${diffHours} giờ trước`;
      } else {
        return `${diffDays} ngày trước`;
      }
    } catch {
      return '';
    }
  };

  return (
    <div className="flex items-center gap-6">
      <div 
        className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onSelectProject(null)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="h-6 w-auto text-accent" fill="currentColor">
          <path d="M1.88 5.21039C1.6008 5.36239 1.2504 5.33599 1.2504 5.01199V3.67599L6.308 0.799988V2.13599C6.308 2.46079 6.0832 2.85599 5.7864 3.00959L1.88 5.21439V5.21039ZM9.1704 14.5336C9.4496 14.376 9.4496 14.1016 9.1704 13.948L5.144 11.6544C4.98356 11.5785 4.80828 11.5391 4.6308 11.5391C4.45331 11.5391 4.27803 11.5785 4.1176 11.6544L2.952 12.3248L8.0104 15.2L9.176 14.5344L9.1704 14.5336ZM13.4904 3.00559C13.2024 2.85759 12.9504 2.97359 12.9504 3.30239V7.89279C12.9504 8.21679 13.184 8.61279 13.4904 8.76079L14.7048 9.43199V3.67599L13.4904 3.01039V3.00559Z" />
          <path d="M1.2504 3.67999L6.308 0.799988L10.8576 3.38719C11.1368 3.54079 11.1368 3.81519 10.8576 3.96799L6.8256 6.26319C6.5512 6.41599 6.0784 6.41599 5.804 6.26319L1.2496 3.67519L1.2504 3.67999ZM2.6 7.01039C2.6 6.68159 2.8384 6.55999 3.1536 6.71759L7.4464 9.05359C7.6026 9.14519 7.73445 9.27305 7.83081 9.42636C7.92716 9.57966 7.9852 9.75392 8 9.93439V15.2L2.6 12.2752V7.01039ZM10.3088 12.0144C10.0384 12.172 9.8 12.0504 9.8 11.7264V7.13599C9.8 6.81199 10.0208 6.41599 10.3088 6.26319L14.7504 3.67599V9.43119L10.3088 12.0144Z" />
        </svg>
        <span className="text-base font-semibold tracking-[0.25em] text-text-primary uppercase">Vexcode</span>
      </div>

      {/* Project & Scan Version Selectors (Breadcrumbs style) */}
      {projectName && (
        <div className="flex items-center gap-3">
          <span className="text-text-tertiary font-mono select-none">/</span>
          
          {/* Project Selector (Custom Dropdown) */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all ${
                isOpen
                  ? 'border-accent/40 bg-accent/10 text-text-primary'
                  : 'border-card-border bg-bg-tertiary text-text-secondary hover:border-text-secondary hover:bg-bg-tertiary/80'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="max-w-[160px] truncate">{projectName}</span>
              <ChevronDown className={`h-3 w-3 text-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 z-50 mt-1.5 w-80 animate-slide-up overflow-hidden rounded-xl border border-card-border bg-bg-tertiary shadow-2xl">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border text-xs font-semibold tracking-wider text-text-tertiary uppercase">
                  <span>Projects</span>
                  <span className="bg-accent px-1.5 py-0.5 rounded-full text-white text-xs">{projects.length}</span>
                </div>
                <div className="max-h-72 overflow-y-auto p-1.5">
                  {projects.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-text-tertiary text-center">No projects scanned yet</div>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          onSelectProject(p.name);
                          setIsOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                          p.name === projectName
                            ? 'bg-accent/10 border-l-2 border-accent text-text-primary'
                            : 'hover:bg-bg-secondary text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Folder className="h-4 w-4 shrink-0 text-accent/80" />
                        <span className="flex-1 truncate font-mono text-xs">{p.name}</span>
                        <span className="text-xs text-text-tertiary font-sans shrink-0">{p.reportCount} scan(s)</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scan Version Selector (Custom Dropdown) */}
          {currentReportId && (
            <>
              <span className="text-text-tertiary font-mono select-none">/</span>
              <div className="relative" ref={versionDropdownRef}>
                <button
                  onClick={() => setIsVersionOpen(!isVersionOpen)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all ${
                    isVersionOpen
                      ? 'border-accent/40 bg-accent/10 text-text-primary'
                      : 'border-card-border bg-bg-tertiary text-text-secondary hover:border-text-secondary hover:bg-bg-tertiary/80'
                  }`}
                >
                  <span className="max-w-[180px] truncate">{formatReportId(currentReportId)}</span>
                  <ChevronDown className={`h-3 w-3 text-text-tertiary transition-transform duration-200 ${isVersionOpen ? 'rotate-180' : ''}`} />
                </button>

                {isVersionOpen && (
                  <div className="absolute top-full left-0 z-50 mt-1.5 w-72 animate-slide-up overflow-hidden rounded-xl border border-card-border bg-bg-tertiary shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border text-xs font-semibold tracking-wider text-text-tertiary uppercase">
                      <span>Scan Versions</span>
                      <span className="bg-accent px-1.5 py-0.5 rounded-full text-white text-xs">{reports.length}</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1.5">
                      {reports.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-text-tertiary text-center">No scans recorded</div>
                      ) : (
                        reports.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              onSelectReportId(r.id);
                              setIsVersionOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${
                              r.id === currentReportId
                                ? 'bg-accent/10 border-l-2 border-accent text-text-primary'
                                : 'hover:bg-bg-secondary text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-mono text-xs">{formatReportId(r.id)}</span>
                              {r.timestamp && (
                                <span className="text-[9.5px] text-text-tertiary mt-0.5">
                                  {formatRelativeTime(r.timestamp)}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-text-tertiary font-sans shrink-0 ml-3">{r.findings} findings</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
