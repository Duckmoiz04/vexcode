import React, { useState, useMemo } from 'react';
import { Search, X, File, AlertTriangle, ShieldAlert, CheckSquare, Square, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Finding, FindingStatus, Report, PaginationInfo } from '../types';

interface IssueListProps {
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

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 0) return 'Just now';
    
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  } catch {
    return 'N/A';
  }
};

const getRelativePath = (filePath: string, targetPath: string | null): string => {
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

export const IssueList: React.FC<IssueListProps> = ({
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
  const [checkedFindings, setCheckedFindings] = useState<Record<number, boolean>>({});

  // Group findings by file path
  const groupedFindings = useMemo(() => {
    const groups: Record<string, Finding[]> = {};
    searchedAndFilteredFindings.forEach((f) => {
      if (!groups[f.file]) {
        groups[f.file] = [];
      }
      groups[f.file].push(f);
    });
    return groups;
  }, [searchedAndFilteredFindings]);


  const getSoftwareCategory = (f: Finding) => {
    if (f.finding_type === 'confirmed') return 'Security';
    if (f.finding_type === 'hotspot') return 'Security Hotspot';
    if (f.severity === 'error') return 'Reliability';
    return 'Maintainability';
  };

  const getSeverityLabel = (f: Finding) => {
    if (f.severity === 'error') return 'High';
    if (f.severity === 'warning') return 'Medium';
    return 'Low';
  };

  const getTags = (f: Finding) => {
    const parts = f.rule_id.split('.');
    const tags = parts.filter(p => p !== 'rules' && p !== 'detect' && p !== 'security' && p !== 'javascript' && p !== 'python' && p.length > 2);
    if (f.owasp_id) tags.push(f.owasp_id.toLowerCase());
    return tags.slice(0, 3);
  };

  const getStatus = (f: Finding): FindingStatus => {
    if (f.status) return f.status;
    return f._applied ? 'applied' : 'open';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-primary p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between pb-4 border-b border-card-border/50 mb-5">
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
            className="w-full bg-bg-tertiary border border-card-border/60 rounded-xl pl-10 pr-10 py-3 text-sm text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary font-medium shadow-inner"
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
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {Object.entries(groupedFindings).map(([filePath, fileFindings]) => {
              const cleanRelativePath = getRelativePath(filePath, currentReport?.target_path);

              return (
                <div key={filePath} className="flex flex-col gap-1.5 mb-6 last:mb-0">
                  {/* File Header */}
                  <div className="flex items-center gap-1.5 py-1 px-0 select-none">
                    <File className="h-4 w-4 text-text-tertiary shrink-0" />
                    <span className="text-[12px] font-mono font-bold text-text-secondary truncate" title={filePath}>
                      {cleanRelativePath}
                    </span>
                  </div>

                  {/* Findings list inside this file group */}
                  <div className="flex flex-col gap-3">
                    {fileFindings.map((f: Finding) => {
                      const originalIndex = currentReport.findings.indexOf(f);
                      const severity = (f.severity || '').toLowerCase();
                      const isChecked = !!checkedFindings[originalIndex];
                      const currentStatus = getStatus(f);

                      const severityColorClass =
                        severity === 'error'
                          ? 'text-danger bg-danger/10 border-danger/20'
                          : severity === 'warning'
                          ? 'text-warning bg-warning/10 border-warning/20'
                          : 'text-info bg-info/10 border-info/20';

                      return (
                        <div
                          key={originalIndex}
                          onClick={() => {
                            onSelectFinding(f.file, originalIndex);
                          }}
                          className="p-4 rounded-xl border border-card-border bg-card-bg hover:border-accent/30 hover:bg-bg-tertiary/20 cursor-pointer transition-all flex flex-col gap-3 shadow-sm group"
                        >
                          {/* Tầng 1: Checkbox + Tiêu đề + Clean Code Attribute */}
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCheckedFindings(prev => ({ ...prev, [originalIndex]: !isChecked }));
                              }}
                              className="mt-1 text-text-tertiary hover:text-accent transition-colors shrink-0"
                            >
                              {isChecked ? (
                                <CheckSquare className="h-5 w-5 text-accent" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                            {/* Tiêu đề lỗi (Message) */}
                            <span className="text-base font-medium text-text-primary group-hover:text-accent transition-colors flex-1 select-text">
                              {f.message}
                            </span>
                          </div>

                          {/* Tầng 2: Phân loại & Gắn thẻ (Badges) */}
                          <div className="flex items-center justify-between gap-2 flex-wrap pl-7">
                            {/* Cặp nhãn nền nhạt (Khía cạnh + Mức độ) */}
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold font-sans bg-bg-secondary text-text-secondary px-2 py-0.5 rounded border border-card-border/40">
                                {getSoftwareCategory(f)}
                              </span>
                              <span className={`text-[11px] font-bold font-sans px-2 py-0.5 rounded border ${severityColorClass}`}>
                                {getSeverityLabel(f)}
                              </span>
                            </div>

                            {/* Hệ thống Tags */}
                            <div className="flex items-center gap-1.5">
                              {getTags(f).map(tag => (
                                <span key={tag} className="text-[10px] font-mono bg-bg-secondary text-text-tertiary px-2 py-0.5 rounded border border-card-border/30">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Tầng 3: Vận hành & Trạng thái (Thanh dưới cùng) */}
                          <div className="flex items-center justify-between border-t border-card-border/40 pt-3 text-[12px] text-text-tertiary pl-7 flex-wrap gap-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Menu Trạng thái xử lý */}
                              {onStatusChange ? (
                                <select
                                  value={currentStatus}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(f, e.target.value as FindingStatus);
                                  }}
                                  className="bg-transparent border-none text-[12px] font-bold text-text-secondary cursor-pointer focus:outline-none hover:text-text-primary transition-colors pr-1"
                                >
                                  <option value="open" className="bg-bg-secondary">Open</option>
                                  <option value="confirmed" className="bg-bg-secondary">Confirmed</option>
                                  <option value="resolved" className="bg-bg-secondary">Resolved</option>
                                  <option value="applied" className="bg-bg-secondary">Applied</option>
                                  <option value="false_positive" className="bg-bg-secondary">False Positive</option>
                                </select>
                              ) : (
                                <span className="font-bold text-text-secondary capitalize">{currentStatus}</span>
                              )}

                              <span>•</span>

                              {/* Vị trí dòng */}
                              <span className="font-mono font-semibold text-text-secondary">L{f.line}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Bản chất lỗi */}
                              <div className="flex items-center gap-1.5">
                                {f.finding_type === 'confirmed' ? (
                                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-danger" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                                )}
                                <span className="capitalize">{f.finding_type || 'code smell'}</span>
                              </div>

                              {currentReport.timestamp && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-1 text-[11px] text-text-tertiary">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    <span>Scanned: {formatDate(currentReport.timestamp)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && onPageChange && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-card-border/50 w-full">
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
        </div>
      )}
    </div>
  );
};
