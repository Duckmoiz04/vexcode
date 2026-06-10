import React from 'react';
import { Play } from 'lucide-react';
import { PROVIDERS } from './constants';

export interface ApiConfigSectionProps {
  provider: string;
  apiKey: string;
  apiBaseUrl: string;
  testStatus: { text: string; type: 'success' | 'error' | 'loading' | 'idle' };
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onTestConnection: () => void;
}

export const ApiConfigSection: React.FC<ApiConfigSectionProps> = ({
  provider,
  apiKey,
  apiBaseUrl,
  testStatus,
  onApiKeyChange,
  onBaseUrlChange,
  onTestConnection,
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider border-b border-card-border/50 pb-1">
        API Configuration
      </h4>

      {/* API Key */}
      <div className="space-y-1">
        <label htmlFor="settings-api-key" className="text-xs text-text-secondary font-medium">API Key</label>
        <input
          id="settings-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={provider === '9router' ? 'optional for 9router' : 'Enter API Key'}
          autoComplete="new-password"
          className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
        />
      </div>

      {/* Base URL */}
      <div className="space-y-1">
        <label htmlFor="settings-base-url" className="text-xs text-text-secondary font-medium">Base URL</label>
        <input
          id="settings-base-url"
          type="text"
          value={apiBaseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder={PROVIDERS[provider]?.defaultBaseUrl || 'Enter Base URL'}
          className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
        />
        <span className="text-[9px] text-text-tertiary block mt-1">
          Example: {PROVIDERS[provider]?.defaultBaseUrl || ''}
        </span>
      </div>

      {/* Test Connection Button */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onTestConnection}
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
  );
};