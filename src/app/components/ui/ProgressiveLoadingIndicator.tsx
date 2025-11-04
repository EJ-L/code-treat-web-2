import React from 'react';

interface ProgressiveLoadingIndicatorProps {
  progress: number;
  isLoading: boolean;
  isDarkMode: boolean;
  className?: string;
}

export const ProgressiveLoadingIndicator: React.FC<ProgressiveLoadingIndicatorProps> = ({
  progress,
  isLoading,
  isDarkMode,
  className = ''
}) => {
  if (!isLoading && progress >= 100) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Loading leaderboard data...
        </span>
        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {Math.round(progress)}%
        </span>
      </div>
      
      <div className={`w-full bg-gray-200 rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      
      {isLoading && (
        <div className="flex items-center mt-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Loading models in batches for better performance...
          </span>
        </div>
      )}
    </div>
  );
};
