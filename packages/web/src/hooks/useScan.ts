import { useState, useCallback, useRef, useEffect } from 'react';
import type { Report } from '../types';

interface UseScanDeps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  loadProjects: () => Promise<void>;
  loadHistory: (project: string, autoSelectLatest?: boolean) => Promise<void>;
  currentReport: Report | null;
  setCurrentReport: (report: Report | null) => void;
}

export function useScan({ showToast, loadProjects, loadHistory, currentReport, setCurrentReport }: UseScanDeps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isReResolving, setIsReResolving] = useState(false);
  const [scanStatus, setScanStatus] = useState('Initializing scan...');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
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
          await loadHistory(projName, false);
          setIsScanning(false);
          showToast('Scan completed successfully!');
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
  }, [showToast, loadProjects, loadHistory]);

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
    showToast('Asking AI to review existing findings...');

    try {
      const response = await fetch('/api/re-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportPath: report._savedAt,
          mockAi: false,
        }),
      });
      const data = await response.json();

      if (data.success && data.report) {
        setCurrentReport(data.report);
        await loadHistory(data.report._project || '', false);
        showToast('AI suggestions updated for this report.');
      } else {
        showToast(data.error || 'AI re-analysis failed', 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`AI re-analysis failed: ${message}`, 'error');
    } finally {
      setIsReResolving(false);
    }
  }, [showToast, loadHistory, setCurrentReport]);

  return {
    isScanning,
    scanStatus,
    scanLogs,
    elapsedTime,
    isReResolving,
    handleStartScan,
    handleCancelScan,
    handleReResolve,
    formatTime,
  };
}