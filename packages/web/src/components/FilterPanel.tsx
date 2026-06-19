import React, { useState } from 'react';
import { Filter, RotateCcw, ChevronDown, AlertOctagon, AlertTriangle, Info, Shield, Bug, Wrench, Layout, Clock, CheckCircle2, Ban, EyeOff, Terminal, X, Sparkles, RefreshCw } from 'lucide-react';

interface FilterPanelProps {
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
  filterScanStatuses: string[];
  setFilterScanStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  filterCounts: {
    severity: { error: number; warning: number; info: number };
    category: { security: number; quality: number; maintainability: number; architecture: number };
    status: { open: number; applied: number; false_positive: number; ignored: number };
    language: Record<string, number>;
    scanStatus: { new: number; persisting: number; resolved: number; regressed: number };
  };
  availableLanguages: string[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
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
  filterScanStatuses,
  setFilterScanStatuses,
  filterCounts,
  availableLanguages,
}) => {
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    severity: true,
    category: true,
    status: true,
    language: true,
    scanStatus: true,
  });

  const toggleFilterSection = (section: string) => {
    setExpandedFilters((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 pr-2 gap-4 shrink-0 select-none bg-bg-primary">
      {/* Floating Card Wrapper for filters (width: 68 / 272px) */}
      <div className="w-68 min-w-68 flex-1 bg-bg-tertiary border border-card-border/40 rounded-2xl pt-5 pb-5 pl-5 pr-0 flex flex-col gap-3 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between pr-5 pb-3 border-b border-text-tertiary/30 h-8 box-content">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-text-primary" />
            <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
              Filters
            </h3>
          </div>
          <div className={`transition-opacity duration-150 ${(searchQuery || filterSeverities.length > 0 || filterCategories.length > 0 || filterStatuses.length > 0 || filterLanguages.length > 0 || filterScanStatuses.length > 0) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterSeverities([]);
                setFilterCategories([]);
                setFilterStatuses([]);
                setFilterLanguages([]);
                setFilterScanStatuses([]);
              }}
              className="flex items-center gap-1 text-xs font-bold text-accent-hover hover:text-accent-hover transition-colors cursor-pointer bg-accent/20 border border-accent/45 rounded-lg px-2.5 py-1.5 shadow-sm hover:bg-accent/30 hover:border-accent/60 duration-100"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {/* Filter Option Checklist stacked vertically inside scrollable container */}
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-5 pb-4">
          {/* Severity Filter */}
          <div className="pb-[14px] border-b border-text-tertiary/30">
            <div className="flex items-center justify-between py-1.5 select-none">
              <div
                onClick={() => toggleFilterSection('severity')}
                className="flex items-center gap-1.5 cursor-pointer group flex-1"
              >
                <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.severity ? '' : '-rotate-90'}`} />
                <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Severity</label>
              </div>
              {filterSeverities.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterSeverities([]);
                  }}
                  className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                  title="Clear Severity Filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {expandedFilters.severity && (
              <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                {[
                  { id: 'error', label: 'Error', key: 'error', icon: <AlertOctagon className="h-4 w-4 text-error shrink-0" /> },
                  { id: 'warning', label: 'Warning', key: 'warning', icon: <AlertTriangle className="h-4 w-4 text-warning shrink-0" /> },
                  { id: 'info', label: 'Info', key: 'info', icon: <Info className="h-4 w-4 text-info shrink-0" /> }
                ].map(opt => {
                  const isActive = filterSeverities.includes(opt.id);
                  const count = filterCounts.severity[opt.key as keyof typeof filterCounts.severity] || 0;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setFilterSeverities(prev =>
                          prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id]
                        );
                      }}
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                        isActive
                          ? 'border-accent/50 bg-accent/12 text-text-primary'
                          : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {opt.icon}
                        <span className="font-sans text-sm font-medium">{opt.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="pb-[14px] border-b border-text-tertiary/30 pt-[2px]">
            <div className="flex items-center justify-between py-1.5 select-none">
              <div
                onClick={() => toggleFilterSection('category')}
                className="flex items-center gap-1.5 cursor-pointer group flex-1"
              >
                <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.category ? '' : '-rotate-90'}`} />
                <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Category</label>
              </div>
              {filterCategories.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterCategories([]);
                  }}
                  className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                  title="Clear Category Filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {expandedFilters.category && (
              <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                {[
                  { id: 'security', label: 'Security', key: 'security', icon: <Shield className="h-4 w-4 text-error shrink-0" /> },
                  { id: 'quality', label: 'Quality', key: 'quality', icon: <Bug className="h-4 w-4 text-warning shrink-0" /> },
                  { id: 'maintainability', label: 'Maintainability', key: 'maintainability', icon: <Wrench className="h-4 w-4 text-success shrink-0" /> },
                  { id: 'architecture', label: 'Architecture', key: 'architecture', icon: <Layout className="h-4 w-4 text-info shrink-0" /> }
                ].map(opt => {
                  const isActive = filterCategories.includes(opt.id);
                  const count = filterCounts.category[opt.key as keyof typeof filterCounts.category] || 0;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setFilterCategories(prev =>
                          prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id]
                        );
                      }}
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                        isActive
                          ? 'border-accent/50 bg-accent/12 text-text-primary'
                          : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {opt.icon}
                        <span className="font-sans text-sm font-medium">{opt.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="pb-[14px] border-b border-text-tertiary/30 pt-[2px]">
            <div className="flex items-center justify-between py-1.5 select-none">
              <div
                onClick={() => toggleFilterSection('status')}
                className="flex items-center gap-1.5 cursor-pointer group flex-1"
              >
                <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.status ? '' : '-rotate-90'}`} />
                <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Status</label>
              </div>
              {filterStatuses.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterStatuses([]);
                  }}
                  className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                  title="Clear Status Filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {expandedFilters.status && (
              <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                {[
                  { id: 'open', label: 'Open', key: 'open', icon: <Clock className="h-4 w-4 text-text-secondary shrink-0" /> },
                  { id: 'applied', label: 'Applied', key: 'applied', icon: <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> },
                  { id: 'false_positive', label: 'False Positive', key: 'false_positive', icon: <Ban className="h-4 w-4 text-warning shrink-0" /> },
                  { id: 'ignored', label: 'Ignored', key: 'ignored', icon: <EyeOff className="h-4 w-4 text-info shrink-0" /> },
                ].map(opt => {
                  const isActive = filterStatuses.includes(opt.id);
                  const count = filterCounts.status[opt.key as keyof typeof filterCounts.status] || 0;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setFilterStatuses(prev =>
                          prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id]
                        );
                      }}
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                        isActive
                          ? 'border-accent/50 bg-accent/12 text-text-primary'
                          : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {opt.icon}
                        <span className="font-sans text-sm font-medium">{opt.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scan Status Filter */}
          <div className="pb-[14px] border-b border-text-tertiary/30 pt-[2px]">
            <div className="flex items-center justify-between py-1.5 select-none">
              <div
                onClick={() => toggleFilterSection('scanStatus')}
                className="flex items-center gap-1.5 cursor-pointer group flex-1"
              >
                <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.scanStatus ? '' : '-rotate-90'}`} />
                <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Scan Status</label>
              </div>
              {filterScanStatuses.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterScanStatuses([]);
                  }}
                  className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                  title="Clear Scan Status Filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {expandedFilters.scanStatus && (
              <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                {[
                  { id: 'new', label: 'New', key: 'new', icon: <Sparkles className="h-4 w-4 text-success shrink-0" /> },
                  { id: 'persisting', label: 'Persisting', key: 'persisting', icon: <AlertTriangle className="h-4 w-4 text-warning shrink-0" /> },
                  { id: 'resolved', label: 'Resolved', key: 'resolved', icon: <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> },
                  { id: 'regressed', label: 'Regressed', key: 'regressed', icon: <RefreshCw className="h-4 w-4 text-danger shrink-0" /> },
                ].map(opt => {
                  const isActive = filterScanStatuses.includes(opt.id);
                  const count = filterCounts.scanStatus[opt.key as keyof typeof filterCounts.scanStatus] || 0;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setFilterScanStatuses(prev =>
                          prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id]
                        );
                      }}
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                        isActive
                          ? 'border-accent/50 bg-accent/12 text-text-primary'
                          : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {opt.icon}
                        <span className="font-sans text-sm font-medium">{opt.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Language Filter */}
          {availableLanguages.length > 0 && (
            <div className="pt-[2px]">
              <div className="flex items-center justify-between py-1.5 select-none">
                <div
                  onClick={() => toggleFilterSection('language')}
                  className="flex items-center gap-1.5 cursor-pointer group flex-1"
                >
                  <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.language ? '' : '-rotate-90'}`} />
                  <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Language</label>
                </div>
                {filterLanguages.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterLanguages([]);
                    }}
                    className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                    title="Clear Language Filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {expandedFilters.language && (
                <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                  {availableLanguages.map(lang => {
                    const isActive = filterLanguages.includes(lang);
                    const count = filterCounts.language[lang] || 0;
                    return (
                      <div
                        key={lang}
                        onClick={() => {
                          setFilterLanguages(prev =>
                            prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang]
                          );
                        }}
                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                          isActive
                            ? 'border-accent/50 bg-accent/12 text-text-primary'
                            : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Terminal className="h-4 w-4 text-text-secondary shrink-0" />
                          <span className="font-sans text-sm font-medium">{lang}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
