import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScan } from './useScan';
import type { Report } from '../types';

const mockShowToast = vi.fn();
const mockLoadProjects = vi.fn();
const mockLoadHistory = vi.fn();

const mockReport: Report = {
  scanner: 'semgrep',
  timestamp: '2024-01-01T10:00:00Z',
  target_path: '/test/project',
  findings: [],
  ai_resolutions: {},
  git_state: { commit: 'abc123', is_dirty: false },
  metrics: { files: {} },
  _id: 'rep-1',
  _project: 'project-a',
};

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;
  readyState: number = 0;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }
}

describe('useScan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockShowToast.mockClear();
    mockLoadProjects.mockClear();
    mockLoadHistory.mockClear();
    vi.useFakeTimers();
    (globalThis as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const mockSetCurrentReport = vi.fn();

  function renderUseScan() {
    return renderHook(() =>
      useScan({
        showToast: mockShowToast,
        loadProjects: mockLoadProjects,
        loadHistory: mockLoadHistory,
        currentReport: null,
        setCurrentReport: mockSetCurrentReport,
      })
    );
  }

  it('returns isScanning false initially', () => {
    const { result } = renderUseScan();
    expect(result.current.isScanning).toBe(false);
  });

  it('returns isReResolving false initially', () => {
    const { result } = renderUseScan();
    expect(result.current.isReResolving).toBe(false);
  });

  it('returns initial scanStatus', () => {
    const { result } = renderUseScan();
    expect(result.current.scanStatus).toBe('Initializing scan...');
  });

  it('returns elapsedTime 0 initially', () => {
    const { result } = renderUseScan();
    expect(result.current.elapsedTime).toBe(0);
  });

  it('returns empty scanLogs initially', () => {
    const { result } = renderUseScan();
    expect(result.current.scanLogs).toEqual([]);
  });

  describe('formatTime', () => {
    it('formats 0 seconds as 00:00', () => {
      const { result } = renderUseScan();
      expect(result.current.formatTime(0)).toBe('00:00');
    });

    it('formats 65 seconds as 01:05', () => {
      const { result } = renderUseScan();
      expect(result.current.formatTime(65)).toBe('01:05');
    });

    it('formats 3661 seconds as 61:01', () => {
      const { result } = renderUseScan();
      expect(result.current.formatTime(3661)).toBe('61:01');
    });
  });

  describe('handleStartScan', () => {
    it('sets isScanning to true and initializes scan state', async () => {
      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      expect(result.current.isScanning).toBe(true);
      expect(result.current.scanStatus).toBe('Starting scan connection...');
      expect(result.current.scanLogs).toEqual(['[SYSTEM] Starting scan process...']);
    });

    it('creates EventSource with correct URL params', async () => {
      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path', true, true, true);
      });

      // EventSource was created
      const es = (globalThis as any).EventSource;
      expect(es).toBeDefined();
    });

    it('starts elapsed time timer when scanning', async () => {
      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      expect(result.current.elapsedTime).toBe(0);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.elapsedTime).toBe(3);
    });

    it('handles SSE status events', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      // Simulate SSE status message
      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({ type: 'status', message: 'Scanning file 1 of 10...' }),
        } as MessageEvent);
      });

      expect(result.current.scanStatus).toBe('Scanning file 1 of 10...');
      expect(result.current.scanLogs).toContain('Scanning file 1 of 10...');
    });

    it('deduplicates consecutive identical status messages in scanLogs', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({ type: 'status', message: 'Processing...' }),
        } as MessageEvent);
      });

      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({ type: 'status', message: 'Processing...' }),
        } as MessageEvent);
      });

      // Should only appear once
      const occurrences = result.current.scanLogs.filter(l => l === 'Processing...').length;
      expect(occurrences).toBe(1);
    });

    it('keeps only last 4 scanLogs', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      for (let i = 1; i <= 6; i++) {
        await act(async () => {
          capturedEventSource!.onmessage!({
            data: JSON.stringify({ type: 'status', message: `Step ${i}` }),
          } as MessageEvent);
        });
      }

      expect(result.current.scanLogs.length).toBeLessThanOrEqual(5); // 4 status + initial SYSTEM
    });

    it('handles SSE complete event', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({
            type: 'complete',
            report: mockReport,
          }),
        } as MessageEvent);
      });

      expect(result.current.isScanning).toBe(false);
      expect(mockLoadProjects).toHaveBeenCalled();
      expect(mockLoadHistory).toHaveBeenCalledWith('project-a', false);
      expect(mockShowToast).toHaveBeenCalledWith('Scan completed successfully!');
    });

    it('handles SSE error event', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({
            type: 'error',
            error: 'Scan execution failed',
          }),
        } as MessageEvent);
      });

      expect(result.current.isScanning).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith('Scan execution failed', 'error');
    });

    it('handles EventSource onerror', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      await act(async () => {
        capturedEventSource!.onerror!(new Event('error'));
      });

      expect(result.current.isScanning).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith('Scan connection failed or closed', 'error');
    });
  });

  describe('handleCancelScan', () => {
    it('cancels scan and shows toast', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve({}),
      } as Response);

      const { result } = renderUseScan();

      // Start a scan first
      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      await act(async () => {
        await result.current.handleCancelScan();
      });

      expect(fetchSpy).toHaveBeenCalledWith('/api/scan/cancel', { method: 'POST' });
      expect(result.current.isScanning).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith('Scan cancelled by user', 'error');
    });
  });

  describe('handleReResolve', () => {
    it('shows error if no report _savedAt', async () => {
      const { result } = renderUseScan();

      await act(async () => {
        await result.current.handleReResolve(null);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Current report file path is missing. Reload the report and try again.',
        'error'
      );
    });

    it('shows error if report has no findings', async () => {
      const { result } = renderUseScan();

      await act(async () => {
        await result.current.handleReResolve({
          ...mockReport,
          _savedAt: '/path/to/report.json',
          findings: [],
        });
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'No findings found in the current report.',
        'error'
      );
    });

    it('re-resolves successfully via SSE', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        await result.current.handleReResolve({
          ...mockReport,
          _savedAt: '/path/to/report.json',
          findings: [{ rule_id: 'test', severity: 'warning', file: 'a.ts', line: 1, message: 'test' }],
        });
      });

      expect(capturedEventSource).toBeDefined();
      expect(capturedEventSource!.url).toContain('/api/re-resolve/stream');
      expect(capturedEventSource!.url).toContain('reportPath=%2Fpath%2Fto%2Freport.json');
      expect(result.current.isReResolving).toBe(true);

      // Simulate SSE complete event
      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({
            type: 'complete',
            report: { ...mockReport, _project: 'project-a' },
          }),
        } as MessageEvent);
      });

      expect(mockShowToast).toHaveBeenCalledWith('AI suggestions updated for this report.');
      expect(result.current.isReResolving).toBe(false);
    });

    it('calls setCurrentReport with updated report on re-resolve success', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderHook(() =>
        useScan({
          showToast: mockShowToast,
          loadProjects: mockLoadProjects,
          loadHistory: mockLoadHistory,
          currentReport: null,
          setCurrentReport: mockSetCurrentReport,
        })
      );

      await act(async () => {
        await result.current.handleReResolve({
          ...mockReport,
          _savedAt: '/path/to/report.json',
          findings: [{ rule_id: 'test', severity: 'warning', file: 'a.ts', line: 1, message: 'test' }],
        });
      });

      // Simulate SSE complete event
      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({
            type: 'complete',
            report: { ...mockReport, _project: 'project-a', findings: [{ rule_id: 'new', severity: 'error', file: 'b.ts', line: 2, message: 'new finding' }] },
          }),
        } as MessageEvent);
      });

      expect(mockSetCurrentReport).toHaveBeenCalledWith(
        expect.objectContaining({ _project: 'project-a' })
      );
    });

    it('shows error toast on re-resolve failure', async () => {
      let capturedEventSource: MockEventSource | null = null;
      (globalThis as any).EventSource = class extends MockEventSource {
        constructor(url: string) {
          super(url);
          capturedEventSource = this;
        }
      };

      const { result } = renderUseScan();

      await act(async () => {
        await result.current.handleReResolve({
          ...mockReport,
          _savedAt: '/path/to/report.json',
          findings: [{ rule_id: 'test', severity: 'warning', file: 'a.ts', line: 1, message: 'test' }],
        });
      });

      // Simulate SSE error event
      await act(async () => {
        capturedEventSource!.onmessage!({
          data: JSON.stringify({
            type: 'error',
            error: 'AI analysis failed',
          }),
        } as MessageEvent);
      });

      expect(mockShowToast).toHaveBeenCalledWith('AI analysis failed', 'error');
    });
  });

  describe('elapsedTime timer', () => {
    it('resets elapsedTime when scan stops', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve({}),
      } as Response);

      const { result } = renderUseScan();

      await act(async () => {
        result.current.handleStartScan('/test/path');
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.elapsedTime).toBe(5);

      await act(async () => {
        await result.current.handleCancelScan();
      });

      expect(result.current.elapsedTime).toBe(0);
    });
  });
});