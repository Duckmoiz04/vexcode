export function registerConfigRoutes(app, deps) {
  const { readEnvConfig, writeEnvConfig, envPath } = deps;

  app.get('/api/config', (req, res) => {
    const config = readEnvConfig(envPath);
    res.json(config);
  });

  app.post('/api/config', (req, res) => {
    try {
      const newConfig = req.body;

      if (!newConfig || typeof newConfig !== 'object' || Array.isArray(newConfig)) {
        return res.status(400).json({ success: false, error: 'Invalid request body: expected a JSON object.' });
      }

      writeEnvConfig(newConfig, envPath);
      res.json({ success: true, message: 'Configuration updated successfully.' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}