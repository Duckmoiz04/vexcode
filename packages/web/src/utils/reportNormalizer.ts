/**
 * Normalize a raw API report response into the internal Report type.
 * Handles both SARIF 2.1.0 and legacy VexCode formats transparently.
 */
import type { Report } from '../types';
import { isSarifReport, sarifToReport } from './sarifAdapter';

interface Annotations {
  _id?: string;
  _project?: string;
  _savedAt?: string;
}

/**
 * Accept raw API JSON (either SARIF or VexCode format) and return
 * the internal Report type. Returns null for invalid input.
 */
export function normalizeReport(raw: unknown, annotations?: Annotations): Report | null {
  if (!raw || typeof raw !== 'object') return null;

  if (isSarifReport(raw)) {
    return sarifToReport(raw, annotations);
  }

  // Legacy VexCode format — pass through with type assertion
  const legacy = raw as Report;
  if (!Array.isArray(legacy.findings)) return null;

  return {
    ...legacy,
    _id: annotations?._id ?? legacy._id,
    _project: annotations?._project ?? legacy._project,
    _savedAt: annotations?._savedAt ?? legacy._savedAt,
  };
}
