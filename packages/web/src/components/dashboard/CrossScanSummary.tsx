import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Finding, ScanStatus } from '../../types';

interface CrossScanSummaryProps {
  findings: Finding[];
}

const statusConfig: Record<ScanStatus, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; description: string }> = {
  new: {
    label: 'New',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/25',
    description: 'Introduced since last scan',
  },
  persisting: {
    label: 'Persisting',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/25',
    description: 'Still present from previous scan',
  },
  resolved: {
    label: 'Resolved',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/25',
    description: 'Fixed since last scan',
  },
  regressed: {
    label: 'Regressed',
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/25',
    description: 'Were applied, now back',
  },
};

export const CrossScanSummary: React.FC<CrossScanSummaryProps> = ({ findings }) => {
  const counts: Record<ScanStatus, number> = { new: 0, persisting: 0, resolved: 0, regressed: 0 };

  findings.forEach((f) => {
    const status = (f.scan_status || 'new') as ScanStatus;
    if (status in counts) counts[status]++;
  });

  // Don't render if no scan status data at all (first scan or no previous report)
  const hasData = counts.new > 0 || counts.persisting > 0 || counts.resolved > 0 || counts.regressed > 0;
  if (!hasData) return null;

  const statuses: ScanStatus[] = ['new', 'persisting', 'resolved', 'regressed'];

  return (
    <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
      <div className="flex items-center gap-2 mb-3">
        <RefreshCw className="h-4 w-4 text-accent" />
        <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          Cross-Scan Comparison
        </h4>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statuses.map((status) => {
          const cfg = statusConfig[status];
          const count = counts[status];
          return (
            <div
              key={status}
              className={`flex items-center gap-3 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}
            >
              <div className={cfg.color}>{cfg.icon}</div>
              <div className="min-w-0">
                <div className={`text-lg font-bold ${cfg.color}`}>{count}</div>
                <div className="text-xs text-text-tertiary truncate">{cfg.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CrossScanSummary;
