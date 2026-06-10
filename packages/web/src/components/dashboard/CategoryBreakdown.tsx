import React from 'react';
import { ShieldCheck, Cpu, Layout, Info } from 'lucide-react';

interface CategoryBreakdownProps {
  security: number;
  quality: number;
  architecture: number;
  maintainability: number;
  totalFindings: number;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  security,
  quality,
  architecture,
  maintainability,
  totalFindings,
}) => {
  return (
    <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col justify-start">
      <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider">Criteria Category Audit</h4>
      <div className="space-y-4">
        {[
          { id: 'security', name: 'Security & Secrets', icon: <ShieldCheck className="h-4 w-4 text-danger shrink-0" />, count: security },
          { id: 'quality', name: 'Code Quality & Reliability', icon: <Cpu className="h-4 w-4 text-warning shrink-0" />, count: quality },
          { id: 'architecture', name: 'AST & Call Flow', icon: <Layout className="h-4 w-4 text-info shrink-0" />, count: architecture },
          { id: 'maintainability', name: 'Style & Maintainability', icon: <Info className="h-4 w-4 text-success shrink-0" />, count: maintainability }
        ].map(cat => {
          const pct = totalFindings > 0 ? (cat.count / totalFindings) * 100 : 0;
          return (
            <div key={cat.id} className="text-xs">
              <div className="flex justify-between text-text-secondary mb-1">
                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                  {cat.icon}
                  <span>{cat.name}</span>
                </span>
                <span className="font-mono">{cat.count} issue(s)</span>
              </div>
              <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cat.id === 'security' ? 'bg-danger' : cat.id === 'quality' ? 'bg-warning' : cat.id === 'architecture' ? 'bg-info' : 'bg-success'
                  }`}
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