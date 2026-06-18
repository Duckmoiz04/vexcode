import React from 'react';
import { ChevronDownIcon } from './utils';
import { PROVIDERS } from './constants';

interface AgentConfig {
  provider: string;
  model: string;
  enabled: boolean;
}

interface AgentAssignmentSectionProps {
  agents: Record<string, AgentConfig>;
  enabledProviders: string[];
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
  onAgentChange,
}) => {
  const agentNames = Object.keys(agents).length > 0
    ? Object.keys(agents)
    : Object.keys(AGENT_LABELS);

  return (
    <div className="space-y-2">
      <h4 className="text-xs text-text-tertiary uppercase font-bold tracking-wider">
        Agent Assignments
      </h4>
      <p className="text-xs text-text-tertiary leading-relaxed">
        Assign each AI task to a provider and model. Only enabled providers are listed.
      </p>
      <div className="space-y-1.5">
        {agentNames.map((name) => {
          const agent = agents[name] ?? { provider: '', model: '', enabled: false };
          const provModels = agent.provider && PROVIDERS[agent.provider]
            ? PROVIDERS[agent.provider].models
            : [];
          return (
            <div key={name} className="flex items-center gap-2 py-1.5 px-2 rounded-lg border border-card-border/40 bg-bg-primary/10">
              <span className="text-xs font-medium text-text-secondary w-[72px] shrink-0">
                {AGENT_LABELS[name] ?? name}
              </span>
              <div className="relative flex-1">
                <select
                  value={agent.provider || ''}
                  onChange={(e) => {
                    const prov = e.target.value;
                    const firstModel = prov && PROVIDERS[prov]?.models?.[0]?.id || '';
                    onAgentChange(name, 'provider', prov);
                    onAgentChange(name, 'model', firstModel);
                  }}
                  className="w-full bg-bg-primary text-text-primary border border-card-border rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer focus:border-accent transition-all appearance-none"
                >
                  <option value="">-- Disabled --</option>
                  {enabledProviders.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDERS[p]?.name ?? p}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-text-tertiary pointer-events-none" />
              </div>
              {agent.provider && (
                <div className="relative flex-1">
                  <select
                    value={agent.model || ''}
                    onChange={(e) => onAgentChange(name, 'model', e.target.value)}
                    className="w-full bg-bg-primary text-text-primary border border-card-border rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer focus:border-accent transition-all appearance-none"
                  >
                    {provModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-text-tertiary pointer-events-none" />
                </div>
              )}
              <button
                role="switch"
                aria-checked={agent.enabled}
                onClick={() => onAgentChange(name, 'enabled', !agent.enabled)}
                className={`relative inline-flex h-3.5 w-6 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 outline-none ${
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
