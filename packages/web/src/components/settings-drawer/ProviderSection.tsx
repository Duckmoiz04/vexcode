import React from 'react';
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
  return (
    <div className="space-y-2">
      <h4 className="text-xs text-text-tertiary uppercase font-bold tracking-wider">
        AI Providers
      </h4>
      <p className="text-xs text-text-tertiary leading-relaxed">
        Click <strong>chevron</strong> to expand and configure a provider.
      </p>
      <div className="space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {Object.keys(PROVIDERS).map((pk) => {
          const cfg = configs[pk];
          if (!cfg) return null;
          return (
            <ProviderCard
              key={pk}
              providerKey={pk}
              info={PROVIDERS[pk]}
              apiKey={cfg.apiKey}
              baseUrl={cfg.baseUrl}
              enabled={cfg.enabled}
              testStatus={cfg.testStatus}
              onApiKeyChange={(v) => onConfigChange(pk, 'apiKey', v)}
              onBaseUrlChange={(v) => onConfigChange(pk, 'baseUrl', v)}
              onEnabledChange={(v) => onEnabledChange(pk, v)}
              onTestConnection={() => onTestConnection(pk)}
              onDisconnect={() => onDisconnect(pk)}
            />
          );
        })}
      </div>
    </div>
  );
};
