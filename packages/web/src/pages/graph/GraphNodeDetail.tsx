import React from 'react';
import { X, ExternalLink, FileCode, Terminal, AlertCircle } from 'lucide-react';
import type { Finding } from '../../types';
import { getBasename } from './graphAdapter';

interface GraphNodeDetailProps {
  nodeId: string;
  nodeAttrs: {
    label: string;
    nodeType: 'file' | 'function' | 'class' | 'unknownSymbol' | 'source' | 'propagator' | 'sink';
    filePath: string;
    line?: number;
    severity?: 'error' | 'warning' | 'info';
    findingsCount: number;
    codeText?: string;
    message?: string;
  };
  relatedFindings: Finding[];
  onClose: () => void;
  onInspectFinding: (finding: Finding) => void;
}

export const GraphNodeDetail: React.FC<GraphNodeDetailProps> = ({
  nodeId,
  nodeAttrs,
  relatedFindings,
  onClose,
  onInspectFinding,
}) => {
  const { label, nodeType, filePath, line, severity, findingsCount, codeText, message } = nodeAttrs;

  // Severity color badge mapping
  const severityBadge = (sev: 'error' | 'warning' | 'info') => {
    const classes = {
      error: 'bg-danger/10 border-danger/30 text-danger',
      warning: 'bg-warning/10 border-warning/30 text-warning',
      info: 'bg-info/10 border-info/30 text-info',
    };
    return (
      <span className={`px-2 py-0.5 border rounded-full text-[10px] font-semibold uppercase tracking-wider ${classes[sev]}`}>
        {sev}
      </span>
    );
  };

  return (
    <div className="absolute right-4 top-20 bottom-4 w-80 bg-bg-secondary border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-20 pointer-events-auto backdrop-blur-md animate-slide-left">
      {/* Header */}
      <div className="px-4 py-3 bg-bg-tertiary border-b border-card-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-4 w-4 text-accent flex-shrink-0" />
          <h3 className="font-bold text-xs tracking-wider uppercase truncate text-text-primary">
            Node Information
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-primary transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
        {/* Name and Type */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{nodeType}</span>
            {severity && severityBadge(severity)}
          </div>
          <h2 className="text-base font-bold text-text-primary break-all leading-tight">
            {label}
          </h2>
          <p className="text-[11px] text-text-muted break-all mt-1 font-mono">
            {filePath}{line ? `:${line}` : ''}
          </p>
        </div>

        <hr className="border-card-border" />

        {/* Message for Dataflow trace node */}
        {message && (
          <div className="bg-bg-tertiary border border-card-border p-3 rounded-xl">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-accent" />
              Trace Description
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">{message}</p>
          </div>
        )}

        {/* Source Code Snippet */}
        {codeText && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-accent" />
              Code Context
            </h4>
            <div className="bg-bg-tertiary border border-card-border rounded-xl p-2.5 overflow-x-auto font-mono text-[10px] text-slate-300 max-h-48 leading-normal white-space-pre">
              <code>{codeText.trim()}</code>
            </div>
          </div>
        )}

        {/* Findings List inside file/symbol */}
        {relatedFindings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              Scan Findings ({relatedFindings.length})
            </h4>
            <div className="space-y-2">
              {relatedFindings.map((finding, idx) => (
                <div
                  key={idx}
                  onClick={() => onInspectFinding(finding)}
                  className="group bg-bg-tertiary border border-card-border hover:border-accent p-3 rounded-xl cursor-pointer transition-all flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-text-muted group-hover:text-accent font-semibold truncate">
                      {finding.rule_id}
                    </span>
                    {severityBadge(finding.severity)}
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2 leading-snug group-hover:text-text-primary">
                    {finding.message}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-accent/80 group-hover:text-accent mt-0.5 justify-end">
                    <span>Inspect Issue</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info when no findings */}
        {nodeType !== 'source' && nodeType !== 'propagator' && nodeType !== 'sink' && relatedFindings.length === 0 && findingsCount === 0 && (
          <div className="bg-bg-tertiary/50 border border-dashed border-card-border p-4 rounded-xl text-center">
            <p className="text-xs text-text-muted">
              No findings are registered directly on this symbol.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
