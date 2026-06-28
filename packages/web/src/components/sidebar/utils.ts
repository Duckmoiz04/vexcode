import type { Finding } from '../../types';

export const getFileLanguage = (filePath: string): string => {
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

export const getRelativePath = (absolutePath: string, targetPath: string | null): string => {
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
