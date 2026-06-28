import React from 'react';
import { Brain, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import type { AiPipelineMetrics } from '../../types';

interface AiMetricsPanelProps {
  aiMetrics: AiPipelineMetrics | undefined;
}

export const AiMetricsPanel: React.FC<AiMetricsPanelProps> = ({ aiMetrics }) => {
  if (!aiMetrics) {
    return (
      <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col justify-center items-center text-center min-h-[220px]">
        <Brain className="h-8 w-8 text-text-tertiary/40 mb-3 animate-pulse" />
        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">AI Pipeline Audit</h4>
        <p className="text-[11px] text-text-tertiary max-w-[200px] leading-relaxed">
          No AI pipeline execution data recorded for this report. Run a fresh scan to see AI metrics.
        </p>
      </div>
    );
  }

  const {
    ai_calls = 0,
    cache_hits = 0,
    classifications = { confirmed: 0, hotspot: 0, false_positive: 0 },
    review_approved = 0,
    review_corrected = 0,
    review_rejected = 0,
  } = aiMetrics;

  const totalReviewed = review_approved + review_corrected + review_rejected;
  const approvalRate = totalReviewed > 0 ? (review_approved / totalReviewed) * 100 : 0;
  const correctionRate = totalReviewed > 0 ? (review_corrected / totalReviewed) * 100 : 0;

  return (
    <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col justify-start">
      <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-accent animate-pulse" />
        <span>AI Remediation Audit</span>
      </h4>
      <div className="space-y-4">
        {/* Row 1: Activity */}
        <div className="grid grid-cols-2 gap-3 p-2 bg-bg-secondary/40 border border-card-border/30 rounded-lg text-center">
          <div>
            <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider mb-0.5">AI API Calls</div>
            <div className="text-base font-bold text-accent font-mono">{ai_calls}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider mb-0.5">Cache Hits</div>
            <div className="text-base font-bold text-success font-mono">{cache_hits}</div>
          </div>
        </div>

        {/* Row 2: AI Triage Classifications */}
        <div className="space-y-2">
          <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">AI Triage (Stage 1)</div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-1.5 bg-danger/5 border border-danger/20 rounded-md">
              <div className="text-danger font-bold font-mono">{classifications.confirmed}</div>
              <div className="text-[9px] text-text-tertiary">Confirmed</div>
            </div>
            <div className="p-1.5 bg-warning/5 border border-warning/20 rounded-md">
              <div className="text-warning font-bold font-mono">{classifications.hotspot}</div>
              <div className="text-[9px] text-text-tertiary">Hotspot</div>
            </div>
            <div className="p-1.5 bg-success/5 border border-success/20 rounded-md">
              <div className="text-success font-bold font-mono">{classifications.false_positive}</div>
              <div className="text-[9px] text-text-tertiary">False Pos</div>
            </div>
          </div>
        </div>

        {/* Row 3: Code Review (Stage 3) */}
        <div className="space-y-2 text-xs">
          <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">AI Review (Stage 3)</div>
          
          {/* Approved bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-text-secondary text-[11px]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                <span>Approved As-Is</span>
              </span>
              <span className="font-mono">{review_approved} ({approvalRate.toFixed(0)}%)</span>
            </div>
            <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border">
              <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${approvalRate}%` }} />
            </div>
          </div>

          {/* Corrected bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-text-secondary text-[11px]">
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 text-warning" />
                <span>Optimized & Corrected</span>
              </span>
              <span className="font-mono">{review_corrected} ({correctionRate.toFixed(0)}%)</span>
            </div>
            <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border">
              <div className="h-full bg-warning rounded-full transition-all duration-500" style={{ width: `${correctionRate}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
