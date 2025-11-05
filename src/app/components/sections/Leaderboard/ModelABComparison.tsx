import React, { FC, useState, useMemo, useEffect } from 'react';
import { loadModelComparisonCSV, parseModelComparisonCSV, ModelComparisonData } from '@/lib/csvLoader';
import { ProcessedResult } from '@/lib/types';
import { ModelSelector, ModelData } from '@/app/components/ui/ModelSelector';
import { 
  ComparisonHeader,
  RankingComparison,
  TaskPerformanceTable,
  PerformanceVisualization,
  LoadingState,
  ErrorState,
  EmptyState,
  SameModelWarning,
  SelectModelsPrompt,
  TaskInfo,
  RadarChartData
} from '@/app/components/ui/ModelComparison';
import { APP_CONFIG } from '@/config/app.config';

interface ModelABComparisonProps {
  isDarkMode: boolean;
  overallResults?: ProcessedResult[]; // Overall rankings from the leaderboard
}

const ModelABComparison: FC<ModelABComparisonProps> = ({ 
  isDarkMode, 
  overallResults = []
}) => {
  const [selectedModel1, setSelectedModel1] = useState<string>('');
  const [selectedModel2, setSelectedModel2] = useState<string>('');
  const [isDropdown1Open, setIsDropdown1Open] = useState(false);
  const [isDropdown2Open, setIsDropdown2Open] = useState(false);
  const [csvData, setCsvData] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Load CSV data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await loadModelComparisonCSV();
        if (!data) {
          throw new Error('Failed to load comparison data');
        }
        setCsvData(data);
      } catch (error) {
        console.error('Failed to load CSV data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load comparison data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Task information from centralized config
  const taskInfo: Record<string, TaskInfo> = APP_CONFIG.tasks.taskInfo;

  // Parse CSV data and create model data with rankings
  const modelData: ModelData[] = useMemo(() => {
    if (!csvData) return [];

    const parsedModels = parseModelComparisonCSV(csvData);
    
    // Update rankings from overall results
    return parsedModels.map(model => {
      const overallResult = overallResults.find(r => r.model === model.name || r.modelName === model.name);
      return {
        ...model,
        rank: overallResult?.rank || model.rank
      };
    }).sort((a, b) => {
      const rankA = typeof a.rank === 'string' ? parseInt(a.rank) : a.rank;
      const rankB = typeof b.rank === 'string' ? parseInt(b.rank) : b.rank;
      return rankA - rankB;
    });
  }, [csvData, overallResults]);

  const selectedModelData1 = modelData.find(m => m.name === selectedModel1);
  const selectedModelData2 = modelData.find(m => m.name === selectedModel2);

  // Prepare radar chart data
  const radarData: RadarChartData[] = useMemo(() => {
    if (!selectedModelData1 || !selectedModelData2) return [];

    return Object.entries(taskInfo).map(([key, info]) => {
      const score1 = selectedModelData1.scores[key as keyof typeof selectedModelData1.scores];
      const score2 = selectedModelData2.scores[key as keyof typeof selectedModelData2.scores];
      
      return {
        metric: info.name,
        [selectedModelData1.name]: score1,
        [selectedModelData2.name]: score2,
      };
    });
  }, [selectedModelData1, selectedModelData2, taskInfo]);

  // Removed renderModelSelector - now using ModelSelector component


  if (isLoading) {
    return <LoadingState isDarkMode={isDarkMode} />;
  }

  if (error) {
    return (
      <ErrorState 
        message={error} 
        isDarkMode={isDarkMode} 
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (modelData.length === 0) {
    return <EmptyState isDarkMode={isDarkMode} />;
  }

  return (
    <div className={`container mx-auto px-4 py-8 ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/30'} rounded-lg`}>
      {/* Header */}
      <ComparisonHeader isDarkMode={isDarkMode} />

      {/* Model Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ModelSelector
          selectedModel={selectedModel1}
          setSelectedModel={setSelectedModel1}
          isOpen={isDropdown1Open}
          setIsOpen={setIsDropdown1Open}
          label="Select First Model"
          modelData={modelData}
          isDarkMode={isDarkMode}
        />
        <ModelSelector
          selectedModel={selectedModel2}
          setSelectedModel={setSelectedModel2}
          isOpen={isDropdown2Open}
          setIsOpen={setIsDropdown2Open}
          label="Select Second Model"
          modelData={modelData}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Error Message for Same Model Selection */}
      {selectedModel1 && selectedModel2 && selectedModel1 === selectedModel2 && (
        <SameModelWarning isDarkMode={isDarkMode} />
      )}

      {/* Comparison Content */}
      {selectedModelData1 && selectedModelData2 && selectedModel1 !== selectedModel2 ? (
        <div className="space-y-8">
          {/* Overall Ranking Comparison */}
          <RankingComparison 
            model1={selectedModelData1}
            model2={selectedModelData2}
            isDarkMode={isDarkMode}
          />

          {/* Task Performance Comparison Table */}
          <TaskPerformanceTable 
            model1={selectedModelData1}
            model2={selectedModelData2}
            isDarkMode={isDarkMode}
            taskInfo={taskInfo}
          />

          {/* Performance Visualization */}
          <PerformanceVisualization 
            radarData={radarData}
            model1Name={selectedModelData1.name}
            model2Name={selectedModelData2.name}
            isDarkMode={isDarkMode}
          />
        </div>
      ) : (
        <SelectModelsPrompt isDarkMode={isDarkMode} />
      )}
    </div>
  );
};

export default ModelABComparison;
