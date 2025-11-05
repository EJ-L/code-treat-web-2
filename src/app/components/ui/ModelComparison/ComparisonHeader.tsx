import React from 'react';
import { ComparisonHeaderProps } from './types';

/**
 * Header component for model comparison section
 */
export const ComparisonHeader: React.FC<ComparisonHeaderProps> = ({ isDarkMode }) => (
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
);
