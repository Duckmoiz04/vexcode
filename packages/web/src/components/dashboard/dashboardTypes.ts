import type { BlastRadiusItem } from '../../types';

export interface DashboardStats {
  security: number;
  reliability: number;
  performance: number;
  maintainability: number;
  errors: number;
  warnings: number;
  infos: number;
  healthScore: number;
  topFiles: { file: string; count: number }[];
  topSymbols: {
    name: string;
    file: string;
    blastCount: number;
    blastRadius: BlastRadiusItem[];
    issuesCount: number;
  }[];
  avgComplexity: number;
  avgCognitive: number;
  topComplexFiles: {
    file: string;
    complexity: number;
    cognitive: number;
    level: string;
    loc: number;
  }[];
}

export interface DonutSegment {
  color: string;
  percent: number;
  offset: number;
}

export interface DashboardDisplayValues {
  donutSegments: DonutSegment[];
  healthDashOffset: number;
  healthColor: string;
}