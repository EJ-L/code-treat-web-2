import React from 'react';
import { ModelOptionProps } from './types';
import { getModelOptionStyles, getModelNameStyles, getRankStyles } from './styles';

/**
 * Individual model option component for dropdown
 */
export const ModelOption: React.FC<ModelOptionProps> = ({
  model,
  isSelected,
  isDarkMode,
  onSelect
}) => (
  <button
    onClick={() => onSelect(model.name)}
    className={getModelOptionStyles(isSelected, isDarkMode)}
  >
    <div className="flex justify-between items-center">
      <span className={getModelNameStyles(isDarkMode)}>
        {model.name}
      </span>
      <span className={getRankStyles(isDarkMode)}>
        #{model.rank}
      </span>
    </div>
  </button>
);
