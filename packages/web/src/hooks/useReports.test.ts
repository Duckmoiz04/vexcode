import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReports } from './useReports';
import type { Project, ReportListItem, Report } from '../types';

const mockShowToast = vi.fn();

const mockProjects: Project[] = [
  { name: 'project-a', reportCount: 3, latestReport: { id: 'r1', timestamp: '2024-01-01', findings: 5 } },
  { name: 'project-b', reportCount: 1, latestReport: { id: 'r2', timestamp: '2024-02-01', findings: 2 } },
];

const mockReportList: ReportListItem[] = [
  { id: 'rep-1', timestamp: '2024-01-01T10:00:00Z', findings: 10 },
  { id: 'rep-2', timestamp: '2024-01-02T10:00:00Z', findings: 5 },
];

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

describe('useReports', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockShowToast.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderUseReports() {
    return renderHook(() => useReports(mockShowToast));
  }

  it('returns null currentProject initially', () => {
    const { result } = renderUseReports();
    expect(result.current.currentProject).toBeNull();
  });

  it('returns empty projects initially', () => {
    const { result } = renderUseReports();
    expect(result.current.projects).toEqual([]);
  });

  it('returns empty reports initially', () => {
    const { result } = renderUseReports();
    expect(result.current.reports).toEqual([]);
  });

  it('returns null currentReportId initially', () => {
    const { result } = renderUseReports();
    expect(result.current.currentReportId).toBeNull();
  });

  it('returns null currentReport initially', () => {
    const { result } = renderUseReports();
    expect(result.current.currentReport).toBeNull();
  });

  describe('loadProjects', () => {
    it('fetches /api/reports and sets projects', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, projects: mockProjects }),
      } as Response);

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadProjects();
      });

      expect(result.current.projects).toEqual(mockProjects);
    });

    it('shows error toast on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadProjects();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Error loading projects list', 'error');
    });
  });

  describe('loadHistory', () => {
    it('fetches /api/reports/{project} and sets reports', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, reports: mockReportList }),
        } as Response);

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadHistory('project-a');
      });

      expect(result.current.reports).toEqual(mockReportList);
    });

    it('auto-selects latest report when autoSelectLatest is true', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, reports: mockReportList }),
        } as Response);

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadHistory('project-a', true);
      });

      expect(result.current.currentReportId).toBe('rep-1');
    });

    it('does not auto-select when autoSelectLatest is false', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, reports: mockReportList }),
        } as Response);

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadHistory('project-a', false);
      });

      expect(result.current.currentReportId).toBeNull();
    });

    it('clears reports on unsuccessful response', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false }),
        } as Response);

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadHistory('project-a');
      });

      expect(result.current.reports).toEqual([]);
    });

    it('shows error toast on failure', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadHistory('project-a');
      });

      expect(mockShowToast).toHaveBeenCalledWith('Error loading project reports history', 'error');
    });
  });

  describe('loadReport', () => {
    it('fetches /api/report/{project}/{id} and sets currentReport', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockReport),
        } as Response);

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadReport('project-a', 'rep-1');
      });

      expect(result.current.currentReport).toEqual(mockReport);
    });

    it('shows error toast on failure', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.loadReport('project-a', 'rep-1');
      });

      expect(mockShowToast).toHaveBeenCalledWith('Error loading report data', 'error');
    });
  });

  describe('handleSelectProject', () => {
    it('sets currentProject and clears report state', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, reports: mockReportList }),
        } as Response);

      const { result } = renderUseReports();

      await act(async () => {
        await result.current.handleSelectProject('project-a');
      });

      expect(result.current.currentProject).toBe('project-a');
      expect(result.current.currentReport).toBeNull();
      expect(result.current.currentReportId).toBe('rep-1');
    });

    it('clears everything when project is null', async () => {
      const { result } = renderUseReports();

      await act(async () => {
        await result.current.handleSelectProject(null);
      });

      expect(result.current.currentProject).toBeNull();
      expect(result.current.currentReport).toBeNull();
      expect(result.current.currentReportId).toBeNull();
    });
  });

  describe('setCurrentReportId', () => {
    it('updates currentReportId', () => {
      const { result } = renderUseReports();

      act(() => {
        result.current.setCurrentReportId('rep-2');
      });

      expect(result.current.currentReportId).toBe('rep-2');
    });
  });

  describe('currentReportId watcher', () => {
    it('loads report when currentProject and currentReportId are set', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, projects: [] }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, reports: mockReportList }),
        } as Response)
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockReport),
        } as Response);

      const { result } = renderUseReports();

      // Set project first
      await act(async () => {
        await result.current.handleSelectProject('project-a');
      });

      // The watcher should have triggered loadReport
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/report/project-a/rep-1');
      });
    });
  });
});