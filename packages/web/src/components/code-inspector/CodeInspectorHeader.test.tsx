import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, createMockFinding } from '../../test/test-utils';
import { CodeInspectorHeader } from './CodeInspectorHeader';

describe('CodeInspectorHeader ScanStatusBadge', () => {
  const defaultProps = {
    isChatOpen: false,
    onToggleChat: vi.fn(),
    onBack: undefined,
    onOpenInIDE: vi.fn(),
  };

  it('renders "New" badge for new scan status', () => {
    const finding = createMockFinding({ scan_status: 'new' });
    renderWithProviders(<CodeInspectorHeader finding={finding} {...defaultProps} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders "Persisting" badge for persisting scan status', () => {
    const finding = createMockFinding({ scan_status: 'persisting' });
    renderWithProviders(<CodeInspectorHeader finding={finding} {...defaultProps} />);
    expect(screen.getByText('Persisting')).toBeInTheDocument();
  });

  it('renders "Resolved" badge for resolved scan status', () => {
    const finding = createMockFinding({ scan_status: 'resolved' });
    renderWithProviders(<CodeInspectorHeader finding={finding} {...defaultProps} />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders "Regressed" badge for regressed scan status', () => {
    const finding = createMockFinding({ scan_status: 'regressed' });
    renderWithProviders(<CodeInspectorHeader finding={finding} {...defaultProps} />);
    expect(screen.getByText('Regressed')).toBeInTheDocument();
  });

  it('does not render scan status badge when scan_status is undefined', () => {
    const finding = createMockFinding({ scan_status: undefined });
    renderWithProviders(<CodeInspectorHeader finding={finding} {...defaultProps} />);
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Persisting')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
    expect(screen.queryByText('Regressed')).not.toBeInTheDocument();
  });

  it('renders both Applied/Pending and ScanStatus badges', () => {
    const finding = createMockFinding({ scan_status: 'new', _applied: true });
    renderWithProviders(<CodeInspectorHeader finding={finding} {...defaultProps} />);
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
