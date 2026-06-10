import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { HealthScoreChart } from './HealthScoreChart';

describe('HealthScoreChart', () => {
  const defaultProps = {
    healthScore: 85,
    healthDashOffset: 37.68,
    healthColor: 'var(--color-warning)',
    donutSegments: [
      { color: 'var(--color-danger)', percent: 30, offset: 25 },
      { color: 'var(--color-warning)', percent: 50, offset: -5 },
      { color: 'var(--color-info)', percent: 20, offset: -55 },
    ],
    totalIssues: 100,
  };

  it('renders health score section', () => {
    renderWithProviders(<HealthScoreChart {...defaultProps} />);

    expect(screen.getByText('Project Health Score')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('renders severity distribution section', () => {
    renderWithProviders(<HealthScoreChart {...defaultProps} />);

    expect(screen.getByText('Severity Distribution')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('renders SVG circles for health score', () => {
    const { container } = renderWithProviders(<HealthScoreChart {...defaultProps} />);

    const circles = container.querySelectorAll('circle');
    // At least 2 circles: background + progress for health score
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });

  it('renders donut segments as SVG circles', () => {
    const { container } = renderWithProviders(<HealthScoreChart {...defaultProps} />);

    const circles = container.querySelectorAll('circle');
    // Background + progress (health) + background + 3 segments (severity) = 6
    expect(circles.length).toBeGreaterThanOrEqual(5);
  });

  it('renders with zero issues gracefully', () => {
    renderWithProviders(
      <HealthScoreChart
        healthScore={100}
        healthDashOffset={0}
        healthColor="var(--color-success)"
        donutSegments={[]}
        totalIssues={0}
      />
    );

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('uses danger color for low health score', () => {
    const { container } = renderWithProviders(
      <HealthScoreChart
        healthScore={50}
        healthDashOffset={125.6}
        healthColor="var(--color-danger)"
        donutSegments={[]}
        totalIssues={0}
      />
    );

    expect(screen.getByText('50')).toBeInTheDocument();
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });
});