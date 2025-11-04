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
    // Use the same logic as the fallback implementation for consistency
    
    // Helper function to calculate combined Code Reasoning ranks
    const calculateCombinedCodeReasoningRanks = (allTaskResults: Array<{ task: string; results: ProcessedResult[] }>) => {
      const inputPredictionResults = allTaskResults.find(r => r.task === 'input prediction')?.results || [];
      const outputPredictionResults = allTaskResults.find(r => r.task === 'output prediction')?.results || [];
      
      // Get all models that have scores in either input or output prediction
      const allModels = new Set<string>();
      inputPredictionResults.forEach(r => r.model && allModels.add(r.model));
      outputPredictionResults.forEach(r => r.model && allModels.add(r.model));
      
      // Calculate combined scores for Code Reasoning
      const combinedScores: Array<{ model: string; score: number }> = [];
      allModels.forEach(model => {
        const inputResult = inputPredictionResults.find(r => r.model === model);
        const outputResult = outputPredictionResults.find(r => r.model === model);
        
        const validScores: number[] = [];
        
        // Extract pass@1 scores - use the same field access as the main scoring logic
        const inputScore = inputResult ? parseFloat(String(inputResult['pass@1'] || '0')) || 0 : 0;
        const outputScore = outputResult ? parseFloat(String(outputResult['pass@1'] || '0')) || 0 : 0;
        
        if (inputScore > 0) {
          validScores.push(inputScore);
        }
        if (outputScore > 0) {
          validScores.push(outputScore);
        }
        
        if (validScores.length > 0) {
          const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
          combinedScores.push({ model, score: avgScore });
        }
      });
      
      // Sort by combined score (descending) and assign ranks
      combinedScores.sort((a, b) => b.score - a.score);
      
      const combinedRanks: Record<string, number> = {};
      combinedScores.forEach((item, index) => {
        combinedRanks[item.model] = index + 1;
      });
      
      return combinedRanks;
    };

    // Calculate combined Code Reasoning ranks
    const codeReasoningRanks = calculateCombinedCodeReasoningRanks(allTaskResults);
    
    // Aggregate results by model
    const modelAggregates = new Map<string, { 
      model: string, 
      taskCount: number, 
      totalScore: number, 
      totalRank: number,
      taskScores: Record<string, number> 
    }>();
    
    // Define task groups for ranking calculation (7 groups instead of 8 individual tasks)
    const rankingTaskGroups = [
      'code generation',
      'code summarization',
      'code translation', 
      'code review',
      'code-reasoning', // Combined input/output prediction
      'unit test generation',
      'vulnerability detection'
    ];
    
    // Process each task separately to calculate ranks (for individual task data)
    const taskRankMaps = new Map<string, Record<string, number>>();
    
    // Calculate ranks for individual tasks (but don't use these for aggregation)
    allTaskResults.forEach(({ task, results }) => {
      if (!results || results.length === 0) return;
      
      const taskScores: { model: string; score: number }[] = [];
      results.forEach((result: ProcessedResult) => {
        const modelName = result.model;
        if (!modelName) return; // Skip if model name is undefined
        
        let primaryScore = 0;
        
        // Get primary metric for each task type (match script's TASK_PRIMARY_METRICS)
        if (task === 'code summarization' || task === 'code review') {
          primaryScore = parseFloat(String(result['LLM Judge'] || '0')) || 0;
        } else if (task === 'vulnerability detection') {
          primaryScore = parseFloat(String(result['Accuracy'] || '0')) || 0;
        } else if (task === 'unit test generation') {
          primaryScore = parseFloat(String(result['line_coverage'] || '0')) || 0;
        } else {
          // For code generation, code translation, input prediction, output prediction use pass@1
          primaryScore = parseFloat(String(result['pass@1'] || '0')) || 0;
        }
        
        if (primaryScore > 0) {
          taskScores.push({ model: modelName, score: primaryScore });
        }
        
        // Store task scores for aggregation
        if (!modelAggregates.has(modelName)) {
          modelAggregates.set(modelName, {
            model: modelName,
            taskCount: 0,
            totalScore: 0,
            totalRank: 0,
            taskScores: {}
          });
        }
        modelAggregates.get(modelName)!.taskScores[task] = primaryScore;
      });
      
      taskScores.sort((a, b) => b.score - a.score);
      const taskRanks: Record<string, number> = {};
      taskScores.forEach((item, index) => {
        taskRanks[item.model] = index + 1;
      });
      
      taskRankMaps.set(task, taskRanks);
    });

    // Now aggregate using the 7 grouped tasks
    Array.from(modelAggregates.keys()).forEach(modelName => {
      const aggregate = modelAggregates.get(modelName)!;
      
      // Calculate ranks using grouped tasks
      rankingTaskGroups.forEach(taskGroup => {
        let rankToAdd: number | null = null;
        let scoreToAdd: number | null = null;
        
        if (taskGroup === 'code-reasoning') {
          // Use combined Code Reasoning rank
          rankToAdd = codeReasoningRanks[modelName] || null;
          // Calculate combined score for display
          const inputScore = aggregate.taskScores['input prediction'];
          const outputScore = aggregate.taskScores['output prediction'];
          const validScores = [inputScore, outputScore].filter(s => s != null && s > 0);
          if (validScores.length > 0) {
            scoreToAdd = validScores.reduce((a, b) => a + b, 0) / validScores.length;
          }
        } else {
          // Use individual task rank
          const taskRanks = taskRankMaps.get(taskGroup);
          rankToAdd = taskRanks ? taskRanks[modelName] : null;
          scoreToAdd = aggregate.taskScores[taskGroup];
        }
        
        if (rankToAdd !== null && scoreToAdd !== null) {
          aggregate.taskCount++;
          aggregate.totalScore += scoreToAdd;
          aggregate.totalRank += rankToAdd;
        }
      });
    });
    
    // Models to exclude from overall leaderboard (match script - no exclusions)
    const excludedModels: string[] = [];

    // Calculate final rankings using average rank (now based on 7 grouped tasks)
    // This matches the logic in generate-model-comparison-table-fixed.js
    const overallResults = Array.from(modelAggregates.values())
      .filter(aggregate => aggregate.taskCount > 0)
      .filter(aggregate => !excludedModels.includes(aggregate.model))
      .map(aggregate => ({
        model: aggregate.model,
        averageScore: aggregate.totalScore / aggregate.taskCount,
        averageRank: aggregate.totalRank / aggregate.taskCount,
        taskCount: aggregate.taskCount
      }))
      .sort((a, b) => a.averageRank - b.averageRank) // Sort by average rank (ascending)
      .map((result, index): ProcessedResult => ({
        modelId: result.model,
        modelName: result.model,
        model: result.model,
        rank: index + 1,
        dataset: 'Overall',
        task: 'overall',
        lang: 'Multiple',
        sourceLang: null,
        targetLang: null,
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
        // Store both score and average rank in the dynamic properties
        score: result.averageScore.toFixed(1),
        avgRank: result.averageRank.toFixed(1),
        tasks: result.taskCount
      }));
    
    return overallResults;
  };

  const getTaskPrimaryMetric = (result: ProcessedResult, task: string): number | null => {
    // Return the primary metric for each task type (match script's TASK_PRIMARY_METRICS)
    switch (task) {
      case 'code generation':
      case 'code translation':
        return result.pass1;
      case 'code summarization':
      case 'code review':
        return result.llmjudge;
      case 'vulnerability detection':
        return result['Accuracy'] ?? null;
      case 'unit test generation':
        return result['line_coverage'] ?? null;
      case 'input prediction':
      case 'output prediction':
        return result.pass1; // Use pass@1 for input/output prediction, not executionAccuracy
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
