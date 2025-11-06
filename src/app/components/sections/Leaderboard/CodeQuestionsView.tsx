import { FC, useState, useEffect, useCallback } from 'react';
import { TaskType, ProcessedResult, Ability } from '@/lib/types';
import { CodeHighlighter as ModernCodeHighlighter } from '@/app/components/ui/CodeHighlighter';

interface CodeQuestionsViewProps {
  currentTask: TaskType;
  results: ProcessedResult[];
  isDarkMode: boolean;
  selectedAbilities: Ability;
}

interface CodeQuestionData {
  id?: number;
  prompt_id: number;
  question_key?: string; // For unit test generation
  ref_key?: string; // For unit test generation
  task?: string; // For unit test generation
  dataset: string;
  modality?: string; // Optional for some tasks
  lang?: string; // For code generation and unit test generation
  wrapped_text: string;
  models: Record<string, {
    parsed_code: string | number; // Can be string (most tasks) or number (vulnerability detection)
    metric?: number; // Single metric (code translation)
    metrics?: { // Multi-field metrics (unit test generation, code generation)
      [key: string]: number;
    };
  }>;
}

// Helper function to get the primary metric value and name from model data
const getPrimaryMetric = (modelData: { metric?: number; metrics?: { [key: string]: number | { [key: string]: number } } }): { value: number; name: string } => {
  if (modelData.metric !== undefined) {
    return { value: modelData.metric, name: 'Score' };
  }
  if (modelData.metrics) {
    // For unit test generation, prioritize csr, then line_coverage
    if (modelData.metrics.csr !== undefined) return { value: modelData.metrics.csr as number, name: 'CSR' };
    if (modelData.metrics.line_coverage !== undefined) return { value: modelData.metrics.line_coverage as number, name: 'Line Coverage' };
    // For code generation and input/output prediction, use pass@1
    if (modelData.metrics['pass@1'] !== undefined) return { value: modelData.metrics['pass@1'] as number, name: 'Pass@1' };
    // For vulnerability detection, use accuracy
    if (modelData.metrics.accuracy !== undefined) return { value: modelData.metrics.accuracy as number, name: 'Accuracy' };
    // For code review and code summarization, handle LLMJudge nested metrics - show original score
    if (modelData.metrics.LLMJudge && typeof modelData.metrics.LLMJudge === 'object') {
      const llmJudgeMetrics = modelData.metrics.LLMJudge as { [key: string]: number };
      const judgeKeys = Object.keys(llmJudgeMetrics);
      if (judgeKeys.length > 0) {
        // Return original LLMJudge score (don't normalize)
        const rawScore = llmJudgeMetrics[judgeKeys[0]];
        return { value: rawScore, name: 'LLM Judge' };
      }
    }
    // Return the first available metric
    const firstKey = Object.keys(modelData.metrics)[0];
    const firstValue = modelData.metrics[firstKey];
    if (typeof firstValue === 'number') {
      return { value: firstValue, name: firstKey };
    }
  }
  return { value: 0, name: 'Score' };
};

// Modern syntax highlighter component using react-syntax-highlighter
const CodeHighlighter: FC<{
  code: string;
  language?: string;
  isDarkMode: boolean;
  customStyle?: React.CSSProperties;
  className?: string;
}> = ({ code, language, isDarkMode, customStyle, className }) => {
  return (
    <ModernCodeHighlighter
      code={code}
      language={language}
      isDarkMode={isDarkMode}
      customStyle={{
        padding: '16px',
        borderRadius: '8px',
        fontSize: '16px',
        lineHeight: '1.5',
        overflow: 'auto',
        ...customStyle
      }}
      className={className}
      showLineNumbers={false}
    />
  );
};

// Helper function to get language for syntax highlighting
const getLanguageForHighlighting = (question: CodeQuestionData, isSource: boolean = false): string => {
  // For code translation, use modality
  if (question.modality) {
    if (isSource) {
      return getSourceLanguageFromModality(question.modality);
    } else {
      return getLanguageFromModality(question.modality);
    }
  }
  
  // For other tasks, use lang field or infer from dataset
  if (question.lang) {
    return question.lang;
  }
  
  // Default fallback - let highlight.js auto-detect
  return '';
};

// Helper function to determine the target language from modality string
const getLanguageFromModality = (modality: string): string => {
  if (modality.includes('->python')) return 'python';
  if (modality.includes('->java')) return 'java';
  if (modality.includes('->javascript') || modality.includes('->js')) return 'javascript';
  if (modality.includes('->typescript') || modality.includes('->ts')) return 'typescript';
  if (modality.includes('->c++') || modality.includes('->cpp')) return 'cpp';
  if (modality.includes('->c#') || modality.includes('->csharp')) return 'csharp';
  if (modality.includes('->go')) return 'go';
  if (modality.includes('->rust')) return 'rust';
  if (modality.includes('->ruby')) return 'ruby';
  if (modality.includes('->php')) return 'php';
  return 'text'; // Default fallback
};

// Helper function to determine the source language from modality string
const getSourceLanguageFromModality = (modality: string): string => {
  if (modality.startsWith('python->')) return 'python';
  if (modality.startsWith('java->')) return 'java';
  if (modality.startsWith('javascript->') || modality.startsWith('js->')) return 'javascript';
  if (modality.startsWith('typescript->') || modality.startsWith('ts->')) return 'typescript';
  if (modality.startsWith('c++->') || modality.startsWith('cpp->')) return 'cpp';
  if (modality.startsWith('c#->') || modality.startsWith('csharp->')) return 'csharp';
  if (modality.startsWith('go->')) return 'go';
  if (modality.startsWith('rust->')) return 'rust';
  if (modality.startsWith('ruby->')) return 'ruby';
  if (modality.startsWith('php->')) return 'php';
  return 'text'; // Default fallback
};

// Utility function to get performance-based colors
const getPerformanceColors = (metric: number, min: number, max: number, isDarkMode: boolean) => {
  // Handle edge case where min equals max (avoid division by zero)
  let normalizedScore: number;
  if (max === min) {
    // If all values are the same, treat as perfect score if metric is 1.0, otherwise as middle score
    normalizedScore = metric >= 1.0 ? 1.0 : 0.5;
  } else {
    // Normalize the metric to 0-1 range
    normalizedScore = Math.max(0, Math.min(1, (metric - min) / (max - min)));
  }
  
  // Calculate red and green components
  const red = Math.round(255 * (1 - normalizedScore));
  const green = Math.round(255 * normalizedScore);
  
  // Create background color with appropriate opacity for readability
  const backgroundOpacity = isDarkMode ? 0.15 : 0.08;
  const backgroundColor = `rgba(${red}, ${green}, 0, ${backgroundOpacity})`;
  
  // Create badge color with higher opacity
  const badgeColor = normalizedScore >= 0.8 ? '#10b981' : normalizedScore >= 0.5 ? '#f59e0b' : '#ef4444';
  
  return {
    backgroundColor,
    badgeColor
  };
};

const CodeQuestionsView: FC<CodeQuestionsViewProps> = ({
  currentTask,
  results,
  isDarkMode,
  selectedAbilities
}) => {
  const [questionData, setQuestionData] = useState<CodeQuestionData[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<number>(0);
  const [selectedModels, setSelectedModels] = useState<[string, string]>(['', '']); // Two models for side-by-side comparison
  const [isLoading, setIsLoading] = useState(true);

  // Function to filter and randomly select questions
  const filterAndSelectQuestions = useCallback((data: CodeQuestionData[]) => {
    // Filtering questions based on current criteria
    
    // Apply filtering based on selected abilities
    let filteredData = data;
    
    // Filter by dataset
    if (selectedAbilities.dataset && selectedAbilities.dataset.length > 0) {
      filteredData = filteredData.filter((item: CodeQuestionData) => {
        const itemDataset = item.dataset.toLowerCase();
        return selectedAbilities.dataset!.some(dataset => {
          const normalizedDataset = dataset.toLowerCase();
          
          // Handle dataset name mappings between UI and data
          if (normalizedDataset === 'primevulpairs') {
            return itemDataset === 'primevul_pair';
          }
          if (normalizedDataset === 'primevul') {
            return itemDataset === 'primevul';
          }
          
          // Handle other existing mappings
          return normalizedDataset === itemDataset || 
                 (normalizedDataset === 'polyhumaneval' && itemDataset === 'polyhumaneval') ||
                 (normalizedDataset === 'hackerrank' && itemDataset === 'hackerrank') ||
                 (normalizedDataset === 'geeksforgeeks' && itemDataset === 'geeksforgeeks') ||
                 (normalizedDataset === 'symprompt' && itemDataset === 'symprompt');
        });
      });
      // Dataset filter applied
    }
    
    // Filter by modality (only for code translation)
    if ((currentTask as string) === 'code translation' && selectedAbilities.modality && selectedAbilities.modality.length > 0) {
      filteredData = filteredData.filter((item: CodeQuestionData) => {
        return selectedAbilities.modality!.some(modality => 
          item.modality === modality
        );
      });
      // Modality filter applied
    }
    
    // Filter by language (for code generation, unit test generation, code review, code summarization, input/output prediction)
    if (((currentTask as string) === 'code generation' || 
         (currentTask as string) === 'unit test generation' ||
         (currentTask as string) === 'code review' ||
         (currentTask as string) === 'code summarization' ||
         (currentTask as string) === 'input prediction' ||
         (currentTask as string) === 'output prediction') && 
        selectedAbilities.modality && selectedAbilities.modality.length > 0) {
      filteredData = filteredData.filter((item: CodeQuestionData) => {
        return selectedAbilities.modality!.some(lang => {
          const normalizedLang = lang.toLowerCase();
          const itemLang = item.lang?.toLowerCase();
          
          // Handle language name mappings between UI and data
          if (normalizedLang === 'c#') {
            return itemLang === 'csharp';
          }
          if (normalizedLang === 'c++' || normalizedLang === 'cpp') {
            return itemLang === 'cpp';
          }
          if (normalizedLang === 'javascript') {
            return itemLang === 'javascript';
          }
          if (normalizedLang === 'typescript') {
            return itemLang === 'typescript';
          }
          
          // Default case: direct comparison
          return itemLang === normalizedLang;
        });
      });
      // Language filter applied
    }
    
    // Filter by LLMJudge (for code review and code summarization)
    if (((currentTask as string) === 'code review' || (currentTask as string) === 'code summarization') && 
        selectedAbilities.llmJudges && selectedAbilities.llmJudges.length > 0) {
      filteredData = filteredData.filter((item: CodeQuestionData) => {
        // Check if any model in this question has responses from the selected LLM judges
        return Object.values(item.models || {}).some(modelData => {
          if (modelData.metrics && modelData.metrics.LLMJudge && typeof modelData.metrics.LLMJudge === 'object') {
            const llmJudgeMetrics = modelData.metrics.LLMJudge as { [key: string]: number };
            return selectedAbilities.llmJudges!.some(judge => 
              llmJudgeMetrics[judge] !== undefined
            );
          }
          return false;
        });
      });
      // LLM Judge filter applied
    }
    
    // If no data matches filters, return empty array
    if (filteredData.length === 0) {
      // No questions match current filters
      return [];
    }
    
    // Randomly select 10 questions from filtered data
    const shuffled = [...filteredData].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));
    
    // Random questions selected from filtered data
    
    return selected;
  }, [selectedAbilities.dataset, selectedAbilities.modality, selectedAbilities.llmJudges, currentTask]);

  useEffect(() => {
    const loadQuestionData = async () => {
      // Check if current task supports code view
      const supportedTasks = [
        'code translation', 
        'code generation', 
        'unit test generation',
        'code review',
        'code summarization', 
        'input prediction',
        'output prediction',
        'vulnerability detection'
      ];
      if (!supportedTasks.includes(currentTask)) {
        setIsLoading(false);
        return;
      }

      try {
        let dataUrl = '';
        let dataProcessor: (data: unknown) => CodeQuestionData[] = (data) => data as CodeQuestionData[];

        // Determine the data source and processor based on task
        if (currentTask === 'code translation') {
          dataUrl = '/data/code-example/code-translation/example_data.json';
        } else if (currentTask === 'code generation') {
          dataUrl = '/data/code-example/code-generation/combined_data.json';
          dataProcessor = (data) => {
            // Convert the nested structure to flat array
            const flatData: CodeQuestionData[] = [];
            const dataObj = data as Record<string, unknown[]>;
            Object.keys(dataObj).forEach(dataset => {
              if (Array.isArray(dataObj[dataset])) {
                dataObj[dataset].forEach((item: unknown) => {
                  const typedItem = item as Record<string, unknown>;
                  flatData.push({
                    ...typedItem,
                    dataset: dataset,
                    lang: (typedItem.modality as string)?.toLowerCase() || (typedItem.lang as string) // Normalize language field
                  } as CodeQuestionData);
                });
              }
            });
            return flatData;
          };
        } else if (currentTask === 'unit test generation') {
          dataUrl = '/data/code-example/unit-test-generation/combined_data.json';
          dataProcessor = (data) => {
            // Unit test generation data is already in flat array format
            return Array.isArray(data) ? data as CodeQuestionData[] : [];
          };
        } else if (currentTask === 'code review') {
          dataUrl = '/data/code-example/code-review/combined_data.json';
          dataProcessor = (data) => {
            // Code review data is already in flat array format
            return Array.isArray(data) ? data as CodeQuestionData[] : [];
          };
        } else if (currentTask === 'code summarization') {
          dataUrl = '/data/code-example/code-summarization/combined_data.json';
          dataProcessor = (data) => {
            // Code summarization data is already in flat array format
            return Array.isArray(data) ? data as CodeQuestionData[] : [];
          };
        } else if (currentTask === 'input prediction') {
          dataUrl = '/data/code-example/input-prediction/combined_data.json';
          dataProcessor = (data) => {
            // Convert the nested structure to flat array
            const flatData: CodeQuestionData[] = [];
            const dataObj = data as Record<string, unknown[]>;
            Object.keys(dataObj).forEach(dataset => {
              if (Array.isArray(dataObj[dataset])) {
                dataObj[dataset].forEach((item: unknown) => {
                  const typedItem = item as Record<string, unknown>;
                  flatData.push({
                    ...typedItem,
                    dataset: dataset,
                    lang: typedItem.lang as string // Use existing lang field
                  } as CodeQuestionData);
                });
              }
            });
            return flatData;
          };
        } else if (currentTask === 'output prediction') {
          dataUrl = '/data/code-example/output-prediction/combined_data.json';
          dataProcessor = (data) => {
            // Convert the nested structure to flat array
            const flatData: CodeQuestionData[] = [];
            const dataObj = data as Record<string, unknown[]>;
            Object.keys(dataObj).forEach(dataset => {
              if (Array.isArray(dataObj[dataset])) {
                dataObj[dataset].forEach((item: unknown) => {
                  const typedItem = item as Record<string, unknown>;
                  flatData.push({
                    ...typedItem,
                    dataset: dataset,
                    lang: typedItem.lang as string // Use existing lang field
                  } as CodeQuestionData);
                });
              }
            });
            return flatData;
          };
        } else if (currentTask === 'vulnerability detection') {
          dataUrl = '/data/code-example/vulnerability-detection/combined_data.json';
          dataProcessor = (data) => {
            // Vulnerability detection data is already in flat array format
            return Array.isArray(data) ? data as CodeQuestionData[] : [];
          };
        } else {
          setIsLoading(false);
          return;
        }

        const response = await fetch(dataUrl);
        if (!response.ok) {
          throw new Error(`Failed to load question data for ${currentTask}`);
        }
        const rawData = await response.json();
        const processedData = dataProcessor(rawData);
        
        const selectedQuestions = filterAndSelectQuestions(processedData);
        setQuestionData(selectedQuestions);
        setSelectedQuestion(0); // Reset to first question when data changes
        setIsLoading(false);
      } catch {
        // Error loading question data
        setIsLoading(false);
      }
    };

    loadQuestionData();
  }, [currentTask, selectedAbilities.dataset, selectedAbilities.modality, selectedAbilities.llmJudges, filterAndSelectQuestions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
            Loading code questions...
          </span>
        </div>
      </div>
    );
  }

  // Check if current task is supported for code view
  const supportedTasks = [
    'code translation', 
    'code generation', 
    'unit test generation',
    'code review',
    'code summarization', 
    'input prediction',
    'output prediction',
    'vulnerability detection'
  ];
  if (!supportedTasks.includes(currentTask)) {
    return (
      <div className="flex items-center justify-center p-8">
        <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          Code questions view is not yet available for this task.
        </span>
      </div>
    );
  }

  if (questionData.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            No questions match the current filter criteria.
          </span>
          <br />
          <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af', fontSize: '0.875rem' }}>
            Try adjusting your dataset or modality filters to see more questions.
          </span>
        </div>
      </div>
    );
  }

  const currentQuestion = questionData[selectedQuestion];
  
  // Safety check for current question
  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '1.125rem' }}>
            No question data available.
          </span>
        </div>
      </div>
    );
  }
  
  // Debug logging for vulnerability detection
  if ((currentTask as string) === 'vulnerability detection') {
    // Processing vulnerability detection question
  }
  
  // Get models that have responses for this question and are in the current results
  const availableModels = Object.keys(currentQuestion.models || {})
    .map(modelKey => {
      // Extract model name from key (remove task-specific prefixes)
      const modelName = modelKey.replace(/^(code_translation_|code_generation_|unit_test_generation_|code_review_|code_summarization_|input_prediction_|output_prediction_|vulnerability_detection_)/, '');
      const modelData = currentQuestion.models[modelKey];
      const primaryMetricInfo = getPrimaryMetric(modelData);
      return {
        key: modelKey,
        name: modelName,
        data: modelData,
        primaryMetric: primaryMetricInfo.value,
        primaryMetricName: primaryMetricInfo.name
      };
    })
    .filter(model => {
      const hasMatch = results.some(result => result.model === model.name || result.modelName === model.name);
      // Model filtering for vulnerability detection
      return hasMatch;
    })
    .sort((a, b) => b.primaryMetric - a.primaryMetric); // Sort by primary metric descending

  // Set default selected models if not set or if models are not available
  if (availableModels.length >= 2) {
    if (!selectedModels[0] || !availableModels.find(m => m.key === selectedModels[0]) ||
        !selectedModels[1] || !availableModels.find(m => m.key === selectedModels[1])) {
      if (selectedModels[0] !== availableModels[0].key || selectedModels[1] !== availableModels[1].key) {
        setSelectedModels([availableModels[0].key, availableModels[1].key]);
      }
    }
  }
  
  // If less than 2 models are available, show a message
  if (availableModels.length < 2) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '1.125rem' }}>
              Need at least 2 models to show side-by-side comparison.
            </span>
            <br />
            <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af', fontSize: '0.875rem' }}>
              Available models: {availableModels.length}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Use appropriate metric range for consistent color coding across all questions
  // This prevents issues when all models have the same score for a question
  let minMetric = 0.0;
  let maxMetric = 1.0;
  
  // For LLMJudge scores, use 1-5 scale
  if (availableModels.length > 0 && availableModels[0].primaryMetricName === 'LLM Judge') {
    minMetric = 1.0;
    maxMetric = 5.0;
  }

  // Get currently selected models data
  const leftModel = availableModels.find(m => m.key === selectedModels[0]);
  const rightModel = availableModels.find(m => m.key === selectedModels[1]);

  return (
    <div 
      className="w-full max-w-7xl mx-auto p-4 sm:p-6"
      style={{
        pointerEvents: 'auto',
        cursor: 'default'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      {/* Question Navigation */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <h2 className="text-lg sm:text-2xl lg:text-3xl font-bold pt-4 sm:pt-0" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
            {(currentTask as string) === 'code translation' ? 'Code Translation - Side by Side' :
             (currentTask as string) === 'code generation' ? 'Code Generation - Side by Side' :
             (currentTask as string) === 'unit test generation' ? 'Unit Test Generation - Side by Side' :
             (currentTask as string) === 'code review' ? 'Code Review - Side by Side' :
             (currentTask as string) === 'code summarization' ? 'Code Summarization - Side by Side' :
             (currentTask as string) === 'input prediction' ? 'Input Prediction - Side by Side' :
             (currentTask as string) === 'output prediction' ? 'Output Prediction - Side by Side' :
             (currentTask as string) === 'vulnerability detection' ? 'Vulnerability Detection - Side by Side' :
             'Code Questions - Side by Side'}
          </h2>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={async () => {
                setIsLoading(true);
                try {
                  // Use the same logic as in useEffect
                  let dataUrl = '';
                  let dataProcessor: (data: unknown) => CodeQuestionData[] = (data) => data as CodeQuestionData[];

                  if (currentTask === 'code translation') {
                    dataUrl = '/data/code-example/code-translation/example_data.json';
                  } else if (currentTask === 'code generation') {
                    dataUrl = '/data/code-example/code-generation/combined_data.json';
                    dataProcessor = (data) => {
                      const flatData: CodeQuestionData[] = [];
                      const dataObj = data as Record<string, unknown[]>;
                      Object.keys(dataObj).forEach(dataset => {
                        if (Array.isArray(dataObj[dataset])) {
                      dataObj[dataset].forEach((item: unknown) => {
                        const typedItem = item as Record<string, unknown>;
                        flatData.push({
                          ...typedItem,
                          dataset: dataset,
                          lang: (typedItem.modality as string)?.toLowerCase() || (typedItem.lang as string) // Normalize language field
                        } as CodeQuestionData);
                      });
                        }
                      });
                      return flatData;
                    };
                  } else if (currentTask === 'unit test generation') {
                    dataUrl = '/data/code-example/unit-test-generation/combined_data.json';
                    dataProcessor = (data) => {
                      // Unit test generation data is already in flat array format
                      return Array.isArray(data) ? data as CodeQuestionData[] : [];
                    };
                  } else if (currentTask === 'code review') {
                    dataUrl = '/data/code-example/code-review/combined_data.json';
                    dataProcessor = (data) => {
                      // Code review data is already in flat array format
                      return Array.isArray(data) ? data as CodeQuestionData[] : [];
                    };
                  } else if (currentTask === 'code summarization') {
                    dataUrl = '/data/code-example/code-summarization/combined_data.json';
                    dataProcessor = (data) => {
                      // Code summarization data is already in flat array format
                      return Array.isArray(data) ? data as CodeQuestionData[] : [];
                    };
                  } else if (currentTask === 'input prediction') {
                    dataUrl = '/data/code-example/input-prediction/combined_data.json';
                    dataProcessor = (data) => {
                      // Convert the nested structure to flat array
                      const flatData: CodeQuestionData[] = [];
                      const dataObj = data as Record<string, unknown[]>;
                      Object.keys(dataObj).forEach(dataset => {
                        if (Array.isArray(dataObj[dataset])) {
                        dataObj[dataset].forEach((item: unknown) => {
                          const typedItem = item as Record<string, unknown>;
                          flatData.push({
                            ...typedItem,
                            dataset: dataset,
                            lang: typedItem.lang as string // Use existing lang field
                          } as CodeQuestionData);
                        });
                        }
                      });
                      return flatData;
                    };
                  } else if (currentTask === 'output prediction') {
                    dataUrl = '/data/code-example/output-prediction/combined_data.json';
                    dataProcessor = (data) => {
                      // Convert the nested structure to flat array
                      const flatData: CodeQuestionData[] = [];
                      const dataObj = data as Record<string, unknown[]>;
                      Object.keys(dataObj).forEach(dataset => {
                        if (Array.isArray(dataObj[dataset])) {
                        dataObj[dataset].forEach((item: unknown) => {
                          const typedItem = item as Record<string, unknown>;
                          flatData.push({
                            ...typedItem,
                            dataset: dataset,
                            lang: typedItem.lang as string // Use existing lang field
                          } as CodeQuestionData);
                        });
                        }
                      });
                      return flatData;
                    };
                  } else if (currentTask === 'vulnerability detection') {
                    dataUrl = '/data/code-example/vulnerability-detection/combined_data.json';
                    dataProcessor = (data) => {
                      // Vulnerability detection data is already in flat array format
                      return Array.isArray(data) ? data as CodeQuestionData[] : [];
                    };
                  } else {
                    setIsLoading(false);
                    return;
                  }

                  const response = await fetch(dataUrl);
                  if (!response.ok) {
                    throw new Error(`Failed to load question data for ${currentTask}`);
                  }
                  const rawData = await response.json();
                  const processedData = dataProcessor(rawData);
                  
                  const selectedQuestions = filterAndSelectQuestions(processedData);
                  setQuestionData(selectedQuestions);
                  setSelectedQuestion(0);
                  setIsLoading(false);
                } catch {
                  // Error loading question data
                  setIsLoading(false);
                }
              }}
              className="px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors"
              style={{
                backgroundColor: isDarkMode ? '#3b82f6' : '#2563eb',
                color: '#ffffff'
              }}
            >
              <span className="hidden sm:inline">🔄 Refresh Questions</span>
              <span className="sm:hidden">🔄 Refresh</span>
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setSelectedQuestion(Math.max(0, selectedQuestion - 1))}
              disabled={selectedQuestion === 0}
              className="px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                color: isDarkMode ? '#e2e8f0' : '#374151',
                cursor: selectedQuestion === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>
            <span className="text-sm sm:text-base font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {selectedQuestion + 1} of {questionData.length}
            </span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setSelectedQuestion(Math.min(questionData.length - 1, selectedQuestion + 1))}
              disabled={selectedQuestion === questionData.length - 1}
              className="px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                color: isDarkMode ? '#e2e8f0' : '#374151',
                cursor: selectedQuestion === questionData.length - 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Question Details */}
      <div className="mb-8 p-6 rounded-lg" style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <span className="text-base font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Dataset:
            </span>
            <div className="text-lg font-semibold" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
              {currentQuestion.dataset}
            </div>
          </div>
          <div>
            <span className="text-base font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Modality:
            </span>
            <div className="text-lg font-semibold" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
              {(() => {
                // For code review, code summarization, input prediction, output prediction - use lang field
                if ((currentTask as string) === 'code review' || 
                    (currentTask as string) === 'code summarization' ||
                    (currentTask as string) === 'input prediction' ||
                    (currentTask as string) === 'output prediction') {
                  const lang = currentQuestion.lang;
                  // Display proper language names for better readability
                  if (lang === 'csharp') {
                    return 'C#';
                  }
                  if (lang === 'cpp') {
                    return 'C++';
                  }
                  if (lang === 'javascript') {
                    return 'JavaScript';
                  }
                  if (lang === 'typescript') {
                    return 'TypeScript';
                  }
                  // Capitalize first letter for other languages
                  return lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : 'N/A';
                }
                // For other tasks, use modality field
                return currentQuestion.modality || 'N/A';
              })()}
            </div>
          </div>
          <div>
            <span className="text-base font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Question ID:
            </span>
            <div className="text-lg font-semibold break-all" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
              {(currentQuestion as CodeQuestionData & { data_idx?: number }).data_idx || currentQuestion.id || currentQuestion.question_key || currentQuestion.prompt_id || 'N/A'}
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-2xl font-semibold mb-4" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
            {(currentTask as string) === 'code translation' ? 'Original Question' :
             (currentTask as string) === 'code generation' ? 'Problem Statement' :
             (currentTask as string) === 'unit test generation' ? 'Code to Test' :
             (currentTask as string) === 'code review' ? 'Code to Review' :
             (currentTask as string) === 'code summarization' ? 'Code to Summarize' :
             (currentTask as string) === 'input prediction' ? 'Function and Expected Output' :
             (currentTask as string) === 'output prediction' ? 'Function and Input' :
             (currentTask as string) === 'vulnerability detection' ? 'Code to Analyze' :
             'Question'}
          </h3>
          <div
            className="text-base rounded overflow-x-auto whitespace-pre-wrap"
            style={{ 
              padding: '16px',
              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              fontSize: '16px',
              lineHeight: '1.5',
              color: isDarkMode ? '#e2e8f0' : '#374151',
              cursor: 'text',
              pointerEvents: 'auto'
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {currentQuestion.wrapped_text || (currentQuestion as CodeQuestionData & { 'code/function'?: string })['code/function'] || 'No content available'}
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold mb-4" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
          Model Comparison
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-base font-medium mb-2 block" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Left Model:
            </span>
            <select
              value={selectedModels[0]}
              onChange={(e) => setSelectedModels([e.target.value, selectedModels[1]])}
              className="w-full px-4 py-2 rounded-lg border text-base font-medium"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                color: isDarkMode ? '#e2e8f0' : '#374151',
                borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                cursor: 'pointer',
                pointerEvents: 'auto'
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {availableModels.map((model, index) => (
                <option key={model.key} value={model.key}>
                  #{index + 1} {model.name} (Score: {model.primaryMetricName === 'LLM Judge' ? model.primaryMetric.toFixed(0) : model.primaryMetric.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-base font-medium mb-2 block" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Right Model:
            </span>
            <select
              value={selectedModels[1]}
              onChange={(e) => setSelectedModels([selectedModels[0], e.target.value])}
              className="w-full px-4 py-2 rounded-lg border text-base font-medium"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                color: isDarkMode ? '#e2e8f0' : '#374151',
                borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                cursor: 'pointer',
                pointerEvents: 'auto'
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {availableModels.map((model, index) => (
                <option key={model.key} value={model.key}>
                  #{index + 1} {model.name} (Score: {model.primaryMetricName === 'LLM Judge' ? model.primaryMetric.toFixed(0) : model.primaryMetric.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Side by Side Comparison */}
      {leftModel && rightModel && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Model */}
          <div 
            className="p-6 rounded-lg border-2"
            style={{ 
              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
              borderColor: getPerformanceColors(leftModel.primaryMetric, minMetric, maxMetric, isDarkMode).badgeColor
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
                  {leftModel.name}
                </span>
                <span 
                  className="px-3 py-1 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: getPerformanceColors(leftModel.primaryMetric, minMetric, maxMetric, isDarkMode).badgeColor,
                    color: 'white'
                  }}
                >
                  {leftModel.primaryMetricName}: {leftModel.primaryMetricName === 'LLM Judge' ? leftModel.primaryMetric.toFixed(0) : leftModel.primaryMetric.toFixed(2)}
                </span>
              </div>
              <div className="text-sm" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Rank: #{availableModels.findIndex(m => m.key === selectedModels[0]) + 1}
              </div>
            </div>
            
            <h4 className="text-lg font-medium mb-3" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {(currentTask as string) === 'code translation' ? 'Generated Code:' :
               (currentTask as string) === 'code generation' ? 'Generated Solution:' :
               (currentTask as string) === 'unit test generation' ? 'Generated Tests:' :
               (currentTask as string) === 'code review' ? 'Generated Review:' :
               (currentTask as string) === 'code summarization' ? 'Generated Summary:' :
               (currentTask as string) === 'input prediction' ? 'Predicted Input:' :
               (currentTask as string) === 'output prediction' ? 'Predicted Output:' :
               (currentTask as string) === 'vulnerability detection' ? 'Vulnerability Analysis:' :
               'Generated Code:'}
            </h4>
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{ cursor: 'text', pointerEvents: 'auto' }}
            >
              <CodeHighlighter
                code={(() => {
                  if ((currentTask as string) === 'vulnerability detection' && typeof leftModel.data.parsed_code === 'number') {
                    return leftModel.data.parsed_code === 1 
                      ? '(1) YES: A security vulnerability detected.' 
                      : '(2) NO: No security vulnerability.';
                  }
                  return String(leftModel.data.parsed_code);
                })()}
                language={getLanguageForHighlighting(currentQuestion, false)}
                isDarkMode={isDarkMode}
                className="text-sm rounded overflow-x-auto whitespace-pre-wrap"
                customStyle={{ 
                  border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                  maxHeight: '400px',
                  overflowY: 'auto',
                  backgroundColor: getPerformanceColors(leftModel.primaryMetric, minMetric, maxMetric, isDarkMode).backgroundColor,
                  cursor: 'text',
                  pointerEvents: 'auto'
                }}
              />
            </div>
          </div>

          {/* Right Model */}
          <div 
            className="p-6 rounded-lg border-2"
            style={{ 
              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
              borderColor: getPerformanceColors(rightModel.primaryMetric, minMetric, maxMetric, isDarkMode).badgeColor
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
                  {rightModel.name}
                </span>
                <span 
                  className="px-3 py-1 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: getPerformanceColors(rightModel.primaryMetric, minMetric, maxMetric, isDarkMode).badgeColor,
                    color: 'white'
                  }}
                >
                  {rightModel.primaryMetricName}: {rightModel.primaryMetricName === 'LLM Judge' ? rightModel.primaryMetric.toFixed(0) : rightModel.primaryMetric.toFixed(2)}
                </span>
              </div>
              <div className="text-sm" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Rank: #{availableModels.findIndex(m => m.key === selectedModels[1]) + 1}
              </div>
            </div>
            
            <h4 className="text-lg font-medium mb-3" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {(currentTask as string) === 'code translation' ? 'Generated Code:' :
               (currentTask as string) === 'code generation' ? 'Generated Solution:' :
               (currentTask as string) === 'unit test generation' ? 'Generated Tests:' :
               (currentTask as string) === 'code review' ? 'Generated Review:' :
               (currentTask as string) === 'code summarization' ? 'Generated Summary:' :
               (currentTask as string) === 'input prediction' ? 'Predicted Input:' :
               (currentTask as string) === 'output prediction' ? 'Predicted Output:' :
               (currentTask as string) === 'vulnerability detection' ? 'Vulnerability Analysis:' :
               'Generated Code:'}
            </h4>
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{ cursor: 'text', pointerEvents: 'auto' }}
            >
              <CodeHighlighter
                code={(() => {
                  if ((currentTask as string) === 'vulnerability detection' && typeof rightModel.data.parsed_code === 'number') {
                    return rightModel.data.parsed_code === 1 
                      ? '(1) YES: A security vulnerability detected.' 
                      : '(2) NO: No security vulnerability.';
                  }
                  return String(rightModel.data.parsed_code);
                })()}
                language={getLanguageForHighlighting(currentQuestion, false)}
                isDarkMode={isDarkMode}
                className="text-sm rounded overflow-x-auto whitespace-pre-wrap"
                customStyle={{ 
                  border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                  maxHeight: '400px',
                  overflowY: 'auto',
                  backgroundColor: getPerformanceColors(rightModel.primaryMetric, minMetric, maxMetric, isDarkMode).backgroundColor,
                  cursor: 'text',
                  pointerEvents: 'auto'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeQuestionsView;
