import React from 'react';
import type { AiSettings } from '../../types';
import { PROVIDERS } from './constants';

interface AiSettingsSectionProps {
  aiEnabled: boolean;
  providerEnabled: Record<string, boolean>;
  /** The full structured settings (read for agent mapping display). */
  aiSettings: AiSettings | null;
  onAiEnabledChange: (enabled: boolean) => void;
  onProviderEnabledChange: (prov: string, enabled: boolean) => void;
}

function Toggle({ id, checked, onChange, label }: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 outline-none ${
        checked
          ? 'border-accent bg-accent/20'
          : 'border-card-border bg-bg-primary/50'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function ProviderRow({ provKey, name, enabled, onChange }: {
  provKey: string;
  name: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-text-secondary font-medium">{name}</span>
      <Toggle
        id={`provider-toggle-${provKey}`}
        checked={enabled}
        onChange={onChange}
        label={`Enable ${name}`}
      />
    </div>
  );
}

function AgentRow({ name, provider, model }: {
  name: string;
  provider: string;
  model?: string;
}) {
  const providerLabel = PROVIDERS[provider]?.name ?? provider;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-text-secondary capitalize">{name}</span>
      <span className="text-xs text-text-tertiary">
        {providerLabel}{model ? ` · ${model}` : ''}
      </span>
    </div>
  );
}

export const AiSettingsSection: React.FC<AiSettingsSectionProps> = ({
  aiEnabled,
  providerEnabled,
  aiSettings,
  onAiEnabledChange,
  onProviderEnabledChange,
}) => {
  const agents = aiSettings?.agents;
  const providers = aiSettings?.providers;

  return (
    <div className="space-y-3 border-t border-card-border/50 pt-4">
      <h4 className="text-xs text-text-tertiary uppercase font-bold tracking-wider">
        AI Analysis
      </h4>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary font-medium">Enable AI Analysis</span>
        <Toggle
          id="settings-ai-master-toggle"
          checked={aiEnabled}
          onChange={onAiEnabledChange}
          label="Enable AI analysis"
        />
      </div>

      {/* Per-provider toggles — only visible when AI is enabled */}
      {aiEnabled && providers && (
        <div className="pl-2 border-l border-card-border/30 space-y-1">
          <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Providers</span>
          {Object.keys(PROVIDERS).map((pk) => (
            <ProviderRow
              key={pk}
              provKey={pk}
              name={PROVIDERS[pk].name}
              enabled={providerEnabled[pk] ?? providers[pk]?.enabled ?? true}
              onChange={(v) => onProviderEnabledChange(pk, v)}
            />
          ))}
        </div>
      )}

      {/* Agent mapping — read-only */}
      {aiEnabled && agents && Object.keys(agents).length > 0 && (
        <div className="pl-2 border-l border-card-border/30 space-y-1">
          <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Agent Mapping</span>
          {Object.entries(agents).map(([name, agent]) => (
            <AgentRow
              key={name}
              name={name}
              provider={agent.provider}
              model={agent.model}
            />
          ))}
        </div>
      )}
    </div>
  );
};
