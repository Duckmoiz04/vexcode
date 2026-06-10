import React from 'react';
import { ChevronDownIcon } from './utils';

export interface AdvancedSettingsProps {
  isOpen: boolean;
  onToggle: () => void;
  temperature: number;
  maxTokens: number;
  resolveTimeout: number;
  namingTimeout: number;
  maxRetries: number;
  requestCooldown: number;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  onResolveTimeoutChange: (value: number) => void;
  onNamingTimeoutChange: (value: number) => void;
  onMaxRetriesChange: (value: number) => void;
  onCooldownChange: (value: number) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  isOpen,
  onToggle,
  temperature,
  maxTokens,
  resolveTimeout,
  namingTimeout,
  maxRetries,
  requestCooldown,
  onTemperatureChange,
  onMaxTokensChange,
  onResolveTimeoutChange,
  onNamingTimeoutChange,
  onMaxRetriesChange,
  onCooldownChange,
}) => {
  return (
    <div className="border-t border-card-border/50 pt-4">
      <button
        onClick={onToggle}
        className="flex justify-between items-center w-full text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <span>Advanced Settings</span>
        <ChevronDownIcon className={`h-3 w-3 text-text-tertiary transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && (
        <div className="space-y-4 pt-3 animate-slide-up">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="settings-temperature" className="text-[10px] text-text-tertiary uppercase font-medium">Temperature</label>
              <input
                id="settings-temperature"
                type="number"
                value={temperature}
                onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                min="0"
                max="2"
                step="0.1"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
              />
              <span className="text-[8px] text-text-tertiary block mt-0.5">0=Precise, 2=Creative</span>
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-max-tokens" className="text-[10px] text-text-tertiary uppercase font-medium">Max Tokens</label>
              <input
                id="settings-max-tokens"
                type="number"
                value={maxTokens}
                onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
                min="256"
                max="128000"
                step="256"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-resolve-timeout" className="text-[10px] text-text-tertiary uppercase font-medium">Resolve Timeout</label>
              <input
                id="settings-resolve-timeout"
                type="number"
                value={resolveTimeout}
                onChange={(e) => onResolveTimeoutChange(parseInt(e.target.value))}
                min="15"
                max="600"
                step="15"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
              />
              <span className="text-[8px] text-text-tertiary block mt-0.5">Seconds per finding</span>
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-naming-timeout" className="text-[10px] text-text-tertiary uppercase font-medium">Naming Timeout</label>
              <input
                id="settings-naming-timeout"
                type="number"
                value={namingTimeout}
                onChange={(e) => onNamingTimeoutChange(parseInt(e.target.value))}
                min="15"
                max="600"
                step="15"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
              />
              <span className="text-[8px] text-text-tertiary block mt-0.5">Seconds per audit file</span>
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-max-retries" className="text-[10px] text-text-tertiary uppercase font-medium">Max Retries</label>
              <input
                id="settings-max-retries"
                type="number"
                value={maxRetries}
                onChange={(e) => onMaxRetriesChange(parseInt(e.target.value))}
                min="0"
                max="5"
                step="1"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-cooldown" className="text-[10px] text-text-tertiary uppercase font-medium">Cooldown</label>
              <input
                id="settings-cooldown"
                type="number"
                value={requestCooldown}
                onChange={(e) => onCooldownChange(parseFloat(e.target.value))}
                min="0"
                max="120"
                step="1"
                className="w-full bg-bg-primary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
              />
              <span className="text-[8px] text-text-tertiary block mt-0.5">Seconds between AI calls</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};