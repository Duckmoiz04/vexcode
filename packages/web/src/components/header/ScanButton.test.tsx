import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import { ScanButton } from './ScanButton';

describe('ScanButton', () => {
  it('renders Scan Project button and triggers scan on click', () => {
    const onStartScan = vi.fn();
    renderWithProviders(
      <ScanButton
        onStartScan={onStartScan}
        currentReportId={null}
      />
    );

    const scanBtn = screen.getByRole('button', { name: /Scan Project/i });
    expect(scanBtn).toBeInTheDocument();

    fireEvent.click(scanBtn);
    expect(onStartScan).toHaveBeenCalledWith(false);
  });

  it('opens dropdown and triggers options', () => {
    const onStartScan = vi.fn();
    const onReResolve = vi.fn();
    renderWithProviders(
      <ScanButton
        onStartScan={onStartScan}
        onReResolve={onReResolve}
        currentReportId="report_1"
      />
    );

    // The second button is the dropdown toggle
    const buttons = screen.getAllByRole('button');
    const dropdownToggle = buttons[1];

    fireEvent.click(dropdownToggle);

    expect(screen.getByText('Scan Options')).toBeInTheDocument();

    // Click Full Scan
    const fullScanBtn = screen.getByText('Full Scan');
    fireEvent.click(fullScanBtn);
    expect(onStartScan).toHaveBeenCalledWith(false);

    // Re-open dropdown
    fireEvent.click(dropdownToggle);

    // Click Fast Scan
    const fastScanBtn = screen.getByText('Fast Scan (Git)');
    fireEvent.click(fastScanBtn);
    expect(onStartScan).toHaveBeenCalledWith(true);

    // Re-open dropdown
    fireEvent.click(dropdownToggle);

    // Click Re-ask AI
    const reAskBtn = screen.getByText('Re-ask AI');
    fireEvent.click(reAskBtn);
    expect(onReResolve).toHaveBeenCalled();
  });
});
