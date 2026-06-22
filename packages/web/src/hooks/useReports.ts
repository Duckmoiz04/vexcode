import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';
import type { Project, ReportListItem, Report, PaginationInfo } from '../types';

const DEFAULT_PAGE_SIZE = 50;

export function useReports(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadProjects = useCallback(async () => {
    try {
      const res = await apiFetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
      } else {
        console.error('Failed to load projects:', data.error || 'Unknown error');
        showToast(data.error || 'Error loading projects list', 'error');
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      showToast('Error loading projects list', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadHistory = useCallback(async (project: string, autoSelectLatest = true) => {
    try {
      const res = await apiFetch(`/api/reports/${project}`);
      const data = await res.json();
      if (data.success) {
        const reportList = data.reports || [];
        setReports(reportList);
        if (autoSelectLatest && reportList.length > 0) {
          setCurrentReportId(reportList[0].id);
        }
      } else {
        console.error('Failed to load project history:', data.error || 'Unknown error');
        setReports([]);
        showToast(data.error || 'Error loading project reports history', 'error');
      }
    } catch (err) {
      console.error('Failed to load project history:', err);
      showToast('Error loading project reports history', 'error');
    }
  }, [showToast]);

  const loadReport = useCallback(async (project: string, reportId: string, page?: number) => {
    try {
      const pageNum = page ?? currentPage;
      const url = pageSize > 0
        ? `/api/report/${project}/${reportId}?page=${pageNum}&pageSize=${pageSize}`
        : `/api/report/${project}/${reportId}`;
      const res = await apiFetch(url);
      const data = await res.json() as Report & { _pagination?: PaginationInfo };
      setCurrentReport(data ?? null);
      if (data?._pagination) {
        setPagination(data._pagination);
      } else {
        setPagination(null);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
      showToast('Error loading report data', 'error');
    }
  }, [showToast, pageSize, currentPage]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleSelectProject = useCallback(async (project: string | null) => {
    setCurrentProject(project);
    setCurrentReportId(null);
    setCurrentReport(null);
    setCurrentPage(1);
    setPagination(null);

    if (project) {
      await loadHistory(project);
    }
  }, [loadHistory]);

  // Watch currentReportId or currentPage changes to load report details
  useEffect(() => {
    if (currentProject && currentReportId) {
      loadReport(currentProject, currentReportId, currentPage);
    } else {
      setCurrentReport(null);
    }
  }, [currentProject, currentReportId, currentPage, loadReport]);

  return {
    currentProject,
    projects,
    reports,
    currentReportId,
    currentReport,
    pagination,
    currentPage,
    pageSize,
    setCurrentReport,
    setCurrentReportId,
    loadProjects,
    loadHistory,
    loadReport,
    handleSelectProject,
    handlePageChange,
    handleSetPageSize,
  };
}