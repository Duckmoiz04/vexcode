// ─── Core Data Types ────────────────────────────────────────────────────────

export interface AstContext {
  symbol_name?: string;
  kind?: string;
  source_code?: string;
  callers?: CallerInfo[];
  blast_radius?: BlastRadiusItem[];
}

export interface CallerInfo {
  name: string;
  filePath: string;
}

export interface BlastRadiusItem {
  name: string;
  relation: string;
  filePath: string;
  depth: number;
}

export type FindingStatus = 'open' | 'applied' | 'false_positive' | 'ignored';

/** Cross-scan classification: compares current scan with previous report. */
export type ScanStatus = 'new' | 'persisting' | 'resolved' | 'regressed';

export interface Finding {
  id?: string;                   // Stable hash of (file, line, rule_id) - set by scanner
  rule_id: string;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  message: string;
  code_text?: string;
  ast_context?: AstContext;
  /** Per-finding status. Opt-in: missing is treated as 'open'. */
  status?: FindingStatus;
  /** Cross-scan classification from engine comparison with previous report. */
  scan_status?: ScanStatus;
  /** @deprecated Use status === 'applied' instead. Kept for backward compat. */
  _applied?: boolean;
}

export interface AiResolution {
  suggestion: string;
  remediation_code?: string;
}

export interface GitState {
  commit: string;
  is_dirty: boolean;
}

export interface FileMetrics {
  complexity: number;
  cognitive_complexity: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  loc: number;
}

export interface Metrics {
  files: Record<string, FileMetrics>;
}

export interface Report {
  scanner: string;
  timestamp: string;
  target_path: string;
  findings: Finding[];
  ai_resolutions: Record<string, AiResolution>;
  git_state: GitState;
  metrics: Metrics;
  _id?: string;
  _project?: string;
  _savedAt?: string;
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface ScanResult {
  success: boolean;
  message?: string;
  report?: Report;
  reportPath?: string;
  error?: string;
}

export interface LatestReport {
  id: string;
  timestamp: string | null;
  findings: number;
}

export interface Project {
  name: string;
  reportCount: number;
  latestReport: LatestReport;
}

export interface ReportListItem {
  id: string;
  timestamp: string | null;
  target?: string | null;
  findings: number;
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface AIProviderContextType {
  config: Config;
  selectedProvider: string;
  apiKey: string;
  apiBaseUrl: string;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
}

export interface Config {
  AI_PROVIDER?: string;
  AI_TEMPERATURE?: string;
  AI_MAX_TOKENS?: string;
  AI_RESOLVE_TIMEOUT_SECONDS?: string;
  AI_NAMING_TIMEOUT_SECONDS?: string;
  AI_MAX_RETRIES?: string;
  AI_REQUEST_COOLDOWN_SECONDS?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_BASE_URL?: string;
  GOOGLE_MODEL?: string;
  NINEROUTER_API_KEY?: string;
  NINEROUTER_BASE_URL?: string;
  NINEROUTER_MODEL?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_BASE_URL?: string;
  NVIDIA_MODEL?: string;
  SEMGREP_RULES_PATH?: string;
  [key: string]: string | undefined;
}

// ─── UI Component Props ───────────────────────────────────────────────────────

/** A single chat message in the AI assistant panel. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/** Props for the chat panel component. */
export interface ChatPanelProps {
  /** The report context for the chat session. */
  report?: Report;
  className?: string;
  /** Callback when a message is sent. */
  onSendMessage?: (message: string) => void;
}

/** Props for the file source viewer component. */
export interface FileViewerProps {
  /** The finding whose source code to display. */
  finding: Finding;
  className?: string;
}

/** Props for the apply-fix action button. */
export interface ApplyFixButtonProps {
  /** The finding to apply a fix for. */
  finding: Finding;
  /** Called after the fix has been applied. */
  onApplied?: () => void;
  className?: string;
  disabled?: boolean;
}

/** Props for a metrics dashboard statistic card. */
export interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

/** Props for a top-files list item showing per-file metrics. */
export interface TopFileItemProps {
  filePath: string;
  metrics: FileMetrics;
  className?: string;
}

/** Props for the severity distribution chart. */
export interface SeverityChartProps {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  className?: string;
}

/** Props for a provider configuration form section. */
export interface ProviderFormSectionProps {
  /** The provider key (e.g. "OPENAI", "ANTHROPIC"). */
  providerKey: string;
  config: Config;
  /** Called when a config value changes. */
  onChange: (key: string, value: string) => void;
  className?: string;
}

/** Props for a project list item in the dashboard sidebar. */
export interface ProjectListItemProps {
  project: Project;
  /** Whether this project is currently selected. */
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Props for a history (past report) list item. */
export interface HistoryListItemProps {
  report: ReportListItem;
  onClick?: () => void;
  className?: string;
}

/** Props for a sidebar navigation item. */
export interface NavItemProps {
  label: string;
  icon?: string;
  /** Route path to navigate to. */
  to?: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Props for the scan trigger button. */
export interface ScanButtonProps {
  /** Whether a scan is currently running. */
  isScanning?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}
