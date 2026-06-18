import React from 'react';
import { AlertTriangle, ShieldCheck, Cpu, Layout, Info } from 'lucide-react';

interface MetricsCardsProps {
  totalFindings: number;
  security: number;
  quality: number;
  architecture: number;
  maintainability: number;
  avgComplexity: number;
  avgCognitive: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  totalFindings,
  security,
  quality,
  architecture,
  maintainability,
  avgComplexity,
  avgCognitive,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* Total Issues */}
      <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
        <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
          <AlertTriangle className="h-4 w-4 text-accent" />
          <span>Total Issues</span>
        </div>
        <div className="text-2xl font-bold text-text-primary">{totalFindings}</div>
        <div className="text-xs text-text-tertiary mt-1">Overall findings identified</div>
      </div>

      {/* Security */}
      <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
        <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
          <ShieldCheck className="h-4 w-4 text-danger animate-pulse" />
          <span>Security</span>
        </div>
        <div className="text-2xl font-bold text-text-primary">{security}</div>
        <div className="text-xs text-text-tertiary mt-1">Vulnerabilities & secrets</div>
      </div>

      {/* Quality */}
      <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
        <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
          <Cpu className="h-4 w-4 text-warning" />
          <span>Quality</span>
        </div>
        <div className="text-2xl font-bold text-text-primary">{quality}</div>
        <div className="text-xs text-text-tertiary mt-1">Logic bugs & code defects</div>
      </div>

      {/* Architecture */}
      <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
        <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
          <Layout className="h-4 w-4 text-info" />
          <span>Architecture</span>
        </div>
        <div className="text-2xl font-bold text-text-primary">{architecture}</div>
        <div className="text-xs text-text-tertiary mt-1">AST & call flow insights</div>
      </div>

      {/* Maintainability */}
      <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
        <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
          <Info className="h-4 w-4 text-success" />
          <span>Maintainability</span>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold text-text-primary">{maintainability}</div>
          {avgComplexity > 0 && (
            <span className="text-xs font-mono text-text-secondary">
              (Avg CCN: {avgComplexity})
            </span>
          )}
        </div>
        <div className="text-xs text-text-tertiary mt-1">
          {avgComplexity > 0 ? `Avg Cognitive: ${avgCognitive}` : 'Style & complexity issues'}
        </div>
      </div>
    </div>
  );
};