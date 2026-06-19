import { useState, useEffect, useCallback, useMemo } from 'react';
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
  /** Models fetched from the provider API (populated after Connect). */
  fetchedModels?: { id: string; name: string }[];
}

const ENV_PREFIX_MAP: Record<string, string> = {
  '9router': 'NINEROUTER',
  openai: 'OPENAI',
  anthropic: 'ANTHROPIC',
  google: 'GOOGLE',
  nvidia: 'NVIDIA',
};

/** Return the env-var prefix for a provider (e.g. "9router" → "NINEROUTER"). */
export function getEnvPrefix(providerKey: string): string {
  return ENV_PREFIX_MAP[providerKey] || providerKey.toUpperCase();
}

function defaultProviderForm(
  pk: string,
  aiSettings?: AiSettings | null,
  initialConfig?: Config | null,
): ProviderFormState {
  const provSettings = aiSettings?.providers?.[pk];
  const prefix = getEnvPrefix(pk);
  const rawKey: string = provSettings?.api_key ?? '';
  const structuredKey: string = rawKey === '••••••' ? '' : rawKey;
  const flatKey: string = (initialConfig?.[`${prefix}_API_KEY`] as string | undefined) ?? '';
  const apiKey: string = flatKey || structuredKey;
  const baseUrl: string = (initialConfig?.[`${prefix}_BASE_URL`] as string | undefined)
    || provSettings?.base_url
    || PROVIDERS[pk]?.defaultBaseUrl
    || '';
  const hasRealKey = (flatKey || structuredKey) !== '';
  // Providers that require an API key but have no saved credentials should
  // not inherit `enabled: true` from old saves — that would be stale data.
  const requiresApiKey = ['openai', 'anthropic', 'google', 'nvidia'].includes(pk);
  const enabled = requiresApiKey && !hasRealKey
    ? false
    : (provSettings?.enabled ?? hasRealKey);
  const testStatus: TestStatus = hasRealKey
    ? { text: 'Connected (saved)', type: 'success' }
    : { text: '', type: 'idle' };
  return { apiKey, baseUrl, enabled, testStatus };
}

function buildDefaultAgents(): Record<string, AiAgentConfig> {
  // Empty by default — agents are populated only after a provider is connected.
  return {};
}

function initAllProviderConfigs(aiSettings?: AiSettings | null, initialConfig?: Config | null): Record<string, ProviderFormState> {
  const configs: Record<string, ProviderFormState> = {};
  // When server-side config exists, only include providers that have actual
  // credentials or are explicitly enabled — filters out stale/dirty entries
  // from older saves that included unconfigured providers.
  // On first-run (no server config yet), fall back to the hardcoded PROVIDERS
  // list so the user can configure them from scratch.
  let providerKeys: string[];
  if (aiSettings?.providers && Object.keys(aiSettings.providers).length > 0) {
    // Include all known providers so users can still configure them,
    // but filter out stale keys that no longer exist in the hardcoded PROVIDERS map.
    providerKeys = Object.entries(aiSettings.providers)
      .filter(([pk]) => PROVIDERS[pk] !== undefined)
      .map(([pk]) => pk);
  } else {
    providerKeys = Object.keys(PROVIDERS);
  }
  for (const pk of providerKeys) {
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

  const handleProviderConfigChange = useCallback((pk: string, field: string, value: string | boolean | TestStatus | undefined) => {
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
          handleProviderConfigChange(pk, 'fetchedModels', data.models);
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

  const enabledProviders = useMemo(
    () => Object.entries(providerConfigs).filter(([, cfg]) => cfg.enabled).map(([pk]) => pk),
    [providerConfigs],
  );

  const hasConnectedProvider = useMemo(
    () => Object.values(providerConfigs).some((cfg) => cfg.enabled && !!cfg.apiKey),
    [providerConfigs],
  );

  const buildConfig = (): Config => {
    const config: Config = {};

    // Flat keys for backward compatibility: write ALL enabled providers so that
    // each provider's real .env key is preserved (the backend GET masks them).
    const allEnabled = Object.entries(providerConfigs).filter(([, c]) => c.enabled);
    if (allEnabled.length > 0) {
      config.AI_PROVIDER = allEnabled[0][0];
    } else {
      config.AI_PROVIDER = '';
    }
    for (const [pk, cfg] of allEnabled) {
      const prefix = getEnvPrefix(pk);
      config[`${prefix}_API_KEY`] = cfg.apiKey;
      config[`${prefix}_BASE_URL`] = cfg.baseUrl;
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
        Object.entries(providerConfigs)
          .filter(([, v]) => v.apiKey || v.enabled) // Only persist configured/enabled providers
          .map(([k, v]) => [
            k,
            {
              enabled: v.enabled,
              requires_key: true,
              api_key: v.apiKey,
              base_url: v.baseUrl,
              model: v.fetchedModels?.[0]?.id
                ?? initialConfig?._aiSettings?.providers?.[k]?.model
                ?? PROVIDERS[k]?.models?.[0]?.id
                ?? '',
            },
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
    isAdvancedOpen, aiEnabled, enabledProviders, hasConnectedProvider,
    setTemperature, setMaxTokens, setResolveTimeout,
    setNamingTimeout, setMaxRetries, setRequestCooldown,
    setSemgrepRules, setIsAdvancedOpen,
    handleProviderConfigChange, handleAgentChange,
    handleTestConnection, buildConfig,
    handleAiEnabledChange: setAiEnabled,
  };
}
