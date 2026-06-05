import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { CodeInspector } from './components/CodeInspector';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Onboarding } from './components/Onboarding';
import { Search, X, RotateCcw, AlertOctagon, AlertTriangle, Info, Shield, Bug, Wrench, Layout, Clock, CheckCircle2, Terminal, ChevronDown, Filter } from 'lucide-react';

export const App: React.FC = () => {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<any | null>(null);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'issues'>('dashboard');
  
  // Lifted filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverities, setFilterSeverities] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterLanguages, setFilterLanguages] = useState<string[]>([]);

  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    severity: true,
    category: true,
    status: true,
    language: true,
  });

  const toggleFilterSection = (section: string) => {
    setExpandedFilters(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Classification helper for findings (lifted from Sidebar)
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

  // Helper to extract file language dynamically
  const getFileLanguage = useCallback((filePath: string) => {
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
  }, []);

  // Compute unique languages present in the current report's findings
  const availableLanguages = useMemo(() => {
    const rawFindings = currentReport?.findings || [];
    const langs = new Set<string>();
    rawFindings.forEach((f: any) => {
      langs.add(getFileLanguage(f.file));
    });
    return Array.from(langs).sort();
  }, [currentReport, getFileLanguage]);

  // Compute total counts dynamically for visual checkboxes
  const filterCounts = useMemo(() => {
    const raw = currentReport?.findings || [];
    const counts = {
      severity: { error: 0, warning: 0, info: 0 },
      category: { security: 0, quality: 0, maintainability: 0, architecture: 0 },
      status: { pending: 0, applied: 0 },
      language: {} as Record<string, number>
    };

    raw.forEach((f: any) => {
      const sev = (f.severity || '').toLowerCase();
      if (sev in counts.severity) {
        counts.severity[sev as keyof typeof counts.severity]++;
      }

      const cat = classifyFinding(f);
      if (cat in counts.category) {
        counts.category[cat as keyof typeof counts.category]++;
      }

      const status = f._applied ? 'applied' : 'pending';
      counts.status[status]++;

      const lang = getFileLanguage(f.file);
      counts.language[lang] = (counts.language[lang] || 0) + 1;
    });

    return counts;
  }, [currentReport, getFileLanguage]);

  // Searched & Filtered findings list
  const searchedAndFilteredFindings = useMemo(() => {
    const rawFindings = currentReport?.findings || [];
    return rawFindings.filter((finding: any) => {
      // 1. Search filter
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
  }, [currentReport, searchQuery, filterSeverities, filterCategories, filterStatuses, filterLanguages, getFileLanguage]);


  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<any>(null);

  // Scanning status
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Initializing scan...');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Scan timer and log history states
  const [elapsedTime, setElapsedTime] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // Format seconds to mm:ss format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Scan timer effect
  useEffect(() => {
    let timer: any = null;
    if (isScanning) {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isScanning]);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load list of projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      showToast('Error loading projects list', 'error');
    }
  }, [showToast]);

  // Load LLM configuration from .env
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data || {});
    } catch (err) {
      console.error('Failed to load configuration:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadConfig();
  }, [loadProjects, loadConfig]);

  // Load report list for selected project
  const loadHistory = useCallback(async (project: string, autoSelectLatest = true) => {
    try {
      const res = await fetch(`/api/reports/${project}`);
      const data = await res.json();
      if (data.success) {
        const reportList = data.reports || [];
        setReports(reportList);
        if (autoSelectLatest && reportList.length > 0) {
          setCurrentReportId(reportList[0].id);
        }
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error('Failed to load project history:', err);
      showToast('Error loading project reports history', 'error');
    }
  }, [showToast]);

  // Load specific report content
  const loadReport = useCallback(async (project: string, reportId: string) => {
    try {
      const res = await fetch(`/api/report/${project}/${reportId}`);
      const data = await res.json();
      setCurrentReport(data || null);
      setSelectedFindingIndex(null);
      setSelectedFilePath(null);
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Failed to load report:', err);
      showToast('Error loading report data', 'error');
    }
  }, [showToast]);

  // Watch currentReportId changes to load report details
  useEffect(() => {
    if (currentProject && currentReportId) {
      loadReport(currentProject, currentReportId);
    } else {
      setCurrentReport(null);
    }
  }, [currentProject, currentReportId, loadReport]);

  const handleSelectProject = async (project: string | null) => {
    setCurrentProject(project);
    setCurrentReportId(null);
    setCurrentReport(null);
    setSelectedFindingIndex(null);
    setSelectedFilePath(null);
    setActiveTab('dashboard');

    if (project) {
      await loadHistory(project);
    }
  };

  const handleCancelScan = async () => {
    try {
      setScanStatus('Cancelling scan...');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      await fetch('/api/scan/cancel', { method: 'POST' });
      setIsScanning(false);
      showToast('Scan cancelled by user', 'error');
    } catch (err: any) {
      console.error('Failed to cancel scan:', err);
    }
  };

  const handleStartScan = async (targetPath: string, mockScan = false, mockAi = false, fastScan = false) => {
    setIsScanning(true);
    setScanStatus('Starting scan connection...');
    setScanLogs(['[SYSTEM] Starting scan process...']);
    
    // Construct query parameters
    const params = new URLSearchParams({
      targetPath: targetPath || '',
      mockScan: mockScan.toString(),
      mockAi: mockAi.toString(),
      fastScan: fastScan.toString()
    });
    
    // Close existing event source if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const eventSource = new EventSource(`/api/scan/stream?${params.toString()}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          setScanStatus(data.message);
          setScanLogs((prev) => {
            if (prev.length > 0 && prev[prev.length - 1] === data.message) {
              return prev;
            }
            const nextLogs = [...prev, data.message];
            if (nextLogs.length > 4) {
              return nextLogs.slice(nextLogs.length - 4);
            }
            return nextLogs;
          });
        } else if (data.type === 'complete' && data.report) {
          setScanLogs((prev) => [...prev, '[SYSTEM] Analysis complete! Packaging report data...']);
          eventSource.close();
          eventSourceRef.current = null;
          const projName = data.report._project;
          const reportId = data.report._id;
          
          await loadProjects();
          setCurrentProject(projName);
          await loadHistory(projName, false);
          setCurrentReportId(reportId);
          setIsScanning(false);
          showToast('Scan completed successfully!');
        } else if (data.type === 'error') {
          setScanLogs((prev) => [...prev, `[ERROR] Scan failed: ${data.error || 'Scan execution failed'}`]);
          eventSource.close();
          eventSourceRef.current = null;
          setIsScanning(false);
          showToast(data.error || 'Scan execution failed', 'error');
        }
      } catch (err: any) {
        console.error('Error parsing SSE event:', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('EventSource connection lost:', err);
      setScanLogs((prev) => [...prev, '[ERROR] Lost connection with code scan server']);
      eventSource.close();
      eventSourceRef.current = null;
      setIsScanning(false);
      showToast('Scan connection failed or closed', 'error');
    };
  };

  const handleSaveConfig = async (newConfig: any) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const data = await response.json();
      if (data.success) {
        showToast('Configuration saved successfully!');
        setIsSettingsOpen(false);
        await loadConfig();
      } else {
        showToast(data.error || 'Failed to save configuration', 'error');
      }
    } catch (err: any) {
      showToast(`Save config failed: ${err.message}`, 'error');
    }
  };

  const handleApplyFix = async (finding: any, remediationCode: string) => {
    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: finding.file,
          targetLine: finding.line,
          targetContent: finding.message,
          replacementContent: remediationCode,
        }),
      });

      const data = await response.json();
      if (data.success) {
        showToast('Fix applied successfully!');
        // Update local report data to show applied state
        if (currentReport && currentReport.findings) {
          const updatedFindings = currentReport.findings.map((f: any) => {
            if (f.file === finding.file && f.line === finding.line && f.rule_id === finding.rule_id) {
              return { ...f, _applied: true };
            }
            return f;
          });
          setCurrentReport({ ...currentReport, findings: updatedFindings });
        }
        return true;
      } else {
        showToast(data.error || 'Failed to apply resolution fix', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Apply fix failed: ${err.message}`, 'error');
      return false;
    }
  };

  // Triggers selection logic from Overview Dashboard: Top Affected File Selection
  const handleSelectFilePath = (path: string | null) => {
    setSelectedFilePath(path);
    // Find first finding belonging to this file, auto-select it in Inspector
    if (path && currentReport && currentReport.findings) {
      const firstIndex = currentReport.findings.findIndex((f: any) => f.file === path);
      if (firstIndex !== -1) {
        setSelectedFindingIndex(firstIndex);
        setActiveTab('issues');
      }
    }
  };

  const handleSelectFindingIndex = (index: number | null) => {
    setSelectedFindingIndex(index);
    if (index !== null) {
      setActiveTab('issues');
    }
  };

  const getStepStatus = (stepIndex: number, statusText: string) => {
    const txt = (statusText || '').toLowerCase();
    
    // Step index mappings:
    // 0: Static Security Scan (Semgrep)
    // 1: AST Structural Analysis (GitNexus)
    // 2: Complexity Metrics (Lizard)
    // 3: Obscure Naming Audit (AI)
    // 4: Generate Fix Suggestions (9router AI)
    // 5: Package & Save Report
    
    let currentStep = 0;
    if (txt.includes('gitnexus') || txt.includes('ast context') || txt.includes('enriching')) {
      currentStep = 1;
    } else if (txt.includes('lizard') || txt.includes('complexity')) {
      currentStep = 2;
    } else if (txt.includes('naming quality') || txt.includes('naming audit')) {
      currentStep = 3;
    } else if (txt.includes('resolving findings') || txt.includes('ai resolutions') || txt.includes('using mock ai')) {
      currentStep = 4;
    } else if (txt.includes('writing report') || txt.includes('executed successfully')) {
      currentStep = 5;
    }
    
    if (currentStep > stepIndex) return 'completed';
    if (currentStep === stepIndex) return 'active';
    return 'pending';
  };

  const scanSteps = [
    { label: 'Static Security Scan (Semgrep)', desc: 'Identify vulnerabilities & secrets' },
    { label: 'AST Structural Analysis (GitNexus)', desc: 'Construct call graph & blast radius' },
    { label: 'Calculate Complexity Metrics (Lizard)', desc: 'Measure Cyclomatic complexity & LOC' },
    { label: 'Audit Obscure Naming (AI)', desc: 'Evaluate symbol naming semantics' },
    { label: 'Generate Fix Suggestions (9router AI)', desc: 'Generate context-aware remediation code' },
    { label: 'Package & Save Report', desc: 'Synchronize analysis results' }
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary select-none">
      {/* Toast alert notifications */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-55 px-4 py-2 rounded-xl text-xs font-semibold shadow-2xl border transition-all duration-300 transform translate-y-0 opacity-100 ${
            toast.type === 'success'
              ? 'bg-success/15 border-success/30 text-success'
              : 'bg-danger/15 border-danger/30 text-danger'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Floating Scan Progress Modal */}
      {isScanning && (() => {
        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
            <div className="bg-bg-secondary/95 border border-card-border/80 rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,149,255,0.15)] p-8 flex flex-col gap-6 animate-slide-up glass">
              
              {/* Modal Header */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-6 w-6 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/20 opacity-75"></span>
                      <svg className="relative h-5 w-5 text-accent animate-spin" style={{ animationDuration: '4s' }} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
                      Analysis Progress
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                      scanStatus.toLowerCase().includes('fast')
                        ? 'bg-success/10 border-success/35 text-success'
                        : 'bg-accent/10 border-accent/35 text-accent'
                    }`}>
                      {scanStatus.toLowerCase().includes('fast') ? 'FAST SCAN' : 'FULL SCAN'}
                    </span>
                    <span className="text-[11px] text-text-secondary font-mono bg-bg-primary/80 px-2.5 py-0.5 rounded border border-card-border/60 font-semibold flex items-center gap-1.5 shadow-inner">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Steps Checklist */}
              <div className="space-y-3 py-3 border-y border-card-border/30">
                {scanSteps.map((step, idx) => {
                  const status = getStepStatus(idx, scanStatus);
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-4 p-2.5 rounded-xl border transition-all duration-300 ${
                        status === 'active' 
                          ? 'bg-accent/5 border-accent/25 shadow-[0_0_15px_rgba(0,149,255,0.03)]' 
                          : status === 'completed' 
                          ? 'bg-success/5 border-success/10' 
                          : 'border-transparent bg-transparent opacity-40'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {status === 'completed' ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 border border-success/40 text-success text-[10px] font-bold shadow-[0_0_8px_rgba(34,197,94,0.2)]">
                            ✓
                          </div>
                        ) : status === 'active' ? (
                          <div className="relative flex h-5 w-5 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-accent/30 opacity-75"></span>
                            <div className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-accent border-t-transparent animate-spin" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-card-border bg-bg-primary/40 border-dashed" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-semibold leading-none ${
                          status === 'active' 
                            ? 'text-accent font-bold' 
                            : status === 'completed' 
                            ? 'text-text-primary' 
                            : 'text-text-secondary/70'
                        }`}>
                          {step.label}
                        </span>
                        <span className={`text-[10px] mt-1.5 leading-none ${
                          status === 'active' ? 'text-text-secondary' : 'text-text-tertiary'
                        }`}>
                          {step.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Terminal Logs View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Log Console (Terminal)
                  </span>
                  <span className="text-[8px] font-mono text-text-tertiary">Real-time SSE Stream</span>
                </div>
                <div className="font-mono text-[10px] text-left text-success bg-black/95 border border-card-border/60 p-3.5 rounded-xl h-24 overflow-y-auto scrollbar-thin select-text flex flex-col gap-1 shadow-inner">
                  {scanLogs.map((log, lIdx) => (
                    <div key={lIdx} className={`truncate ${lIdx === scanLogs.length - 1 ? 'text-cyan-400 font-semibold' : 'opacity-60'}`}>
                      <span className="text-text-tertiary select-none mr-2">&gt;</span>
                      {log}
                      {lIdx === scanLogs.length - 1 && <span className="animate-pulse ml-0.5">_</span>}
                    </div>
                  ))}
                  {scanLogs.length === 0 && (
                    <div className="text-text-tertiary italic">Waiting for logs...</div>
                  )}
                </div>
              </div>

              {/* Cancel Button */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleCancelScan}
                  className="px-5 py-2 bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 text-xs font-semibold rounded-lg shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel Scan
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header bar */}
      <Header
        projectName={currentProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartScan={(fastScan) => handleStartScan('', false, false, fastScan)}
        reports={reports}
        currentReportId={currentReportId}
        onSelectReportId={setCurrentReportId}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {!currentProject ? (
          <Onboarding
            projects={projects}
            onSelectProject={handleSelectProject}
            onStartScan={handleStartScan}
          />
        ) : (
          <>
            {/* Sidebar selection panels */}
            <Sidebar
              projectName={currentProject}
              findings={currentReport?.findings || []}
              selectedFilePath={selectedFilePath}
              onSelectFilePath={handleSelectFilePath}
              targetPath={currentReport?.target_path || null}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterSeverities={filterSeverities}
              setFilterSeverities={setFilterSeverities}
              filterCategories={filterCategories}
              setFilterCategories={setFilterCategories}
              selectedFindingIndex={selectedFindingIndex}
              onSelectFindingIndex={handleSelectFindingIndex}
              filterStatuses={filterStatuses}
              setFilterStatuses={setFilterStatuses}
              filterLanguages={filterLanguages}
              setFilterLanguages={setFilterLanguages}
              availableLanguages={availableLanguages}
            />


            {/* Central Panels with Tab Controllers */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Tabs list */}
              <div className="flex px-6 pt-3 border-b border-card-border bg-[#161622] gap-4">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Overview Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('issues')}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'issues'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Code & Issues
                </button>
              </div>

              {/* Tab Panel contents */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {activeTab === 'dashboard' ? (
                  <OverviewDashboard
                    report={currentReport}
                    currentProject={currentProject}
                    findings={currentReport?.findings || []}
                    onSelectFilePath={handleSelectFilePath}
                    onSelectFindingIndex={handleSelectFindingIndex}
                  />
                ) : (
                  currentReport && currentReport.findings && (
                    selectedFindingIndex === null ? (
                      /* 1. All Issues List (No finding selected) */
                      <div className="flex-1 flex overflow-hidden min-h-0 bg-bg-secondary animate-slide-left">
                        {/* Left Column: Search & Filters */}
                        <div className="flex flex-col h-full overflow-hidden p-4 pr-2 gap-4 shrink-0 select-none bg-bg-secondary">
                          {/* Floating Card Wrapper for filters (width: 68 / 272px) */}
                          <div className="w-68 min-w-68 flex-1 bg-[#161622] border border-card-border/40 rounded-2xl pt-5 pb-5 pl-5 pr-0 flex flex-col gap-3 overflow-hidden shadow-xl">
                          <div className="flex items-center justify-between pr-5 pb-3 border-b border-text-tertiary/30 h-8 box-content">
                            <div className="flex items-center gap-2">
                              <Filter className="h-4 w-4 text-text-primary" />
                              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                                Filters
                              </h3>
                            </div>
                            <div className={`transition-opacity duration-150 ${(searchQuery || filterSeverities.length > 0 || filterCategories.length > 0 || filterStatuses.length > 0 || filterLanguages.length > 0) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                              <button
                                onClick={() => {
                                  setSearchQuery('');
                                  setFilterSeverities([]);
                                  setFilterCategories([]);
                                  setFilterStatuses([]);
                                  setFilterLanguages([]);
                                }}
                                className="flex items-center gap-1 text-xs font-bold text-accent-hover hover:text-accent-hover transition-colors cursor-pointer bg-accent/20 border border-accent/45 rounded-lg px-2.5 py-1.5 shadow-sm hover:bg-accent/30 hover:border-accent/60 duration-100"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Clear All</span>
                              </button>
                            </div>
                          </div>

                          {/* Filter Option Checklist stacked vertically inside scrollable container */}
                          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-5 pb-4">
                            {/* Severity Filter */}
                            <div className="pb-[14px] border-b border-text-tertiary/30">
                              <div
                                className="flex items-center justify-between py-1.5 select-none"
                              >
                                <div
                                  onClick={() => toggleFilterSection('severity')}
                                  className="flex items-center gap-1.5 cursor-pointer group flex-1"
                                >
                                  <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.severity ? '' : '-rotate-90'}`} />
                                  <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Severity</label>
                                </div>
                                {filterSeverities.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterSeverities([]);
                                    }}
                                    className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                                    title="Clear Severity Filters"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              {expandedFilters.severity && (
                                <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                                  {[
                                    { id: 'error', label: 'Error', key: 'error', icon: <AlertOctagon className="h-4 w-4 text-error shrink-0" /> },
                                    { id: 'warning', label: 'Warning', key: 'warning', icon: <AlertTriangle className="h-4 w-4 text-warning shrink-0" /> },
                                    { id: 'info', label: 'Info', key: 'info', icon: <Info className="h-4 w-4 text-info shrink-0" /> }
                                  ].map(opt => {
                                    const isActive = filterSeverities.includes(opt.id);
                                    const count = filterCounts.severity[opt.key as keyof typeof filterCounts.severity] || 0;
                                    return (
                                      <div
                                        key={opt.id}
                                        onClick={() => {
                                          setFilterSeverities(prev =>
                                            prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id]
                                          );
                                        }}
                                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                                          isActive
                                            ? 'border-accent/50 bg-accent/12 text-text-primary'
                                            : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                                        }`}
                                      >
                                      <div className="flex items-center gap-2.5">
                                        {opt.icon}
                                        <span className="font-sans text-sm font-medium">{opt.label}</span>
                                      </div>
                                      <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                                        {count}
                                      </span>
                                    </div>
                                  );
                                })}
                                </div>
                              )}
                            </div>

                            {/* Category Filter */}
                            <div className="pb-[14px] border-b border-text-tertiary/30 pt-[2px]">
                              <div
                                className="flex items-center justify-between py-1.5 select-none"
                              >
                                <div
                                  onClick={() => toggleFilterSection('category')}
                                  className="flex items-center gap-1.5 cursor-pointer group flex-1"
                                >
                                  <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.category ? '' : '-rotate-90'}`} />
                                  <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Category</label>
                                </div>
                                {filterCategories.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterCategories([]);
                                    }}
                                    className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                                    title="Clear Category Filters"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              {expandedFilters.category && (
                                <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                                  {[
                                    { id: 'security', label: 'Security', key: 'security', icon: <Shield className="h-4 w-4 text-error shrink-0" /> },
                                    { id: 'quality', label: 'Quality', key: 'quality', icon: <Bug className="h-4 w-4 text-warning shrink-0" /> },
                                    { id: 'maintainability', label: 'Maintainability', key: 'maintainability', icon: <Wrench className="h-4 w-4 text-success shrink-0" /> },
                                    { id: 'architecture', label: 'Architecture', key: 'architecture', icon: <Layout className="h-4 w-4 text-info shrink-0" /> }
                                  ].map(opt => {
                                    const isActive = filterCategories.includes(opt.id);
                                    const count = filterCounts.category[opt.key as keyof typeof filterCounts.category] || 0;
                                    return (
                                      <div
                                        key={opt.id}
                                        onClick={() => {
                                          setFilterCategories(prev =>
                                            prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id]
                                          );
                                        }}
                                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                                          isActive
                                            ? 'border-accent/50 bg-accent/12 text-text-primary'
                                            : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                                        }`}
                                      >
                                      <div className="flex items-center gap-2.5">
                                        {opt.icon}
                                        <span className="font-sans text-sm font-medium">{opt.label}</span>
                                      </div>
                                      <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                                        {count}
                                      </span>
                                    </div>
                                  );
                                })}
                                </div>
                              )}
                            </div>

                            {/* Status Filter */}
                            <div className="pb-[14px] border-b border-text-tertiary/30 pt-[2px]">
                              <div
                                className="flex items-center justify-between py-1.5 select-none"
                              >
                                <div
                                  onClick={() => toggleFilterSection('status')}
                                  className="flex items-center gap-1.5 cursor-pointer group flex-1"
                                >
                                  <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.status ? '' : '-rotate-90'}`} />
                                  <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Fix Status</label>
                                </div>
                                {filterStatuses.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterStatuses([]);
                                    }}
                                    className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                                    title="Clear Status Filters"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              {expandedFilters.status && (
                                <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                                  {[
                                    { id: 'pending', label: 'Pending', key: 'pending', icon: <Clock className="h-4 w-4 text-text-secondary shrink-0" /> },
                                    { id: 'applied', label: 'Applied', key: 'applied', icon: <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> }
                                  ].map(opt => {
                                    const isActive = filterStatuses.includes(opt.id);
                                    const count = filterCounts.status[opt.key as keyof typeof filterCounts.status] || 0;
                                    return (
                                      <div
                                        key={opt.id}
                                        onClick={() => {
                                          setFilterStatuses(prev =>
                                            prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id]
                                          );
                                        }}
                                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                                          isActive
                                            ? 'border-accent/50 bg-accent/12 text-text-primary'
                                            : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                                        }`}
                                      >
                                      <div className="flex items-center gap-2.5">
                                        {opt.icon}
                                        <span className="font-sans text-sm font-medium">{opt.label}</span>
                                      </div>
                                      <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                                        {count}
                                      </span>
                                    </div>
                                  );
                                })}
                                </div>
                              )}
                            </div>

                            {/* Language Filter */}
                            {availableLanguages.length > 0 && (
                              <div className="pt-[2px]">
                                <div
                                  className="flex items-center justify-between py-1.5 select-none"
                                >
                                  <div
                                    onClick={() => toggleFilterSection('language')}
                                    className="flex items-center gap-1.5 cursor-pointer group flex-1"
                                  >
                                    <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${expandedFilters.language ? '' : '-rotate-90'}`} />
                                    <label className="text-xs text-text-tertiary uppercase font-bold tracking-wider group-hover:text-text-primary transition-colors cursor-pointer">Language</label>
                                  </div>
                                  {filterLanguages.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFilterLanguages([]);
                                      }}
                                      className="p-1 rounded text-text-tertiary hover:text-accent-hover hover:bg-accent/10 transition-colors cursor-pointer"
                                      title="Clear Language Filters"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                                {expandedFilters.language && (
                                  <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                                    {availableLanguages.map(lang => {
                                      const isActive = filterLanguages.includes(lang);
                                      const count = filterCounts.language[lang] || 0;
                                      return (
                                        <div
                                          key={lang}
                                          onClick={() => {
                                            setFilterLanguages(prev =>
                                              prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang]
                                            );
                                          }}
                                          className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border text-sm font-semibold cursor-pointer transition-all select-none ${
                                          isActive
                                            ? 'border-accent/50 bg-accent/12 text-text-primary'
                                            : 'border-card-border/30 bg-transparent text-text-secondary hover:border-card-border/60 hover:bg-bg-primary/30 hover:text-text-primary'
                                          }`}
                                        >
                                        <div className="flex items-center gap-2.5">
                                          <Terminal className="h-4 w-4 text-text-secondary shrink-0" />
                                          <span className="font-sans text-sm font-medium">{lang}</span>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-text-tertiary bg-bg-primary/45 px-1.5 py-0.5 rounded border border-card-border/20">
                                          {count}
                                        </span>
                                      </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                        {/* Right Column: List of Findings */}
                        <div className="flex-1 flex flex-col min-h-0 bg-bg-secondary p-4 pl-2 overflow-y-auto scrollbar-thin">
                          <div className="flex items-center justify-between pb-4 border-b border-text-tertiary/30 mb-5">
                            <div className="flex items-center gap-3">
                              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                                PROJECT FINDINGS
                              </h3>
                              <span className="px-2.5 py-0.5 bg-accent text-white rounded-full text-[10px] font-bold shadow-sm font-sans">
                                {searchedAndFilteredFindings.length} finding(s) match filters
                              </span>
                            </div>
                          </div>

                          {/* Keyword Search Input */}
                          <div className="mb-6 max-w-5xl">
                            <div className="relative">
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search findings by rule ID, description message, or file path..."
                                autoComplete="off"
                                name="searchQuery"
                                className="w-full bg-[#161622] border border-card-border/60 rounded-xl pl-10 pr-10 py-3 text-sm text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary font-medium shadow-inner"
                              />
                              <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-text-tertiary" />
                              {searchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSearchQuery('')}
                                  className="absolute right-3.5 top-3.5 text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {searchedAndFilteredFindings.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-text-tertiary animate-fade-in">
                              <span className="text-3xl mb-3">🔍</span>
                              <p className="font-semibold text-text-secondary text-sm">No Findings Found</p>
                              <span className="text-xs max-w-sm mt-1.5 leading-relaxed">
                                No findings match your search query or active filters. Try resetting or adjusting the options in the left column.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 max-w-5xl">
                              {searchedAndFilteredFindings.map((f: any) => {
                                const originalIndex = currentReport.findings.indexOf(f);
                                const severity = (f.severity || '').toLowerCase();
                                const cat = classifyFinding(f);
                                const isApplied = f._applied;

                                return (
                                  <div
                                    key={originalIndex}
                                    onClick={() => {
                                      setSelectedFilePath(f.file);
                                      setSelectedFindingIndex(originalIndex);
                                    }}
                                    className="p-4 rounded-xl border border-card-border bg-card-bg hover:border-accent/30 hover:bg-bg-tertiary/20 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm group"
                                  >
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="flex items-center gap-2.5 flex-wrap">
                                        <span
                                          className={`h-2 w-2 rounded-full shrink-0 ${
                                            severity === 'error'
                                              ? 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                              : severity === 'warning'
                                              ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                              : 'bg-info shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                          }`}
                                        />
                                        <span className="text-[12px] font-mono font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                                          {f.rule_id}
                                        </span>
                                        <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider font-sans ${
                                          cat === 'security'
                                            ? 'bg-danger/10 border-danger/35 text-danger'
                                            : cat === 'maintainability'
                                            ? 'bg-warning/10 border-warning/35 text-warning'
                                            : cat === 'architecture'
                                            ? 'bg-accent/10 border-accent/35 text-accent'
                                            : 'bg-info/10 border-info/35 text-info'
                                        }`}>
                                          {cat === 'security' ? '🛡️ Security' : cat === 'maintainability' ? '⚙️ Maintainability' : cat === 'architecture' ? '🏗️ Architecture' : '🐞 Quality'}
                                        </span>
                                        <span className="text-[10px] text-text-tertiary font-mono font-semibold">
                                          {f.file.split(/[\\/]/).pop()}:{f.line}
                                        </span>
                                      </div>
                                      <p className="text-xs text-text-secondary select-text font-normal leading-relaxed line-clamp-2">
                                        {f.message}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center font-mono text-xs">
                                      <span className="text-[10px] text-text-tertiary bg-bg-secondary px-2.5 py-0.5 rounded border border-card-border/40 truncate max-w-xs hidden lg:inline-block">
                                        {f.file.replace(/\\/g, '/').replace(currentReport.target_path?.replace(/\\/g, '/') || '', '').replace(/^\//, '')}
                                      </span>
                                      <span className={`text-[10px] px-2.5 py-0.5 rounded border font-semibold font-sans ${
                                        isApplied
                                          ? 'bg-success/15 border-success/35 text-success'
                                          : 'bg-bg-tertiary border-card-border text-text-secondary'
                                      }`}>
                                        {isApplied ? 'Applied' : 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* 2. Detail Screen (Code Inspector & AI Chat) */
                      <div className="flex-1 flex overflow-hidden min-h-0 bg-bg-secondary animate-slide-left">
                        <CodeInspector
                          finding={currentReport.findings[selectedFindingIndex]}
                          aiResolutions={currentReport.ai_resolutions || {}}
                          targetPath={currentReport.target_path || null}
                          selectedProvider={config?.AI_PROVIDER || 'openai'}
                          apiKey={config?.[`${(config?.AI_PROVIDER || 'openai').toUpperCase()}_API_KEY`] || ''}
                          apiBaseUrl={
                            config?.[`${(config?.AI_PROVIDER || 'openai').toUpperCase()}_BASE_URL`] || ''
                          }
                          aiModel={config?.[`${(config?.AI_PROVIDER || 'openai').toUpperCase()}_MODEL`] || ''}
                          aiTemperature={parseFloat(config?.AI_TEMPERATURE) || 0.1}
                          aiMaxTokens={parseInt(config?.AI_MAX_TOKENS) || 4096}
                          onApplyFix={handleApplyFix}
                          metrics={currentReport.metrics}
                          allFindings={currentReport.findings}
                          onSelectFindingIndex={handleSelectFindingIndex}
                        />
                      </div>
                    )
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Settings Drawer Slideout */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveConfig}
        initialConfig={config}
      />
    </div>
  );
};

export default App;
