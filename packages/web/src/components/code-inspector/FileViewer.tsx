import React, { useState, type RefObject } from 'react';
import type { Finding, AiResolution } from '../../types';
import { CodeHighlight } from '../../utils/syntaxHighlight.tsx';
import { CodeMirrorEditor } from './CodeMirrorEditor.tsx';
import { DiffView } from './DiffView.tsx';
import { ThemePicker } from './ThemePicker.tsx';
import { defaultTheme, type ThemeDefinition } from '../../utils/themes.ts';
import { Pencil, Eye, GitCompareArrows } from 'lucide-react';

// ─── Gutter Line Renderer ────────────────────────────────────────────────────

const renderGutterLine = (lineNum: number, isTarget?: boolean) => {
  return (
    <div
      className={`gutter-cell flex items-start pr-10 font-semibold text-text-secondary/80 hover:text-text-tertiary text-[13px] leading-[1.5] transition-colors${isTarget ? ' gutter-cell--target' : ''}`}
      style={{ minWidth: '3.5em', minHeight: '1.5em', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
    >
      {isTarget && (
        <span className="font-bold text-[13px] text-danger w-3.5 mr-1 shrink-0">−</span>
      )}
      <span className="font-medium tabular-nums">{lineNum}</span>
    </div>
  );
};

// ─── Chunk Renderer ──────────────────────────────────────────────────────────

const renderChunk = (
  lines: string[],
  offsetLineNum: number,
  findingLine: number,
  filePath: string | null | undefined,
) => {
  const text = lines.join('\n');
  if (!text) return null;

  return (
    <div className="code-chunk" key={`chunk-${offsetLineNum}`}>
      {lines.map((line, idx) => {
        const actualLine = offsetLineNum + idx;
        const isTarget = actualLine === findingLine;
        return (
          <div
            key={`l-${actualLine}`}
            id={`line-${actualLine}`}
            className={`flex code-line${isTarget ? ' code-line--target' : ''}`}
          >
            <CodeHighlight code={line} filePath={filePath} />
          </div>
        );
      })}
    </div>
  );
};

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
  const [mode, setMode] = useState<'view' | 'diff' | 'edit'>('view');
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(defaultTheme);

  const hasRemediation = resolution?.remediation_code !== undefined;
  const isEmptyRemediation = hasRemediation &&
    (!resolution!.remediation_code || resolution!.remediation_code.trim() === '');
  const isFalsePositive = isEmptyRemediation &&
    resolution?.suggestion?.toLowerCase().startsWith('false positive');
  const canShowDiff = hasRemediation && !isFalsePositive;

  const buttonBase =
    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all border';

  const btnClass = (btnMode: 'view' | 'diff' | 'edit') =>
    mode === btnMode
      ? `${buttonBase} bg-accent/20 text-accent border-accent/40`
      : `${buttonBase} bg-bg-tertiary/50 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border-card-border/30`;

  return (
    <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3 flex flex-col">
      <div className="flex items-center justify-between border-b border-card-border/40 pb-2">
        <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">
          {mode === 'edit' ? 'Edit Mode' : mode === 'diff' ? 'Diff View' : 'Full Code View'}
        </span>
        <div className="flex items-center gap-3">
          <ThemePicker current={currentTheme} onChange={setCurrentTheme} />
          <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('view')}
            className={btnClass('view')}
            title="View code"
          >
            <Eye size={13} /> View
          </button>
          {canShowDiff && (
            <button
              onClick={() => setMode('diff')}
              className={btnClass('diff')}
              title="Diff between original and remediated"
            >
              <GitCompareArrows size={13} /> Diff
            </button>
          )}
          <button
            onClick={() => setMode('edit')}
            className={btnClass('edit')}
            title="Edit code"
          >
            <Pencil size={13} /> Edit
          </button>
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
          return modified !== null ? (
            <DiffView
              original={fileContent}
              modified={modified}
              filePath={finding.file}
              themeExtension={currentTheme.extension}
            />
          ) : (
            <div className="text-center py-8 text-text-tertiary italic">No diff available.</div>
          );
        })() : isLoading ? (
          <div className="text-center py-8 text-text-tertiary italic">Loading file content...</div>
        ) : error ? (
          <div className="text-center py-8 text-danger italic">{error}</div>
        ) : !fileContent ? (
          <div className="text-center py-8 text-text-tertiary italic">No file content available.</div>
        ) : mode === 'edit' ? (
          <CodeMirrorEditor content={fileContent} filePath={finding.file} goToLine={finding.line} themeExtension={currentTheme.extension} />
        ) : (() => {
            const allFileLines = fileContent.split(/\r?\n/);
            const targetLineContent = allFileLines[finding.line - 1] || '';
            const targetIndent = (targetLineContent.match(/^(\s*)/) || ['', ''])[0];

            const remediationLines = resolution?.remediation_code
              ? resolution.remediation_code.split(/\r?\n/)
              : [];
            const adjustedRemediationLines = remediationLines.map((line: string) => {
              if (line.length === 0) return line;
              if (targetIndent && !line.startsWith(targetIndent)) {
                return targetIndent + line;
              }
              return line;
            });

            const isEmptyRemediation = resolution?.remediation_code !== undefined &&
              (!resolution.remediation_code || resolution.remediation_code.trim() === '');
            const isFalsePositive = isEmptyRemediation &&
              resolution?.suggestion?.toLowerCase().startsWith('false positive');
            const isDeletion = isEmptyRemediation && !isFalsePositive;

            const showRemediation = resolution?.remediation_code !== undefined;
            const preLines = allFileLines.slice(0, finding.line - 1);
            const targetLine = allFileLines[finding.line - 1] || '';
            const postLines = allFileLines.slice(finding.line);

            return (
              <div className="flex flex-col py-3">
                {/* Pre-target lines */}
                <div className="flex">
                  <div className="gutter-col shrink-0">
                    {preLines.map((_, idx) => {
                      const lineNum = idx + 1;
                      return renderGutterLine(lineNum);
                    })}
                  </div>
                  <div className="code-col flex-1 min-w-0 text-[13px]">
                    {renderChunk(preLines, 1, finding.line, finding.file)}
                  </div>
                </div>

                {/* Target line + remediation */}
                <div className="flex" ref={finding.line === 1 ? undefined : activeLineRef}>
                  <div className="gutter-col shrink-0">
                    {renderGutterLine(finding.line, true)}
                  </div>
                  <div className="code-col flex-1 min-w-0 text-[13px]">
                    {renderChunk([targetLine], finding.line, finding.line, finding.file)}
                  </div>
                </div>

                {/* Remediation block, if any */}
                {showRemediation && !isDeletion && !isFalsePositive && (
                  <div className="remediation-row">
                    {adjustedRemediationLines.map((remLine: string, remIdx: number) => (
                      <div
                        key={`rem-${remIdx}`}
                        className="flex remediation-line"
                      >
                        <div className="gutter-col shrink-0">
                          <div className="flex items-start pr-10 font-semibold text-text-secondary/80 text-[13px] leading-[1.5] tabular-nums" style={{ minWidth: '3.5em', minHeight: '1.5em', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
                            <div className="flex-shrink-0 w-3.5 mr-1" />
                            <span className={`font-medium ${remIdx !== 0 ? 'invisible' : ''}`}>{finding.line}</span>
                            <span className={`font-normal text-[13px] ml-2 text-success ${remIdx !== 0 ? 'invisible' : ''}`}>+</span>
                          </div>
                        </div>
                        <div className="code-col flex-1 min-w-0 remediation-text whitespace-pre text-text-primary pl-1 pr-3 text-[13px] leading-[1.5]">
                          {remLine || ' '}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showRemediation && isFalsePositive && (
                  <div className="remediation-row">
                    <div className="flex remediation-line">
                      <div className="gutter-col shrink-0">
                        <div className="flex items-start pr-10 font-semibold text-text-secondary/80 text-[13px] leading-[1.5] tabular-nums" style={{ minWidth: '3.5em', minHeight: '1.5em', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
                          <div className="flex-shrink-0 w-3.5 mr-1" />
                          <span className="font-medium">{finding.line}</span>
                          <span className="font-normal text-[13px] ml-2 text-accent">✓</span>
                        </div>
                      </div>
                      <div className="code-col flex-1 min-w-0 remediation-text text-[13px] leading-[1.5] pl-1 pr-3 text-text-secondary">
                        {resolution?.suggestion || 'False positive'}
                      </div>
                    </div>
                  </div>
                )}

                {showRemediation && isDeletion && (
                  <div className="remediation-row">
                    <div className="flex remediation-line">
                      <div className="gutter-col shrink-0">
                        <div className="flex items-start pr-10 font-semibold text-text-secondary/80 text-[13px] leading-[1.5] tabular-nums" style={{ minWidth: '3.5em', minHeight: '1.5em', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
                          <div className="flex-shrink-0 w-3.5 mr-1" />
                          <span className="font-medium">{finding.line}</span>
                          <span className="font-normal text-[13px] ml-2">−</span>
                        </div>
                      </div>
                      <div className="code-col flex-1 min-w-0 remediation-text select-none italic line-through decoration-text-tertiary/60 text-[13px] leading-[1.5] pl-1 pr-3">
                        ── line removed ──
                      </div>
                    </div>
                  </div>
                )}

                {/* Post-target lines */}
                {postLines.length > 0 && (
                  <div className="flex">
                    <div className="gutter-col shrink-0">
                      {postLines.map((_, idx) => {
                        const lineNum = finding.line + 1 + idx;
                        return renderGutterLine(lineNum);
                      })}
                    </div>
                    <div className="code-col flex-1 min-w-0 text-[13px]">
                      {renderChunk(postLines, finding.line + 1, finding.line, finding.file)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        }
      </div>
    </div>
  );
};
