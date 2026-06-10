import React from 'react';
import { PROVIDERS } from './constants';

export interface AiProviderSelectorProps {
  provider: string;
  onSelect: (provider: string) => void;
}

export const AiProviderSelector: React.FC<AiProviderSelectorProps> = ({
  provider,
  onSelect,
}) => {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">AI Provider</h4>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(PROVIDERS).map((p) => {
          const isActive = p === provider;
          return (
            <button
              key={p}
              onClick={() => onSelect(p)}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                isActive
                  ? 'border-accent bg-accent/10 text-text-primary shadow-glow-soft'
                  : 'border-card-border bg-bg-primary/30 text-text-secondary hover:border-text-secondary hover:bg-bg-primary/55'
              }`}
            >
              <span className="capitalize">{PROVIDERS[p].name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};