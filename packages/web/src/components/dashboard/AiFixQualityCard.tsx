import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { Finding } from '../../types';
import { classifyFinding, CATEGORIES, CATEGORY_ORDER, type CategoryKey } from '../../utils/categories';

interface AiFixQualityCardProps {
  findings: Finding[];
  scanLabel?: string;
}

interface Bucket {
  total: number;
  done: number;
}

function isFindingDone(finding: Finding): boolean {
  return finding.status === 'applied' || finding._applied === true;
}

interface RatingInfo {
  label: string;
  className: string;
}

function getRating(done: number, total: number): RatingInfo {
  if (total === 0) {
    return { label: 'no data', className: 'text-info border-info/30 bg-info/10' };
  }
  const rate = (done / total) * 100;
  if (rate >= 80) {
    return { label: 't hai th', className: 'text-success border-success/30 bg-success/10' };
  }
  if (rate >= 50) {
    return { label: 'á»n', className: 'text-warning border-warning/30 bg-warning/10' };
  }
  return { label: 'cáº§n xem', className: 'text-warning border-warning/30 bg-warning/10' };
}

function rateText(done: number, total: number): string {
  if (total === 0) return 'â”€';
  return `${Math.round((done / total) * 100)}%`;
}

export const AiFixQualityCard: React.FC<AiFixQualityCardProps> = ({ findings, scanLabel }) => {
  const computed = useMemo(() => {
    const buckets = {} as Record<CategoryKey, Bucket>;
    for (const key of CATEGORY_ORDER) {
      buckets[key] = { total: 0, done: 0 };
    }

    let totalDone = 0;
    let acceptedByDev = 0;
    let rejectedIgnored = 0;

    for (const finding of findings) {
      const cat = classifyFinding(finding);
      const done = isFindingDone(finding);
      const isFalsePositive = finding.finding_type === 'false_positive';

      buckets[cat].total += 1;
      if (done) {
        buckets[cat].done += isFalsePositive ? 0 : 1;
        totalDone += 1;
        if (isFalsePositive) {
          rejectedIgnored += 1;
        } else {
          acceptedByDev += 1;
        }
      }
    }

    return { buckets, totalDone, acceptedByDev, rejectedIgnored };
  }, [findings]);

  const { buckets, totalDone, acceptedByDev, rejectedIgnored } = computed;
  const acceptanceRate = totalDone > 0 ? (acceptedByDev / totalDone) * 100 : 0;
  const rejectionRate = totalDone > 0 ? (rejectedIgnored / totalDone) * 100 : 0;
  const rejectionRating = totalDone === 0
    ? { label: 'no data â”€ cáº§n scan má»›i', className: 'text-warning border-warning/30 bg-warning/10' }
    : rejectionRate >= 30
      ? { label: 'â”€ cáº§n cáº£i thiá»‡n prompt', className: 'text-danger border-danger/30 bg-danger/10' }
      : { label: 'â”€ ok', className: 'text-success border-success/30 bg-success/10' };

  return (
    <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-accent" />
          <span>AI Fix Quality</span>
      </h4>
        {scanLabel && (
          <span className="text-xs font-mono text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/20">
            {scanLabel}
        </span>
        )}
    </div>

      {/* Top stats: Accepted by dev / Rejected, ignored */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-[11px] text-text-tertiary uppercase font-bold tracking-wider">Accepted by dev</div>
          <div className="text-xl font-bold text-success font-mono">{acceptedByDev}</div>
          <div className="text-[11px] text-text-tertiary">{Math.round(acceptanceRate)}% acceptance rate</div>
          <div className="h-2 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border">
            <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${acceptanceRate}%` }} />
        </div>
      </div>

        <div className="space-y-1">
          <div className="text-[11px] text-text-tertiary uppercase font-bold tracking-wider">Rejected / ignored</div>
          <div className="text-xl font-bold text-danger font-mono">{rejectedIgnored}</div>
          <div className="text-[11px] text-text-tertiary flex items-center gap-1.5">
            <span>{Math.round(rejectionRate)}%</span>
            {/* <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${rejectionRating.className}`}>
              {rejectionRating.label}
          </span> */}
        </div>
          <div className="h-2 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border">
            <div className="h-full bg-danger rounded-full transition-all duration-500" style={{ width: `${rejectionRate}%` }} />
        </div>
      </div>
    </div>

      <div className="border-t border-card-border/50" />

      {/* Per-category acceptance rate */}
      <div className="space-y-2">
        <div className="text-[11px] text-text-tertiary uppercase font-bold tracking-wider">Acceptance rate theo category</div>
        {CATEGORY_ORDER.map((key) => {
          const meta = CATEGORIES[key];
          const bucket = buckets[key];
          const rating = getRating(bucket.done, bucket.total);
          const widgetPct = bucket.total === 0 ? 0 : Math.round((bucket.done / bucket.total) * 100);
          return (
            <div key={key} className="grid grid-cols-[12px_minmax(0,1fr)_auto_auto] items-center gap-3 py-1">
              <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
              <div className="text-xs font-semibold text-text-primary">{meta.label}</div>
              <div className="flex items-center gap-2 min-w-[140px]">
                <div className="h-1.5 w-24 bg-bg-primary rounded-full overflow-hidden border border-card-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${meta.barClass}`}
                    style={{ width: bucket.total === 0 ? '0%' : `${Math.max(0, Math.min(100, widgetPct))}%` }}
                  />
              </div>
                <span className="text-xs font-mono text-text-primary min-w-[60px] text-right">
                  {bucket.done}/{bucket.total}
              </span>
                {/* <span className="text-xs font-mono text-text-tertiary min-w-[40px] text-right">
                  {rateText(bucket.done, bucket.total)}
              </span> */}
            </div>
              {/* <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border min-w-[64px] text-center ${rating.className}`}>
                {rating.label}
            </span> */}
          </div>
          );
        })}
    </div>
  </div>
  );
};

export type { CategoryKey };
