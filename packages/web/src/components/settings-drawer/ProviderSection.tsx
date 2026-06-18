import React, { useState } from 'react';
import { PROVIDERS } from './constants';
import { ProviderCard } from './ProviderCard';
import type { TestStatus } from './useSettingsDrawer';

interface ProviderState {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  testStatus: TestStatus;
}

interface ProviderSectionProps {
  configs: Record<string, ProviderState>;
  onConfigChange: (key: string, field: string, value: string | boolean | TestStatus) => void;
  onTestConnection: (key: string) => void;
  onDisconnect: (key: string) => void;
  onEnabledChange: (key: string, value: boolean) => void;
}

export const ProviderSection: React.FC<ProviderSectionProps> = ({
  configs,
  onConfigChange,
  onTestConnection,
  onDisconnect,
  onEnabledChange,
}) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const connectedEntries = Object.entries(configs).filter(([, cfg]) =>
    cfg.testStatus.type === 'success',
  );
  const availableEntries = Object.entries(configs).filter(([, cfg]) =>
    cfg.testStatus.type !== 'success',
  );

  return (
    <div className="space-y-2">
      {connectedEntries.length > 0 && (
        <div className="mb-6">
          <h5 className="text-[13px] font-medium text-text-secondary tracking-wide mb-3">Connected</h5>
          <div className="space-y-2">
            {connectedEntries.map(([pk, cfg]) => (
              <ProviderCard
                key={pk}
                providerKey={pk}
                info={PROVIDERS[pk]}
                apiKey={cfg.apiKey}
                enabled={cfg.enabled}
                testStatus={cfg.testStatus}
                onConnect={() => setExpanded(pk)}
                onDisconnect={() => onDisconnect(pk)}
                onEnabledChange={(v) => onEnabledChange(pk, v)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h5 className="text-[13px] font-medium text-text-secondary tracking-wide mb-3">All Providers</h5>
        <div className="space-y-2">
          {availableEntries.map(([pk, cfg]) => (
            <div key={pk}>
              <ProviderCard
                providerKey={pk}
                info={PROVIDERS[pk]}
                apiKey={cfg.apiKey}
                enabled={cfg.enabled}
                testStatus={cfg.testStatus}
                onConnect={() => setExpanded(expanded === pk ? null : pk)}
                onDisconnect={() => onDisconnect(pk)}
                onEnabledChange={(v) => onEnabledChange(pk, v)}
              />
              {expanded === pk && (
                <div className="border-x border-b border-card-border rounded-b-lg bg-bg-primary/25 px-4 py-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[13px] text-text-tertiary font-medium">API Key</label>
                    <input
                      type="password"
                      value={cfg.apiKey}
                      onChange={(e) => onConfigChange(pk, 'apiKey', e.target.value)}
                      placeholder={pk === '9router' ? 'optional' : 'sk-...'}
                      autoComplete="new-password"
                      className="w-full bg-bg-primary border border-card-border rounded-md px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
                    />
                  </div>

                  {!PROVIDERS[pk].defaultBaseUrl && (
                    <div className="space-y-1">
                      <label className="text-[13px] text-text-tertiary font-medium">Base URL</label>
                      <input
                        type="text"
                        value={cfg.baseUrl}
                        onChange={(e) => onConfigChange(pk, 'baseUrl', e.target.value)}
                        placeholder={PROVIDERS[pk].defaultBaseUrl}
                        className="w-full bg-bg-primary border border-card-border rounded-md px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-tertiary"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onTestConnection(pk)}
                      disabled={cfg.testStatus.type === 'loading'}
                      className="flex items-center gap-1.5 py-2 px-4 bg-accent hover:bg-accent-hover text-white text-[13px] font-medium rounded-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {cfg.testStatus.type === 'loading' ? 'Connecting...' : 'Connect'}
                    </button>
                  </div>

                  {cfg.testStatus.text && (
                    <span className={`block text-[13px] px-3 py-1.5 rounded border font-medium text-center ${
                      cfg.testStatus.type === 'success'
                        ? 'bg-success/10 border-success/30 text-success'
                        : cfg.testStatus.type === 'error'
                        ? 'bg-danger/10 border-danger/30 text-danger'
                        : 'bg-accent/10 border-accent/30 text-accent animate-pulse'
                    }`}>
                      {cfg.testStatus.text}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
