import { ProcessedResult, FilterOptions } from '../types';

export function processInputPrediction(results: ProcessedResult[], filters: FilterOptions): ProcessedResult[] {
  console.log('Starting processing', {
    totalResults: results.length,
    availableDatasets: [...new Set(results.map(r => r.dataset))]
  });

  const filteredResults = results.filter((result) => {
    // 1. 检查任务类型
    if (result.task.toLowerCase() !== 'input prediction') return false;
    
    // 2. 检查数据集
    if (filters.datasets?.length > 0) {
      const resultDataset = result.dataset.toLowerCase().trim();
      const allowedDatasets = new Set(filters.datasets.map(d => d.toLowerCase().trim()));
      if (!allowedDatasets.has(resultDataset)) return false;
    }
    
    // 3. 检查语言
    if (filters.langs?.length > 0) {
      const resultLang = result.lang?.toLowerCase();
      const allowedLangs = new Set(filters.langs.map(l => l.toLowerCase()));
      if (!resultLang || !allowedLangs.has(resultLang)) return false;
    }
    
    // 4. 检查模态
    if (filters.modalities?.length > 0) {
      // 预处理modalities数组
      const modalityPatterns = filters.modalities
        .filter(modality => modality)
        .map(modality => modality.toLowerCase());
      
      if (modalityPatterns.length > 0) {
        // Check 结果是否满足任意一个选定的模态
        const stringsToCheck: string[] = [];
        if (result.modelName) stringsToCheck.push(result.modelName.toLowerCase());
        if (result.dataset) stringsToCheck.push(result.dataset.toLowerCase());
        if (result.task) stringsToCheck.push(result.task.toLowerCase());
        if (result.lang) stringsToCheck.push(result.lang.toLowerCase());
        
        const hasMatchingModality = modalityPatterns.some(pattern => 
          stringsToCheck.some(str => str.includes(pattern))
        );
        
        if (!hasMatchingModality) return false;
      }
    }
    
    // 5. 检查知识领域
    if (filters.knowledge?.length > 0) {
      const hasMatchingKnowledge = filters.knowledge.some(knowledgeFilter => {
        const filterLower = knowledgeFilter.toLowerCase();
        
        // Check domain field directly for abbreviations
        if (result.domain) {
          const domainLower = result.domain.toLowerCase();
          
          // Direct match for abbreviations
          if (filterLower === 'algorithms' && domainLower === 'alg') return true;
          if (filterLower === 'data structures' && domainLower === 'ds') return true;
          if (filterLower === 'math' && domainLower === 'math') return true;
          
          // Direct domain field match
          if (domainLower.includes(filterLower)) return true;
          if (domainLower.includes(filterLower.replace(' ', ''))) return true;
        }
        
        // Check other fields for broader matches
        const stringsToCheck: string[] = [];
        if (result.modelName) stringsToCheck.push(result.modelName.toLowerCase());
        if (result.dataset) stringsToCheck.push(result.dataset.toLowerCase());
        if (result.task) stringsToCheck.push(result.task.toLowerCase());
        
        return stringsToCheck.some(str => str.includes(filterLower));
      });
      
      if (!hasMatchingKnowledge) return false;
    }
    
    return true;
  });

  // If we're showing by difficulty, populate the difficulty-specific metrics
  if (filters.showByDifficulty) {
    filteredResults.forEach(result => {
      if (result.difficulty === 'Easy' && result.pass1 !== null) {
        result.easyPass1 = result.pass1;
        result.easyPass3 = result.pass3;
        result.easyPass5 = result.pass5;
      } else if (result.difficulty === 'Medium' && result.pass1 !== null) {
        result.mediumPass1 = result.pass1;
        result.mediumPass3 = result.pass3;
        result.mediumPass5 = result.pass5;
      } else if (result.difficulty === 'Hard' && result.pass1 !== null) {
        result.hardPass1 = result.pass1;
        result.hardPass3 = result.pass3;
        result.hardPass5 = result.pass5;
      }
    });
  }

  console.log('Completed processing', {
    totalFilteredResults: filteredResults.length,
    remainingDatasets: [...new Set(filteredResults.map(r => r.dataset))]
  });

  return filteredResults;
}

export function aggregateInputPredictionResults(results: ProcessedResult[]): ProcessedResult[] {
  if (results.length === 0) return [];

  const groupedResults = new Map<string, ProcessedResult[]>();
  
  // Group by model
  results.forEach(result => {
    const key = result.modelName;
    if (!groupedResults.has(key)) {
      groupedResults.set(key, []);
    }
    groupedResults.get(key)!.push(result);
  });
  
  // Calculate average for each model
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const aggregatedResults = Array.from(groupedResults.entries()).map(([_, modelResults]) => {
    const baseResult = { ...modelResults[0] };
    
    // Calculate average for standard metrics
    const metrics = ['pass1', 'pass3', 'pass5'] as const;
    metrics.forEach(metric => {
      const validResults = modelResults.filter(r => r[metric] !== null);
      if (validResults.length > 0) {
        baseResult[metric] = validResults.reduce((sum, r) => sum + r[metric]!, 0) / validResults.length;
      }
    });

    // Calculate difficulty-specific metrics
    // Easy difficulty
    const validEasyPass1Results = modelResults.filter(r => r.easyPass1 !== null);
    if (validEasyPass1Results.length > 0) {
      baseResult.easyPass1 = validEasyPass1Results.reduce((sum, r) => sum + r.easyPass1!, 0) / validEasyPass1Results.length;
    }
    
    const validEasyPass3Results = modelResults.filter(r => r.easyPass3 !== null);
    if (validEasyPass3Results.length > 0) {
      baseResult.easyPass3 = validEasyPass3Results.reduce((sum, r) => sum + r.easyPass3!, 0) / validEasyPass3Results.length;
    }
    
    const validEasyPass5Results = modelResults.filter(r => r.easyPass5 !== null);
    if (validEasyPass5Results.length > 0) {
      baseResult.easyPass5 = validEasyPass5Results.reduce((sum, r) => sum + r.easyPass5!, 0) / validEasyPass5Results.length;
    }
    
    // Medium difficulty
    const validMediumPass1Results = modelResults.filter(r => r.mediumPass1 !== null);
    if (validMediumPass1Results.length > 0) {
      baseResult.mediumPass1 = validMediumPass1Results.reduce((sum, r) => sum + r.mediumPass1!, 0) / validMediumPass1Results.length;
    }
    
    const validMediumPass3Results = modelResults.filter(r => r.mediumPass3 !== null);
    if (validMediumPass3Results.length > 0) {
      baseResult.mediumPass3 = validMediumPass3Results.reduce((sum, r) => sum + r.mediumPass3!, 0) / validMediumPass3Results.length;
    }
    
    const validMediumPass5Results = modelResults.filter(r => r.mediumPass5 !== null);
    if (validMediumPass5Results.length > 0) {
      baseResult.mediumPass5 = validMediumPass5Results.reduce((sum, r) => sum + r.mediumPass5!, 0) / validMediumPass5Results.length;
    }
    
    // Hard difficulty
    const validHardPass1Results = modelResults.filter(r => r.hardPass1 !== null);
    if (validHardPass1Results.length > 0) {
      baseResult.hardPass1 = validHardPass1Results.reduce((sum, r) => sum + r.hardPass1!, 0) / validHardPass1Results.length;
    }
    
    const validHardPass3Results = modelResults.filter(r => r.hardPass3 !== null);
    if (validHardPass3Results.length > 0) {
      baseResult.hardPass3 = validHardPass3Results.reduce((sum, r) => sum + r.hardPass3!, 0) / validHardPass3Results.length;
    }
    
    const validHardPass5Results = modelResults.filter(r => r.hardPass5 !== null);
    if (validHardPass5Results.length > 0) {
      baseResult.hardPass5 = validHardPass5Results.reduce((sum, r) => sum + r.hardPass5!, 0) / validHardPass5Results.length;
    }
    
    // Reset non-relevant metrics to null
    baseResult.codebleu = null;
    baseResult.llmjudge = null;
    baseResult.executionAccuracy = null;
    
    // Clear the original rank since it will be recalculated based on aggregated metrics
    baseResult.rank = 0;
    
    return baseResult;
  });
  
  // Sort by pass1 performance (descending) and assign new ranks
  const sortedResults = aggregatedResults.sort((a, b) => {
    const aValue = a.pass1 !== null ? a.pass1 : -Infinity;
    const bValue = b.pass1 !== null ? b.pass1 : -Infinity;
    return bValue - aValue; // descending order
  });
  
  // Assign new ranks based on sorted order
  sortedResults.forEach((result, index) => {
    result.rank = index + 1;
  });

  console.log('Completed processing', {
    totalResults: sortedResults.length
  });

  return sortedResults;
} 