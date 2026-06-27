import React from 'react';
import { Clock, GitCommit, ArrowRight, Download, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';
import type { ReportListItem } from '../types';
import { QualityTrendChart } from '../components/dashboard/QualityTrendChart';

interface ActivityPageProps {
  reports: ReportListItem[];
  currentReportId: string | null;
  onSelectReportId: (id: string) => void;
  onSwitchTab: (tab: 'overview' | 'issues' | 'graph' | 'activity') => void;
  currentProject: string | null;
  onDeleteReport?: (project: string, id: string) => void;
  onDeleteAllReports?: (project: string) => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({
  reports,
  currentReportId,
  onSelectReportId,
  onSwitchTab,
  currentProject,
  onDeleteReport,
  onDeleteAllReports,
}) => {
  const formatReportDate = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown date';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const handleViewReport = (id: string) => {
    onSelectReportId(id);
    onSwitchTab('overview');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin bg-bg-primary animate-slide-left">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-card-border mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
            <Clock className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary uppercase tracking-wider">Scan History</h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Historical record of codebase security analysis runs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-text-tertiary bg-bg-secondary px-2.5 py-1 rounded-full border border-card-border/40">
            Total: {reports.length} scan(s)
          </span>
          {reports.length > 0 && onDeleteAllReports && currentProject && (
            <button
              onClick={() => {
                if (window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ ${reports.length} báo cáo của dự án "${currentProject}"? Thao tác này sẽ xóa vĩnh viễn và không thể hoàn tác.`)) {
                  onDeleteAllReports(currentProject);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-error/20 bg-error/5 text-error hover:bg-error hover:text-white hover:border-error transition-all cursor-pointer"
              title="Xóa tất cả báo cáo"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa tất cả</span>
            </button>
          )}
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="h-12 w-12 text-text-tertiary/30 mb-4" />
          <h4 className="text-sm font-semibold text-text-tertiary">No Scan History</h4>
          <p className="text-xs text-text-tertiary/60 mt-1.5 max-w-sm">
            Run your first project scan to see the historical timeline records here.
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-card-border ml-3.5 pl-6 space-y-6">
          {reports.map((report) => {
            const isActive = report.id === currentReportId;
            const gitState = report.git_state;

            return (
              <div key={report.id} className="relative group">
                {/* Timeline Dot Indicator */}
                <div className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                  isActive
                    ? 'bg-accent border-accent text-white scale-125 shadow-lg shadow-accent/20'
                    : 'bg-bg-primary border-card-border group-hover:border-accent/60'
                }`}>
                  {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </div>

                {/* Report Card */}
                <div className={`rounded-xl border p-4.5 transition-all ${
                  isActive
                    ? 'border-accent/35 bg-accent/[0.02]'
                    : 'border-card-border bg-bg-secondary hover:border-card-border-hover'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Top metadata row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary">
                          {formatReportDate(report.timestamp)}
                        </span>
                        <span className="text-[10px] font-mono text-text-tertiary bg-bg-primary px-1.5 py-0.5 rounded border border-card-border/60">
                          {report.id}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                            <CheckCircle2 className="h-3 w-3" />
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Code / Git info row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                        <span className="flex items-center gap-1.5 font-medium">
                          <ShieldAlert className="h-3.5 w-3.5 text-text-tertiary" />
                          Findings: <span className="font-semibold text-text-primary">{report.findings}</span>
                        </span>

                        {gitState && gitState.commit ? (
                          <span className="flex items-center gap-1.5 text-text-tertiary font-mono">
                            <GitCommit className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                            commit:{' '}
                            <span className="font-semibold text-text-secondary">
                              {gitState.commit.slice(0, 7)}
                            </span>
                            {gitState.is_dirty && (
                              <span className="text-[9px] font-bold text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.2 rounded">
                                dirty
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-tertiary italic">
                            Local workspace (no Git repository info)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {/* Download SARIF link */}
                      {currentProject && (
                        <a
                          href={`/api/report/${currentProject}/${report.id}/sarif`}
                          download={`${report.id}.sarif`}
                          title="Download SARIF report file"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-card-border bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>SARIF</span>
                        </a>
                      )}

                      {/* Select/View button */}
                      {!isActive ? (
                        <button
                          onClick={() => handleViewReport(report.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-accent/20 bg-accent/10 text-accent hover:bg-accent hover:text-white hover:border-accent transition-all cursor-pointer"
                        >
                          <span>View report</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onSwitchTab('overview')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-accent bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer"
                        >
                          <span>Go to Overview</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Delete button */}
                      {onDeleteReport && currentProject && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa báo cáo này (${report.id}) không?`)) {
                              onDeleteReport(currentProject, report.id);
                            }
                          }}
                          className="p-1.5 text-text-tertiary hover:text-error hover:bg-error/10 border border-card-border hover:border-error/20 rounded-lg transition-all cursor-pointer"
                          title="Xóa báo cáo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quality Trend over time */}
      <div className="mt-8">
        <QualityTrendChart reports={reports} />
      </div>
    </div>
  );
};

export default ActivityPage;
