import React, { useMemo } from 'react';
import { ChevronDown, Folder, FolderOpen, FileCode2 } from 'lucide-react';
import type { Finding } from '../../types';
import { getRelativePath } from './utils';

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  indices?: number[];
  children?: Record<string, TreeNode>;
}

interface FileTreeProps {
  projectName: string | null;
  findings: Finding[];
  searchedAndFilteredFindings: Finding[];
  selectedFilePath: string | null;
  onSelectFilePath: (path: string | null) => void;
  targetPath: string | null;
  expandedFolders?: Record<string, boolean>;
  onToggleFolder?: (path: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  projectName,
  findings,
  searchedAndFilteredFindings,
  selectedFilePath,
  onSelectFilePath,
  targetPath,
  expandedFolders = {},
  onToggleFolder = () => {},
}) => {
  const fileTree = useMemo(() => {
    const root: TreeNode = {
      name: projectName || 'Project',
      type: 'folder',
      path: '',
      children: {},
    };

    searchedAndFilteredFindings.forEach((finding) => {
      const relPath = getRelativePath(finding.file, targetPath);
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

  const getHighestSeverity = (node: TreeNode): 'error' | 'warning' | 'info' | null => {
    if (node.type === 'file') {
      let highest: 'error' | 'warning' | 'info' | null = null;
      node.indices?.forEach(idx => {
        const f = findings[idx];
        if (!f) return;
        const sev = (f.severity || '').toLowerCase();
        if (sev === 'error') highest = 'error';
        else if (sev === 'warning' && highest !== 'error') highest = 'warning';
        else if (sev === 'info' && !highest) highest = 'info';
      });
      return highest;
    }
    
    let highest: 'error' | 'warning' | 'info' | null = null;
    if (node.children) {
      Object.values(node.children).forEach(child => {
        const childSev = getHighestSeverity(child);
        if (childSev === 'error') highest = 'error';
        else if (childSev === 'warning' && highest !== 'error') highest = 'warning';
        else if (childSev === 'info' && !highest) highest = 'info';
      });
    }
    return highest;
  };

  const renderTreeNode = (node: TreeNode, depth = 0): React.ReactNode => {
    const indent = depth * 20;
    const severity = getHighestSeverity(node);

    if (node.type === 'file') {
      const findingsCount = node.indices?.length || 0;
      const isActive = selectedFilePath && node.path.replace(/\\/g, '/') === selectedFilePath.replace(/\\/g, '/');
      const badgeBg = severity === 'error'
        ? 'bg-error/15 text-error'
        : severity === 'warning'
        ? 'bg-warning/15 text-warning'
        : null;

      return (
        <div
          key={node.path}
          style={{ paddingLeft: `${indent + 18}px` }}
          onClick={() => onSelectFilePath(node.path)}
          className={`flex items-center gap-4 h-[26px] pr-4 text-[12px] font-mono rounded cursor-pointer transition-all ${
            isActive
              ? 'bg-accent/10 border-l-2 border-accent text-text-primary'
              : 'hover:bg-bg-tertiary/50 text-text-primary/90 hover:text-text-primary'
          }`}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-[14px] h-[14px] shrink-0" />
            <div className="flex items-center gap-1 min-w-0">
              <FileCode2 className="h-4 w-4 shrink-0 text-text-tertiary" />
              <span className="truncate">{node.name}</span>
            </div>
          </div>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-md text-xs font-mono font-semibold leading-none ${badgeBg || 'text-text-tertiary'}`}>
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

      const folderColorClass = 'text-warning/80';

      const folderElement = !isRoot && (
        <div
          key={node.path}
          style={{ paddingLeft: `${indent + 18}px` }}
          onClick={() => onToggleFolder(node.path)}
          className="flex items-center gap-4 h-[26px] pr-4 text-[12px] font-mono rounded cursor-pointer text-text-primary/90 hover:text-text-primary hover:bg-bg-tertiary/50 transition-all"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <ChevronDown className={`h-[14px] w-[14px] shrink-0 text-text-tertiary transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
            <div className="flex items-center gap-1 min-w-0">
              {isExpanded ? <FolderOpen className={`h-4 w-4 shrink-0 ${folderColorClass}`} /> : <Folder className={`h-4 w-4 shrink-0 ${folderColorClass}`} />}
              <span className="truncate">{node.name}</span>
            </div>
          </div>
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

  return <>{renderTreeNode(fileTree)}</>;
};