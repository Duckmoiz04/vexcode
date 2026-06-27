import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';
import type { Config, AiSettings } from '../types';

export function useConfig(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const [envRes, aiRes] = await Promise.all([
        apiFetch('/api/config'),
        apiFetch('/api/settings/ai'),
      ]);
      const envData: Config = (await envRes.json()) || {};
      const aiData = await aiRes.json();
      if (aiData?.config) {
        envData._aiSettings = aiData.config as AiSettings;
      }
      setConfig(envData);
    } catch (err) {
      console.error('Failed to load configuration:', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = useCallback(async (newConfig: Config) => {
    try {
      const { _aiSettings, ...envPart } = newConfig;

      // 1. Save flat configuration first (writes AI_PROVIDER, SEMGREP_RULES_PATH, etc.)
      const configRes = await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envPart),
      });

      const configType = configRes.headers?.get('content-type') || '';
      if (!configType.includes('json')) {
        const text = await configRes.text();
        throw new Error(`POST /api/config returned ${configRes.status} ${configType} — expected JSON. Body: ${text.slice(0, 200)}`);
      }
      const configData = await configRes.json();
      if (!configData.success) {
        showToast(configData.error || 'Failed to save configuration', 'error');
        return;
      }

      // 2. Save structured AI settings (writes TOML settings and API keys to .env)
      // This runs sequentially so config_cli.py reads the updated .env containing AI_PROVIDER.
      if (_aiSettings) {
        const aiRes = await apiFetch('/api/settings/ai', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(_aiSettings),
        });

        const aiType = aiRes.headers?.get('content-type') || '';
        if (!aiType.includes('json')) {
          const text = await aiRes.text();
          throw new Error(`PUT /api/settings/ai returned ${aiRes.status} ${aiType} — expected JSON. Body: ${text.slice(0, 200)}`);
        }
        const aiData = await aiRes.json();
        if (!aiData.success) {
          showToast(aiData.error || 'Failed to save AI settings', 'error');
          return;
        }
      }

      showToast('Configuration saved successfully!');
      await loadConfig();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`Save config failed: ${message}`, 'error');
    }
  }, [showToast, loadConfig]);

  return { config, isSettingsOpen, setIsSettingsOpen, handleSaveConfig };
}