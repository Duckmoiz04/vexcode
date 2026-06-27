import React, { useState, useRef, useMemo } from 'react';
import type { Finding, Metrics, CallerInfo, AiResolution } from '../types';
import { apiFetch } from '../utils/apiClient';
import { useFileContent } from '../hooks/useFileContent';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChat } from '../hooks/useChat';
import { useAIProvider } from '../context/AIProviderContext';
import { FileViewer } from './code-inspector/FileViewer';
import { ChatPanel } from './code-inspector/ChatPanel';
import { CodeInspectorHeader } from './code-inspector/CodeInspectorHeader';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface CodeInspectorProps {
  finding: Finding;
  aiResolutions: Record<string, AiResolution>;
  targetPath: string | null;
  onApplyFix: (finding: Finding, remediationCode: string) => Promise<boolean>;
  metrics?: Metrics;
  onSelectFindingIndex?: (index: number | null) => void;
  /** All findings in the report — used to highlight sibling error lines
   *  in the same file when viewing one finding. */
  allFindings?: Finding[];
  theme: 'dark' | 'light';
}

function getRelativePath(absolutePath: string, targetPath: string | null): string {
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
}

async function openInIDE(filePath: string, line: number, baseDir: string | null): Promise<void> {
  try {
    const r = await apiFetch('/api/open-in-ide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, line, baseDir }),
    });
    const d = await r.json();
    if (!d.success) { console.error('Failed to open in IDE:', d.error); alert(d.error || 'Failed to open in IDE'); }
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error('Error opening in IDE:', err); alert(`Error opening in IDE: ${m}`);
  }
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  finding, aiResolutions, targetPath, metrics, onSelectFindingIndex, allFindings, theme,
}) => {
  // Guard: parent may pass an out-of-range index, in which case `finding` is
  // undefined. Render a minimal empty state instead of crashing on
  // `finding.file` etc. (Issue: `Cannot read properties of undefined
  // (reading 'file')` when navigating past the last finding.)
  if (!finding) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-primary relative">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
          No finding selected.
          {onSelectFindingIndex && (
            <button
              type="button"
              onClick={() => onSelectFindingIndex(null)}
              className="ml-3 px-3 py-1 text-xs rounded border border-card-border hover:bg-bg-tertiary"
            >
              Back to list
            </button>
          )}
        </div>
      </div>
    );
  }

  const [isChatOpen, setIsChatOpen] = useState(false);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const { selectedProvider, apiKey, apiBaseUrl, aiModel, aiTemperature, aiMaxTokens, aiSettings } = useAIProvider();

  // Resolve chat provider & model from agent assignment ("Models" tab → "Chat" agent).
  // When the chat agent is configured, the server resolves apiKey + baseUrl from its
  // own .env — the frontend only sends the provider name and model.
  const chatAgent = aiSettings?.agents?.chat;
  const useChatAgent = chatAgent?.enabled && chatAgent?.provider;
  const effectiveProvider = useChatAgent ? chatAgent.provider : selectedProvider;
  const effectiveApiKey = useChatAgent ? '' : apiKey;
  const effectiveBaseUrl = useChatAgent ? '' : apiBaseUrl;
  const effectiveModel = useChatAgent && chatAgent?.model ? chatAgent.model : aiModel;

  const { content: fileContent, isLoading: isFileLoading, error: fileError } = useFileContent(finding.file, targetPath);
  useAutoScroll(activeLineRef as React.RefObject<HTMLElement>, finding.line, !isFileLoading);

  const resolution = aiResolutions?.[finding.rule_id];

  const { chatMessages, chatInput, setChatInput, isChatLoading, handleSendChat } = useChat({
    finding, resolution,
    selectedProvider: effectiveProvider,
    apiKey: effectiveApiKey,
    apiBaseUrl: effectiveBaseUrl,
    aiModel: effectiveModel,
    aiTemperature, aiMaxTokens,
    stream: aiSettings?.stream ?? true,
  });

  const relPath = getRelativePath(finding.file, targetPath);

  // Same-file findings for sibling navigation
  const sameFileFindings = useMemo(() => {
    if (!allFindings) return [];
    return allFindings
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f.file === finding.file);
  }, [allFindings, finding.file]);

  const currentPosInFile = sameFileFindings.findIndex(
    ({ f }) => f.line === finding.line && f.rule_id === finding.rule_id
  );
  const hasMultipleInFile = sameFileFindings.length > 1;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-primary relative">
      <CodeInspectorHeader
        finding={finding} isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onBack={onSelectFindingIndex ? () => onSelectFindingIndex(null) : undefined}
        onOpenInIDE={() => openInIDE(finding.file, finding.line, targetPath)}
      />

      {/* Sibling finding navigation bar — shows when file has multiple findings */}
      {hasMultipleInFile && onSelectFindingIndex && currentPosInFile >= 0 && (
        <div className="flex items-center justify-between px-6 py-1.5 border-b border-card-border/50 bg-bg-primary/80 shrink-0">
          <span className="text-xs text-text-tertiary font-mono">
            Finding {currentPosInFile + 1} of {sameFileFindings.length} in this file
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const prev = currentPosInFile > 0 ? currentPosInFile - 1 : sameFileFindings.length - 1;
                onSelectFindingIndex(sameFileFindings[prev].idx);
              }}
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-card-border/40 bg-bg-tertiary/40 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60 transition-all cursor-pointer"
              title="Previous finding in this file"
            >
              <ChevronUp size={12} /> Prev
            </button>
            <button
              onClick={() => {
                const next = currentPosInFile < sameFileFindings.length - 1 ? currentPosInFile + 1 : 0;
                onSelectFindingIndex(sameFileFindings[next].idx);
              }}
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-card-border/40 bg-bg-tertiary/40 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60 transition-all cursor-pointer"
              title="Next finding in this file"
            >
              Next <ChevronDown size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top sections — scrollable header with max height.
              Capping this area prevents long messages or AI suggestions from
              pushing the code viewer off the screen, keeping everything clean
              and docked. */}
          <div className="shrink-0 px-6 pt-6 pb-4 space-y-4 max-h-[35%] overflow-y-auto border-b border-card-border/30 bg-bg-secondary/10 scrollbar-thin">
            {/* File Metadata */}
            <div className="flex flex-wrap gap-6 p-3 rounded-lg border border-card-border bg-card-bg backdrop-blur-md text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">File</span>
                <span className="font-mono text-text-primary break-all">{relPath}</span>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">Line</span>
                <span className="font-mono text-text-primary">{finding.line}</span>
              </div>
              {metrics?.files?.[relPath] && (() => {
                const fm = metrics.files[relPath];
                const lvlCls = fm.level === 'HIGH' ? 'text-danger' : fm.level === 'MEDIUM' ? 'text-warning' : 'text-success';
                return (<>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">Complexity (CCN)</span>
                    <span className={`font-mono font-semibold ${lvlCls}`}>{fm.complexity} ({fm.level})</span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">Cognitive</span>
                    <span className="font-mono text-text-primary">{fm.cognitive_complexity || 0}</span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">LOC</span>
                    <span className="font-mono text-text-primary">{fm.loc || 0}</span>
                  </div>
                </>);
              })()}
            </div>

            {/* Finding Message */}
            <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md text-xs leading-relaxed text-text-secondary">
              {finding.message}
            </div>

            {/* Duplicate Code Info */}
            {finding.duplicate && (
              <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-2">
                <h4 className="text-xs text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1.5">Duplicate Code</h4>
                <div className="flex gap-6 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-text-tertiary uppercase">Matched Lines</span>
                    <span className="font-mono text-text-primary font-semibold">{finding.duplicate.match_lines}</span>
                  </div>
                  {finding.duplicate.other_file && (
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-text-tertiary uppercase">Other File</span>
                      <span className="font-mono text-text-primary truncate" title={finding.duplicate.other_file}>
                        {getRelativePath(finding.duplicate.other_file, targetPath)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AST Context */}
            {finding.ast_context && (
              <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3">
                <h4 className="text-xs text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1.5">AST Context</h4>
                <div className="flex gap-6 text-xs">
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-text-tertiary uppercase">Symbol</span><span className="font-mono text-text-primary font-semibold">{finding.ast_context.symbol_name || '-'}</span></div>
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-text-tertiary uppercase">Kind</span><span className="font-mono text-text-primary">{finding.ast_context.kind || '-'}</span></div>
                </div>
                {finding.ast_context.callers && finding.ast_context.callers.length > 0 && (
                  <div className="text-xs">
                    <span className="text-xs text-text-tertiary uppercase block mb-1">Callers</span>
                    <div className="flex flex-wrap gap-1.5">
                      {finding.ast_context.callers.map((c: CallerInfo, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-bg-primary/50 text-xs font-mono text-text-secondary border border-card-border/40">{c.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {finding.ast_context.blast_radius && finding.ast_context.blast_radius.length > 0 && (
                  <div className="text-xs flex items-center gap-2"><span className="text-xs text-text-tertiary uppercase">Blast Radius</span><span className="font-semibold text-accent">{finding.ast_context.blast_radius.length} affected symbol(s)</span></div>
                )}
              </div>
            )}

            {/* AI Suggestion */}
            <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-2">
              <h4 className="text-xs text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1.5">AI Suggestion</h4>

              {(resolution?.ai_status === 'failed' || resolution?.ai_error) && (
                <div className="flex items-start gap-2 p-2.5 rounded-md border border-danger/30 bg-danger/5 text-xs text-danger">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">AI resolution failed</span>
                    <span>{resolution?.ai_error || 'Unknown error'}</span>
                  </div>
                </div>
              )}

              {resolution?.ai_status === 'fallback_mock' && (
                <div className="flex items-start gap-2 p-2.5 rounded-md border border-warning/30 bg-warning/5 text-xs text-warning">
                  <span className="mt-0.5 shrink-0">ℹ</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">Mock fallback</span>
                    <span>AI provider not configured. Showing generic suggestions.</span>
                  </div>
                </div>
              )}

              {resolution?.ai_status === 'success' && resolution?.model && (
                <div className="flex items-center gap-2 p-2 rounded-md border border-success/20 bg-success/5 text-xs text-text-tertiary">
                  <span>Resolved by <span className="font-mono font-semibold text-accent">{resolution.model}</span></span>
                  {resolution?.generated_at && (
                    <span className="ml-auto">{new Date(resolution.generated_at).toLocaleString()}</span>
                  )}
                </div>
              )}

              <p className="text-xs text-text-secondary leading-relaxed">{resolution?.suggestion || 'No AI suggestion available.'}</p>
            </div>
          </div>

          {/* FileViewer's content area — fills the rest of the height.
              Using flex-1 min-h-0 to make sure the editor container matches
              the remaining space perfectly and scrolls internally. */}
          <div className="px-6 py-4 flex flex-col flex-1 min-h-0">
            <FileViewer
              finding={finding} fileContent={fileContent} isLoading={isFileLoading} error={fileError}
              resolution={resolution} activeLineRef={activeLineRef}
              allFindings={allFindings}
              theme={theme}
            />
          </div>
        </div>

        <ChatPanel
          isOpen={isChatOpen} onClose={() => setIsChatOpen(false)}
          messages={chatMessages} chatInput={chatInput} onChatInputChange={setChatInput}
          onSend={handleSendChat} isChatLoading={isChatLoading} findingRuleId={finding.rule_id}
        />
      </div>
    </div>
  );
};