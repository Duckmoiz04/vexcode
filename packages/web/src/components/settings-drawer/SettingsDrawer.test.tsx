import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { SettingsDrawer } from './SettingsDrawer';
import type { Config } from '../../types';

describe('SettingsDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    initialConfig: null as Config | null,
  };

  it('renders the drawer when open', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Save Configuration')).toBeInTheDocument();
  });

  it('renders all section headings', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.getByText('AI Provider')).toBeInTheDocument();
    expect(screen.getByText('API Configuration')).toBeInTheDocument();
    expect(screen.getByText('AI Model')).toBeInTheDocument();
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
    expect(screen.getByText('Semgrep')).toBeInTheDocument();
  });

  it('renders provider buttons', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('9router')).toBeInTheDocument();
    expect(screen.getByText('NVIDIA NIM')).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsDrawer {...defaultProps} onClose={onClose} />);

    // The overlay is the first fixed div with backdrop-blur
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

  it('calls onSave with config when Save is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<SettingsDrawer {...defaultProps} onSave={onSave} />);

    const saveBtn = screen.getByText('Save Configuration');
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedConfig = onSave.mock.calls[0][0] as Config;
    expect(savedConfig.AI_PROVIDER).toBe('openai');
    expect(savedConfig.AI_TEMPERATURE).toBe('0.1');
    expect(savedConfig.AI_MAX_TOKENS).toBe('4096');
  });

  it('loads initial config values', () => {
    const initialConfig: Config = {
      AI_PROVIDER: 'anthropic',
      AI_TEMPERATURE: '0.7',
      AI_MAX_TOKENS: '8192',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_MODEL: 'claude-3-haiku-20240307',
    };

    renderWithProviders(<SettingsDrawer {...defaultProps} initialConfig={initialConfig} />);

    // Provider should be anthropic (highlighted)
    const anthropicBtn = screen.getByText('Anthropic').closest('button');
    expect(anthropicBtn?.className).toContain('border-accent');
  });

  it('toggles advanced settings accordion', () => {
    renderWithProviders(<SettingsDrawer {...defaultProps} />);

    // Advanced settings fields should not be visible initially
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByText('Advanced Settings'));
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Max Tokens')).toBeInTheDocument();
    expect(screen.getByText('Max Retries')).toBeInTheDocument();
    expect(screen.getByText('Cooldown')).toBeInTheDocument();
  });
});