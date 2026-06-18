import { useState, useEffect, useCallback } from 'react';
import type { Config, AiSettings, AiAgentConfig } from '../../types';
import { PROVIDERS } from './constants';

export interface TestStatus {
  text: string;
  type: 'success' | 'error' | 'loading' | 'idle';
}

interface ProviderFormState {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  testStatus: TestStatus;
}

function defaultProviderForm(
  pk: string,
  aiSettings?: AiSettings | null,
  initialConfig?: Config | null,
): ProviderFormState {
  const provSettings = aiSettings?.providers?.[pk];
  const upper = pk.toUpperCase();
  const apiKey = provSettings?.api_key ?? initialConfig?.[`${upper}_API_KEY`] ?? '';
  const baseUrl = provSettings?.base_url ?? initialConfig?.[`${upper}_BASE_URL`] ?? PROVIDERS[pk]?.defaultBaseUrl ?? '';
  const enabled = provSettings?.enabled ?? true;
  return { apiKey, baseUrl, enabled, testStatus: { text: '', type: 'idle' } };
}

function buildDefaultAgents(): Record<string, AiAgentConfig> {
  return {
    suggest: { provider: 'openai', model: 'gpt-4o-mini', enabled: true },
    bug_scan: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
    naming_audit: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
    chat: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
    explain: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
    summarize: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
  };
}

function initAllProviderConfigs(aiSettings?: AiSettings | null, initialConfig?: Config | null): Record<string, ProviderFormState> {
  const configs: Record<string, ProviderFormState> = {};
  for (const pk of Object.keys(PROVIDERS)) {
    configs[pk] = defaultProviderForm(pk, aiSettings, initialConfig);
  }
  return configs;
}

export function useSettingsDrawer(isOpen: boolean, initialConfig: Config | null) {
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderFormState>>({});
  const [agentMappings, setAgentMappings] = useState<Record<string, AiAgentConfig>>({});
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [resolveTimeout, setResolveTimeout] = useState(90);
  const [namingTimeout, setNamingTimeout] = useState(90);
  const [maxRetries, setMaxRetries] = useState(2);
  const [requestCooldown, setRequestCooldown] = useState(8);
  const [semgrepRules, setSemgrepRules] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    const as = initialConfig?._aiSettings;
    setAiEnabled(as?.enabled ?? true);
    setProviderConfigs(initAllProviderConfigs(as ?? null, initialConfig));
    setAgentMappings(as?.agents && Object.keys(as.agents).length > 0
      ? structuredClone(as.agents)
      : buildDefaultAgents(),
    );
    setTemperature(parseFloat(initialConfig?.AI_TEMPERATURE ?? '0.1') || 0.1);
    setMaxTokens(parseInt(initialConfig?.AI_MAX_TOKENS ?? '4096') || 4096);
    setResolveTimeout(parseInt(initialConfig?.AI_RESOLVE_TIMEOUT_SECONDS ?? '90') || 90);
    setNamingTimeout(parseInt(initialConfig?.AI_NAMING_TIMEOUT_SECONDS ?? '90') || 90);
    setMaxRetries(parseInt(initialConfig?.AI_MAX_RETRIES ?? '2') || 2);
    setRequestCooldown(parseFloat(initialConfig?.AI_REQUEST_COOLDOWN_SECONDS ?? '8') || 8);
    setSemgrepRules(initialConfig?.SEMGREP_RULES_PATH || '');
  }, [initialConfig, isOpen]);

  const handleProviderConfigChange = useCallback((pk: string, field: string, value: string | boolean | TestStatus) => {
    setProviderConfigs((prev) => ({
      ...prev,
      [pk]: { ...prev[pk], [field]: value },
    }));
  }, []);

  const handleAgentChange = useCallback((name: string, field: string, value: string | boolean) => {
    setAgentMappings((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  }, []);

  const handleTestConnection = useCallback(async (pk: string): Promise<{ success: boolean; message: string }> => {
    const cfg = providerConfigs[pk];
    if (!cfg) return { success: false, message: 'Provider not found' };
    const requiresKey = ['openai', 'anthropic', 'google', 'nvidia'].includes(pk);
    if (requiresKey && !cfg.apiKey) {
      handleProviderConfigChange(pk, 'testStatus', { text: 'API key is required', type: 'error' });
      return { success: false, message: 'API key is required' };
    }
    handleProviderConfigChange(pk, 'testStatus', { text: 'Testing...', type: 'loading' });
    try {
      const url = `/api/models?baseUrl=${encodeURIComponent(cfg.baseUrl)}&apiKey=${encodeURIComponent(cfg.apiKey)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        if (data.models && data.models.length > 0) {
          const msg = `Connected! ${data.models.length} model(s) available`;
          handleProviderConfigChange(pk, 'testStatus', { text: msg, type: 'success' });
          return { success: true, message: msg };
        } else {
          const msg = requiresKey && cfg.apiKey ? 'Invalid API key or access denied' : 'Connected!';
          const ok = !(requiresKey && cfg.apiKey);
          handleProviderConfigChange(pk, 'testStatus', { text: msg, type: ok ? 'success' : 'error' });
          return { success: ok, message: msg };
        }
      } else {
        const msg = data.error || 'Connection failed';
        handleProviderConfigChange(pk, 'testStatus', { text: msg, type: 'error' });
        return { success: false, message: msg };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      handleProviderConfigChange(pk, 'testStatus', { text: `Error: ${message}`, type: 'error' });
      return { success: false, message };
    }
  }, [providerConfigs, handleProviderConfigChange]);

  const enabledProviders = Object.entries(providerConfigs)
    .filter(([, cfg]) => cfg.enabled)
    .map(([pk]) => pk);

  const buildConfig = (): Config => {
    const config: Config = {};

    // Flat keys for backward compatibility
    const firstEnabled = Object.entries(providerConfigs).find(([, c]) => c.enabled);
    if (firstEnabled) {
      config.AI_PROVIDER = firstEnabled[0];
      const upper = firstEnabled[0].toUpperCase();
      config[`${upper}_API_KEY`] = firstEnabled[1].apiKey;
      config[`${upper}_BASE_URL`] = firstEnabled[1].baseUrl;
    }
    config.AI_TEMPERATURE = temperature.toString();
    config.AI_MAX_TOKENS = maxTokens.toString();
    config.AI_RESOLVE_TIMEOUT_SECONDS = resolveTimeout.toString();
    config.AI_NAMING_TIMEOUT_SECONDS = namingTimeout.toString();
    config.AI_MAX_RETRIES = maxRetries.toString();
    config.AI_REQUEST_COOLDOWN_SECONDS = requestCooldown.toString();
    if (semgrepRules) config.SEMGREP_RULES_PATH = semgrepRules;

    // Structured multi-provider settings
    config._aiSettings = {
      enabled: aiEnabled,
      providers: Object.fromEntries(
        Object.entries(providerConfigs).map(([k, v]) => [
          k,
          { enabled: v.enabled, requires_key: true, api_key: v.apiKey, base_url: v.baseUrl, model: PROVIDERS[k]?.models?.[0]?.id ?? '' },
        ]),
      ),
      agents: agentMappings,
    };
    return config;
  };

  return {
    providerConfigs,
    agentMappings,
    temperature, maxTokens, resolveTimeout, namingTimeout,
    maxRetries, requestCooldown, semgrepRules,
    isAdvancedOpen, aiEnabled, enabledProviders,
    setTemperature, setMaxTokens, setResolveTimeout,
    setNamingTimeout, setMaxRetries, setRequestCooldown,
    setSemgrepRules, setIsAdvancedOpen,
    handleProviderConfigChange, handleAgentChange,
    handleTestConnection, buildConfig,
    handleAiEnabledChange: setAiEnabled,
  };
}
