import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AIProviderProvider, useAIProvider } from './AIProviderContext';
import type { Config } from '../types';

describe('AIProviderContext', () => {
  const mockConfig: Config = {
    AI_PROVIDER: 'anthropic',
    ANTHROPIC_API_KEY: 'sk-ant-test123',
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    ANTHROPIC_MODEL: 'claude-3-opus-20240229',
    AI_TEMPERATURE: '0.7',
    AI_MAX_TOKENS: '4096',
  };

  it('renders children and provides access to config values', () => {
    let captured: unknown;
    function Consumer() {
      const ctx = useAIProvider();
      captured = ctx;
      return <div data-testid="provider-value">{ctx.config.AI_PROVIDER}</div>;
    }

    render(
      <AIProviderProvider config={mockConfig}>
        <Consumer />
      </AIProviderProvider>
    );

    expect(screen.getByTestId('provider-value').textContent).toBe('anthropic');
    expect(captured).not.toBeNull();
  });

  it('exposes derived AI config getters matching the props drilling pattern', () => {
    let captured: {
      selectedProvider: string;
      apiKey: string;
      apiBaseUrl: string;
      aiModel: string;
      aiTemperature: number;
      aiMaxTokens: number;
    } | null = null;
    function Consumer() {
      const ctx = useAIProvider();
      captured = ctx;
      return null;
    }

    render(
      <AIProviderProvider config={mockConfig}>
        <Consumer />
      </AIProviderProvider>
    );

    expect(captured!.selectedProvider).toBe('anthropic');
    expect(captured!.apiKey).toBe('sk-ant-test123');
    expect(captured!.apiBaseUrl).toBe('https://api.anthropic.com');
    expect(captured!.aiModel).toBe('claude-3-opus-20240229');
    expect(captured!.aiTemperature).toBe(0.7);
    expect(captured!.aiMaxTokens).toBe(4096);
  });

  it('useAIProvider() throws descriptive error when called outside Provider', () => {
    function BadComponent() {
      useAIProvider();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      /useAIProvider must be used within an AIProviderProvider/i
    );
  });

  it('handles missing AI_PROVIDER gracefully with fallback defaults', () => {
    const emptyConfig: Config = {};
    let captured: {
      selectedProvider: string;
      apiKey: string;
      apiBaseUrl: string;
      aiModel: string;
      aiTemperature: number;
      aiMaxTokens: number;
    } | null = null;
    function Consumer() {
      const ctx = useAIProvider();
      captured = ctx;
      return null;
    }

    render(
      <AIProviderProvider config={emptyConfig}>
        <Consumer />
      </AIProviderProvider>
    );

    expect(captured!.selectedProvider).toBe('');
    expect(captured!.apiKey).toBe('');
    expect(captured!.apiBaseUrl).toBe('');
    expect(captured!.aiModel).toBe('');
    expect(captured!.aiTemperature).toBe(0.1);
    expect(captured!.aiMaxTokens).toBe(4096);
  });
});
