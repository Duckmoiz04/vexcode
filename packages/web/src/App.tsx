import React, { useState, useMemo, useCallback } from 'react';
import { Header } from './components/header/Header';
import { Sidebar } from './components/sidebar/Sidebar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ScanModal } from './components/ScanModal';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { IssuesPage } from './pages/IssuesPage';
import type { Finding, FindingStatus, Report, Config, ScanStatus } from './types';
import { useToast } from './hooks/useToast';
import { useConfig } from './hooks/useConfig';
import { useReports } from './hooks/useReports';
import { useScan } from './hooks/useScan';
import { AIProviderProvider } from './context/AIProviderContext';

export const App: React.FC = () => {
  const { toast, showToast } = useToast();
  const { config, isSettingsOpen, setIsSettingsOpen, handleSaveConfig } = useConfig(showToast);
  const {
    currentProject, projects, reports, currentReportId, currentReport, setCurrentReport,
    pagination, currentPage, pageSize,
    loadProjects, loadHistory, handleSelectProject, setCurrentReportId,
    handlePageChange, handleSetPageSize,
  } = useReports(showToast);
  const {
    isScanning, scanStatus, scanLogs, elapsedTime, isReResolving, scanProgress, PHASE_LABELS,
    handleStartScan, handleCancelScan, handleReResolve, formatTime,
  } = useScan({ showToast, loadProjects, loadHistory, currentReport, setCurrentReport, onScanComplete: handleSelectProject });

  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'issues'>('dashboard');

  // Lifted filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverities, setFilterSeverities] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterLanguages, setFilterLanguages] = useState<string[]>([]);
  const [filterScanStatuses, setFilterScanStatuses] = useState<string[]>([]);

  const classifyFinding = (finding: Finding) => {
    const ruleId = (finding.rule_id || '').toLowerCase();
    const securityKeywords = ['security', 'vuln', 'injection', 'xss', 'csrf', 'secret', 'key', 'token', 'jwt', 'crypto', 'auth', 'password', 'credential', 'ssrf', 'overflow', 'leak', 'private', 'cert', 'hash', 'ssl', 'tls'];
    if (securityKeywords.some(kw => ruleId.includes(kw))) return 'security';
    if (finding.ast_context && (finding.ast_context.symbol_name || (finding.ast_context.callers && finding.ast_context.callers.length > 0))) return 'architecture';
    const styleKeywords = ['style', 'format', 'naming', 'deprecated', 'convention', 'comment', 'spacing', 'indent', 'unused', 'duplicate', 'complex', 'nest'];
    if (styleKeywords.some(kw => ruleId.includes(kw))) return 'maintainability';
    return 'quality';
  };

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
    rawFindings.forEach((f: Finding) => {
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
      status: { open: 0, applied: 0, false_positive: 0, ignored: 0 },
      language: {} as Record<string, number>,
      scanStatus: { new: 0, persisting: 0, resolved: 0, regressed: 0 },
    };

    raw.forEach((f: Finding) => {
      const sev = (f.severity || '').toLowerCase();
      if (sev in counts.severity) {
        counts.severity[sev as keyof typeof counts.severity]++;
      }

      const cat = classifyFinding(f);
      if (cat in counts.category) {
        counts.category[cat as keyof typeof counts.category]++;
      }

      const status = f.status || (f._applied ? 'applied' : 'open');
      if (status in counts.status) {
        counts.status[status as keyof typeof counts.status]++;
      }

      const lang = getFileLanguage(f.file);
      counts.language[lang] = (counts.language[lang] || 0) + 1;

      const scanStatus = (f.scan_status || 'new') as ScanStatus;
      if (scanStatus in counts.scanStatus) {
        counts.scanStatus[scanStatus]++;
      }
    });

    return counts;
  }, [currentReport, getFileLanguage]);

  // Searched & Filtered findings list
  const searchedAndFilteredFindings = useMemo(() => {
    const rawFindings = currentReport?.findings || [];
    return rawFindings.filter((finding: Finding) => {
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
        const status = finding.status || (finding._applied ? 'applied' : 'open');
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

      // 6. Scan status filter
      if (filterScanStatuses.length > 0) {
        const scanStatus = finding.scan_status || 'new';
        if (!filterScanStatuses.includes(scanStatus)) {
          return false;
        }
      }

      return true;
    });
  }, [currentReport, searchQuery, filterSeverities, filterCategories, filterStatuses, filterLanguages, filterScanStatuses, getFileLanguage]);

  const handleApplyFix = async (finding: Finding, remediationCode: string) => {
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
          reportPath: currentReport?._savedAt,
          findingId: finding.id,
          findingFile: finding.file,
          findingLine: finding.line,
          findingRuleId: finding.rule_id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        showToast('Fix applied successfully!');
        // Update local report data to show applied state
        if (currentReport && currentReport.findings) {
          const updatedFindings = currentReport.findings.map((f: Finding) => {
            if (f.file === finding.file && f.line === finding.line && f.rule_id === finding.rule_id) {
              return { ...f, _applied: true, status: 'applied' as FindingStatus };
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`Apply fix failed: ${message}`, 'error');
      return false;
    }
  };

  const handleStatusChange = async (finding: Finding, status: FindingStatus) => {
    // Optimistic update
    if (currentReport && currentReport.findings) {
      const updatedFindings = currentReport.findings.map((f: Finding) => {
        if (f === finding || (f.file === finding.file && f.line === finding.line && f.rule_id === finding.rule_id)) {
          return { ...f, status, _applied: status === 'applied' };
        }
        return f;
      });
      setCurrentReport({ ...currentReport, findings: updatedFindings });
    }

    // Persist via API
    try {
      const reportPath = currentReport?._savedAt;
      const findingId = finding.id;
      if (reportPath && findingId) {
        const response = await fetch(`/api/finding/${encodeURIComponent(reportPath)}/${encodeURIComponent(findingId)}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) {
          showToast('Failed to update finding status', 'error');
        }
      }
    } catch {
      showToast('Failed to update finding status', 'error');
    }
  };

  // Triggers selection logic from Overview Dashboard: Top Affected File Selection
  const handleSelectFilePath = (path: string | null) => {
    setSelectedFilePath(path);
    // Find first finding belonging to this file, auto-select it in Inspector
    if (path && currentReport && currentReport.findings) {
      const firstIndex = currentReport.findings.findIndex((f: Finding) => f.file === path);
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

  const handlePageChangeWithReset = useCallback((page: number) => {
    setSelectedFindingIndex(null);
    handlePageChange(page);
  }, [handlePageChange]);

  // Reset view state when switching projects or scans
  const resetView = useCallback(() => {
    setActiveTab('dashboard');
    setSelectedFindingIndex(null);
    setSelectedFilePath(null);
    setFilterScanStatuses([]);
  }, []);

  const handleSelectProjectWithReset = useCallback((project: string | null) => {
    resetView();
    handleSelectProject(project);
  }, [resetView, handleSelectProject]);

  const handleSelectReportIdWithReset = useCallback((reportId: string | null) => {
    resetView();
    setCurrentReportId(reportId);
  }, [resetView, setCurrentReportId]);

  return (
    <AIProviderProvider config={config as Config}>
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary">
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
        scanProgress={scanProgress}
        PHASE_LABELS={PHASE_LABELS}
        onCancelScan={handleCancelScan}
      />

      {/* Header bar */}
      <Header
        projectName={currentProject}
        projects={projects}
        onSelectProject={handleSelectProjectWithReset}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartScan={(fastScan) => handleStartScan('', false, false, fastScan)}
        onReResolve={() => handleReResolve(currentReport)}
        reports={reports}
        currentReportId={currentReportId}
        onSelectReportId={handleSelectReportIdWithReset}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {!currentProject ? (
          <OnboardingPage
            projects={projects}
            onSelectProject={handleSelectProjectWithReset}
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
              filterScanStatuses={filterScanStatuses}
              setFilterScanStatuses={setFilterScanStatuses}
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
                    filterScanStatuses={filterScanStatuses}
                    setFilterScanStatuses={setFilterScanStatuses}
                    filterCounts={filterCounts}
                    availableLanguages={availableLanguages}
                    searchedAndFilteredFindings={searchedAndFilteredFindings}
                    onApplyFix={handleApplyFix}
                    onStatusChange={handleStatusChange}
                    onReResolve={() => handleReResolve(currentReport)}
                    isReResolving={isReResolving}
                    onSelectFindingIndex={handleSelectFindingIndex}
                    pagination={pagination}
                    currentPage={currentPage}
                    onPageChange={handlePageChangeWithReset}
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
    </AIProviderProvider>
  );
};

export default App;