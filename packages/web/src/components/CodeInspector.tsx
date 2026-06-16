import React, { useState, useRef } from 'react';
import type { Finding, Metrics, CallerInfo, AiResolution } from '../types';
import { useFileContent } from '../hooks/useFileContent';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChat } from '../hooks/useChat';
import { useAIProvider } from '../context/AIProviderContext';
import { FileViewer } from './code-inspector/FileViewer';
import { ChatPanel } from './code-inspector/ChatPanel';
import { CodeInspectorHeader } from './code-inspector/CodeInspectorHeader';

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
    const r = await fetch('/api/open-in-ide', {
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
  finding, aiResolutions, targetPath, metrics, onSelectFindingIndex, allFindings,
}) => {
  // Guard: parent may pass an out-of-range index, in which case `finding` is
  // undefined. Render a minimal empty state instead of crashing on
  // `finding.file` etc. (Issue: `Cannot read properties of undefined
  // (reading 'file')` when navigating past the last finding.)
  if (!finding) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-secondary relative">
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

  const { selectedProvider, apiKey, apiBaseUrl, aiModel, aiTemperature, aiMaxTokens } = useAIProvider();

  const { content: fileContent, isLoading: isFileLoading, error: fileError } = useFileContent(finding.file, targetPath);
  useAutoScroll(activeLineRef as React.RefObject<HTMLElement>, finding.line, !isFileLoading);

  const resolution = aiResolutions?.[finding.rule_id];

  const { chatMessages, chatInput, setChatInput, isChatLoading, handleSendChat } = useChat({
    finding, resolution, selectedProvider, apiKey, apiBaseUrl, aiModel, aiTemperature, aiMaxTokens,
  });

  const relPath = getRelativePath(finding.file, targetPath);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-secondary relative">
      <CodeInspectorHeader
        finding={finding} isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onBack={onSelectFindingIndex ? () => onSelectFindingIndex(null) : undefined}
        onOpenInIDE={() => openInIDE(finding.file, finding.line, targetPath)}
      />

      <div className="flex-1 flex overflow-y-auto min-h-0 relative">
        <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
          {/* Top sections — single page scroll model.
              The whole center column is one scrollable area, so the top
              sections take their NATURAL height (no cap, no internal scroll).
              If the page is taller than the viewport, the column itself
              scrolls; if the page fits, nothing scrolls. There is intentionally
              no `overflow-y-auto` on the top sections anymore — that would
              create a NESTED scrollbar inside the page-level scrollbar, which
              is exactly what we want to avoid. */}
          <div className="shrink-0 px-6 pt-6 pb-2 space-y-5">
            {/* File Metadata */}
            <div className="flex flex-wrap gap-6 p-3 rounded-lg border border-card-border bg-card-bg backdrop-blur-md text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">File</span>
                <span className="font-mono text-text-primary break-all">{relPath}</span>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Line</span>
                <span className="font-mono text-text-primary">{finding.line}</span>
              </div>
              {metrics?.files?.[relPath] && (() => {
                const fm = metrics.files[relPath];
                const lvlCls = fm.level === 'HIGH' ? 'text-danger' : fm.level === 'MEDIUM' ? 'text-warning' : 'text-success';
                return (<>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Complexity (CCN)</span>
                    <span className={`font-mono font-semibold ${lvlCls}`}>{fm.complexity} ({fm.level})</span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Cognitive</span>
                    <span className="font-mono text-text-primary">{fm.cognitive_complexity || 0}</span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">LOC</span>
                    <span className="font-mono text-text-primary">{fm.loc || 0}</span>
                  </div>
                </>);
              })()}
            </div>

            {/* Finding Message */}
            <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md text-xs leading-relaxed text-text-secondary">
              {finding.message}
            </div>

            {/* AST Context */}
            {finding.ast_context && (
              <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-3">
                <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1.5">AST Context</h4>
                <div className="flex gap-6 text-xs">
                  <div className="flex flex-col gap-0.5"><span className="text-[9px] text-text-tertiary uppercase">Symbol</span><span className="font-mono text-text-primary font-semibold">{finding.ast_context.symbol_name || '-'}</span></div>
                  <div className="flex flex-col gap-0.5"><span className="text-[9px] text-text-tertiary uppercase">Kind</span><span className="font-mono text-text-primary">{finding.ast_context.kind || '-'}</span></div>
                </div>
                {finding.ast_context.callers && finding.ast_context.callers.length > 0 && (
                  <div className="text-xs">
                    <span className="text-[9px] text-text-tertiary uppercase block mb-1">Callers</span>
                    <div className="flex flex-wrap gap-1.5">
                      {finding.ast_context.callers.map((c: CallerInfo, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-bg-primary/50 text-[10px] font-mono text-text-secondary border border-card-border/40">{c.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {finding.ast_context.blast_radius && finding.ast_context.blast_radius.length > 0 && (
                  <div className="text-xs flex items-center gap-2"><span className="text-[9px] text-text-tertiary uppercase">Blast Radius</span><span className="font-semibold text-accent">{finding.ast_context.blast_radius.length} affected symbol(s)</span></div>
                )}
              </div>
            )}

            {/* AI Suggestion */}
            <div className="p-4 rounded-lg border border-card-border bg-card-bg backdrop-blur-md space-y-2">
              <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1.5">AI Suggestion</h4>
              <p className="text-xs text-text-secondary leading-relaxed">{resolution?.suggestion || 'No AI suggestion available.'}</p>
            </div>
          </div>

          {/* FileViewer's content area — natural height.
              We no longer use `flex-1 min-h-0` here because the page-level
              scroll (on the center column) handles overflow. The FileViewer
              and the diff/code editor inside it render at their natural
              content height, so the user can scroll the page to reach the
              bottom of the file. If a file is very long (500+ lines), the
              page will be very tall — that's the explicit trade-off for
              having a single scrollbar. */}
          <div className="px-6 pt-3 pb-4 flex flex-col">
            <FileViewer
              finding={finding} fileContent={fileContent} isLoading={isFileLoading} error={fileError}
              resolution={resolution} activeLineRef={activeLineRef}
              allFindings={allFindings}
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