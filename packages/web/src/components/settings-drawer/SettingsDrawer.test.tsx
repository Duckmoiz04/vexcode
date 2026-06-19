import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../../test/test-utils';
import { SettingsDrawer } from './SettingsDrawer';
import type { Config } from '../../types';

describe('SettingsDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    initialConfig: null as Config | null,
  };

  it('renders the modal when open', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.getByLabelText('Close settings')).toBeInTheDocument();
  });

  it('renders tab headers', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    const providersElements = screen.getAllByText('Providers');
    expect(providersElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Rules')).toBeInTheDocument();
  });

  it('shows Providers tab content by default', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.getAllByText('Providers').length).toBeGreaterThan(0);
    expect(screen.queryByText('Agent Assignments')).not.toBeInTheDocument();
  });

  it('shows no-provider message on Models tab when no provider connected', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    fireEvent.click(screen.getByText('Models'));

    expect(screen.getByText('No AI Provider Connected')).toBeInTheDocument();
    expect(screen.getByText('Go to Providers')).toBeInTheDocument();
    expect(screen.queryByText('Agent Assignments')).not.toBeInTheDocument();
  });

  it('shows Rules tab content when Rules is clicked', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.queryByText('Rules Path')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Rules'));

    expect(screen.getByText('Rules Path')).toBeInTheDocument();
  });

  it('renders provider cards', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Google').length).toBeGreaterThan(0);
    expect(screen.getAllByText('9router').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NVIDIA NIM').length).toBeGreaterThan(0);
  });

  it('renders agent assignment rows when provider is connected', () => {
    const connectedConfig: Config = {
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-connected',
      _aiSettings: {
        enabled: true,
        providers: {
          openai: {
            enabled: true, model: 'gpt-4o-mini', requires_key: true,
            api_key: 'sk-connected', base_url: 'https://api.openai.com/v1',
          },
        },
        agents: {
          suggest: { provider: 'openai', model: 'gpt-4o-mini', enabled: true },
          bug_scan: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
          naming_audit: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
        },
      },
    };

    renderWithProviders(<SettingsDrawer {...defaultProps} initialConfig={connectedConfig} />);

    fireEvent.click(screen.getByText('Models'));

    // Agent rows render because agents exist in config
    expect(screen.getByText('Code Suggest')).toBeInTheDocument();
    expect(screen.getByText('Bug Scan')).toBeInTheDocument();
    expect(screen.getByText('Naming Audit')).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsDrawer {...defaultProps} onClose={onClose} />);

    const overlay = document.querySelector('.backdrop-blur-sm');
    expect(overlay).toBeInTheDocument();
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsDrawer {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('Close settings');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-saves when provider toggle changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const initialConfig = {
      AI_PROVIDER: 'openai',
      AI_TEMPERATURE: '0.1',
      AI_MAX_TOKENS: '4096',
      AI_RESOLVE_TIMEOUT_SECONDS: '90',
      AI_NAMING_TIMEOUT_SECONDS: '90',
      AI_MAX_RETRIES: '2',
      AI_REQUEST_COOLDOWN_SECONDS: '8',
      OPENAI_API_KEY: 'sk-test',
      _aiSettings: {
        enabled: true,
        providers: {
          openai: { enabled: true, requires_key: true, api_key: 'sk-test', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
        },
        agents: { suggest: { provider: 'openai', model: 'gpt-4o-mini', enabled: true } },
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, models: [{ id: 'gpt-4o-mini' }] }),
    });

    renderWithProviders(<SettingsDrawer {...defaultProps} onSave={onSave} initialConfig={initialConfig as unknown as Config} />);

    const toggles = await screen.findAllByRole('switch');
    expect(toggles.length).toBeGreaterThan(0);

    fireEvent.click(toggles[0]);

    await waitFor(() => {
      expect(onSave.mock.calls.length).toBeGreaterThanOrEqual(1);
      const lastCall = onSave.mock.calls[onSave.mock.calls.length - 1][0] as Config;
      expect(lastCall._aiSettings!.providers.openai.enabled).toBe(false);
    });

    globalThis.fetch = originalFetch;
  });

  it('loads initial config values', () => {
    const initialConfig: Config = {
      AI_PROVIDER: 'anthropic',
      AI_TEMPERATURE: '0.7',
      AI_MAX_TOKENS: '8192',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_MODEL: 'claude-3-haiku-20240307',
      _aiSettings: {
        enabled: true,
        providers: {
          anthropic: {
            enabled: true,
            model: 'claude-3-haiku-20240307',
            requires_key: true,
            api_key: 'sk-ant-test',
            base_url: 'https://api.anthropic.com',
          },
        },
        agents: {
          suggest: { provider: 'anthropic', model: 'claude-3-haiku-20240307', enabled: true },
        },
      },
    };

    renderWithProviders(<SettingsDrawer {...defaultProps} initialConfig={initialConfig} />);

    // Only providers present in _aiSettings.providers render on the Providers tab
    expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Models'));
    expect(screen.getByDisplayValue('Anthropic')).toBeInTheDocument();
  });

  it('shows Parameters tab content', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.queryByText('Temperature')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Parameters'));

    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Max Tokens')).toBeInTheDocument();
    expect(screen.getByText('Max Retries')).toBeInTheDocument();
    expect(screen.getByText('Cooldown')).toBeInTheDocument();
  });
});
