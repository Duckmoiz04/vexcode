import React from 'react';
import { ShieldCheck, Bug, Wrench, Gauge } from 'lucide-react';
import { CATEGORIES, CATEGORY_ORDER } from '../../utils/categories';

interface CategoryBreakdownProps {
  security: number;
  reliability: number;
  performance: number;
  maintainability: number;
  totalFindings: number;
}

const ICON_FOR: Record<'security' | 'reliability' | 'maintainability' | 'performance', typeof ShieldCheck> = {
  security: ShieldCheck,
  reliability: Bug,
  maintainability: Wrench,
  performance: Gauge,
};

const BAR_COLOR_FOR: Record<'security' | 'reliability' | 'maintainability' | 'performance', string> = {
  security: 'bg-danger',
  reliability: 'bg-warning',
  maintainability: 'bg-success',
  performance: 'bg-info',
};

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  security,
  reliability,
  performance,
  maintainability,
  totalFindings,
}) => {
  const counts = { security, reliability, maintainability, performance };
  return (
    <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col justify-start">
      <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider">Criteria Category Audit</h4>
      <div className="space-y-4">
        {CATEGORY_ORDER.map((key) => {
          const meta = CATEGORIES[key];
          const Icon = ICON_FOR[key];
          const count = counts[key];
          const pct = totalFindings > 0 ? (count / totalFindings) * 100 : 0;
          return (
            <div key={key} className="text-xs">
              <div className="flex justify-between text-text-secondary mb-1">
                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0 text-accent" />
                  <span>{meta.label}</span>
               </span>
                <span className="font-mono">{count} issue(s)</span>
             </div>
              <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${BAR_COLOR_FOR[key]}`}
                  style={{ width: `${pct}%` }}
                />
             </div>
           </div>
          );
        })}
     </div>
   </div>
  );
};
