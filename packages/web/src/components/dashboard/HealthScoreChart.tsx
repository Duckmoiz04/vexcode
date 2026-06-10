import React from 'react';
import type { DonutSegment } from './dashboardTypes';

interface HealthScoreChartProps {
  healthScore: number;
  healthDashOffset: number;
  healthColor: string;
  donutSegments: DonutSegment[];
  totalIssues: number;
}

export const HealthScoreChart: React.FC<HealthScoreChartProps> = ({
  healthScore,
  healthDashOffset,
  healthColor,
  donutSegments,
  totalIssues,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Health Score Circular SVG */}
      <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col items-center">
        <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider self-start">Project Health Score</h4>
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg width="180" height="180" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-card-border)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke={healthColor}
              strokeWidth="8"
              strokeDasharray="251.2"
              strokeDashoffset={healthDashOffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-text-primary">{healthScore}</span>
            <span className="text-[10px] text-text-secondary uppercase font-semibold">Score</span>
          </div>
        </div>
      </div>

      {/* Severity Distribution Donut SVG */}
      <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col items-center">
        <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider self-start">Severity Distribution</h4>
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg width="180" height="180" viewBox="0 0 42 42" className="donut-chart">
            <circle cx="21" cy="21" r="15.915" fill="transparent" />
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-card-border)" strokeWidth="3" />
            {donutSegments.map((seg, idx) => (
              <circle
                key={idx}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={seg.color}
                strokeWidth="4.5"
                strokeDasharray={`${seg.percent} ${100 - seg.percent}`}
                strokeDashoffset={seg.offset}
                className="transition-all duration-500 ease-out"
              />
            ))}
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-text-primary">
              {totalIssues}
            </span>
            <span className="text-[10px] text-text-secondary uppercase font-semibold">Issues</span>
          </div>
        </div>
      </div>
    </div>
  );
};