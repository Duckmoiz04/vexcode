import React, { useState, useMemo } from 'react';
import { ChevronDown, Folder, File } from 'lucide-react';
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
}

export const FileTree: React.FC<FileTreeProps> = ({
  projectName,
  findings,
  searchedAndFilteredFindings,
  selectedFilePath,
  onSelectFilePath,
  targetPath,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const currentVal = prev[path] !== false;
      return { ...prev, [path]: !currentVal };
    });
  };

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

  const renderTreeNode = (node: TreeNode, depth = 0): React.ReactNode => {
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
          <div className="w-4 h-4 shrink-0" />
          <File className="h-4 w-4 shrink-0 text-info" />
          <span className="truncate flex-1">{node.name}</span>
          <span className="px-1.5 py-0.2 bg-bg-tertiary text-text-tertiary rounded text-xs font-sans border border-card-border">
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

  return <>{renderTreeNode(fileTree)}</>;
};