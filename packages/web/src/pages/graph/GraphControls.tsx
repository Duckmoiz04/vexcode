import React from 'react';
import { ZoomIn, ZoomOut, Maximize, RefreshCw, Layers, Shield } from 'lucide-react';

interface GraphControlsProps {
  viewMode: 'dependency' | 'dataflow';
  onViewModeChange: (mode: 'dependency' | 'dataflow') => void;
  severityFilters: ('error' | 'warning' | 'info')[];
  onSeverityFilterChange: (filters: ('error' | 'warning' | 'info')[]) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onOptimizeLayout: () => void;
  isLayoutRunning: boolean;
  hasDataflowData: boolean;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  viewMode,
  onViewModeChange,
  severityFilters,
  onSeverityFilterChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOptimizeLayout,
  isLayoutRunning,
  hasDataflowData,
}) => {
  const toggleSeverity = (severity: 'error' | 'warning' | 'info') => {
    if (severityFilters.includes(severity)) {
      onSeverityFilterChange(severityFilters.filter((s) => s !== severity));
    } else {
      onSeverityFilterChange([...severityFilters, severity]);
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-3 items-center justify-between pointer-events-none">
      {/* View Mode Toggle Switch */}
      <div className="flex bg-bg-secondary p-1 rounded-xl border border-card-border pointer-events-auto shadow-lg backdrop-blur-md">
        <button
          onClick={() => onViewModeChange('dependency')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'dependency'
              ? 'bg-accent text-white shadow-md'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Dependency Map
        </button>
        <button
          onClick={() => onViewModeChange('dataflow')}
          disabled={!hasDataflowData}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'dataflow'
              ? 'bg-accent text-white shadow-md'
              : 'text-text-secondary hover:text-text-primary'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={!hasDataflowData ? 'Select an issue with a dataflow trace to unlock' : 'Visualize taint flow path'}
        >
          <Shield className="h-3.5 w-3.5" />
          Dataflow Trace
        </button>
      </div>

      <div className="flex gap-3 items-center pointer-events-auto">
        {/* Severity Filters (Only active in dependency map view) */}
        {viewMode === 'dependency' && (
          <div className="flex bg-bg-secondary px-3 py-1.5 rounded-xl border border-card-border gap-3 items-center shadow-lg backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Severities:</span>
            <div className="flex gap-2">
              {(['error', 'warning', 'info'] as const).map((sev) => {
                const isActive = severityFilters.includes(sev);
                const colorMap = {
                  error: 'border-danger/30 text-danger bg-danger/10',
                  warning: 'border-warning/30 text-warning bg-warning/10',
                  info: 'border-info/30 text-info bg-info/10',
                };
                const activeClasses = isActive ? colorMap[sev] : 'border-card-border text-text-muted bg-transparent hover:text-text-secondary';
                
                return (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    className={`px-2 py-0.5 rounded border text-[10px] font-semibold capitalize cursor-pointer transition-all ${activeClasses}`}
                  >
                    {sev}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Camera Zoom & Layout Optimization Actions */}
        <div className="flex bg-bg-secondary p-1 rounded-xl border border-card-border items-center gap-1 shadow-lg backdrop-blur-md">
          {viewMode === 'dependency' && (
            <button
              onClick={onOptimizeLayout}
              disabled={isLayoutRunning}
              className={`p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-all cursor-pointer ${
                isLayoutRunning ? 'animate-spin text-accent' : ''
              }`}
              title="Optimize physics layout"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="h-4 w-px bg-card-border mx-1" />
          <button
            onClick={onZoomIn}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onZoomOut}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            title="Fit to screen"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
