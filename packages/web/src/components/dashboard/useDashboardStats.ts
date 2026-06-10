import { useMemo } from 'react';
import type { Finding, Report } from '../../types';
import { computeDashboardStats } from './dashboardUtils';
import type { DashboardStats, DonutSegment, DashboardDisplayValues } from './dashboardTypes';

export type { DashboardStats, DonutSegment, DashboardDisplayValues };

export function useDashboardStats(
  findings: Finding[],
  report: Report | null
): { stats: DashboardStats; display: DashboardDisplayValues } {
  const stats = useMemo(
    () => computeDashboardStats(findings, report),
    [findings, report]
  );

  const donutSegments = useMemo((): DonutSegment[] => {
    const total = stats.errors + stats.warnings + stats.infos;
    if (total === 0) return [];

    const errPct = (stats.errors / total) * 100;
    const warnPct = (stats.warnings / total) * 100;
    const infoPct = (stats.infos / total) * 100;

    let offset = 25;

    const segments: DonutSegment[] = [];
    if (errPct > 0) {
      segments.push({ color: 'var(--color-danger)', percent: errPct, offset });
      offset -= errPct;
    }
    if (warnPct > 0) {
      segments.push({ color: 'var(--color-warning)', percent: warnPct, offset });
      offset -= warnPct;
    }
    if (infoPct > 0) {
      segments.push({ color: 'var(--color-info)', percent: infoPct, offset });
    }

    return segments;
  }, [stats]);

  const healthDashOffset = 251.2 - (251.2 * stats.healthScore) / 100;
  const healthColor = stats.healthScore >= 90
    ? 'var(--color-success)'
    : stats.healthScore >= 70
    ? 'var(--color-warning)'
    : 'var(--color-danger)';

  return {
    stats,
    display: { donutSegments, healthDashOffset, healthColor }
  };
}