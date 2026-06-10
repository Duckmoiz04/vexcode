import React from 'react';
import type { BlastRadiusItem } from '../../types';
import { getRelativePath } from './dashboardUtils';

interface TopFile {
  file: string;
  count: number;
}

interface TopSymbol {
  name: string;
  file: string;
  blastCount: number;
  blastRadius: BlastRadiusItem[];
  issuesCount: number;
}

interface TopComplexFile {
  file: string;
  complexity: number;
  cognitive: number;
  level: string;
  loc: number;
}

interface LeaderboardsProps {
  topFiles: TopFile[];
  topComplexFiles: TopComplexFile[];
  topSymbols: TopSymbol[];
  targetPath: string | null | undefined;
  onSelectFilePath: (path: string | null) => void;
}

export const Leaderboards: React.FC<LeaderboardsProps> = ({
  topFiles,
  topComplexFiles,
  topSymbols,
  targetPath,
  onSelectFilePath,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Top Affected Files */}
      <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col col-span-1">
        <h4 className="text-xs font-bold text-text-secondary mb-3 uppercase tracking-wider">Top Affected Files</h4>
        <div className="space-y-2 flex-1">
          {topFiles.length === 0 ? (
            <div className="text-xs text-text-tertiary py-4 text-center">No affected files</div>
          ) : (
            topFiles.map((sf) => (
              <div
                key={sf.file}
                onClick={() => onSelectFilePath(sf.file)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-bg-primary/40 hover:bg-bg-primary/80 border border-card-border/40 cursor-pointer transition-all"
              >
                <span className="text-[11px] font-mono text-text-primary truncate pr-4" title={sf.file}>
                  {getRelativePath(sf.file, targetPath)}
                </span>
                <span className="text-[10px] text-accent shrink-0 font-semibold">{sf.count} issue(s)</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Complex Files */}
      <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col col-span-1">
        <h4 className="text-xs font-bold text-text-secondary mb-3 uppercase tracking-wider">Top Complex Files</h4>
        <div className="space-y-2 flex-1">
          {topComplexFiles.length === 0 ? (
            <div className="text-xs text-text-tertiary py-4 text-center">No complexity metrics available</div>
          ) : (
            topComplexFiles.map((cf) => {
              const badgeColor = cf.level === 'HIGH'
                ? 'text-danger bg-danger/10 border-danger/20'
                : cf.level === 'MEDIUM'
                ? 'text-warning bg-warning/10 border-warning/20'
                : 'text-success bg-success/10 border-success/20';
              return (
                <div
                  key={cf.file}
                  onClick={() => onSelectFilePath(cf.file)}
                  className="flex flex-col p-2 bg-bg-primary/40 hover:bg-bg-primary/80 border border-card-border/40 rounded-lg cursor-pointer transition-all gap-1"
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[11px] font-mono text-text-primary truncate pr-2" title={cf.file}>
                      {getRelativePath(cf.file, targetPath)}
                    </span>
                    <span className={`text-[9px] border px-1.5 py-0.5 rounded font-semibold shrink-0 ${badgeColor}`}>
                      CCN: {cf.complexity}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] text-text-tertiary font-mono">
                    <span>LOC: {cf.loc}</span>
                    <span>Cognitive: {cf.cognitive}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Top Risky Symbols (Blast radius) */}
      <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col col-span-1">
        <h4 className="text-xs font-bold text-text-secondary mb-3 uppercase tracking-wider">Top Risky Symbols</h4>
        <div className="space-y-3 flex-1">
          {topSymbols.length === 0 ? (
            <div className="text-xs text-text-tertiary py-4 text-center">No risky symbols identified</div>
          ) : (
            topSymbols.map((sym) => {
              const affectedDetails = sym.blastRadius.length > 0
                ? `Blast: ${sym.blastRadius.slice(0, 2).map((br: BlastRadiusItem) => br.name).join(', ')}${sym.blastRadius.length > 2 ? '...' : ''}`
                : 'No affected symbols';
              return (
                <div
                  key={`${sym.name}@${sym.file}`}
                  className="flex flex-col p-2.5 rounded-lg bg-bg-primary/40 border border-card-border/40 text-xs text-text-secondary gap-1"
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono font-bold text-text-primary text-[11px] truncate pr-2">{sym.name}</span>
                    <span className="text-[9px] bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-accent font-semibold shrink-0">
                      {sym.blastCount} affected
                    </span>
                  </div>
                  <div className="text-[10px] text-text-tertiary font-mono truncate">{getRelativePath(sym.file, targetPath)}</div>
                  <div className="text-[10px] text-text-secondary truncate">{affectedDetails}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};