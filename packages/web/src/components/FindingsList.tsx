import React from 'react';
import { Search, X, Ban, EyeOff, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Finding, FindingStatus, Report, PaginationInfo } from '../types';

interface FindingsListProps {
  searchedAndFilteredFindings: Finding[];
  currentReport: Report;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectFinding: (filePath: string, originalIndex: number) => void;
  onStatusChange?: (finding: Finding, status: FindingStatus) => void;
  pagination?: PaginationInfo | null;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

const classifyFinding = (finding: Finding) => {
  const ruleId = (finding.rule_id || '').toLowerCase();
  
  const securityKeywords = [
    'security', 'vuln', 'injection', 'xss', 'csrf', 'crypt', 'hash', 'permission',
    'auth', 'token', 'jwt', 'secret', 'key', 'leak', 'owasp', 'cwe'
  ];
  if (securityKeywords.some(kw => ruleId.includes(kw))) {
    return 'security';
  }
  
  const styleKeywords = [
    'style', 'naming', 'format', 'lint', 'comment', 'docstring', 'unused',
    'convention', 'pep8', 'eslint'
  ];
  if (styleKeywords.some(kw => ruleId.includes(kw))) {
    return 'maintainability';
  }
  
  if (ruleId.includes('complexity') || ruleId.includes('long') || ruleId.includes('large') || ruleId.includes('depth')) {
    return 'architecture';
  }
  
  return 'quality';
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-bg-tertiary border-card-border text-text-secondary' },
  applied: { label: 'Applied', color: 'bg-success/15 border-success/35 text-success' },
  false_positive: { label: 'False Positive', color: 'bg-warning/15 border-warning/35 text-warning' },
  ignored: { label: 'Ignored', color: 'bg-info/15 border-info/35 text-info' },
};

const getStatus = (f: Finding): FindingStatus => {
  if (f.status) return f.status;
  return f._applied ? 'applied' : 'open';
};

export const FindingsList: React.FC<FindingsListProps> = ({
  searchedAndFilteredFindings,
  currentReport,
  searchQuery,
  setSearchQuery,
  onSelectFinding,
  onStatusChange,
  pagination,
  currentPage,
  onPageChange,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-secondary p-4 pl-2 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between pb-4 border-b border-text-tertiary/30 mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            PROJECT FINDINGS
          </h3>
          <span className="px-2.5 py-0.5 bg-accent text-white rounded-full text-xs font-bold shadow-sm font-sans">
            {searchedAndFilteredFindings.length} finding(s) match filters
          </span>
        </div>
      </div>

      {/* Keyword Search Input */}
      <div className="mb-6 w-full">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search findings by rule ID, description message, or file path..."
            autoComplete="off"
            name="searchQuery"
            className="w-full bg-[#161622] border border-card-border/60 rounded-xl pl-10 pr-10 py-3 text-sm text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary font-medium shadow-inner"
          />
          <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-text-tertiary" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {searchedAndFilteredFindings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-text-tertiary animate-fade-in">
          <span className="text-3xl mb-3">🔍</span>
          <p className="font-semibold text-text-secondary text-sm">No Findings Found</p>
          <span className="text-xs max-w-sm mt-1.5 leading-relaxed">
            No findings match your search query or active filters. Try resetting or adjusting the options in the left column.
          </span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 w-full">
            {searchedAndFilteredFindings.map((f: Finding) => {
              const originalIndex = currentReport.findings.indexOf(f);
              const severity = (f.severity || '').toLowerCase();
              const cat = classifyFinding(f);
              const status = getStatus(f);
              const statusStyle = STATUS_LABELS[status] || STATUS_LABELS.open;

              return (
                <div
                  key={originalIndex}
                  onClick={() => {
                    onSelectFinding(f.file, originalIndex);
                  }}
                  className="p-4 rounded-xl border border-card-border bg-card-bg hover:border-accent/30 hover:bg-bg-tertiary/20 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm group"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          severity === 'error'
                            ? 'bg-error'
                            : severity === 'warning'
                            ? 'bg-warning'
                            : 'bg-info'
                        }`}
                      />
                      <span className="text-[12px] font-mono font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                        {f.rule_id}
                      </span>
                      <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider font-sans ${
                        cat === 'security'
                          ? 'bg-danger/10 border-danger/35 text-danger'
                          : cat === 'maintainability'
                          ? 'bg-warning/10 border-warning/35 text-warning'
                          : cat === 'architecture'
                          ? 'bg-accent/10 border-accent/35 text-accent'
                          : 'bg-info/10 border-info/35 text-info'
                      }`}>
                        {cat === 'security' ? '🛡️ Security' : cat === 'maintainability' ? '⚙️ Maintainability' : cat === 'architecture' ? '🏗️ Architecture' : '🐞 Quality'}
                      </span>
                      {(() => {
                        const getDisplayPath = (filePath: string, targetPath?: string) => {
                          if (!targetPath) return filePath.split(/[\\/]/).pop() || filePath;
                          const abs = filePath.replace(/\\/g, '/');
                          const target = targetPath.replace(/\\/g, '/');
                          if (abs.startsWith(target)) {
                            let rel = abs.slice(target.length);
                            if (rel.startsWith('/')) rel = rel.slice(1);
                            return rel || '.';
                          }
                          return abs;
                        };
                        const displayPath = getDisplayPath(f.file, currentReport?.target_path);
                        return (
                          <span className="text-xs text-text-tertiary font-mono font-semibold" title={f.file}>
                            {displayPath}:{f.line}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-text-secondary select-text font-normal leading-relaxed line-clamp-2">
                      {f.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center font-mono text-xs">
                    <span className={`text-xs px-2.5 py-0.5 rounded border font-semibold font-sans ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>
                    {onStatusChange && (
                      <div className="flex items-center gap-1">
                        {status === 'open' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(f, 'false_positive'); }}
                              className="p-1 rounded text-text-tertiary hover:text-warning hover:bg-warning/10 transition-colors"
                              title="Mark as False Positive"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(f, 'ignored'); }}
                              className="p-1 rounded text-text-tertiary hover:text-info hover:bg-info/10 transition-colors"
                              title="Ignore finding"
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {status !== 'open' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onStatusChange(f, 'open'); }}
                            className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Reopen finding"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && onPageChange && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-text-tertiary/30 w-full">
              <span className="text-xs text-text-tertiary font-mono">
                Page {currentPage ?? pagination.page} of {pagination.totalPages} ({pagination.total} total findings)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange((currentPage ?? pagination.page) - 1)}
                  disabled={(currentPage ?? pagination.page) <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-card-border bg-card-bg text-xs font-semibold text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange((currentPage ?? pagination.page) + 1)}
                  disabled={(currentPage ?? pagination.page) >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-card-border bg-card-bg text-xs font-semibold text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
