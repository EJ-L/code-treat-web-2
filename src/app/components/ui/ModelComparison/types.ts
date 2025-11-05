/**
 * Type definitions for ModelComparison components
 */

import { ModelData } from '../ModelSelector/types';

export interface ComparisonHeaderProps {
  isDarkMode: boolean;
}

export interface RankingComparisonProps {
  model1: ModelData;
  model2: ModelData;
  isDarkMode: boolean;
}

export interface TaskPerformanceTableProps {
  model1: ModelData;
  model2: ModelData;
  isDarkMode: boolean;
  taskInfo: Record<string, TaskInfo>;
}

export interface PerformanceVisualizationProps {
  radarData: RadarChartData[];
  model1Name: string;
  model2Name: string;
  isDarkMode: boolean;
}

export interface TaskInfo {
  name: string;
  abbr: string;
  metric: string;
}

export interface RadarChartData {
  metric: string;
  [key: string]: string | number;
}

export interface ErrorMessageProps {
  message: string;
  isDarkMode: boolean;
  onRetry?: () => void;
}

export interface LoadingStateProps {
  isDarkMode: boolean;
  message?: string;
}

export interface EmptyStateProps {
  isDarkMode: boolean;
  message?: string;
}
