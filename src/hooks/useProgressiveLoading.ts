import { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessedResult, TaskType, FilterOptions } from '@/lib/types';
import { getPrecomputedResults } from '@/lib/dataLoader';
import { debug } from '@/lib/debug';

interface ProgressiveLoadingState {
  results: ProcessedResult[];
  isLoading: boolean;
  isDataComplete: boolean;
  loadingProgress: number;
  error: string | null;
}

interface ProgressiveLoadingOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  priorityModels?: string[];
}

/**
 * Custom hook for progressive loading of leaderboard data
 * Loads data in batches to improve perceived performance and reduce initial load time
 */
export function useProgressiveLoading(
  currentTask: TaskType,
  filterOptions: FilterOptions,
  options: ProgressiveLoadingOptions = {}
) {
  const {
    batchSize = 20,
    delayBetweenBatches = 50,
    priorityModels = ['GPT-4', 'Claude', 'Gemini', 'Llama']
  } = options;

  const [state, setState] = useState<ProgressiveLoadingState>({
    results: [],
    isLoading: false,
    isDataComplete: false,
    loadingProgress: 0,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadDataProgressively = useCallback(async () => {
    // Cancel any ongoing loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingProgress: 0,
      error: null,
      results: []
    }));

    try {
      if (currentTask === 'overall') {
        // Handle overall task with progressive loading of individual tasks
        await loadOverallDataProgressively(filterOptions, signal);
      } else {
        // Handle specific tasks
        await loadTaskDataProgressively(currentTask, filterOptions, signal);
      }
    } catch (error) {
      if (signal.aborted) return; // Don't update state if aborted
      
      debug.error('Progressive loading error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        loadingProgress: 0
      }));
    }
  }, [currentTask, filterOptions, batchSize, delayBetweenBatches]);

  const loadTaskDataProgressively = async (
    task: TaskType,
    filters: FilterOptions,
    signal: AbortSignal
  ) => {
    try {
      // Load all data first
      const allResults = await getPrecomputedResults(task, filters);
      
      if (signal.aborted) return;
      
      if (!allResults || allResults.length === 0) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isDataComplete: true,
          loadingProgress: 100,
          results: []
        }));
        return;
      }

      // Sort results to prioritize important models
      const sortedResults = sortResultsByPriority(allResults, priorityModels);
      
      // Load results in batches
      await loadResultsInBatches(sortedResults, signal);
      
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  };

  const loadOverallDataProgressively = async (
    filters: FilterOptions,
    signal: AbortSignal
  ) => {
    const tasksToAggregate: TaskType[] = [
      'code generation', 'code translation', 'code summarization', 'code review',
      'input prediction', 'output prediction', 'vulnerability detection', 'unit test generation'
    ];

    const allTaskResults: Array<{ task: string; results: ProcessedResult[] }> = [];
    
    // Load tasks progressively
    for (let i = 0; i < tasksToAggregate.length; i++) {
      if (signal.aborted) return;
      
      const task = tasksToAggregate[i];
      const taskFilterOptions = { ...filters, tasks: [task] };
      
      try {
        let results = await getPrecomputedResults(task, taskFilterOptions);
        results = results || [];
        
        // Exclude Code Summarization Human Baseline from overall aggregation
        if (task === 'code summarization') {
          results = results.filter((r: ProcessedResult) => r.model !== 'Code Summarization Human Baseline');
        }
        
        allTaskResults.push({ task, results });
        
        // Update progress
        const progress = ((i + 1) / tasksToAggregate.length) * 50; // First 50% for loading tasks
        setState(prev => ({
          ...prev,
          loadingProgress: progress
        }));
        
        // Small delay to allow UI updates
        if (i < tasksToAggregate.length - 1) {
          await new Promise(resolve => {
            loadingTimeoutRef.current = setTimeout(resolve, delayBetweenBatches);
          });
        }
        
      } catch (error) {
        debug.warn(`Failed to load data for task ${task}:`, error);
        allTaskResults.push({ task, results: [] });
      }
    }

    if (signal.aborted) return;

    // Calculate overall results
    const overallResults = calculateOverallResults(allTaskResults);
    
    // Load overall results in batches (remaining 50% progress)
    await loadResultsInBatches(overallResults, signal, 50);
  };

  const loadResultsInBatches = async (
    results: ProcessedResult[],
    signal: AbortSignal,
    progressOffset: number = 0
  ) => {
    const totalBatches = Math.ceil(results.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      if (signal.aborted) return;
      
      const startIndex = i * batchSize;
      const endIndex = Math.min(startIndex + batchSize, results.length);
      const batch = results.slice(startIndex, endIndex);
      
      setState(prev => ({
        ...prev,
        results: [...prev.results, ...batch],
        loadingProgress: progressOffset + ((i + 1) / totalBatches) * (100 - progressOffset),
        isLoading: i < totalBatches - 1,
        isDataComplete: i === totalBatches - 1
      }));
      
      // Add delay between batches (except for the last one)
      if (i < totalBatches - 1) {
        await new Promise(resolve => {
          loadingTimeoutRef.current = setTimeout(resolve, delayBetweenBatches);
        });
      }
    }
  };

  const sortResultsByPriority = (results: ProcessedResult[], priorityModels: string[]) => {
    return [...results].sort((a, b) => {
      const aIsPriority = priorityModels.some(model => 
        a.model?.toLowerCase().includes(model.toLowerCase()) || 
        a.modelName?.toLowerCase().includes(model.toLowerCase())
      );
      const bIsPriority = priorityModels.some(model => 
        b.model?.toLowerCase().includes(model.toLowerCase()) || 
        b.modelName?.toLowerCase().includes(model.toLowerCase())
      );
      
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return 0;
    });
  };

  const calculateOverallResults = (allTaskResults: Array<{ task: string; results: ProcessedResult[] }>): ProcessedResult[] => {
    // This is a simplified version - you may need to adapt based on your existing overall calculation logic
    const modelMap = new Map<string, {
      model: string;
      modelName: string;
      tasks: Set<string>;
      totalRank: number;
      taskCount: number;
    }>();

    // Process each task's results
    allTaskResults.forEach(({ task, results }) => {
      if (results.length === 0) return;

      // Sort results by primary metric (descending)
      const sortedResults = [...results].sort((a, b) => {
        const aMetric = getTaskPrimaryMetric(a, task);
        const bMetric = getTaskPrimaryMetric(b, task);
        return (bMetric || 0) - (aMetric || 0);
      });

      // Assign ranks
      sortedResults.forEach((result, index) => {
        const modelKey = result.model || result.modelName || 'Unknown';
        const rank = index + 1;

        if (!modelMap.has(modelKey)) {
          modelMap.set(modelKey, {
            model: modelKey,
            modelName: result.modelName || modelKey,
            tasks: new Set(),
            totalRank: 0,
            taskCount: 0
          });
        }

        const modelData = modelMap.get(modelKey)!;
        if (!modelData.tasks.has(task)) {
          modelData.tasks.add(task);
          modelData.totalRank += rank;
          modelData.taskCount += 1;
        }
      });
    });

    // Convert to ProcessedResult format and sort by average rank
    return Array.from(modelMap.values())
      .filter(model => model.taskCount >= 3) // Minimum 3 tasks
      .map(model => {
        const avgRank = model.totalRank / model.taskCount;
        return {
          modelId: model.model,
          model: model.model,
          modelName: model.modelName,
          avgRank: avgRank,
          taskCount: model.taskCount,
        // Add other required fields with default values
        dataset: '',
        task: 'overall' as TaskType,
        sourceLang: null,
        targetLang: null,
        lang: '',
        modality: undefined,
        domain: '',
        pass1: null,
        pass3: null,
        pass5: null,
        easyPass1: null,
        mediumPass1: null,
        hardPass1: null,
        easyPass3: null,
        mediumPass3: null,
        hardPass3: null,
        easyPass5: null,
        mediumPass5: null,
        hardPass5: null,
        codebleu: null,
        llmjudge: null,
        executionAccuracy: null,
        difficulty: null,
        'P-C': null,
        'P-V': null,
        'P-B': null,
        'P-R': null,
        'Accuracy': null,
        'Precision': null,
        'Recall': null,
        'F1 Score': null,
        'CLIP': null,
        'Compilation': null,
        'SSIM': null,
        'Text': null,
        'Position': null,
        'Implement Rate': null,
        'VAN': null,
        'REN': null,
        'RTF': null,
        'GBC': null,
        'ALL': null,
        'MDC': null,
        'MPS': null,
        'MHC': null,
        'MAE': null,
        'NEMD': null,
        'RER': null
        } as ProcessedResult & { avgRank: number; taskCount: number };
      })
      .sort((a, b) => {
        return a.avgRank - b.avgRank;
      });
  };

  const getTaskPrimaryMetric = (result: ProcessedResult, task: string): number | null => {
    // Return the primary metric for each task type
    switch (task) {
      case 'code generation':
      case 'code translation':
      case 'unit test generation':
        return result.pass1;
      case 'code summarization':
      case 'code review':
        return result.llmjudge;
      case 'vulnerability detection':
        return result['F1 Score'] ?? null;
      case 'input prediction':
      case 'output prediction':
        return result.executionAccuracy;
      default:
        return result.pass1 || result.llmjudge || result.executionAccuracy;
    }
  };

  // Effect to trigger loading when dependencies change
  useEffect(() => {
    loadDataProgressively();
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loadDataProgressively]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return {
    results: state.results,
    isLoading: state.isLoading,
    isDataComplete: state.isDataComplete,
    loadingProgress: state.loadingProgress,
    error: state.error,
    reload: loadDataProgressively
  };
}
