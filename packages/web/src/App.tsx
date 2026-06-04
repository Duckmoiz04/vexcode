import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    setScanLogs(['[SYSTEM] Khởi động tiến trình quét...']);
    
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
          setScanLogs((prev) => [...prev, '[SYSTEM] Phân tích hoàn tất! Đang đóng gói dữ liệu...']);
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
          setScanLogs((prev) => [...prev, `[ERROR] Quét thất bại: ${data.error || 'Scan execution failed'}`]);
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
      setScanLogs((prev) => [...prev, '[ERROR] Mất kết nối Server-Sent Events với máy chủ']);
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

  const getStepStatus = (stepIndex: number, statusText: string) => {
    const txt = (statusText || '').toLowerCase();
    
    // Step index mappings:
    // 0: Quét bảo mật tĩnh (Semgrep)
    // 1: Phân tích kiến trúc (GitNexus AST)
    // 2: Đo độ phức tạp (Lizard)
    // 3: Kiểm tra đặt tên (AI Naming Quality)
    // 4: AI Đề xuất sửa lỗi (AI Resolutions)
    // 5: Đóng gói & Lưu báo cáo
    
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
    { label: 'Quét bảo mật tĩnh (Semgrep)', desc: 'Tìm kiếm lỗ hổng và secrets' },
    { label: 'Phân tích cấu trúc AST (GitNexus)', desc: 'Dựng đồ thị gọi hàm & vùng ảnh hưởng' },
    { label: 'Tính toán chỉ số phức tạp (Lizard)', desc: 'Đo lường độ phức tạp Cyclomatic & LOC' },
    { label: 'Rà soát đặt tên tối nghĩa (AI)', desc: 'Đánh giá ngữ nghĩa biến/hàm bằng AI' },
    { label: 'Sinh đề xuất vá lỗi (9router AI)', desc: 'Tạo mã sửa lỗi tối ưu theo ngữ cảnh' },
    { label: 'Đóng gói & Lưu báo cáo', desc: 'Đồng bộ hóa dữ liệu phân tích' }
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
                      Tiến trình Phân tích
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
                    Bảng điều khiển Log (Terminal)
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
                    <div className="text-text-tertiary italic">Đang chờ tín hiệu log...</div>
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
                  Hủy quét (Cancel)
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
                      metrics={currentReport.metrics}
                      allFindings={currentReport.findings}
                      onSelectFindingIndex={handleSelectFindingIndex}
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
