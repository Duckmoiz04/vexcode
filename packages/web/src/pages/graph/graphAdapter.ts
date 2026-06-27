import Graph from 'graphology';
import type { Finding, DataflowTrace, DataflowLocation } from '../../types';
import { NODE_COLORS, NODE_SIZES } from './graphConstants';

export interface GraphNodeAttrs {
  label: string;
  nodeType: 'file' | 'function' | 'class' | 'unknownSymbol' | 'source' | 'propagator' | 'sink';
  filePath: string;
  line?: number;
  severity?: 'error' | 'warning' | 'info';
  findingsCount: number;
  codeText?: string;
  message?: string;
  size: number;
  color: string;
  x: number;
  y: number;
  // Node state flags for Sigma rendering overrides
  highlighted?: boolean;
  dimmed?: boolean;
}

export interface GraphEdgeAttrs {
  relationType: 'contains' | 'calls' | 'blastRadius' | 'dataflow';
  color: string;
  size: number;
  type?: 'arrow' | 'line';
  dimmed?: boolean;
  animated?: boolean;
}

// Helper to get file basename
export const getBasename = (path: string): string => {
  if (!path) return 'unknown';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
};

// Helper to sort severities
export const getHighestSeverity = (
  s1?: 'error' | 'warning' | 'info',
  s2?: 'error' | 'warning' | 'info'
): 'error' | 'warning' | 'info' | undefined => {
  if (!s1) return s2;
  if (!s2) return s1;
  const rank = { error: 3, warning: 2, info: 1 };
  return rank[s1] >= rank[s2] ? s1 : s2;
};

// Build Dependency Graph
export function buildDependencyGraph(findings: Finding[]): Graph<GraphNodeAttrs, GraphEdgeAttrs> {
  const graph = new Graph<GraphNodeAttrs, GraphEdgeAttrs>({ allowSelfLoops: false, multi: false });

  // Map to collect file severity and findings count
  const fileStats = new Map<string, { severity?: 'error' | 'warning' | 'info'; count: number }>();
  
  findings.forEach((f) => {
    const stats = fileStats.get(f.file) || { count: 0 };
    stats.count++;
    stats.severity = getHighestSeverity(stats.severity, f.severity);
    fileStats.set(f.file, stats);
  });

  // 1. Add File Nodes
  fileStats.forEach((stats, file) => {
    const baseSize = NODE_SIZES.file;
    // Scale node size slightly based on finding count (logarithmic)
    const size = baseSize + Math.min(10, Math.log2(stats.count) * 2);
    const color = stats.severity ? NODE_COLORS[stats.severity] : NODE_COLORS.file;

    // Place file nodes in a circular formation initially
    const angle = Math.random() * Math.PI * 2;
    const radius = 100 + Math.random() * 150;

    graph.addNode(file, {
      label: getBasename(file),
      nodeType: 'file',
      filePath: file,
      severity: stats.severity,
      findingsCount: stats.count,
      size,
      color,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });

  // 2. Add Symbol Nodes and relationships from AST contexts
  findings.forEach((finding) => {
    const ast = finding.ast_context;
    if (!ast || !ast.symbol_name) return;

    const symbolId = `${finding.file}::${ast.symbol_name}`;
    const kind = (ast.kind || 'function').toLowerCase();
    const nodeType = kind.includes('class') ? 'class' : 'function';
    
    // Add symbol node if not exists
    if (!graph.hasNode(symbolId)) {
      const color = NODE_COLORS[nodeType];
      const size = NODE_SIZES[nodeType];
      
      // Position symbols near their containing files
      const fileAttrs = graph.hasNode(finding.file) ? graph.getNodeAttributes(finding.file) : { x: 0, y: 0 };
      const offsetAngle = Math.random() * Math.PI * 2;
      const offsetDist = 30 + Math.random() * 30;

      graph.addNode(symbolId, {
        label: ast.symbol_name,
        nodeType,
        filePath: finding.file,
        findingsCount: 1,
        severity: finding.severity,
        size,
        color: finding.severity ? NODE_COLORS[finding.severity] : color,
        x: fileAttrs.x + Math.cos(offsetAngle) * offsetDist,
        y: fileAttrs.y + Math.sin(offsetAngle) * offsetDist,
      });
    } else {
      // Update severity if higher
      const attrs = graph.getNodeAttributes(symbolId);
      const newSeverity = getHighestSeverity(attrs.severity, finding.severity);
      graph.setNodeAttribute(symbolId, 'severity', newSeverity);
      if (newSeverity) {
        graph.setNodeAttribute(symbolId, 'color', NODE_COLORS[newSeverity]);
      }
      graph.setNodeAttribute(symbolId, 'findingsCount', attrs.findingsCount + 1);
    }

    // Add contains edge: File -> Symbol
    const containsEdgeId = `${finding.file}->${symbolId}`;
    if (!graph.hasEdge(finding.file, symbolId)) {
      graph.addEdge(finding.file, symbolId, {
        relationType: 'contains',
        color: '#475569',
        size: 1,
        type: 'line',
      });
    }

    // Add callers: Caller -> Symbol
    if (ast.callers) {
      ast.callers.forEach((caller) => {
        const callerFileId = caller.filePath || finding.file;
        const callerSymbolId = `${callerFileId}::${caller.name}`;

        // Ensure caller node exists (as a function symbol on its file)
        if (!graph.hasNode(callerSymbolId)) {
          // If we have callerFile node in graph, position near it, otherwise center
          const refX = graph.hasNode(callerFileId) ? graph.getNodeAttributes(callerFileId).x : 0;
          const refY = graph.hasNode(callerFileId) ? graph.getNodeAttributes(callerFileId).y : 0;
          const callerAngle = Math.random() * Math.PI * 2;
          const callerDist = 40 + Math.random() * 30;

          graph.addNode(callerSymbolId, {
            label: caller.name,
            nodeType: 'function',
            filePath: callerFileId,
            findingsCount: 0,
            size: NODE_SIZES.function,
            color: NODE_COLORS.function,
            x: refX + Math.cos(callerAngle) * callerDist,
            y: refY + Math.sin(callerAngle) * callerDist,
          });

          // Draw containment link to its file if that file node exists
          if (graph.hasNode(callerFileId) && !graph.hasEdge(callerFileId, callerSymbolId)) {
            graph.addEdge(callerFileId, callerSymbolId, {
              relationType: 'contains',
              color: '#475569',
              size: 1,
              type: 'line',
            });
          }
        }

        // Draw call arrow: CallerSymbol -> TargetSymbol
        if (!graph.hasEdge(callerSymbolId, symbolId)) {
          graph.addEdge(callerSymbolId, symbolId, {
            relationType: 'calls',
            color: '#8b5cf6', // Violet edge
            size: 1.5,
            type: 'arrow',
          });
        }
      });
    }

    // Add blast radius: Symbol -> ImpactedSymbol
    if (ast.blast_radius) {
      ast.blast_radius.forEach((impact) => {
        const impactFileId = impact.filePath || finding.file;
        const impactSymbolId = `${impactFileId}::${impact.name}`;

        // Ensure impacted node exists
        if (!graph.hasNode(impactSymbolId)) {
          const refX = graph.hasNode(impactFileId) ? graph.getNodeAttributes(impactFileId).x : 0;
          const refY = graph.hasNode(impactFileId) ? graph.getNodeAttributes(impactFileId).y : 0;
          const impactAngle = Math.random() * Math.PI * 2;
          const impactDist = 50 + Math.random() * 30;

          graph.addNode(impactSymbolId, {
            label: impact.name,
            nodeType: 'function',
            filePath: impactFileId,
            findingsCount: 0,
            size: NODE_SIZES.function,
            color: NODE_COLORS.unknownSymbol,
            x: refX + Math.cos(impactAngle) * impactDist,
            y: refY + Math.sin(impactAngle) * impactDist,
          });

          // Draw containment link to its file
          if (graph.hasNode(impactFileId) && !graph.hasEdge(impactFileId, impactSymbolId)) {
            graph.addEdge(impactFileId, impactSymbolId, {
              relationType: 'contains',
              color: '#475569',
              size: 1,
              type: 'line',
            });
          }
        }

        // Draw impact arrow: TargetSymbol -> ImpactedSymbol
        if (!graph.hasEdge(symbolId, impactSymbolId)) {
          graph.addEdge(symbolId, impactSymbolId, {
            relationType: 'blastRadius',
            color: '#ec4899', // Pink edge
            size: 1.5,
            type: 'arrow',
          });
        }
      });
    }
  });

  return graph;
}

// Build Dataflow Trace Graph
export function buildDataflowGraph(finding: Finding): Graph<GraphNodeAttrs, GraphEdgeAttrs> {
  const graph = new Graph<GraphNodeAttrs, GraphEdgeAttrs>({ allowSelfLoops: false, multi: false });
  const trace = finding.dataflow_trace;
  
  if (!trace) {
    // Return empty graph if no trace
    return graph;
  }

  // Linear layout coordinates: Top-to-Bottom flow (Source at y=0, propagators, Sink at bottom)
  // Let's lay them out vertically
  const spacingY = 120;
  let currentY = 0;

  // 1. Source Node
  const sourceId = 'df::source';
  graph.addNode(sourceId, {
    label: `Source: ${trace.source.symbol || getBasename(trace.source.file)}`,
    nodeType: 'source',
    filePath: trace.source.file,
    line: trace.source.line,
    codeText: trace.source.code_text,
    message: trace.source.message || 'Data enters here',
    findingsCount: 1,
    severity: finding.severity,
    size: NODE_SIZES.source,
    color: NODE_COLORS.source,
    x: 0,
    y: currentY,
  });
  currentY += spacingY;

  // 2. Propagators
  let prevNodeId = sourceId;
  const props = trace.propagators || [];
  
  props.forEach((prop: DataflowLocation, idx: number) => {
    const propId = `df::prop::${idx}`;
    graph.addNode(propId, {
      label: prop.symbol || `Step ${idx + 1}`,
      nodeType: 'propagator',
      filePath: prop.file,
      line: prop.line,
      codeText: prop.code_text,
      message: prop.message || `Propagator step ${idx + 1}`,
      findingsCount: 0,
      size: NODE_SIZES.propagator,
      color: NODE_COLORS.propagator,
      // Add slight alternate x offsets to make it look organic
      x: (idx % 2 === 0 ? 30 : -30),
      y: currentY,
    });

    graph.addEdge(prevNodeId, propId, {
      relationType: 'dataflow',
      color: '#06b6d4',
      size: 2,
      type: 'arrow',
      animated: true,
    });

    prevNodeId = propId;
    currentY += spacingY;
  });

  // 3. Sink Node
  const sinkId = 'df::sink';
  graph.addNode(sinkId, {
    label: `Sink: ${trace.sink.symbol || getBasename(trace.sink.file)}`,
    nodeType: 'sink',
    filePath: trace.sink.file,
    line: trace.sink.line,
    codeText: trace.sink.code_text,
    message: trace.sink.message || finding.message || 'Vulnerability triggered here',
    findingsCount: 1,
    severity: finding.severity,
    size: NODE_SIZES.sink,
    color: NODE_COLORS.sink,
    x: 0,
    y: currentY,
  });

  graph.addEdge(prevNodeId, sinkId, {
    relationType: 'dataflow',
    color: NODE_COLORS.error,
    size: 3,
    type: 'arrow',
    animated: true,
  });

  return graph;
}
