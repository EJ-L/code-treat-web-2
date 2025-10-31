import { FC, useState, useEffect } from 'react';
import { TaskType, ProcessedResult, Ability } from '@/lib/types';
import hljs from 'highlight.js';

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

// Custom syntax highlighter component using highlight.js
const CodeHighlighter: FC<{
  code: string;
  language?: string;
  isDarkMode: boolean;
  customStyle?: React.CSSProperties;
  className?: string;
}> = ({ code, language, isDarkMode, customStyle, className }) => {
  const [highlightedCode, setHighlightedCode] = useState<string>('');

  useEffect(() => {
    if (language && language !== 'text') {
      try {
        const highlighted = hljs.highlight(code, { language }).value;
        setHighlightedCode(highlighted);
      } catch (error) {
        // If specific language fails, try auto-detection
        try {
          const highlighted = hljs.highlightAuto(code).value;
          setHighlightedCode(highlighted);
        } catch (autoError) {
          // Fallback to plain text
          setHighlightedCode(code);
        }
      }
    } else {
      // Auto-detect language
      try {
        const highlighted = hljs.highlightAuto(code).value;
        setHighlightedCode(highlighted);
      } catch (error) {
        setHighlightedCode(code);
      }
    }
  }, [code, language]);

  return (
    <pre 
      className={`hljs ${isDarkMode ? 'hljs-dark' : 'hljs-light'} ${className || ''}`}
      style={{
        padding: '16px',
        borderRadius: '8px',
        fontSize: '16px',
        lineHeight: '1.5',
        overflow: 'auto',
        ...customStyle
      }}
    >
      <code 
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
        style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
      />
    </pre>
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
  const [selectedModel, setSelectedModel] = useState<string>(''); // New state for selected model
  const [isLoading, setIsLoading] = useState(true);

  // Function to filter and randomly select questions
  const filterAndSelectQuestions = (data: CodeQuestionData[]) => {
    console.log('🔍 Filtering questions:', {
      totalQuestions: data.length,
      selectedDatasets: selectedAbilities.dataset,
      selectedModalities: selectedAbilities.modality,
      currentTask
    });
    
    // Apply filtering based on selected abilities
    let filteredData = data;
    
    // Filter by dataset
    if (selectedAbilities.dataset && selectedAbilities.dataset.length > 0) {
      const beforeCount = filteredData.length;
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
      console.log(`📊 Dataset filter: ${beforeCount} → ${filteredData.length} questions`);
    }
    
    // Filter by modality (only for code translation)
    if ((currentTask as string) === 'code translation' && selectedAbilities.modality && selectedAbilities.modality.length > 0) {
      const beforeCount = filteredData.length;
      filteredData = filteredData.filter((item: CodeQuestionData) => {
        return selectedAbilities.modality!.some(modality => 
          item.modality === modality
        );
      });
      console.log(`🔄 Modality filter: ${beforeCount} → ${filteredData.length} questions`);
    }
    
    // Filter by language (for code generation, unit test generation, code review, code summarization, input/output prediction)
    if (((currentTask as string) === 'code generation' || 
         (currentTask as string) === 'unit test generation' ||
         (currentTask as string) === 'code review' ||
         (currentTask as string) === 'code summarization' ||
         (currentTask as string) === 'input prediction' ||
         (currentTask as string) === 'output prediction') && 
        selectedAbilities.modality && selectedAbilities.modality.length > 0) {
      const beforeCount = filteredData.length;
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
      console.log(`🔄 Language filter: ${beforeCount} → ${filteredData.length} questions`);
    }
    
    // Filter by LLMJudge (for code review and code summarization)
    if (((currentTask as string) === 'code review' || (currentTask as string) === 'code summarization') && 
        selectedAbilities.llmJudges && selectedAbilities.llmJudges.length > 0) {
      const beforeCount = filteredData.length;
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
      console.log(`⚖️ LLMJudge filter: ${beforeCount} → ${filteredData.length} questions`);
    }
    
    // If no data matches filters, return empty array
    if (filteredData.length === 0) {
      console.log('❌ No questions match the current filters');
      return [];
    }
    
    // Randomly select 10 questions from filtered data
    const shuffled = [...filteredData].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));
    
    console.log(`✅ Selected ${selected.length} random questions from ${filteredData.length} filtered questions`);
    console.log('📋 Selected question details:', selected.map(q => ({
      id: q.id || q.question_key,
      dataset: q.dataset,
      modality: q.modality,
      lang: q.lang
    })));
    
    return selected;
  };

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
        let dataProcessor: (data: any) => CodeQuestionData[] = (data) => data;

        // Determine the data source and processor based on task
        if (currentTask === 'code translation') {
          dataUrl = '/data/code-example/code-translation/example_data.json';
        } else if (currentTask === 'code generation') {
          dataUrl = '/data/code-example/code-generation/combined_data.json';
          dataProcessor = (data) => {
            // Convert the nested structure to flat array
            const flatData: CodeQuestionData[] = [];
            Object.keys(data).forEach(dataset => {
              if (Array.isArray(data[dataset])) {
                data[dataset].forEach((item: any) => {
                  flatData.push({
                    ...item,
                    dataset: dataset,
                    lang: item.modality?.toLowerCase() || item.lang // Normalize language field
                  });
                });
              }
            });
            return flatData;
          };
        } else if (currentTask === 'unit test generation') {
          dataUrl = '/data/code-example/unit-test-generation/combined_data.json';
          dataProcessor = (data) => {
            // Unit test generation data is already in flat array format
            return Array.isArray(data) ? data : [];
          };
        } else if (currentTask === 'code review') {
          dataUrl = '/data/code-example/code-review/combined_data.json';
          dataProcessor = (data) => {
            // Code review data is already in flat array format
            return Array.isArray(data) ? data : [];
          };
        } else if (currentTask === 'code summarization') {
          dataUrl = '/data/code-example/code-summarization/combined_data.json';
          dataProcessor = (data) => {
            // Code summarization data is already in flat array format
            return Array.isArray(data) ? data : [];
          };
        } else if (currentTask === 'input prediction') {
          dataUrl = '/data/code-example/input-prediction/combined_data.json';
          dataProcessor = (data) => {
            // Convert the nested structure to flat array
            const flatData: CodeQuestionData[] = [];
            Object.keys(data).forEach(dataset => {
              if (Array.isArray(data[dataset])) {
                data[dataset].forEach((item: any) => {
                  flatData.push({
                    ...item,
                    dataset: dataset,
                    lang: item.lang // Use existing lang field
                  });
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
            Object.keys(data).forEach(dataset => {
              if (Array.isArray(data[dataset])) {
                data[dataset].forEach((item: any) => {
                  flatData.push({
                    ...item,
                    dataset: dataset,
                    lang: item.lang // Use existing lang field
                  });
                });
              }
            });
            return flatData;
          };
        } else if (currentTask === 'vulnerability detection') {
          dataUrl = '/data/code-example/vulnerability-detection/combined_data.json';
          dataProcessor = (data) => {
            // Vulnerability detection data is already in flat array format
            return Array.isArray(data) ? data : [];
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
      } catch (error) {
        console.error('Error loading question data:', error);
        setIsLoading(false);
      }
    };

    loadQuestionData();
  }, [currentTask, selectedAbilities.dataset, selectedAbilities.modality, selectedAbilities.llmJudges]);

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
    console.log('🔍 VD Current Question:', {
      questionId: (currentQuestion as any).data_idx,
      availableModelKeys: Object.keys(currentQuestion.models || {}),
      modelCount: Object.keys(currentQuestion.models || {}).length,
      resultsCount: results.length,
      resultsModels: results.map(r => r.model || r.modelName)
    });
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
      // Debug logging for vulnerability detection
      if ((currentTask as string) === 'vulnerability detection') {
        console.log('🔍 VD Model filtering:', {
          modelKey: model.key,
          modelName: model.name,
          hasMatch,
          availableResultModels: results.map(r => ({ model: r.model, modelName: r.modelName }))
        });
      }
      return hasMatch;
    })
    .sort((a, b) => b.primaryMetric - a.primaryMetric); // Sort by primary metric descending

  // Set default selected model if not set or if model is not available
  if (availableModels.length > 0 && (!selectedModel || !availableModels.find(m => m.key === selectedModel))) {
    if (selectedModel !== availableModels[0].key) {
      setSelectedModel(availableModels[0].key);
    }
  }
  
  // If no models are available, show a message
  if (availableModels.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '1.125rem' }}>
              No model responses available for this question.
            </span>
            <br />
            <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af', fontSize: '0.875rem' }}>
              This might be because the models in the current results don't have responses for this specific question.
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

  // Get currently selected model data
  const currentModel = availableModels.find(m => m.key === selectedModel);

  return (
    <div 
      className="w-full max-w-7xl mx-auto p-6"
      style={{
        pointerEvents: 'auto',
        cursor: 'default'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      {/* Question Navigation */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
            {(currentTask as string) === 'code translation' ? 'Code Translation Questions' :
             (currentTask as string) === 'code generation' ? 'Code Generation Questions' :
             (currentTask as string) === 'unit test generation' ? 'Unit Test Generation Questions' :
             (currentTask as string) === 'code review' ? 'Code Review Questions' :
             (currentTask as string) === 'code summarization' ? 'Code Summarization Questions' :
             (currentTask as string) === 'input prediction' ? 'Input Prediction Questions' :
             (currentTask as string) === 'output prediction' ? 'Output Prediction Questions' :
             (currentTask as string) === 'vulnerability detection' ? 'Vulnerability Detection Questions' :
             'Code Questions'}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={async () => {
                setIsLoading(true);
                try {
                  // Use the same logic as in useEffect
                  let dataUrl = '';
                  let dataProcessor: (data: any) => CodeQuestionData[] = (data) => data;

                  if (currentTask === 'code translation') {
                    dataUrl = '/data/code-example/code-translation/example_data.json';
                  } else if (currentTask === 'code generation') {
                    dataUrl = '/data/code-example/code-generation/combined_data.json';
                    dataProcessor = (data) => {
                      const flatData: CodeQuestionData[] = [];
                      Object.keys(data).forEach(dataset => {
                        if (Array.isArray(data[dataset])) {
                          data[dataset].forEach((item: any) => {
                            flatData.push({
                              ...item,
                              dataset: dataset,
                              lang: item.modality?.toLowerCase() || item.lang // Normalize language field
                            });
                          });
                        }
                      });
                      return flatData;
                    };
                  } else if (currentTask === 'unit test generation') {
                    dataUrl = '/data/code-example/unit-test-generation/combined_data.json';
                    dataProcessor = (data) => {
                      // Unit test generation data is already in flat array format
                      return Array.isArray(data) ? data : [];
                    };
                  } else if (currentTask === 'code review') {
                    dataUrl = '/data/code-example/code-review/combined_data.json';
                    dataProcessor = (data) => {
                      // Code review data is already in flat array format
                      return Array.isArray(data) ? data : [];
                    };
                  } else if (currentTask === 'code summarization') {
                    dataUrl = '/data/code-example/code-summarization/combined_data.json';
                    dataProcessor = (data) => {
                      // Code summarization data is already in flat array format
                      return Array.isArray(data) ? data : [];
                    };
                  } else if (currentTask === 'input prediction') {
                    dataUrl = '/data/code-example/input-prediction/combined_data.json';
                    dataProcessor = (data) => {
                      // Convert the nested structure to flat array
                      const flatData: CodeQuestionData[] = [];
                      Object.keys(data).forEach(dataset => {
                        if (Array.isArray(data[dataset])) {
                          data[dataset].forEach((item: any) => {
                            flatData.push({
                              ...item,
                              dataset: dataset,
                              lang: item.lang // Use existing lang field
                            });
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
                      Object.keys(data).forEach(dataset => {
                        if (Array.isArray(data[dataset])) {
                          data[dataset].forEach((item: any) => {
                            flatData.push({
                              ...item,
                              dataset: dataset,
                              lang: item.lang // Use existing lang field
                            });
                          });
                        }
                      });
                      return flatData;
                    };
                  } else if (currentTask === 'vulnerability detection') {
                    dataUrl = '/data/code-example/vulnerability-detection/combined_data.json';
                    dataProcessor = (data) => {
                      // Vulnerability detection data is already in flat array format
                      return Array.isArray(data) ? data : [];
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
                } catch (error) {
                  console.error('Error loading question data:', error);
                  setIsLoading(false);
                }
              }}
              className="px-4 py-2 rounded-lg text-base font-medium transition-colors"
              style={{
                backgroundColor: isDarkMode ? '#3b82f6' : '#2563eb',
                color: '#ffffff'
              }}
            >
              🔄 Refresh Questions
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setSelectedQuestion(Math.max(0, selectedQuestion - 1))}
              disabled={selectedQuestion === 0}
              className="px-4 py-2 rounded-lg text-base font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                color: isDarkMode ? '#e2e8f0' : '#374151',
                cursor: selectedQuestion === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>
            <span className="text-base font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {selectedQuestion + 1} of {questionData.length}
            </span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setSelectedQuestion(Math.min(questionData.length - 1, selectedQuestion + 1))}
              disabled={selectedQuestion === questionData.length - 1}
              className="px-4 py-2 rounded-lg text-base font-medium transition-colors disabled:opacity-50"
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
              {(currentQuestion as any).data_idx || currentQuestion.id || currentQuestion.question_key || currentQuestion.prompt_id || 'N/A'}
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
            {currentQuestion.wrapped_text || (currentQuestion as any)['code/function'] || 'No content available'}
          </div>
        </div>
      </div>

      {/* Model Response */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
            Model Response
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-base font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Select Model:
            </span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-4 py-2 rounded-lg border text-base font-medium min-w-48"
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
        
        {currentModel && (
          <div 
            className="p-6 rounded-lg"
            style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="text-xl font-semibold" style={{ color: isDarkMode ? '#e2e8f0' : '#374151' }}>
                  {currentModel.name}
                </span>
                <div className="flex items-center gap-3">
                  <span 
                    className="px-3 py-1 rounded-lg text-base font-medium"
                    style={{
                      backgroundColor: getPerformanceColors(currentModel.primaryMetric, minMetric, maxMetric, isDarkMode).badgeColor,
                      color: 'white'
                    }}
                  >
                    {currentModel.primaryMetricName}: {currentModel.primaryMetricName === 'LLM Judge' ? currentModel.primaryMetric.toFixed(0) : currentModel.primaryMetric.toFixed(2)}
                  </span>
                  {/* Show additional metrics for unit test generation */}
                  {(currentTask as string) === 'unit test generation' && currentModel.data.metrics && (
                    <div className="text-sm" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      {Object.entries(currentModel.data.metrics)
                        .filter(([key]) => key !== 'csr') // Don't repeat the primary metric
                        .map(([key, value]) => {
                          let displayValue = 'N/A';
                          if (typeof value === 'number') {
                            if (value < 0) {
                              displayValue = 'N/A';
                            } else if (key === 'line_coverage' || key === 'branch_coverage') {
                              // These are already in percentage scale (0-100), don't multiply by 100
                              displayValue = `${value.toFixed(1)}%`;
                            } else {
                              // CSR and other metrics are in 0-1 scale, multiply by 100
                              displayValue = `${(value * 100).toFixed(1)}%`;
                            }
                          }
                          return (
                            <span key={key} className="mr-3">
                              {key.replace('_', ' ')}: {displayValue}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-base" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Rank: #{availableModels.findIndex(m => m.key === selectedModel) + 1} of {availableModels.length}
              </div>
            </div>
            
            <div>
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
                    // For vulnerability detection, convert numeric responses to meaningful text
                    if ((currentTask as string) === 'vulnerability detection' && typeof currentModel.data.parsed_code === 'number') {
                      return currentModel.data.parsed_code === 1 
                        ? '(1) YES: A security vulnerability detected.' 
                        : '(2) NO: No security vulnerability.';
                    }
                    // For other tasks, convert to string
                    return String(currentModel.data.parsed_code);
                  })()}
                  language={getLanguageForHighlighting(currentQuestion, false)}
                  isDarkMode={isDarkMode}
                  className="text-base rounded overflow-x-auto whitespace-pre-wrap"
                  customStyle={{ 
                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    backgroundColor: getPerformanceColors(currentModel.primaryMetric, minMetric, maxMetric, isDarkMode).backgroundColor,
                    cursor: 'text',
                    pointerEvents: 'auto'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeQuestionsView;
