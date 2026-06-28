import React, { useState, useMemo } from 'react';
import type { Finding } from '../../types';
import { SidebarPanel } from './SidebarPanel';
import { FileTree } from './FileTree';
import { FindingsList } from './FindingsList';
import { getFileLanguage, getRelativePath } from './utils';
import { classifyFinding } from '../../utils/categories';

interface SidebarProps {
  projectName: string | null;
  findings: Finding[];
  selectedFilePath: string | null;
  onSelectFilePath: (path: string | null) => void;
  targetPath: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterSeverities: string[];
  setFilterSeverities: (sevs: string[]) => void;
  filterCategories: string[];
  setFilterCategories: (cats: string[]) => void;
  selectedFindingIndex: number | null;
  onSelectFindingIndex?: (index: number | null) => void;
  filterStatuses: string[];
  setFilterStatuses: (statuses: string[]) => void;
  filterLanguages: string[];
  setFilterLanguages: (langs: string[]) => void;
  filterScanStatuses: string[];
  setFilterScanStatuses: (statuses: string[]) => void;
  availableLanguages: string[];
  isCollapsed?: boolean;
  reportTimestamp?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projectName,
  findings,
  selectedFilePath,
  onSelectFilePath,
  targetPath,
  searchQuery,
  filterSeverities,
  filterCategories,
  selectedFindingIndex,
  onSelectFindingIndex,
  filterStatuses,
  filterLanguages,
  filterScanStatuses,
  availableLanguages,
  isCollapsed = false,
  reportTimestamp,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'findings'>('explorer');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const currentVal = prev[path] !== false;
      return { ...prev, [path]: !currentVal };
    });
  };


  const searchedAndFilteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const ruleId = (finding.rule_id || '').toLowerCase();
        const message = (finding.message || '').toLowerCase();
        const file = (finding.file || '').toLowerCase();
        if (!ruleId.includes(query) && !message.includes(query) && !file.includes(query)) {
          return false;
        }
      }

      if (filterSeverities.length > 0) {
        if (!filterSeverities.includes((finding.severity || '').toLowerCase())) {
          return false;
        }
      }

      if (filterCategories.length > 0) {
        if (!filterCategories.includes(classifyFinding(finding))) {
          return false;
        }
      }

      if (filterStatuses.length > 0) {
        const status = finding.status || (finding._applied ? 'applied' : 'open');
        if (!filterStatuses.includes(status)) {
          return false;
        }
      }

      if (filterLanguages.length > 0) {
        if (!filterLanguages.includes(getFileLanguage(finding.file))) {
          return false;
        }
      }

      if (filterScanStatuses && filterScanStatuses.length > 0) {
        const scanStatus = finding.scan_status || 'new';
        if (!filterScanStatuses.includes(scanStatus)) {
          return false;
        }
      }

      return true;
    });
  }, [findings, searchQuery, filterSeverities, filterCategories, filterStatuses, filterLanguages, filterScanStatuses]);

  return (
    <div className={`transition-all duration-300 ease-in-out bg-bg-secondary flex flex-col h-full overflow-hidden ${
      isCollapsed ? 'w-0 min-w-0 border-r-0' : 'w-72 min-w-72 border-r border-card-border'
    }`}>
      <SidebarPanel
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        searchedAndFilteredCount={searchedAndFilteredFindings.length}
        totalCount={findings.length}
      />
      <div className={`flex-1 overflow-y-auto scrollbar-thin ${sidebarTab === 'explorer' ? 'py-2 px-0' : 'py-3 px-4'}`}>
        {findings.length === 0 ? (
          <div className="text-xs text-text-tertiary text-center py-6">No data indexed</div>
        ) : searchedAndFilteredFindings.length === 0 ? (
          <div className="text-xs text-text-tertiary text-center py-6 italic">No matching results found</div>
        ) : sidebarTab === 'explorer' ? (
          <FileTree
            projectName={projectName}
            findings={findings}
            searchedAndFilteredFindings={searchedAndFilteredFindings}
            selectedFilePath={selectedFilePath}
            onSelectFilePath={onSelectFilePath}
            targetPath={targetPath}
            expandedFolders={expandedFolders}
            onToggleFolder={handleToggleFolder}
          />
        ) : (
          <FindingsList
            findings={findings}
            searchedAndFilteredFindings={searchedAndFilteredFindings}
            selectedFindingIndex={selectedFindingIndex}
            onSelectFindingIndex={onSelectFindingIndex}
            onSelectFilePath={onSelectFilePath}
            targetPath={targetPath}
            reportTimestamp={reportTimestamp}
          />
        )}
      </div>
    </div>
  );
};