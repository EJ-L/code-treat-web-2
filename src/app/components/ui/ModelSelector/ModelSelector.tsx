import React from 'react';
import { ModelSelectorProps } from './types';
import { DropdownLabel } from './DropdownLabel';
import { DropdownButton } from './DropdownButton';
import { DropdownOptions } from './DropdownOptions';

/**
 * Main ModelSelector component - composed of smaller, focused components
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  isOpen,
  setIsOpen,
  label,
  modelData,
  isDarkMode
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (modelName: string) => {
    setSelectedModel(modelName);
    setIsOpen(false);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <DropdownLabel label={label} isDarkMode={isDarkMode} />
      <div className="relative">
        <DropdownButton
          selectedModel={selectedModel}
          isOpen={isOpen}
          isDarkMode={isDarkMode}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
        />
        {isOpen && (
          <DropdownOptions
            modelData={modelData}
            selectedModel={selectedModel}
            isDarkMode={isDarkMode}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
};
