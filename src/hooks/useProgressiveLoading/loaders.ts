/**
 * Data loading functions for progressive loading
 */

import { ProcessedResult, TaskType, FilterOptions } from '@/lib/types';
import { getPrecomputedResults } from '@/lib/dataLoader';
import { debug } from '@/lib/debug';
import { 
  filterTaskResults, 
  calculateTaskProgress, 
  calculateBatchProgress,
  createDelay,
  sortResultsByPriority,
  calculateOverallResults,
  createBatches,
  getLoadingConfig
} from './utils';
import { TaskLoadResult, ProgressiveLoadingState } from './types';

/**
 * Load data for a single task with error handling
 */
export const loadSingleTask = async (
  task: TaskType,
  filters: FilterOptions,
  signal: AbortSignal
): Promise<TaskLoadResult> => {
  if (signal.aborted) {
    // Don't throw an error for aborted operations - this is normal behavior
    debug.dataLoader(`Task loading aborted for: ${task}`);
    return { task, results: [] };
  }
  
  const taskFilterOptions = { ...filters, tasks: [task] };
  
  try {
    debug.dataLoader(`Attempting to load data for task: ${task}`);
    debug.dataLoader(`Filter options for ${task}:`, taskFilterOptions);
    
    let results = await getPrecomputedResults(task, taskFilterOptions);
    debug.dataLoader(`Raw results loaded for ${task}:`, results?.length || 0);
    
    if (results && results.length > 0) {
      debug.dataLoader(`Sample raw result for ${task}:`, results[0]);
    }
    
    results = results || [];
    const beforeFilterCount = results.length;
    results = filterTaskResults(task, results);
    
    debug.dataLoader(`Task ${task}: ${beforeFilterCount} -> ${results.length} results after filtering`);
    
    if (results.length === 0 && beforeFilterCount > 0) {
      debug.dataLoader(`All results filtered out for ${task}. Check exclusion rules.`);
    }
    
    return { task, results };
  } catch (error) {
    debug.dataLoader(`Failed to load data for task ${task}:`, error);
    // Return empty results instead of throwing to prevent loading from getting stuck
    return { task, results: [] };
  }
};

/**
 * Load task data progressively for overall results
 */
export const loadTaskDataProgressively = async (
  filters: FilterOptions,
  signal: AbortSignal,
  updateProgress: (progress: number) => void
): Promise<ProcessedResult[]> => {
    const config = getLoadingConfig();
    const allTaskResults: TaskLoadResult[] = [];
    
    debug.dataLoader(`Starting to load ${config.tasksToAggregate.length} tasks for overall results`);
    
    for (let i = 0; i < config.tasksToAggregate.length; i++) {
      if (signal.aborted) {
        // Return partial results if operation was aborted
        debug.dataLoader('Task data loading aborted, returning partial results');
        return calculateOverallResults(allTaskResults);
      }
      
      const task = config.tasksToAggregate[i];
      debug.dataLoader(`Loading task ${i + 1}/${config.tasksToAggregate.length}: ${task}`);
      
      try {
        const taskResult = await loadSingleTask(task, filters, signal);
        if (taskResult) {
          allTaskResults.push(taskResult);
          debug.dataLoader(`Successfully loaded ${taskResult.results.length} results for task: ${task}`);
        }
        
        // Update progress
        const progress = calculateTaskProgress(i, config.tasksToAggregate.length);
        debug.dataLoader(`Progress updated to: ${progress}%`);
        updateProgress(progress);
        
        // Add delay between tasks (except for the last one)
        if (i < config.tasksToAggregate.length - 1) {
          await createDelay(30); // Small delay from config
        }
        
      } catch (error) {
        debug.dataLoader(`Failed to load task ${task}, continuing with others:`, error);
        // Continue with other tasks even if one fails
        allTaskResults.push({ task, results: [] });
      }
    }

    if (signal.aborted) {
      // Return partial results if operation was aborted
      debug.dataLoader('Overall results calculation aborted, returning partial results');
      return calculateOverallResults(allTaskResults);
    }

    // Calculate overall results
    return calculateOverallResults(allTaskResults);
};

/**
 * Load results in batches for progressive display
 */
export const loadResultsInBatches = async (
  results: ProcessedResult[],
  signal: AbortSignal,
  batchSize: number,
  delayBetweenBatches: number,
  priorityModels: string[],
  baseProgress: number,
  updateState: (updater: (prev: ProgressiveLoadingState) => ProgressiveLoadingState) => void
): Promise<void> => {
    debug.dataLoader(`Starting batch loading: ${results.length} results, baseProgress: ${baseProgress}%`);
    
    if (results.length === 0) {
      debug.dataLoader('No results to load in batches, marking as complete');
      updateState(prev => ({
        ...prev,
        isLoading: false,
        isDataComplete: true,
        loadingProgress: 100
      }));
      return;
    }

    // Sort results by priority
    const sortedResults = sortResultsByPriority(results, priorityModels);
    const batches = createBatches(sortedResults, batchSize);
    
    debug.dataLoader(`Created ${batches.length} batches of size ${batchSize}`);
    
    let loadedResults: ProcessedResult[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      if (signal.aborted) {
        // Update state with partial results and mark as complete
        debug.dataLoader('Batch loading aborted, showing partial results');
        updateState(prev => ({
          ...prev,
          results: loadedResults,
          isLoading: false,
          isDataComplete: true,
          loadingProgress: 100
        }));
        return;
      }
      
      const batch = batches[i];
      loadedResults = [...loadedResults, ...batch];
      
      const progress = calculateBatchProgress(i + 1, batches.length, baseProgress);
      const isComplete = i === batches.length - 1;
      
      debug.dataLoader(`Batch ${i + 1}/${batches.length}: loaded ${batch.length} results, progress: ${progress}%`);
      
      updateState(prev => ({
        ...prev,
        results: loadedResults,
        loadingProgress: progress,
        isDataComplete: isComplete,
        isLoading: !isComplete
      }));
      
      // Add delay between batches (except for the last one)
      if (i < batches.length - 1) {
        await createDelay(delayBetweenBatches);
      }
    }
};

/**
 * Load data for specific task (non-overall)
 */
export const loadSpecificTaskData = async (
  task: TaskType,
  filters: FilterOptions,
  signal: AbortSignal,
  batchSize: number,
  delayBetweenBatches: number,
  priorityModels: string[],
  updateState: (updater: (prev: ProgressiveLoadingState) => ProgressiveLoadingState) => void
): Promise<void> => {
    const taskResult = await loadSingleTask(task, filters, signal);
    
    if (!taskResult || taskResult.results.length === 0) {
      updateState(prev => ({
        ...prev,
        results: [],
        isLoading: false,
        isDataComplete: true,
        loadingProgress: 100
      }));
      return;
    }

    await loadResultsInBatches(
      taskResult.results,
      signal,
      batchSize,
      delayBetweenBatches,
      priorityModels,
      0, // Start from 0 for specific tasks
      updateState
    );
};
