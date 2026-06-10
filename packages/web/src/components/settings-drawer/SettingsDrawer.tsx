import React from 'react';
import { X, Check } from 'lucide-react';
import type { Config } from '../../types';
import { useSettingsDrawer } from './useSettingsDrawer';
import { AiProviderSelector } from './AiProviderSelector';
import { ApiConfigSection } from './ApiConfigSection';
import { ModelSelector } from './ModelSelector';
import { AdvancedSettings } from './AdvancedSettings';
import { SemgrepSection } from './SemgrepSection';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Config) => Promise<void>;
  initialConfig: Config | null;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen, onClose, onSave, initialConfig,
}) => {
  const state = useSettingsDrawer(isOpen, initialConfig);
  const handleSave = async () => { await onSave(state.buildConfig()); };

  return (
    <>
      <div
        className={`fixed inset-0 bg-bg-primary/60 backdrop-blur-sm z-45 transition-all duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-bg-tertiary border-l border-card-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Settings</h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            title="Close settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-primary/55 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          <AiProviderSelector provider={state.provider} onSelect={state.handleProviderSelect} />
          <ApiConfigSection
            provider={state.provider}
            apiKey={state.apiKey}
            apiBaseUrl={state.apiBaseUrl}
            testStatus={state.testStatus}
            onApiKeyChange={state.setApiKey}
            onBaseUrlChange={state.setApiBaseUrl}
            onTestConnection={state.handleTestConnection}
          />
          <ModelSelector
            selectedModel={state.selectedModel}
            modelsList={state.modelsList}
            onModelChange={state.setSelectedModel}
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
          <SemgrepSection
            semgrepRules={state.semgrepRules}
            onSemgrepRulesChange={state.setSemgrepRules}
          />
        </div>

        <div className="p-4 border-t border-card-border bg-bg-primary/20">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </aside>
    </>
  );
};