import React from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { FilterPanel } from '../components/FilterPanel';
import { FindingsList } from '../components/FindingsList';
import { CodeInspector } from '../components/CodeInspector';

interface IssuesPageProps {
  currentReport: any;
  selectedFindingIndex: number | null;
  setSelectedFindingIndex: (idx: number | null) => void;
  selectedFilePath: string | null;
  setSelectedFilePath: (path: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterSeverities: string[];
  setFilterSeverities: React.Dispatch<React.SetStateAction<string[]>>;
  filterCategories: string[];
  setFilterCategories: React.Dispatch<React.SetStateAction<string[]>>;
  filterStatuses: string[];
  setFilterStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  filterLanguages: string[];
  setFilterLanguages: React.Dispatch<React.SetStateAction<string[]>>;
  filterCounts: {
    severity: { error: number; warning: number; info: number };
    category: { security: number; quality: number; maintainability: number; architecture: number };
    status: { pending: number; applied: number };
    language: Record<string, number>;
  };
  availableLanguages: string[];
  searchedAndFilteredFindings: any[];
  config: any;
  onApplyFix: (finding: any, remediationCode: string) => Promise<boolean>;
  onReResolve: () => Promise<void>;
  isReResolving: boolean;
  onSelectFindingIndex: (index: number | null) => void;
}

export const IssuesPage: React.FC<IssuesPageProps> = ({
  currentReport,
  selectedFindingIndex,
  setSelectedFindingIndex,
  selectedFilePath,
  setSelectedFilePath,
  searchQuery,
  setSearchQuery,
  filterSeverities,
  setFilterSeverities,
  filterCategories,
  setFilterCategories,
  filterStatuses,
  setFilterStatuses,
  filterLanguages,
  setFilterLanguages,
  filterCounts,
  availableLanguages,
  searchedAndFilteredFindings,
  config,
  onApplyFix,
  onReResolve,
  isReResolving,
  onSelectFindingIndex,
}) => {
  if (!currentReport || !currentReport.findings) return null;

  if (selectedFindingIndex === null) {
    return (
      <div className="flex-1 flex overflow-hidden min-h-0 bg-bg-secondary animate-slide-left">
        {/* Left Column: Search & Filters */}
        <FilterPanel
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterSeverities={filterSeverities}
          setFilterSeverities={setFilterSeverities}
          filterCategories={filterCategories}
          setFilterCategories={setFilterCategories}
          filterStatuses={filterStatuses}
          setFilterStatuses={setFilterStatuses}
          filterLanguages={filterLanguages}
          setFilterLanguages={setFilterLanguages}
          filterCounts={filterCounts}
          availableLanguages={availableLanguages}
        />

        {/* Right Column: List of Findings */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 bg-bg-secondary border-b border-card-border/55">
            <div className="min-w-0">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Code & Issues
              </h2>
              <p className="mt-1 text-[11px] text-text-tertiary truncate">
                Re-run AI suggestions for this saved scan without scanning the project again.
              </p>
            </div>
            <button
              type="button"
              onClick={onReResolve}
              disabled={isReResolving || !currentReport._savedAt || currentReport.findings.length === 0}
              className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-warning/35 bg-warning/12 px-3 text-xs font-semibold text-warning transition-all hover:border-warning/60 hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Ask AI to regenerate suggestions for the existing report"
            >
              {isReResolving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              <span>{isReResolving ? 'Asking AI...' : 'Ask AI Again'}</span>
            </button>
          </div>
          <FindingsList
            searchedAndFilteredFindings={searchedAndFilteredFindings}
            currentReport={currentReport}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelectFinding={(file, index) => {
              setSelectedFilePath(file);
              setSelectedFindingIndex(index);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-bg-secondary animate-slide-left">
      <CodeInspector
        finding={currentReport.findings[selectedFindingIndex]}
        aiResolutions={currentReport.ai_resolutions || {}}
        targetPath={currentReport.target_path || null}
        selectedProvider={config?.AI_PROVIDER || 'openai'}
        apiKey={config?.[`${(config?.AI_PROVIDER || 'openai').toUpperCase()}_API_KEY`] || ''}
        apiBaseUrl={
          config?.[`${(config?.AI_PROVIDER || 'openai').toUpperCase()}_BASE_URL`] || ''
        }
        aiModel={config?.[`${(config?.AI_PROVIDER || 'openai').toUpperCase()}_MODEL`] || ''}
        aiTemperature={parseFloat(config?.AI_TEMPERATURE) || 0.1}
        aiMaxTokens={parseInt(config?.AI_MAX_TOKENS) || 4096}
        onApplyFix={onApplyFix}
        metrics={currentReport.metrics}
        allFindings={currentReport.findings}
        onSelectFindingIndex={onSelectFindingIndex}
      />
    </div>
  );
};

export default IssuesPage;
