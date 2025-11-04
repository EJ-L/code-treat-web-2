import React, { FC, useState, useMemo, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { loadModelComparisonCSV, parseModelComparisonCSV, ModelComparisonData } from '@/lib/csvLoader';
import { ProcessedResult } from '@/lib/types';
import ModelComparisonRadarChart from '@/app/components/ui/ModelComparisonRadarChart';
import ModelComparisonBarChart from '@/app/components/ui/ModelComparisonBarChart';

// Crown icon as SVG component since CrownIcon might not be available
const CrownIcon: FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7-2h8.6l.9-5.4-2.1 1.8L12 8l-3.1 2.4-2.1-1.8L7.7 14z"/>
  </svg>
);

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

  // Task information with full names, abbreviations, and metric descriptions
  const taskInfo = {
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
  };

  // Parse CSV data and create model data with rankings
  const modelData = useMemo(() => {
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
  const radarData = useMemo(() => {
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

  const renderModelSelector = (
    selectedModel: string,
    setSelectedModel: (model: string) => void,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void,
    label: string
  ) => (
    <div className="relative">
      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
          }}
          className={`w-full px-4 py-3 text-left rounded-lg border transition-colors ${
            isDarkMode 
              ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' 
              : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="block truncate">
            {selectedModel || 'Select a model...'}
          </span>
          <ChevronDownIcon className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className={`absolute z-10 mt-1 w-full rounded-lg shadow-lg ${
            isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'
          } border max-h-60 overflow-auto`}>
            {modelData.map((model) => (
              <button
                key={model.name}
                onClick={() => {
                  setSelectedModel(model.name);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left hover:${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'} ${
                  selectedModel === model.name ? (isDarkMode ? 'bg-slate-700' : 'bg-gray-100') : ''
                } transition-colors`}
              >
                <div className="flex justify-between items-center">
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                    {model.name}
                  </span>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    #{model.rank}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );


  if (isLoading) {
    return (
      <div className={`p-8 rounded-lg ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/50'}`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Model Performance Comparison
          </h2>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className={`ml-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading comparison data...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-8 rounded-lg ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/50'}`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Model Performance Comparison
          </h2>
          <p className={`text-lg mb-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className={`px-6 py-3 rounded-lg ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } transition-colors`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (modelData.length === 0) {
    return (
      <div className={`p-8 rounded-lg ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/50'}`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Model Performance Comparison
          </h2>
          <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            No model data available for comparison.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`container mx-auto px-4 py-8 ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/30'} rounded-lg`}>
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className={`text-3xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Model Performance Comparison
        </h2>
        <div className={`text-m leading-relaxed max-w-4xl mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <p className="mb-2">
            <span className="font-semibold">Ranking Calculation:</span> Based on average ranking across 7 task groups. For each model, we calculate their rank in each task category, then compute the arithmetic mean of these ranks.
          </p>
          <p>
            <span className="font-semibold">Task Metrics:</span> Code Generation (Pass@1), Code Translation (CodeBLEU), Code Summarization (BLEU-4), Code Review (F1), Code Reasoning (Accuracy), Unit Test Generation (Pass@1), Vulnerability Detection (F1).
          </p>
        </div>
      </div>

      {/* Model Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {renderModelSelector(
          selectedModel1,
          setSelectedModel1,
          isDropdown1Open,
          setIsDropdown1Open,
          'Select First Model'
        )}
        {renderModelSelector(
          selectedModel2,
          setSelectedModel2,
          isDropdown2Open,
          setIsDropdown2Open,
          'Select Second Model'
        )}
      </div>

      {/* Error Message for Same Model Selection */}
      {selectedModel1 && selectedModel2 && selectedModel1 === selectedModel2 && (
        <div className={`p-4 rounded-lg border-2 ${isDarkMode ? 'bg-red-900/20 border-red-600 text-red-300' : 'bg-red-50 border-red-300 text-red-700'} mb-6`}>
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Please select two different models to compare.</span>
          </div>
        </div>
      )}

      {/* Comparison Content */}
      {selectedModelData1 && selectedModelData2 && selectedModel1 !== selectedModel2 ? (
        <div className="space-y-8">
          {/* Overall Ranking Comparison */}
          <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-800/20' : 'bg-white/60'} border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
            <h3 className={`text-2xl font-bold mb-6 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Overall Ranking
            </h3>
            <div className="grid grid-cols-3 gap-6 items-center">
              <div className={`text-center p-6 rounded-lg ${
                (typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank) < 
                (typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank)
                  ? isDarkMode ? 'bg-green-900/30 border-2 border-green-600' : 'bg-green-50 border-2 border-green-300'
                  : isDarkMode ? 'bg-slate-700/30 border border-slate-600' : 'bg-gray-100 border border-gray-300'
              }`}>
                <div className="flex items-center justify-center mb-3">
                  {(typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank) < 
                   (typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank) && (
                    <CrownIcon className="w-8 h-8 text-yellow-500 mr-3" />
                  )}
                  <span className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    #{selectedModelData1.rank}
                  </span>
                </div>
                <div className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {selectedModelData1.name}
                </div>
              </div>
              
              <div className="text-center">
                <span className={`text-4xl font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>VS</span>
              </div>
              
              <div className={`text-center p-6 rounded-lg ${
                (typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank) < 
                (typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank)
                  ? isDarkMode ? 'bg-green-900/30 border-2 border-green-600' : 'bg-green-50 border-2 border-green-300'
                  : isDarkMode ? 'bg-slate-700/30 border border-slate-600' : 'bg-gray-100 border border-gray-300'
              }`}>
                <div className="flex items-center justify-center mb-3">
                  {(typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank) < 
                   (typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank) && (
                    <CrownIcon className="w-8 h-8 text-yellow-500 mr-3" />
                  )}
                  <span className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    #{selectedModelData2.rank}
                  </span>
                </div>
                <div className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {selectedModelData2.name}
                </div>
              </div>
            </div>
          </div>

          {/* Task Performance Comparison Table */}
          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800/20' : 'border-gray-200 bg-white/60'} overflow-hidden`}>
            <div className={`px-6 py-4 ${isDarkMode ? 'bg-slate-800/30' : 'bg-gray-50/70'} border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Task Performance Comparison
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${isDarkMode ? 'bg-slate-800/20' : 'bg-gray-100/50'}`}>
                  <tr>
                    <th className={`px-8 py-6 text-left text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      Task
                    </th>
                    <th className={`px-8 py-6 text-center text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {selectedModelData1.name}
                    </th>
                    <th className={`px-8 py-6 text-center text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {selectedModelData2.name}
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                  {Object.entries(taskInfo).map(([key, info]) => {
                    const score1 = selectedModelData1.scores[key as keyof typeof selectedModelData1.scores];
                    const score2 = selectedModelData2.scores[key as keyof typeof selectedModelData2.scores];
                    const model1Better = score1 > score2;
                    const model2Better = score2 > score1;
                    
                    return (
                      <tr key={key} className={`transition-colors duration-200 ${isDarkMode ? 'hover:bg-slate-700/20' : 'hover:bg-gray-50/70'}`}>
                        <td className={`px-8 py-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          <div className="group relative">
                            <div className="text-lg font-semibold">{info.name}</div>
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {info.abbr}
                            </div>
                            {/* Tooltip */}
                            <div className={`absolute left-0 top-full mt-2 p-3 rounded-lg shadow-lg z-10 w-64 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none ${
                              isDarkMode ? 'bg-slate-800 border border-slate-600 text-gray-200' : 'bg-white border border-gray-300 text-gray-700'
                            }`}>
                              <div className="text-sm font-medium">{info.metric}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-8 py-8 text-center transition-all duration-300 ${
                          model1Better 
                            ? isDarkMode ? 'bg-green-900/30 text-green-300 font-bold' : 'bg-green-50 text-green-800 font-bold'
                            : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          <div className="flex items-center justify-center space-x-3">
                            {model1Better && <CrownIcon className="w-6 h-6 text-yellow-500" />}
                            <span className="text-xl font-bold">{score1.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className={`px-8 py-8 text-center transition-all duration-300 ${
                          model2Better 
                            ? isDarkMode ? 'bg-green-900/30 text-green-300 font-bold' : 'bg-green-50 text-green-800 font-bold'
                            : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          <div className="flex items-center justify-center space-x-3">
                            {model2Better && <CrownIcon className="w-6 h-6 text-yellow-500" />}
                            <span className="text-xl font-bold">{score2.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance Visualization */}
          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800/20' : 'border-gray-200 bg-white/60'} overflow-hidden`}>
            <div className={`px-6 py-4 ${isDarkMode ? 'bg-slate-800/30' : 'bg-gray-50/70'} border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Performance Visualization
              </h3>
            </div>
            
            <div className="p-6" style={{ height: '500px' }}>
              {radarData.length > 0 ? (
                radarData.length <= 2 ? (
                  <ModelComparisonBarChart 
                    data={radarData} 
                    models={[selectedModelData1.name, selectedModelData2.name]} 
                    activeModels={{
                      [selectedModelData1.name]: true,
                      [selectedModelData2.name]: true
                    }}
                    isDarkMode={isDarkMode} 
                  />
                ) : (
                  <ModelComparisonRadarChart 
                    data={radarData} 
                    models={[selectedModelData1.name, selectedModelData2.name]}
                    activeModels={{
                      [selectedModelData1.name]: true,
                      [selectedModelData2.name]: true
                    }}
                    isDarkMode={isDarkMode} 
                  />
                )
              ) : (
                <div className={`text-center py-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <div className="text-xl mb-2">No data available for visualization</div>
                  <div className="text-sm">Please select two models to see the performance chart</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={`text-center py-16 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="text-2xl mb-4 font-semibold">Select two models to compare</div>
          <div className="text-lg">Choose models from the dropdowns above to see detailed performance comparison and visualizations</div>
        </div>
      )}
    </div>
  );
};

export default ModelABComparison;
