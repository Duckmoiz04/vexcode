import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Register GET/PUT /api/settings/ai endpoints.
 *
 * These delegate to the Python engine's config_cli.py so that the multi-provider
 * AI configuration (providers + agents) is always read from the source of truth
 * (conf/settings.toml + ~/.vexcode/.env).
 */
export function registerAiSettingsRoutes(app, deps) {
  const { runConfigCli } = deps;

  // ---------------------------------------------------------------------------
  // GET /api/settings/ai
  // ---------------------------------------------------------------------------
  // Returns the merged AI configuration: master toggle, providers, agents.
  // API keys are masked ("••••••") for security.
  app.get('/api/settings/ai', async (req, res) => {
    try {
      const config = await runConfigCli('dump');
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error reading AI settings:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------------------------------
  // PUT /api/settings/ai
  // ---------------------------------------------------------------------------
  // Save updated AI configuration. API keys go to .env; everything else goes to
  // conf/settings.toml. Expects a JSON body shaped like:
  //   { enabled, providers: { name: { enabled, model, api_key, base_url } },
  //     agents: { name: { provider, model, enabled } } }
  app.put('/api/settings/ai', async (req, res) => {
    try {
      const body = req.body;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body: expected a JSON object with optional enabled, providers, agents keys.',
        });
      }

      await runConfigCli('update', body);
      res.json({ success: true, message: 'AI settings updated successfully.' });
    } catch (error) {
      console.error('Error saving AI settings:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
