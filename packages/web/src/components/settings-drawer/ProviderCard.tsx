import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Bot, Search, Route, Cpu } from 'lucide-react';
import type { ProviderInfo } from './constants';

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  openai: Sparkles,
  anthropic: Bot,
  google: Search,
  '9router': Route,
  nvidia: Cpu,
};

interface ProviderCardProps {
  providerKey: string;
  info: ProviderInfo;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  testStatus: { text: string; type: 'success' | 'error' | 'loading' | 'idle' };
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onTestConnection: () => void;
  onDisconnect: () => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  providerKey,
  info,
  apiKey,
  baseUrl,
  enabled,
  testStatus,
  onApiKeyChange,
  onBaseUrlChange,
  onEnabledChange,
  onTestConnection,
  onDisconnect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = PROVIDER_ICONS[providerKey] ?? Sparkles;

  const isVerified = testStatus.type === 'success';
  const hasKey = !!apiKey;
  const statusDot = isVerified && enabled ? 'bg-success'
    : isVerified ? 'bg-accent/60'
    : hasKey ? 'bg-warning/60'
    : 'bg-text-tertiary/40';

  return (
    <div
      className={`border rounded-lg transition-all cursor-pointer ${
        isExpanded
          ? 'border-accent/40 bg-bg-primary/25'
          : enabled
          ? 'border-card-border bg-bg-primary/20'
          : 'border-card-border/30 bg-bg-primary/10 opacity-60'
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-primary border border-card-border/50">
            <Icon className="h-3.5 w-3.5 text-text-secondary" />
          </div>
          <span className="text-xs font-semibold text-text-primary truncate">{info.name}</span>
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isVerified && (
            <button
              role="switch"
              aria-checked={enabled}
              onClick={(e) => { e.stopPropagation(); onEnabledChange(!enabled); }}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 outline-none ${
                enabled ? 'border-accent bg-accent/20' : 'border-card-border bg-bg-primary/50'
              }`}
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                enabled ? 'translate-x-[14px]' : 'translate-x-[3px]'
              }`} />
            </button>
          )}
          {isVerified && !isExpanded ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDisconnect(); }}
              className="text-xs px-3 py-1 rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 font-medium transition-all cursor-pointer"
            >
              Disconnect
            </button>
          ) : (
            <span className="text-text-secondary">
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-card-border/50 px-3 pb-3 space-y-2 pt-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1">
            <label className="text-xs text-text-tertiary uppercase font-medium">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={providerKey === '9router' ? 'optional' : 'sk-...'}
              autoComplete="new-password"
              className="w-full bg-bg-primary border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-tertiary uppercase font-medium">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder={info.defaultBaseUrl}
              className="w-full bg-bg-primary border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onTestConnection(); }}
              disabled={testStatus.type === 'loading'}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{testStatus.type === 'loading' ? 'Testing...' : 'Connect'}</span>
            </button>
          </div>
          {testStatus.text && (
            <span className={`block text-xs px-2 py-1 rounded border font-medium text-center ${
              testStatus.type === 'success'
                ? 'bg-success/10 border-success/30 text-success'
                : testStatus.type === 'error'
                ? 'bg-danger/10 border-danger/30 text-danger'
                : 'bg-accent/10 border-accent/30 text-accent animate-pulse'
            }`}>
              {testStatus.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
