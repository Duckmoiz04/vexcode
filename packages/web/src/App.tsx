import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ScanModal } from './components/ScanModal';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { IssuesPage } from './pages/IssuesPage';


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
          targetContent: finding.code_text || finding.message,
          replacementContent: remediationCode,
          codeText: finding.code_text,
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
      <ScanModal
        isScanning={isScanning}
        scanStatus={scanStatus}
        elapsedTime={elapsedTime}
        scanLogs={scanLogs}
        onCancelScan={handleCancelScan}
      />

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
          <OnboardingPage
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
                  <DashboardPage
                    report={currentReport}
                    currentProject={currentProject}
                    findings={currentReport?.findings || []}
                    onSelectFilePath={handleSelectFilePath}
                    onSelectFindingIndex={handleSelectFindingIndex}
                  />
                ) : (
                  <IssuesPage
                    currentReport={currentReport}
                    selectedFindingIndex={selectedFindingIndex}
                    setSelectedFindingIndex={setSelectedFindingIndex}
                    selectedFilePath={selectedFilePath}
                    setSelectedFilePath={setSelectedFilePath}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    filterSeverities={filterSeverities}
                    setFilterSeverities={setFilterSeverities}
                    filterCategories={filterCategories}
                    setFilterCategories={setFilterCategories}
                    filterStatuses={filterStatuses}
                    setFilterStatuses={setFilterStatuses}
                    filterLanguages={filterLanguages}
                    setFilterLanguages={setFilterLanguages}
                    filterCounts={filterCounts}
                    availableLanguages={availableLanguages}
                    searchedAndFilteredFindings={searchedAndFilteredFindings}
                    config={config}
                    onApplyFix={handleApplyFix}
                    onSelectFindingIndex={handleSelectFindingIndex}
                  />
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

