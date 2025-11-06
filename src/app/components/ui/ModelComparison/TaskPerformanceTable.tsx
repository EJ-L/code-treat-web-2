import React from 'react';
import { TaskPerformanceTableProps } from './types';
import { CrownIcon } from './CrownIcon';

/**
 * Component for displaying task-by-task performance comparison in a table
 */
export const TaskPerformanceTable: React.FC<TaskPerformanceTableProps> = ({
  model1,
  model2,
  isDarkMode,
  taskInfo
}) => {
  const getTableHeaderStyles = (isDarkMode: boolean): string => {
    return `px-4 sm:px-8 py-4 sm:py-6 text-left text-base sm:text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`;
  };

  const getTableCellStyles = (isBetter: boolean, isDarkMode: boolean): string => {
    const baseStyles = 'px-4 sm:px-8 py-4 sm:py-8 text-center transition-all duration-300';
    const betterStyles = isBetter
      ? (isDarkMode ? 'bg-green-900/30 text-green-300 font-bold' : 'bg-green-50 text-green-800 font-bold')
      : (isDarkMode ? 'text-gray-300' : 'text-gray-700');
    return `${baseStyles} ${betterStyles}`;
  };

  const getTooltipStyles = (isDarkMode: boolean): string => {
    const baseStyles = `
      absolute left-0 top-full mt-2 p-3 rounded-lg shadow-lg z-10 w-64 
      opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
    `;
    const themeStyles = isDarkMode
      ? 'bg-slate-800 border border-slate-600 text-gray-200'
      : 'bg-white border border-gray-300 text-gray-700';
    return `${baseStyles} ${themeStyles}`;
  };

  return (
    <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800/20' : 'border-gray-200 bg-white/60'} overflow-hidden`}>
      <div className={`px-6 py-4 ${isDarkMode ? 'bg-slate-800/30' : 'bg-gray-50/70'} border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        <h3 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Task Performance Comparison
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`${isDarkMode ? 'bg-slate-800/20' : 'bg-gray-100/50'}`}>
            <tr>
              <th className={getTableHeaderStyles(isDarkMode)}>
                Task
              </th>
              <th className={`${getTableHeaderStyles(isDarkMode)} text-center`}>
                {model1.name}
              </th>
              <th className={`${getTableHeaderStyles(isDarkMode)} text-center`}>
                {model2.name}
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
            {Object.entries(taskInfo).map(([key, info]) => {
              const score1 = model1.scores[key as keyof typeof model1.scores];
              const score2 = model2.scores[key as keyof typeof model2.scores];
              const model1Better = score1 > score2;
              const model2Better = score2 > score1;
              
              return (
                <tr 
                  key={key} 
                  className={`transition-colors duration-200 ${isDarkMode ? 'hover:bg-slate-700/20' : 'hover:bg-gray-50/70'}`}
                >
                  <td className={`px-8 py-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <div className="group relative">
                      <div className="text-lg font-semibold">{info.name}</div>
                      <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {info.abbr}
                      </div>
                      {/* Tooltip */}
                      <div className={getTooltipStyles(isDarkMode)}>
                        <div className="text-sm font-medium">{info.metric}</div>
                      </div>
                    </div>
                  </td>
                  <td className={getTableCellStyles(model1Better, isDarkMode)}>
                    <div className="flex items-center justify-center space-x-3">
                      {model1Better && <CrownIcon className="w-6 h-6 text-yellow-500" />}
                      <span className="text-xl font-bold">{score1.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className={getTableCellStyles(model2Better, isDarkMode)}>
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
  );
};
