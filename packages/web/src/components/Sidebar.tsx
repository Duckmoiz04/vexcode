import React, { useState, useMemo } from 'react';
import { ChevronDown, Folder, File, ShieldAlert, X } from 'lucide-react';

interface SidebarProps {
  projectName: string | null;
  reports: any[];
  currentReportId: string | null;
  onSelectReportId: (id: string) => void;
  findings: any[];
  selectedFindingIndex: number | null;
  onSelectFindingIndex: (index: number | null) => void;
  selectedFilePath: string | null;
  onSelectFilePath: (path: string | null) => void;
  targetPath: string | null;
}

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  indices?: number[];
  children?: Record<string, TreeNode>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projectName,
  reports,
  currentReportId,
  onSelectReportId,
  findings,
  selectedFindingIndex,
  onSelectFindingIndex,
  selectedFilePath,
  onSelectFilePath,
  targetPath,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const currentVal = prev[path] !== false; // defaults to true
      return { ...prev, [path]: !currentVal };
    });
  };

  // Helper to strip target path prefix
  const getRelativePath = (absolutePath: string) => {
    if (!absolutePath) return '';
    if (!targetPath) return absolutePath;
    const abs = absolutePath.replace(/\\/g, '/');
    const target = targetPath.replace(/\\/g, '/');
    if (abs.startsWith(target)) {
      let rel = abs.slice(target.length);
      if (rel.startsWith('/')) rel = rel.slice(1);
      return rel || '.';
    }
    return abs;
  };

  // Build File Tree
  const fileTree = useMemo(() => {
    const root: TreeNode = {
      name: projectName || 'Project',
      type: 'folder',
      path: '',
      children: {},
    };

    findings.forEach((finding, index) => {
      const relPath = getRelativePath(finding.file);
      const parts = relPath.split('/');
      let current = root;
      let accumulatedPath = '';

      parts.forEach((part, i) => {
        accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
        const isLast = i === parts.length - 1;

        if (isLast) {
          if (!current.children) current.children = {};
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              type: 'file',
              path: finding.file,
              indices: [],
            };
          }
          current.children[part].indices?.push(index);
        } else {
          if (!current.children) current.children = {};
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              type: 'folder',
              path: accumulatedPath,
              children: {},
            };
          }
          current = current.children[part];
        }
      });
    });

    return root;
  }, [findings, projectName, targetPath]);

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const indent = depth * 12;
    if (node.type === 'file') {
      const findingsCount = node.indices?.length || 0;
      const isActive = selectedFilePath && node.path.replace(/\\/g, '/') === selectedFilePath.replace(/\\/g, '/');
      return (
        <div
          key={node.path}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => onSelectFilePath(node.path)}
          className={`flex items-center gap-2 py-1.5 pr-3 text-[11px] font-medium font-mono rounded cursor-pointer transition-all ${
            isActive
              ? 'bg-accent/10 border-l-2 border-accent text-text-primary'
              : 'hover:bg-bg-tertiary/50 text-text-secondary hover:text-text-primary'
          }`}
        >
          <div className="w-3 h-3 shrink-0" /> {/* Spacer to align with ChevronDown */}
          <File className="h-3.5 w-3.5 shrink-0 text-info" />
          <span className="truncate flex-1">{node.name}</span>
          <span className="px-1.5 py-0.2 bg-bg-tertiary text-text-tertiary rounded text-[9px] font-sans border border-card-border">
            {findingsCount}
          </span>
        </div>
      );
    } else {
      const isRoot = node.path === '';
      const isExpanded = isRoot || expandedFolders[node.path] !== false;
      const childKeys = Object.keys(node.children || {}).sort((a, b) => {
        const nodeA = node.children![a];
        const nodeB = node.children![b];
        if (nodeA.type !== nodeB.type) {
          return nodeA.type === 'folder' ? -1 : 1;
        }
        return a.localeCompare(b);
      });

      const folderElement = !isRoot && (
        <div
          key={node.path}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => toggleFolder(node.path)}
          className="flex items-center gap-2 py-1.5 pr-3 text-[11px] font-medium rounded cursor-pointer text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 transition-all"
        >
          <ChevronDown className={`h-3 w-3 shrink-0 text-text-tertiary transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
          <Folder className="h-3.5 w-3.5 shrink-0 text-warning/80" />
          <span className="truncate flex-1">{node.name}</span>
        </div>
      );

      return (
        <div key={node.path || 'root'} className="w-full">
          {folderElement}
          <div className={`${isExpanded ? 'block' : 'hidden'} w-full`}>
            {childKeys.map((key) => renderTreeNode(node.children![key], isRoot ? depth : depth + 1))}
          </div>
        </div>
      );
    }
  };

  // Filter findings based on selected file path
  const filteredFindings = useMemo(() => {
    if (!selectedFilePath) return findings;
    return findings.filter((f) => f.file === selectedFilePath);
  }, [findings, selectedFilePath]);

  return (
    <div className="w-80 min-w-80 bg-bg-primary border-r border-card-border flex flex-col h-full overflow-hidden">
      {/* Scan Version Dropdown Section */}
      <div className="p-4 border-b border-card-border">
        <h3 className="text-xs font-semibold text-text-secondary mb-2">Scan Version</h3>
        <div className="relative">
          <select
            value={currentReportId || ''}
            onChange={(e) => onSelectReportId(e.target.value)}
            className="w-full bg-bg-tertiary text-text-primary border border-card-border rounded-lg px-3 py-1.5 text-xs font-mono outline-none cursor-pointer focus:border-accent transition-all appearance-none"
          >
            {reports.map((r) => {
              const timeStr = r.id
                .replace('report_', '')
                .replace(/-/g, (m: string, i: number) => (i > 10 ? ':' : i > 7 ? '-' : ' '));
              return (
                <option key={r.id} value={r.id}>
                  {timeStr} ({r.findings} findings)
                </option>
              );
            })}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
        </div>
      </div>

      {/* Explorer / File Tree Section */}
      <div className="flex-1 border-b border-card-border flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-card-border/50">
          <h3 className="text-xs font-semibold text-text-secondary">Explorer</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {findings.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-6">No files indexed</div>
          ) : (
            renderTreeNode(fileTree)
          )}
        </div>
      </div>

      {/* Findings List Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-card-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-text-secondary">Findings</h3>
            <span className="px-1.5 py-0.2 bg-accent text-white rounded-full text-[10px] font-bold">
              {filteredFindings.length}
            </span>
          </div>
        </div>

        {/* Selected File Filter Bar */}
        {selectedFilePath && (
          <div className="px-4 py-2 bg-accent/5 border-b border-card-border/30 flex items-center justify-between text-xs text-text-secondary">
            <span className="truncate pr-4 font-mono text-[10px]">
              File: {getRelativePath(selectedFilePath)}
            </span>
            <button
              onClick={() => onSelectFilePath(null)}
              className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              title="Clear file filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {filteredFindings.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-8">
              No findings identified
            </div>
          ) : (
            filteredFindings.map((f) => {
              const originalIndex = findings.indexOf(f);
              const severity = (f.severity || '').toLowerCase();
              const isActive = originalIndex === selectedFindingIndex;
              const isApplied = f._applied;

              return (
                <div
                  key={originalIndex}
                  onClick={() => onSelectFindingIndex(originalIndex)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isActive
                      ? 'bg-accent/10 border-accent/40 shadow-glow-soft'
                      : 'bg-bg-tertiary/30 border-transparent hover:bg-bg-tertiary/60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        severity === 'error'
                          ? 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : severity === 'warning'
                          ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                          : 'bg-info shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                      }`}
                    />
                    <span className="text-[11px] font-mono font-semibold text-text-primary truncate flex-1">
                      {f.rule_id}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${
                        isApplied
                          ? 'bg-success/10 border-success/30 text-success'
                          : 'bg-bg-tertiary border-card-border text-text-secondary'
                      }`}
                    >
                      {isApplied ? 'Applied' : 'Pending'}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-tertiary font-mono truncate">
                    {getRelativePath(f.file)}:{f.line}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
