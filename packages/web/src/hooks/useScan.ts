import { useState, useCallback, useRef, useEffect } from 'react';
import type { Report } from '../types';

interface ScanProgress {
  phase: string;
  message: string;
  current: number;
  total: number;
  percentage: number;
}

interface UseScanDeps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  loadProjects: () => Promise<void>;
  loadHistory: (project: string, autoSelectLatest?: boolean) => Promise<void>;
  currentReport: Report | null;
  setCurrentReport: (report: Report | null) => void;
  onScanComplete?: (projectName: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  scan: 'Static Security Scan (Semgrep)',
  enrich: 'AST Structural Analysis (GitNexus)',
  complexity: 'Calculate Complexity Metrics (Lizard)',
  dedup: 'Deduplicating Findings',
  classify: 'Cross-Scan Classification',
  naming_audit: 'Audit Obscure Naming (AI)',
  ai_resolve: 'Generate Fix Suggestions (AI)',
  report: 'Package & Save Report',
};

export function useScan({ showToast, loadProjects, loadHistory, currentReport, setCurrentReport, onScanComplete }: UseScanDeps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isReResolving, setIsReResolving] = useState(false);
  const [scanStatus, setScanStatus] = useState('Initializing scan...');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Scan timer effect
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
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

  const handleCancelScan = useCallback(async () => {
    try {
      setScanStatus('Cancelling scan...');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      await fetch('/api/scan/cancel', { method: 'POST' });
      setIsScanning(false);
      showToast('Scan cancelled by user', 'error');
    } catch (err: unknown) {
      console.error('Failed to cancel scan:', err);
    }
  }, [showToast]);

  const handleStartScan = useCallback(async (targetPath: string, mockScan = false, mockAi = false, fastScan = false) => {
    setIsScanning(true);
    setScanStatus('Starting scan connection...');
    setScanLogs(['[SYSTEM] Starting scan process...']);

    const params = new URLSearchParams({
      targetPath: targetPath || '',
      mockScan: mockScan.toString(),
      mockAi: mockAi.toString(),
      fastScan: fastScan.toString(),
    });

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/scan/stream?${params.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setScanProgress(data);
          setScanStatus(data.message);
          const phaseLabel = PHASE_LABELS[data.phase] || data.phase;
          setScanLogs((prev) => {
            const logLine = `[${data.percentage.toFixed(0)}%] ${phaseLabel}: ${data.message}`;
            if (prev.length > 0 && prev[prev.length - 1] === logLine) {
              return prev;
            }
            const nextLogs = [...prev, logLine];
            if (nextLogs.length > 4) {
              return nextLogs.slice(nextLogs.length - 4);
            }
            return nextLogs;
          });
        } else if (data.type === 'status') {
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
          await loadHistory(projName, false);
          setIsScanning(false);
          showToast('Scan completed successfully!');
          onScanComplete?.(projName);
        } else if (data.type === 'error') {
          setScanLogs((prev) => [...prev, `[ERROR] Scan failed: ${data.error || 'Scan execution failed'}`]);
          eventSource.close();
          eventSourceRef.current = null;
          setIsScanning(false);
          showToast(data.error || 'Scan execution failed', 'error');
        }
      } catch (err: unknown) {
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
  }, [showToast, loadProjects, loadHistory, onScanComplete]);

  const handleReResolve = useCallback(async (report: Report | null) => {
    if (!report?._savedAt) {
      showToast('Current report file path is missing. Reload the report and try again.', 'error');
      return;
    }
    if (!report.findings || report.findings.length === 0) {
      showToast('No findings found in the current report.', 'error');
      return;
    }

    setIsReResolving(true);
    setScanStatus('Starting AI re-resolution...');
    setScanLogs((prev) => [...prev, '[SYSTEM] Starting AI re-resolution via SSE...']);

    const params = new URLSearchParams({
      reportPath: report._savedAt,
      mockAi: 'false',
    });

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/re-resolve/stream?${params.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setScanStatus(data.message);
          const phaseLabel = data.phase || 'ai_resolve';
          setScanLogs((prev) => {
            const logLine = `[${(data.percentage ?? 0).toFixed(0)}%] ${phaseLabel}: ${data.message}`;
            if (prev.length > 0 && prev[prev.length - 1] === logLine) return prev;
            const nextLogs = [...prev, logLine];
            return nextLogs.length > 4 ? nextLogs.slice(nextLogs.length - 4) : nextLogs;
          });
        } else if (data.type === 'status') {
          setScanStatus(data.message);
        } else if (data.type === 'complete' && data.report) {
          setScanLogs((prev) => [...prev, '[SYSTEM] AI re-resolution complete!']);
          eventSource.close();
          eventSourceRef.current = null;
          const updated = data.report as Report;
          setCurrentReport(updated);
          await loadHistory(updated._project || '', false);
          setIsReResolving(false);
          showToast('AI suggestions updated for this report.');
        } else if (data.type === 'error') {
          setScanLogs((prev) => [...prev, `[ERROR] ${data.error || 'Re-resolution failed'}`]);
          eventSource.close();
          eventSourceRef.current = null;
          setIsReResolving(false);
          showToast(data.error || 'AI re-analysis failed', 'error');
        }
      } catch (err: unknown) {
        console.error('Error parsing re-resolve SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('Re-resolve EventSource connection lost');
      setScanLogs((prev) => [...prev, '[ERROR] Lost connection with re-resolution server']);
      eventSource.close();
      eventSourceRef.current = null;
      setIsReResolving(false);
      showToast('AI re-resolution connection failed', 'error');
    };
  }, [showToast, loadHistory, setCurrentReport]);

  return {
    isScanning,
    scanStatus,
    scanLogs,
    elapsedTime,
    isReResolving,
    scanProgress,
    PHASE_LABELS,
    handleStartScan,
    handleCancelScan,
    handleReResolve,
    formatTime,
  };
}