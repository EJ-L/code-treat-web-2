/**
 * Utility functions for progressive loading
 */

import { ProcessedResult, TaskType } from '@/lib/types';
import { APP_CONFIG } from '@/config/app.config';
import { debug } from '@/lib/debug';
import { TaskLoadResult, LoadingConfig } from './types';

/**
 * Get loading configuration from centralized config
 */
export const getLoadingConfig = (): LoadingConfig => ({
  tasksToAggregate: APP_CONFIG.tasks.aggregationTasks,
  excludedModels: Object.fromEntries(
    Object.entries(APP_CONFIG.tasks.excludedModels).map(([key, value]) => [key, [...value]])
  ), // Convert readonly to mutable
  progressWeights: {
    taskLoading: 50,
    batchLoading: 50
  }
});

/**
 * Filter task results based on exclusion rules
 */
export const filterTaskResults = (task: TaskType, results: ProcessedResult[]): ProcessedResult[] => {
  const config = getLoadingConfig();
  const excludedModels = config.excludedModels[task];
  
  if (!excludedModels || excludedModels.length === 0) {
    return results;
  }
  
  return results.filter(result => 
    !excludedModels.includes(result.model || '') && 
    !excludedModels.includes(result.modelName || '')
  );
};

/**
 * Calculate progress for task loading phase
 */
export const calculateTaskProgress = (currentIndex: number, totalTasks: number): number => {
  const config = getLoadingConfig();
  return ((currentIndex + 1) / totalTasks) * config.progressWeights.taskLoading;
};

/**
 * Calculate progress for batch loading phase
 */
export const calculateBatchProgress = (
  currentBatch: number, 
  totalBatches: number, 
  baseProgress: number = 0
): number => {
  // For specific tasks (baseProgress = 0), we want to go from 0% to 100%
  // For overall tasks (baseProgress = 50), we want to go from 50% to 100%
  const progressRange = baseProgress === 0 ? 100 : 50;
  const batchProgress = (currentBatch / totalBatches) * progressRange;
  return baseProgress + batchProgress;
};

/**
 * Create delay between operations
 */
export const createDelay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Sort results by priority models
 */
export const sortResultsByPriority = (
  results: ProcessedResult[], 
  priorityModels: string[]
): ProcessedResult[] => {
  return results.sort((a, b) => {
    const aModel = a.model || a.modelName || '';
    const bModel = b.model || b.modelName || '';
    
    const aIndex = priorityModels.findIndex(model => 
      aModel.includes(model)
    );
    const bIndex = priorityModels.findIndex(model => 
      bModel.includes(model)
    );
    
    // Priority models come first
    if (aIndex !== -1 && bIndex === -1) return -1;
    if (aIndex === -1 && bIndex !== -1) return 1;
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    
    // For non-priority models, sort by rank or name
    const rankA = typeof a.rank === 'string' ? parseInt(a.rank) : (a.rank || 0);
    const rankB = typeof b.rank === 'string' ? parseInt(b.rank) : (b.rank || 0);
    
    if (rankA && rankB) {
      return rankA - rankB;
    }
    
    return aModel.localeCompare(bModel);
  });
};

/**
 * Calculate overall results from task results using the same logic as the script
 */
export const calculateOverallResults = (taskResults: TaskLoadResult[]): ProcessedResult[] => {
  debug.dataLoader(`Calculating overall results from ${taskResults.length} task results`);
  console.log('🔍 DEBUG: Progressive loading - Starting ranking calculation for overall leaderboard');
  
  // Log task results summary
  taskResults.forEach(({ task, results }) => {
    debug.dataLoader(`Task ${task}: ${results.length} results`);
  });
  console.log('📊 Available task results by task:', 
    Object.fromEntries(taskResults.map(({ task, results }) => [task, results.length]))
  );
  
  // Define task groups for ranking calculation (matching the script logic)
  const rankingTaskGroups = [
    'code generation',
    'code summarization', 
    'code translation',
    'code review',
    'code-reasoning', // Combined input/output prediction
    'unit test generation',
    'vulnerability detection'
  ];
  
  // Collect all models across tasks
  const allModels = new Set<string>();
  const taskResultsMap = new Map<string, ProcessedResult[]>();
  
  taskResults.forEach(({ task, results }) => {
    taskResultsMap.set(task, results);
    results.forEach(result => {
      const modelKey = result.model || result.modelName || 'unknown';
      allModels.add(modelKey);
    });
  });
  
  // Calculate average ranks for each model using the same logic as the script
  const modelsWithRanks = Array.from(allModels).map(modelName => {
    let totalRank = 0;
    let taskCount = 0;
    const taskRankDetails: Record<string, any> = {};
    
    // For each ranking task group, find the corresponding task results and get their ranks
    rankingTaskGroups.forEach(taskGroup => {
      let taskRank = null;
      
      if (taskGroup === 'code-reasoning') {
        // For code reasoning, combine input and output prediction ranks
        const inputResults = taskResultsMap.get('input prediction')?.filter(r => 
          (r.modelName === modelName || r.model === modelName)) || [];
        const outputResults = taskResultsMap.get('output prediction')?.filter(r => 
          (r.modelName === modelName || r.model === modelName)) || [];
        
        const ranks = [];
        if (inputResults.length > 0 && inputResults[0].rank) ranks.push(inputResults[0].rank);
        if (outputResults.length > 0 && outputResults[0].rank) ranks.push(outputResults[0].rank);
        
        if (ranks.length > 0) {
          taskRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
        }
        
        taskRankDetails[taskGroup] = {
          inputRank: inputResults.length > 0 ? inputResults[0].rank : null,
          outputRank: outputResults.length > 0 ? outputResults[0].rank : null,
          combinedRank: taskRank
        };
      } else {
        // For other tasks, find the task result and get its rank
        const taskResults = taskResultsMap.get(taskGroup)?.filter(r => 
          (r.modelName === modelName || r.model === modelName)) || [];
        if (taskResults.length > 0 && taskResults[0].rank) {
          taskRank = taskResults[0].rank;
        }
        
        taskRankDetails[taskGroup] = {
          rank: taskRank,
          hasData: taskResults.length > 0
        };
      }
      
      if (taskRank !== null) {
        totalRank += taskRank;
        taskCount++;
      }
    });
    
    // Calculate average rank
    const avgRank = taskCount > 0 ? totalRank / taskCount : null;
    
    // Get a sample result to use as base
    const sampleResult = taskResults.flatMap(({ results }) => results)
      .find(r => r.model === modelName || r.modelName === modelName) || 
      { model: modelName, modelName: modelName, task: 'overall' };
    
    return {
      ...sampleResult,
      model: modelName,
      modelName: modelName,
      task: 'overall',
      avgRank: avgRank,
      taskRankDetails: taskRankDetails
    };
  });
  
  // Sort by average rank and assign final ranks
  const sortedResults = modelsWithRanks
    .filter(result => result.avgRank !== null) // Only include models with valid average ranks
    .sort((a, b) => a.avgRank! - b.avgRank!)
    .map((result, index) => ({
      ...result,
      rank: index + 1 // Assign final rank based on sorted position
    }));

  // Add models without ranks at the end
  const modelsWithoutRanks = modelsWithRanks
    .filter(result => result.avgRank === null)
    .map((result, index) => ({
      ...result,
      rank: sortedResults.length + index + 1
    }));

  const finalResults = [...sortedResults, ...modelsWithoutRanks];

  // Debug final rankings
  console.log('🏆 DEBUG: Progressive loading - Final overall rankings (top 10):');
  finalResults.slice(0, 10).forEach((result, index) => {
    console.log(`${index + 1}. ${result.modelName || result.model} - Avg Rank: ${result.avgRank?.toFixed(2) || 'N/A'} - Final Rank: ${result.rank}`);
  });

  console.log(`📈 Total models with rankings: ${sortedResults.length}`);
  console.log(`❌ Models without rankings: ${modelsWithoutRanks.length}`);
  
  debug.dataLoader(`Calculated overall results for ${finalResults.length} models`);
  return finalResults;
};

/**
 * Split results into batches for progressive loading
 */
export const createBatches = <T>(items: T[], batchSize: number): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
};
