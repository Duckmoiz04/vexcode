import React, { useState, type RefObject } from 'react';
import type { Finding, AiResolution } from '../../types';
import { DiffViewInline } from './DiffViewInline.tsx';
import { DiffViewSplit } from './DiffViewSplit.tsx';
import { ThemePicker } from './ThemePicker.tsx';
import { defaultTheme, type ThemeDefinition } from '../../utils/themes.ts';
import { GitCompareArrows, Columns } from 'lucide-react';

// ─── Remediation Applier ─────────────────────────────────────────────────────

const applyRemediation = (
  fileContent: string,
  finding: Finding,
  resolution: AiResolution,
): string | null => {
  const code = resolution.remediation_code;
  if (code === undefined || code === null) return null;

  const allFileLines = fileContent.split(/\r?\n/);
  const targetLine = allFileLines[finding.line - 1] || '';
  const targetIndent = (targetLine.match(/^(\s*)/) || ['', ''])[0];

  const remediationLines = code
    .split(/\r?\n/)
    .map((line: string) => {
      if (line.length === 0) return line;
      if (targetIndent && !line.startsWith(targetIndent)) {
        return targetIndent + line;
      }
      return line;
    });

  const before = allFileLines.slice(0, finding.line - 1);
  const after = allFileLines.slice(finding.line);

  return [...before, ...remediationLines, ...after].join('\n');
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface FileViewerProps {
  finding: Finding;
  fileContent: string;
  isLoading: boolean;
  error: string | null;
  resolution: AiResolution | undefined;
  activeLineRef?: RefObject<HTMLDivElement | null>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FileViewer: React.FC<FileViewerProps> = ({
  finding,
  fileContent,
  isLoading,
  error,
  resolution,
  activeLineRef,
}) => {
  const [diffSubMode, setDiffSubMode] = useState<'inline' | 'split'>('inline');
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(defaultTheme);

  const hasRemediation = resolution?.remediation_code !== undefined;
  const isEmptyRemediation = hasRemediation &&
    (!resolution!.remediation_code || resolution!.remediation_code.trim() === '');
  const isFalsePositive = isEmptyRemediation &&
    resolution?.suggestion?.toLowerCase().startsWith('false positive');
  const canShowDiff = hasRemediation && !isFalsePositive;

  const buttonBase =
    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all border';

  const diffSubBtnClass = (subMode: 'inline' | 'split') =>
    diffSubMode === subMode
      ? `${buttonBase} bg-accent/20 text-accent border-accent/40`
      : `${buttonBase} bg-bg-tertiary/50 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border-card-border/30`;

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-lg border border-card-border bg-card-bg backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-card-border/40">
        <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">
          {diffSubMode === 'inline' ? 'Inline Diff' : 'Split Diff'}
        </span>
        <div className="flex items-center gap-3">
          <ThemePicker current={currentTheme} onChange={setCurrentTheme} />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDiffSubMode('inline')}
              className={diffSubBtnClass('inline')}
              title="Inline diff view"
            >
              <GitCompareArrows size={13} /> Inline
            </button>
            <button
              onClick={() => setDiffSubMode('split')}
              className={diffSubBtnClass('split')}
              title="Split diff view"
            >
              <Columns size={13} /> Split
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-auto font-mono leading-[1.5] scrollbar-thin select-text bg-[#0a0a0f] border-t border-card-border/40"
      >
        {(() => {
          const modified = canShowDiff
            ? applyRemediation(fileContent, finding, resolution!)
            : null;
          if (modified === null) {
            return (
              <div className="text-center py-8 text-text-tertiary italic">No diff available.</div>
            );
          }
          return diffSubMode === 'inline' ? (
            <DiffViewInline
              original={fileContent}
              modified={modified}
              filePath={finding.file}
              themeExtension={currentTheme.extension}
              targetLine={finding.line}
            />
          ) : (
            <DiffViewSplit
              original={fileContent}
              modified={modified}
              filePath={finding.file}
              themeExtension={currentTheme.extension}
              targetLine={finding.line}
            />
          );
        })()}
      </div>
    </div>
  );
};