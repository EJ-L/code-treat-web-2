import React from 'react';
import { ErrorMessageProps, LoadingStateProps, EmptyStateProps } from './types';
import { APP_CONFIG } from '@/config/app.config';

/**
 * Loading state component
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ 
  isDarkMode, 
  message = 'Loading comparison data...' 
}) => (
  <div className={`p-8 rounded-lg ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/50'}`}>
    <div className="text-center">
      <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Model Performance Comparison
      </h2>
      <div className="flex justify-center items-center py-12">
        <div className={`animate-spin rounded-full ${APP_CONFIG.ui.animations.loadingSpinnerSize} border-b-2 border-${APP_CONFIG.ui.colors.primary}`}></div>
        <span className={`ml-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {message}
        </span>
      </div>
    </div>
  </div>
);

/**
 * Error state component
 */
export const ErrorState: React.FC<ErrorMessageProps> = ({ 
  message, 
  isDarkMode, 
  onRetry 
}) => (
  <div className={`p-8 rounded-lg ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/50'}`}>
    <div className="text-center">
      <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Model Performance Comparison
      </h2>
      <p className={`text-lg mb-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`px-6 py-3 rounded-lg ${
            isDarkMode 
              ? `bg-${APP_CONFIG.ui.colors.primary} hover:bg-blue-700 text-white` 
              : `bg-${APP_CONFIG.ui.colors.primary.replace('-600', '-500')} hover:bg-blue-600 text-white`
          } transition-colors`}
        >
          Retry
        </button>
      )}
    </div>
  </div>
);

/**
 * Empty state component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ 
  isDarkMode, 
  message = 'No model data available for comparison.' 
}) => (
  <div className={`p-8 rounded-lg ${isDarkMode ? 'bg-slate-50/5' : 'bg-gray-50/50'}`}>
    <div className="text-center">
      <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Model Performance Comparison
      </h2>
      <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        {message}
      </p>
    </div>
  </div>
);

/**
 * Same model selection warning component
 */
export const SameModelWarning: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div className={`p-4 rounded-lg border-2 ${isDarkMode ? 'bg-red-900/20 border-red-600 text-red-300' : 'bg-red-50 border-red-300 text-red-700'} mb-6`}>
    <div className="flex items-center">
      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span className="font-medium">Please select two different models to compare.</span>
    </div>
  </div>
);

/**
 * Select models prompt component
 */
export const SelectModelsPrompt: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div className={`text-center py-8 sm:py-16 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
    <div className="text-xl sm:text-2xl mb-4 font-semibold">Select two models to compare</div>
    <div className="text-base sm:text-lg px-4">Choose models from the dropdowns above to see detailed performance comparison and visualizations</div>
  </div>
);
