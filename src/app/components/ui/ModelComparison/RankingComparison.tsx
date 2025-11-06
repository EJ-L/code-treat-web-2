import React from 'react';
import { RankingComparisonProps } from './types';
import { CrownIcon } from './CrownIcon';

/**
 * Component for displaying overall ranking comparison between two models
 */
export const RankingComparison: React.FC<RankingComparisonProps> = ({
  model1,
  model2,
  isDarkMode
}) => {
  const getRankNumber = (rank: number | string): number => {
    return typeof rank === 'string' ? parseInt(rank) : rank;
  };

  const model1Rank = getRankNumber(model1.rank);
  const model2Rank = getRankNumber(model2.rank);
  const model1Better = model1Rank < model2Rank;
  const model2Better = model2Rank < model1Rank;

  const getModelCardStyles = (isBetter: boolean, isDarkMode: boolean): string => {
    const baseStyles = 'text-center p-6 rounded-lg';
    const betterStyles = isBetter
      ? (isDarkMode ? 'bg-green-900/30 border-2 border-green-600' : 'bg-green-50 border-2 border-green-300')
      : (isDarkMode ? 'bg-slate-700/30 border border-slate-600' : 'bg-gray-100 border border-gray-300');
    return `${baseStyles} ${betterStyles}`;
  };

  return (
    <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-800/20' : 'bg-white/60'} border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
      <h3 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Overall Ranking
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:gap-6 items-center">
        {/* Model 1 */}
        <div className={getModelCardStyles(model1Better, isDarkMode)}>
          <div className="flex items-center justify-center mb-3">
            {model1Better && (
              <CrownIcon className="w-8 h-8 text-yellow-500 mr-3" />
            )}
            <span className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              #{model1.rank}
            </span>
          </div>
          <div className={`text-sm sm:text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} text-center px-1`}>
            {model1.name}
          </div>
        </div>
        
        {/* VS Separator */}
        <div className="text-center">
          <span className={`text-2xl sm:text-4xl font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            VS
          </span>
        </div>
        
        {/* Model 2 */}
        <div className={getModelCardStyles(model2Better, isDarkMode)}>
          <div className="flex items-center justify-center mb-3">
            {model2Better && (
              <CrownIcon className="w-8 h-8 text-yellow-500 mr-3" />
            )}
            <span className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              #{model2.rank}
            </span>
          </div>
          <div className={`text-sm sm:text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} text-center px-1`}>
            {model2.name}
          </div>
        </div>
      </div>
    </div>
  );
};
