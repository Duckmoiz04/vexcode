import React, { useMemo } from 'react';
import { AlertTriangle, ShieldCheck, Cpu, Layout, Info } from 'lucide-react';

interface DashboardPageProps {
  report: any;
  currentProject: string | null;
  findings: any[];
  onSelectFilePath: (path: string | null) => void;
  onSelectFindingIndex: (index: number | null) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  report,
  currentProject,
  findings,
  onSelectFilePath,
  onSelectFindingIndex,
}) => {

  const getRelativePath = (absolutePath: string) => {
    if (!absolutePath) return '';
    const targetPath = report?.target_path;
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

  const stats = useMemo(() => {
    let security = 0;
    let quality = 0;
    let architecture = 0;
    let maintainability = 0;

    findings.forEach((f) => {
      const category = classifyFinding(f);
      if (category === 'security') security++;
      else if (category === 'quality') quality++;
      else if (category === 'architecture') architecture++;
      else if (category === 'maintainability') maintainability++;
    });

    const errors = findings.filter(f => (f.severity || '').toLowerCase() === 'error').length;
    const warnings = findings.filter(f => (f.severity || '').toLowerCase() === 'warning').length;
    const infos = findings.filter(f => (f.severity || '').toLowerCase() === 'info').length;

    // Deductions
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
      quality,
      architecture,
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
  }, [findings, report]);

  // Donut SVG Calculations
  const donutSegments = useMemo(() => {
    const total = stats.errors + stats.warnings + stats.infos;
    if (total === 0) return [];
    
    const errPct = (stats.errors / total) * 100;
    const warnPct = (stats.warnings / total) * 100;
    const infoPct = (stats.infos / total) * 100;

    let offset = 25; // 12 o'clock starting position

    const segments = [];
    if (errPct > 0) {
      segments.push({ color: 'var(--color-danger)', percent: errPct, offset });
      offset -= errPct;
    }
    if (warnPct > 0) {
      segments.push({ color: 'var(--color-warning)', percent: warnPct, offset });
      offset -= warnPct;
    }
    if (infoPct > 0) {
      segments.push({ color: 'var(--color-info)', percent: infoPct, offset });
    }

    return segments;
  }, [stats]);

  // Circular progress stroke-dashoffset
  const healthDashOffset = 251.2 - (251.2 * stats.healthScore) / 100;
  const healthColor = stats.healthScore >= 90 
    ? 'var(--color-success)' 
    : stats.healthScore >= 70 
    ? 'var(--color-warning)' 
    : 'var(--color-danger)';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-bg-secondary">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between pb-4 border-b border-card-border">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Scan Summary</h3>
        <span className="text-xs text-accent font-mono bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
          {report?._project || currentProject || 'Project'}
        </span>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Issues */}
        <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
          <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <span>Total Issues</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">{findings.length}</div>
          <div className="text-[10px] text-text-tertiary mt-1">Overall findings identified</div>
        </div>

        {/* Security */}
        <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
          <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-danger animate-pulse" />
            <span>Security</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">{stats.security}</div>
          <div className="text-[10px] text-text-tertiary mt-1">Vulnerabilities & secrets</div>
        </div>

        {/* Quality */}
        <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
          <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
            <Cpu className="h-4 w-4 text-warning" />
            <span>Quality</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">{stats.quality}</div>
          <div className="text-[10px] text-text-tertiary mt-1">Logic bugs & code defects</div>
        </div>

        {/* Architecture */}
        <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
          <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
            <Layout className="h-4 w-4 text-info" />
            <span>Architecture</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">{stats.architecture}</div>
          <div className="text-[10px] text-text-tertiary mt-1">AST & call flow insights</div>
        </div>

        {/* Maintainability */}
        <div className="p-4 rounded-xl border border-card-border bg-card-bg backdrop-blur-md">
          <div className="flex items-center gap-2 text-text-secondary mb-2 text-xs font-semibold">
            <Info className="h-4 w-4 text-success" />
            <span>Maintainability</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-text-primary">{stats.maintainability}</div>
            {stats.avgComplexity > 0 && (
              <span className="text-[10px] font-mono text-text-secondary">
                (Avg CCN: {stats.avgComplexity})
              </span>
            )}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">
            {stats.avgComplexity > 0 ? `Avg Cognitive: ${stats.avgCognitive}` : 'Style & complexity issues'}
          </div>
        </div>
      </div>

      {/* Graphs & breakdown row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Score Circular SVG */}
        <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col items-center">
          <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider self-start">Project Health Score</h4>
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg width="180" height="180" viewBox="0 0 100 100" className="-rotate-90">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-card-border)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={healthColor}
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={healthDashOffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-text-primary">{stats.healthScore}</span>
              <span className="text-[10px] text-text-secondary uppercase font-semibold">Score</span>
            </div>
          </div>
        </div>

        {/* Severity Distribution Donut SVG */}
        <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col items-center">
          <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider self-start">Severity Distribution</h4>
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg width="180" height="180" viewBox="0 0 42 42" className="donut-chart">
              <circle cx="21" cy="21" r="15.915" fill="transparent" />
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-card-border)" strokeWidth="3" />
              {donutSegments.map((seg, idx) => (
                <circle
                  key={idx}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth="4.5"
                  strokeDasharray={`${seg.percent} ${100 - seg.percent}`}
                  strokeDashoffset={seg.offset}
                  className="transition-all duration-500 ease-out"
                />
              ))}
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-text-primary">
                {stats.errors + stats.warnings + stats.infos}
              </span>
              <span className="text-[10px] text-text-secondary uppercase font-semibold">Issues</span>
            </div>
          </div>
        </div>

        {/* Categories breakdown progress bars */}
        <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col justify-start">
          <h4 className="text-xs font-bold text-text-secondary mb-4 uppercase tracking-wider">Criteria Category Audit</h4>
          <div className="space-y-4">
            {[
              { id: 'security', name: 'Security & Secrets', icon: <ShieldCheck className="h-4 w-4 text-danger shrink-0" />, count: stats.security },
              { id: 'quality', name: 'Code Quality & Reliability', icon: <Cpu className="h-4 w-4 text-warning shrink-0" />, count: stats.quality },
              { id: 'architecture', name: 'AST & Call Flow', icon: <Layout className="h-4 w-4 text-info shrink-0" />, count: stats.architecture },
              { id: 'maintainability', name: 'Style & Maintainability', icon: <Info className="h-4 w-4 text-success shrink-0" />, count: stats.maintainability }
            ].map(cat => {
              const totalCount = findings.length;
              const pct = totalCount > 0 ? (cat.count / totalCount) * 100 : 0;
              return (
                <div key={cat.id} className="text-xs">
                  <div className="flex justify-between text-text-secondary mb-1">
                    <span className="font-semibold text-text-primary flex items-center gap-1.5">
                      {cat.icon}
                      <span>{cat.name}</span>
                    </span>
                    <span className="font-mono">{cat.count} issue(s)</span>
                  </div>
                  <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        cat.id === 'security' ? 'bg-danger' : cat.id === 'quality' ? 'bg-warning' : cat.id === 'architecture' ? 'bg-info' : 'bg-success'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Affected Files */}
        <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col col-span-1">
          <h4 className="text-xs font-bold text-text-secondary mb-3 uppercase tracking-wider">Top Affected Files</h4>
          <div className="space-y-2 flex-1">
            {stats.topFiles.length === 0 ? (
              <div className="text-xs text-text-tertiary py-4 text-center">No affected files</div>
            ) : (
              stats.topFiles.map((sf) => (
                <div
                  key={sf.file}
                  onClick={() => onSelectFilePath(sf.file)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-bg-primary/40 hover:bg-bg-primary/80 border border-card-border/40 cursor-pointer transition-all"
                >
                  <span className="text-[11px] font-mono text-text-primary truncate pr-4" title={sf.file}>
                    {getRelativePath(sf.file)}
                  </span>
                  <span className="text-[10px] text-accent shrink-0 font-semibold">{sf.count} issue(s)</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Complex Files */}
        <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col col-span-1">
          <h4 className="text-xs font-bold text-text-secondary mb-3 uppercase tracking-wider">Top Complex Files</h4>
          <div className="space-y-2 flex-1">
            {stats.topComplexFiles.length === 0 ? (
              <div className="text-xs text-text-tertiary py-4 text-center">No complexity metrics available</div>
            ) : (
              stats.topComplexFiles.map((cf) => {
                const badgeColor = cf.level === 'HIGH'
                  ? 'text-danger bg-danger/10 border-danger/20'
                  : cf.level === 'MEDIUM'
                  ? 'text-warning bg-warning/10 border-warning/20'
                  : 'text-success bg-success/10 border-success/20';
                return (
                  <div
                    key={cf.file}
                    onClick={() => onSelectFilePath(cf.file)}
                    className="flex flex-col p-2 bg-bg-primary/40 hover:bg-bg-primary/80 border border-card-border/40 rounded-lg cursor-pointer transition-all gap-1"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[11px] font-mono text-text-primary truncate pr-2" title={cf.file}>
                        {getRelativePath(cf.file)}
                      </span>
                      <span className={`text-[9px] border px-1.5 py-0.5 rounded font-semibold shrink-0 ${badgeColor}`}>
                        CCN: {cf.complexity}
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-text-tertiary font-mono">
                      <span>LOC: {cf.loc}</span>
                      <span>Cognitive: {cf.cognitive}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Risky Symbols (Blast radius) */}
        <div className="p-5 rounded-xl border border-card-border bg-card-bg backdrop-blur-md flex flex-col col-span-1">
          <h4 className="text-xs font-bold text-text-secondary mb-3 uppercase tracking-wider">Top Risky Symbols</h4>
          <div className="space-y-3 flex-1">
            {stats.topSymbols.length === 0 ? (
              <div className="text-xs text-text-tertiary py-4 text-center">No risky symbols identified</div>
            ) : (
              stats.topSymbols.map((sym) => {
                const affectedDetails = sym.blastRadius.length > 0
                  ? `Blast: ${sym.blastRadius.slice(0, 2).map((br: any) => br.name).join(', ')}${sym.blastRadius.length > 2 ? '...' : ''}`
                  : 'No affected symbols';
                return (
                  <div
                    key={`${sym.name}@${sym.file}`}
                    className="flex flex-col p-2.5 rounded-lg bg-bg-primary/40 border border-card-border/40 text-xs text-text-secondary gap-1"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-mono font-bold text-text-primary text-[11px] truncate pr-2">{sym.name}</span>
                      <span className="text-[9px] bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-accent font-semibold shrink-0">
                        {sym.blastCount} affected
                      </span>
                    </div>
                    <div className="text-[10px] text-text-tertiary font-mono truncate">{getRelativePath(sym.file)}</div>
                    <div className="text-[10px] text-text-secondary truncate">{affectedDetails}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
