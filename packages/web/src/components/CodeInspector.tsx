import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { HelpCircle, Check, Send, X, ExternalLink } from 'lucide-react';
import type { Finding, Metrics, CallerInfo, BlastRadiusItem, AiResolution } from '../types';

// Map file extension to Prism language identifier
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

// Custom dark theme that matches the app's palette
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

// Render a single gutter cell (line number + finding button).
// Defined at module scope so all gutter rows share the same shape.
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


interface CodeInspectorProps {
  finding: Finding;
  aiResolutions: Record<string, AiResolution>;
  targetPath: string | null;
  selectedProvider: string;
  apiKey: string;
  apiBaseUrl: string;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  onApplyFix: (finding: Finding, remediationCode: string) => Promise<boolean>;
  metrics?: Metrics;
  allFindings?: Finding[];
  onSelectFindingIndex?: (index: number | null) => void;
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  finding,
  aiResolutions,
  targetPath,
  selectedProvider,
  apiKey,
  apiBaseUrl,
  aiModel,
  aiTemperature,
  aiMaxTokens,
  onApplyFix,
  metrics,
  allFindings = [],
  onSelectFindingIndex,
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // New state & refs for Full File Viewer & Auto-scrolling
  const [isChatOpen, setIsChatOpen] = useState(false);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const resolution = aiResolutions?.[finding.rule_id];

  const fileFindings = allFindings.filter(
    (f: Finding) => f.file.replace(/\\/g, '/') === finding.file.replace(/\\/g, '/')
  );

  // Helper to strip path prefix
  const getRelativePath = (absolutePath: string) => {
    if (!absolutePath) return '';
    if (!targetPath) return absolutePath;
    const abs = absolutePath.replace(/\\/g, '/');
    const target = targetPath.replace(/\\/g, '/');
    if (abs.startsWith(target)) {
      let rel = abs.slice(target.length);
      if (rel.startsWith('/')) rel = rel.slice(1);
      return rel || '.';
    }
    return abs;
  };

  // Fetch File Content
  useEffect(() => {
    const fetchFile = async () => {
      try {
        const response = await fetch(`/api/file-content?path=${encodeURIComponent(finding.file)}`);
        const data = await response.json();
        if (data.success) {
          setFileContent(data.content);
        } else {
          setFileContent('');
        }
      } catch (err) {
        console.error(err);
        setFileContent('');
      }
    };

    fetchFile();
    setChatMessages([]); // Reset chat for new finding
  }, [finding, resolution]);

  // Auto-scroll to active finding line
  useEffect(() => {
    if (fileContent) {
      const timer = setTimeout(() => {
        if (activeLineRef.current) {
          activeLineRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [finding, fileContent]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Build context for AI chat
  const buildFindingContext = () => {
    let context = `Vulnerability Details:\n`;
    context += `- Rule ID: ${finding.rule_id}\n`;
    context += `- Severity: ${finding.severity}\n`;
    context += `- File: ${finding.file}\n`;
    context += `- Line: ${finding.line}\n`;
    context += `- Message: ${finding.message}\n`;

    if (finding.ast_context) {
      const ast = finding.ast_context;
      context += `\nAST Context:\n`;
      context += `- Symbol: ${ast.symbol_name} (${ast.kind})\n`;
      if (ast.source_code) {
        context += `- Source Code:\n\`\`\`\n${ast.source_code}\`\`\`\n`;
      }
      if (ast.callers && ast.callers.length > 0) {
        context += `- Callers: ${ast.callers.map((c: CallerInfo) => `${c.name} in ${c.filePath}`).join(', ')}\n`;
      }
      if (ast.blast_radius && ast.blast_radius.length > 0) {
        context += `- Blast Radius: ${ast.blast_radius.length} affected symbol(s)\n`;
        ast.blast_radius.forEach((br: BlastRadiusItem) => {
          context += `  - ${br.name} (${br.relation} in ${br.filePath}, depth ${br.depth})\n`;
        });
      }
    }

    if (resolution) {
      context += `\nAI Suggestion: ${resolution.suggestion}\n`;
      if (resolution.remediation_code) {
        context += `Remediation Code:\n\`\`\`\n${resolution.remediation_code}\`\`\`\n`;
      }
    }

    return context;
  };

  // Send message
  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message || isChatLoading) return;

    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
    setIsChatLoading(true);

    const findingContext = buildFindingContext();
    const systemMessage = {
      role: 'system',
      content: `You are an expert security engineer helping analyze vulnerabilities. You have context about the current vulnerability being reviewed:\n\n${findingContext}\n\nProvide helpful, detailed answers about this vulnerability. Explain why it's dangerous, how it affects the codebase, and best practices for fixing it. Be concise but thorough.`,
    };

    const messagesToSend = [
      systemMessage,
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToSend,
          provider: selectedProvider,
          apiKey,
          baseUrl: apiBaseUrl,
          model: aiModel,
          temperature: aiTemperature,
          maxTokens: aiMaxTokens,
        }),
      });

      const data = await response.json();
      if (data.success && data.response) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        const reason = data.error || 'Sorry, I encountered an error. Please check your AI settings and try again.';
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: reason },
        ]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch AI response';
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${message}` },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleApply = async () => {
    if (!resolution?.remediation_code) return;
    setIsApplying(true);
    const success = await onApplyFix(finding, resolution.remediation_code);
    setIsApplying(false);
  };

  const handleOpenInIDE = async () => {
    try {
      const response = await fetch('/api/open-in-ide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: finding.file,
          line: finding.line,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Failed to open in IDE:', data.error);
        alert(data.error || 'Failed to open in IDE');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error opening in IDE:', err);
      alert(`Error opening in IDE: ${message}`);
    }
  };


  const severity = (finding.severity || '').toLowerCase();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-secondary relative">
      {/* Detail Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-bg-secondary shrink-0 z-10">
        <div className="flex items-center gap-3">
          {onSelectFindingIndex && (
            <button
              onClick={() => onSelectFindingIndex(null)}
              className="mr-1 flex items-center justify-center p-1.5 rounded-lg border border-card-border bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all cursor-pointer shadow-sm"
              title="Back to all findings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md font-bold text-sm ${
              severity === 'error'
                ? 'bg-error/15 text-error border border-error/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                : severity === 'warning'
                ? 'bg-warning/15 text-warning border border-warning/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                : 'bg-info/15 text-info border border-info/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
            }`}
          >
            {severity === 'error' ? '!' : severity === 'warning' ? '?' : 'i'}
          </span>
          <h3 className="text-sm font-bold text-text-primary font-mono truncate max-w-md lg:max-w-xl">{finding.rule_id}</h3>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenInIDE}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-card-border/60 bg-bg-tertiary/40 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60 text-xs font-semibold transition-all cursor-pointer"
            title="Open file in IDE (VS Code / Cursor)"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open in IDE</span>
          </button>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              isChatOpen
                ? 'bg-accent/20 border-accent text-accent shadow-sm'
                : 'bg-bg-tertiary/40 border-card-border/60 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>{isChatOpen ? 'Close AI Chat' : 'Ask AI Assistant'}</span>
          </button>
          <span
            className={`text-xs px-2.5 py-0.5 rounded font-semibold border ${
              finding._applied
                ? 'bg-success/15 border-success/30 text-success'
                : 'bg-bg-tertiary border-card-border text-text-secondary'
            }`}
          >
            {finding._applied ? 'Applied' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Main Body: Content on left, collapsible Chat Drawer on right */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Column: Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin min-w-0">
          {/* File Metadata */}
          <div className="flex flex-wrap gap-6 p-3 rounded-lg border border-card-border bg-card-bg backdrop-blur-md text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">File</span>
              <span className="font-mono text-text-primary break-all">{getRelativePath(finding.file)}</span>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Line</span>
              <span className="font-mono text-text-primary">{finding.line}</span>
            </div>
            {metrics?.files?.[getRelativePath(finding.file)] && (() => {
              const fileMetric = metrics.files[getRelativePath(finding.file)];
              return (
                <>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Complexity (CCN)</span>
                    <span className={`font-mono font-semibold ${
                      fileMetric.level === 'HIGH' ? 'text-danger' : fileMetric.level === 'MEDIUM' ? 'text-warning' : 'text-success'
                    }`}>
                      {fileMetric.complexity} ({fileMetric.level})
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Cognitive</span>
                    <span className="font-mono text-text-primary">{fileMetric.cognitive_complexity || 0}</span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">LOC</span>
                    <span className="font-mono text-text-primary">{fileMetric.loc || 0}</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Finding Message */}
          <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md text-xs leading-relaxed text-text-secondary">
            {finding.message}
          </div>

          {/* AST Context */}
          {finding.ast_context && (
            <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3">
              <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1.5">
                AST Context
              </h4>
              <div className="flex gap-6 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-text-tertiary uppercase">Symbol</span>
                  <span className="font-mono text-text-primary font-semibold">{finding.ast_context.symbol_name || '-'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-text-tertiary uppercase">Kind</span>
                  <span className="font-mono text-text-primary">{finding.ast_context.kind || '-'}</span>
                </div>
              </div>

              {/* Callers */}
              {finding.ast_context.callers && finding.ast_context.callers.length > 0 && (
                <div className="text-xs">
                  <span className="text-[9px] text-text-tertiary uppercase block mb-1">Callers</span>
                  <div className="flex flex-wrap gap-1.5">
                    {finding.ast_context.callers.map((c: CallerInfo, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-bg-primary/50 text-[10px] font-mono text-text-secondary border border-card-border/40">
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Blast Radius */}
              {finding.ast_context.blast_radius && finding.ast_context.blast_radius.length > 0 && (
                <div className="text-xs flex items-center gap-2">
                  <span className="text-[9px] text-text-tertiary uppercase">Blast Radius</span>
                  <span className="font-semibold text-accent">{finding.ast_context.blast_radius.length} affected symbol(s)</span>
                </div>
              )}
            </div>
          )}

          {/* AI Suggestion */}
          <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-2">
            <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1.5">
              AI Suggestion
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              {resolution?.suggestion || 'No AI suggestion available.'}
            </p>
          </div>

          {/* Code Viewer Panel (Full Code with Inline IDE-style Diff + Syntax Highlight) */}
          <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3 flex flex-col">
            <div className="flex items-center justify-between border-b border-card-border/40 pb-2">
              <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">
                Full Code View
              </span>
            </div>

            <div
              ref={codeContainerRef}
              className="overflow-auto font-mono leading-[1.5] max-h-[500px] min-h-[250px] scrollbar-thin select-text bg-bg-primary border border-card-border/40 rounded-xl shadow-inner"
            >
              {fileContent ? (
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

                  // Render remediation as a separate block, only when there is a
                  // resolution. We split the file into pre/target/post chunks so
                  // the remediation block can be inserted directly after the
                  // target line and stay aligned with it.
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
                <div className="text-center py-8 text-text-tertiary italic">Loading file content...</div>
              )}
            </div>
          </div>

          {/* Action Button */}
          {resolution?.remediation_code && !finding._applied && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success-hover text-white text-xs font-semibold rounded-lg shadow-lg hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>{isApplying ? 'Applying Fix...' : 'Apply Fix'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Collapsible AI Chat drawer/sidebar */}
        <div className={`border-l border-card-border bg-[#161622] h-full flex flex-col shadow-2xl transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isChatOpen ? 'w-[380px] opacity-100' : 'w-0 opacity-0 border-l-0'
        }`}>
          {/* Chat Header */}
          <div className="px-4.5 py-3.5 border-b border-card-border/60 flex items-center justify-between bg-bg-tertiary/20 shrink-0">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-accent" />
              <h4 className="text-[10.5px] text-text-primary uppercase font-bold tracking-wider">AI Assistant</h4>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              aria-label="Close AI chat"
              title="Close AI chat"
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-secondary/60 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Message Box */}
          <div className="flex-1 overflow-y-auto p-4.5 space-y-4 scrollbar-thin">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-xs text-text-tertiary py-8 space-y-2 select-none">
                <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-lg shadow-sm">
                  💬
                </div>
                <p className="font-semibold text-text-secondary text-[12px]">Ask AI about this finding</p>
                <span className="max-w-[240px] leading-relaxed text-[10px] text-text-tertiary/80">
                  Ask questions like: "Why is this finding dangerous?", "How can I fix this manually?", or "What is the blast radius of this issue?"
                </span>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col p-3 rounded-xl text-xs max-w-[85%] leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-accent/10 border border-accent/25 text-text-primary self-end ml-auto rounded-tr-none'
                      : 'bg-bg-secondary/90 border border-card-border/60 text-text-primary mr-auto rounded-tl-none'
                  }`}
                >
                  <span className="text-[8.5px] font-extrabold uppercase tracking-wider mb-1 text-text-tertiary select-none">
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </span>
                  <p className="whitespace-pre-wrap font-sans text-text-primary text-[11.5px]">{msg.content}</p>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex items-center gap-2.5 p-3 bg-bg-secondary/90 border border-card-border/60 rounded-xl text-xs text-text-secondary animate-pulse w-max rounded-tl-none mr-auto shadow-sm">
                <span className="h-2 w-2 rounded-full bg-accent animate-bounce" />
                <span>AI is thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <div className="p-3.5 border-t border-card-border/65 bg-bg-primary/25 flex gap-2 shrink-0">
            <label htmlFor="ai-chat-input" className="sr-only">
              Ask AI about {finding.rule_id}
            </label>
            <input
              id="ai-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChat();
              }}
              disabled={isChatLoading}
              placeholder={`Ask about ${finding.rule_id}...`}
              aria-label={`Ask AI about ${finding.rule_id}`}
              className="flex-1 bg-bg-tertiary text-text-primary border border-card-border/80 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-accent disabled:opacity-50 transition-all placeholder:text-text-tertiary/60 shadow-inner"
            />
            <button
              onClick={handleSendChat}
              disabled={isChatLoading || !chatInput.trim()}
              aria-label="Send chat message"
              title="Send chat message"
              className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent cursor-pointer transition-all shadow-md"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

