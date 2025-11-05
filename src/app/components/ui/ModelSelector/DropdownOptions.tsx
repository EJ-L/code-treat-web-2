import React from 'react';
import { DropdownOptionsProps } from './types';
import { ModelOption } from './ModelOption';
import { getDropdownOptionsStyles } from './styles';

/**
 * Dropdown options container component
 */
export const DropdownOptions: React.FC<DropdownOptionsProps> = ({
  modelData,
  selectedModel,
  isDarkMode,
  onSelect
}) => (
  <div className={getDropdownOptionsStyles(isDarkMode)}>
    {modelData.map((model) => (
      <ModelOption
        key={model.name}
        model={model}
        isSelected={selectedModel === model.name}
        isDarkMode={isDarkMode}
        onSelect={onSelect}
      />
    ))}
  </div>
);
