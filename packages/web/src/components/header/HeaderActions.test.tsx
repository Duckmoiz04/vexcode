import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { HeaderActions } from './HeaderActions';

describe('HeaderActions', () => {
  it('renders settings button and triggers onOpenSettings on click', () => {
    const onOpenSettings = vi.fn();
    renderWithProviders(<HeaderActions onOpenSettings={onOpenSettings} />);

    const settingsBtn = screen.getByRole('button');
    expect(settingsBtn).toBeInTheDocument();

    fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
