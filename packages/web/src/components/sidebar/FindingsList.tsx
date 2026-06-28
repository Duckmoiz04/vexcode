import React, { useState, useMemo } from 'react';
import { File, AlertTriangle, ShieldAlert, CheckSquare, Square, Calendar } from 'lucide-react';
import type { Finding, FindingStatus } from '../../types';
import { classifyFinding, CATEGORIES } from '../../utils/categories';
import { getRelativePath } from './utils';

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

interface FindingsListProps {
  findings: Finding[];
  searchedAndFilteredFindings: Finding[];
  selectedFindingIndex: number | null;
  onSelectFindingIndex?: (index: number | null) => void;
  onSelectFilePath: (path: string | null) => void;
  targetPath: string | null;
  reportTimestamp?: string | null;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  searchedAndFilteredFindings,
  selectedFindingIndex,
  onSelectFindingIndex,
  onSelectFilePath,
  targetPath,
  reportTimestamp,
}) => {
  const [checkedFindings, setCheckedFindings] = useState<Record<number, boolean>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<number, FindingStatus>>({});

  // Group findings by file
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


const getSoftwareCategoryLabel = (f: Finding): string => CATEGORIES[classifyFinding(f)].label;

  const getSeverityLabel = (f: Finding) => {
    if (f.severity === 'error') return 'High';
    if (f.severity === 'warning') return 'Medium';
    return 'Low';
  };

  const getTags = (f: Finding) => {
    const parts = f.rule_id.split('.');
    const tags = parts.filter(p => p !== 'rules' && p !== 'detect' && p !== 'security' && p !== 'javascript' && p !== 'python' && p.length > 2);
    if (f.owasp_id) tags.push(f.owasp_id.toLowerCase());
    return tags.slice(0, 2);
  };

  return (
    <div className="flex flex-col">
      {Object.entries(groupedFindings).map(([filePath, fileFindings]) => {
        const cleanRelativePath = getRelativePath(filePath, targetPath);

        return (
          <div key={filePath} className="flex flex-col gap-1.5 mb-6 last:mb-0">
            {/* File Header */}
            <div className="flex items-center gap-1.5 py-1 px-0 select-none">
              <File className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
              <span className="text-[11px] font-mono font-bold text-text-secondary truncate" title={cleanRelativePath}>
                {cleanRelativePath}
              </span>
            </div>

            {/* Findings under this file */}
            <div className="flex flex-col gap-2">
              {fileFindings.map((f: Finding) => {
                const originalIndex = findings.indexOf(f);
                const isActive = originalIndex === selectedFindingIndex;
                const severity = (f.severity || '').toLowerCase();
                const isChecked = !!checkedFindings[originalIndex];
                const currentStatus = localStatuses[originalIndex] || f.status || (f._applied ? 'applied' : 'open');

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
                      onSelectFilePath(f.file);
                      if (onSelectFindingIndex) {
                        onSelectFindingIndex(originalIndex);
                      }
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-2.5 group ${
                      isActive
                        ? 'bg-accent/5 border-accent/40 text-text-primary shadow-sm'
                        : 'bg-bg-tertiary/10 border-card-border hover:bg-bg-tertiary/30 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {/* Tầng 1: Checkbox + Tiêu đề + Clean Code Attribute */}
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      <button
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
                      <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors flex-1 select-text">
                        {f.message}
                      </span>
                    </div>

                    {/* Tầng 2: Phân loại & Gắn thẻ (Badges) */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pl-[22px]">
                      {/* Cặp nhãn nền nhạt (Khía cạnh + Mức độ) */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-sans bg-bg-secondary text-text-secondary px-1.5 py-0.5 rounded border border-card-border/40">
                          {getSoftwareCategoryLabel(f)}
                        </span>
                        <span className={`text-[10px] font-bold font-sans px-1.5 py-0.5 rounded border ${severityColorClass}`}>
                          {getSeverityLabel(f)}
                        </span>
                      </div>

                      {/* Hệ thống Tags */}
                      <div className="flex items-center gap-1">
                        {getTags(f).map(tag => (
                          <span key={tag} className="text-[10px] font-mono bg-bg-secondary text-text-tertiary px-1 py-0.2 rounded border border-card-border/30">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Tầng 3: Vận hành & Trạng thái (Thanh dưới cùng) */}
                    <div className="flex items-center justify-between border-t border-card-border/40 pt-2 text-[11px] text-text-tertiary pl-[22px] flex-wrap gap-y-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Menu Trạng thái xử lý */}
                        <select
                          value={currentStatus}
                          onChange={(e) => {
                            e.stopPropagation();
                            setLocalStatuses(prev => ({ ...prev, [originalIndex]: e.target.value as FindingStatus }));
                          }}
                          className="bg-transparent border-none text-[11px] font-bold text-text-secondary cursor-pointer focus:outline-none hover:text-text-primary transition-colors pr-1"
                        >
                          <option value="open" className="bg-bg-secondary">Open</option>
                          <option value="confirmed" className="bg-bg-secondary">Confirmed</option>
                          <option value="resolved" className="bg-bg-secondary">Resolved</option>
                          <option value="applied" className="bg-bg-secondary">Applied</option>
                          <option value="false_positive" className="bg-bg-secondary">False Positive</option>
                        </select>

                        <span>•</span>

                        {/* Vị trí dòng */}
                        <span className="font-mono font-semibold text-text-secondary">L{f.line}</span>
                      </div>

                       <div className="flex items-center gap-1 flex-wrap">
                         {/* Bản chất lỗi */}
                         <div className="flex items-center gap-1">
                            {f.finding_type === 'confirmed' ? (
                             <ShieldAlert className="h-3 w-3 shrink-0 text-danger" />
                           ) : (
                             <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
                           )}
                           <span className="capitalize">{f.finding_type || 'code smell'}</span>
                         </div>

                         {reportTimestamp && (
                           <>
                             <span>•</span>
                             <div className="flex items-center gap-0.5 text-[10px] text-text-tertiary">
                               <Calendar className="h-3 w-3 shrink-0" />
                               <span>{formatDate(reportTimestamp)}</span>
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
  );
};
