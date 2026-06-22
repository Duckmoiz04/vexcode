import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export interface ThresholdConfig {
  max_critical: number;
  max_high: number;
  max_total: number;
  max_files_with_errors: number;
  min_rating: string;
}

interface QualityGateSectionProps {
  thresholds: ThresholdConfig;
  onChange: (key: keyof ThresholdConfig, value: number | string) => void;
  onSave: () => void;
}

const RATING_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

const FIELD_META: { key: keyof ThresholdConfig; label: string; description: string; type: 'number' | 'select' }[] = [
  {
    key: 'max_critical',
    label: 'Max Critical Findings',
    description: 'Maximum allowed error/critical severity findings before gate fails.',
    type: 'number',
  },
  {
    key: 'max_high',
    label: 'Max High-Severity Findings',
    description: 'Maximum allowed warning/high severity findings.',
    type: 'number',
  },
  {
    key: 'max_total',
    label: 'Max Total Findings',
    description: 'Maximum total findings across all severities.',
    type: 'number',
  },
  {
    key: 'max_files_with_errors',
    label: 'Max Files with Errors',
    description: 'Maximum number of files containing error-severity findings.',
    type: 'number',
  },
  {
    key: 'min_rating',
    label: 'Minimum Quality Rating',
    description: 'Minimum acceptable A-E rating across all quality dimensions.',
    type: 'select',
  },
];

export const QualityGateSection: React.FC<QualityGateSectionProps> = ({
  thresholds,
  onChange,
  onSave,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 pb-4 border-b border-card-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
          <ShieldCheck className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Quality Gate Thresholds</h4>
          <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
            Configure quality gates that determine when a scan passes or fails. These thresholds are evaluated by the analysis engine during each scan.
          </p>
        </div>
      </div>

      {/* Threshold fields */}
      <div className="space-y-4">
        {FIELD_META.map(({ key, label, description, type }) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-[13px] font-medium text-text-primary">{label}</label>
              <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
            </div>
            <div className="shrink-0 w-24">
              {type === 'number' ? (
                <input
                  type="number"
                  min={0}
                  value={thresholds[key] as number}
                  onChange={(e) => onChange(key, Math.max(0, parseInt(e.target.value) || 0))}
                  onBlur={onSave}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-card-border bg-bg-primary text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
              ) : (
                <select
                  value={thresholds[key] as string}
                  onChange={(e) => onChange(key, e.target.value)}
                  onBlur={onSave}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-card-border bg-bg-primary text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all cursor-pointer"
                >
                  {RATING_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/[0.04] border border-accent/15">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-accent/70" />
        <p className="text-xs text-text-tertiary leading-relaxed">
          When <code className="text-accent/80 bg-accent/10 px-1 rounded">--fail-on-threshold</code> is used with the CLI, the engine exits with code 1 when any threshold is breached. This is useful for CI/CD integration.
        </p>
      </div>
    </div>
  );
};
