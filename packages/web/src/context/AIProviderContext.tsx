import React, { createContext, useContext, type ReactNode } from 'react';
import type { Config, AIProviderContextType } from '../types';

export const AIProviderContext = createContext<AIProviderContextType | null>(null);

interface AIProviderProviderProps {
  config: Config;
  children: ReactNode;
}

export function AIProviderProvider({ config, children }: AIProviderProviderProps) {
  const selectedProvider = config?.AI_PROVIDER || '';
  const providerKey = selectedProvider ? selectedProvider.toUpperCase() : '';

  const value: AIProviderContextType = {
    config,
    selectedProvider,
    apiKey: providerKey ? (config[`${providerKey}_API_KEY`] || '') : '',
    apiBaseUrl: providerKey ? (config[`${providerKey}_BASE_URL`] || '') : '',
    aiModel: providerKey ? (config[`${providerKey}_MODEL`] || '') : '',
    aiTemperature: parseFloat(config?.AI_TEMPERATURE ?? '0.1') || 0.1,
    aiMaxTokens: parseInt(config?.AI_MAX_TOKENS ?? '4096') || 4096,
    aiSettings: config?._aiSettings ?? null,
  };

  return (
    <AIProviderContext.Provider value={value}>
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider(): AIProviderContextType {
  const context = useContext(AIProviderContext);
  if (context === null) {
    throw new Error('useAIProvider must be used within an AIProviderProvider');
  }
  return context;
}
