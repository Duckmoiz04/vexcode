import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Info, HelpCircle, CornerDownLeft, Check, Play, Send } from 'lucide-react';

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
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [diffOriginal, setDiffOriginal] = useState<string[]>([]);
  const [diffRemediation, setDiffRemediation] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const resolution = aiResolutions?.[finding.rule_id];

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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-bg-secondary">
      {/* Detail Header */}
      <div className="flex items-center justify-between pb-4 border-b border-card-border">
        <div className="flex items-center gap-3">
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
          <h3 className="text-sm font-bold text-text-primary font-mono">{finding.rule_id}</h3>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Metadata, Suggestion, Diff */}
        <div className="lg:col-span-3 space-y-5">
          {/* File Metadata */}
          <div className="flex gap-6 p-3 rounded-lg border border-card-border bg-card-bg backdrop-blur-md text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">File</span>
              <span className="font-mono text-text-primary break-all">{getRelativePath(finding.file)}</span>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Line</span>
              <span className="font-mono text-text-primary">{finding.line}</span>
            </div>
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

          {/* Code Diff Viewer */}
          {resolution?.remediation_code && diffOriginal.length > 0 && (
            <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3">
              <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Code Diff</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Panel */}
                <div className="border border-card-border/60 rounded-lg overflow-hidden bg-bg-primary/30 flex flex-col">
                  <div className="bg-bg-tertiary/60 px-3 py-1.5 text-[10px] font-semibold text-text-secondary border-b border-card-border/60 uppercase">
                    Original
                  </div>
                  <pre className="p-3 overflow-x-auto text-[10px] font-mono leading-normal flex-1 flex flex-col max-h-64 scrollbar-thin">
                    {diffOriginal.map((line, i) => {
                      const lineNum = finding.line - 5 + i;
                      const isTarget = lineNum === finding.line;
                      return (
                        <div
                          key={i}
                          className={`w-full py-0.5 px-1 ${
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
                <div className="border border-card-border/60 rounded-lg overflow-hidden bg-bg-primary/30 flex flex-col">
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
                          className={`w-full py-0.5 px-1 ${
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
            </div>
          )}

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

        {/* Right Column: Chat copilot */}
        <div className="lg:col-span-2">
          <div className="border border-card-border bg-card-bg backdrop-blur-md rounded-xl flex flex-col h-[520px] overflow-hidden">
            <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-accent" />
              <h4 className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Chat with AI</h4>
            </div>

            {/* Message Box */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-xs text-text-tertiary py-8 space-y-1.5">
                  <p className="font-semibold text-text-secondary">Ask questions about this vulnerability</p>
                  <span className="max-w-[200px] leading-relaxed text-[10px]">
                    e.g., "Why is this dangerous?", "How does this affect callers?", "Show me how to fix it manually"
                  </span>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col p-3 rounded-lg text-xs max-w-[85%] leading-normal ${
                      msg.role === 'user'
                        ? 'bg-accent/15 border border-accent/20 text-text-primary self-end ml-auto rounded-tr-none'
                        : 'bg-bg-tertiary/70 border border-card-border/40 text-text-secondary mr-auto rounded-tl-none'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider mb-1 text-text-tertiary select-none">
                      {msg.role === 'user' ? 'You' : 'AI'}
                    </span>
                    <p className="whitespace-pre-wrap font-sans text-text-primary">{msg.content}</p>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex items-center gap-2 p-3 bg-bg-tertiary/75 border border-card-border/30 rounded-lg text-xs text-text-tertiary animate-pulse w-max rounded-tl-none mr-auto">
                  <span className="h-2 w-2 rounded-full bg-accent animate-bounce" />
                  <span>AI is thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-3 border-t border-card-border bg-bg-primary/20 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChat();
                }}
                disabled={isChatLoading}
                placeholder={`Ask about ${finding.rule_id}...`}
                className="flex-1 bg-bg-tertiary text-text-primary border border-card-border rounded-lg px-3 py-2 text-xs outline-none focus:border-accent disabled:opacity-50 transition-all placeholder:text-text-tertiary"
              />
              <button
                onClick={handleSendChat}
                disabled={isChatLoading || !chatInput.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent cursor-pointer transition-all"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
