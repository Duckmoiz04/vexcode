import type { Finding, Report } from '../../types';
import type { DashboardStats } from './dashboardTypes';
import { classifyFinding } from '../../utils/categories';

export { classifyFinding };

export const getRelativePath = (absolutePath: string, targetPath: string | null | undefined): string => {
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

export function computeDashboardStats(
  findings: Finding[],
  report: Report | null
): DashboardStats {
  let security = 0;
  let reliability = 0;
  let performance = 0;
  let maintainability = 0;

  findings.forEach((f) => {
    const category = classifyFinding(f);
    if (category === 'security') security++;
    else if (category === 'reliability') reliability++;
    else if (category === 'performance') performance++;
    else if (category === 'maintainability') maintainability++;
  });

  const errors = findings.filter(f => (f.severity || '').toLowerCase() === 'error').length;
  const warnings = findings.filter(f => (f.severity || '').toLowerCase() === 'warning').length;
  const infos = findings.filter(f => (f.severity || '').toLowerCase() === 'info').length;

  const categoryDeductions = {
    security: 0,
    quality: 0,
    architecture: 0,
    maintainability: 0
  };

  findings.forEach(f => {
    const category = classifyFinding(f) as keyof typeof categoryDeductions;
    const severity = (f.severity || '').toLowerCase();
    let deduction = 0;
    if (severity === 'error') deduction = 15;
    else if (severity === 'warning') deduction = 5;
    else if (severity === 'info') deduction = 1;

    if (categoryDeductions[category] !== undefined) {
      categoryDeductions[category] += deduction;
    }
  });

  const weights = {
    security: 0.40,
    quality: 0.30,
    architecture: 0.15,
    maintainability: 0.15
  };

  let totalDeduction = 0;
  for (const c in categoryDeductions) {
    const cat = c as keyof typeof categoryDeductions;
    totalDeduction += categoryDeductions[cat] * weights[cat];
  }

  const healthScore = Math.max(0, Math.round(100 - totalDeduction));

  // Top affected files
  const fileCounts: Record<string, number> = {};
  findings.forEach(f => {
    fileCounts[f.file] = (fileCounts[f.file] || 0) + 1;
  });
  const topFiles = Object.keys(fileCounts)
    .map(file => ({ file, count: fileCounts[file] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Top risky symbols
  const symbolsMap = new Map();
  findings.forEach(f => {
    if (f.ast_context && f.ast_context.symbol_name) {
      const symName = f.ast_context.symbol_name;
      const key = `${symName}@${f.file}`;
      const blastRadiusList = f.ast_context.blast_radius || [];

      if (!symbolsMap.has(key)) {
        symbolsMap.set(key, {
          name: symName,
          file: f.file,
          blastCount: blastRadiusList.length,
          blastRadius: blastRadiusList,
          issuesCount: 0
        });
      }
      symbolsMap.get(key).issuesCount++;
    }
  });

  const topSymbols = Array.from(symbolsMap.values())
    .sort((a, b) => b.blastCount - a.blastCount)
    .slice(0, 5);

  // Parse complexity metrics
  const filesMetrics = report?.metrics?.files || {};
  const metricFilesList = Object.keys(filesMetrics);

  let totalComplexity = 0;
  let totalCognitive = 0;
  let avgComplexity = 0;
  let avgCognitive = 0;

  if (metricFilesList.length > 0) {
    metricFilesList.forEach(file => {
      totalComplexity += filesMetrics[file].complexity || 0;
      totalCognitive += filesMetrics[file].cognitive_complexity || 0;
    });
    avgComplexity = Math.round(totalComplexity / metricFilesList.length);
    avgCognitive = Math.round(totalCognitive / metricFilesList.length);
  }

  const topComplexFiles = Object.keys(filesMetrics)
    .map(file => ({
      file,
      complexity: filesMetrics[file].complexity || 0,
      cognitive: filesMetrics[file].cognitive_complexity || 0,
      level: filesMetrics[file].level || 'LOW',
      loc: filesMetrics[file].loc || 0
    }))
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 4);

  return {
    security,
    reliability,
    performance,
    maintainability,
    errors,
    warnings,
    infos,
    healthScore,
    topFiles,
    topSymbols,
    avgComplexity,
    avgCognitive,
    topComplexFiles
  };
}