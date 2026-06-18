import React from 'react';
import { ChevronDownIcon } from './utils';

export interface ModelSelectorProps {
  selectedModel: string;
  modelsList: { id: string; name: string }[];
  onModelChange: (value: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  modelsList,
  onModelChange,
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor="settings-model" className="text-xs text-text-tertiary uppercase font-bold tracking-wider block">AI Model</label>
      <div className="relative">
        <select
          id="settings-model"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full bg-bg-primary text-text-primary border border-card-border rounded-lg px-3 py-2 text-xs outline-none cursor-pointer focus:border-accent transition-all appearance-none"
        >
          {modelsList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
      </div>
    </div>
  );
};