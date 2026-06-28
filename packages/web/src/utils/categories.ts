import type { LucideIcon } from 'lucide-react';
import { Shield, Bug, Wrench, Gauge, ShieldCheck } from 'lucide-react';
import type { Finding } from '../types';

/**
 * VexCode category taxonomy — single source of truth.
 *
 * The Python engine (`packages/engine/src/engine/config/iso25010_taxonomy.py`)
 * already populates every finding with one of these four ISO 25010 keys via
 * `finding["category"]` (with optional `iso_25010` direct override for
 * CCN-based maintainability findings). This module mirrors that taxonomy
 * on the frontend so every chart, filter, and list draws from the same
 * keys — no ad-hoc reclassification, no parallel labels.
 *
 * Engine mapping (must stay in sync — see iso25010_taxonomy.py):
 *   security      → security
 *   correctness   → reliability
 *   best-practice → maintainability
 *   performance   → performance
 *
 * Findings whose `category` field is missing or unrecognized (older reports
 * without engine classification) fall through to a keyword-based fallback
 * so legacy data still renders correctly.
 */

export type CategoryKey = 'security' | 'reliability' | 'maintainability' | 'performance';

/** Persisted on every finding by `engine/core/findings.py:enrich_finding`. */
export interface CategorizedFinding extends Finding {
  category?: CategoryKey | string;
  /** Direct ISO 25010 override (used by CCN/complexity findings). */
  iso_25010?: string;
}

export const SEMGREP_TO_ISO25010: Record<string, CategoryKey> = {
  security: 'security',
  correctness: 'reliability',
  'best-practice': 'maintainability',
  performance: 'performance',
};

/** Display + styling metadata — the only place colors/icons live. */
export const CATEGORIES: Record<CategoryKey, {
  label: string;
  shortLabel: string;
  description: string;
  dotClass: string;
  barClass: string;
  cardBorderClass: string;
  icon: LucideIcon;
}> = {
  security: {
    label: 'Security',
    shortLabel: 'Sec',
    description: 'Vulnerabilities, secrets, OWASP/CWE findings',
    dotClass: 'bg-danger',
    barClass: 'bg-success',
    cardBorderClass: 'border-danger/40',
    icon: Shield,
  },
  reliability: {
    label: 'Reliability',
    shortLabel: 'Rel',
    description: 'Logic bugs, error-handling, correctness issues',
    dotClass: 'bg-warning',
    barClass: 'bg-success',
    cardBorderClass: 'border-warning/40',
    icon: Bug,
  },
  maintainability: {
    label: 'Maintainability',
    shortLabel: 'Mnt',
    description: 'Style, complexity (CCN), naming, conventions',
    dotClass: 'bg-emerald-400',
    barClass: 'bg-warning',
    cardBorderClass: 'border-emerald-400/40',
    icon: Wrench,
  },
  performance: {
    label: 'Performance',
    shortLabel: 'Prf',
    description: 'Hotspots, AST/call-flow complexity, performance smells',
    dotClass: 'bg-info',
    barClass: 'bg-success',
    cardBorderClass: 'border-info/40',
    icon: Gauge,
  },
};

export const CATEGORY_ORDER: CategoryKey[] = ['security', 'reliability', 'maintainability', 'performance'];

// Fallback keyword table — mirrors dashboardUtils.classifyFinding; used only when
// a finding predates engine enrichment (i.e. has no `category` field).
const SECURITY_KEYWORDS = [
  'security', 'vuln', 'injection', 'xss', 'csrf', 'secret', 'key',
  'token', 'jwt', 'crypto', 'auth', 'password', 'credential', 'ssrf',
  'overflow', 'leak', 'private', 'cert', 'hash', 'ssl', 'tls',
];

const STYLE_KEYWORDS = [
  'style', 'format', 'naming', 'deprecated', 'convention', 'comment',
  'spacing', 'indent', 'unused', 'duplicate', 'complex', 'nest',
];

function fallbackClassify(finding: Finding): CategoryKey {
  const ruleId = (finding.rule_id || '').toLowerCase();
  if (SECURITY_KEYWORDS.some((kw) => ruleId.includes(kw))) return 'security';
  if (finding.ast_context && (finding.ast_context.symbol_name ||
      (finding.ast_context.callers && finding.ast_context.callers.length > 0))) {
    return 'performance';
  }
  if (STYLE_KEYWORDS.some((kw) => ruleId.includes(kw))) return 'maintainability';
  return 'reliability';
}

/**
 * Resolve a finding to one of the four ISO categories.
 *
 * Resolution order:
 *   1. `iso_25010` field (direct override — engine sets this for CCN findings)
 *   2. `category` field → SEMGREP_TO_ISO25010 lookup (engine writes ISO keys)
 *   3. Keyword-based fallback for legacy findings that pre-date engine enrichment
 *
 * This is the SOLE entry point every dashboard, filter, and list should call —
 * importing `utils/categories` rather than re-rolling their own classifier.
 */
export function classifyFinding(finding: Finding): CategoryKey {
  const enriched = finding as CategorizedFinding;
  const override = enriched.iso_25010;
  if (override && override in CATEGORIES) {
    return override as CategoryKey;
  }
  const cat = enriched.category;
  if (typeof cat === 'string') {
    const mapped = SEMGREP_TO_ISO25010[cat.toLowerCase()];
    if (mapped) return mapped;
  }
  return fallbackClassify(finding);
}

/**
 * Per-category counts derived from a list of findings. Always returns the
 * full ISO key set so callers never need to defend against missing keys.
 */
export type CategoryCounts = Record<CategoryKey, number>;

export function countByCategory(findings: Finding[]): CategoryCounts {
  const counts: CategoryCounts = { security: 0, reliability: 0, maintainability: 0, performance: 0 };
  for (const f of findings) {
    const key = classifyFinding(f);
    counts[key] += 1;
  }
  return counts;
}

// Re-export ShieldCheck so legacy imports that grabbed it from this module's
// transitive re-export don't fail with "no exported member" warnings. The
// actual callers should import lucide-react directly.
export { ShieldCheck };
