import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { HeaderActions } from './HeaderActions';

describe('HeaderActions', () => {
  it('renders settings button and triggers onOpenSettings on click', () => {
    const onOpenSettings = vi.fn();
    const onToggleTheme = vi.fn();
    renderWithProviders(
      <HeaderActions
        onOpenSettings={onOpenSettings}
        theme="dark"
        onToggleTheme={onToggleTheme}
      />
    );

    const settingsBtn = screen.getByTitle('Settings');
    expect(settingsBtn).toBeInTheDocument();

    fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('renders theme toggle button and triggers onToggleTheme on click', () => {
    const onOpenSettings = vi.fn();
    const onToggleTheme = vi.fn();
    renderWithProviders(
      <HeaderActions
        onOpenSettings={onOpenSettings}
        theme="dark"
        onToggleTheme={onToggleTheme}
      />
    );

    const toggleBtn = screen.getByTitle('Switch to Light Mode');
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(onToggleTheme).toHaveBeenCalled();
  });
});
