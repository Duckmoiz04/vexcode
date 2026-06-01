/**
 * AI Code Review - Dashboard Application Client
 * ES Module Pattern
 */

// --- Global Application State ---
const state = {
    config: {},
    report: null, // holds the full scan report
    activeFindingIndex: null, // index of the active finding in report.findings
    resolvedFindings: new Set(), // set of 'file:line:rule_id' strings
    lastReportPath: null // store the report path returned by the last scan
};

// --- DOM Elements ---
const elements = {
    statusText: document.getElementById('status-text'),
    statusIndicator: document.querySelector('.status-indicator'),
    btnConfig: document.getElementById('btn-config'),
    modalConfig: document.getElementById('modal-config'),
    btnCloseConfig: document.getElementById('btn-close-config'),
    btnCancelConfig: document.getElementById('btn-cancel-config'),
    formConfig: document.getElementById('form-config'),
    
    // Inputs
    inputTargetPath: document.getElementById('input-target-path'),
    checkMockScan: document.getElementById('check-mock-scan'),
    checkMockAi: document.getElementById('check-mock-ai'),
    btnScan: document.getElementById('btn-scan'),
    
    // Config fields
    cfgNinerouterKey: document.getElementById('cfg-ninerouter-key'),
    cfgNinerouterUrl: document.getElementById('cfg-ninerouter-url'),
    cfgNinerouterModel: document.getElementById('cfg-ninerouter-model'),
    cfgRulesPath: document.getElementById('cfg-rules-path'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    
    // Counters
    countError: document.getElementById('count-error'),
    countWarning: document.getElementById('count-warning'),
    countInfo: document.getElementById('count-info'),
    totalFindingsBadge: document.getElementById('total-findings-badge'),
    
    // Containers
    findingsContainer: document.getElementById('findings-container'),
    remediationDetailView: document.getElementById('remediation-detail-view'),
    
    // Toast
    toast: document.getElementById('toast-notification'),
    toastMessage: document.querySelector('.toast-message'),
    toastIcon: document.querySelector('.toast-icon')
};

// --- API Helpers ---
const API = {
    async fetchConfig() {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load configuration.');
        return response.json();
    },

    async saveConfig(config) {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save configuration.');
        }
        return response.json();
    },

    async triggerScan(targetPath, mockScan, mockAi) {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPath, mockScan, mockAi })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Scan failed.');
        }
        return response.json();
    },

    async fetchReport(reportPath = null) {
        let url = '/api/report';
        if (reportPath) {
            url += `?path=${encodeURIComponent(reportPath)}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return null; // Default report not found is ok
            const err = await response.json();
            throw new Error(err.error || 'Failed to load report.');
        }
        return response.json();
    },

    async applyRemediation(filePath, targetLine, targetContent, replacementContent) {
        const response = await fetch('/api/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, targetLine, targetContent, replacementContent })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to apply remediation.');
        }
        return response.json();
    }
};

// --- UI State Managers ---

// Show Toast message
function showToast(message, type = 'info') {
    elements.toastMessage.textContent = message;
    
    // Reset classes
    elements.toast.className = 'toast';
    elements.toastIcon.className = 'toast-icon fa-solid';
    
    if (type === 'success') {
        elements.toast.classList.add('toast-success');
        elements.toastIcon.classList.add('fa-circle-check');
    } else if (type === 'error') {
        elements.toast.classList.add('toast-error');
        elements.toastIcon.classList.add('fa-triangle-exclamation');
    } else {
        elements.toast.classList.add('toast-info');
        elements.toastIcon.classList.add('fa-circle-info');
    }
    
    elements.toast.classList.remove('hidden');
    
    // Auto hide
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 4000);
}

// Generate unique identifier for findings
function getFindingId(finding) {
    return `${finding.file}:${finding.line}:${finding.rule_id}`;
}

// Map rule key or keywords to get original content for replacement
function getTargetContentForFinding(finding) {
    const key = `${finding.file}:${finding.line}`;
    if (key === 'example.py:12') return 'exec(user_input)';
    if (key === 'db.py:45') return 'password = "admin123"';
    
    // Fallback: If AST contains the code, extract matching segment
    if (finding.ast_context && finding.ast_context.source_code) {
        const lines = finding.ast_context.source_code.split(/\r?\n/);
        const ruleId = finding.rule_id || '';
        
        if (ruleId.includes('dangerous-exec')) {
            const match = lines.find(l => l.includes('exec('));
            if (match) return match.trim();
        } else if (ruleId.includes('hardcoded-password')) {
            const match = lines.find(l => l.includes('password =') || l.includes('password='));
            if (match) return match.trim();
        }
        
        // Return first non-definition line
        const normalLine = lines.find(l => !l.trim().startsWith('def ') && l.trim() !== '');
        if (normalLine) return normalLine.trim();
    }
    
    // Last resort placeholder
    return '';
}

// HTML Escaper
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Update summary counts and header badge
function updateSummaryCounts() {
    if (!state.report || !state.report.findings) {
        elements.countError.textContent = '0';
        elements.countWarning.textContent = '0';
        elements.countInfo.textContent = '0';
        elements.totalFindingsBadge.textContent = '0 Issues';
        return;
    }
    
    let error = 0, warning = 0, info = 0;
    let activeIssuesCount = 0;
    
    state.report.findings.forEach(finding => {
        const fid = getFindingId(finding);
        if (state.resolvedFindings.has(fid)) return; // Don't count resolved findings
        
        activeIssuesCount++;
        const sev = (finding.severity || '').toUpperCase();
        if (sev === 'ERROR' || sev === 'HIGH') error++;
        else if (sev === 'WARNING' || sev === 'MED' || sev === 'MEDIUM') warning++;
        else info++;
    });
    
    elements.countError.textContent = error;
    elements.countWarning.textContent = warning;
    elements.countInfo.textContent = info;
    elements.totalFindingsBadge.textContent = `${activeIssuesCount} Issue${activeIssuesCount !== 1 ? 's' : ''}`;
}

// Render the findings list in the sidebar
function renderFindingsList() {
    elements.findingsContainer.innerHTML = '';
    
    if (!state.report || !state.report.findings || state.report.findings.length === 0) {
        elements.findingsContainer.innerHTML = `
            <div class="list-empty-state">
                <i class="fa-solid fa-clipboard-check empty-icon"></i>
                <p>No active findings. Click "Scan Project" to begin analysis.</p>
            </div>
        `;
        return;
    }
    
    state.report.findings.forEach((finding, index) => {
        const fid = getFindingId(finding);
        const isResolved = state.resolvedFindings.has(fid);
        const isActive = index === state.activeFindingIndex;
        
        const card = document.createElement('div');
        const sev = (finding.severity || '').toLowerCase();
        
        let sevClass = 'severity-warning';
        if (isResolved) sevClass = 'severity-resolved';
        else if (sev === 'error' || sev === 'high') sevClass = 'severity-error';
        else if (sev === 'info' || sev === 'low') sevClass = 'severity-info';
        
        card.className = `finding-card ${sevClass} ${isActive ? 'active' : ''} fade-in`;
        
        const badgeText = isResolved ? 'Resolved' : (finding.severity || 'Warning');
        const badgeClass = isResolved ? 'sev-resolved' : `sev-${sev === 'high' ? 'error' : (sev === 'low' ? 'info' : 'warning')}`;
        
        card.innerHTML = `
            <div class="finding-card-header">
                <span class="finding-card-title">${escapeHtml(finding.file.split(/[\\/]/).pop())}</span>
                <span class="sev-badge ${badgeClass}">${badgeText}</span>
            </div>
            <span class="finding-card-loc">Line ${finding.line}</span>
            <p class="finding-card-msg">${escapeHtml(finding.message)}</p>
            <div class="finding-card-meta">
                <span class="finding-rule-id">${escapeHtml(finding.rule_id.split('.').pop())}</span>
            </div>
        `;
        
        card.addEventListener('click', () => selectFinding(index));
        elements.findingsContainer.appendChild(card);
    });
}

// Select a finding and display its remediation workspace
function selectFinding(index) {
    state.activeFindingIndex = index;
    renderFindingsList();
    
    const finding = state.report.findings[index];
    const fid = getFindingId(finding);
    const isResolved = state.resolvedFindings.has(fid);
    
    // Get AI Resolution for this finding
    const resolutions = state.report.ai_resolutions || {};
    const resolution = resolutions[finding.rule_id] || {
        suggestion: 'No explicit AI suggestion available. Verify config keys are correct.',
        remediation_code: '# AI remediation code unavailable'
    };
    
    const targetContent = getTargetContentForFinding(finding);
    
    // Compile Diff HTML
    let diffHtml = '';
    if (targetContent) {
        const removedLines = targetContent.split('\n');
        const addedLines = resolution.remediation_code.split('\n');
        
        removedLines.forEach((line, i) => {
            diffHtml += `
                <div class="diff-line removed">
                    <span class="diff-line-num">${finding.line + i}</span>
                    <span class="diff-line-content">- ${escapeHtml(line)}</span>
                </div>
            `;
        });
        
        addedLines.forEach((line, i) => {
            diffHtml += `
                <div class="diff-line added">
                    <span class="diff-line-num">${finding.line + i}</span>
                    <span class="diff-line-content">+ ${escapeHtml(line)}</span>
                </div>
            `;
        });
    } else {
        diffHtml = `
            <div class="diff-line warning-diff" style="padding: 10px 15px; color: var(--color-warning);">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Original line content could not be verified in AST. Remediation code block is shown below:
            </div>
            ${resolution.remediation_code.split('\n').map((line, i) => `
                <div class="diff-line added">
                    <span class="diff-line-num">${finding.line + i}</span>
                    <span class="diff-line-content">+ ${escapeHtml(line)}</span>
                </div>
            `).join('')}
        `;
    }
    
    // Compile AST Context Panel
    let astHtml = '';
    const ast = finding.ast_context;
    if (ast) {
        // Direct Callers List
        let callersHtml = '<li>No direct callers detected.</li>';
        if (ast.callers && ast.callers.length > 0) {
            callersHtml = ast.callers.map(caller => `
                <li class="ast-list-item">
                    <div>
                        <span class="ast-node-name">${escapeHtml(caller.name)}</span>
                        <span class="ast-node-path">in ${escapeHtml(caller.filePath)}</span>
                    </div>
                    <span class="ast-relation">${escapeHtml(caller.relation)}</span>
                </li>
            `).join('');
        }
        
        // Blast Radius Upstream Risk Summary
        const risk = ast.impact ? (ast.impact.risk || 'UNKNOWN') : 'UNKNOWN';
        const riskClass = `risk-${risk.toLowerCase()}`;
        
        let blastRadiusHtml = '<li>No upstream impact nodes detected.</li>';
        if (ast.blast_radius && ast.blast_radius.length > 0) {
            blastRadiusHtml = ast.blast_radius.map(node => `
                <li class="ast-list-item">
                    <div>
                        <span class="ast-node-name">${escapeHtml(node.name)}</span>
                        <span class="ast-node-path">in ${escapeHtml(node.filePath)}</span>
                    </div>
                    <span class="ast-relation">Depth ${node.depth} (${escapeHtml(node.relation)})</span>
                </li>
            `).join('');
        }
        
        astHtml = `
            <div class="ast-panel fade-in">
                <h3><i class="fa-solid fa-diagram-project"></i> AST Call-Graph Insights</h3>
                <div class="ast-grid">
                    <!-- Symbol Enclosing Code -->
                    <div class="ast-card">
                        <span class="ast-card-title">Enclosing ${escapeHtml(ast.kind || 'Context')}</span>
                        <div class="symbol-signature">${escapeHtml(ast.symbol_name)}</div>
                        <div class="ast-code-block">${escapeHtml(ast.source_code)}</div>
                    </div>
                    <!-- Incoming Callers & Upstream risk -->
                    <div class="ast-card">
                        <span class="ast-card-title">Call Tree Details</span>
                        <div class="ast-risk-row">
                            <span>Upstream Risk Level:</span>
                            <span class="risk-badge ${riskClass}">${risk}</span>
                        </div>
                        <div style="font-size:11px; margin-bottom:4px; font-weight:600; color:var(--text-secondary);">Direct Callers:</div>
                        <ul class="ast-list" style="margin-bottom:10px;">
                            ${callersHtml}
                        </ul>
                        <div style="font-size:11px; margin-bottom:4px; font-weight:600; color:var(--text-secondary);">Upstream Blast Radius Chain:</div>
                        <ul class="ast-list">
                            ${blastRadiusHtml}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    } else {
        astHtml = `
            <div class="ast-panel fade-in" style="opacity:0.6;">
                <h3><i class="fa-solid fa-diagram-project"></i> AST Call-Graph Insights</h3>
                <div class="detail-empty-state" style="padding:15px; border:1px dashed var(--border-glass); border-radius:8px;">
                    <p style="font-size:12px;"><i class="fa-solid fa-circle-info"></i> AST enrichment is not available for this finding (requires indexed GitNexus repository).</p>
                </div>
            </div>
        `;
    }
    
    // Compile Action area (Apply button or resolved banner)
    const actionAreaHtml = isResolved ? `
        <div class="remediation-success-banner">
            <i class="fa-solid fa-circle-check success-checkmark-icon"></i>
            <span>Remediation Applied Successfully</span>
        </div>
    ` : `
        <button class="btn btn-primary" id="btn-apply-remediation">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>Apply Remediation</span>
        </button>
    `;
    
    // Render Workspace
    const sev = (finding.severity || '').toLowerCase();
    const badgeClass = isResolved ? 'sev-resolved' : `sev-${sev === 'high' ? 'error' : (sev === 'low' ? 'info' : 'warning')}`;
    const badgeText = isResolved ? 'Resolved' : (finding.severity || 'Warning');
    
    elements.remediationDetailView.className = 'remediation-view';
    elements.remediationDetailView.innerHTML = `
        <div class="detail-header fade-in">
            <div class="detail-title-block">
                <h2>${escapeHtml(finding.rule_id)}</h2>
                <p>File: ${escapeHtml(finding.file)} | Line: ${finding.line}</p>
            </div>
            <span class="sev-badge ${badgeClass}" style="font-size:12px; padding:4px 10px;">${badgeText}</span>
        </div>

        <div class="rule-panel fade-in">
            <div class="rule-meta-row">
                <span class="badge">Rule ID: ${escapeHtml(finding.rule_id)}</span>
            </div>
            <div class="rule-desc">
                <p>${escapeHtml(finding.message)}</p>
            </div>
        </div>

        <div class="suggestion-card fade-in">
            <h4>AI Recommended Fix</h4>
            <p>${escapeHtml(resolution.suggestion)}</p>
        </div>

        <!-- Diff Viewer -->
        <div class="diff-container fade-in">
            <div class="diff-header">
                <span class="diff-header-title">Remediation Patch Diff</span>
                <span class="diff-badge">${escapeHtml(finding.file)}</span>
            </div>
            <div class="diff-body">
                ${diffHtml}
            </div>
        </div>

        <!-- AST Info -->
        ${astHtml}

        <!-- Action Card -->
        <div class="action-card fade-in" id="remediation-action-area">
            ${actionAreaHtml}
        </div>
    `;
    
    // Bind Apply button click
    if (!isResolved) {
        const btnApply = document.getElementById('btn-apply-remediation');
        btnApply.addEventListener('click', () => applyRemediation(index));
    }
}

// Apply Remediation Handler
async function applyRemediation(index) {
    const finding = state.report.findings[index];
    const fid = getFindingId(finding);
    const resolutions = state.report.ai_resolutions || {};
    const resolution = resolutions[finding.rule_id];
    
    if (!resolution) {
        showToast('AI Remediation code is missing.', 'error');
        return;
    }
    
    const targetContent = getTargetContentForFinding(finding);
    const btnApply = document.getElementById('btn-apply-remediation');
    
    try {
        btnApply.disabled = true;
        btnApply.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Applying...</span>';
        
        await API.applyRemediation(
            finding.file,
            finding.line,
            targetContent,
            resolution.remediation_code
        );
        
        // Success
        state.resolvedFindings.add(fid);
        showToast('Vulnerability resolution applied successfully.', 'success');
        
        // Re-select finding to refresh UI state
        selectFinding(index);
        updateSummaryCounts();
        
    } catch (error) {
        showToast(error.message, 'error');
        btnApply.disabled = false;
        btnApply.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Apply Remediation</span>';
    }
}

// --- Action Bindings ---

// Toggle Configuration Modal Visibility
function toggleConfigModal(show) {
    if (show) {
        // Load configurations into input fields
        elements.cfgNinerouterKey.value = state.config.NINEROUTER_API_KEY || '';
        elements.cfgNinerouterUrl.value = state.config.NINEROUTER_BASE_URL || '';
        elements.cfgNinerouterModel.value = state.config.NINEROUTER_MODEL || '';
        elements.cfgRulesPath.value = state.config.SEMGREP_RULES_PATH || '';
        
        elements.modalConfig.classList.add('active');
    } else {
        elements.modalConfig.classList.remove('active');
    }
}

// Toggle key visibility
function toggleKeyVisibility() {
    const type = elements.cfgNinerouterKey.type === 'password' ? 'text' : 'password';
    elements.cfgNinerouterKey.type = type;
    
    const icon = elements.btnToggleKeyVisibility.querySelector('i');
    if (type === 'text') {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Load configurations from server
async function loadConfig() {
    try {
        state.config = await API.fetchConfig();
        
        // If API key is empty, warn user
        if (!state.config.NINEROUTER_API_KEY) {
            showToast('9router API key is not configured. Please open settings to configure.', 'info');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Save configuration form submit
async function handleConfigSubmit(e) {
    e.preventDefault();
    
    const updatedConfig = {
        NINEROUTER_API_KEY: elements.cfgNinerouterKey.value.trim(),
        NINEROUTER_BASE_URL: elements.cfgNinerouterUrl.value.trim(),
        NINEROUTER_MODEL: elements.cfgNinerouterModel.value.trim(),
        SEMGREP_RULES_PATH: elements.cfgRulesPath.value.trim()
    };
    
    try {
        await API.saveConfig(updatedConfig);
        state.config = updatedConfig;
        showToast('Configuration updated successfully.', 'success');
        toggleConfigModal(false);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Load default or last scan report
async function loadReport(reportPath = null) {
    try {
        const report = await API.fetchReport(reportPath);
        if (report) {
            state.report = report;
            state.activeFindingIndex = null;
            
            // Prefill Target Path input
            if (report.target_path) {
                elements.inputTargetPath.value = report.target_path;
            }
            
            // Reset workspace view
            elements.remediationDetailView.className = 'remediation-view empty-detail';
            elements.remediationDetailView.innerHTML = `
                <div class="detail-empty-state">
                    <i class="fa-solid fa-code-compare welcome-icon"></i>
                    <h2>Code Review Workspace</h2>
                    <p>Select a vulnerability card from the findings sidebar to view static analysis triggers, enclosing AST function contexts, and AI-powered remediation patches.</p>
                </div>
            `;
            
            updateSummaryCounts();
            renderFindingsList();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Trigger project scanning
async function handleScanTrigger() {
    const targetPath = elements.inputTargetPath.value.trim();
    if (!targetPath) {
        showToast('Please enter a target codebase path.', 'error');
        return;
    }
    
    const mockScan = elements.checkMockScan.checked;
    const mockAi = elements.checkMockAi.checked;
    
    try {
        // UI Scanning State
        elements.btnScan.disabled = true;
        elements.btnScan.classList.add('spinning');
        elements.statusIndicator.classList.add('scanning');
        elements.statusText.textContent = 'Scanning...';
        
        elements.inputTargetPath.disabled = true;
        elements.checkMockScan.disabled = true;
        elements.checkMockAi.disabled = true;
        
        const scanRes = await API.triggerScan(targetPath, mockScan, mockAi);
        
        showToast('Scan execution complete.', 'success');
        
        // Load report from new path
        state.lastReportPath = scanRes.reportPath;
        await loadReport(scanRes.reportPath);
        
        elements.statusText.textContent = 'Ready';
        
    } catch (error) {
        showToast(error.message, 'error');
        elements.statusText.textContent = 'Scan Failed';
    } finally {
        // Restore buttons
        elements.btnScan.disabled = false;
        elements.btnScan.classList.remove('spinning');
        elements.statusIndicator.classList.remove('scanning');
        
        elements.inputTargetPath.disabled = false;
        elements.checkMockScan.disabled = false;
        elements.checkMockAi.disabled = false;
    }
}

// --- App Initialization ---
async function init() {
    // Config toggles
    elements.btnConfig.addEventListener('click', () => toggleConfigModal(true));
    elements.btnCloseConfig.addEventListener('click', () => toggleConfigModal(false));
    elements.btnCancelConfig.addEventListener('click', () => toggleConfigModal(false));
    elements.btnToggleKeyVisibility.addEventListener('click', toggleKeyVisibility);
    elements.formConfig.addEventListener('submit', handleConfigSubmit);
    
    // Scan triggers
    elements.btnScan.addEventListener('click', handleScanTrigger);
    
    // Close modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === elements.modalConfig) {
            toggleConfigModal(false);
        }
    });
    
    // Load initial configurations and reports
    await loadConfig();
    await loadReport();
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', init);
