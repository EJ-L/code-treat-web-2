/**
 * Type definitions for progressive loading hook
 */

import { ProcessedResult, TaskType, FilterOptions } from '@/lib/types';

export interface ProgressiveLoadingState {
  results: ProcessedResult[];
  isLoading: boolean;
  isDataComplete: boolean;
  loadingProgress: number;
  error: string | null;
}

export interface ProgressiveLoadingOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  priorityModels?: string[];
  enableProgressiveLoading?: boolean;
}

export interface TaskLoadResult {
  task: string;
  results: ProcessedResult[];
}

export interface LoadingConfig {
  tasksToAggregate: readonly TaskType[];
  excludedModels: Record<string, string[]>;
  progressWeights: {
    taskLoading: number;
    batchLoading: number;
  };
}
