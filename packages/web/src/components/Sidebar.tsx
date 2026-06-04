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
  filterSeverity: 'all' | 'error' | 'warning' | 'info';
  setFilterSeverity: (sev: 'all' | 'error' | 'warning' | 'info') => void;
  filterCategory: 'all' | 'security' | 'quality' | 'maintainability' | 'architecture';
  setFilterCategory: (cat: 'all' | 'security' | 'quality' | 'maintainability' | 'architecture') => void;
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
  findings,
  selectedFilePath,
  onSelectFilePath,
  targetPath,
  searchQuery,
  setSearchQuery,
  filterSeverity,
  setFilterSeverity,
  filterCategory,
  setFilterCategory,
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
      if (filterSeverity !== 'all') {
        if ((finding.severity || '').toLowerCase() !== filterSeverity) {
          return false;
        }
      }

      // 3. Category filter
      if (filterCategory !== 'all') {
        if (classifyFinding(finding) !== filterCategory) {
          return false;
        }
      }

      return true;
    });
  }, [findings, searchQuery, filterSeverity, filterCategory]);

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

  return (
    <div className="w-80 min-w-80 bg-bg-primary border-r border-card-border flex flex-col h-full overflow-hidden">
      {/* Explorer / File Tree Section */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Title, Stats Counter and Filter Controls */}
        <div className="px-4 py-3 border-b border-card-border/50 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary">Explorer</h3>
            <span className="text-[10px] font-mono text-text-tertiary bg-bg-secondary px-2 py-0.5 rounded border border-card-border/40">
              {searchedAndFilteredFindings.length} / {findings.length}
            </span>
          </div>

          {/* Keyword Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm lỗi, tệp..."
              className="w-full bg-bg-secondary border border-card-border/60 rounded-lg pl-7.5 pr-7.5 py-1 text-[11px] text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary font-medium"
            />
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-tertiary" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filter Options Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Severity Filter Dropdown */}
            <select
              value={filterSeverity}
              onChange={(e: any) => setFilterSeverity(e.target.value)}
              className="w-full bg-bg-secondary border border-card-border/60 rounded-lg px-2 py-1 text-[10px] font-semibold text-text-secondary outline-none focus:border-accent cursor-pointer transition-all"
            >
              <option value="all">Mọi mức độ</option>
              <option value="error">🔴 Error</option>
              <option value="warning">🟡 Warning</option>
              <option value="info">🔵 Info</option>
            </select>

            {/* Category Filter Dropdown */}
            <select
              value={filterCategory}
              onChange={(e: any) => setFilterCategory(e.target.value)}
              className="w-full bg-bg-secondary border border-card-border/60 rounded-lg px-2 py-1 text-[10px] font-semibold text-text-secondary outline-none focus:border-accent cursor-pointer transition-all"
            >
              <option value="all">Mọi nhóm</option>
              <option value="security">🛡️ Security</option>
              <option value="quality">🐞 Quality</option>
              <option value="maintainability">⚙️ Maintainability</option>
              <option value="architecture">🏗️ Architecture</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {findings.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-6">No files indexed</div>
          ) : searchedAndFilteredFindings.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-6 italic">No matching files found</div>
          ) : (
            renderTreeNode(fileTree)
          )}
        </div>
      </div>
    </div>
  );
};
