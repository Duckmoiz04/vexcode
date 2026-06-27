import React from 'react';
import { ChevronDownIcon } from './utils';
import { PROVIDERS } from './constants';

interface AgentConfig {
  provider: string;
  model: string;
  enabled: boolean;
}

interface ProviderState {
  fetchedModels?: { id: string; name: string }[];
}

interface AgentAssignmentSectionProps {
  agents: Record<string, AgentConfig>;
  enabledProviders: string[];
  providerConfigs: Record<string, ProviderState>;
  disabled?: boolean;
  onAgentChange: (name: string, field: string, value: string | boolean) => void;
}

const AGENT_LABELS: Record<string, string> = {
  suggest: 'Code Suggest',
  bug_scan: 'Bug Scan',
  naming_audit: 'Naming Audit',
  chat: 'Chat',
  explain: 'Explain',
  summarize: 'Summarize',
};

export const AgentAssignmentSection: React.FC<AgentAssignmentSectionProps> = ({
  agents,
  enabledProviders,
  providerConfigs,
  disabled = false,
  onAgentChange,
}) => {
  // Always show all known agents from AGENT_LABELS. Saved `agents` only
  // supplies the values (provider, model, enabled) — not which rows to show.
  const agentNames = Object.keys(AGENT_LABELS);

  return (
    <div className={`space-y-2 transition-opacity duration-200 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <h4 className="text-base text-text-primary/90 font-medium tracking-wider mb-8">
        Agent Assignments
      </h4>
      <p className="text-[13px] text-text-tertiary leading-relaxed">
        Assign each AI task to a provider and model. Only enabled providers are listed.
      </p>
      <div className="space-y-1.5">
        {agentNames.map((name) => {
          const agent = agents[name] ?? { provider: '', model: '', enabled: false };
          // Use dynamically fetched models if available, else fall back to hardcoded list
          const provModels = agent.provider
            ? (providerConfigs[agent.provider]?.fetchedModels ?? [])
            : [];
          return (
            <div key={name} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-card-border/40 bg-bg-primary/10">
              <span className="text-[13px] font-medium text-text-secondary w-[80px] shrink-0">
                {AGENT_LABELS[name] ?? name}
              </span>
              <div className="relative flex-1">
                    <select
                      value={agent.provider || ''}
                      onChange={(e) => {
                        const prov = e.target.value;
                        onAgentChange(name, 'provider', prov);
                        onAgentChange(name, 'model', '');
                      }}
                  disabled={disabled}
					className="w-full bg-bg-primary text-text-primary border border-card-border rounded-md px-3 py-2 text-[13px] outline-none cursor-pointer focus:border-accent transition-all appearance-none disabled:cursor-not-allowed"
                  >
                    <option value="">-- Disabled --</option>
                    {enabledProviders.map((p) => (
                      <option key={p} value={p}>
                        {PROVIDERS[p]?.name ?? p}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary pointer-events-none" />
                </div>
                {agent.provider && (
                  <div className="relative flex-1">
                    <select
                      value={agent.model || ''}
                      onChange={(e) => onAgentChange(name, 'model', e.target.value)}
                      disabled={disabled}
className="w-full bg-bg-primary text-text-primary border border-card-border rounded-md px-3 py-2 text-[13px] outline-none cursor-pointer focus:border-accent transition-all appearance-none disabled:cursor-not-allowed"
                    >
                      <option value="">-- Select a model --</option>
                      {provModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary pointer-events-none" />
                </div>
              )}
              <button
                role="switch"
                aria-checked={agent.enabled}
                disabled={disabled}
                onClick={() => onAgentChange(name, 'enabled', !agent.enabled)}
                className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full border transition-colors duration-200 outline-none ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${
                  agent.enabled ? 'border-accent bg-accent/20' : 'border-card-border bg-bg-primary/50'
                }`}
              >
                <span className={`inline-block h-2 w-2 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                  agent.enabled ? 'translate-x-[12px]' : 'translate-x-[2px]'
                }`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
