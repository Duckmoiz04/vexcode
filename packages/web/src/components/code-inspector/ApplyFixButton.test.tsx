import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { ApplyFixButton } from './ApplyFixButton';

describe('ApplyFixButton', () => {
  it('renders apply button when not applied and has remediation code', () => {
    renderWithProviders(
      <ApplyFixButton
        hasRemediation={true}
        isApplied={false}
        isApplying={false}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText('Apply Fix')).toBeInTheDocument();
  });

  it('shows loading state when isApplying is true', () => {
    renderWithProviders(
      <ApplyFixButton
        hasRemediation={true}
        isApplied={false}
        isApplying={true}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText('Applying Fix...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not render when hasRemediation is false', () => {
    const { container } = renderWithProviders(
      <ApplyFixButton
        hasRemediation={false}
        isApplied={false}
        isApplying={false}
        onApply={vi.fn()}
      />
    );

    expect(container.firstElementChild).toBeNull();
  });

  it('does not render when already applied', () => {
    const { container } = renderWithProviders(
      <ApplyFixButton
        hasRemediation={true}
        isApplied={true}
        isApplying={false}
        onApply={vi.fn()}
      />
    );

    expect(container.firstElementChild).toBeNull();
  });

  it('calls onApply when clicked', () => {
    const onApply = vi.fn();

    renderWithProviders(
      <ApplyFixButton
        hasRemediation={true}
        isApplied={false}
        isApplying={false}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByText('Apply Fix'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('disables button when isApplying is true', () => {
    const onApply = vi.fn();

    renderWithProviders(
      <ApplyFixButton
        hasRemediation={true}
        isApplied={false}
        isApplying={true}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByText('Applying Fix...'));
    expect(onApply).not.toHaveBeenCalled();
  });
});