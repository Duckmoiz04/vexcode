import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Report, Finding } from '../types';
import { buildDependencyGraph, buildDataflowGraph } from './graph/graphAdapter';
import { useSigmaGraph } from './graph/useSigmaGraph';
import { GraphControls } from './graph/GraphControls';
import { GraphNodeDetail } from './graph/GraphNodeDetail';
import { Activity, ShieldAlert, GitBranch } from 'lucide-react';

interface GraphPageProps {
  currentReport: Report | null;
  onSelectFindingIndex: (index: number | null) => void;
  onSelectFilePath: (path: string | null) => void;
}

export const GraphPage: React.FC<GraphPageProps> = ({
  currentReport,
  onSelectFindingIndex,
  onSelectFilePath,
}) => {
  const [viewMode, setViewMode] = useState<'dependency' | 'dataflow'>('dependency');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [severityFilters, setSeverityFilters] = useState<('error' | 'warning' | 'info')[]>(['error', 'warning', 'info']);
  const [activeTraceFinding, setActiveTraceFinding] = useState<Finding | null>(null);

  // 1. Gather all findings from report
  const findings = useMemo(() => currentReport?.findings || [], [currentReport]);

  // 2. Identify if there's any dataflow trace in the report
  const findingsWithTraces = useMemo(() => {
    return findings.filter((f) => !!f.dataflow_trace);
  }, [findings]);

  const hasDataflowData = findingsWithTraces.length > 0;

  // Auto-set the first available trace finding if none is selected
  useEffect(() => {
    if (hasDataflowData && !activeTraceFinding) {
      setActiveTraceFinding(findingsWithTraces[0]);
    }
  }, [hasDataflowData, findingsWithTraces, activeTraceFinding]);

  // 3. Filter findings based on severity for dependency graph
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => severityFilters.includes(f.severity));
  }, [findings, severityFilters]);

  // 4. Construct Graphology graph instance based on view mode
  const graph = useMemo(() => {
    if (viewMode === 'dataflow') {
      if (activeTraceFinding) {
        return buildDataflowGraph(activeTraceFinding);
      }
      return null;
    }
    return buildDependencyGraph(filteredFindings);
  }, [viewMode, filteredFindings, activeTraceFinding]);

  // 5. Reset selection when switching view modes
  useEffect(() => {
    setSelectedNodeId(null);
  }, [viewMode]);

  // 6. Double click jumps directly to Issue Inspector
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    if (!graph || !currentReport) return;
    const attrs = graph.getNodeAttributes(nodeId);
    
    if (attrs.nodeType === 'file') {
      onSelectFilePath(attrs.filePath);
    } else {
      // Find the first finding associated with this symbol
      const findingIdx = currentReport.findings.findIndex(
        (f) => f.file === attrs.filePath && f.ast_context?.symbol_name === attrs.label
      );
      if (findingIdx !== -1) {
        onSelectFindingIndex(findingIdx);
      }
    }
  }, [graph, currentReport, onSelectFilePath, onSelectFindingIndex]);

  // 7. Initialize Sigma via custom hook
  const {
    containerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    runLayout,
    isLayoutRunning,
  } = useSigmaGraph({
    graph,
    selectedNodeId,
    onNodeClick: setSelectedNodeId,
    onNodeDoubleClick: handleNodeDoubleClick,
  });

  // 8. Find selected node properties & associated findings to show in detail sidebar
  const selectedNodeDetails = useMemo(() => {
    if (!selectedNodeId || !graph || !graph.hasNode(selectedNodeId)) return null;
    const attrs = graph.getNodeAttributes(selectedNodeId);

    let related: Finding[] = [];
    if (viewMode === 'dataflow') {
      // Dataflow trace selected node: find the main activeTraceFinding
      if (activeTraceFinding) {
        related = [activeTraceFinding];
      }
    } else {
      // Dependency view node: find findings matching path/symbol
      if (attrs.nodeType === 'file') {
        related = findings.filter((f) => f.file === attrs.filePath);
      } else if (attrs.nodeType === 'function' || attrs.nodeType === 'class') {
        related = findings.filter(
          (f) => f.file === attrs.filePath && f.ast_context?.symbol_name === attrs.label
        );
      }
    }

    return {
      nodeId: selectedNodeId,
      attrs: {
        label: attrs.label,
        nodeType: attrs.nodeType,
        filePath: attrs.filePath,
        line: attrs.line,
        severity: attrs.severity,
        findingsCount: attrs.findingsCount || 0,
        codeText: attrs.codeText,
        message: attrs.message,
      },
      relatedFindings: related,
    };
  }, [selectedNodeId, graph, viewMode, activeTraceFinding, findings]);

  // Click handler from node detail panel
  const handleInspectFinding = (finding: Finding) => {
    if (!currentReport) return;
    const idx = currentReport.findings.findIndex((f) => f.id === finding.id || (f.file === finding.file && f.line === finding.line && f.rule_id === finding.rule_id));
    if (idx !== -1) {
      onSelectFindingIndex(idx);
    }
  };

  // Empty state handling
  if (!currentReport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-bg-primary h-full select-none">
        <Activity className="h-12 w-12 text-text-muted mb-4 animate-pulse" />
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">No Report Loaded</h3>
        <p className="text-xs text-text-muted mt-2 max-w-sm">
          Please select a project and load or run a scan to view the Code Intelligence Graph.
        </p>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-bg-primary h-full select-none">
        <ShieldAlert className="h-12 w-12 text-text-muted mb-4" />
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">No Findings Found</h3>
        <p className="text-xs text-text-muted mt-2 max-w-sm">
          Congratulations! This report contains no quality gates or security violations.
        </p>
      </div>
    );
  }

  // Count symbols with relations
  const symbolsWithRelations = findings.filter(f => f.ast_context && (f.ast_context.callers?.length || f.ast_context.blast_radius?.length)).length;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-bg-primary animate-slide-left relative w-full h-full select-none">
      {/* Sigma Canvas */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 bg-[#090d16]" />

      {/* Toolbar / Controls Overlay */}
      <GraphControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        severityFilters={severityFilters}
        onSeverityFilterChange={setSeverityFilters}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onOptimizeLayout={runLayout}
        isLayoutRunning={isLayoutRunning}
        hasDataflowData={hasDataflowData}
      />

      {/* Detail sidebar on node selection */}
      {selectedNodeDetails && (
        <GraphNodeDetail
          nodeId={selectedNodeDetails.nodeId}
          nodeAttrs={selectedNodeDetails.attrs}
          relatedFindings={selectedNodeDetails.relatedFindings}
          onClose={() => setSelectedNodeId(null)}
          onInspectFinding={handleInspectFinding}
        />
      )}

      {/* Bottom Status Indicators */}
      <div className="absolute bottom-4 left-4 z-10 bg-bg-secondary/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-card-border pointer-events-none flex gap-4 text-[10px] font-mono text-text-muted shadow-lg">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span>Nodes: {graph ? graph.order : 0}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
          <span>Edges: {graph ? graph.size : 0}</span>
        </div>
        {viewMode === 'dependency' && symbolsWithRelations > 0 && (
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3 text-emerald-500" />
            <span>AST Connected: {symbolsWithRelations} items</span>
          </div>
        )}
      </div>

      {/* Left Dataflow Dropdown Picker when in Dataflow Mode */}
      {viewMode === 'dataflow' && hasDataflowData && (
        <div className="absolute bottom-4 right-4 z-10 bg-bg-secondary/90 border border-card-border p-3 rounded-2xl shadow-xl w-64 pointer-events-auto flex flex-col gap-2 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">
            Select Dataflow Leak:
          </span>
          <select
            value={activeTraceFinding?.id || ''}
            onChange={(e) => {
              const selected = findingsWithTraces.find((f) => f.id === e.target.value);
              if (selected) {
                setActiveTraceFinding(selected);
                setSelectedNodeId(null); // Clear active selected node
              }
            }}
            className="w-full text-xs bg-bg-tertiary border border-card-border rounded-lg p-2 text-text-primary focus:outline-none focus:border-accent cursor-pointer"
          >
            {findingsWithTraces.map((f, idx) => (
              <option key={f.id || idx} value={f.id}>
                {f.rule_id} (line {f.line})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
