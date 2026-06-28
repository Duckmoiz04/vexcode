import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CATEGORIES, CATEGORY_ORDER, type CategoryKey } from '../../utils/categories';

interface MetricsCardsProps {
  totalFindings: number;
  security: number;
  reliability: number;
  performance: number;
  maintainability: number;
  avgComplexity: number;
  avgCognitive: number;
}

const CARD_TITLES: Record<CategoryKey, { overlay: string }> = {
  security:       { overlay: 'Vulnerabilities & secrets' },
  reliability:    { overlay: 'Logic bugs & error handling' },
  maintainability: { overlay: 'Style, naming, complexity' },
  performance:    { overlay: 'Hotspots & call-flow complexity' },
};

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  totalFindings,
  security,
  reliability,
  performance,
  maintainability,
  avgComplexity,
  avgCognitive,
}) => (
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

    {CATEGORY_ORDER.map((key) => {
      const meta = CATEGORIES[key];
      const Icon = meta.icon;
      const count = { security, reliability, maintainability, performance }[key];
      const isMaintainability = key === 'maintainability';
      return (
        <div key={key} className={`p-4 rounded-xl border ${meta.cardBorderClass} bg-card-bg backdrop-blur-md`}>
          <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
            <Icon className="h-4 w-4 text-accent" />
            <span>{meta.label}</span>
         </div>
          {isMaintainability ? (
            <div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-text-primary">{count}</div>
                {avgComplexity > 0 && (
                  <span className="text-xs font-mono text-text-secondary">
                    (Avg CCN: {avgComplexity})
                 </span>
                )}
             </div>
              <div className="text-xs text-text-tertiary mt-1">
                {avgComplexity > 0
                  ? `Avg Cognitive: ${avgCognitive}`
                  : meta.description}
             </div>
           </div>
          ) : (
            <div>
              <div className="text-2xl font-bold text-text-primary">{count}</div>
              <div className="text-xs text-text-tertiary mt-1">{CARD_TITLES[key].overlay}</div>
           </div>
          )}
       </div>
      );
    })}
 </div>
);
