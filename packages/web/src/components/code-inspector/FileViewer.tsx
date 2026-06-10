import React, { type RefObject } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Finding, AiResolution } from '../../types';

// ─── Language Detection ──────────────────────────────────────────────────────

const getPrismLanguage = (filePath: string | null | undefined): string => {
  if (!filePath) return 'text';
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'py': return 'python';
    case 'js':
    case 'mjs':
    case 'cjs': return 'javascript';
    case 'jsx': return 'jsx';
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'sh':
    case 'bash': return 'bash';
    case 'css': return 'css';
    case 'scss':
    case 'sass': return 'scss';
    case 'less': return 'less';
    case 'html':
    case 'htm':
    case 'xml': return 'markup';
    case 'json': return 'json';
    case 'md':
    case 'markdown': return 'markdown';
    case 'yml':
    case 'yaml': return 'yaml';
    case 'java': return 'java';
    case 'c': return 'c';
    case 'h': return 'c';
    case 'cpp':
    case 'cxx':
    case 'cc': return 'cpp';
    case 'hpp': return 'cpp';
    case 'cs': return 'csharp';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'rb': return 'ruby';
    case 'php': return 'php';
    case 'sql': return 'sql';
    case 'kt':
    case 'kts': return 'kotlin';
    case 'swift': return 'swift';
    case 'vue': return 'markup';
    default: return 'text';
  }
};

// ─── Custom Theme ────────────────────────────────────────────────────────────

const customSyntaxTheme: Record<string, React.CSSProperties> = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...(vscDarkPlus['pre[class*="language-"]'] as Record<string, React.CSSProperties>),
    background: 'transparent',
    margin: 0,
    padding: 0,
    fontSize: '13px',
    lineHeight: '1.5',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  },
  'code[class*="language-"]': {
    ...(vscDarkPlus['code[class*="language-"]'] as Record<string, React.CSSProperties>),
    background: 'transparent',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    display: 'block',
  },
};

// ─── Gutter Line Renderer ────────────────────────────────────────────────────

const renderGutterLine = (
  lineNum: number,
  fileFindings: Finding[],
  onSelectFindingIndex?: (index: number | null) => void,
  allFindings: Finding[] = [],
  isTarget?: boolean
) => {
  const findingsOnLine = fileFindings.filter((f: Finding) => f.line === lineNum);
  const hasFinding = findingsOnLine.length > 0;
  let lineSeverity: 'error' | 'warning' | 'info' = 'info';
  if (hasFinding) {
    const severities = findingsOnLine.map((f: Finding) => (f.severity || '').toLowerCase());
    if (severities.includes('error')) lineSeverity = 'error';
    else if (severities.includes('warning')) lineSeverity = 'warning';
  }
  return (
    <div
      className={`gutter-cell flex items-start pr-10 font-semibold text-text-secondary/80 hover:text-text-tertiary text-[13px] leading-[1.5] transition-colors${isTarget ? ' gutter-cell--target' : ''}`}
      style={{ minWidth: '3.5em', minHeight: '1.5em', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
    >
      <div className="flex-shrink-0 w-3.5 mr-1 flex items-start justify-center">
        {isTarget ? (
          <span className="font-bold text-[13px] text-danger">−</span>
        ) : hasFinding ? (
          <button
            onClick={() => {
              if (onSelectFindingIndex && findingsOnLine[0]) {
                const originalIndex = allFindings.indexOf(findingsOnLine[0]);
                if (originalIndex !== -1) {
                  onSelectFindingIndex(originalIndex);
                }
              }
            }}
            title={`Line ${lineNum}: ${findingsOnLine.map((f) => f.rule_id).join(', ')}`}
            className={`h-3.5 w-3.5 rounded-full flex items-center justify-center text-[8.5px] font-extrabold cursor-pointer border ${
              lineSeverity === 'error'
                ? 'bg-danger/20 border-danger/60 text-danger hover:bg-danger/40'
                : lineSeverity === 'warning'
                ? 'bg-warning/20 border-warning/60 text-warning hover:bg-warning/40'
                : 'bg-info/20 border-info/60 text-info hover:bg-info/40'
            }`}
          >
            •
          </button>
        ) : null}
      </div>
      <span className="font-medium tabular-nums">{lineNum}</span>
    </div>
  );
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface FileViewerProps {
  finding: Finding;
  fileContent: string;
  isLoading: boolean;
  error: string | null;
  resolution: AiResolution | undefined;
  fileFindings: Finding[];
  allFindings: Finding[];
  onSelectFindingIndex?: (index: number | null) => void;
  activeLineRef?: RefObject<HTMLDivElement | null>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FileViewer: React.FC<FileViewerProps> = ({
  finding,
  fileContent,
  isLoading,
  error,
  resolution,
  fileFindings,
  allFindings,
  onSelectFindingIndex,
  activeLineRef,
}) => {
  return (
    <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3 flex flex-col">
      <div className="flex items-center justify-between border-b border-card-border/40 pb-2">
        <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">
          Full Code View
        </span>
      </div>

      <div
        className="overflow-auto font-mono leading-[1.5] max-h-[500px] min-h-[250px] scrollbar-thin select-text bg-bg-primary border border-card-border/40 rounded-xl shadow-inner"
      >
        {isLoading ? (
          <div className="text-center py-8 text-text-tertiary italic">Loading file content...</div>
        ) : error ? (
          <div className="text-center py-8 text-danger italic">{error}</div>
        ) : fileContent ? (
          (() => {
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

            const prismLanguage = getPrismLanguage(finding.file);
            const isEmptyRemediation = resolution?.remediation_code !== undefined &&
              (!resolution.remediation_code || resolution.remediation_code.trim() === '');
            const isFalsePositive = isEmptyRemediation &&
              resolution?.suggestion?.toLowerCase().startsWith('false positive');
            const isDeletion = isEmptyRemediation && !isFalsePositive;

            const showRemediation = resolution?.remediation_code !== undefined;
            const preLines = allFileLines.slice(0, finding.line - 1);
            const targetLine = allFileLines[finding.line - 1] || '';
            const postLines = allFileLines.slice(finding.line);

            const renderChunk = (lines: string[], offsetLineNum: number) => {
              const text = lines.join('\n');
              if (!text) return null;
              let lineIdx = 0;
              return (
                <SyntaxHighlighter
                  key={`chunk-${offsetLineNum}`}
                  language={prismLanguage}
                  style={customSyntaxTheme}
                  showLineNumbers={false}
                  wrapLines={true}
                  lineProps={() => {
                    const actualLine = offsetLineNum + lineIdx;
                    lineIdx++;
                    const isChunkTarget = actualLine === finding.line;
                    return {
                      id: `line-${actualLine}`,
                      className: isChunkTarget ? 'code-line code-line--target' : '',
                      style: {
                        display: 'block',
                        minHeight: '1.5em',
                        padding: '0 12px 0 0',
                      },
                    };
                  }}
                >
                  {text}
                </SyntaxHighlighter>
              );
            };

            return (
              <div className="flex flex-col py-3">
                {/* Pre-target lines */}
                <div className="flex">
                  <div className="gutter-col shrink-0">
                    {preLines.map((_, idx) => {
                      const lineNum = idx + 1;
                      return renderGutterLine(lineNum, fileFindings, onSelectFindingIndex, allFindings);
                    })}
                  </div>
                  <div className="code-col flex-1 min-w-0">
                    {renderChunk(preLines, 1)}
                  </div>
                </div>

                {/* Target line + remediation */}
                <div className="flex" ref={finding.line === 1 ? undefined : activeLineRef}>
                  <div className="gutter-col shrink-0">
                    {renderGutterLine(finding.line, fileFindings, onSelectFindingIndex, allFindings, true)}
                  </div>
                  <div className="code-col flex-1 min-w-0">
                    {renderChunk([targetLine], finding.line)}
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
                        return renderGutterLine(lineNum, fileFindings, onSelectFindingIndex, allFindings, lineNum === finding.line);
                      })}
                    </div>
                    <div className="code-col flex-1 min-w-0">
                      {renderChunk(postLines, finding.line + 1)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="text-center py-8 text-text-tertiary italic">No file content available.</div>
        )}
      </div>
    </div>
  );
};