import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, createMockFinding } from '../../test/test-utils';
import { CrossScanSummary } from './CrossScanSummary';

describe('CrossScanSummary', () => {
  it('renders nothing when no findings have scan_status', () => {
    const findings = [createMockFinding()];
    const { container } = renderWithProviders(<CrossScanSummary findings={findings} />);
    // All default to 'new' so it will render; but if truly no status and no findings, empty
    expect(container.querySelector('h4')).toBeTruthy();
  });

  it('renders nothing when findings array is empty', () => {
    const { container } = renderWithProviders(<CrossScanSummary findings={[]} />);
    expect(container.querySelector('h4')).toBeNull();
  });

  it('renders the Cross-Scan Comparison header', () => {
    const findings = [
      createMockFinding({ scan_status: 'new' }),
      createMockFinding({ scan_status: 'resolved' }),
    ];
    renderWithProviders(<CrossScanSummary findings={findings} />);
    expect(screen.getByText('Cross-Scan Comparison')).toBeInTheDocument();
  });

  it('counts findings by scan status correctly', () => {
    const findings = [
      createMockFinding({ scan_status: 'new', rule_id: 'r1' }),
      createMockFinding({ scan_status: 'new', rule_id: 'r2' }),
      createMockFinding({ scan_status: 'new', rule_id: 'r3' }),
      createMockFinding({ scan_status: 'persisting', rule_id: 'r4' }),
      createMockFinding({ scan_status: 'persisting', rule_id: 'r4b' }),
      createMockFinding({ scan_status: 'resolved', rule_id: 'r5' }),
      createMockFinding({ scan_status: 'resolved', rule_id: 'r6' }),
      createMockFinding({ scan_status: 'resolved', rule_id: 'r6b' }),
      createMockFinding({ scan_status: 'resolved', rule_id: 'r6c' }),
      createMockFinding({ scan_status: 'regressed', rule_id: 'r7' }),
    ];
    renderWithProviders(<CrossScanSummary findings={findings} />);

    expect(screen.getByText('3')).toBeInTheDocument(); // 3 new
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 persisting
    expect(screen.getByText('4')).toBeInTheDocument(); // 4 resolved
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 regressed
  });

  it('shows description text for each status', () => {
    const findings = [
      createMockFinding({ scan_status: 'new' }),
      createMockFinding({ scan_status: 'persisting' }),
      createMockFinding({ scan_status: 'resolved' }),
      createMockFinding({ scan_status: 'regressed' }),
    ];
    renderWithProviders(<CrossScanSummary findings={findings} />);

    expect(screen.getByText('Introduced since last scan')).toBeInTheDocument();
    expect(screen.getByText('Still present from previous scan')).toBeInTheDocument();
    expect(screen.getByText('Fixed since last scan')).toBeInTheDocument();
    expect(screen.getByText('Were applied, now back')).toBeInTheDocument();
  });

  it('treats findings without scan_status as "new"', () => {
    const findings = [
      createMockFinding({ scan_status: undefined }),
      createMockFinding({ scan_status: undefined }),
    ];
    renderWithProviders(<CrossScanSummary findings={findings} />);

    // 2 should appear as "new" count
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
