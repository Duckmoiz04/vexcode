import React, { useState, useEffect } from 'react';
import { X, Play, Check } from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => Promise<void>;
  initialConfig: any;
}

const PROVIDERS: Record<string, any> = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
      { id: 'gpt-4o', name: 'GPT-4o (Balanced)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (Advanced)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Legacy)' }
    ],
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet (Balanced)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Advanced)' }
    ],
    defaultBaseUrl: 'https://api.anthropic.com'
  },
  google: {
    name: 'Google',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Advanced)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Latest)' }
    ],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com'
  },
  '9router': {
    name: '9router',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
      { id: 'openai/gpt-4o', name: 'GPT-4o (Balanced)' },
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo (Advanced)' },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (Fast)' },
      { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet (Balanced)' }
    ],
    defaultBaseUrl: 'http://localhost:20128/v1'
  }
};

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}) => {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [modelsList, setModelsList] = useState<any[]>([]);
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [resolveTimeout, setResolveTimeout] = useState(90);
  const [namingTimeout, setNamingTimeout] = useState(90);
  const [maxRetries, setMaxRetries] = useState(2);
  const [requestCooldown, setRequestCooldown] = useState(8);
  const [semgrepRules, setSemgrepRules] = useState('');
  
  const [testStatus, setTestStatus] = useState<{ text: string; type: 'success' | 'error' | 'loading' | 'idle' }>({
    text: '',
    type: 'idle',
  });
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Load configuration details when initialConfig or active provider changes
  useEffect(() => {
    if (!initialConfig) return;

    const currentProvider = initialConfig.AI_PROVIDER || 'openai';
    setProvider(currentProvider);

    const key = initialConfig[`${currentProvider.toUpperCase()}_API_KEY`] || '';
    setApiKey(key);

    const baseUrl = initialConfig[`${currentProvider.toUpperCase()}_BASE_URL`] || PROVIDERS[currentProvider]?.defaultBaseUrl || '';
    setApiBaseUrl(baseUrl);

    const model = initialConfig[`${currentProvider.toUpperCase()}_MODEL`] || '';
    setSelectedModel(model);

    setTemperature(parseFloat(initialConfig.AI_TEMPERATURE) || 0.1);
    setMaxTokens(parseInt(initialConfig.AI_MAX_TOKENS) || 4096);
    setResolveTimeout(parseInt(initialConfig.AI_RESOLVE_TIMEOUT_SECONDS) || 90);
    setNamingTimeout(parseInt(initialConfig.AI_NAMING_TIMEOUT_SECONDS) || 90);
    setMaxRetries(parseInt(initialConfig.AI_MAX_RETRIES) || 2);
    setRequestCooldown(parseFloat(initialConfig.AI_REQUEST_COOLDOWN_SECONDS) || 8);
    setSemgrepRules(initialConfig.SEMGREP_RULES_PATH || '');
    setTestStatus({ text: '', type: 'idle' });
  }, [initialConfig, isOpen]);

  // Load models dynamically or fallback to static list
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
          // Auto-select first model if currently selected model is empty or not in the fetched list
          const exists = data.models.some((m: any) => m.id === selectedModel);
          if (!exists && data.models.length > 0) {
            setSelectedModel(data.models[0].id);
          }
        } else {
          setModelsList(providerData.models);
        }
      } catch (err) {
        setModelsList(providerData.models);
      }
    };

    if (isOpen) {
      fetchModels();
    }
  }, [provider, apiBaseUrl, apiKey, isOpen]);

  const handleProviderSelect = (prov: string) => {
    setProvider(prov);
    setTestStatus({ text: '', type: 'idle' });
    const key = initialConfig?.[`${prov.toUpperCase()}_API_KEY`] || '';
    setApiKey(key);
    const baseUrl = initialConfig?.[`${prov.toUpperCase()}_BASE_URL`] || PROVIDERS[prov]?.defaultBaseUrl || '';
    setApiBaseUrl(baseUrl);
    const savedModel = initialConfig?.[`${prov.toUpperCase()}_MODEL`] || PROVIDERS[prov]?.models[0]?.id || '';
    setSelectedModel(savedModel);
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
          if (requiresKey && apiKey) {
            setTestStatus({ text: 'Invalid API key or access denied', type: 'error' });
          } else {
            setTestStatus({ text: 'Connected! (models listing skipped)', type: 'success' });
          }
        }
      } else {
        setTestStatus({ text: data.error || 'Connection failed', type: 'error' });
      }
    } catch (err: any) {
      setTestStatus({ text: `Error: ${err.message || 'Connection failed'}`, type: 'error' });
    }
  };

  const handleSave = async () => {
    const config: any = {
      AI_PROVIDER: provider,
      AI_TEMPERATURE: temperature.toString(),
      AI_MAX_TOKENS: maxTokens.toString(),
      AI_RESOLVE_TIMEOUT_SECONDS: resolveTimeout.toString(),
      AI_NAMING_TIMEOUT_SECONDS: namingTimeout.toString(),
      AI_MAX_RETRIES: maxRetries.toString(),
      AI_REQUEST_COOLDOWN_SECONDS: requestCooldown.toString(),
    };

    config[`${provider.toUpperCase()}_API_KEY`] = apiKey;
    config[`${provider.toUpperCase()}_BASE_URL`] = apiBaseUrl;
    config[`${provider.toUpperCase()}_MODEL`] = selectedModel;

    if (provider === '9router') {
      config.NINEROUTER_API_KEY = apiKey;
      config.NINEROUTER_BASE_URL = apiBaseUrl;
      config.NINEROUTER_MODEL = selectedModel;
    }

    if (semgrepRules) {
      config.SEMGREP_RULES_PATH = semgrepRules;
    }

    await onSave(config);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-bg-primary/60 backdrop-blur-sm z-45 transition-all duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer Container */}
      <aside
        className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-bg-tertiary border-l border-card-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Settings</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-primary/55 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          {/* AI Provider selection */}
          <div className="space-y-2">
            <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">AI Provider</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(PROVIDERS).map((p) => {
                const isActive = p === provider;
                return (
                  <button
                    key={p}
                    onClick={() => handleProviderSelect(p)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      isActive
                        ? 'border-accent bg-accent/10 text-text-primary shadow-glow-soft'
                        : 'border-card-border bg-bg-primary/30 text-text-secondary hover:border-text-secondary hover:bg-bg-primary/55'
                    }`}
                  >
                    <span className="capitalize">{PROVIDERS[p].name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Configuration */}
          <div className="space-y-4">
            <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1">
              API Configuration
            </h4>

            {/* API Key */}
            <div className="space-y-1">
              <label className="text-xs text-text-secondary font-medium">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === '9router' ? 'optional for 9router' : 'Enter API Key'}
                autoComplete="new-password"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
              />
            </div>

            {/* Base URL */}
            <div className="space-y-1">
              <label className="text-xs text-text-secondary font-medium">Base URL</label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="Enter Base URL"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
              />
              <span className="text-[9px] text-text-tertiary block mt-1">
                Default: {PROVIDERS[provider]?.defaultBaseUrl}
              </span>
            </div>

            {/* Test Connection Button */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testStatus.type === 'loading'}
                className="flex items-center justify-center gap-2 py-1.5 px-3 border border-card-border bg-bg-primary/30 hover:bg-bg-primary/70 text-xs font-semibold rounded-lg text-text-secondary hover:text-text-primary transition-all cursor-pointer disabled:opacity-50"
              >
                <Play className="h-3 w-3" />
                <span>Test Connection</span>
              </button>
              {testStatus.text && (
                <div
                  className={`text-[10px] px-2 py-1 rounded border font-medium ${
                    testStatus.type === 'success'
                      ? 'bg-success/10 border-success/30 text-success'
                      : testStatus.type === 'error'
                      ? 'bg-danger/10 border-danger/30 text-danger'
                      : 'bg-accent/10 border-accent/30 text-accent animate-pulse'
                  }`}
                >
                  {testStatus.text}
                </div>
              )}
            </div>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">AI Model</h4>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-bg-primary text-text-primary border border-card-border rounded-lg px-3 py-2 text-xs outline-none cursor-pointer focus:border-accent transition-all appearance-none"
              >
                {modelsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
            </div>
          </div>

          {/* Advanced config accordion */}
          <div className="border-t border-card-border/50 pt-4">
            <button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex justify-between items-center w-full text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <span>Advanced Settings</span>
              <ChevronDownIcon className={`h-3 w-3 text-text-tertiary transition-transform duration-150 ${isAdvancedOpen ? '' : '-rotate-90'}`} />
            </button>
            {isAdvancedOpen && (
              <div className="space-y-4 pt-3 animate-slide-up">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-tertiary uppercase font-medium">Temperature</label>
                    <input
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      min="0"
                      max="2"
                      step="0.1"
                      className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
                    />
                    <span className="text-[8px] text-text-tertiary block mt-0.5">0=Precise, 2=Creative</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-tertiary uppercase font-medium">Max Tokens</label>
                    <input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      min="256"
                      max="128000"
                      step="256"
                      className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-tertiary uppercase font-medium">Resolve Timeout</label>
                    <input
                      type="number"
                      value={resolveTimeout}
                      onChange={(e) => setResolveTimeout(parseInt(e.target.value))}
                      min="15"
                      max="600"
                      step="15"
                      className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
                    />
                    <span className="text-[8px] text-text-tertiary block mt-0.5">Seconds per finding</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-tertiary uppercase font-medium">Naming Timeout</label>
                    <input
                      type="number"
                      value={namingTimeout}
                      onChange={(e) => setNamingTimeout(parseInt(e.target.value))}
                      min="15"
                      max="600"
                      step="15"
                      className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
                    />
                    <span className="text-[8px] text-text-tertiary block mt-0.5">Seconds per audit file</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-tertiary uppercase font-medium">Max Retries</label>
                    <input
                      type="number"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                      min="0"
                      max="5"
                      step="1"
                      className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-tertiary uppercase font-medium">Cooldown</label>
                    <input
                      type="number"
                      value={requestCooldown}
                      onChange={(e) => setRequestCooldown(parseFloat(e.target.value))}
                      min="0"
                      max="120"
                      step="1"
                      className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
                    />
                    <span className="text-[8px] text-text-tertiary block mt-0.5">Seconds between AI calls</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Semgrep path configuration */}
          <div className="space-y-2 border-t border-card-border/50 pt-4">
            <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Semgrep</h4>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary font-medium">Rules Path</label>
              <input
                type="text"
                value={semgrepRules}
                onChange={(e) => setSemgrepRules(e.target.value)}
                placeholder="Optional rules file path"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
              />
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-card-border bg-bg-primary/20">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </aside>
    </>
  );
};

// Helper chevron element
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
