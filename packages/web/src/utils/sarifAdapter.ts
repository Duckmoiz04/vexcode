/**
 * SARIF 2.1.0 → VexCode internal types adapter.
 *
 * Converts SARIF documents produced by the engine back into the Report/Finding
 * interfaces consumed by all web components. This is the translation boundary
 * that isolates the format change from the rest of the UI.
 */
import type {
  Report, Finding, AiResolution, Metrics, GitState,
  AstContext, CallerInfo, BlastRadiusItem, FileMetrics,
} from '../types';

// ─── Minimal SARIF type definitions ────────────────────────────────────────

export interface SarifLog {
  $schema?: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: { name: string; rules?: Array<{ id: string }> } };
  results: SarifResult[];
  invocations?: Array<{ executionSuccessful?: boolean; endTimeUtc?: string; workingDirectory?: { uri: string } }>;
  versionControlProvenance?: Array<{
    repositoryUri?: string; revisionId?: string;
    properties?: { isDirty?: boolean };
  }>;
  originalUriBaseIds?: Record<string, { uri: string }>;
  properties?: { metrics?: Metrics; [key: string]: unknown };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri: string };
      region?: { startLine?: number; snippet?: { text: string } };
    };
  }>;
  fixes?: Array<{ description?: { text: string } }>;
  relatedLocations?: Array<{
    logicalLocations?: Array<{ name: string; kind?: string }>;
    physicalLocation?: {
      artifactLocation?: { uri: string };
      region?: { snippet?: { text: string } };
    };
  }>;
  taxa?: Array<{ id: string; toolComponent?: { name: string } }>;
  properties?: {
    _applied?: boolean;
    id?: string;
    status?: string;
    aiResolution?: AiResolution;
    confidence?: string;
    precision?: string;
    [key: string]: unknown;
  };
}

// ─── Format detection ──────────────────────────────────────────────────────

export function isSarifReport(data: unknown): data is SarifLog {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return obj.version === '2.1.0' && Array.isArray(obj.runs);
}

// ─── Severity mapping ──────────────────────────────────────────────────────

function sarifLevelToSeverity(level: string): 'error' | 'warning' | 'info' {
  if (level === 'error') return 'error';
  if (level === 'warning') return 'warning';
  return 'info'; // note, none, unknown
}

// ─── Main adapter ──────────────────────────────────────────────────────────

interface Annotations {
  _id?: string;
  _project?: string;
  _savedAt?: string;
}

export function sarifToReport(sarif: SarifLog, annotations?: Annotations): Report {
  const run = sarif.runs?.[0];
  if (!run) return emptyReport(annotations);

  const findings = (run.results || []).map(resultToFinding);
  const aiResolutions = buildAiResolutionsMap(run.results || []);
  const gitState = extractGitState(run);
  const metrics: Metrics = (run.properties?.metrics as Metrics) ?? { files: {} };
  const scanner = run.tool?.driver?.name || 'unknown';
  const timestamp = run.invocations?.[0]?.endTimeUtc || '';
  const targetPath = extractTargetPath(run);

  return {
    scanner,
    timestamp,
    target_path: targetPath,
    findings,
    ai_resolutions: aiResolutions,
    git_state: gitState,
    metrics,
    _id: annotations?._id,
    _project: annotations?._project,
    _savedAt: annotations?._savedAt,
  };
}

// ─── Sub-functions ─────────────────────────────────────────────────────────

function resultToFinding(result: SarifResult): Finding {
  const loc = result.locations?.[0]?.physicalLocation;
  const severity = sarifLevelToSeverity(result.level);

  const finding: Finding = {
    rule_id: result.ruleId,
    severity,
    file: loc?.artifactLocation?.uri || '',
    line: loc?.region?.startLine ?? 0,
    message: result.message?.text || '',
  };

  const snippet = loc?.region?.snippet?.text;
  if (snippet) finding.code_text = snippet;

  const ast = extractAstContext(result);
  if (ast) finding.ast_context = ast;

  if (result.properties?._applied !== undefined) {
    finding._applied = result.properties._applied;
  }

  const propsId = result.properties?.id;
  if (propsId && typeof propsId === 'string') {
    finding.id = propsId;
  }

  const propsStatus = result.properties?.status;
  if (propsStatus && ['open', 'applied', 'false_positive', 'ignored'].includes(propsStatus as string)) {
    finding.status = propsStatus as Finding['status'];
  }

  const propsConfidence = result.properties?.confidence;
  if (propsConfidence && typeof propsConfidence === 'string') {
    finding.confidence = propsConfidence;
  }

  const propsPrecision = result.properties?.precision;
  if (propsPrecision && typeof propsPrecision === 'string') {
    finding.precision = propsPrecision;
  }

  return finding;
}

function buildAiResolutionsMap(results: SarifResult[]): Record<string, AiResolution> {
  const map: Record<string, AiResolution> = {};
  for (const r of results) {
    const ai = r.properties?.aiResolution;
    if (ai) map[r.ruleId] = ai;
  }
  return map;
}

function extractGitState(run: SarifRun): GitState {
  const vcp = run.versionControlProvenance?.[0];
  if (!vcp) return { commit: '', is_dirty: false };
  return {
    commit: vcp.revisionId || '',
    is_dirty: vcp.properties?.isDirty ?? false,
  };
}

function extractTargetPath(run: SarifRun): string {
  const uri = run.originalUriBaseIds?.SRCROOT?.uri;
  if (!uri) return '';
  return uri.replace('file:///', '');
}

function extractAstContext(result: SarifResult): AstContext | undefined {
  const relLocs = result.relatedLocations;
  if (!relLocs || relLocs.length === 0) return undefined;

  const loc = relLocs[0];
  const logical = loc.logicalLocations?.[0];
  if (!logical) return undefined;

  const ctx: AstContext = {
    symbol_name: logical.name || undefined,
    kind: logical.kind || undefined,
  };

  const sourceCode = loc.physicalLocation?.region?.snippet?.text;
  if (sourceCode) ctx.source_code = sourceCode;

  return ctx;
}

function emptyReport(annotations?: Annotations): Report {
  return {
    scanner: 'unknown',
    timestamp: '',
    target_path: '',
    findings: [],
    ai_resolutions: {},
    git_state: { commit: '', is_dirty: false },
    metrics: { files: {} },
    ...annotations,
  };
}
