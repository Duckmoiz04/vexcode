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

export interface Finding {
  rule_id: string;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  message: string;
  code_text?: string;
  ast_context?: AstContext;
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
  SEMGREP_RULES_PATH?: string;
  [key: string]: string | undefined;
}
