import { ProcessedResult, FilterOptions } from '../types';

// Define which metric to use for each task (matching the ground truth script)
const TASK_PRIMARY_METRICS: Record<string, string> = {
  'code generation': 'pass@1',
  'code summarization': 'LLM Judge',
  'code translation': 'pass@1',
  'code review': 'LLM Judge',
  'input prediction': 'pass@1',
  'output prediction': 'pass@1',
  'unit test generation': 'line_coverage',
  'vulnerability detection': 'Accuracy'
};

// Load data directly from consolidated files (same as ground truth script)
async function loadConsolidatedDataAndCalculateRanking(): Promise<ProcessedResult[]> {
  console.log('🔍 Loading data directly from consolidated files...');
  
  // Define the tasks to load (matching the script)
  const tasks = [
    'code generation',
    'code summarization',
    'code translation',
    'code review',
    'input prediction',
    'output prediction',
    'unit test generation',
    'vulnerability detection'
  ];
  
  // Load data for each task from consolidated files
  const taskDataMap: Record<string, { data: Record<string, unknown> }> = {};
  for (const task of tasks) {
    try {
      const taskFileName = task.replace(/\s+/g, '-');
      console.log(`🔄 Loading ${task} from: /api/direct-files?file=data/precomputed/${taskFileName}_consolidated.json`);
      const response = await fetch(`/api/direct-files?file=data/precomputed/${taskFileName}_consolidated.json`);
      if (response.ok) {
        const data = await response.json();
        taskDataMap[task] = data;
        console.log(`✅ Loaded ${task}: ${Object.keys(data.data || {}).length} models`);
      } else {
        console.warn(`⚠️ Failed to load ${task}: ${response.status} ${response.statusText}`);
        // Try alternative API endpoint
        try {
          const altResponse = await fetch(`/api/files?directory=data/precomputed&file=${taskFileName}_consolidated.json`);
          if (altResponse.ok) {
            const altData = await altResponse.json();
            taskDataMap[task] = altData;
            console.log(`✅ Loaded ${task} via alternative API: ${Object.keys(altData.data || {}).length} models`);
          } else {
            taskDataMap[task] = { data: {} };
          }
        } catch (altError) {
          console.error(`❌ Alternative API also failed for ${task}:`, altError);
          taskDataMap[task] = { data: {} };
        }
      }
    } catch (error) {
      console.error(`❌ Error loading ${task}:`, error);
      taskDataMap[task] = { data: {} };
    }
  }
  
  // Collect all unique model names across all tasks
  const allModels = new Set<string>();
  tasks.forEach(task => {
    const taskData = taskDataMap[task];
    Object.keys(taskData.data || {}).forEach(model => {
      allModels.add(model);
    });
  });
  
  console.log(`📊 Total unique models found: ${allModels.size}`);
  
  // Calculate ranks for each individual task
  const taskRanks: Record<string, Record<string, number>> = {};
  tasks.forEach(task => {
    if (task === 'input prediction' || task === 'output prediction') {
      // Skip these as they'll be combined into code-reasoning
      return;
    }
    const metric = TASK_PRIMARY_METRICS[task];
    taskRanks[task] = calculateRanksFromConsolidatedData(taskDataMap[task], metric);
  });
  
  // Calculate combined Code Reasoning ranks
  const codeReasoningRanks = calculateCombinedCodeReasoningRanksFromConsolidatedData(taskDataMap);
  
  // Define task groups for average ranking calculation
  const rankingTaskGroups = [
    'code generation',
    'code summarization', 
    'code translation',
    'code review',
    'code-reasoning', // Combined input/output prediction
    'unit test generation',
    'vulnerability detection'
  ];
  
  // Calculate average ranks for each model
  const modelData: Array<{ model: string; avgRank: number; taskCount: number }> = [];
  allModels.forEach(model => {
    let totalRank = 0;
    let taskCount = 0;
    
    // For each ranking task group, calculate the rank
    rankingTaskGroups.forEach(taskGroup => {
      let taskRank = null;
      
      if (taskGroup === 'code-reasoning') {
        // Use combined Code Reasoning rank
        taskRank = codeReasoningRanks[model] || null;
      } else {
        // Use individual task rank
        taskRank = taskRanks[taskGroup] ? taskRanks[taskGroup][model] : null;
      }
      
      if (taskRank !== null) {
        totalRank += taskRank;
        taskCount++;
      }
    });
    
    // Calculate average rank
    const avgRank = taskCount > 0 ? totalRank / taskCount : null;
    
    if (avgRank !== null) {
      modelData.push({ model, avgRank, taskCount });
    }
  });
  
  // Sort by average rank
  modelData.sort((a, b) => a.avgRank - b.avgRank);
  
  // Convert to ProcessedResult format
  const results: ProcessedResult[] = modelData.map((item, index) => ({
    modelId: item.model,
    modelName: item.model,
    model: item.model,
    dataset: 'overall',
    task: 'overall',
    sourceLang: null,
    lang: 'All',
    targetLang: null,
    pass1: null,
    pass3: null,
    pass5: null,
    executionAccuracy: null,
    easyPass1: null,
    easyPass3: null,
    easyPass5: null,
    mediumPass1: null,
    mediumPass3: null,
    mediumPass5: null,
    hardPass1: null,
    hardPass3: null,
    hardPass5: null,
    codebleu: null,
    llmjudge: null,
    difficulty: null,
    rank: index + 1,
    avgRank: item.avgRank
  } as ProcessedResult & { avgRank: number }));
  
  console.log('🏆 Final rankings from consolidated files (top 10):');
  results.slice(0, 10).forEach((result, index) => {
      console.log(`${index + 1}. ${result.modelName} - Avg Rank: ${(result as ProcessedResult & { avgRank: number }).avgRank.toFixed(2)}`);
  });
  
  return results;
}

// Calculate ranks for a specific task from consolidated data
function calculateRanksFromConsolidatedData(taskData: { data: Record<string, unknown> }, metric: string): Record<string, number> {
  const scores: Array<{ model: string; score: number }> = [];
  
  // Extract scores for all models
  for (const modelName in taskData.data || {}) {
    const modelData = taskData.data[modelName] as Record<string, unknown>;
    if (modelData && modelData.overall) {
      const overallData = modelData.overall as Record<string, unknown>;
      const score = overallData[metric];
      if (score !== undefined && score !== null && score !== '-') {
        const numScore = parseFloat(String(score));
        if (!isNaN(numScore)) {
          scores.push({ model: modelName, score: numScore });
        }
      }
    }
  }
  
  // Sort by score (descending)
  scores.sort((a, b) => b.score - a.score);
  
  // Assign ranks
  const ranks: Record<string, number> = {};
  scores.forEach((item, index) => {
    ranks[item.model] = index + 1;
  });
  
  return ranks;
}

// Calculate combined Code Reasoning ranks from consolidated data
function calculateCombinedCodeReasoningRanksFromConsolidatedData(taskDataMap: Record<string, { data: Record<string, unknown> }>): Record<string, number> {
  const inputPredictionData = taskDataMap['input prediction'];
  const outputPredictionData = taskDataMap['output prediction'];
  
  // Get all models that have scores in either input or output prediction
  const allModels = new Set<string>();
  if (inputPredictionData && inputPredictionData.data) {
    Object.keys(inputPredictionData.data).forEach(model => allModels.add(model));
  }
  if (outputPredictionData && outputPredictionData.data) {
    Object.keys(outputPredictionData.data).forEach(model => allModels.add(model));
  }
  
  // Calculate combined scores for Code Reasoning
  const combinedScores: Array<{ model: string; score: number }> = [];
  allModels.forEach(model => {
    const inputScore = extractModelScoreFromConsolidatedData(inputPredictionData, model, 'pass@1');
    const outputScore = extractModelScoreFromConsolidatedData(outputPredictionData, model, 'pass@1');
    
    const validScores = [];
    if (inputScore !== null) validScores.push(inputScore);
    if (outputScore !== null) validScores.push(outputScore);
    
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
}

// Extract model score from consolidated data
function extractModelScoreFromConsolidatedData(taskData: { data: Record<string, unknown> }, modelName: string, metric: string): number | null {
  if (!taskData || !taskData.data || !taskData.data[modelName]) {
    return null;
  }
  
  const modelData = taskData.data[modelName] as Record<string, unknown>;
  if (!modelData.overall) {
    return null;
  }
  
  const overallData = modelData.overall as Record<string, unknown>;
  const score = overallData[metric];
  if (score === undefined || score === null || score === '-') {
    return null;
  }
  
  const numScore = parseFloat(String(score));
  return isNaN(numScore) ? null : numScore;
}

export async function processOverall(rawResults: ProcessedResult[], filters: FilterOptions): Promise<ProcessedResult[]> {
  console.log('Processing overall task:', {
    totalResults: rawResults.length,
    filters: filters
  });

  // For overall task, ALWAYS use direct consolidated file loading (no progressive loading)
  // This matches the ground truth script exactly
  console.log('🔍 DEBUG: Using ONLY direct consolidated file loading for overall task (no fallback)');
  
  const overallResults = await loadConsolidatedDataAndCalculateRanking();
  if (overallResults && overallResults.length > 0) {
    console.log(`✅ Successfully loaded ${overallResults.length} models from consolidated files`);
    console.log('🏆 Top 5 models:', overallResults.slice(0, 5).map(r => `${r.modelName} (rank ${(r as ProcessedResult & { rank?: number }).rank})`));
    return overallResults;
  } else {
    console.warn('⚠️ No results from consolidated files - returning empty array');
    return [];
  }
}
