import { ProcessedResult, FilterOptions } from '../types';
import { processCodeGeneration, aggregateCodeGenerationResults } from './codeGeneration';
import { processCodeTranslation, aggregateCodeTranslationResults } from './codeTranslation';
import { processCodeSummarization, aggregateCodeSummarizationResults } from './codeSummarization';
import { processCodeExecution, aggregateCodeExecutionResults } from './codeExecution';
import { processVulnerabilityDetection, aggregateVulnerabilityDetectionResults } from './vulnerabilityDetection';
import { processCodeReview, aggregateCodeReviewResults } from './codeReview';
import { processInputPrediction, aggregateInputPredictionResults } from './inputPrediction';
import { processOutputPrediction, aggregateOutputPredictionResults } from './outputPrediction';
import { processUnitTestGeneration, aggregateUnitTestGenerationResults } from './unitTestGeneration';
import { loadAllData, processResult } from '../dataLoader';

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

  // For overall task, use the same logic as the ground truth script
  // Load data directly from consolidated files instead of using complex aggregation
  console.log('🔍 DEBUG: Using direct consolidated file loading for overall task');
  
  try {
    const overallResults = await loadConsolidatedDataAndCalculateRanking();
    if (overallResults && overallResults.length > 0) {
      console.log(`✅ Successfully loaded ${overallResults.length} models from consolidated files`);
      console.log('🏆 Top 5 models:', overallResults.slice(0, 5).map(r => `${r.modelName} (rank ${(r as ProcessedResult & { rank?: number }).rank})`));
      return overallResults;
    } else {
      console.warn('⚠️ No results from consolidated files, falling back to original method');
    }
  } catch (error) {
    console.error('❌ Failed to load from consolidated files, falling back to original method:', error);
  }

  // Fallback to original method if consolidated loading fails
  const rawData = await loadAllData();
  if (!rawData) {
    console.error('Failed to load raw data for overall processing');
    return [];
  }
  const processedRawData = rawData.map(processResult);
  
  // 收集所有任务的处理结果
  const allTasksResults: ProcessedResult[] = [];

  // For overall view, we want to use all data without filtering
  console.log('For overall view, using all data without applying filters');

  // 处理各种任务类型的数据
  // 1. 处理代码生成任务
  try {
    console.log('Processing code generation task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const codeGenResults = processCodeGeneration(processedRawData, emptyFilters);
    const aggregatedCodeGenResults = aggregateCodeGenerationResults(codeGenResults);
    allTasksResults.push(...aggregatedCodeGenResults);
  } catch (error) {
    console.error('Error processing code generation task:', error);
  }

  // 2. 处理代码翻译任务
  try {
    console.log('Processing code translation task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const codeTransResults = processCodeTranslation(processedRawData, emptyFilters);
    const aggregatedCodeTransResults = aggregateCodeTranslationResults(codeTransResults);
    allTasksResults.push(...aggregatedCodeTransResults);
  } catch (error) {
    console.error('Error processing code translation task:', error);
  }

  // 3. 处理代码摘要任务
  try {
    console.log('Processing code summarization task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const codeSumResults = processCodeSummarization(rawData, emptyFilters);
    const aggregatedCodeSumResults = aggregateCodeSummarizationResults(codeSumResults);
    
    // Filter out Code Summarization Human Baseline from overall results
    const filteredCodeSumResults = aggregatedCodeSumResults.filter(result => 
      result.modelName !== 'Code Summarization Human Baseline'
    );
    console.log('Filtered out Code Summarization Human Baseline from overall results:', {
      originalCount: aggregatedCodeSumResults.length,
      filteredCount: filteredCodeSumResults.length
    });
    
    allTasksResults.push(...filteredCodeSumResults);
  } catch (error) {
    console.error('Error processing code summarization task:', error);
  }

  // 4. 处理代码执行任务
  try {
    console.log('Processing code execution task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const codeExecResults = processCodeExecution(processedRawData, emptyFilters);
    const aggregatedCodeExecResults = aggregateCodeExecutionResults(codeExecResults);
    allTasksResults.push(...aggregatedCodeExecResults);
  } catch (error) {
    console.error('Error processing code execution task:', error);
  }

  // 5. 处理代码审查任务
  try {
    console.log('Processing code review task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const codeReviewResults = processCodeReview(rawData, emptyFilters);
    const aggregatedCodeReviewResults = aggregateCodeReviewResults(codeReviewResults);
    allTasksResults.push(...aggregatedCodeReviewResults);
  } catch (error) {
    console.error('Error processing code review task:', error);
  }

  // 6. 处理输入预测任务
  try {
    console.log('Processing input prediction task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const inputPredResults = processInputPrediction(processedRawData, emptyFilters);
    const aggregatedInputPredResults = aggregateInputPredictionResults(inputPredResults);
    allTasksResults.push(...aggregatedInputPredResults);
  } catch (error) {
    console.error('Error processing input prediction task:', error);
  }

  // 7. 处理输出预测任务
  try {
    console.log('Processing output prediction task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const outputPredResults = processOutputPrediction(processedRawData, emptyFilters);
    const aggregatedOutputPredResults = aggregateOutputPredictionResults(outputPredResults);
    allTasksResults.push(...aggregatedOutputPredResults);
  } catch (error) {
    console.error('Error processing output prediction task:', error);
  }

  // 8. 处理单元测试生成任务
  try {
    console.log('Processing unit test generation task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    const unitTestResults = await processUnitTestGeneration(processedRawData, emptyFilters);
    const aggregatedUnitTestResults = aggregateUnitTestGenerationResults(unitTestResults);
    allTasksResults.push(...aggregatedUnitTestResults);
  } catch (error) {
    console.error('Error processing unit test generation task:', error);
  }

  // 9. 处理漏洞检测任务
  try {
    console.log('Processing vulnerability detection task for overall view (no filters)');
    // Use empty filters to get all results
    const emptyFilters = { ...filters, datasets: [], langs: [], modalities: [], knowledge: [], reasoning: [], robustness: [], security: [] };
    // 不要依赖于rawData中的漏洞检测数据，直接从JSON文件加载
    // 强行使用一个空数组，这样函数内部会直接从JSON文件加载数据
    const vulDetectResults = await processVulnerabilityDetection([], emptyFilters);
    console.log('漏洞检测任务处理完成:', {
      totalResults: vulDetectResults.length,
      modelNames: [...new Set(vulDetectResults.map(r => r.modelName))],
      datasets: [...new Set(vulDetectResults.map(r => r.dataset))],
      sampleResult: vulDetectResults[0]
    });
    
    const aggregatedVulDetectResults = aggregateVulnerabilityDetectionResults(vulDetectResults);
    console.log('漏洞检测结果聚合完成:', {
      totalResults: aggregatedVulDetectResults.length,
      sampleResult: aggregatedVulDetectResults[0]
    });
    
    allTasksResults.push(...aggregatedVulDetectResults);
  } catch (error) {
    console.error('Error processing vulnerability detection task:', error);
  }

  // 将所有任务的结果整合到一起
  console.log('Collected results from all tasks:', {
    totalResults: allTasksResults.length,
    taskTypes: [...new Set(allTasksResults.map(r => r.task))],
    vulnDetectionResults: allTasksResults.filter(r => r.task === 'vulnerability detection').length
  });

  // Group by model name (using original model names - no canonicalization)
  const groupedResults = new Map<string, ProcessedResult[]>();
  allTasksResults.forEach(result => {
    const key = result.modelName || result.model || 'Unknown';
    if (!groupedResults.has(key)) {
      groupedResults.set(key, []);
    }
    groupedResults.get(key)!.push(result);
  });

  // Models to exclude from overall leaderboard
  /*
  const excludedModels = [
    'Claude-Sonnet-4',
    'Qwen3-235B-A22B',
    'Qwen3-32B',
    'Qwen3-30B-A3B',
    'Claude-3-5-Haiku-2024102',
    'claude-3-5-haiku-20241022',
    'Qwen2.5-72B-Instruct',
    'Qwen2.5-32B-Instruct',
    'Gemma-3-27B-it'
  ];
  */

  const excludedModels = ['N/A'];
  
  // Calculate aggregated metrics for each model with difficulty-based grouping
  const finalResults = Array.from(groupedResults.entries())
    .filter(([modelName]) => !excludedModels.includes(modelName))
    .map(([modelName, modelResults]) => {
    const baseResult = { ...modelResults[0] };
    baseResult.task = 'overall';
    baseResult.modelName = modelName; // Use the original model name
    
    // Group results by difficulty level
    const easyResults = modelResults.filter(r => r.difficulty?.toLowerCase() === 'easy');
    const mediumResults = modelResults.filter(r => r.difficulty?.toLowerCase() === 'medium');
    const hardResults = modelResults.filter(r => r.difficulty?.toLowerCase() === 'hard');
    
    // 检查漏洞检测数据
    const vulnResults = modelResults.filter(r => r.task === 'vulnerability detection');
    console.log(`模型 ${modelName} 的漏洞检测结果:`, {
      numVulnResults: vulnResults.length,
      hasVulnResults: vulnResults.length > 0,
      vulnDatasets: vulnResults.map(r => r.dataset).join(', '),
      sampleVulnResult: vulnResults[0]
    });
    
    // Calculate standard metrics across all results
    const metrics = {
      pass1: modelResults.filter(r => r.pass1 != null).map(r => r.pass1!),
      pass3: modelResults.filter(r => r.pass3 != null).map(r => r.pass3!),
      pass5: modelResults.filter(r => r.pass5 != null).map(r => r.pass5!),
      codebleu: modelResults.filter(r => r.codebleu != null).map(r => r.codebleu!),
      llmjudge: modelResults.filter(r => r.llmjudge != null).map(r => r.llmjudge!),
      executionAccuracy: modelResults.filter(r => r.executionAccuracy != null).map(r => r.executionAccuracy!),
      // 漏洞检测指标 - 不受数据集过滤影响
      accuracy: modelResults.filter(r => r['Accuracy'] != null).map(r => r['Accuracy']!),
      precision: modelResults.filter(r => r['Precision'] != null).map(r => r['Precision']!),
      recall: modelResults.filter(r => r['Recall'] != null).map(r => r['Recall']!),
      f1Score: modelResults.filter(r => r['F1 Score'] != null).map(r => r['F1 Score']!),
      pC: modelResults.filter(r => r['P-C'] != null).map(r => r['P-C']!),
      pV: modelResults.filter(r => r['P-V'] != null).map(r => r['P-V']!),
      pB: modelResults.filter(r => r['P-B'] != null).map(r => r['P-B']!),
      pR: modelResults.filter(r => r['P-R'] != null).map(r => r['P-R']!),
    };
    
    // Calculate difficulty-specific metrics
    const difficultyScopedMetrics = {
      easyPass1: easyResults.filter(r => r.pass1 != null).map(r => r.pass1!),
      easyPass3: easyResults.filter(r => r.pass3 != null).map(r => r.pass3!),
      easyPass5: easyResults.filter(r => r.pass5 != null).map(r => r.pass5!),
      mediumPass1: mediumResults.filter(r => r.pass1 != null).map(r => r.pass1!),
      mediumPass3: mediumResults.filter(r => r.pass3 != null).map(r => r.pass3!),
      mediumPass5: mediumResults.filter(r => r.pass5 != null).map(r => r.pass5!),
      hardPass1: hardResults.filter(r => r.pass1 != null).map(r => r.pass1!),
      hardPass3: hardResults.filter(r => r.pass3 != null).map(r => r.pass3!),
      hardPass5: hardResults.filter(r => r.pass5 != null).map(r => r.pass5!),
    };
    
    // Calculate averages for standard metrics
    const aggregatedResult = {
      ...baseResult,
      task: 'overall',
      pass1: metrics.pass1.length > 0 ? metrics.pass1.reduce((a, b) => a + b) / metrics.pass1.length : null,
      pass3: metrics.pass3.length > 0 ? metrics.pass3.reduce((a, b) => a + b) / metrics.pass3.length : null,
      pass5: metrics.pass5.length > 0 ? metrics.pass5.reduce((a, b) => a + b) / metrics.pass5.length : null,
      codebleu: metrics.codebleu.length > 0 ? metrics.codebleu.reduce((a, b) => a + b) / metrics.codebleu.length : null,
      llmjudge: metrics.llmjudge.length > 0 ? metrics.llmjudge.reduce((a, b) => a + b) / metrics.llmjudge.length : null,
      executionAccuracy: metrics.executionAccuracy.length > 0 ? metrics.executionAccuracy.reduce((a, b) => a + b) / metrics.executionAccuracy.length : null,
      // 漏洞检测指标
      'Accuracy': metrics.accuracy.length > 0 ? metrics.accuracy.reduce((a, b) => a + b) / metrics.accuracy.length : null,
      'Precision': metrics.precision.length > 0 ? metrics.precision.reduce((a, b) => a + b) / metrics.precision.length : null,
      'Recall': metrics.recall.length > 0 ? metrics.recall.reduce((a, b) => a + b) / metrics.recall.length : null,
      'F1 Score': metrics.f1Score.length > 0 ? metrics.f1Score.reduce((a, b) => a + b) / metrics.f1Score.length : null,
      'P-C': metrics.pC.length > 0 ? metrics.pC.reduce((a, b) => a + b) / metrics.pC.length : null,
      'P-V': metrics.pV.length > 0 ? metrics.pV.reduce((a, b) => a + b) / metrics.pV.length : null,
      'P-B': metrics.pB.length > 0 ? metrics.pB.reduce((a, b) => a + b) / metrics.pB.length : null,
      'P-R': metrics.pR.length > 0 ? metrics.pR.reduce((a, b) => a + b) / metrics.pR.length : null,
    };
    
    // Add difficulty-specific metrics to the result
    return {
      ...aggregatedResult,
      // Easy metrics
      easyPass1: difficultyScopedMetrics.easyPass1.length > 0 
        ? difficultyScopedMetrics.easyPass1.reduce((a, b) => a + b) / difficultyScopedMetrics.easyPass1.length 
        : null,
      easyPass3: difficultyScopedMetrics.easyPass3.length > 0 
        ? difficultyScopedMetrics.easyPass3.reduce((a, b) => a + b) / difficultyScopedMetrics.easyPass3.length 
        : null,
      easyPass5: difficultyScopedMetrics.easyPass5.length > 0 
        ? difficultyScopedMetrics.easyPass5.reduce((a, b) => a + b) / difficultyScopedMetrics.easyPass5.length 
        : null,
      // Medium metrics
      mediumPass1: difficultyScopedMetrics.mediumPass1.length > 0 
        ? difficultyScopedMetrics.mediumPass1.reduce((a, b) => a + b) / difficultyScopedMetrics.mediumPass1.length 
        : null,
      mediumPass3: difficultyScopedMetrics.mediumPass3.length > 0 
        ? difficultyScopedMetrics.mediumPass3.reduce((a, b) => a + b) / difficultyScopedMetrics.mediumPass3.length 
        : null,
      mediumPass5: difficultyScopedMetrics.mediumPass5.length > 0 
        ? difficultyScopedMetrics.mediumPass5.reduce((a, b) => a + b) / difficultyScopedMetrics.mediumPass5.length 
        : null,
      // Hard metrics
      hardPass1: difficultyScopedMetrics.hardPass1.length > 0 
        ? difficultyScopedMetrics.hardPass1.reduce((a, b) => a + b) / difficultyScopedMetrics.hardPass1.length 
        : null,
      hardPass3: difficultyScopedMetrics.hardPass3.length > 0 
        ? difficultyScopedMetrics.hardPass3.reduce((a, b) => a + b) / difficultyScopedMetrics.hardPass3.length 
        : null,
      hardPass5: difficultyScopedMetrics.hardPass5.length > 0 
        ? difficultyScopedMetrics.hardPass5.reduce((a, b) => a + b) / difficultyScopedMetrics.hardPass5.length 
        : null,
    };
  });

  // Now calculate overall rankings based on average task ranks (same logic as the script)
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

  // Calculate average ranks for each model
  console.log('🔍 DEBUG: Starting ranking calculation for overall leaderboard');
  console.log('📊 Available task results by task:', 
    Object.fromEntries(
      rankingTaskGroups.map(task => [
        task, 
        allTasksResults.filter(r => r.task === task).length
      ])
    )
  );

  // Calculate ranks for each individual task based on scores (like the script does)
  const taskRanks: Record<string, Record<string, number>> = {};
  
  rankingTaskGroups.forEach(taskGroup => {
    if (taskGroup === 'code-reasoning') {
      // Skip code-reasoning here, we'll handle it separately
      return;
    }
    
    const taskResults = allTasksResults.filter(r => r.task === taskGroup);
    const metric = TASK_PRIMARY_METRICS[taskGroup];
    
    if (!metric || taskResults.length === 0) {
      taskRanks[taskGroup] = {};
      return;
    }
    
    // Extract scores for all models
    const scores: Array<{ model: string; score: number }> = [];
    taskResults.forEach(result => {
      const modelName = result.modelName || result.model || 'unknown';
      const score = result[metric as keyof ProcessedResult] as number;
      if (score !== null && score !== undefined && !isNaN(score)) {
        scores.push({ model: modelName, score });
      }
    });
    
    // Sort by score (descending) and assign ranks
    scores.sort((a, b) => b.score - a.score);
    const ranks: Record<string, number> = {};
    scores.forEach((item, index) => {
      ranks[item.model] = index + 1;
    });
    
    taskRanks[taskGroup] = ranks;
  });
  
  // Calculate combined Code Reasoning ranks
  const inputResults = allTasksResults.filter(r => r.task === 'input prediction');
  const outputResults = allTasksResults.filter(r => r.task === 'output prediction');
  
  const codeReasoningRanks: Record<string, number> = {};
  const allReasoningModels = new Set<string>();
  
  // Collect all models from both input and output prediction
  [...inputResults, ...outputResults].forEach(result => {
    const modelName = result.modelName || result.model || 'unknown';
    allReasoningModels.add(modelName);
  });
  
  // Calculate combined scores for Code Reasoning
  const combinedScores: Array<{ model: string; score: number }> = [];
  allReasoningModels.forEach(modelName => {
    const inputResult = inputResults.find(r => (r.modelName || r.model) === modelName);
    const outputResult = outputResults.find(r => (r.modelName || r.model) === modelName);
    
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

  const modelsWithRanks = finalResults.map(result => {
    let totalRank = 0;
    let taskCount = 0;
    const taskRankDetails: Record<string, { rank?: number | null; hasData?: boolean; combinedRank?: number | null }> = {};

    // For each ranking task group, calculate the rank
    rankingTaskGroups.forEach(taskGroup => {
      let taskRank = null;
      
      if (taskGroup === 'code-reasoning') {
        // Use combined Code Reasoning rank
        taskRank = codeReasoningRanks[result.modelName] || null;
        taskRankDetails[taskGroup] = {
          combinedRank: taskRank
        };
      } else {
        // Use individual task rank
        taskRank = taskRanks[taskGroup] ? taskRanks[taskGroup][result.modelName] : null;
        taskRankDetails[taskGroup] = {
          rank: taskRank,
          hasData: allTasksResults.some(r => r.task === taskGroup && (r.modelName || r.model) === result.modelName)
        };
      }
      
      if (taskRank !== null) {
        totalRank += taskRank;
        taskCount++;
      }
    });

    // Calculate average rank
    const avgRank = taskCount > 0 ? totalRank / taskCount : null;
    
    // Debug output for first few models
    if (finalResults.indexOf(result) < 5) {
      console.log(`🎯 Model: ${result.modelName}`);
      console.log(`   Task ranks:`, taskRankDetails);
      console.log(`   Total rank: ${totalRank}, Task count: ${taskCount}, Avg rank: ${avgRank}`);
    }
    
    const processedResult = {
      ...result,
      avgRank: avgRank
    };
    
    // Add task rank details as debug info (store as string to match index signature)
    (processedResult as unknown as ProcessedResult & { taskRankDetails: string }).taskRankDetails = JSON.stringify(taskRankDetails);
    
    return processedResult;
  });

  // Sort by average rank and assign final ranks
  const sortedResults = modelsWithRanks
    .filter(result => (result as ProcessedResult & { avgRank?: number | null }).avgRank !== null) // Only include models with valid average ranks
    .sort((a, b) => ((a as ProcessedResult & { avgRank: number }).avgRank) - ((b as ProcessedResult & { avgRank: number }).avgRank))
    .map((result, index) => {
      const finalResult = { ...result };
      (finalResult as unknown as ProcessedResult & { rank: number }).rank = index + 1; // Assign final rank based on sorted position
      return finalResult;
    });

  // Add models without ranks at the end
  const modelsWithoutRanks = modelsWithRanks
    .filter(result => (result as ProcessedResult & { avgRank?: number | null }).avgRank === null)
    .map((result, index) => {
      const finalResult = { ...result };
      (finalResult as unknown as ProcessedResult & { rank: number }).rank = sortedResults.length + index + 1;
      return finalResult;
    });

  const finalRankedResults = [...sortedResults, ...modelsWithoutRanks];

  // Debug final rankings
  console.log('🏆 DEBUG: Final overall rankings (top 10):');
  finalRankedResults.slice(0, 10).forEach((result, index) => {
    const typedResult = result as ProcessedResult & { avgRank?: number; rank?: number };
    console.log(`${index + 1}. ${result.modelName || result.model} - Avg Rank: ${typedResult.avgRank?.toFixed(2) || 'N/A'} - Final Rank: ${typedResult.rank}`);
  });

  console.log(`📈 Total models with rankings: ${sortedResults.length}`);
  console.log(`❌ Models without rankings: ${modelsWithoutRanks.length}`);

  return finalRankedResults;
}
