import { updateFindingStatus } from '../services/reportService.js';

/**
 * Register finding-level status endpoints.
 * @param {import('express').Express} app
 */
export function registerFindingsRoutes(app) {
  /**
   * POST /api/finding/:reportPath/:findingId/status
   * Set the status of a specific finding.
   * Body: { status: 'open' | 'applied' | 'false_positive' | 'ignored' }
   */
  app.post('/api/finding/:reportPath/:findingId/status', (req, res) => {
    try {
      const reportPath = decodeURIComponent(req.params.reportPath);
      const findingId = decodeURIComponent(req.params.findingId);
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: status',
        });
      }

      const result = updateFindingStatus(reportPath, { id: findingId }, status);
      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 : 400;
        return res.status(statusCode).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
