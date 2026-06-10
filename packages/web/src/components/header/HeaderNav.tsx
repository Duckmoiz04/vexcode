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
        className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onSelectProject(null)}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white shadow-lg">
          ◇
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">AI Code Review</span>
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
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border text-[10px] font-semibold tracking-wider text-text-tertiary uppercase">
                  <span>Projects</span>
                  <span className="bg-accent px-1.5 py-0.5 rounded-full text-white text-[9px]">{projects.length}</span>
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
                        <span className="text-[10px] text-text-tertiary font-sans shrink-0">{p.reportCount} scan(s)</span>
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
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border text-[10px] font-semibold tracking-wider text-text-tertiary uppercase">
                      <span>Scan Versions</span>
                      <span className="bg-accent px-1.5 py-0.5 rounded-full text-white text-[9px]">{reports.length}</span>
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
                            <span className="text-[10px] text-text-tertiary font-sans shrink-0 ml-3">{r.findings} findings</span>
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
