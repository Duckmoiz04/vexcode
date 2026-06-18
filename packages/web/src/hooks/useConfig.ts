import { useState, useCallback, useEffect } from 'react';
import type { Config, AiSettings } from '../types';

export function useConfig(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const [envRes, aiRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/settings/ai'),
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

      const results = await Promise.allSettled([
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(envPart),
        }),
        _aiSettings
          ? fetch('/api/settings/ai', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(_aiSettings),
            })
          : Promise.resolve(null),
      ]);

      const configResult = results[0];
      if (configResult.status === 'rejected') {
        throw configResult.reason;
      }
      const configRes = configResult.value;
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

      const aiResult = results[1];
      if (aiResult.status === 'fulfilled' && aiResult.value) {
        const aiRes = aiResult.value;
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