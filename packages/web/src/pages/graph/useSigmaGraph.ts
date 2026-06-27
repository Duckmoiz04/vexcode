import { useEffect, useRef, useState, useCallback } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import { NODE_COLORS } from './graphConstants';

interface UseSigmaGraphProps {
  graph: Graph | null;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
}

export function useSigmaGraph({
  graph,
  selectedNodeId,
  onNodeClick,
  onNodeDoubleClick,
}: UseSigmaGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);

  const onNodeClickRef = useRef(onNodeClick);
  const onNodeDoubleClickRef = useRef(onNodeDoubleClick);

  // Keep callback refs fresh so the main effect doesn't rerun on parent re-renders
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
    onNodeDoubleClickRef.current = onNodeDoubleClick;
  }, [onNodeClick, onNodeDoubleClick]);

  // Initialize and update Graph
  useEffect(() => {
    if (!containerRef.current || !graph || graph.order === 0) return;

    // Clean up previous Sigma instance if it exists
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    // Initialize Sigma
    const sigma = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      labelFont: 'Outfit, Inter, system-ui, sans-serif',
      labelSize: 11,
      labelColor: { color: '#e2e8f0' },
      labelRenderedSizeThreshold: 6,
      defaultNodeColor: NODE_COLORS.file,
      defaultEdgeColor: '#334155',
      minCameraRatio: 0.05,
      maxCameraRatio: 20,
      
      // Node Reducer for dynamic styling based on hover and selection
      nodeReducer: (nodeId, data) => {
        const attrs = { ...data };
        
        const isSelected = selectedNodeId === nodeId;
        const isHovered = hoveredNodeId === nodeId;
        
        if (hoveredNodeId) {
          const isNeighbor = graph.hasEdge(hoveredNodeId, nodeId) || graph.hasEdge(nodeId, hoveredNodeId);
          if (!isHovered && !isNeighbor) {
            attrs.color = NODE_COLORS.dimmed;
            attrs.label = ''; // Hide label of dimmed nodes to reduce clutter
          } else if (isHovered) {
            attrs.highlighted = true;
            attrs.size = (data.size || 10) + 4;
          }
        } else if (selectedNodeId) {
          const isNeighbor = graph.hasEdge(selectedNodeId, nodeId) || graph.hasEdge(nodeId, selectedNodeId);
          if (!isSelected && !isNeighbor) {
            attrs.color = NODE_COLORS.dimmed;
          } else if (isSelected) {
            attrs.highlighted = true;
            attrs.size = (data.size || 10) + 3;
          }
        }
        
        return attrs;
      },
      
      // Edge Reducer for dynamic styling based on hover and selection
      edgeReducer: (edgeId, data) => {
        const attrs = { ...data };
        const [source, target] = graph.extremities(edgeId);
        
        if (hoveredNodeId) {
          const involvesHover = source === hoveredNodeId || target === hoveredNodeId;
          if (!involvesHover) {
            attrs.color = '#111827'; // Dark dim color
            attrs.size = 0.5;
          } else {
            attrs.size = (data.size || 1) * 2.5;
          }
        } else if (selectedNodeId) {
          const involvesSelect = source === selectedNodeId || target === selectedNodeId;
          if (!involvesSelect) {
            attrs.color = '#111827';
            attrs.size = 0.5;
          }
        }
        
        return attrs;
      }
    });

    sigmaRef.current = sigma;

    // Detect if this is a Dataflow graph by checking if source/sink nodes exist
    const isDataflow = graph.someNode((_, attrs) => attrs.nodeType === 'source' || attrs.nodeType === 'sink');

    if (!isDataflow) {
      setIsLayoutRunning(true);
      try {
        // Run ForceAtlas2 layout synchronously for clean node positioning
        forceAtlas2(graph, {
          iterations: 60,
          settings: {
            gravity: 1.2,
            barnesHutOptimize: true,
            strongGravityMode: true,
            linLogMode: false,
          }
        });
        
        // Remove node overlaps
        noverlap.assign(graph, {
          maxIterations: 40,
        });
      } catch (err) {
        console.warn('Graphology layout engine error:', err);
      }
      setIsLayoutRunning(false);
    }

    // Reset camera to fit all nodes nicely
    sigma.getCamera().animatedReset({ duration: 300 });

    // Drag-and-drop node logic
    let draggedNodeId: string | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggedNodeId) return;
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const pos = sigma.viewportToGraph({ x, y });
      graph.setNodeAttribute(draggedNodeId, 'x', pos.x);
      graph.setNodeAttribute(draggedNodeId, 'y', pos.y);
      sigma.refresh();
    };

    const handleMouseUp = () => {
      if (draggedNodeId) {
        draggedNodeId = null;
        sigma.getMouseCaptor().enabled = true;
      }
    };

    sigma.on('downNode', (e) => {
      draggedNodeId = e.node;
      sigma.getMouseCaptor().enabled = false;
    });

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Node click triggers selection
    sigma.on('clickNode', (e) => {
      onNodeClickRef.current(e.node);
      const nodeAttrs = graph.getNodeAttributes(e.node);
      sigma.getCamera().animate(
        { x: nodeAttrs.x, y: nodeAttrs.y, ratio: 0.25 },
        { duration: 400 }
      );
    });

    // Node double click triggers issue jumping
    sigma.on('doubleClickNode', (e) => {
      if (onNodeDoubleClickRef.current) {
        onNodeDoubleClickRef.current(e.node);
      }
    });

    // Clicking the canvas clears selection
    sigma.on('clickStage', () => {
      onNodeClickRef.current(null);
    });

    // Mouse hover updates hover state
    sigma.on('enterNode', (e) => {
      setHoveredNodeId(e.node);
    });

    sigma.on('leaveNode', () => {
      setHoveredNodeId(null);
    });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
    };
  }, [graph]);

  // Handle selectedNodeId external updates (e.g. centering when clicked outside)
  useEffect(() => {
    if (sigmaRef.current) {
      sigmaRef.current.refresh();
    }
  }, [selectedNodeId, hoveredNodeId]);

  const zoomIn = useCallback(() => {
    sigmaRef.current?.getCamera().animatedZoom({ duration: 200 });
  }, []);

  const zoomOut = useCallback(() => {
    sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 });
  }, []);

  const resetZoom = useCallback(() => {
    sigmaRef.current?.getCamera().animatedReset({ duration: 300 });
    onNodeClick(null);
  }, [onNodeClick]);

  const runLayout = useCallback(() => {
    if (!graph) return;
    setIsLayoutRunning(true);
    try {
      forceAtlas2(graph, {
        iterations: 80,
        settings: { gravity: 1.0 }
      });
      noverlap.assign(graph, { maxIterations: 40 });
      sigmaRef.current?.refresh();
      sigmaRef.current?.getCamera().animatedReset({ duration: 400 });
    } catch (err) {
      console.warn('Re-layout failed:', err);
    }
    setIsLayoutRunning(false);
  }, [graph]);

  return {
    containerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    runLayout,
    isLayoutRunning,
  };
}
