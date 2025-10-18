import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// No model exclusions - process all models

// Simulate the data loading and processing that happens in the React app
// This will need to be adapted based on your actual data processing logic

// Load the combinations metadata
function loadCombinationMetadata() {
  const metadataPath = path.join(__dirname, '..', 'data', 'precomputed', 'combinations-metadata.json');
  
  if (!fs.existsSync(metadataPath)) {
    throw new Error('Combinations metadata not found. Please run generate-precomputed-results.js first.');
  }
  
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
}

// Helper function to read JSONL files
function readJSONL(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.trim().split('\n').map(line => JSON.parse(line));
  } catch (error) {
    console.error(`Error reading JSONL file ${filePath}:`, error.message);
    return [];
  }
}

// Helper function to read JSON files
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error.message);
    return {};
  }
}

// Load all data files for a specific task
function loadTaskData(task) {
  // Map task names to their directory names
  const taskDirMap = {
    'input prediction': 'input_prediction',
    'output prediction': 'output_prediction',
    'code generation': 'code-generation',
    'code translation': 'code-translation', 
    'code summarization': 'code-summarization',
    'code review': 'code-review',
    'vulnerability detection': 'vulnerability-detection',
    'multi-modality': 'multi-modality',
    'mr-web': 'mr-web',
    'interaction-2-code': 'interaction-2-code',
    'code-robustness': 'code-robustness',
    'unit test generation': 'unit_test_generation',
  };
  
  const taskDirName = taskDirMap[task] || task.replace(/\s+/g, '-');
  const taskDir = path.join(__dirname, '..', 'data', taskDirName);
  const allData = [];
  
  if (!fs.existsSync(taskDir)) {
    console.log(`No data directory found for task: ${task}`);
    return [];
  }
  
  try {
    const files = fs.readdirSync(taskDir);
    
    for (const file of files) {
      const filePath = path.join(taskDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        if (file.endsWith('.jsonl')) {
          const data = readJSONL(filePath);
          allData.push(...data);
        } else if (file.endsWith('.json') && !file.includes('backup')) {
          // Skip backup files to avoid duplicate model entries
          const data = readJSON(filePath);
          // Handle special case for vulnerability detection
          if (task === 'vulnerability detection' && typeof data === 'object' && !Array.isArray(data)) {
            // Convert the nested object structure to flat entries
            Object.entries(data).forEach(([modelName, modelData]) => {
              // Create separate entries for PrimeVul and PrimeVulPairs datasets
              if (modelData.primevul) {
                const primeVulEntry = {
                  model_name: modelName,
                  task: 'vulnerability detection',
                  dataset: 'PrimeVul',
                  metrics: {
                    accuracy: modelData.primevul.accuracy,
                    precision: modelData.primevul.precision,
                    recall: modelData.primevul.recall,
                    f1: modelData.primevul.f1
                  }
                };
                allData.push(primeVulEntry);
              }
              
              if (modelData.primevul_pair && Array.isArray(modelData.primevul_pair) && modelData.primevul_pair.length > 1) {
                const primeVulPairsEntry = {
                  model_name: modelName,
                  task: 'vulnerability detection',
                  dataset: 'PrimeVulPairs',
                  metrics: {
                    'P-C': modelData.primevul_pair[1]['P-C'],
                    'P-V': modelData.primevul_pair[1]['P-V'],
                    'P-B': modelData.primevul_pair[1]['P-B'],
                    'P-R': modelData.primevul_pair[1]['P-R']
                  }
                };
                allData.push(primeVulPairsEntry);
              }
            });
          } else if (Array.isArray(data)) {
            allData.push(...data);
          }
        }
      }
    }
    
    console.log(`Loaded ${allData.length} entries for ${task} from ${files.length} files`);
    return allData;
    
  } catch (error) {
    console.error(`Error loading data for task ${task}:`, error.message);
    return [];
  }
}

// Apply filters to raw data
function applyFilters(data, task, filters) {
  let filteredData = [...data];
  
  // Map task names to their data field names
  const taskFieldMap = {
    'input prediction': 'input_prediction',
    'output prediction': 'output_prediction',
    'code generation': 'code_generation',
    'code translation': 'code_translation', 
    'code summarization': 'code_summarization',
    'code review': 'code review',
    'vulnerability detection': 'vulnerability_detection',
    'code-web': 'code_web',
    'mr-web': 'mr-web',
    'interaction-2-code': 'interaction-2-code',
    'code-robustness': 'code-robustness'
  };
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const expectedTaskField = taskFieldMap[task] || task;
  
  // Apply dataset filter
  if (filters.dataset && filters.dataset.length > 0) {
    filteredData = filteredData.filter(entry => {
      const entryDataset = entry.dataset || '';
      return filters.dataset.some(filter => {
        // For vulnerability detection, use exact matching to avoid PrimeVul matching PrimeVulPairs
        if (task === 'vulnerability detection') {
          return entryDataset.toLowerCase() === filter.toLowerCase();
        }
        
        // For multi-modality, handle specific dataset mappings
        if (task === 'multi-modality') {
          return entryDataset.toLowerCase().includes(filter.toLowerCase()) ||
                 filter.toLowerCase().includes(entryDataset.toLowerCase()) ||
                 // Handle specific mappings for multi-modality
                 (filter === 'UI Code Edit' && entryDataset.toLowerCase() === 'ui code edit') ||
                 (filter === 'UICodeEdit' && entryDataset.toLowerCase() === 'ui code edit') ||
                 (filter === 'UI Code Generation' && entryDataset.toLowerCase() === 'ui code generation') ||
                 (filter === 'UICodeGeneration' && entryDataset.toLowerCase() === 'ui code generation') ||
                 (filter === 'UI Code Repair' && entryDataset.toLowerCase() === 'ui code repair') ||
                 (filter === 'UICodeRepair' && entryDataset.toLowerCase() === 'ui code repair');
        }
        
        // For other tasks, use partial matching as before
        return entryDataset.toLowerCase().includes(filter.toLowerCase()) ||
        filter.toLowerCase().includes(entryDataset.toLowerCase()) ||
        // Handle specific mappings
        (filter === 'HackerRank' && entryDataset.toLowerCase() === 'hackerrank') ||
               (filter === 'GeeksForGeeks' && entryDataset.toLowerCase() === 'geeksforgeeks');
      });
    });
  } else if (task === 'code-robustness') {
    // For code-robustness, when no specific dataset filter is applied, only use Merge-CRUXEval+CE for overall results
    filteredData = filteredData.filter(entry => {
      const entryDataset = entry.dataset || '';
      return entryDataset === 'Merge-CRUXEval+CE';
    });
  }
  
  // Apply modality filter (language)
  if (filters.modality && filters.modality.length > 0) {
    filteredData = filteredData.filter(entry => {
      // For code translation, check the modality field (e.g., "java->python")
      if (task === 'code translation' && entry.modality) {
        return filters.modality.some(filter => 
          entry.modality.toLowerCase() === filter.toLowerCase()
        );
      }
      
      // For other tasks, check the lang field
      const entryLang = entry.lang || '';
      return filters.modality.some(filter => 
        entryLang.toLowerCase() === filter.toLowerCase() ||
        (filter === 'CPP' && entryLang.toLowerCase() === 'cpp') ||
        (filter === 'C++' && entryLang.toLowerCase() === 'cpp') ||
        (filter === 'C#' && entryLang.toLowerCase() === 'csharp') ||
        (filter === 'Python' && entryLang.toLowerCase() === 'python') ||
        (filter === 'Java' && entryLang.toLowerCase() === 'java') ||
        (filter === 'JavaScript' && entryLang.toLowerCase() === 'javascript')
      );
    });
  }
  
  // Apply knowledge filter (for mr-web: task field, for others: difficulty or other fields)
  if (filters.knowledge && filters.knowledge.length > 0) {
    filteredData = filteredData.filter(entry => {
      if (task === 'mr-web') {
        // For mr-web, knowledge maps to the task field (Visual/RER)
        return filters.knowledge.includes(entry.task);
      } else if (task === 'input prediction' || task === 'output prediction') {
        // For input/output prediction, knowledge maps to the domain field
        // But ignore fake domain values like "geeksforgeeks" which aren't real domains
        const entryDomain = entry.domain || '';
        
        // Skip entries with fake domain values
        if (entryDomain.toLowerCase() === 'geeksforgeeks') {
          return false; // GeeksForGeeks data doesn't have real domain information
        }
        
        return filters.knowledge.some(filter => 
          entryDomain.toLowerCase().includes(filter.toLowerCase()) ||
          // Handle specific domain mappings based on actual HackerRank data
          (filter === 'Algorithms' && entryDomain.toLowerCase() === 'alg') ||
          (filter === 'DataStructures' && entryDomain.toLowerCase() === 'ds') ||
          (filter === 'Data Structures' && entryDomain.toLowerCase() === 'ds') ||
          (filter === 'Math' && entryDomain.toLowerCase() === 'math')
        );
      } else {
        // For other tasks, check various fields
        const entryKnowledge = entry.knowledge || entry.difficulty || '';
        return filters.knowledge.some(filter => 
          entryKnowledge.toLowerCase().includes(filter.toLowerCase())
        );
      }
    });
  }
  

  
  // Apply framework filter (for code-web and multi-modality)
  if (filters.framework && filters.framework.length > 0) {
    filteredData = filteredData.filter(entry => {
      const entryFramework = entry.framework || '';
      return filters.framework.some(filter => {
        // Case-insensitive comparison for multi-modality
        if (task === 'multi-modality') {
          return entryFramework.toLowerCase() === filter.toLowerCase();
        }
        // Exact matching for other tasks
        return filter === entryFramework;
      });
    });
  }
  
  return filteredData;
}

// Aggregate data by model and calculate metrics
function aggregateData(data, task, showByDifficulty) {
  const modelGroups = new Map();
  
  // Group by model using original names
  data.forEach(entry => {
    const modelName = entry.model_name;
    
    // Skip entries without model names
    if (!modelName) {
      return;
    }
    
    if (!modelGroups.has(modelName)) {
      modelGroups.set(modelName, []);
    }
    
    // Use the original entry without modification
    modelGroups.get(modelName).push(entry);
  });
  
  // Aggregate metrics for each model
  const results = [];
  let rank = 1;
  
  for (const [modelName, entries] of modelGroups.entries()) {
    const result = {
      rank: rank++,
      model: modelName,  // Keep for backwards compatibility with PrecomputedDataSource
      model_name: modelName,  // Use model_name field for consistency with main app
      model_url: getModelUrl(modelName)
    };
    
    // Calculate aggregated metrics based on task type
    if (task === 'mr-web') {
      // For mr-web, aggregate MAE, NEMD, CLIP, RER
      const metrics = ['MAE', 'NEMD', 'CLIP', 'RER'];
      metrics.forEach(metric => {
        const values = entries
          .map(e => e.metrics && e.metrics[metric])
          .filter(v => v !== undefined && v !== null);
        
        if (values.length > 0) {
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          // Format appropriately
          if (metric === 'MAE' || metric === 'NEMD') {
            result[metric] = avg.toFixed(3);
          } else {
            result[metric] = (avg * 100).toFixed(1); // Convert to percentage
          }
        } else {
          result[metric] = '-';
        }
      });
    } else if (task === 'vulnerability detection') {
      // For vulnerability detection, merge metrics from different datasets
      let primeVulEntry = null;
      let primeVulPairsEntry = null;
      
      // Find entries from different datasets
      entries.forEach(entry => {
        if (entry.dataset === 'PrimeVul') {
          primeVulEntry = entry;
        } else if (entry.dataset === 'PrimeVulPairs') {
          primeVulPairsEntry = entry;
        }
      });
      
      // Initialize all metrics to '-'
      result['Accuracy'] = '-';
      result['Precision'] = '-';
      result['Recall'] = '-';
      result['F1 Score'] = '-';
      result['P-C'] = '-';
      result['P-V'] = '-';
      result['P-B'] = '-';
      result['P-R'] = '-';
      
      // Get accuracy metrics from PrimeVul entry
      if (primeVulEntry && primeVulEntry.metrics) {
        if (primeVulEntry.metrics.accuracy !== undefined) {
          result['Accuracy'] = (primeVulEntry.metrics.accuracy * 100).toFixed(1);
        }
        if (primeVulEntry.metrics.precision !== undefined) {
          result['Precision'] = (primeVulEntry.metrics.precision * 100).toFixed(1);
        }
        if (primeVulEntry.metrics.recall !== undefined) {
          result['Recall'] = (primeVulEntry.metrics.recall * 100).toFixed(1);
          }
        if (primeVulEntry.metrics.f1 !== undefined) {
          result['F1 Score'] = (primeVulEntry.metrics.f1 * 100).toFixed(1);
        }
      }
      
      // Get P-metrics from PrimeVulPairs entry
      if (primeVulPairsEntry && primeVulPairsEntry.metrics) {
        if (primeVulPairsEntry.metrics['P-C'] !== undefined) {
          result['P-C'] = (primeVulPairsEntry.metrics['P-C'] * 100).toFixed(1);
        }
        if (primeVulPairsEntry.metrics['P-V'] !== undefined) {
          result['P-V'] = (primeVulPairsEntry.metrics['P-V'] * 100).toFixed(1);
        }
        if (primeVulPairsEntry.metrics['P-B'] !== undefined) {
          result['P-B'] = (primeVulPairsEntry.metrics['P-B'] * 100).toFixed(1);
        }
        if (primeVulPairsEntry.metrics['P-R'] !== undefined) {
          result['P-R'] = (primeVulPairsEntry.metrics['P-R'] * 100).toFixed(1);
        }
      }
    } else if (task === 'code review') {
      // For code review, use LLM Judge scores
      // Metrics looks like {"gpt-4o": [2], "claude": [1], ...}
      const allScores = [];
      
      entries.forEach(entry => {
        if (entry.metrics) {
          Object.values(entry.metrics).forEach(scoreArray => {
            if (Array.isArray(scoreArray)) {
              allScores.push(...scoreArray);
            } else if (typeof scoreArray === 'number') {
              allScores.push(scoreArray);
            }
          });
        }
      });
      
      if (allScores.length > 0) {
        const avgScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
        result['LLM Judge'] = (avgScore * 20).toFixed(1); // Convert to percentage (5-point scale)
      } else {
        result['LLM Judge'] = '-';
      }
    } else if (task === 'code-summarization' || task === 'code summarization') {
      // For code summarization, use LLM Judge scores
      // Metrics looks like {"LLMJudge": {"gpt-4o-2024-11-20": 4}}
      const allScores = [];
      
      entries.forEach(entry => {
        if (entry.metrics && entry.metrics.LLMJudge) {
          Object.values(entry.metrics.LLMJudge).forEach(score => {
            if (typeof score === 'number') {
              allScores.push(score);
            }
          });
        }
      });
      
      if (allScores.length > 0) {
        const avgScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
        result['LLM Judge'] = (avgScore * 20).toFixed(1); // Convert to percentage (5-point scale)
      } else {
        result['LLM Judge'] = '-';
      }
    } else if (task === 'code-robustness') {
      // For code robustness, use specific robustness metrics
      const robustnessMetrics = ['Vanilla', 'PSC-ALL', 'MCC', 'MPS', 'MHC', 'Average'];
      
      robustnessMetrics.forEach(metric => {
        const values = entries
          .map(e => e.metrics && e.metrics[metric])
          .filter(v => v !== undefined && v !== null);
        
        if (values.length > 0) {
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          result[metric] = avg.toFixed(1);
        } else {
          result[metric] = '-';
        }
      });
    } else if (task === 'multi-modality') {
      // For multi-modality, use MLLM Score, CMS, CLIP, and Compilation metrics
      // Metrics looks like {"MLLM Score": 7.6944, "CMS": 0.4213, "Compilation": 0.9722} or {"CLIP": 0.8385, "Compilation": 0.9908}
      const modalityMetrics = ['MLLM Score', 'CMS', 'CLIP', 'Compilation'];
      
      modalityMetrics.forEach(metric => {
        const values = entries
          .map(e => {
            if (e.metrics && e.metrics[metric] !== undefined && e.metrics[metric] !== null) {
              // Handle special case for Compilation values that might be formatted as strings like "1.00"
              if (metric === 'Compilation' && typeof e.metrics[metric] === 'string') {
                return parseFloat(e.metrics[metric]);
              }
              return e.metrics[metric];
            }
            return undefined;
          })
          .filter(v => v !== undefined && v !== null);
        
        if (values.length > 0) {
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          if (metric === 'MLLM Score') {
            result[metric] = avg.toFixed(2); // MLLM Score with 2 decimal places
          } else if (metric === 'CMS') {
            result[metric] = avg.toFixed(3); // CMS with 3 decimal places
          } else if (metric === 'CLIP') {
            result[metric] = avg.toFixed(3); // CLIP with 3 decimal places
          } else if (metric === 'Compilation') {
            // Parse Compilation values which might be in formats like "1.00" or "0.9722"
            // Ensure we're treating them as proper numbers before calculating
            result[metric] = (avg * 100).toFixed(1); // Compilation as percentage
          }
        } else {
          result[metric] = '-';
        }
      });
    } else if (task === 'unit test generation') {
      // For unit test generation, aggregate CSR, line coverage, and branch coverage
      const csrValues = entries
        .map(e => e.csr)
        .filter(v => v !== undefined && v !== null);
      
      const lineCoverageValues = entries
        .map(e => e.line_coverage)
        .filter(v => v !== undefined && v !== null);
      
      const branchCoverageValues = entries
        .map(e => e.branch_coverage)
        .filter(v => v !== undefined && v !== null);
      
      if (csrValues.length > 0) {
        const avgCsr = csrValues.reduce((sum, val) => sum + val, 0) / csrValues.length;
        // Convert from 0-1 scale to 0-100 scale and round to 1 decimal place
        result['csr'] = (avgCsr * 100).toFixed(1);
      } else {
        result['csr'] = '-';
      }
      
      if (lineCoverageValues.length > 0) {
        const avgLineCoverage = lineCoverageValues.reduce((sum, val) => sum + val, 0) / lineCoverageValues.length;
        result['line_coverage'] = avgLineCoverage.toFixed(2);
      } else {
        result['line_coverage'] = '-';
      }
      
      if (branchCoverageValues.length > 0) {
        const avgBranchCoverage = branchCoverageValues.reduce((sum, val) => sum + val, 0) / branchCoverageValues.length;
        result['branch_coverage'] = avgBranchCoverage.toFixed(2);
      } else {
        result['branch_coverage'] = '-';
      }
      
      // Add dataset and language information for consistency
      if (entries.length > 0) {
        result['dataset'] = entries[0].dataset || 'symprompt';
        result['lang'] = entries[0].lang || 'python';
        result['task'] = 'unit_test_generation';
      }
    } else {
      // For other tasks (code generation, input/output prediction, etc.), aggregate pass rates
      if (showByDifficulty) {
        // Calculate difficulty-based metrics
        const difficulties = ['Easy', 'Medium', 'Hard'];
        const passMetrics = ['pass@1', 'pass@3', 'pass@5'];
        
        difficulties.forEach(difficulty => {
          const difficultyEntries = entries.filter(e => e.difficulty === difficulty);
          
          passMetrics.forEach(metric => {
            const values = difficultyEntries
              .map(e => e.metrics && e.metrics[metric])
              .filter(v => v !== undefined && v !== null);
            
            if (values.length > 0) {
              const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
              const key = `${difficulty.toLowerCase()}_${metric}`;
              result[key] = (avg * 100).toFixed(1);
            } else {
              result[`${difficulty.toLowerCase()}_${metric}`] = '-';
            }
          });
        });
      } else {
        // Calculate overall metrics
        const passMetrics = ['pass@1', 'pass@3', 'pass@5'];
        
        passMetrics.forEach(metric => {
          const values = entries
            .map(e => e.metrics && e.metrics[metric])
            .filter(v => v !== undefined && v !== null);
          
          if (values.length > 0) {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            result[metric] = (avg * 100).toFixed(1);
          } else {
            result[metric] = '-';
          }
        });
        
        // For input/output prediction, if pass@3 and pass@5 don't exist, set them to '-'
        if (task === 'input prediction' || task === 'output prediction') {
          if (result['pass@3'] === undefined || result['pass@3'] === '-') result['pass@3'] = '-';
          if (result['pass@5'] === undefined || result['pass@5'] === '-') result['pass@5'] = '-';
        }
        
        // Add CodeBLEU for translation tasks
        if (task === 'code translation') {
          const codebleuValues = entries
            .map(e => e.metrics && e.metrics.codebleu)
            .filter(v => v !== undefined && v !== null);
          
          if (codebleuValues.length > 0) {
            const avg = codebleuValues.reduce((sum, val) => sum + val, 0) / codebleuValues.length;
            result['CodeBLEU'] = (avg * 100).toFixed(1);
          } else {
            result['CodeBLEU'] = '-';
          }
        }
      }
    }
    
    results.push(result);
  }
  
  // Sort by primary metric
  results.sort((a, b) => {
    let aValue, bValue;
    
    if (task === 'mr-web') {
      // Sort by CLIP score for MR-Web
      aValue = parseFloat(a.CLIP) || -Infinity;
      bValue = parseFloat(b.CLIP) || -Infinity;
    } else if (task === 'vulnerability detection') {
      // Sort by F1 Score for vulnerability detection
      aValue = parseFloat(a['F1 Score']) || -Infinity;
      bValue = parseFloat(b['F1 Score']) || -Infinity;
    } else if (task === 'code review' || task === 'code-summarization' || task === 'code summarization') {
      // Sort by LLM Judge for code review and code summarization
      aValue = parseFloat(a['LLM Judge']) || -Infinity;
      bValue = parseFloat(b['LLM Judge']) || -Infinity;
    } else if (task === 'code-robustness') {
      // Sort by Average metric for code robustness
      aValue = parseFloat(a['Average']) || -Infinity;
      bValue = parseFloat(b['Average']) || -Infinity;
    } else if (task === 'code-web') {
      // Sort by CLIP for code-web
      aValue = parseFloat(a['CLIP']) || -Infinity;
      bValue = parseFloat(b['CLIP']) || -Infinity;
    } else if (task === 'interaction-2-code') {
      // Sort by CLIP for interaction-2-code
      aValue = parseFloat(a['CLIP']) || -Infinity;
      bValue = parseFloat(b['CLIP']) || -Infinity;
    } else if (task === 'unit test generation') {
      // Sort by CSR for unit test generation
      aValue = parseFloat(a['csr']) || -Infinity;
      bValue = parseFloat(b['csr']) || -Infinity;
    } else if (showByDifficulty) {
      // Sort by easy_pass@1 for difficulty mode
      aValue = parseFloat(a['easy_pass@1']) || -Infinity;
      bValue = parseFloat(b['easy_pass@1']) || -Infinity;
    } else {
      // Sort by pass@1 for regular mode
      aValue = parseFloat(a['pass@1']) || -Infinity;
      bValue = parseFloat(b['pass@1']) || -Infinity;
    }
    
    return bValue - aValue; // Descending order
  });
  
  // Update ranks
  results.forEach((result, index) => {
    result.rank = index + 1;
  });
  
  return results;
}

// Get model URL (simplified version)
function getModelUrl(modelName) {
  const urlMap = {
    'GPT-4o': 'https://openai.com/research/gpt-4',
    'GPT-4o-2024-11-20': 'https://openai.com/research/gpt-4',
    'Claude-Sonnet-4': 'https://anthropic.com',
    'Claude-3.5-Sonnet': 'https://anthropic.com',
    'Gemini-2.0-Pro': 'https://deepmind.google/technologies/gemini/',
  };
  
  return urlMap[modelName] || '';
}

// Helper function to convert TypeScript modules to Node.js compatible code
// function createFilterOptions(task, filters, showByDifficulty) {
//   return {
//     tasks: [task],
//     datasets: filters.dataset || [],
//     langs: filters.modality || [],
//     modalities: filters.modality || [],
//     knowledge: filters.knowledge || [],
//     reasoning: filters.reasoning || [],
//     robustness: filters.robustness || [],
//     security: filters.privacy || [],
//     llmJudges: filters.llmJudges || [],
//     framework: filters.framework || [],
//     showByDifficulty: showByDifficulty
//   };
// }

// Main data processing function using real data
async function processTaskData(task, filters, showByDifficulty) {
  console.log(`Processing ${task} with filters:`, filters, `difficulty: ${showByDifficulty}`);
  
  try {
    // Load actual data for the task
    const rawData = loadTaskData(task);
    
    if (rawData.length === 0) {
      console.log(`  -> No data found for ${task}`);
      return [];
    }
    
    // Apply filters
    const filteredData = applyFilters(rawData, task, filters);
    console.log(`  -> Filtered from ${rawData.length} to ${filteredData.length} entries`);
    
    if (filteredData.length === 0) {
      console.log(`  -> No data remaining after filtering`);
      return [];
    }
    
    // Aggregate and format results
    const results = aggregateData(filteredData, task, showByDifficulty);
    console.log(`  -> Generated ${results.length} results for ${task}`);
    
    return results;
    
  } catch (error) {
    console.error(`Error processing ${task}:`, error);
    return [];
  }
}

// Process a single combination and save the result
async function processCombination(task, combination) {
  try {
    console.log(`\nProcessing: ${combination.filename}`);
    
    // Process the data
    const results = await processTaskData(task, combination.filters, combination.showByDifficulty);
    
    // Create the output structure
    const output = {
      task: task,
      filters: combination.filters,
      showByDifficulty: combination.showByDifficulty,
      generatedAt: new Date().toISOString(),
      results: results,
      metadata: {
        totalResults: results.length,
        hasResults: results.length > 0
      }
    };
    
    // Save to file
    const taskDir = path.join(__dirname, '..', 'data', 'precomputed', task.replace(/\s+/g, '-'));
    
    // Ensure the task directory exists
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    
    const filePath = path.join(taskDir, combination.filename);
    
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    console.log(`  -> Saved: ${filePath}`);
    
    return true;
  } catch (error) {
    console.error(`Error processing combination ${combination.filename}:`, error);
    return false;
  }
}

// Process all combinations for a specific task
async function processTaskCombinations(task, combinations) {
  console.log(`\n=== Processing ${task} (${combinations.length} combinations) ===`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const combination of combinations) {
    const success = await processCombination(task, combination);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
  }
  
  console.log(`\n${task} completed: ${successCount} successful, ${errorCount} errors`);
  return { successCount, errorCount };
}

// Process all combinations for all tasks
async function processAllCombinations() {
  try {
    console.log('Loading combination metadata...');
    const metadata = loadCombinationMetadata();
    
    let totalSuccess = 0;
    let totalErrors = 0;
    
    // Process each task
    for (const [task, taskData] of Object.entries(metadata.tasks)) {
      const result = await processTaskCombinations(task, taskData.combinations);
      totalSuccess += result.successCount;
      totalErrors += result.errorCount;
    }
    
    console.log('\n=== FINAL SUMMARY ===');
    console.log(`Total processed: ${totalSuccess + totalErrors}`);
    console.log(`Successful: ${totalSuccess}`);
    console.log(`Errors: ${totalErrors}`);
    
    if (totalErrors === 0) {
      console.log('\n✅ All combinations processed successfully!');
    } else {
      console.log(`\n⚠️  ${totalErrors} combinations had errors. Check the logs above.`);
    }
    
  } catch (error) {
    console.error('Error processing combinations:', error);
    process.exit(1);
  }
}

// Generate an index file for quick lookup
function generateIndex() {
  try {
    const metadata = loadCombinationMetadata();
    const index = {
      generatedAt: new Date().toISOString(),
      tasks: {}
    };
    
    Object.keys(metadata.tasks).forEach(task => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const taskDir = path.join(__dirname, '..', 'data', 'precomputed', task.replace(/\s+/g, '-'));
      
      index.tasks[task] = {
        totalCombinations: metadata.tasks[task].totalCombinations,
        files: metadata.tasks[task].combinations.map(combo => ({
          filename: combo.filename,
          filters: combo.filters,
          showByDifficulty: combo.showByDifficulty,
          path: path.join('data', 'precomputed', task.replace(/\s+/g, '-'), combo.filename)
        }))
      };
    });
    
    const indexPath = path.join(__dirname, '..', 'data', 'precomputed', 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    
    console.log(`\nGenerated index file: ${indexPath}`);
    
  } catch (error) {
    console.error('Error generating index:', error);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node process-precomputed-data.js [options]

Options:
  --task <taskname>     Process only the specified task
  --dry-run            Show what would be processed without actually processing
  --index-only         Generate only the index file
  --help, -h           Show this help message

Examples:
  node process-precomputed-data.js                    # Process all combinations
  node process-precomputed-data.js --task "code generation"  # Process only code generation
  node process-precomputed-data.js --index-only       # Generate index only
  node process-precomputed-data.js --dry-run          # Show what would be processed
`);
    return;
  }
  
  if (args.includes('--index-only')) {
    generateIndex();
    return;
  }
  
  if (args.includes('--dry-run')) {
    console.log('DRY RUN - showing what would be processed...\n');
    const metadata = loadCombinationMetadata();
    
    Object.entries(metadata.tasks).forEach(([task, taskData]) => {
      console.log(`${task}: ${taskData.totalCombinations} combinations`);
      taskData.combinations.slice(0, 3).forEach(combo => {
        console.log(`  - ${combo.filename}`);
      });
      if (taskData.combinations.length > 3) {
        console.log(`  ... and ${taskData.combinations.length - 3} more`);
      }
    });
    return;
  }
  
  const taskArg = args.indexOf('--task');
  if (taskArg !== -1 && taskArg + 1 < args.length) {
    const targetTask = args[taskArg + 1];
    console.log(`Processing only task: ${targetTask}`);
    
    const metadata = loadCombinationMetadata();
    if (!metadata.tasks[targetTask]) {
      console.error(`Task "${targetTask}" not found. Available tasks: ${Object.keys(metadata.tasks).join(', ')}`);
      process.exit(1);
    }
    
    await processTaskCombinations(targetTask, metadata.tasks[targetTask].combinations);
    generateIndex();
  } else {
    await processAllCombinations();
    generateIndex();
  }
}

// Run the main function
main();

export {
  processTaskData,
  processCombination,
  processTaskCombinations,
  processAllCombinations,
  generateIndex
}; 