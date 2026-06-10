import { useState, useCallback, useEffect } from 'react';
import type { Config } from '../types';

export function useConfig(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data || {});
    } catch (err) {
      console.error('Failed to load configuration:', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = useCallback(async (newConfig: Config) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const data = await response.json();
      if (data.success) {
        showToast('Configuration saved successfully!');
        setIsSettingsOpen(false);
        await loadConfig();
      } else {
        showToast(data.error || 'Failed to save configuration', 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`Save config failed: ${message}`, 'error');
    }
  }, [showToast, loadConfig]);

  return { config, isSettingsOpen, setIsSettingsOpen, handleSaveConfig };
}