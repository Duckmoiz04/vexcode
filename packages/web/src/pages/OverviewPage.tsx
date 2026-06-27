import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Finding, Report, ReportListItem } from '../types';
import { useDashboardStats } from '../components/dashboard/useDashboardStats';
import { MetricsCards } from '../components/dashboard/MetricsCards';
import { HealthScoreChart } from '../components/dashboard/HealthScoreChart';
import { CategoryBreakdown } from '../components/dashboard/CategoryBreakdown';
import { Leaderboards } from '../components/dashboard/Leaderboards';
import { CrossScanSummary } from '../components/dashboard/CrossScanSummary';

interface OverviewPageProps {
  report: Report | null;
  currentProject: string | null;
  findings: Finding[];
  reports: ReportListItem[];
  onSelectFilePath: (path: string | null) => void;
  onSelectFindingIndex: (index: number | null) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  report,
  currentProject,
  findings,
  reports,
  onSelectFilePath,
  onSelectFindingIndex,
}) => {
  const { stats, display } = useDashboardStats(findings, report);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-bg-primary">
      {/* Overview Header */}
      <div className="flex items-center justify-between pb-4 border-b border-card-border">
        <h3 className="text-base font-semibold text-text-primary uppercase tracking-wider">Overview</h3>
        <span className="text-xs text-accent font-mono bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
          {report?._project || currentProject || 'Project'}
        </span>
      </div>

      {/* Mock-fallback warning badge (Phase 3.3) */}
      {report?.fallback_reason && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/25 bg-warning/[0.08] backdrop-blur-md">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warning">Using simulated results</p>
            <p className="mt-1 text-xs text-text-tertiary leading-relaxed">{report.fallback_reason}</p>
          </div>
        </div>
      )}

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

export default OverviewPage;
