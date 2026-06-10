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

export const classifyFinding = (finding: Finding): string => {
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
