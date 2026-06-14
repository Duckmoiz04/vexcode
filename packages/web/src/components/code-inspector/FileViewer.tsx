import React, { useState, type RefObject } from 'react';
import type { Finding, AiResolution } from '../../types';
import { CodeMirrorEditor } from './CodeMirrorEditor.tsx';
import { DiffViewInline } from './DiffViewInline.tsx';
import { DiffViewSplit } from './DiffViewSplit.tsx';
import { ThemePicker } from './ThemePicker.tsx';
import { defaultTheme, type ThemeDefinition } from '../../utils/themes.ts';
import { Pencil, GitCompareArrows, Columns } from 'lucide-react';

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
  const [mode, setMode] = useState<'edit' | 'diff'>('diff');
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

  const btnClass = (btnMode: 'edit' | 'diff') =>
    mode === btnMode
      ? `${buttonBase} bg-accent/20 text-accent border-accent/40`
      : `${buttonBase} bg-bg-tertiary/50 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border-card-border/30`;

  const diffSubBtnClass = (subMode: 'inline' | 'split') =>
    diffSubMode === subMode
      ? `${buttonBase} bg-accent/20 text-accent border-accent/40`
      : `${buttonBase} bg-bg-tertiary/50 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border-card-border/30`;

  return (
    <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3 flex flex-col">
      <div className="flex items-center justify-between border-b border-card-border/40 pb-2">
        <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">
          {mode === 'edit' ? 'Edit Mode' : diffSubMode === 'inline' ? 'Inline Diff' : 'Split Diff'}
        </span>
        <div className="flex items-center gap-3">
          <ThemePicker current={currentTheme} onChange={setCurrentTheme} />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode(mode === 'edit' ? 'diff' : 'edit')}
              className={btnClass('edit')}
              title={mode === 'edit' ? 'Switch to diff view' : 'Switch to edit mode'}
            >
              <Pencil size={13} /> Edit
            </button>
            {mode === 'diff' && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="overflow-auto font-mono leading-[1.5] max-h-[500px] min-h-[250px] scrollbar-thin select-text bg-bg-primary border border-card-border/40 rounded-xl shadow-inner"
      >
        {mode === 'diff' ? (() => {
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
            />
          ) : (
            <DiffViewSplit
              original={fileContent}
              modified={modified}
              filePath={finding.file}
              themeExtension={currentTheme.extension}
            />
          );
        })() : isLoading ? (
          <div className="text-center py-8 text-text-tertiary italic">Loading file content...</div>
        ) : error ? (
          <div className="text-center py-8 text-danger italic">{error}</div>
        ) : !fileContent ? (
          <div className="text-center py-8 text-text-tertiary italic">No file content available.</div>
        ) : (
          <CodeMirrorEditor content={fileContent} filePath={finding.file} goToLine={finding.line} themeExtension={currentTheme.extension} />
        )}
      </div>
    </div>
  );
};