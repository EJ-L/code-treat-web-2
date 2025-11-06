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
  
  // Define which metric to use for each task (matching the script)
  const TASK_PRIMARY_METRICS: Record<string, string> = {
    'code generation': 'pass1',
    'code summarization': 'llmjudge',
    'code translation': 'pass1',
    'code review': 'llmjudge',
    'input prediction': 'pass1',
    'output prediction': 'pass1',
    'unit test generation': 'line_coverage',
    'vulnerability detection': 'executionAccuracy'
  };
  
  // Collect all models across tasks
  const allModels = new Set<string>();
  const taskResultsMap = new Map<string, ProcessedResult[]>();
  
  taskResults.forEach(({ task, results }) => {
    taskResultsMap.set(task, results);
    console.log(`🔍 DEBUG: Task ${task} has ${results.length} results`);
    if (results.length > 0) {
      console.log(`🔍 DEBUG: Sample models in ${task}:`, results.slice(0, 3).map(r => r.model || r.modelName));
    }
    results.forEach(result => {
      const modelKey = result.model || result.modelName || 'unknown';
      allModels.add(modelKey);
    });
  });
  
  console.log(`🔍 DEBUG: Total unique models found: ${allModels.size}`);
  console.log(`🔍 DEBUG: All models:`, Array.from(allModels).slice(0, 10));
  
  // Calculate ranks for each individual task based on scores (like the script does)
  const taskRanks: Record<string, Record<string, number>> = {};
  
  rankingTaskGroups.forEach(taskGroup => {
    if (taskGroup === 'code-reasoning') {
      // Skip code-reasoning here, we'll handle it separately
      return;
    }
    
    const taskResults = taskResultsMap.get(taskGroup) || [];
    const metric = TASK_PRIMARY_METRICS[taskGroup];
    
    if (!metric || taskResults.length === 0) {
      taskRanks[taskGroup] = {};
      return;
    }
    
    // Extract scores for all models
    const scores: Array<{ model: string; score: number }> = [];
    taskResults.forEach(result => {
      const modelName = result.model || result.modelName || 'unknown';
      const score = result[metric as keyof ProcessedResult] as number;
      if (score !== null && score !== undefined && !isNaN(score)) {
        scores.push({ model: modelName, score });
      }
    });
    
    console.log(`🔍 DEBUG: Task ${taskGroup} - Metric ${metric} - Found ${scores.length} valid scores`);
    if (scores.length > 0) {
      console.log(`🔍 DEBUG: Top 3 scores for ${taskGroup}:`, scores.sort((a, b) => b.score - a.score).slice(0, 3));
    }
    
    // Sort by score (descending) and assign ranks
    scores.sort((a, b) => b.score - a.score);
    const ranks: Record<string, number> = {};
    scores.forEach((item, index) => {
      ranks[item.model] = index + 1;
    });
    
    taskRanks[taskGroup] = ranks;
  });
  
  // Calculate combined Code Reasoning ranks
  const inputResults = taskResultsMap.get('input prediction') || [];
  const outputResults = taskResultsMap.get('output prediction') || [];
  
  const codeReasoningRanks: Record<string, number> = {};
  const allReasoningModels = new Set<string>();
  
  // Collect all models from both input and output prediction
  [...inputResults, ...outputResults].forEach(result => {
    const modelName = result.model || result.modelName || 'unknown';
    allReasoningModels.add(modelName);
  });
  
  // Calculate combined scores for Code Reasoning
  const combinedScores: Array<{ model: string; score: number }> = [];
  allReasoningModels.forEach(modelName => {
    const inputResult = inputResults.find(r => (r.model || r.modelName) === modelName);
    const outputResult = outputResults.find(r => (r.model || r.modelName) === modelName);
    
    const validScores = [];
    if (inputResult && inputResult.pass1 !== null && inputResult.pass1 !== undefined && !isNaN(inputResult.pass1)) {
      validScores.push(inputResult.pass1);
    }
    if (outputResult && outputResult.pass1 !== null && outputResult.pass1 !== undefined && !isNaN(outputResult.pass1)) {
      validScores.push(outputResult.pass1);
    }
    
    if (validScores.length > 0) {
      const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      combinedScores.push({ model: modelName, score: avgScore });
    }
  });
  
  // Sort by combined score (descending) and assign ranks
  combinedScores.sort((a, b) => b.score - a.score);
  combinedScores.forEach((item, index) => {
    codeReasoningRanks[item.model] = index + 1;
  });
  
  // Calculate average ranks for each model using the same logic as the script
  const modelsWithRanks = Array.from(allModels).map(modelName => {
    let totalRank = 0;
    let taskCount = 0;
    const taskRankDetails: Record<string, { rank?: number | null; hasData?: boolean; combinedRank?: number | null }> = {};
    
    // For each ranking task group, calculate the rank
    rankingTaskGroups.forEach(taskGroup => {
      let taskRank = null;
      
      if (taskGroup === 'code-reasoning') {
        // Use combined Code Reasoning rank
        taskRank = codeReasoningRanks[modelName] || null;
        taskRankDetails[taskGroup] = {
          combinedRank: taskRank
        };
      } else {
        // Use individual task rank
        taskRank = taskRanks[taskGroup] ? taskRanks[taskGroup][modelName] : null;
        taskRankDetails[taskGroup] = {
          rank: taskRank,
          hasData: taskResultsMap.get(taskGroup)?.some(r => (r.model || r.modelName) === modelName) || false
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
      .find(r => r.model === modelName || r.modelName === modelName);
    
    const result: ProcessedResult = {
      model: modelName,
      modelName: modelName,
      task: 'overall',
      avgRank: avgRank,
      // Ensure all required ProcessedResult properties are present
      modelId: sampleResult?.modelId || modelName,
      dataset: sampleResult?.dataset || 'overall',
      sourceLang: sampleResult?.sourceLang || null,
      lang: sampleResult?.lang || 'All',
      targetLang: sampleResult?.targetLang || null,
      pass1: sampleResult?.pass1 || null,
      pass3: sampleResult?.pass3 || null,
      pass5: sampleResult?.pass5 || null,
      executionAccuracy: sampleResult?.executionAccuracy || null,
      easyPass1: sampleResult?.easyPass1 || null,
      easyPass3: sampleResult?.easyPass3 || null,
      easyPass5: sampleResult?.easyPass5 || null,
      mediumPass1: sampleResult?.mediumPass1 || null,
      mediumPass3: sampleResult?.mediumPass3 || null,
      mediumPass5: sampleResult?.mediumPass5 || null,
      hardPass1: sampleResult?.hardPass1 || null,
      hardPass3: sampleResult?.hardPass3 || null,
      hardPass5: sampleResult?.hardPass5 || null,
      codebleu: sampleResult?.codebleu || null,
      llmjudge: sampleResult?.llmjudge || null,
      difficulty: sampleResult?.difficulty || null,
      // Copy any additional properties from the sample result
      ...(sampleResult ? Object.fromEntries(
        Object.entries(sampleResult).filter(([key]) => 
          !['model', 'modelName', 'task', 'avgRank', 'modelId', 'dataset', 'sourceLang', 'lang', 'targetLang', 
            'pass1', 'pass3', 'pass5', 'executionAccuracy', 'easyPass1', 'easyPass3', 'easyPass5',
            'mediumPass1', 'mediumPass3', 'mediumPass5', 'hardPass1', 'hardPass3', 'hardPass5',
            'codebleu', 'llmjudge', 'difficulty'].includes(key)
        )
      ) : {})
    };
    
    // Add task rank details as debug info (store as string to match index signature)
    result['taskRankDetails'] = JSON.stringify(taskRankDetails);
    
    return result;
  });
  
  // Sort by average rank and assign final ranks
  const sortedResults = modelsWithRanks
    .filter(result => (result as ProcessedResult & { avgRank?: number | null }).avgRank !== null) // Only include models with valid average ranks
    .sort((a, b) => ((a as ProcessedResult & { avgRank: number }).avgRank) - ((b as ProcessedResult & { avgRank: number }).avgRank))
    .map((result, index) => {
      const finalResult = { ...result };
      (finalResult as ProcessedResult & { rank: number }).rank = index + 1; // Assign final rank based on sorted position
      return finalResult;
    });

  // Add models without ranks at the end
  const modelsWithoutRanks = modelsWithRanks
    .filter(result => (result as ProcessedResult & { avgRank?: number | null }).avgRank === null)
    .map((result, index) => {
      const finalResult = { ...result };
      (finalResult as ProcessedResult & { rank: number }).rank = sortedResults.length + index + 1;
      return finalResult;
    });

  const finalResults = [...sortedResults, ...modelsWithoutRanks];

  // Debug final rankings
  console.log('🏆 DEBUG: Progressive loading - Final overall rankings (top 10):');
  finalResults.slice(0, 10).forEach((result, index) => {
    const typedResult = result as ProcessedResult & { avgRank?: number; rank?: number };
    console.log(`${index + 1}. ${result.modelName || result.model} - Avg Rank: ${typedResult.avgRank?.toFixed(2) || 'N/A'} - Final Rank: ${typedResult.rank}`);
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
