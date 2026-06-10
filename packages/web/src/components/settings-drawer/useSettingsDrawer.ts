import { useState, useEffect } from 'react';
import type { Config } from '../../types';
import { PROVIDERS } from './constants';

export interface TestStatus {
  text: string;
  type: 'success' | 'error' | 'loading' | 'idle';
}

export function useSettingsDrawer(isOpen: boolean, initialConfig: Config | null) {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [modelsList, setModelsList] = useState<{ id: string; name: string }[]>([]);
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [resolveTimeout, setResolveTimeout] = useState(90);
  const [namingTimeout, setNamingTimeout] = useState(90);
  const [maxRetries, setMaxRetries] = useState(2);
  const [requestCooldown, setRequestCooldown] = useState(8);
  const [semgrepRules, setSemgrepRules] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>({ text: '', type: 'idle' });
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!initialConfig) return;
    const currentProvider = initialConfig.AI_PROVIDER || 'openai';
    setProvider(currentProvider);
    setApiKey(initialConfig[`${currentProvider.toUpperCase()}_API_KEY`] || '');
    setApiBaseUrl(initialConfig[`${currentProvider.toUpperCase()}_BASE_URL`] || PROVIDERS[currentProvider]?.defaultBaseUrl || '');
    setSelectedModel(initialConfig[`${currentProvider.toUpperCase()}_MODEL`] || '');
    setTemperature(parseFloat(initialConfig?.AI_TEMPERATURE ?? '0.1') || 0.1);
    setMaxTokens(parseInt(initialConfig?.AI_MAX_TOKENS ?? '4096') || 4096);
    setResolveTimeout(parseInt(initialConfig?.AI_RESOLVE_TIMEOUT_SECONDS ?? '90') || 90);
    setNamingTimeout(parseInt(initialConfig?.AI_NAMING_TIMEOUT_SECONDS ?? '90') || 90);
    setMaxRetries(parseInt(initialConfig?.AI_MAX_RETRIES ?? '2') || 2);
    setRequestCooldown(parseFloat(initialConfig?.AI_REQUEST_COOLDOWN_SECONDS ?? '8') || 8);
    setSemgrepRules(initialConfig?.SEMGREP_RULES_PATH || '');
    setTestStatus({ text: '', type: 'idle' });
  }, [initialConfig, isOpen]);

  useEffect(() => {
    const fetchModels = async () => {
      const providerData = PROVIDERS[provider];
      if (!providerData) return;
      setModelsList([{ id: 'loading', name: 'Loading models...' }]);
      try {
        const response = await fetch(`/api/models?baseUrl=${encodeURIComponent(apiBaseUrl)}&apiKey=${encodeURIComponent(apiKey)}`);
        const data = await response.json();
        if (data.success && data.models && data.models.length > 0) {
          setModelsList(data.models);
          const exists = data.models.some((m: { id: string }) => m.id === selectedModel);
          if (!exists && data.models.length > 0) setSelectedModel(data.models[0].id);
        } else {
          setModelsList(providerData.models);
        }
      } catch {
        setModelsList(providerData.models);
      }
    };
    if (isOpen) fetchModels();
  }, [provider, apiBaseUrl, apiKey, isOpen]);

  const handleProviderSelect = (prov: string) => {
    setProvider(prov);
    setTestStatus({ text: '', type: 'idle' });
    setApiKey(initialConfig?.[`${prov.toUpperCase()}_API_KEY`] || '');
    setApiBaseUrl(initialConfig?.[`${prov.toUpperCase()}_BASE_URL`] || PROVIDERS[prov]?.defaultBaseUrl || '');
    setSelectedModel(initialConfig?.[`${prov.toUpperCase()}_MODEL`] || '');
  };

  const handleTestConnection = async () => {
    const requiresKey = ['openai', 'anthropic', 'google'].includes(provider);
    if (requiresKey && !apiKey) {
      setTestStatus({ text: 'API key is required for this provider', type: 'error' });
      return;
    }
    setTestStatus({ text: 'Testing...', type: 'loading' });
    try {
      const url = `/api/models?baseUrl=${encodeURIComponent(apiBaseUrl)}&apiKey=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        if (data.models && data.models.length > 0) {
          setTestStatus({ text: `Connected! ${data.models.length} model(s) available`, type: 'success' });
        } else {
          setTestStatus({ text: requiresKey && apiKey ? 'Invalid API key or access denied' : 'Connected! (models listing skipped)', type: requiresKey && apiKey ? 'error' : 'success' });
        }
      } else {
        setTestStatus({ text: data.error || 'Connection failed', type: 'error' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setTestStatus({ text: `Error: ${message}`, type: 'error' });
    }
  };

  const buildConfig = (): Config => {
    const config: Config = {
      AI_PROVIDER: provider,
      AI_TEMPERATURE: temperature.toString(),
      AI_MAX_TOKENS: maxTokens.toString(),
      AI_RESOLVE_TIMEOUT_SECONDS: resolveTimeout.toString(),
      AI_NAMING_TIMEOUT_SECONDS: namingTimeout.toString(),
      AI_MAX_RETRIES: maxRetries.toString(),
      AI_REQUEST_COOLDOWN_SECONDS: requestCooldown.toString(),
    };
    if (provider === '9router') {
      config.NINEROUTER_API_KEY = apiKey;
      config.NINEROUTER_BASE_URL = apiBaseUrl;
      config.NINEROUTER_MODEL = selectedModel;
    } else {
      config[`${provider.toUpperCase()}_API_KEY`] = apiKey;
      config[`${provider.toUpperCase()}_BASE_URL`] = apiBaseUrl;
      config[`${provider.toUpperCase()}_MODEL`] = selectedModel;
    }
    if (semgrepRules) config.SEMGREP_RULES_PATH = semgrepRules;
    return config;
  };

  return {
    provider, apiKey, apiBaseUrl, selectedModel, modelsList,
    temperature, maxTokens, resolveTimeout, namingTimeout,
    maxRetries, requestCooldown, semgrepRules,
    testStatus, isAdvancedOpen,
    setApiKey, setApiBaseUrl, setSelectedModel,
    setTemperature, setMaxTokens, setResolveTimeout,
    setNamingTimeout, setMaxRetries, setRequestCooldown,
    setSemgrepRules, setIsAdvancedOpen,
    handleProviderSelect, handleTestConnection, buildConfig,
  };
}