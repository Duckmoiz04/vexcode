const API_BASE = '';

// State
let currentProject = null;
let currentReportId = null;
let currentReport = null;
let selectedFindingIndex = null;
let selectedFilePath = null;

// DOM Elements
const scanBtn = document.getElementById('scanBtn');
const settingsBtn = document.getElementById('settingsBtn');
const projectSelectorBtn = document.getElementById('projectSelectorBtn');
const projectDropdown = document.getElementById('projectDropdown');
const projectList = document.getElementById('projectList');
const projectCount = document.getElementById('projectCount');
const currentProjectName = document.getElementById('currentProjectName');
const historySelect = document.getElementById('historySelect');
const codeTree = document.getElementById('codeTree');
const findingCount = document.getElementById('findingCount');
const findingsList = document.getElementById('findingsList');
const detailEmpty = document.getElementById('detailEmpty');
const detailContent = document.getElementById('detailContent');
const detailSeverity = document.getElementById('detailSeverity');
const detailRuleId = document.getElementById('detailRuleId');
const detailStatus = document.getElementById('detailStatus');
const detailFile = document.getElementById('detailFile');
const detailLine = document.getElementById('detailLine');
const detailMessage = document.getElementById('detailMessage');
const astContext = document.getElementById('astContext');
const astSymbol = document.getElementById('astSymbol');
const astKind = document.getElementById('astKind');
const callersSection = document.getElementById('callersSection');
const callersList = document.getElementById('callersList');
const blastSection = document.getElementById('blastSection');
const blastCount = document.getElementById('blastCount');
const suggestionText = document.getElementById('suggestionText');
const diffViewer = document.getElementById('diffViewer');
const diffOriginal = document.getElementById('diffOriginal');
const diffRemediation = document.getElementById('diffRemediation');
const applyBtn = document.getElementById('applyBtn');
const scanOverlay = document.getElementById('scanOverlay');
const scanStatus = document.getElementById('scanStatus');
const drawerOverlay = document.getElementById('drawerOverlay');
const settingsDrawer = document.getElementById('settingsDrawer');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const apiKey = document.getElementById('apiKey');
const apiBaseUrl = document.getElementById('apiBaseUrl');
const providerButtons = document.getElementById('providerButtons');
const aiModel = document.getElementById('aiModel');
const aiTemperature = document.getElementById('aiTemperature');
const aiMaxTokens = document.getElementById('aiMaxTokens');
const baseUrlHint = document.getElementById('baseUrlHint');
const semgrepRules = document.getElementById('semgrepRules');
const onboardingScreen = document.getElementById('onboardingScreen');
const onboardingProjects = document.getElementById('onboardingProjects');
const onboardingTargetPath = document.getElementById('onboardingTargetPath');
const onboardingMockScan = document.getElementById('onboardingMockScan');
const onboardingMockAi = document.getElementById('onboardingMockAi');
const onboardingScanBtn = document.getElementById('onboardingScanBtn');

// Advanced toggle elements
const advancedToggle = document.getElementById('advancedToggle');
const advancedContent = document.getElementById('advancedContent');

// Test connection elements
const testConnectionBtn = document.getElementById('testConnectionBtn');
const testConnectionStatus = document.getElementById('testConnectionStatus');

// Chat elements
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

// Chat state
let chatHistory = [];
let isChatLoading = false;

// Current selected provider
let selectedProvider = 'openai';

// Provider config data
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    configKey: 'openai',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
      { id: 'gpt-4o', name: 'GPT-4o (Balanced)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (Advanced)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Legacy)' }
    ],
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  anthropic: {
    name: 'Anthropic',
    configKey: 'anthropic',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet (Balanced)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Advanced)' }
    ],
    defaultBaseUrl: 'https://api.anthropic.com'
  },
  google: {
    name: 'Google',
    configKey: 'google',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Advanced)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Latest)' }
    ],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com'
  },
  '9router': {
    name: '9router',
    configKey: '9router',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
      { id: 'openai/gpt-4o', name: 'GPT-4o (Balanced)' },
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo (Advanced)' },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (Fast)' },
      { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet (Balanced)' }
    ],
    defaultBaseUrl: 'http://localhost:20128/v1'
  }
};

// API Helpers
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.statusText}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Toast Notifications
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format timestamp
function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Load Projects
async function loadProjects() {
  try {
    const data = await apiGet('/api/reports');
    const projects = data.projects || [];

    projectCount.textContent = projects.length;

    if (projects.length === 0) {
      projectList.innerHTML = '<div class="empty-state-small">No projects scanned yet</div>';
      if (onboardingProjects) {
        onboardingProjects.innerHTML = '<div class="empty-state-small">No projects scanned yet</div>';
      }
      return;
    }

    projectList.innerHTML = projects.map(p => `
      <div class="project-item ${p.name === currentProject ? 'active' : ''}" data-project="${p.name}">
        <span class="project-item-name">${escapeHtml(p.name)}</span>
        <span class="project-item-count">${p.reportCount} scan(s)</span>
      </div>
    `).join('');

    projectList.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', () => {
        selectProject(item.dataset.project);
        projectDropdown.classList.remove('active');
      });
    });

    if (onboardingProjects) {
      onboardingProjects.innerHTML = projects.map(p => {
        const timestamp = p.latestReport?.timestamp ? formatTime(p.latestReport.timestamp) : 'N/A';
        return `
          <div class="onboarding-project-card" data-project="${escapeHtml(p.name)}">
            <div class="onboarding-project-info">
              <span class="onboarding-project-name">${escapeHtml(p.name)}</span>
              <span class="onboarding-project-meta">${p.reportCount} scan(s) • Last scan: ${timestamp}</span>
            </div>
            <svg class="onboarding-project-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        `;
      }).join('');

      onboardingProjects.querySelectorAll('.onboarding-project-card').forEach(card => {
        card.addEventListener('click', () => {
          selectProject(card.dataset.project);
        });
      });
    }
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

// Select Project
async function selectProject(projectName) {
  currentProject = projectName;
  currentProjectName.textContent = projectName || 'Select Project';
  currentReportId = null;

  // Update project list selection
  projectList.querySelectorAll('.project-item').forEach(item => {
    item.classList.toggle('active', item.dataset.project === projectName);
  });

  if (!projectName) {
    // Show onboarding screen
    onboardingScreen.classList.remove('fade-out');
    onboardingScreen.style.display = 'flex';

    // Clear findings list and details
    findingsList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 12l2 2 4-4"/>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No findings yet</p>
        <span>Click "Scan Project" to start</span>
      </div>
    `;
    findingCount.textContent = '0';
    detailEmpty.style.display = 'flex';
    const detailDashboard = document.getElementById('detailDashboard');
    if (detailDashboard) detailDashboard.style.display = 'none';
    detailContent.style.display = 'none';

    await loadHistory(null);
    await loadProjects();
  } else {
    // Hide onboarding screen with transition
    onboardingScreen.classList.add('fade-out');
    setTimeout(() => {
      if (currentProject === projectName) {
        onboardingScreen.style.display = 'none';
      }
    }, 300);

    await loadHistory(projectName);
  }
}

// Load History for a project
async function loadHistory(projectName) {
  if (!projectName) {
    historySelect.innerHTML = '<option value="">Select version...</option>';
    if (codeTree) {
      codeTree.innerHTML = '<div class="empty-state">No files indexed</div>';
    }
    return;
  }

  try {
    const data = await apiGet(`/api/reports/${projectName}`);
    const reports = data.reports || [];

    if (reports.length === 0) {
      historySelect.innerHTML = '<option value="">No history found</option>';
      if (codeTree) {
        codeTree.innerHTML = '<div class="empty-state">No files indexed</div>';
      }
      return;
    }

    historySelect.innerHTML = reports.map(r => {
      const timeStr = r.id.replace('report_', '').replace(/-/g, (m, i) => i > 10 ? ':' : i > 7 ? '-' : ' ');
      return `<option value="${r.id}">${timeStr} (${r.findings} findings)</option>`;
    }).join('');

    // Auto-select latest report
    if (reports.length > 0) {
      historySelect.value = reports[0].id;
      loadReport(projectName, reports[0].id);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
    historySelect.innerHTML = '<option value="">Error loading history</option>';
  }
}

// Load Report
async function loadReport(projectName, reportId) {
  try {
    const report = await apiGet(`/api/report/${projectName}/${reportId}`);
    currentProject = projectName;
    currentReportId = reportId;
    currentReport = report;
    selectedFindingIndex = null;
    selectedFilePath = null;

    // Build and render Code File Tree
    renderCodeTree(report.findings);

    // Initial render of all findings
    renderFindings(report.findings);
    
    // Show stats dashboard
    showDashboard(report);
  } catch (err) {
    console.error('Failed to load report:', err);
    showToast('Failed to load report', 'error');
  }
}

// Show statistics dashboard for the report
function showDashboard(report) {
  if (!report) return;

  const findings = report.findings || [];
  const errorCount = findings.filter(f => (f.severity || '').toLowerCase() === 'error').length;
  const warningCount = findings.filter(f => (f.severity || '').toLowerCase() === 'warning').length;
  const infoCount = findings.filter(f => (f.severity || '').toLowerCase() === 'info').length;
  const totalCount = findings.length;

  // Update DOM metrics
  const dbProj = document.getElementById('dashboardProjectName');
  if (dbProj) dbProj.textContent = report._project || currentProject || 'Project';
  
  const mTotal = document.getElementById('metricTotal');
  if (mTotal) mTotal.textContent = totalCount;
  
  const mError = document.getElementById('metricError');
  if (mError) mError.textContent = errorCount;
  
  const mWarning = document.getElementById('metricWarning');
  if (mWarning) mWarning.textContent = warningCount;
  
  const mInfo = document.getElementById('metricInfo');
  if (mInfo) mInfo.textContent = infoCount;

  // Update SVG Donut chart
  updateDonutChart(errorCount, warningCount, infoCount);

  // Calculate top affected files
  const fileCounts = {};
  findings.forEach(f => {
    fileCounts[f.file] = (fileCounts[f.file] || 0) + 1;
  });

  const sortedFiles = Object.keys(fileCounts)
    .map(file => ({ file, count: fileCounts[file] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const topFilesList = document.getElementById('topFilesList');
  if (topFilesList) {
    if (sortedFiles.length === 0) {
      topFilesList.innerHTML = '<div class="empty-state-small">No affected files</div>';
    } else {
      topFilesList.innerHTML = sortedFiles.map(sf => {
        const displayFile = getRelativePath(sf.file, report.target_path);
        return `
          <div class="top-file-item" style="cursor: pointer;" data-path="${escapeHtml(sf.file)}">
            <span class="top-file-name" title="${escapeHtml(sf.file)}">${escapeHtml(displayFile)}</span>
            <span class="top-file-count">${sf.count} issue(s)</span>
          </div>
        `;
      }).join('');

      // Click listener to select file from top files list
      topFilesList.querySelectorAll('.top-file-item').forEach(item => {
        item.addEventListener('click', () => {
          const path = item.dataset.path;
          const treeFile = codeTree.querySelector(`[data-path="${CSS.escape(path)}"]`);
          codeTree.querySelectorAll('.tree-file').forEach(f => f.classList.remove('active'));
          if (treeFile) {
            treeFile.classList.add('active');
            treeFile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          selectedFilePath = path;
          filterFindingsByFile(path);
        });
      });
    }
  }

  // Toggle display
  const detailDashboard = document.getElementById('detailDashboard');
  if (detailDashboard) detailDashboard.style.display = 'flex';
  if (detailEmpty) detailEmpty.style.display = 'none';
  if (detailContent) detailContent.style.display = 'none';
}

// Update donut chart segments
function updateDonutChart(errorCount, warningCount, infoCount) {
  const total = errorCount + warningCount + infoCount;
  const donutTotal = document.getElementById('donutTotal');
  if (donutTotal) donutTotal.textContent = total;

  const errorSeg = document.querySelector('.donut-segment-error');
  const warningSeg = document.querySelector('.donut-segment-warning');
  const infoSeg = document.querySelector('.donut-segment-info');

  if (total === 0) {
    if (errorSeg) errorSeg.setAttribute('stroke-dasharray', '0 100');
    if (warningSeg) warningSeg.setAttribute('stroke-dasharray', '0 100');
    if (infoSeg) infoSeg.setAttribute('stroke-dasharray', '0 100');
    return;
  }

  const errorPct = (errorCount / total) * 100;
  const warningPct = (warningCount / total) * 100;
  const infoPct = (infoCount / total) * 100;

  let offset = 25; // 12 o'clock start offset

  if (errorSeg) {
    errorSeg.setAttribute('stroke-dasharray', `${errorPct} ${100 - errorPct}`);
    errorSeg.setAttribute('stroke-dashoffset', offset);
    offset -= errorPct;
  }

  if (warningSeg) {
    warningSeg.setAttribute('stroke-dasharray', `${warningPct} ${100 - warningPct}`);
    warningSeg.setAttribute('stroke-dashoffset', offset);
    offset -= warningPct;
  }

  if (infoSeg) {
    infoSeg.setAttribute('stroke-dasharray', `${infoPct} ${100 - infoPct}`);
    infoSeg.setAttribute('stroke-dashoffset', offset);
  }
}

// Build directory tree structure from findings file paths
function buildFileTree(findings) {
  const root = { name: currentProject || 'Project', type: 'folder', path: '', children: {} };
  const targetPath = currentReport?.target_path;

  findings.forEach((finding, index) => {
    const relPath = getRelativePath(finding.file, targetPath);
    const parts = relPath.split('/');
    
    let current = root;
    let accumulatedPath = '';

    parts.forEach((part, i) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            type: 'file',
            path: finding.file,
            indices: []
          };
        }
        current.children[part].indices.push(index);
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            type: 'folder',
            path: accumulatedPath,
            children: {}
          };
        }
        current = current.children[part];
      }
    });
  });

  return root;
}

// Recursively render tree node to HTML
function renderTreeNode(node, depth = 0) {
  const indent = depth * 12;
  const style = `padding-left: ${indent + 8}px;`;

  if (node.type === 'file') {
    const findingsCount = node.indices.length;
    const isActive = node.path === selectedFilePath;
    return `
      <div class="tree-item tree-file ${isActive ? 'active' : ''}" data-path="${escapeHtml(node.path)}" style="${style}">
        <svg class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span class="tree-name">${escapeHtml(node.name)}</span>
        <span class="tree-badge">${findingsCount}</span>
      </div>
    `;
  } else {
    const childKeys = Object.keys(node.children).sort((a, b) => {
      const nodeA = node.children[a];
      const nodeB = node.children[b];
      if (nodeA.type !== nodeB.type) {
        return nodeA.type === 'folder' ? -1 : 1;
      }
      return a.localeCompare(b);
    });

    const childrenHtml = childKeys.map(key => renderTreeNode(node.children[key], depth + 1)).join('');
    
    if (node.path === '') {
      return childrenHtml;
    }

    return `
      <div class="tree-folder-container">
        <div class="tree-item tree-folder expanded" data-path="${escapeHtml(node.path)}" style="${style}">
          <svg class="tree-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
          <svg class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="tree-name">${escapeHtml(node.name)}</span>
        </div>
        <div class="tree-folder-children">
          ${childrenHtml}
        </div>
      </div>
    `;
  }
}

// Render the code explorer tree UI
function renderCodeTree(findings) {
  if (!findings || findings.length === 0) {
    codeTree.innerHTML = '<div class="empty-state-small">No files indexed</div>';
    return;
  }

  const treeData = buildFileTree(findings);
  codeTree.innerHTML = renderTreeNode(treeData);

  // Setup click listeners for folder toggles
  codeTree.querySelectorAll('.tree-folder').forEach(folder => {
    folder.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = folder.closest('.tree-folder-container');
      const children = container.querySelector('.tree-folder-children');
      const isExpanded = folder.classList.contains('expanded');
      
      if (isExpanded) {
        folder.classList.remove('expanded');
        children.style.display = 'none';
      } else {
        folder.classList.add('expanded');
        children.style.display = 'block';
      }
    });
  });

  // Setup click listeners for file selection
  codeTree.querySelectorAll('.tree-file').forEach(fileItem => {
    fileItem.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = fileItem.dataset.path;
      
      codeTree.querySelectorAll('.tree-file').forEach(f => f.classList.remove('active'));
      fileItem.classList.add('active');

      selectedFilePath = path;
      filterFindingsByFile(path);
    });
  });
}

// Filter findings sidebar list by selected file path
function filterFindingsByFile(path) {
  if (!currentReport || !currentReport.findings) return;
  const filtered = currentReport.findings.filter(f => f.file === path);
  renderFindings(filtered, path);
}

// Render Findings List
function renderFindings(findings, filterPath = null) {
  if (!findings || findings.length === 0) {
    findingsList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 12l2 2 4-4"/>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No findings</p>
        <span>Code looks clean!</span>
      </div>
    `;
    findingCount.textContent = '0';
    return;
  }

  findingCount.textContent = findings.length;

  let headerHtml = '';
  if (filterPath) {
    const filename = filterPath.split('/').pop();
    headerHtml = `
      <div class="findings-filter-header">
        <span>File: ${escapeHtml(filename)}</span>
        <button class="btn-clear-filter" id="clearFilterBtn" title="Clear Filter">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }

  const itemsHtml = findings.map(f => {
    const originalIndex = currentReport.findings.indexOf(f);
    const severity = (f.severity || '').toLowerCase();
    const isActive = originalIndex === selectedFindingIndex;
    const isApplied = f._applied;
    const relFile = getRelativePath(f.file, currentReport?.target_path);

    return `
      <div class="finding-card ${isActive ? 'active' : ''}" data-index="${originalIndex}">
        <div class="finding-card-header">
          <span class="severity-dot ${severity}"></span>
          <span class="finding-rule">${escapeHtml(f.rule_id)}</span>
          <span class="finding-status ${isApplied ? 'applied' : ''}">${isApplied ? 'Applied' : 'Pending'}</span>
        </div>
        <div class="finding-file">${escapeHtml(relFile)}:${f.line}</div>
      </div>
    `;
  }).join('');

  findingsList.innerHTML = headerHtml + '<div class="findings-cards-container">' + itemsHtml + '</div>';

  findingsList.querySelectorAll('.finding-card').forEach(card => {
    card.addEventListener('click', () => {
      const index = parseInt(card.dataset.index);
      selectFinding(index);
    });
  });

  const clearFilterBtn = document.getElementById('clearFilterBtn');
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFilePath = null;
      codeTree.querySelectorAll('.tree-file').forEach(f => f.classList.remove('active'));
      renderFindings(currentReport.findings);
      showDashboard(currentReport);
    });
  }
}

// Select Finding
async function selectFinding(index) {
  selectedFindingIndex = index;
  const finding = currentReport.findings[index];
  if (!finding) return;

  // Update sidebar selection
  findingsList.querySelectorAll('.finding-card').forEach((card, i) => {
    card.classList.toggle('active', i === index);
  });

  // Show detail panel, hide dashboard
  const detailDashboard = document.getElementById('detailDashboard');
  if (detailDashboard) detailDashboard.style.display = 'none';
  detailEmpty.style.display = 'none';
  detailContent.style.display = 'block';

  // Severity icon
  const severity = (finding.severity || '').toLowerCase();
  detailSeverity.className = `severity-icon ${severity}`;
  detailSeverity.textContent = severity === 'error' ? '!' : severity === 'warning' ? '?' : 'i';

  detailRuleId.textContent = finding.rule_id;
  detailStatus.textContent = finding._applied ? 'Applied' : 'Pending';
  detailStatus.className = `finding-status ${finding._applied ? 'applied' : ''}`;
  detailFile.textContent = getRelativePath(finding.file, currentReport?.target_path);
  detailLine.textContent = finding.line;
  detailMessage.textContent = finding.message;

  // AST Context
  if (finding.ast_context) {
    astContext.style.display = 'block';
    const ast = finding.ast_context;
    astSymbol.textContent = ast.symbol_name || '-';
    astKind.textContent = ast.kind || '-';

    if (ast.callers && ast.callers.length > 0) {
      callersSection.style.display = 'block';
      callersList.innerHTML = ast.callers
        .map(c => `<span class="caller-tag">${escapeHtml(c.name)}</span>`)
        .join('');
    } else {
      callersSection.style.display = 'none';
    }

    if (ast.blast_radius && ast.blast_radius.length > 0) {
      blastSection.style.display = 'flex';
      blastCount.textContent = `${ast.blast_radius.length} affected symbol(s)`;
    } else {
      blastSection.style.display = 'none';
    }
  } else {
    astContext.style.display = 'none';
  }

  // AI Suggestion
  const resolution = currentReport.ai_resolutions?.[finding.rule_id];
  if (resolution) {
    suggestionText.textContent = resolution.suggestion || 'No suggestion available.';
  } else {
    suggestionText.textContent = 'No AI suggestion available.';
  }

  // Diff Viewer
  await renderDiff(finding, resolution);

  // Reset and enable chat
  resetChat();
  enableChat(finding);
}

// Build context string from finding for chat
function buildFindingContext(finding) {
  let context = `Vulnerability Details:\n`;
  context += `- Rule ID: ${finding.rule_id}\n`;
  context += `- Severity: ${finding.severity}\n`;
  context += `- File: ${finding.file}\n`;
  context += `- Line: ${finding.line}\n`;
  context += `- Message: ${finding.message}\n`;

  if (finding.ast_context) {
    const ast = finding.ast_context;
    context += `\nAST Context:\n`;
    context += `- Symbol: ${ast.symbol_name} (${ast.kind})\n`;

    if (ast.source_code) {
      context += `- Source Code:\n\`\`\`\n${ast.source_code}\`\`\`\n`;
    }

    if (ast.callers && ast.callers.length > 0) {
      context += `- Callers: ${ast.callers.map(c => `${c.name} in ${c.filePath}`).join(', ')}\n`;
    }

    if (ast.blast_radius && ast.blast_radius.length > 0) {
      context += `- Blast Radius: ${ast.blast_radius.length} affected symbol(s)\n`;
      ast.blast_radius.forEach(br => {
        context += `  - ${br.name} (${br.relation} in ${br.filePath}, depth ${br.depth})\n`;
      });
    }
  }

  const resolution = currentReport?.ai_resolutions?.[finding.rule_id];
  if (resolution) {
    context += `\nAI Suggestion: ${resolution.suggestion}\n`;
    if (resolution.remediation_code) {
      context += `Remediation Code:\n\`\`\`\n${resolution.remediation_code}\`\`\`\n`;
    }
  }

  return context;
}

// Reset chat state
function resetChat() {
  chatHistory = [];
  chatMessages.innerHTML = `
    <div class="chat-empty">
      <p>Ask questions about this vulnerability</p>
      <span>e.g., "Why is this dangerous?", "How does this affect callers?", "Show me more examples"</span>
    </div>
  `;
}

// Enable chat for a finding
function enableChat(finding) {
  chatInput.disabled = false;
  chatSendBtn.disabled = false;
  chatInput.placeholder = `Ask about ${finding.rule_id}...`;
}

// Send chat message
async function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || isChatLoading) return;

  // Clear input
  chatInput.value = '';

  // Remove empty state
  const emptyState = chatMessages.querySelector('.chat-empty');
  if (emptyState) emptyState.remove();

  // Add user message to UI
  addChatMessage('user', message);

  // Build context for the finding
  const finding = currentReport.findings[selectedFindingIndex];
  const findingContext = buildFindingContext(finding);

  // Build messages array
  const messages = [
    {
      role: 'system',
      content: `You are an expert security engineer helping analyze vulnerabilities. You have context about the current vulnerability being reviewed:

${findingContext}

Provide helpful, detailed answers about this vulnerability. Explain why it's dangerous, how it affects the codebase, and best practices for fixing it. Be concise but thorough.`
    },
    ...chatHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  // Update chat history
  chatHistory.push({ role: 'user', content: message });

  // Show loading
  isChatLoading = true;
  chatInput.disabled = true;
  chatSendBtn.disabled = true;
  const loadingId = addChatLoading();

  try {
    const response = await apiPost('/api/chat', {
      messages,
      provider: selectedProvider,
      apiKey: apiKey.value,
      baseUrl: apiBaseUrl.value || PROVIDERS[selectedProvider]?.defaultBaseUrl,
      model: aiModel.value,
      temperature: parseFloat(aiTemperature.value) || 0.7,
      maxTokens: parseInt(aiMaxTokens.value) || 2048
    });

    // Remove loading
    removeChatLoading(loadingId);

    if (response.success && response.response) {
      // Add assistant message
      addChatMessage('assistant', response.response);
      chatHistory.push({ role: 'assistant', content: response.response });
    } else {
      addChatMessage('assistant', 'Sorry, I encountered an error. Please check your API configuration and try again.');
    }
  } catch (err) {
    removeChatLoading(loadingId);
    addChatMessage('assistant', `Error: ${err.message}`);
  } finally {
    isChatLoading = false;
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

// Add chat message to UI
function addChatMessage(role, content) {
  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  div.innerHTML = `
    <div class="chat-message-role">${role === 'user' ? 'You' : 'AI'}</div>
    <div class="chat-message-content">${escapeHtml(content)}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add loading indicator
function addChatLoading() {
  const id = 'loading-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'chat-loading';
  div.textContent = 'AI is thinking...';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

// Remove loading indicator
function removeChatLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Chat event listeners
chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

// Render Diff
async function renderDiff(finding, resolution) {
  if (!resolution || !resolution.remediation_code) {
    diffViewer.style.display = 'none';
    return;
  }

  try {
    const fileContent = await apiGet(`/api/file-content?path=${encodeURIComponent(finding.file)}`);
    if (!fileContent.success) {
      diffViewer.style.display = 'none';
      return;
    }

    const lines = fileContent.content.split('\n');
    const targetLine = finding.line - 1;
    const contextLines = 5;
    const start = Math.max(0, targetLine - contextLines);
    const end = Math.min(lines.length, targetLine + contextLines + 1);

    // Original panel
    let originalHtml = '';
    for (let i = start; i < end; i++) {
      const isTarget = i === targetLine;
      const cls = isTarget ? 'removed' : 'context';
      originalHtml += `<span class="diff-line ${cls}">${escapeHtml(lines[i] || '')}</span>`;
    }
    diffOriginal.innerHTML = originalHtml;

    // Remediation panel
    const remediationLines = resolution.remediation_code.split('\n');
    let remediationHtml = '';
    for (let i = start; i < end; i++) {
      if (i === targetLine) {
        remediationLines.forEach(line => {
          remediationHtml += `<span class="diff-line added">${escapeHtml(line)}</span>`;
        });
      } else {
        remediationHtml += `<span class="diff-line context">${escapeHtml(lines[i] || '')}</span>`;
      }
    }
    diffRemediation.innerHTML = remediationHtml;

    diffViewer.style.display = 'block';
  } catch (err) {
    console.error('Failed to load file content:', err);
    diffViewer.style.display = 'none';
  }
}

// Scan implementation
async function runScan(targetPath = null, mockScan = false, mockAi = false) {
  scanOverlay.style.display = 'flex';
  scanStatus.textContent = 'Starting scan...';
  if (scanBtn) scanBtn.disabled = true;
  if (onboardingScanBtn) onboardingScanBtn.disabled = true;

  try {
    const body = { mockScan, mockAi };
    if (targetPath) {
      body.targetPath = targetPath;
    }

    const result = await apiPost('/api/scan', body);

    // Update current project and report
    if (result.report) {
      const projName = result.report._project;

      // Reload projects list
      await loadProjects();

      // Select the scanned project
      await selectProject(projName);

      // Select the newly generated report
      await loadReport(projName, result.report._id);

      // Set the value in the select dropdown
      if (historySelect) {
        historySelect.value = result.report._id;
      }
    }

    showToast('Scan completed successfully!');
  } catch (err) {
    showToast(`Scan failed: ${err.message}`, 'error');
  } finally {
    scanOverlay.style.display = 'none';
    if (scanBtn) scanBtn.disabled = false;
    if (onboardingScanBtn) onboardingScanBtn.disabled = false;
  }
}

// Scan Handlers
if (scanBtn) {
  scanBtn.addEventListener('click', () => {
    runScan(null, false, false);
  });
}

if (onboardingScanBtn) {
  onboardingScanBtn.addEventListener('click', () => {
    const targetPath = onboardingTargetPath.value.trim() || null;
    const mockScan = onboardingMockScan.checked;
    const mockAi = onboardingMockAi.checked;
    runScan(targetPath, mockScan, mockAi);
  });
}

// Apply Fix Handler
applyBtn.addEventListener('click', async () => {
  if (selectedFindingIndex === null) return;

  const finding = currentReport.findings[selectedFindingIndex];
  const resolution = currentReport.ai_resolutions?.[finding.rule_id];
  if (!resolution || !resolution.remediation_code) {
    showToast('No remediation code available.', 'error');
    return;
  }

  applyBtn.disabled = true;

  try {
    await apiPost('/api/apply', {
      filePath: finding.file,
      targetLine: finding.line,
      targetContent: finding.message,
      replacementContent: resolution.remediation_code
    });

    finding._applied = true;
    detailStatus.textContent = 'Applied';
    detailStatus.className = 'finding-status applied';
    renderFindings(currentReport.findings);
    showToast('Fix applied successfully!');
  } catch (err) {
    showToast(`Failed to apply fix: ${err.message}`, 'error');
  } finally {
    applyBtn.disabled = false;
  }
});

// History Selector Change
if (historySelect) {
  historySelect.addEventListener('change', () => {
    if (historySelect.value && currentProject) {
      loadReport(currentProject, historySelect.value);
    }
  });
}

// Project Selector Toggle
projectSelectorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  projectDropdown.classList.toggle('active');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.project-selector')) {
    projectDropdown.classList.remove('active');
  }
});

// Settings Drawer
settingsBtn.addEventListener('click', async () => {
  drawerOverlay.classList.add('active');
  settingsDrawer.classList.add('active');
  await loadConfig();
});

closeDrawerBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

function closeDrawer() {
  drawerOverlay.classList.remove('active');
  settingsDrawer.classList.remove('active');
}

// Populate models dropdown based on selected provider
async function populateModels(provider) {
  const providerData = PROVIDERS[provider];
  if (!providerData) return;

  // Show loading state
  aiModel.innerHTML = '<option value="">Loading models...</option>';

  // Try to fetch models from API
  let models = [];
  try {
    const baseUrl = apiBaseUrl.value || providerData.defaultBaseUrl;
    const apiKeyVal = apiKey.value || '';
    const response = await apiGet(`/api/models?baseUrl=${encodeURIComponent(baseUrl)}&apiKey=${encodeURIComponent(apiKeyVal)}`);
    if (response.success && response.models && response.models.length > 0) {
      models = response.models;
    }
  } catch (err) {
    console.log('Failed to fetch models from API, using static list');
  }

  // Fall back to static list if API didn't return models
  if (models.length === 0) {
    models = providerData.models;
  }

  // Populate the dropdown
  aiModel.innerHTML = '';
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    aiModel.appendChild(option);
  });

  // Update base URL hint
  baseUrlHint.textContent = `Default: ${providerData.defaultBaseUrl}`;
}

// Stored config data for per-provider settings
let storedConfig = {};

// Select provider
async function selectProvider(provider) {
  selectedProvider = provider;

  // Update button states
  providerButtons.querySelectorAll('.provider-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });

  // Clear test connection status
  testConnectionStatus.textContent = '';
  testConnectionStatus.className = 'test-connection-status';

  // Load per-provider API key from stored config
  const providerKey = `${provider.toUpperCase()}_API_KEY`;
  apiKey.value = storedConfig[providerKey] || '';

  // Load per-provider base URL
  const providerUrlKey = `${provider.toUpperCase()}_BASE_URL`;
  apiBaseUrl.value = storedConfig[providerUrlKey] || PROVIDERS[provider].defaultBaseUrl;

  // Populate models and restore saved model
  await populateModels(provider);

  // Restore saved model for this provider
  const providerModelKey = `${provider.toUpperCase()}_MODEL`;
  const savedModel = storedConfig[providerModelKey];
  if (savedModel) {
    const modelExists = Array.from(aiModel.options).some(opt => opt.value === savedModel);
    if (modelExists) {
      aiModel.value = savedModel;
    }
  }
}

// Provider button click handlers
providerButtons.addEventListener('click', (e) => {
  const btn = e.target.closest('.provider-btn');
  if (btn && btn.dataset.provider) {
    selectProvider(btn.dataset.provider);
  }
});

async function loadConfig() {
  try {
    const config = await apiGet('/api/config');

    // Store config for per-provider access
    storedConfig = config;

    // Load provider config (new format)
    const provider = config.AI_PROVIDER || 'openai';
    selectedProvider = provider;

    // Update button states
    providerButtons.querySelectorAll('.provider-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.provider === provider);
    });

    // Load per-provider API key
    const providerKey = `${provider.toUpperCase()}_API_KEY`;
    apiKey.value = config[providerKey] || '';

    // Load per-provider base URL
    const providerUrlKey = `${provider.toUpperCase()}_BASE_URL`;
    apiBaseUrl.value = config[providerUrlKey] || PROVIDERS[provider].defaultBaseUrl;

    // Load per-provider model
    const providerModelKey = `${provider.toUpperCase()}_MODEL`;
    const savedModel = config[providerModelKey];

    // First populate models for this provider
    await populateModels(provider);

    // Then set the saved model if it exists in the dropdown
    if (savedModel) {
      const modelExists = Array.from(aiModel.options).some(opt => opt.value === savedModel);
      if (modelExists) {
        aiModel.value = savedModel;
      }
    }

    // Load advanced settings
    aiTemperature.value = config.AI_TEMPERATURE || '0.1';
    aiMaxTokens.value = config.AI_MAX_TOKENS || '4096';
    semgrepRules.value = config.SEMGREP_RULES_PATH || '';
  } catch (err) {
    console.error('Failed to load config:', err);
  }
}

// Test Connection
async function testConnection() {
  const baseUrl = apiBaseUrl.value || PROVIDERS[selectedProvider]?.defaultBaseUrl;
  const key = apiKey.value;

  // For paid providers, API key is required
  const requiresKey = ['openai', 'anthropic', 'google'].includes(selectedProvider);
  if (requiresKey && !key) {
    testConnectionStatus.textContent = 'API key is required for this provider';
    testConnectionStatus.className = 'test-connection-status error';
    return;
  }

  // Show loading state
  testConnectionBtn.disabled = true;
  testConnectionStatus.textContent = 'Testing...';
  testConnectionStatus.className = 'test-connection-status loading';

  try {
    const url = `/api/models?baseUrl=${encodeURIComponent(baseUrl)}${key ? `&apiKey=${encodeURIComponent(key)}` : ''}`;
    const response = await apiGet(url);

    if (response.success) {
      if (response.models && response.models.length > 0) {
        testConnectionStatus.textContent = `Connected! ${response.models.length} model(s) available`;
        testConnectionStatus.className = 'test-connection-status success';
      } else {
        // No models returned - could be invalid key or unsupported endpoint
        if (requiresKey && key) {
          testConnectionStatus.textContent = 'Invalid API key or access denied';
          testConnectionStatus.className = 'test-connection-status error';
        } else {
          testConnectionStatus.textContent = 'Connected! No models found (endpoint may not support /models)';
          testConnectionStatus.className = 'test-connection-status success';
        }
      }
    } else {
      testConnectionStatus.textContent = response.error || 'Connection failed';
      testConnectionStatus.className = 'test-connection-status error';
    }
  } catch (err) {
    testConnectionStatus.textContent = `Error: ${err.message}`;
    testConnectionStatus.className = 'test-connection-status error';
  } finally {
    testConnectionBtn.disabled = false;
  }
}

testConnectionBtn.addEventListener('click', testConnection);

// Advanced toggle
advancedToggle.addEventListener('click', () => {
  const isOpen = advancedContent.style.display !== 'none';
  advancedContent.style.display = isOpen ? 'none' : 'block';
  advancedToggle.classList.toggle('active', !isOpen);
});

saveConfigBtn.addEventListener('click', async () => {
  try {
    const config = {};
    const providerConfigKey = PROVIDERS[selectedProvider]?.configKey || selectedProvider;

    // Save per-provider API key
    config[`${providerConfigKey.toUpperCase()}_API_KEY`] = apiKey.value;

    // Save per-provider base URL
    config[`${providerConfigKey.toUpperCase()}_BASE_URL`] = apiBaseUrl.value;

    // Save per-provider model
    config[`${providerConfigKey.toUpperCase()}_MODEL`] = aiModel.value;

    // Save current provider
    config.AI_PROVIDER = selectedProvider;

    // Save advanced settings
    config.AI_TEMPERATURE = aiTemperature.value;
    config.AI_MAX_TOKENS = aiMaxTokens.value;

    // Legacy config for 9router (backward compatible)
    if (selectedProvider === '9router') {
      config.NINEROUTER_API_KEY = apiKey.value;
      config.NINEROUTER_BASE_URL = apiBaseUrl.value;
      config.NINEROUTER_MODEL = aiModel.value;
    }

    if (semgrepRules.value) config.SEMGREP_RULES_PATH = semgrepRules.value;

    await apiPost('/api/config', config);
    showToast('Configuration saved!');
    closeDrawer();
  } catch (err) {
    showToast(`Failed to save config: ${err.message}`, 'error');
  }
});

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Get relative path of a file with respect to a target path
function getRelativePath(absolutePath, targetPath) {
  if (!absolutePath) return '';
  if (!targetPath) return absolutePath;

  const abs = absolutePath.replace(/\\/g, '/');
  const target = targetPath.replace(/\\/g, '/');

  if (abs.startsWith(target)) {
    let rel = abs.slice(target.length);
    if (rel.startsWith('/')) {
      rel = rel.slice(1);
    }
    return rel || '.';
  }

  return abs;
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
  // Make logo clickable to return to project selection onboarding page
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', () => {
      selectProject(null);
    });
  }

  await loadConfig();
  await loadProjects();
  selectProject(null);
});
