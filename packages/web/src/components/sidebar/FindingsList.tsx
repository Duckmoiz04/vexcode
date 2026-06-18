import React from 'react';
import type { Finding } from '../../types';

interface FindingsListProps {
  findings: Finding[];
  searchedAndFilteredFindings: Finding[];
  selectedFindingIndex: number | null;
  onSelectFindingIndex?: (index: number | null) => void;
  onSelectFilePath: (path: string | null) => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  searchedAndFilteredFindings,
  selectedFindingIndex,
  onSelectFindingIndex,
  onSelectFilePath,
}) => {
  return (
    <div className="space-y-2">
      {searchedAndFilteredFindings.map((f: Finding) => {
        const originalIndex = findings.indexOf(f);
        const isActive = originalIndex === selectedFindingIndex;
        const severity = (f.severity || '').toLowerCase();
        const isApplied = f._applied;

        return (
          <div
            key={originalIndex}
            onClick={() => {
              onSelectFilePath(f.file);
              if (onSelectFindingIndex) {
                onSelectFindingIndex(originalIndex);
              }
            }}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 ${
              isActive
                ? 'bg-accent/10 border border-accent/30 text-text-primary shadow-sm'
                : 'bg-bg-tertiary/20 border border-card-border/30 hover:bg-bg-tertiary/40 text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  severity === 'error'
                    ? 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    : severity === 'warning'
                    ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                    : 'bg-info shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                }`}
              />
              <span className="text-[13px] font-mono font-semibold truncate flex-1 leading-none text-text-primary">
                {f.rule_id.split('.').pop() || f.rule_id}
              </span>
              {isApplied && (
                <span className="text-xs px-1.5 py-0.5 bg-success/15 border border-success/30 text-success rounded font-bold font-sans uppercase">
                  applied
                </span>
              )}
            </div>
            <div className="text-[13px] font-mono text-text-tertiary flex items-center justify-between">
              <span className="truncate pr-2 font-medium">{f.file.split(/[\\/]/).pop()}</span>
              <span className="shrink-0">Line {f.line}</span>
            </div>
            <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-2 select-none font-sans mt-0.5">
              {f.message}
            </p>
          </div>
        );
      })}
    </div>
  );
};
