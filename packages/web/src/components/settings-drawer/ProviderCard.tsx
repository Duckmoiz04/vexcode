import React from 'react';
import { Sparkles, Bot, Search, Route, Cpu } from 'lucide-react';
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
  enabled: boolean;
  testStatus: { text: string; type: 'success' | 'error' | 'loading' | 'idle' };
  onConnect: () => void;
  onDisconnect: () => void;
  onEnabledChange: (value: boolean) => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  providerKey,
  info,
  apiKey,
  enabled,
  testStatus,
  onConnect,
  onDisconnect,
  onEnabledChange,
}) => {
  const Icon = PROVIDER_ICONS[providerKey] ?? Sparkles;

  const isVerified = testStatus.type === 'success';
  const hasKey = !!apiKey;
  const statusDot = isVerified && enabled ? 'bg-success'
    : isVerified ? 'bg-accent/60'
    : hasKey ? 'bg-warning/60'
    : 'bg-text-tertiary/40';

  return (
    <div className={`border rounded-lg transition-all bg-bg-primary/25 ${
      isVerified && !enabled
        ? 'border-card-border/30 opacity-60'
        : 'border-card-border'
    }`}>
      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-primary border border-card-border/50">
            <Icon className="h-5 w-5 text-text-secondary" />
          </div>
          <span className="text-[13px] font-semibold text-text-primary truncate">{info.name}</span>
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isVerified ? (
            <>
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
              <button
                onClick={(e) => { e.stopPropagation(); onDisconnect(); }}
                className="text-[13px] px-2.5 py-1 rounded-md text-text-secondary hover:text-danger font-medium transition-all cursor-pointer"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onConnect(); }}
              className="text-[13px] px-3 py-1.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-md transition-all cursor-pointer"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
