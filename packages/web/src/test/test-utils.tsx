import React, { createContext, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import type { Finding, Report, Config } from '../types';

// ─── Re-exports ────────────────────────────────────────────────────────────

export { screen, waitFor, fireEvent } from '@testing-library/react';

// ─── Mock AI Provider Context ───────────────────────────────────────────────

interface AIProviderContextValue {
  config: Config;
}

const AIProviderContext = createContext<AIProviderContextValue>({
  config: {},
});

function AIProvider({
  children,
  config = {},
}: {
  children: ReactNode;
  config?: Partial<Config>;
}) {
  const value: AIProviderContextValue = { config: config as Config };
  return (
    <AIProviderContext.Provider value={value}>
      {children}
    </AIProviderContext.Provider>
  );
}

// ─── Render with Providers ──────────────────────────────────────────────────

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  providerConfig?: Partial<Config>;
}

function renderWithProviders(ui: React.ReactElement, options?: CustomRenderOptions) {
  const { providerConfig, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: ReactNode }) {
    return <AIProvider config={providerConfig}>{children}</AIProvider>;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// ─── Mock Data Factories ────────────────────────────────────────────────────

function createMockFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    rule_id: 'test-rule-001',
    severity: 'warning',
    file: 'src/test.ts',
    line: 42,
    message: 'Test finding message',
    ...overrides,
  };
}

function createMockReport(overrides: Partial<Report> = {}): Report {
  return {
    scanner: 'semgrep',
    timestamp: new Date().toISOString(),
    target_path: '/test/project',
    findings: [createMockFinding()],
    ai_resolutions: {},
    git_state: { commit: 'abc123def', is_dirty: false },
    metrics: { files: {} },
    ...overrides,
  };
}

function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    AI_PROVIDER: 'anthropic',
    AI_TEMPERATURE: '0.7',
    AI_MAX_TOKENS: '4096',
    AI_RESOLVE_TIMEOUT_SECONDS: '60',
    AI_NAMING_TIMEOUT_SECONDS: '30',
    AI_MAX_RETRIES: '3',
    ...overrides,
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

export { renderWithProviders, createMockFinding, createMockReport, createMockConfig };
