import React, { createContext, useContext, type ReactNode } from 'react';
import type { Config, AIProviderContextType } from '../types';

export const AIProviderContext = createContext<AIProviderContextType | null>(null);

interface AIProviderProviderProps {
  config: Config;
  children: ReactNode;
}

export function AIProviderProvider({ config, children }: AIProviderProviderProps) {
  // 1. Resolve active provider and model from the Chat agent mapping if present.
  // This honors the user's explicit model-to-agent assignments made in the Settings tab.
  const chatAgent = config?._aiSettings?.agents?.chat;
  const selectedProvider = chatAgent?.provider || config?.AI_PROVIDER || '';
  const providerKey = selectedProvider ? selectedProvider.toUpperCase() : '';

  // Get configuration from structured provider config first, fall back to flat environment keys.
  const structuredProvider = selectedProvider ? config?._aiSettings?.providers?.[selectedProvider] : null;
  const apiKey = (structuredProvider?.api_key || (providerKey ? (config[`${providerKey}_API_KEY`] as string) : '')) || '';
  const apiBaseUrl = (structuredProvider?.base_url || (providerKey ? (config[`${providerKey}_BASE_URL`] as string) : '')) || '';
  const aiModel = (chatAgent?.model || structuredProvider?.model || (providerKey ? (config[`${providerKey}_MODEL`] as string) : '')) || '';

  const value: AIProviderContextType = {
    config,
    selectedProvider,
    apiKey,
    apiBaseUrl,
    aiModel,
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
