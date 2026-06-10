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
    <>
      {/* Explorer / Findings Tabs Header */}
      <div className="flex border-b border-card-border/50 bg-bg-secondary/40 shrink-0 px-4 pt-2 gap-3">
        <button
          onClick={() => setSidebarTab('explorer')}
          className={`pb-2 text-[13px] font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            sidebarTab === 'explorer'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Folder className="h-3.5 w-3.5" />
          <span>File Tree</span>
        </button>
        <button
          onClick={() => setSidebarTab('findings')}
          className={`pb-2 text-[13px] font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            sidebarTab === 'findings'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Findings</span>
        </button>
      </div>

      {/* Title and Stats Counter */}
      <div className="px-4 py-2.5 border-b border-card-border/50 flex items-center justify-between shrink-0 bg-bg-secondary/10">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-text-secondary">
          {sidebarTab === 'explorer' ? 'File Structure' : 'Project Issues'}
        </h3>
        <span className="text-[11px] font-mono font-bold text-text-tertiary bg-bg-secondary px-2 py-0.5 rounded border border-card-border/40">
          {searchedAndFilteredCount} / {totalCount}
        </span>
      </div>
    </>
  );
};
