import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { CodeInspector } from './components/CodeInspector';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Onboarding } from './components/Onboarding';

export const App: React.FC = () => {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<any | null>(null);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'inspector'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<any>(null);

  // Scanning status
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Initializing scan...');

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

  const handleStartScan = async (targetPath: string, mockScan = false, mockAi = false) => {
    setIsScanning(true);
    setScanStatus('Scanning project...');
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath, mockScan, mockAi }),
      });

      const data = await response.json();
      if (data.success && data.report) {
        const projName = data.report._project;
        const reportId = data.report._id;
        
        await loadProjects();
        setCurrentProject(projName);
        await loadHistory(projName, false);
        setCurrentReportId(reportId);
        showToast('Scan completed successfully!');
      } else {
        showToast(data.error || 'Scan execution failed', 'error');
      }
    } catch (err: any) {
      showToast(`Scan request failed: ${err.message || err}`, 'error');
    } finally {
      setIsScanning(false);
    }
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
        setActiveTab('inspector');
      }
    }
  };

  const handleSelectFindingIndex = (index: number | null) => {
    setSelectedFindingIndex(index);
    if (index !== null) {
      setActiveTab('inspector');
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

      {/* Express / Scan Loading Overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-card-border border-t-accent animate-spin" />
          <p className="text-sm font-semibold text-text-primary">Scanning project...</p>
          <span className="text-xs text-text-tertiary">{scanStatus}</span>
        </div>
      )}

      {/* Header bar */}
      <Header
        projectName={currentProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartScan={() => handleStartScan('')}
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
              reports={reports}
              currentReportId={currentReportId}
              onSelectReportId={setCurrentReportId}
              findings={currentReport?.findings || []}
              selectedFindingIndex={selectedFindingIndex}
              onSelectFindingIndex={handleSelectFindingIndex}
              selectedFilePath={selectedFilePath}
              onSelectFilePath={handleSelectFilePath}
              targetPath={currentReport?.target_path || null}
            />

            {/* Central Panels with Tab Controllers */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Tabs list */}
              <div className="flex px-6 pt-3 border-b border-card-border bg-bg-secondary/40 gap-4">
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
                  onClick={() => {
                    if (selectedFindingIndex !== null) {
                      setActiveTab('inspector');
                    }
                  }}
                  disabled={selectedFindingIndex === null}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeTab === 'inspector'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Code Inspector
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
                  selectedFindingIndex !== null &&
                  currentReport &&
                  currentReport.findings && (
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
                    />
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
