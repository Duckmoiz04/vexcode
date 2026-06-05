import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Info, HelpCircle, CornerDownLeft, Check, Play, Send, X } from 'lucide-react';


interface CodeInspectorProps {
  finding: any;
  aiResolutions: Record<string, any>;
  targetPath: string | null;
  selectedProvider: string;
  apiKey: string;
  apiBaseUrl: string;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  onApplyFix: (finding: any, remediationCode: string) => Promise<boolean>;
  metrics?: any;
  allFindings?: any[];
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
  const [diffOriginal, setDiffOriginal] = useState<string[]>([]);
  const [diffRemediation, setDiffRemediation] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // New state & refs for Full File Viewer & Auto-scrolling
  const [viewMode, setViewMode] = useState<'full' | 'diff'>('full');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLPreElement>(null);

  const resolution = aiResolutions?.[finding.rule_id];

  const fileFindings = allFindings.filter(
    (f: any) => f.file.replace(/\\/g, '/') === finding.file.replace(/\\/g, '/')
  );

  // Keep viewMode as 'full' if there's no remediation code for the selected finding
  useEffect(() => {
    if (!resolution?.remediation_code) {
      setViewMode('full');
    }
  }, [finding, resolution]);

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

  // Fetch File Content & Compute Diff
  useEffect(() => {
    const fetchFileAndDiff = async () => {
      try {
        const response = await fetch(`/api/file-content?path=${encodeURIComponent(finding.file)}`);
        const data = await response.json();
        if (data.success) {
          setFileContent(data.content);
          
          const lines = data.content.split(/\r?\n/);
          const targetLine = finding.line - 1;
          const contextLines = 5;
          const start = Math.max(0, targetLine - contextLines);
          const end = Math.min(lines.length, targetLine + contextLines + 1);

          // Original lines
          const orig: string[] = [];
          for (let i = start; i < end; i++) {
            orig.push(lines[i] || '');
          }
          setDiffOriginal(orig);

          // Remediation lines
          const rem: string[] = [];
          if (resolution?.remediation_code) {
            const remediationLines = resolution.remediation_code.split(/\r?\n/);
            for (let i = start; i < end; i++) {
              if (i === targetLine) {
                remediationLines.forEach((line: string) => rem.push(line));
              } else {
                rem.push(lines[i] || '');
              }
            }
            setDiffRemediation(rem);
          } else {
            setDiffRemediation([]);
          }
        } else {
          setFileContent('');
          setDiffOriginal([]);
          setDiffRemediation([]);
        }
      } catch (err) {
        console.error(err);
        setFileContent('');
        setDiffOriginal([]);
        setDiffRemediation([]);
      }
    };

    fetchFileAndDiff();
    setChatMessages([]); // Reset chat for new finding
  }, [finding, resolution]);

  // Auto-scroll to active finding line
  useEffect(() => {
    if (viewMode === 'full' && fileContent) {
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
  }, [finding, fileContent, viewMode]);

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
        context += `- Callers: ${ast.callers.map((c: any) => `${c.name} in ${c.filePath}`).join(', ')}\n`;
      }
      if (ast.blast_radius && ast.blast_radius.length > 0) {
        context += `- Blast Radius: ${ast.blast_radius.length} affected symbol(s)\n`;
        ast.blast_radius.forEach((br: any) => {
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
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I encountered an error. Please check your AI settings and try again.' },
        ]);
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message || 'Failed to fetch AI response'}` },
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
                    {finding.ast_context.callers.map((c: any, i: number) => (
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

          {/* Code Viewer Panel (Full Code or Split Diff) */}
          <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3 flex flex-col">
            <div className="flex items-center justify-between border-b border-card-border/40 pb-2">
              <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">
                {viewMode === 'full' ? 'Full Code View' : 'Code Diff View'}
              </span>
              {resolution?.remediation_code && (
                <div className="flex bg-bg-primary/80 border border-card-border/80 rounded-md p-0.5 shadow-inner">
                  <button
                    onClick={() => setViewMode('full')}
                    className={`px-2.5 py-1 text-[9px] font-bold rounded-sm transition-all cursor-pointer ${
                      viewMode === 'full'
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Full Code View
                  </button>
                  <button
                    onClick={() => setViewMode('diff')}
                    className={`px-2.5 py-1 text-[9px] font-bold rounded-sm transition-all cursor-pointer ${
                      viewMode === 'diff'
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Remediation Diff
                  </button>
                </div>
              )}
            </div>

            {viewMode === 'full' ? (
              <pre
                ref={codeContainerRef}
                className="p-3 overflow-auto text-[10.5px] font-mono leading-relaxed max-h-[500px] min-h-[250px] scrollbar-thin select-text bg-black/95 border border-card-border/40 rounded-xl relative flex flex-col shadow-inner"
              >
                {fileContent ? (
                  fileContent.split(/\r?\n/).map((line, idx) => {
                    const lineNum = idx + 1;
                    const isTarget = lineNum === finding.line;
                    
                    // Filter findings on this line
                    const findingsOnLine = fileFindings.filter((f: any) => f.line === lineNum);
                    const hasFinding = findingsOnLine.length > 0;
                    const isOtherFinding = hasFinding && !isTarget;
                    
                    // Determine severity for class names and indicator colors
                    let lineSeverity = 'info';
                    if (hasFinding) {
                      const severities = findingsOnLine.map((f: any) => (f.severity || '').toLowerCase());
                      if (severities.includes('error')) lineSeverity = 'error';
                      else if (severities.includes('warning')) lineSeverity = 'warning';
                    }

                    return (
                      <div key={idx} className="w-full flex flex-col">
                        <div
                          ref={isTarget ? activeLineRef : undefined}
                          className={`group flex items-start w-full py-1 px-2 -mx-2 transition-colors ${
                            isTarget
                              ? 'bg-danger/15 border-l-3 border-danger font-semibold text-text-primary'
                              : isOtherFinding
                              ? 'bg-warning/5 border-l-3 border-warning/30 hover:bg-warning/10 text-text-secondary'
                              : 'hover:bg-bg-tertiary/20 text-text-secondary/80'
                          }`}
                        >
                          {/* Line Number / Indicator Gutter */}
                          <div className="flex items-center justify-end w-12 shrink-0 select-none text-right pr-3 font-semibold border-r border-card-border/20 mr-3">
                            {hasFinding ? (
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
                                className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-extrabold cursor-pointer border ${
                                  lineSeverity === 'error'
                                    ? 'bg-danger/20 border-danger/60 text-danger hover:bg-danger/40'
                                    : lineSeverity === 'warning'
                                    ? 'bg-warning/20 border-warning/60 text-warning hover:bg-warning/40'
                                    : 'bg-info/20 border-info/60 text-info hover:bg-info/40'
                                }`}
                              >
                                {isTarget ? '!' : '•'}
                              </button>
                            ) : (
                              <span className="text-text-tertiary/40 group-hover:text-text-tertiary text-[10px] font-medium pr-1">
                                {lineNum}
                              </span>
                            )}
                          </div>

                          {/* Code Content */}
                          <div className="flex-1 whitespace-pre pl-1 select-text">
                            {line || ' '}
                          </div>
                        </div>

                        {/* Inline Expandable Error Card under target line */}
                        {isTarget && (
                          <div className="my-2 ml-14 p-4.5 bg-danger/10 border border-danger/25 rounded-xl text-xs leading-relaxed font-sans text-text-primary flex flex-col gap-2.5 shadow-md select-text relative glass">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-[9px] text-danger uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
                                FINDING (Line {lineNum})
                              </span>
                              <span className={`text-[8.5px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                                severity === 'error'
                                  ? 'bg-error/15 border-error/35 text-error shadow-[0_0_8px_rgba(239,68,68,0.1)]'
                                  : severity === 'warning'
                                  ? 'bg-warning/15 border-warning/35 text-warning shadow-[0_0_8px_rgba(245,158,11,0.1)]'
                                  : 'bg-info/15 border-info/35 text-info shadow-[0_0_8px_rgba(59,130,246,0.1)]'
                              }`}>
                                {finding.severity}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-secondary select-text font-medium leading-relaxed">
                              {finding.message}
                            </div>
                            {resolution?.suggestion && (
                              <div className="text-[10px] text-text-tertiary border-t border-card-border/30 pt-2.5 flex items-start gap-1.5 select-text font-normal italic">
                                <span className="shrink-0 text-amber-400 font-sans">💡</span>
                                <div className="flex-1">
                                  <strong>Remediation advice:</strong> {resolution.suggestion}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-text-tertiary italic">Loading file content...</div>
                )}
              </pre>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                {/* Original Panel */}
                <div className="border border-card-border/60 rounded-lg overflow-hidden bg-bg-primary/30 flex flex-col min-w-0">
                  <div className="bg-bg-tertiary/60 px-3 py-1.5 text-[10px] font-semibold text-text-secondary border-b border-card-border/60 uppercase">
                    Original (Line {finding.line})
                  </div>
                  <pre className="p-3 overflow-x-auto text-[10px] font-mono leading-normal flex-1 flex flex-col max-h-64 scrollbar-thin">
                    {diffOriginal.map((line, i) => {
                      const lineNum = finding.line - 5 + i;
                      const isTarget = lineNum === finding.line;
                      return (
                        <div
                          key={i}
                          className={`w-full py-1 px-1 ${
                            isTarget 
                              ? 'bg-danger/10 border-l-2 border-danger text-danger' 
                              : 'text-text-secondary/80'
                          }`}
                        >
                          <span className="inline-block w-8 shrink-0 text-text-tertiary/60 select-none text-right pr-2">
                            {lineNum > 0 ? lineNum : ''}
                          </span>
                          <span>{line}</span>
                        </div>
                      );
                    })}
                  </pre>
                </div>

                {/* Remediation Panel */}
                <div className="border border-card-border/60 rounded-lg overflow-hidden bg-bg-primary/30 flex flex-col min-w-0">
                  <div className="bg-bg-tertiary/60 px-3 py-1.5 text-[10px] font-semibold text-text-secondary border-b border-card-border/60 uppercase">
                    Remediation
                  </div>
                  <pre className="p-3 overflow-x-auto text-[10px] font-mono leading-normal flex-1 flex flex-col max-h-64 scrollbar-thin">
                    {diffRemediation.map((line, i) => {
                      const targetLine = finding.line - 1;
                      const contextLines = 5;
                      const start = Math.max(0, targetLine - contextLines);
                      const isRem = i >= contextLines && i < diffRemediation.length - (diffOriginal.length - 1 - contextLines);
                      return (
                        <div
                          key={i}
                          className={`w-full py-1 px-1 ${
                            isRem 
                              ? 'bg-success/10 border-l-2 border-success text-success' 
                              : 'text-text-secondary/80'
                          }`}
                        >
                          <span className="inline-block w-8 shrink-0 text-text-tertiary/60 select-none text-right pr-2">
                            {start + i + 1 > 0 ? start + i + 1 : ''}
                          </span>
                          <span>{line}</span>
                        </div>
                      );
                    })}
                  </pre>
                </div>
              </div>
            )}
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
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChat();
              }}
              disabled={isChatLoading}
              placeholder={`Ask about ${finding.rule_id}...`}
              className="flex-1 bg-bg-tertiary text-text-primary border border-card-border/80 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-accent disabled:opacity-50 transition-all placeholder:text-text-tertiary/60 shadow-inner"
            />
            <button
              onClick={handleSendChat}
              disabled={isChatLoading || !chatInput.trim()}
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

