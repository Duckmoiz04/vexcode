import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { AiProviderSelector } from './AiProviderSelector';

describe('AiProviderSelector', () => {
  it('renders all four provider buttons', () => {
    const onSelect = vi.fn();
    renderWithProviders(<AiProviderSelector provider="openai" onSelect={onSelect} />);

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('9router')).toBeInTheDocument();
  });

  it('highlights the active provider with accent border', () => {
    const onSelect = vi.fn();
    renderWithProviders(<AiProviderSelector provider="anthropic" onSelect={onSelect} />);

    const anthropicBtn = screen.getByText('Anthropic').closest('button');
    expect(anthropicBtn?.className).toContain('border-accent');

    const openaiBtn = screen.getByText('OpenAI').closest('button');
    expect(openaiBtn?.className).not.toContain('border-accent');
  });

  it('calls onSelect with provider key when clicked', () => {
    const onSelect = vi.fn();
    renderWithProviders(<AiProviderSelector provider="openai" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Google'));
    expect(onSelect).toHaveBeenCalledWith('google');
  });

  it('renders the section heading', () => {
    const onSelect = vi.fn();
    renderWithProviders(<AiProviderSelector provider="openai" onSelect={onSelect} />);

    expect(screen.getByText('AI Provider')).toBeInTheDocument();
  });
});