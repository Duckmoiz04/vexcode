import React from 'react';
import { Folder, ShieldAlert } from 'lucide-react';

interface SidebarPanelProps {
  sidebarTab: 'explorer' | 'findings';
  setSidebarTab: (tab: 'explorer' | 'findings') => void;
  searchedAndFilteredCount: number;
  totalCount: number;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  sidebarTab,
  setSidebarTab,
  searchedAndFilteredCount,
  totalCount,
}) => {
  return (
    <div className="flex items-center justify-between h-10 px-5 border-b border-card-border bg-bg-tertiary/80 shrink-0">
      <div className="flex gap-3 h-full">
        <button
          onClick={() => setSidebarTab('explorer')}
          className={`h-full text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            sidebarTab === 'explorer'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Folder className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span>File Tree</span>
        </button>
        <button
          onClick={() => setSidebarTab('findings')}
          className={`h-full text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            sidebarTab === 'findings'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span>Findings</span>
        </button>
      </div>

      {sidebarTab !== 'explorer' && (
        <div className="flex items-center select-none">
          <span className="text-[11px] font-mono font-bold text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-md border border-text-tertiary/40">
            {searchedAndFilteredCount} / {totalCount}
          </span>
        </div>
      )}
    </div>
  );
};
