import React, { useState, useCallback } from 'react';
import { X, Cloud, Sparkles, FileCode, AlertCircle, Sliders, Ban, Palette } from 'lucide-react';
import type { Config } from '../../types';
import { useSettingsDrawer } from './useSettingsDrawer';
import { ProviderSection } from './ProviderSection';
import { AgentAssignmentSection } from './AgentAssignmentSection';
import { AdvancedSettings } from './AdvancedSettings';
import { SemgrepSection } from './SemgrepSection';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Config) => Promise<void>;
  initialConfig: Config | null;
}

const TAB_GROUPS = [
  {
    id: 'ai-config',
    label: 'AI Setup',
    items: [
      { id: 'providers', label: 'Providers', icon: Cloud },
      { id: 'agents', label: 'Models', icon: Sparkles },
      { id: 'parameters', label: 'Parameters', icon: Sliders },
    ],
  },
  {
    id: 'scanning',
    label: 'Scanning',
    items: [
      { id: 'rules', label: 'Rules', icon: FileCode },
      { id: 'exclusions', label: 'Exclusions', icon: Ban },
    ],
  },
  {
    id: 'general',
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette },
    ],
  },
] as const;

type TabId = (typeof TAB_GROUPS)[number]['items'][number]['id'];

function Toggle({ id, checked, onChange, label }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 outline-none ${
        checked ? 'border-accent bg-accent/20' : 'border-card-border bg-bg-primary/50'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`} />
    </button>
  );
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen, onClose, onSave, initialConfig,
}) => {
  const state = useSettingsDrawer(isOpen, initialConfig);
  const [activeTab, setActiveTab] = useState<TabId>('providers');

  const getActiveTabLabel = (): string => {
    for (const group of TAB_GROUPS) {
      const item = group.items.find(i => i.id === activeTab);
      if (item) return item.label;
    }
    return '';
  };

  const handleTestConnection = useCallback(async (pk: string) => {
    const result = await state.handleTestConnection(pk);
    if (result.success) {
      state.handleProviderConfigChange(pk, 'enabled', true);
      const config = state.buildConfig();
      if (config._aiSettings?.providers[pk]) {
        config._aiSettings.providers[pk].enabled = true;
        config._aiSettings.providers[pk].api_key = state.providerConfigs[pk].apiKey;
        config._aiSettings.providers[pk].base_url = state.providerConfigs[pk].baseUrl;
      }
      await onSave(config);
    }
  }, [state, onSave]);

  const handleDisconnect = useCallback(async (pk: string) => {
    state.handleProviderConfigChange(pk, 'apiKey', '');
    state.handleProviderConfigChange(pk, 'testStatus', { text: '', type: 'idle' });
    state.handleProviderConfigChange(pk, 'enabled', false);
    state.handleProviderConfigChange(pk, 'fetchedModels', undefined);
    const config = state.buildConfig();
    if (config._aiSettings?.providers[pk]) {
      config._aiSettings.providers[pk].api_key = '';
      config._aiSettings.providers[pk].enabled = false;
    }
    await onSave(config);
  }, [state, onSave]);

  const handleEnabledChange = useCallback(async (pk: string, value: boolean) => {
    state.handleProviderConfigChange(pk, 'enabled', value);
    const config = state.buildConfig();
    if (config._aiSettings?.providers[pk]) {
      config._aiSettings.providers[pk].enabled = value;
    }
    await onSave(config);
  }, [state, onSave]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-bg-primary/60 backdrop-blur-sm z-45 transition-all duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-[85vw] max-w-[1100px] min-h-[520px] max-h-[90vh] aspect-[3/2] bg-bg-tertiary border border-card-border rounded-lg shadow-2xl flex flex-col overflow-hidden">

          <div className="flex flex-1 min-h-0">
            <div className="w-1/5 shrink-0 border-r border-card-border bg-bg-primary/25 flex flex-col pt-5 pb-2">
              {TAB_GROUPS.map((group) => (
                <div key={group.id}>
                  <div className="pl-5 pr-4 pt-3.5 pb-1.5">
                    <p className="text-xs font-medium text-text-secondary/90 tracking-wide">{group.label}</p>
                  </div>
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
className={`flex items-center gap-2.5 w-full pl-5 pr-4 py-2.5 text-[13px] transition-colors cursor-pointer border-l-2 ${
                           activeTab === item.id
                             ? 'text-accent bg-accent/5 border-l-accent'
                             : 'text-text-primary/85 hover:bg-bg-primary/30 border-l-transparent'
                        }`}
                      >
                        <ItemIcon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="pl-6 pr-5 py-3 border-b border-card-border flex items-center justify-between shrink-0">
                <h3 className="text-base font-medium text-text-primary tracking-wider">{getActiveTabLabel()}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close settings"
                  title="Close settings"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-primary/55 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {activeTab === 'providers' && (
                <ProviderSection
                  configs={state.providerConfigs}
                  onConfigChange={state.handleProviderConfigChange}
                  onTestConnection={handleTestConnection}
                  onDisconnect={handleDisconnect}
                  onEnabledChange={handleEnabledChange}
                />
              )}

              {activeTab === 'agents' && (
                <>
                  {!state.hasConnectedProvider && (
                    <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/5">
                      <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div>
                          <p className="text-[13px] font-semibold text-warning">No AI Provider Connected</p>
                        <p className="text-[13px] text-text-tertiary mt-1 leading-relaxed">
                          Connect an AI provider in the <strong>Providers</strong> tab first.
                          Once connected, you can assign models to AI agents here.
                        </p>
                      </div>
                    </div>
                  )}

                  <AgentAssignmentSection
                    agents={state.agentMappings}
                    enabledProviders={state.enabledProviders}
                    providerConfigs={state.providerConfigs}
                    disabled={!state.hasConnectedProvider}
                    onAgentChange={state.handleAgentChange}
                  />
                </>
              )}

              {activeTab === 'parameters' && (
                <AdvancedSettings
                  isOpen={true}
                  onToggle={() => {}}
                  temperature={state.temperature}
                  maxTokens={state.maxTokens}
                  resolveTimeout={state.resolveTimeout}
                  namingTimeout={state.namingTimeout}
                  maxRetries={state.maxRetries}
                  requestCooldown={state.requestCooldown}
                  onTemperatureChange={state.setTemperature}
                  onMaxTokensChange={state.setMaxTokens}
                  onResolveTimeoutChange={state.setResolveTimeout}
                  onNamingTimeoutChange={state.setNamingTimeout}
                  onMaxRetriesChange={state.setMaxRetries}
                  onCooldownChange={state.setRequestCooldown}
                />
              )}

              {activeTab === 'rules' && (
                <SemgrepSection
                  semgrepRules={state.semgrepRules}
                  onSemgrepRulesChange={state.setSemgrepRules}
                />
              )}

              {activeTab === 'exclusions' && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Ban className="h-12 w-12 text-text-tertiary/40 mb-4" />
                  <h3 className="text-[13px] font-semibold text-text-tertiary">Exclusions</h3>
                  <p className="text-[13px] text-text-tertiary/60 mt-1">Configure files and folders to skip during scan.</p>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Palette className="h-12 w-12 text-text-tertiary/40 mb-4" />
                  <h3 className="text-[13px] font-semibold text-text-tertiary">Appearance</h3>
                  <p className="text-[13px] text-text-tertiary/60 mt-1">Customize the look and feel of the dashboard.</p>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
