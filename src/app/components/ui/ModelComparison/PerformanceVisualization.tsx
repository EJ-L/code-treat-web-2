import React from 'react';
import { PerformanceVisualizationProps } from './types';
import ModelComparisonRadarChart from '@/app/components/ui/ModelComparisonRadarChart';
import ModelComparisonBarChart from '@/app/components/ui/ModelComparisonBarChart';

/**
 * Component for displaying performance visualization (radar or bar chart)
 */
export const PerformanceVisualization: React.FC<PerformanceVisualizationProps> = ({
  radarData,
  model1Name,
  model2Name,
  isDarkMode
}) => {
  const shouldUseBarChart = radarData.length <= 2;

  return (
    <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800/20' : 'border-gray-200 bg-white/60'} overflow-hidden`}>
      <div className={`px-6 py-4 ${isDarkMode ? 'bg-slate-800/30' : 'bg-gray-50/70'} border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Performance Visualization
        </h3>
      </div>
      
      <div className="p-6" style={{ height: '500px' }}>
        {radarData.length > 0 ? (
          shouldUseBarChart ? (
            <ModelComparisonBarChart 
              data={radarData} 
              models={[model1Name, model2Name]} 
              activeModels={{
                [model1Name]: true,
                [model2Name]: true
              }}
              isDarkMode={isDarkMode} 
            />
          ) : (
            <ModelComparisonRadarChart 
              data={radarData} 
              models={[model1Name, model2Name]}
              activeModels={{
                [model1Name]: true,
                [model2Name]: true
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
  );
};
