/**
 * Refactored progressive loading hook with better error handling and maintainability
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TaskType, FilterOptions } from '@/lib/types';
import { APP_CONFIG } from '@/config/app.config';
import { debug } from '@/lib/debug';
import { AppError } from '@/lib/errors/AppError';
import { 
  ProgressiveLoadingState, 
  ProgressiveLoadingOptions 
} from './types';
import { 
  loadTaskDataProgressively, 
  loadResultsInBatches, 
  loadSpecificTaskData 
} from './loaders';

/**
 * Custom hook for progressive loading of leaderboard data
 * Loads data in batches to improve perceived performance and reduce initial load time
 */
export function useProgressiveLoading(
  currentTask: TaskType,
  filterOptions: FilterOptions,
  options: ProgressiveLoadingOptions = {}
) {
  // Get default options from config - memoize to prevent recreation
  const memoizedOptions = useMemo(() => ({
    batchSize: options.batchSize ?? APP_CONFIG.ui.progressiveLoading.batchSize,
    delayBetweenBatches: options.delayBetweenBatches ?? APP_CONFIG.ui.progressiveLoading.delayBetweenBatches,
    priorityModels: options.priorityModels ?? [...APP_CONFIG.ui.progressiveLoading.priorityModels],
    enableProgressiveLoading: options.enableProgressiveLoading ?? true
  }), [options.batchSize, options.delayBetweenBatches, options.priorityModels, options.enableProgressiveLoading]);

  const {
    batchSize,
    delayBetweenBatches,
    priorityModels,
    enableProgressiveLoading
  } = memoizedOptions;

  const [state, setState] = useState<ProgressiveLoadingState>({
    results: [],
    isLoading: false,
    isDataComplete: false,
    loadingProgress: 0,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update loading progress
   */
  const updateProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      loadingProgress: Math.min(100, Math.max(0, progress))
    }));
  }, []);

  /**
   * Main data loading function
   */
  const loadDataProgressively = useCallback(async () => {
    // Cancel any ongoing loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear any pending timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Reset state
    setState({
      results: [],
      isLoading: true,
      isDataComplete: false,
      loadingProgress: 0,
      error: null
    });

    try {
      debug.dataLoader(`Starting progressive loading for task: ${currentTask}`);

      if (currentTask === 'overall') {
        // Load overall data (aggregate from multiple tasks)
        try {
          const overallResults = await loadTaskDataProgressively(
            filterOptions,
            signal,
            updateProgress
          );

          if (overallResults && overallResults.length > 0 && !signal.aborted) {
            debug.dataLoader(`Loaded ${overallResults.length} overall results, starting batch loading`);
            await loadResultsInBatches(
              overallResults,
              signal,
              batchSize,
              delayBetweenBatches,
              priorityModels,
              50, // Start from 50% for batch loading
              setState
            );
          } else if (!signal.aborted) {
            debug.dataLoader('No overall results to display');
            setState(prev => ({
              ...prev,
              isLoading: false,
              isDataComplete: true,
              loadingProgress: 100
            }));
          }
        } catch (error) {
          debug.dataLoader('Error in overall data loading:', error);
          throw error;
        }
      } else {
        // Load specific task data
        try {
          await loadSpecificTaskData(
            currentTask,
            filterOptions,
            signal,
            batchSize,
            delayBetweenBatches,
            priorityModels,
            setState
          );
        } catch (error) {
          debug.dataLoader('Error in specific task data loading:', error);
          throw error;
        }
      }

      debug.dataLoader(`Progressive loading completed for task: ${currentTask}`);
      
    } catch (error) {
      if (signal.aborted) {
        debug.dataLoader('Progressive loading was aborted');
        return;
      }

      // Check if it's an aborted operation error and handle it gracefully
      if (error instanceof AppError && error.code === 'OPERATION_ABORTED') {
        debug.dataLoader('Progressive loading was aborted via AppError');
        return;
      }

      // Handle data loading errors that contain "aborted" in the message
      if (error instanceof Error && error.message.toLowerCase().includes('aborted')) {
        debug.dataLoader('Progressive loading was aborted (detected from message)');
        return;
      }

      const errorMessage = error instanceof AppError 
        ? error.message 
        : error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred during data loading';

      debug.dataLoader('Progressive loading failed:', error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        loadingProgress: 0
      }));
    }
  }, [
    currentTask, 
    filterOptions, 
    batchSize, 
    delayBetweenBatches, 
    priorityModels, 
    updateProgress
  ]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  /**
   * Retry loading function
   */
  const retryLoading = useCallback(() => {
    debug.dataLoader('Retrying progressive loading...');
    loadDataProgressively();
  }, [loadDataProgressively]);

  // Effect to start loading when dependencies change
  useEffect(() => {
    if (!enableProgressiveLoading) {
      debug.dataLoader('Progressive loading is disabled');
      return;
    }

    // Add a small delay to debounce rapid filter changes
    loadingTimeoutRef.current = setTimeout(() => {
      loadDataProgressively();
    }, 100);

    return cleanup;
  }, [currentTask, filterOptions, enableProgressiveLoading]); // Remove function dependencies to prevent infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []); // Empty dependency array - cleanup function doesn't need to be in dependencies

  return {
    results: state.results,
    isLoading: state.isLoading,
    isDataComplete: state.isDataComplete,
    loadingProgress: state.loadingProgress,
    error: state.error,
    retryLoading
  };
}
