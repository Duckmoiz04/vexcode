import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { MetricsCards } from './MetricsCards';

describe('MetricsCards', () => {
  const defaultProps = {
    totalFindings: 42,
    security: 5,
    reliability: 20,
    performance: 10,
    maintainability: 7,
    avgComplexity: 8,
    avgCognitive: 12,
  };

  it('renders all five metric cards', () => {
    renderWithProviders(<MetricsCards {...defaultProps} />);

    expect(screen.getByText('Total Issues')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Reliability')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Maintainability')).toBeInTheDocument();
  });

  it('displays correct total findings count', () => {
    renderWithProviders(<MetricsCards {...defaultProps} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('displays correct category counts', () => {
    renderWithProviders(<MetricsCards {...defaultProps} />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows avg complexity when > 0', () => {
    renderWithProviders(<MetricsCards {...defaultProps} />);
    expect(screen.getByText('(Avg CCN: 8)')).toBeInTheDocument();
    expect(screen.getByText('Avg Cognitive: 12')).toBeInTheDocument();
  });

  it('hides avg complexity when 0', () => {
    renderWithProviders(
      <MetricsCards {...defaultProps} avgComplexity={0} avgCognitive={0} />
    );
    expect(screen.queryByText(/Avg CCN/)).not.toBeInTheDocument();
  });

  it('renders zero counts correctly', () => {
    renderWithProviders(
      <MetricsCards
        totalFindings={0}
        security={0}
        reliability={0}
        performance={0}
        maintainability={0}
        avgComplexity={0}
        avgCognitive={0}
      />
    );

    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(5);
  });
});
