import React, { FC, useState, useMemo, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { loadModelComparisonCSV, parseModelComparisonCSV, ModelComparisonData } from '@/lib/csvLoader';
import { ProcessedResult } from '@/lib/types';

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

  // Task information with full names and abbreviations
  const taskInfo = {
    CG: { name: 'Code Generation', abbr: 'CG' },
    CS: { name: 'Code Summarization', abbr: 'CS' },
    CT: { name: 'Code Translation', abbr: 'CT' },
    CRv: { name: 'Code Review', abbr: 'CRv' },
    CR: { name: 'Code Reasoning', abbr: 'CR' },
    TG: { name: 'Test Generation', abbr: 'TG' },
    VD: { name: 'Vulnerability Detection', abbr: 'VD' }
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
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="mb-6">
          <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Model A/B Comparison
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading comparison data...
          </p>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="mb-6">
          <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Model A/B Comparison
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            {error}
          </p>
        </div>
        <div className="flex justify-center items-center py-12">
          <button
            onClick={() => window.location.reload()}
            className={`px-4 py-2 rounded-lg ${
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
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="mb-6">
          <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Model A/B Comparison
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            No model data available for comparison.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} rounded-lg shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
      {/* Header Section */}
      <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        <h2 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Model A/B Comparison
        </h2>
        <p className={`text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Compare two models side by side across all coding tasks. Better performance is highlighted in green.
        </p>
      </div>

      {/* Model Selectors */}
      <div className="p-6">
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

        {/* Comparison Table */}
        {selectedModelData1 && selectedModelData2 ? (
          <div className="space-y-6">
            {/* Overall Ranking Comparison */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Overall Ranking
              </h3>
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className={`text-center p-4 rounded-lg ${
                  (typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank) < 
                  (typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank)
                    ? isDarkMode ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                    : isDarkMode ? 'bg-slate-700' : 'bg-white'
                }`}>
                  <div className="flex items-center justify-center mb-2">
                    {(typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank) < 
                     (typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank) && (
                      <CrownIcon className="w-6 h-6 text-yellow-500 mr-2" />
                    )}
                    <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      #{selectedModelData1.rank}
                    </span>
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {selectedModelData1.name}
                  </div>
                </div>
                
                <div className="text-center">
                  <span className={`text-2xl font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>VS</span>
                </div>
                
                <div className={`text-center p-4 rounded-lg ${
                  (typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank) < 
                  (typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank)
                    ? isDarkMode ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                    : isDarkMode ? 'bg-slate-700' : 'bg-white'
                }`}>
                  <div className="flex items-center justify-center mb-2">
                    {(typeof selectedModelData2.rank === 'string' ? parseInt(selectedModelData2.rank) : selectedModelData2.rank) < 
                     (typeof selectedModelData1.rank === 'string' ? parseInt(selectedModelData1.rank) : selectedModelData1.rank) && (
                      <CrownIcon className="w-6 h-6 text-yellow-500 mr-2" />
                    )}
                    <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      #{selectedModelData2.rank}
                    </span>
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {selectedModelData2.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Task Performance Comparison Table */}
            <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'} overflow-hidden`}>
              <div className={`px-4 py-3 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'} border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Task Performance Comparison
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'}`}>
                    <tr>
                      <th className={`px-6 py-4 text-left text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Task
                      </th>
                      <th className={`px-6 py-4 text-center text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {selectedModelData1.name}
                      </th>
                      <th className={`px-6 py-4 text-center text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
                        <tr key={key} className={isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'}>
                          <td className={`px-6 py-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            <div>
                              <div className="text-base font-medium">{info.name}</div>
                              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {info.abbr}
                              </div>
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-center ${
                            model1Better 
                              ? isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'
                              : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            <div className="flex items-center justify-center space-x-2">
                              {model1Better && <CrownIcon className="w-5 h-5 text-yellow-500" />}
                              <span className="text-lg font-semibold">{score1.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-center ${
                            model2Better 
                              ? isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'
                              : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            <div className="flex items-center justify-center space-x-2">
                              {model2Better && <CrownIcon className="w-5 h-5 text-yellow-500" />}
                              <span className="text-lg font-semibold">{score2.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className="text-lg mb-2">Select two models to compare</div>
            <div className="text-sm">Choose models from the dropdowns above to see detailed performance comparison</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelABComparison;
