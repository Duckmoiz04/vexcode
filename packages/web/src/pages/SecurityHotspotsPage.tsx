import React, { useMemo } from 'react';
import { Shield, ShieldAlert, CheckCircle2, XCircle, FileCode } from 'lucide-react';
import type { Finding, FindingStatus, Report } from '../types';

interface SecurityHotspotsPageProps {
  currentReport: Report | null;
  onStatusChange: (finding: Finding, status: FindingStatus) => void;
  onSelectFindingIndex: (index: number | null) => void;
}

interface HotspotItem {
  finding: Finding;
  index: number;
  reviewStatus: 'pending' | 'confirmed' | 'dismissed';
}

function isSecurityFinding(f: Finding): boolean {
  // Use AI classification when available
  if (f.finding_type === 'hotspot' || f.finding_type === 'vulnerability') return true;
  // Fallback: Direct ISO category
  if (f.rule_id && f.rule_id.includes('gitleaks/')) return true;
  if ((f as Finding & { category?: string }).category === 'security') return true;
  // OWASP tagged
  if (f.owasp_id) return true;
  // Rule ID keyword heuristic (legacy)
  const ruleId = (f.rule_id || '').toLowerCase();
  const secKeywords = [
    'security', 'injection', 'xss', 'csrf', 'ssrf', 'secret',
    'password', 'credential', 'crypto', 'hardcoded', 'auth',
    'dangerous-exec', 'sql-injection', 'command-injection',
    'path-traversal', 'deserialization', 'xxe', 'open-redirect',
    'weak-hash', 'insecure-random',
  ];
  return secKeywords.some(kw => ruleId.includes(kw));
}

function getReviewStatus(f: Finding): 'pending' | 'confirmed' | 'dismissed' {
  if (f.status === 'applied' || f.status === 'false_positive') return 'dismissed';
  if (f.status === 'ignored') return 'dismissed';
  return 'pending';
}

function severityColor(sev: string): string {
  switch (sev) {
    case 'error': return 'text-danger';
    case 'warning': return 'text-warning';
    default: return 'text-info';
  }
}

export const SecurityHotspotsPage: React.FC<SecurityHotspotsPageProps> = ({
  currentReport,
  onStatusChange,
  onSelectFindingIndex,
}) => {
  const hotspots: HotspotItem[] = useMemo(() => {
    if (!currentReport?.findings) return [];
    return currentReport.findings
      .map((finding, index) => ({ finding, index, reviewStatus: getReviewStatus(finding) }))
      .filter(item => {
        // AI-classified hotspots always show here
        if (item.finding.finding_type === 'hotspot') return true;
        // Unclassified security findings also show as hotspots (legacy fallback)
        if (!item.finding.finding_type && isSecurityFinding(item.finding)) return true;
        return false;
      });
  }, [currentReport]);

  const pendingCount = hotspots.filter(h => h.reviewStatus === 'pending').length;
  const confirmedCount = hotspots.filter(h => h.reviewStatus !== 'pending').length;

  if (!currentReport) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-text-tertiary">Select a project and run a scan to see security hotspots.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-card-border mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10 border border-danger/20">
            <ShieldAlert className="h-5 w-5 text-danger" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Security Hotspots</h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Findings requiring human review before remediation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
            <Shield className="h-3.5 w-3.5" />
            {pendingCount} pending
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {confirmedCount} reviewed
          </span>
        </div>
      </div>

      {/* Hotspots list */}
      {hotspots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="h-12 w-12 text-text-tertiary/30 mb-4" />
          <h4 className="text-sm font-semibold text-text-tertiary">No Security Hotspots</h4>
          <p className="text-xs text-text-tertiary/60 mt-1.5 max-w-sm">
            No security findings detected in this scan. Run a scan with Gitleaks enabled for comprehensive secret detection.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {hotspots.map((item) => {
            const { finding, index } = item;
            const isPending = item.reviewStatus === 'pending';
            return (
              <div
                key={`${finding.file}-${finding.line}-${finding.rule_id}-${index}`}
                className={`rounded-xl border p-4 transition-all cursor-pointer hover:border-accent/40 ${
                  isPending
                    ? 'border-danger/25 bg-danger/[0.03]'
                    : 'border-card-border bg-bg-secondary'
                }`}
                onClick={() => onSelectFindingIndex(index)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-bold uppercase ${severityColor(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      {finding.owasp_id && (
                        <span className="text-[10px] font-mono text-text-tertiary bg-bg-primary px-1.5 py-0.5 rounded border border-card-border">
                          {finding.owasp_id}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-text-tertiary bg-bg-primary px-1.5 py-0.5 rounded border border-card-border">
                        {finding.rule_id}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary font-medium truncate">
                      {finding.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-text-tertiary">
                      <FileCode className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono">{finding.file}</span>
                      <span className="shrink-0">:{finding.line}</span>
                    </div>
                  </div>

                  {/* Review actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {isPending ? (
                      <>
                        <button
                          onClick={() => onStatusChange(finding, 'false_positive')}
                          title="Mark as false positive (dismiss)"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border bg-bg-primary text-text-secondary hover:text-text-primary hover:border-text-tertiary/40 transition-all cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                        <button
                          onClick={() => onStatusChange(finding, 'applied')}
                          title="Confirm and apply fix"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirm
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Reviewed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
