import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Folder, Settings, Search } from 'lucide-react';

interface HeaderProps {
  projectName: string | null;
  projects: any[];
  onSelectProject: (name: string | null) => void;
  onOpenSettings: () => void;
  onStartScan: (fastScan: boolean) => void;
  reports: any[];
  currentReportId: string | null;
  onSelectReportId: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  projects,
  onSelectProject,
  onOpenSettings,
  onStartScan,
  reports,
  currentReportId,
  onSelectReportId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const versionDropdownRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setIsVersionOpen(false);
      }
      if (scanRef.current && !scanRef.current.contains(event.target as Node)) {
        setIsScanOpen(false);
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

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#161622] border-b border-card-border z-40">
      {/* Left side: Logo & Project selector */}
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
                              className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                                r.id === currentReportId
                                  ? 'bg-accent/10 border-l-2 border-accent text-text-primary'
                                  : 'hover:bg-bg-secondary text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <span className="flex-1 truncate font-mono text-xs">{formatReportId(r.id)}</span>
                              <span className="text-[10px] text-text-tertiary font-sans shrink-0">{r.findings} findings</span>
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

      {/* Right side: Control buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSettings}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-card-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all"
          title="Settings"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
        <div className="relative" ref={scanRef}>
          <div className="flex items-center">
            <button
              onClick={() => onStartScan(false)}
              className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-l-lg shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border-r border-accent/20"
              title="Scan entire project"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Scan Project</span>
            </button>
            <button
              onClick={() => setIsScanOpen(!isScanOpen)}
              className="flex h-[32px] items-center justify-center px-2 bg-accent hover:bg-accent-hover text-white rounded-r-lg shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
              title="Scan options"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {isScanOpen && (
            <div className="absolute top-full right-0 z-50 mt-1.5 w-56 animate-slide-up overflow-hidden rounded-xl border border-card-border bg-bg-tertiary shadow-2xl">
              <div className="px-3 py-2 border-b border-card-border text-[9px] font-semibold tracking-wider text-text-tertiary uppercase">
                Scan Options
              </div>
              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    onStartScan(false);
                    setIsScanOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-all"
                >
                  <Search className="h-3.5 w-3.5 text-accent shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Full Scan</span>
                    <span className="text-[9px] text-text-tertiary">Scan entire directory</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onStartScan(true);
                    setIsScanOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-all"
                >
                  <Folder className="h-3.5 w-3.5 text-success shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Fast Scan (Git)</span>
                    <span className="text-[9px] text-text-tertiary">Only scan changed files</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
