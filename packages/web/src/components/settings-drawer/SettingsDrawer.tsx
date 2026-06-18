import React, { useState, useCallback } from 'react';
import { X, Globe, Bot, FileCode, AlertCircle } from 'lucide-react';
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

const TABS = [
  { id: 'providers', label: 'Providers', icon: Globe },
  { id: 'agents', label: 'Model/Agent', icon: Bot },
  { id: 'rules', label: 'Rules', icon: FileCode },
] as const;

type TabId = (typeof TABS)[number]['id'];

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
      >
        <div className="w-[1000px] max-w-[94vw] h-[700px] max-h-[90vh] bg-bg-tertiary border border-card-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-card-border flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Settings</h3>
            <button
              onClick={onClose}
              aria-label="Close settings"
              title="Close settings"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-primary/55 transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            <div className="w-[160px] shrink-0 border-r border-card-border bg-bg-primary/10 flex flex-col py-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer border-l-2 ${
                      activeTab === tab.id
                        ? 'text-accent bg-accent/5 border-l-accent'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-primary/30 border-l-transparent'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
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
                      <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-warning">No AI Provider Connected</p>
                        <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
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

                  <AdvancedSettings
                    isOpen={state.isAdvancedOpen}
                    onToggle={() => state.setIsAdvancedOpen(!state.isAdvancedOpen)}
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
                </>
              )}

              {activeTab === 'rules' && (
                <SemgrepSection
                  semgrepRules={state.semgrepRules}
                  onSemgrepRulesChange={state.setSemgrepRules}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
