import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Folder, Search, Wand2 } from 'lucide-react';

export interface ScanButtonProps {
  onStartScan: (fastScan: boolean) => void;
  onReResolve?: () => void;
  currentReportId: string | null;
}

export const ScanButton: React.FC<ScanButtonProps> = ({
  onStartScan,
  onReResolve,
  currentReportId,
}) => {
  const [isScanOpen, setIsScanOpen] = useState(false);
  const scanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (scanRef.current && !scanRef.current.contains(event.target as Node)) {
        setIsScanOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
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
            {onReResolve && currentReportId && (
              <button
                onClick={() => {
                  onReResolve();
                  setIsScanOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-all"
              >
                <Wand2 className="h-3.5 w-3.5 text-warning shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold">Re-ask AI</span>
                  <span className="text-[9px] text-text-tertiary">Resolve existing findings</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
