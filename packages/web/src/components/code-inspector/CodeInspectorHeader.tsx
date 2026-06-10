import React from 'react';
import { HelpCircle, ExternalLink } from 'lucide-react';
import type { Finding } from '../../types';

interface CodeInspectorHeaderProps {
  finding: Finding;
  isChatOpen: boolean;
  onToggleChat: () => void;
  onBack: (() => void) | undefined;
  onOpenInIDE: () => void;
}

export const CodeInspectorHeader: React.FC<CodeInspectorHeaderProps> = ({
  finding,
  isChatOpen,
  onToggleChat,
  onBack,
  onOpenInIDE,
}) => {
  const severity = (finding.severity || '').toLowerCase();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-bg-secondary shrink-0 z-10">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
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
          onClick={onOpenInIDE}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-card-border/60 bg-bg-tertiary/40 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60 text-xs font-semibold transition-all cursor-pointer"
          title="Open file in IDE (VS Code / Cursor)"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Open in IDE</span>
        </button>
        <button
          onClick={onToggleChat}
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
  );
};