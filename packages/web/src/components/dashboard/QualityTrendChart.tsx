import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ReportListItem } from '../../types';

interface QualityTrendChartProps {
  reports: ReportListItem[];
}

interface TrendPoint {
  label: string;
  findings: number;
  timestamp: string;
}

function buildTrendData(reports: ReportListItem[]): TrendPoint[] {
  // Reports are newest-first; reverse for chronological order
  const sorted = [...reports].reverse();
  return sorted.map((r) => {
    const ts = r.timestamp ? new Date(r.timestamp) : null;
    const label = ts
      ? `${ts.getMonth() + 1}/${ts.getDate()} ${ts.getHours()}:${String(ts.getMinutes()).padStart(2, '0')}`
      : r.id.slice(0, 8);
    return {
      label,
      findings: r.findings,
      timestamp: r.timestamp || '',
    };
  });
}

export const QualityTrendChart: React.FC<QualityTrendChartProps> = ({ reports }) => {
  if (!reports || reports.length < 2) {
    return (
      <div className="rounded-xl border border-card-border bg-bg-secondary p-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
          Quality Trend
        </h4>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <TrendingUp className="h-8 w-8 text-text-tertiary/40 mb-3" />
          <p className="text-xs text-text-tertiary/70">
            Run at least 2 scans to see quality trends over time.
          </p>
        </div>
      </div>
    );
  }

  const data = buildTrendData(reports);
  const firstVal = data[0]?.findings ?? 0;
  const lastVal = data[data.length - 1]?.findings ?? 0;
  const delta = lastVal - firstVal;
  const trend = delta < 0 ? 'improving' : delta > 0 ? 'worsening' : 'stable';

  return (
    <div className="rounded-xl border border-card-border bg-bg-secondary p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Quality Trend
        </h4>
        <div className="flex items-center gap-1.5">
          {trend === 'improving' && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
              <TrendingDown className="h-3.5 w-3.5" />
              {delta} findings
            </span>
          )}
          {trend === 'worsening' && (
            <span className="flex items-center gap-1 text-xs font-medium text-danger">
              <TrendingUp className="h-3.5 w-3.5" />
              +{delta} findings
            </span>
          )}
          {trend === 'stable' && (
            <span className="text-xs font-medium text-text-tertiary">Stable</span>
          )}
        </div>
      </div>

      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.45)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.45)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(30,30,40,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}
            />
            <Line
              type="monotone"
              dataKey="findings"
              name="Total Findings"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
