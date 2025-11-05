/**
 * Centralized application configuration
 * All hardcoded values and magic numbers should be defined here
 */

export const APP_CONFIG = {
  // API Configuration
  api: {
    github: {
      baseUrl: process.env.NEXT_PUBLIC_GITHUB_API_URL || 'https://api.github.com',
      owner: process.env.NEXT_PUBLIC_GITHUB_OWNER || 'default-owner',
      repo: process.env.NEXT_PUBLIC_GITHUB_REPO || 'default-repo'
    },
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  },
  
  // UI Configuration
  ui: {
    progressiveLoading: {
      batchSize: 15,
      delayBetweenBatches: 30,
      priorityModels: ['GPT-4', 'Claude', 'Gemini', 'Llama', 'DeepSeek', 'Qwen']
    },
    table: {
      defaultColumnWidths: {
        rank: 150,
        model: 300,
        pass1: 130,
        pass3: 100,
        pass5: 100,
        llmJudge: 160,
        accuracy: 200,
        precision: 210,
        recall: 180,
        f1Score: 180
      },
      minColumnWidths: {
        rank: 100,
        model: 300,
        pass1: 90,
        pass3: 90,
        pass5: 90,
        llmJudge: 100,
        accuracy: 80,
        precision: 80,
        recall: 80,
        f1Score: 80
      },
      maxColumnWidths: {
        rank: 200,
        model: 600,
        pass1: 150,
        pass3: 150,
        pass5: 150,
        llmJudge: 500,
        accuracy: 300,
        precision: 300,
        recall: 300,
        f1Score: 300
      }
    },
    animations: {
      transitionDuration: 200,
      hoverScale: 1.02,
      tapScale: 0.98,
      loadingSpinnerSize: 'h-4 w-4',
      fadeInDuration: 300
    },
    colors: {
      primary: 'blue-600',
      secondary: 'slate-600',
      success: 'green-600',
      error: 'red-600',
      warning: 'yellow-600',
      info: 'blue-500'
    },
    spacing: {
      componentPadding: 'p-6',
      sectionMargin: 'mb-8',
      buttonPadding: 'px-4 py-2',
      cardPadding: 'p-8',
      gridGap: 'gap-6'
    }
  },
  
  // Task Configuration
  tasks: {
    aggregationTasks: [
      'code generation',
      'code translation', 
      'code summarization',
      'code review',
      'input prediction',
      'output prediction',
      'vulnerability detection',
      'unit test generation'
    ] as const,
    excludedModels: {
      'code summarization': ['Code Summarization Human Baseline']
    },
    taskInfo: {
      CG: { 
        name: 'Code Generation', 
        abbr: 'CG',
        metric: 'Pass@1 - Percentage of problems solved correctly on first attempt'
      },
      CS: { 
        name: 'Code Summarization', 
        abbr: 'CS',
        metric: 'BLEU-4 Score - Quality of generated code summaries'
      },
      CT: { 
        name: 'Code Translation', 
        abbr: 'CT',
        metric: 'CodeBLEU Score - Accuracy of code translation between languages'
      },
      CRv: { 
        name: 'Code Review', 
        abbr: 'CRv',
        metric: 'F1 Score - Accuracy in identifying code issues and suggestions'
      },
      CR: { 
        name: 'Code Reasoning', 
        abbr: 'CR',
        metric: 'Accuracy - Correctness in understanding and reasoning about code'
      },
      TG: { 
        name: 'Test Generation', 
        abbr: 'TG',
        metric: 'Pass@1 - Percentage of generated tests that pass and are valid'
      },
      VD: { 
        name: 'Vulnerability Detection', 
        abbr: 'VD',
        metric: 'F1 Score - Accuracy in detecting security vulnerabilities'
      }
    }
  },
  
  // Debug Configuration
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    dataLoader: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_DATA_LOADER !== 'false',
    dataSource: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_DATA_SOURCE !== 'false',
    leaderboard: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_LEADERBOARD !== 'false',
    api: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_API !== 'false',
    general: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_GENERAL !== 'false'
  },

  // Performance Configuration
  performance: {
    maxRetries: 3,
    retryDelay: 1000,
    cacheTimeout: 300000, // 5 minutes
    batchProcessingSize: 50
  }
} as const;

// Type definitions for better TypeScript support
export type AppConfig = typeof APP_CONFIG;
export type TaskType = typeof APP_CONFIG.tasks.aggregationTasks[number];
export type TaskInfoKey = keyof typeof APP_CONFIG.tasks.taskInfo;

// Validation function
export const validateConfig = (): void => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_BASE_URL'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`Missing optional environment variables: ${missing.join(', ')}`);
  }

  // Validate configuration values
  if (APP_CONFIG.ui.progressiveLoading.batchSize <= 0) {
    throw new Error('Progressive loading batch size must be greater than 0');
  }

  if (APP_CONFIG.ui.progressiveLoading.delayBetweenBatches < 0) {
    throw new Error('Delay between batches cannot be negative');
  }
};

// Helper functions for accessing config
export const getTaskInfo = (taskKey: TaskInfoKey) => APP_CONFIG.tasks.taskInfo[taskKey];
export const getColumnWidth = (column: keyof typeof APP_CONFIG.ui.table.defaultColumnWidths) => 
  APP_CONFIG.ui.table.defaultColumnWidths[column];
export const getMinColumnWidth = (column: keyof typeof APP_CONFIG.ui.table.minColumnWidths) => 
  APP_CONFIG.ui.table.minColumnWidths[column];
export const getMaxColumnWidth = (column: keyof typeof APP_CONFIG.ui.table.maxColumnWidths) => 
  APP_CONFIG.ui.table.maxColumnWidths[column];
