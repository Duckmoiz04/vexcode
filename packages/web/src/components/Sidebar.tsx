import React, { useState, useMemo } from 'react';
import { ChevronDown, Folder, File, ShieldAlert, X, Search } from 'lucide-react';

interface SidebarProps {
  projectName: string | null;
  findings: any[];
  selectedFilePath: string | null;
  onSelectFilePath: (path: string | null) => void;
  targetPath: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterSeverities: string[];
  setFilterSeverities: (sevs: string[]) => void;
  filterCategories: string[];
  setFilterCategories: (cats: string[]) => void;
  selectedFindingIndex: number | null;
  onSelectFindingIndex?: (index: number | null) => void;
  filterStatuses: string[];
  setFilterStatuses: (statuses: string[]) => void;
  filterLanguages: string[];
  setFilterLanguages: (langs: string[]) => void;
  availableLanguages: string[];
}

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  indices?: number[];
  children?: Record<string, TreeNode>;
}

const getFileLanguage = (filePath: string) => {
  if (!filePath) return 'Other';
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'Python';
    case 'js':
    case 'jsx': return 'JavaScript';
    case 'ts':
    case 'tsx': return 'TypeScript';
    case 'sh':
    case 'bash': return 'Shell';
    case 'css': return 'CSS';
    case 'html': return 'HTML';
    case 'json': return 'JSON';
    default: return 'Other';
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  projectName,
  findings,
  selectedFilePath,
  onSelectFilePath,
  targetPath,
  searchQuery,
  setSearchQuery,
  filterSeverities,
  setFilterSeverities,
  filterCategories,
  setFilterCategories,
  selectedFindingIndex,
  onSelectFindingIndex,
  filterStatuses,
  setFilterStatuses,
  filterLanguages,
  setFilterLanguages,
  availableLanguages,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'findings'>('explorer');

  
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

  // Classification helper for findings
  const classifyFinding = (finding: any) => {
    const ruleId = (finding.rule_id || '').toLowerCase();
    
    // 1. Security
    const securityKeywords = [
      'security', 'vuln', 'injection', 'xss', 'csrf', 'secret', 'key',
      'token', 'jwt', 'crypto', 'auth', 'password', 'credential', 'ssrf',
      'overflow', 'leak', 'private', 'cert', 'hash', 'ssl', 'tls'
    ];
    if (securityKeywords.some(kw => ruleId.includes(kw))) {
      return 'security';
    }

    // 2. AST & Architecture
    if (finding.ast_context && (finding.ast_context.symbol_name || (finding.ast_context.callers && finding.ast_context.callers.length > 0))) {
      return 'architecture';
    }

    // 3. Style & Maintainability
    const styleKeywords = [
      'style', 'format', 'naming', 'deprecated', 'convention', 'comment',
      'spacing', 'indent', 'unused', 'duplicate', 'complex', 'nest'
    ];
    if (styleKeywords.some(kw => ruleId.includes(kw))) {
      return 'maintainability';
    }

    // 4. Code Quality & Bugs (default)
    return 'quality';
  };

  // Searched & Filtered findings list
  const searchedAndFilteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      // 1. Search filter (match rule_id, message, or file path)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const ruleId = (finding.rule_id || '').toLowerCase();
        const message = (finding.message || '').toLowerCase();
        const file = (finding.file || '').toLowerCase();
        if (!ruleId.includes(query) && !message.includes(query) && !file.includes(query)) {
          return false;
        }
      }

      // 2. Severity filter
      if (filterSeverities.length > 0) {
        if (!filterSeverities.includes((finding.severity || '').toLowerCase())) {
          return false;
        }
      }

      // 3. Category filter
      if (filterCategories.length > 0) {
        if (!filterCategories.includes(classifyFinding(finding))) {
          return false;
        }
      }

      // 4. Status filter
      if (filterStatuses.length > 0) {
        const isApplied = !!finding._applied;
        const status = isApplied ? 'applied' : 'pending';
        if (!filterStatuses.includes(status)) {
          return false;
        }
      }

      // 5. Language filter
      if (filterLanguages.length > 0) {
        if (!filterLanguages.includes(getFileLanguage(finding.file))) {
          return false;
        }
      }

      return true;
    });
  }, [findings, searchQuery, filterSeverities, filterCategories, filterStatuses, filterLanguages]);

  // Build File Tree based on filtered findings
  const fileTree = useMemo(() => {
    const root: TreeNode = {
      name: projectName || 'Project',
      type: 'folder',
      path: '',
      children: {},
    };

    searchedAndFilteredFindings.forEach((finding) => {
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
          const originalIndex = findings.indexOf(finding);
          current.children[part].indices?.push(originalIndex);
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
  }, [searchedAndFilteredFindings, projectName, targetPath, findings]);

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
          className={`flex items-center gap-1.5 py-1 pr-1 text-[13px] font-medium font-mono rounded cursor-pointer transition-all ${
            isActive
              ? 'bg-accent/10 border-l-2 border-accent text-text-primary'
              : 'hover:bg-bg-tertiary/50 text-text-secondary hover:text-text-primary'
          }`}
        >
          <div className="w-4 h-4 shrink-0" /> {/* Spacer to align with ChevronDown */}
          <File className="h-4 w-4 shrink-0 text-info" />
          <span className="truncate flex-1">{node.name}</span>
          <span className="px-1.5 py-0.2 bg-bg-tertiary text-text-tertiary rounded text-[11px] font-sans border border-card-border">
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
          className="flex items-center gap-1.5 py-1 pr-1 text-[13px] font-medium rounded cursor-pointer text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 transition-all"
        >
          <ChevronDown className={`h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
          <Folder className="h-4 w-4 shrink-0 text-warning/80" />
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

  return (
    <div className="w-72 min-w-72 bg-[#161622] border-r border-card-border flex flex-col h-full overflow-hidden">
      {/* Explorer / Findings Tabs Header */}
      <div className="flex border-b border-card-border/50 bg-bg-secondary/40 shrink-0 px-4 pt-2 gap-3">
        <button
          onClick={() => setSidebarTab('explorer')}
          className={`pb-2 text-[13px] font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            sidebarTab === 'explorer'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Folder className="h-3.5 w-3.5" />
          <span>File Tree</span>
        </button>
        <button
          onClick={() => setSidebarTab('findings')}
          className={`pb-2 text-[13px] font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            sidebarTab === 'findings'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Findings</span>
        </button>
      </div>
 
      <div className="flex-1 flex flex-col min-h-0">
        {/* Title and Stats Counter */}
        <div className="px-4 py-2.5 border-b border-card-border/50 flex items-center justify-between shrink-0 bg-bg-secondary/10">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-text-secondary">
            {sidebarTab === 'explorer' ? 'File Structure' : 'Project Issues'}
          </h3>
          <span className="text-[11px] font-mono font-bold text-text-tertiary bg-bg-secondary px-2 py-0.5 rounded border border-card-border/40">
            {searchedAndFilteredFindings.length} / {findings.length}
          </span>
        </div>
 
        {/* Dynamic Tab Panel Content */}
        <div className={`flex-1 overflow-y-auto scrollbar-thin ${sidebarTab === 'explorer' ? 'py-2 px-1' : 'p-3'}`}>
          {findings.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-6">No data indexed</div>
          ) : searchedAndFilteredFindings.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-6 italic">No matching results found</div>
          ) : sidebarTab === 'explorer' ? (
            renderTreeNode(fileTree)
          ) : (
            <div className="space-y-2">
              {searchedAndFilteredFindings.map((f: any) => {
                const originalIndex = findings.indexOf(f);
                const isActive = originalIndex === selectedFindingIndex;
                const severity = (f.severity || '').toLowerCase();
                const isApplied = f._applied;
 
                return (
                  <div
                    key={originalIndex}
                    onClick={() => {
                      onSelectFilePath(f.file);
                      if (onSelectFindingIndex) {
                        onSelectFindingIndex(originalIndex);
                      }
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 ${
                      isActive
                        ? 'bg-accent/10 border border-accent/30 text-text-primary shadow-sm'
                        : 'bg-bg-tertiary/20 border border-card-border/30 hover:bg-bg-tertiary/40 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          severity === 'error'
                            ? 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                            : severity === 'warning'
                            ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'bg-info shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                        }`}
                      />
                      <span className="text-[13px] font-mono font-semibold truncate flex-1 leading-none text-text-primary">
                        {f.rule_id.split('.').pop() || f.rule_id}
                      </span>
                      {isApplied && (
                        <span className="text-[11px] px-1.5 py-0.5 bg-success/15 border border-success/30 text-success rounded font-bold font-sans uppercase">
                          applied
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] font-mono text-text-tertiary flex items-center justify-between">
                      <span className="truncate pr-2 font-medium">{f.file.split(/[\\/]/).pop()}</span>
                      <span className="shrink-0">Line {f.line}</span>
                    </div>
                    <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-2 select-none font-sans mt-0.5">
                      {f.message}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
