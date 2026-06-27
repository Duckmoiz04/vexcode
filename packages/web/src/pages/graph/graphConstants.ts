export const NODE_COLORS = {
  // Dependency view types
  file: '#3b82f6',          // Blue
  function: '#10b981',      // Emerald
  class: '#f59e0b',         // Amber
  unknownSymbol: '#64748b',   // Slate
  
  // Severity-based styling
  error: '#f87171',         // Muted Red
  warning: '#fbbf24',       // Muted Yellow
  info: '#60a5fa',          // Muted Blue
  
  // Dataflow specific nodes
  source: '#34d399',        // Emerald green
  propagator: '#22d3ee',    // Cyan
  sink: '#fb7185',          // Rose pink
  
  // General dim state for unselected elements
  dimmed: '#1e293b',
  dimmedText: '#475569',
};

export const EDGE_COLORS = {
  calls: '#8b5cf6',         // Violet for Call relationship
  blastRadius: '#ec4899',    // Pink for Blast Radius/impact relation
  dataflow: '#f43f5e',      // Rose for Taint flow trace
  contains: '#475569',      // Dark slate for structural containment
  dimmed: '#334155',        // Very dark grey for backgrounded edges
};

export const NODE_SIZES = {
  file: 14,
  function: 9,
  class: 11,
  finding: 7,
  
  // Dataflow view sizes
  source: 12,
  propagator: 8,
  sink: 12,
};
