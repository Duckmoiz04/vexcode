import type { Report } from '../types';

/**
 * Migrate legacy `'hotspot'` AI-classification values to `'confirmed'`.
 *
 * Older reports (written before the hotspot tier was removed) may contain
 * `finding_type === 'hotspot'` on individual findings and a `hotspot` counter
 * in `metrics.ai_pipeline_metrics.classifications`. Those reports are still
 * valid; we just remap the value at load time so the UI does not need to
 * tolerate the now-deleted enum member.
 */
export function migrateLegacyHotspot<T extends Report | null | undefined>(report: T): T {
  if (!report) return report;

  if (Array.isArray(report.findings)) {
    report.findings.forEach((finding) => {
      const legacy = (finding as unknown as { finding_type?: string }).finding_type;
      if (legacy === 'hotspot') {
        (finding as unknown as { finding_type?: 'confirmed' }).finding_type = 'confirmed';
      }
    });
  }

  const metrics = report.metrics as
    | undefined
    | { ai_pipeline_metrics?: { classifications?: Record<string, unknown> } };
  const classifications = metrics?.ai_pipeline_metrics?.classifications;
  if (classifications && typeof classifications === 'object') {
    const hotspotCount = classifications['hotspot'];
    if (typeof hotspotCount === 'number' && hotspotCount > 0) {
      classifications.confirmed = (classifications.confirmed as number | undefined ?? 0) + hotspotCount;
    }
    delete classifications['hotspot'];
  }

  return report;
}
