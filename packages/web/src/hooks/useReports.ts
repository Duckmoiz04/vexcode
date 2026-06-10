import { useState, useCallback, useEffect } from 'react';
import type { Project, ReportListItem, Report } from '../types';

export function useReports(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);

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

  const loadReport = useCallback(async (project: string, reportId: string) => {
    try {
      const res = await fetch(`/api/report/${project}/${reportId}`);
      const data = await res.json();
      setCurrentReport(data || null);
    } catch (err) {
      console.error('Failed to load report:', err);
      showToast('Error loading report data', 'error');
    }
  }, [showToast]);

  const handleSelectProject = useCallback(async (project: string | null) => {
    setCurrentProject(project);
    setCurrentReportId(null);
    setCurrentReport(null);

    if (project) {
      await loadHistory(project);
    }
  }, [loadHistory]);

  // Watch currentReportId changes to load report details
  useEffect(() => {
    if (currentProject && currentReportId) {
      loadReport(currentProject, currentReportId);
    } else {
      setCurrentReport(null);
    }
  }, [currentProject, currentReportId, loadReport]);

  return {
    currentProject,
    projects,
    reports,
    currentReportId,
    currentReport,
    setCurrentReport,
    loadProjects,
    loadHistory,
    loadReport,
    handleSelectProject,
    setCurrentReportId,
  };
}