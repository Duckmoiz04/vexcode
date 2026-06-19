import React from 'react';
import type { Finding, Report } from '../../types';
import { useDashboardStats } from './useDashboardStats';
import { MetricsCards } from './MetricsCards';
import { HealthScoreChart } from './HealthScoreChart';
import { CategoryBreakdown } from './CategoryBreakdown';
import { Leaderboards } from './Leaderboards';
import { CrossScanSummary } from './CrossScanSummary';

interface DashboardPageProps {
  report: Report | null;
  currentProject: string | null;
  findings: Finding[];
  onSelectFilePath: (path: string | null) => void;
  onSelectFindingIndex: (index: number | null) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  report,
  currentProject,
  findings,
  onSelectFilePath,
  onSelectFindingIndex,
}) => {
  const { stats, display } = useDashboardStats(findings, report);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-bg-primary">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between pb-4 border-b border-card-border">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Scan Summary</h3>
        <span className="text-xs text-accent font-mono bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
          {report?._project || currentProject || 'Project'}
        </span>
      </div>

      {/* Metrics Cards Grid */}
      <MetricsCards
        totalFindings={findings.length}
        security={stats.security}
        quality={stats.quality}
        architecture={stats.architecture}
        maintainability={stats.maintainability}
        avgComplexity={stats.avgComplexity}
        avgCognitive={stats.avgCognitive}
      />

      {/* Graphs & breakdown row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HealthScoreChart
          healthScore={stats.healthScore}
          healthDashOffset={display.healthDashOffset}
          healthColor={display.healthColor}
          donutSegments={display.donutSegments}
          totalIssues={stats.errors + stats.warnings + stats.infos}
        />
        <CategoryBreakdown
          security={stats.security}
          quality={stats.quality}
          architecture={stats.architecture}
          maintainability={stats.maintainability}
          totalFindings={findings.length}
        />
      </div>

      {/* Cross-Scan Comparison */}
      <CrossScanSummary findings={findings} />

      {/* Leaderboards row */}
      <Leaderboards
        topFiles={stats.topFiles}
        topComplexFiles={stats.topComplexFiles}
        topSymbols={stats.topSymbols}
        targetPath={report?.target_path}
        onSelectFilePath={onSelectFilePath}
      />
    </div>
  );
};

export default DashboardPage;